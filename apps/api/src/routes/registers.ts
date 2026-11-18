import { Router, Request, Response, NextFunction, json as jsonBody } from 'express';
import { db } from '../dbLimit';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

// Registers: Seva, Donation, Magazine and Camp, plus offline (on-site, manual) entries for all four that staff add, correct, cancel and print.
// One entry per booking, subscription or registration. Seva, donation and camp entries list every person named:
// name, relation, gothram, nakshatram, rasi and date of birth. Magazine entries carry the postal address and the plan dates.
// PAN, Aadhaar, passwords, tokens and the Razorpay signature are never read here.
const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const dbg = (e: any) => (IS_PROD ? undefined : e?.sqlMessage || e?.message || String(e));
const fail = (res: Response, e: any, message: string) => {
  console.error(`Registers: ${message}`, e?.sqlMessage || e?.message || e);
  return res.status(500).json({ message, detail: dbg(e) });
};
const adminGuard = (req: Request, res: Response, next: NextFunction) => authenticate(req as AuthenticatedRequest, res, next);
router.use(adminGuard);
router.use(jsonBody({ limit: '200kb' }));
// Personal details: never let a browser or a proxy keep a copy
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// ---------- Small helpers ----------
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDay = (d: string) => DAY.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
const one = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const money = (v: any) => Math.round(Number(v || 0) * 100) / 100;
const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const pad2 = (n: number) => String(n).padStart(2, '0');
const dateOnly = (d: any) => (d instanceof Date ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : d ? String(d).slice(0, 10) : null);
const iso = (d: any) => (d instanceof Date ? d.toISOString() : d ? String(d) : null);
const norm = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9஀-௿]+/g, '');
const human = (k: string) => k.replace(/^x_/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());

// ---------- Which columns exist (looked up once, kept for 10 minutes) ----------
// The booking tables can carry extra sankalpam columns, and the profile tables may or may not keep a date of birth.
// Column names come from the database itself and must be plain letters, digits and underscores before they are used.
type Table = 'seva_bookings' | 'donation_booking' | 'magazine_subscriptions' | 'camp_registrations' | 'camps' | 'devotee_family_members' | 'devotees' | 'register_manual_entries' | 'sevas' | 'offerings' | 'donation';
const colCache = new Map<string, { at: number; cols: string[] }>();
async function columnsOf(table: Table): Promise<string[]> {
  const hit = colCache.get(table);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.cols;
  try {
    const [rows]: any = await db.query(`SHOW COLUMNS FROM \`${table}\``);
    const cols = (rows as any[]).map((r) => String(r.Field)).filter((c) => /^[A-Za-z0-9_]{1,64}$/.test(c));
    colCache.set(table, { at: Date.now(), cols });
    return cols;
  } catch { return []; }
}
const DOB_NAMES = ['dob', 'date_of_birth', 'birth_date', 'birthdate', 'dateofbirth', 'birthday'];
const pick = (cols: string[], names: string[]) => { for (const n of names) { const c = cols.find((x) => x.toLowerCase() === n); if (c) return c; } return null; };

const SENSITIVE = /(^|_)pan(_|$)|pan_?(no|num|card)|aadhaar|aadhar|signature|password|(^|_)otp(_|$)|token|secret|razorpay|hash|salt/i;
const WANTED = /sankalp|birth|dob|gothr|gotr|nakshat|rasi|raasi|rashi|donor|in_name|pooja_for|prayer|wish|purpose|remark|note|message|address|pincode|pin_code|country|occasion|dedicat|star_/i;
const SEVA_USED = new Set(['id', 'devotee_id', 'seva_id', 'seva_title', 'category', 'amount', 'currency', 'status', 'booking_date', 'receipt_no', 'sankalpam_data', 'created_at', 'updated_at']);
const DON_USED = new Set(['id', 'devotee_id', 'donation_id', 'fund_title', 'category', 'amount', 'currency', 'status', 'booking_date', 'receipt_no', 'family_members', 'donor_city', 'donor_state', 'created_at', 'updated_at']);
const MAG_USED = new Set(['id', 'devotee_id', 'first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'pincode', 'plan_id', 'plan_name', 'delivery', 'duration_months', 'amount', 'pay_account', 'status', 'start_date', 'end_date', 'receipt_no', 'payment_mode', 'reminder_30', 'reminder_7', 'created_at', 'updated_at']);
const CAMP_USED = new Set(['id', 'camp_id', 'devotee_id', 'first_name', 'last_name', 'email', 'phone', 'adults', 'children', 'status', 'amount', 'payment_status', 'created_at', 'updated_at']);
const WANTED_MORE = /(^|_)age($|_)|gender|food|diet|arriv|depart|stay|room|accommodat|vehicle|special|emergency|occupation|batch|comment|gift|company|state|city/i;
const PEOPLE_COL = /member|participant|attendee|guest|people|person|sankalp/i;
const extraColumns = (cols: string[], used: Set<string>, more = false) =>
  cols.filter((c) => (WANTED.test(c) || (more && WANTED_MORE.test(c))) && !used.has(c.toLowerCase()) && !SENSITIVE.test(c) && !/_id$/i.test(c)).slice(0, 12);

type Kind = 'seva' | 'donation' | 'magazine' | 'camp';
type Ctx = { extra: string[]; devDob: string | null; peopleCol: string | null; campStart: string | null; campEnd: string | null; manual: boolean; mcols: string[] };
const HAS_DEVOTEE: Record<Kind, boolean> = { seva: true, donation: true, camp: true, magazine: false };
const alias = (k: Kind) => (k === 'seva' || k === 'donation' ? 'b' : k === 'camp' ? 'r' : 'm');
const extraSql = (k: Kind, c: Ctx) => c.extra.map((x) => `, ${alias(k)}.\`${x}\` AS \`x_${x}\``).join('') + (HAS_DEVOTEE[k] && c.devDob ? `, v.\`${c.devDob}\` AS devotee_dob` : '');
// Columns that only the magazine and camp registers have; the others return NULL so every register has the same columns
const NO_EXTRAS = `NULL AS end_date, NULL AS address, NULL AS pincode, NULL AS months, NULL AS membership, NULL AS mode, NULL AS adults, NULL AS children, NULL AS payment_ref, NULL AS notes, NULL AS entry_date`;

// One row per booking. All registers use the same column names so the same filters and code work for all of them.
const sevaSql = (c: Ctx) => `
  SELECT b.id AS id, 'online' AS source, b.devotee_id AS devotee_id,
         TRIM(CONCAT(COALESCE(v.first_name,''),' ',COALESCE(v.last_name,''))) AS name,
         v.email AS email, v.phone AS phone, v.city AS city, v.state AS state,
         b.seva_title AS item, b.category AS category, b.amount AS amount, b.currency AS currency,
         CASE b.status WHEN 'SUCCESS' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END AS status,
         b.booking_date AS event_date, b.receipt_no AS receipt_no, ${NO_EXTRAS}, b.sankalpam_data AS members, b.created_at AS paid_at${extraSql('seva', c)}
    FROM seva_bookings b LEFT JOIN devotees v ON v.id = b.devotee_id`;
const donSql = (c: Ctx) => `
  SELECT b.id AS id, 'online' AS source, b.devotee_id AS devotee_id,
         TRIM(CONCAT(COALESCE(v.first_name,''),' ',COALESCE(v.last_name,''))) AS name,
         v.email AS email, v.phone AS phone,
         COALESCE(NULLIF(b.donor_city,''), v.city) AS city, COALESCE(NULLIF(b.donor_state,''), v.state) AS state,
         b.fund_title AS item, COALESCE(NULLIF(b.category,''),'ashram') AS category, b.amount AS amount, b.currency AS currency,
         CASE b.status WHEN 'SUCCESS' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END AS status,
         b.booking_date AS event_date, b.receipt_no AS receipt_no, ${NO_EXTRAS}, b.family_members AS members, b.created_at AS paid_at${extraSql('donation', c)}
    FROM donation_booking b LEFT JOIN devotees v ON v.id = b.devotee_id`;
// Magazine: the subscriber, the plan, the postal address and the dates the subscription runs
const magSql = (c: Ctx) => `
  SELECT m.id AS id, 'online' AS source, m.devotee_id AS devotee_id,
         TRIM(CONCAT(COALESCE(m.first_name,''),' ',COALESCE(m.last_name,''))) AS name,
         m.email AS email, m.phone AS phone, m.city AS city, m.state AS state,
         m.plan_name AS item, m.delivery AS category, m.amount AS amount, 'INR' AS currency,
         CASE m.status WHEN 'ACTIVE' THEN 'PAID' WHEN 'EXPIRED' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END AS status,
         m.start_date AS event_date, m.end_date AS end_date, m.receipt_no AS receipt_no, m.address AS address, m.pincode AS pincode,
         m.duration_months AS months, m.status AS membership, COALESCE(NULLIF(m.payment_mode,''),'online') AS mode,
         NULL AS adults, NULL AS children, NULL AS payment_ref, NULL AS notes, NULL AS entry_date, NULL AS members, m.created_at AS paid_at${extraSql('magazine', c)}
    FROM magazine_subscriptions m`;
// Camp: the registrant, the camp, how many adults and children, and the people named if the table keeps a list
const campSql = (c: Ctx) => `
  SELECT r.id AS id, 'online' AS source, r.devotee_id AS devotee_id,
         TRIM(CONCAT(COALESCE(r.first_name,''),' ',COALESCE(r.last_name,''))) AS name,
         r.email AS email, r.phone AS phone, v.city AS city, v.state AS state,
         COALESCE(cm.title_en,'Camp') AS item, COALESCE(NULLIF(r.status,''),'registered') AS category, r.amount AS amount, 'INR' AS currency,
         CASE r.payment_status WHEN 'PAID' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' WHEN 'NONE' THEN 'FREE' ELSE 'PENDING' END AS status,
         ${c.campStart ? `cm.\`${c.campStart}\`` : 'NULL'} AS event_date, ${c.campEnd ? `cm.\`${c.campEnd}\`` : 'NULL'} AS end_date, NULL AS receipt_no,
         NULL AS address, NULL AS pincode, NULL AS months, NULL AS membership, NULL AS mode, r.adults AS adults, r.children AS children,
         NULL AS payment_ref, NULL AS notes, NULL AS entry_date,
         ${c.peopleCol ? `r.\`${c.peopleCol}\`` : 'NULL'} AS members, r.created_at AS paid_at${extraSql('camp', c)}
    FROM camp_registrations r LEFT JOIN camps cm ON cm.id = r.camp_id LEFT JOIN devotees v ON v.id = r.devotee_id`;

async function context(kind: Kind): Promise<Ctx> {
  const table: Table = kind === 'seva' ? 'seva_bookings' : kind === 'donation' ? 'donation_booking' : kind === 'magazine' ? 'magazine_subscriptions' : 'camp_registrations';
  const [own, dev, camps] = await Promise.all([columnsOf(table), HAS_DEVOTEE[kind] ? columnsOf('devotees') : Promise.resolve([] as string[]), kind === 'camp' ? columnsOf('camps') : Promise.resolve([] as string[])]);
  // Make sure the offline table (and the columns the magazine and camp entries use) exists; never let a failure here break the register
  await ensureManualTable().catch(() => undefined);
  const manualCols = await columnsOf('register_manual_entries');
  const newKinds = kind === 'magazine' || kind === 'camp';
  const peopleCol = kind === 'camp' ? own.find((c) => PEOPLE_COL.test(c) && !SENSITIVE.test(c) && !/count|total|num|_id$/i.test(c)) || null : null;
  const used = kind === 'seva' ? SEVA_USED : kind === 'donation' ? DON_USED : kind === 'magazine' ? MAG_USED : new Set([...CAMP_USED, (peopleCol || '').toLowerCase()]);
  return {
    extra: extraColumns(own, used, kind === 'magazine' || kind === 'camp'),
    devDob: pick(dev, DOB_NAMES), peopleCol, mcols: manualCols,
    manual: manualCols.length > 0 && (!newKinds || NEW_COLS.every((c) => manualCols.includes(c))),
    campStart: pick(camps, ['start_date', 'from_date', 'begin_date', 'date_from', 'starts_on']),
    campEnd: pick(camps, ['end_date', 'to_date', 'date_to', 'ends_on']),
  };
}
// On-site entries live in their own table. For the seva and donation registers they are put in the same list as the online
// bookings. Both halves are converted to one text collation so the database never refuses to combine them.
const NEW_COLS = ['end_date', 'months', 'adults', 'children'];
const manualSql = (kind: Kind, mc: string[]) => {
  const has = (c: string) => mc.includes(c);
  return `
  SELECT m.id AS id, 'manual' AS source, m.devotee_id AS devotee_id, m.name AS name, m.email AS email, m.phone AS phone, m.city AS city, m.state AS state,
         m.item_title AS item, ${kind === 'camp' ? "CASE WHEN m.status = 'CANCELLED' THEN 'CANCELLED' ELSE 'REGISTERED' END" : 'm.category'} AS category, m.amount AS amount, 'INR' AS currency,
         CASE m.status WHEN 'CANCELLED' THEN 'CANCELLED' WHEN 'ACTIVE' THEN CASE WHEN m.amount <= 0 THEN 'FREE' ELSE 'PAID' END ELSE 'PAID' END AS status,
         m.pooja_date AS event_date, ${has('end_date') ? 'm.end_date' : 'NULL'} AS end_date, m.receipt_no AS receipt_no, m.address AS address, m.pincode AS pincode,
         ${has('months') ? 'm.months' : 'NULL'} AS months,
         ${kind === 'magazine' && has('end_date') ? "CASE WHEN m.status = 'CANCELLED' THEN NULL WHEN m.end_date >= CURDATE() THEN 'ACTIVE' ELSE 'EXPIRED' END" : 'NULL'} AS membership,
         m.payment_mode AS mode, ${has('adults') ? 'm.adults' : 'NULL'} AS adults, ${has('children') ? 'm.children' : 'NULL'} AS children, m.payment_ref AS payment_ref,
         CONCAT_WS('. ', NULLIF(m.notes,''), CASE WHEN m.status = 'CANCELLED' THEN CONCAT('Cancelled: ', COALESCE(m.cancel_reason,'no reason given')) END) AS notes,
         m.entry_date AS entry_date, ${kind === 'seva' || kind === 'donation' ? 'm.people' : 'NULL'} AS members, TIMESTAMP(m.entry_date, COALESCE(TIME(m.created_at), '00:00:00')) AS paid_at
    FROM register_manual_entries m WHERE m.kind = '${kind}'`;
};
const UNION_COLS = ['id', 'source', 'devotee_id', 'name', 'email', 'phone', 'city', 'state', 'item', 'category', 'amount', 'currency', 'status', 'event_date', 'end_date', 'receipt_no', 'address', 'pincode', 'months', 'membership', 'mode', 'adults', 'children', 'payment_ref', 'notes', 'entry_date', 'members', 'paid_at'];
const UNION_TEXT = new Set(['source', 'devotee_id', 'name', 'email', 'phone', 'city', 'state', 'item', 'category', 'currency', 'status', 'receipt_no', 'address', 'pincode', 'membership', 'mode', 'payment_ref', 'notes', 'members']);
function unionSql(kind: Kind, c: Ctx, online: string) {
  const extras = [...c.extra.map((x) => `x_${x}`), ...(c.devDob ? ['devotee_dob'] : [])];
  const pickCols = (al: string, has: (col: string) => boolean) => [...UNION_COLS, ...extras].map((col) => {
    const ref = has(col) ? `${al}.${col}` : 'NULL';
    return (UNION_TEXT.has(col) || col.startsWith('x_')) ? `CONVERT(${ref} USING utf8mb4) COLLATE utf8mb4_unicode_ci AS ${col}` : `${ref} AS ${col}`;
  }).join(', ');
  return `SELECT ${pickCols('a', () => true)} FROM (${online}) a UNION ALL SELECT ${pickCols('m', (col) => UNION_COLS.includes(col))} FROM (${manualSql(kind, c.mcols)}) m`;
}
const sqlFor = (kind: Kind, c: Ctx) => {
  const online = kind === 'seva' ? sevaSql(c) : kind === 'donation' ? donSql(c) : kind === 'magazine' ? magSql(c) : campSql(c);
  return c.manual ? unionSql(kind, c, online) : online;
};
const SHOWS_PEOPLE: Record<Kind, boolean> = { seva: true, donation: true, camp: true, magazine: false };

// ---------- People named in a booking ----------
type Member = { title: string; name: string; relation: string; place: string; gothram: string; nakshathiram: string; rasi: string; dob: string; extra: { label: string; value: string }[]; from_profile: boolean };

// A date of birth is turned into YYYY-MM-DD when it can be read; otherwise the text is kept as it was written.
function readDob(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return dateOnly(v) || '';
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t) return '';
  let y = 0, m = 0, d = 0, x: RegExpMatchArray | null;
  if ((x = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/))) { y = +x[1]; m = +x[2]; d = +x[3]; }
  else if ((x = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) { d = +x[1]; m = +x[2]; y = +x[3]; }
  else return t.slice(0, 40);
  const ok = y >= 1900 && y <= new Date().getFullYear() && m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
  return ok ? `${y}-${pad2(m)}-${pad2(d)}` : t.slice(0, 40);
}

const KEYS = {
  title: ['title', 'salutation'], place: ['place', 'town', 'ooru', 'village', 'native_place', 'nativeplace'], name: ['name', 'fullname', 'full_name', 'membername', 'member_name'], relation: ['relation', 'relationship'],
  gothram: ['gothram', 'gotram', 'gotra', 'gothra'], nakshathiram: ['nakshathiram', 'nakshatram', 'nakshatra', 'nakshathra', 'star'],
  rasi: ['rasi', 'raasi', 'rashi'], dob: ['dob', 'dateofbirth', 'date_of_birth', 'birthdate', 'birth_date', 'birthday'],
};
const SKIP_KEYS = new Set(['id', 'devotee_id', 'devoteeid', 'member_id', 'memberid', 'created_at', 'updated_at', 'selected', 'checked', 'isself', 'is_self', 'key', 'index']);
const USED_KEYS = new Set(Object.values(KEYS).flat());

function memberFrom(o: any): Member {
  const lower = new Map<string, any>();
  for (const k of Object.keys(o)) lower.set(k.toLowerCase(), o[k]);
  const get = (names: string[]) => { for (const n of names) if (lower.has(n) && lower.get(n) != null && lower.get(n) !== '') return lower.get(n); return ''; };
  const extra: { label: string; value: string }[] = [];
  for (const k of Object.keys(o)) {
    const lk = k.toLowerCase();
    if (USED_KEYS.has(lk) || SKIP_KEYS.has(lk) || extra.length >= 8) continue;
    const v = o[k];
    const t = typeof v === 'string' ? v.trim() : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';
    if (t) extra.push({ label: human(k), value: t.slice(0, 120) });
  }
  return {
    title: cut(get(KEYS.title), 20), name: cut(get(KEYS.name), 120), relation: cut(get(KEYS.relation), 60), place: cut(get(KEYS.place), 80),
    gothram: cut(get(KEYS.gothram), 80), nakshathiram: cut(get(KEYS.nakshathiram), 80), rasi: cut(get(KEYS.rasi), 80),
    dob: readDob(get(KEYS.dob)), extra, from_profile: false,
  };
}

// The JSON column may arrive as text or as an object; it may be a list, a list inside an object, or one person.
function readMembers(raw: unknown): Member[] {
  try {
    let v: any = raw;
    if (Buffer.isBuffer(v)) v = v.toString('utf8');
    if (typeof v === 'string') { const t = v.trim(); if (!t) return []; v = JSON.parse(t); }
    if (v && !Array.isArray(v) && typeof v === 'object') v = v.members || v.family || v.people || v.persons || v.sankalpam || [v];
    if (!Array.isArray(v)) return [];
    return v.slice(0, 30)
      .map((m: any) => (typeof m === 'string' ? memberFrom({ name: m }) : m && typeof m === 'object' ? memberFrom(m) : null))
      .filter((m: Member | null): m is Member => !!m && !!(m.name || m.place || m.gothram || m.nakshathiram || m.rasi || m.dob));
  } catch { return []; }
}

// Where the booking did not carry a detail, use the one saved in the devotee's own family list (same devotee, same name only).
async function fillFromProfiles(rows: { devotee_id: string; name: string; devotee_dob: string; members: Member[] }[]) {
  const need = new Set<string>();
  for (const r of rows) {
    if (!r.devotee_id) continue;
    if (r.members.some((m) => !m.gothram || !m.nakshathiram || !m.rasi || !m.dob)) need.add(String(r.devotee_id));
  }
  let fam: Map<string, any> = new Map();
  if (need.size) {
    try {
      const famCols = await columnsOf('devotee_family_members');
      const dobCol = pick(famCols, DOB_NAMES);
      const want = ['name', 'relation', 'gothram', 'nakshathiram', 'rasi'].filter((c) => famCols.includes(c));
      if (famCols.includes('devotee_id') && want.includes('name')) {
        const ids = [...need];
        for (let i = 0; i < ids.length; i += 400) {
          const part = ids.slice(i, i + 400);
          const cols = [...want, ...(dobCol ? [dobCol] : [])].map((c) => `\`${c}\``).join(', ');
          const [list]: any = await db.query(`SELECT devotee_id, ${cols} FROM devotee_family_members WHERE devotee_id IN (${part.map(() => '?').join(',')}) LIMIT 8000`, part);
          for (const f of list as any[]) {
            const key = `${f.devotee_id}|${norm(String(f.name || '').replace(/\([^)]*\)/g, ''))}`;
            if (!fam.has(key)) fam.set(key, { ...f, dob: dobCol ? readDob(f[dobCol]) : '' });
          }
        }
      }
    } catch (e: any) { console.error('Registers: family profile lookup skipped', e?.sqlMessage || e?.message || e); fam = new Map(); }
  }
  for (const r of rows) {
    const self = norm(String(r.name || ''));
    for (const m of r.members) {
      const key = `${r.devotee_id}|${norm(String(m.name || '').replace(/\([^)]*\)/g, ''))}`;
      const f = fam.get(key);
      if (f) {
        let used = false;
        if (!m.relation && f.relation) { m.relation = cut(f.relation, 60); used = true; }
        if (!m.gothram && f.gothram) { m.gothram = cut(f.gothram, 80); used = true; }
        if (!m.nakshathiram && f.nakshathiram) { m.nakshathiram = cut(f.nakshathiram, 80); used = true; }
        if (!m.rasi && f.rasi) { m.rasi = cut(f.rasi, 80); used = true; }
        if (!m.dob && f.dob) { m.dob = f.dob; used = true; }
        if (used) m.from_profile = true;
      }
      if (!m.dob && r.devotee_dob && (self && norm(m.name) === self || /^(self|me|myself)$/i.test(m.relation))) {
        const d = readDob(r.devotee_dob); if (d) { m.dob = d; m.from_profile = true; }
      }
    }
  }
}

// ---------- A booking as the page and the file see it ----------
const rowOut = (r: any, kind: Kind, ctx: Ctx) => ({
  id: r.id, source: (r.source === 'manual' ? 'manual' : 'online') as 'online' | 'manual', devotee_id: r.devotee_id, name: r.name || '', email: r.email || null, phone: r.phone || null, city: r.city || null, state: r.state || null,
  item: r.item || '', category: r.category || '', amount: money(r.amount), currency: r.currency || 'INR', status: r.status as 'PAID' | 'PENDING' | 'FAILED' | 'FREE' | 'CANCELLED',
  event_date: dateOnly(r.event_date), end_date: dateOnly(r.end_date), entry_date: dateOnly(r.entry_date), receipt_no: r.receipt_no || null, paid_at: iso(r.paid_at),
  address: cut(r.address, 300) || null, pincode: cut(r.pincode, 20) || null, months: r.months == null ? null : Number(r.months) || null,
  membership: cut(r.membership, 20) || null, mode: cut(r.mode, 20) || null,
  adults: r.adults == null ? null : Number(r.adults) || 0, children: r.children == null ? null : Number(r.children) || 0,
  members: [] as Member[],
  details: [
    { label: 'Payment reference', value: cut(r.payment_ref, 100) },
    { label: 'Notes', value: cut(r.notes, 500) },
    ...ctx.extra.map((c) => ({ label: human(c), value: cut(r[`x_${c}`], 300) })),
  ].filter((d) => d.value),
  _devotee_dob: r.devotee_dob || '', _raw: r.members, kind,
});
type Out = ReturnType<typeof rowOut>;
async function build(rawRows: any[], kind: Kind, ctx: Ctx): Promise<Out[]> {
  const out = rawRows.map((r) => { const o = rowOut(r, kind, ctx); o.members = SHOWS_PEOPLE[kind] ? readMembers(r.members) : []; return o; });
  if (SHOWS_PEOPLE[kind]) await fillFromProfiles(out.map((o) => ({ devotee_id: o.devotee_id, name: o.name, devotee_dob: o._devotee_dob, members: o.members })));
  return out;
}
const publicRow = (o: Out) => { const { _devotee_dob, _raw, kind, ...rest } = o; void _devotee_dob; void _raw; void kind; return rest; };

// ---------- Filters (every value is a bound parameter; nothing from the request is put into the SQL text) ----------
const STATUSES = ['PAID', 'PENDING', 'FAILED', 'FREE', 'CANCELLED'] as const;
const MEMBERSHIPS = ['ACTIVE', 'EXPIRED'] as const;
function filters(q: Request['query'], kind: Kind) {
  const where: string[] = [];
  const args: any[] = [];
  const category = one(q.category);
  if (category) {
    if (!/^[A-Za-z0-9 _-]{1,50}$/.test(category)) return { error: 'Unknown category.' } as const;
    where.push('r.category = ?'); args.push(category);
  }
  const status = one(q.status).toUpperCase();
  if (status) { if (!(STATUSES as readonly string[]).includes(status)) return { error: 'Unknown status.' } as const; where.push('r.status = ?'); args.push(status); }
  const source = one(q.source);
  if (source) { if (source !== 'online' && source !== 'manual') return { error: 'Unknown entry type.' } as const; where.push('r.source = ?'); args.push(source); }
  const item = one(q.item).slice(0, 255);
  if (item) { where.push('r.item = ?'); args.push(item); }
  // The dates can mean the payment day (all registers), the seva day, the subscription start or the camp start ("event"), or the subscription or camp end ("end").
  const basis = one(q.basis);
  const col = kind !== 'donation' && basis === 'event' ? 'r.event_date' : (kind === 'magazine' || kind === 'camp') && basis === 'end' ? 'r.end_date' : 'r.paid_at';
  const membership = one(q.membership).toUpperCase();
  if (membership && kind === 'magazine') { if (!(MEMBERSHIPS as readonly string[]).includes(membership)) return { error: 'Unknown membership.' } as const; where.push('r.membership = ?'); args.push(membership); }
  const from = one(q.from), to = one(q.to);
  if (from) { if (!realDay(from)) return { error: 'The "from" date is not valid.' } as const; where.push(`${col} >= ?`); args.push(`${from} 00:00:00`); }
  if (to) { if (!realDay(to)) return { error: 'The "to" date is not valid.' } as const; where.push(`${col} < DATE_ADD(?, INTERVAL 1 DAY)`); args.push(`${to} 00:00:00`); }
  const text = one(q.q).slice(0, 80);
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    // devotee name, phone, email, city, devotee id, seva or fund name, receipt, and the names / gothram / nakshatram / rasi written for the sankalpam
    where.push('(r.name LIKE ? OR r.email LIKE ? OR r.phone LIKE ? OR r.city LIKE ? OR r.devotee_id LIKE ? OR r.item LIKE ? OR r.receipt_no LIKE ? OR r.members LIKE ? OR r.address LIKE ? OR r.pincode LIKE ?)');
    args.push(like, like, like, like, like, like, like, like, like, like);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', args } as const;
}
const SORTS: Record<Kind, Record<string, string>> = {
  magazine: {
    date: 'r.paid_at DESC, r.id DESC', oldest: 'r.paid_at ASC, r.id ASC', ending: 'r.end_date ASC, r.id DESC', start: 'r.event_date DESC, r.id DESC',
    amount_desc: 'r.amount DESC, r.id DESC', name: 'r.name ASC, r.paid_at DESC',
  },
  camp: {
    date: 'r.paid_at DESC, r.id DESC', oldest: 'r.paid_at ASC, r.id ASC', event: 'r.event_date ASC, r.id ASC',
    amount_desc: 'r.amount DESC, r.id DESC', name: 'r.name ASC, r.paid_at DESC',
  },
  seva: {
    event: 'r.event_date ASC, r.id ASC', event_desc: 'r.event_date DESC, r.id DESC',
    date: 'r.paid_at DESC, r.id DESC', oldest: 'r.paid_at ASC, r.id ASC', amount_desc: 'r.amount DESC, r.id DESC', name: 'r.name ASC, r.paid_at DESC',
  },
  donation: {
    date: 'r.paid_at DESC, r.id DESC', oldest: 'r.paid_at ASC, r.id ASC', amount_desc: 'r.amount DESC, r.id DESC', name: 'r.name ASC, r.paid_at DESC',
  },
};

// ---------- On-site entries can never break the register: if they cannot be combined, the online entries are still shown ----------
async function withManual<T>(kind: Kind, fn: (ctx: Ctx) => Promise<T>): Promise<{ value: T; warning?: string }> {
  const ctx = await context(kind);
  try { return { value: await fn(ctx) }; } catch (e: any) {
    if (!ctx.manual) throw e;
    console.error('Registers: on-site entries could not be combined, showing online entries only:', e?.sqlMessage || e?.message || e);
    return { value: await fn({ ...ctx, manual: false }), warning: 'The on-site entries could not be combined with the online ones just now, so only the online entries are shown.' };
  }
}

// ---------- List ----------
const DEFAULT_SORT: Record<Kind, string> = { seva: 'event', donation: 'date', magazine: 'date', camp: 'date' };
const TOTALS = {
  magazine: `COALESCE(SUM(r.membership='ACTIVE'),0) active, COALESCE(SUM(r.membership='EXPIRED'),0) expired,
             COALESCE(SUM(r.membership='ACTIVE' AND r.end_date >= CURDATE() AND r.end_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)),0) soon,
             COALESCE(SUM(r.membership='ACTIVE' AND r.category IN ('print','both')),0) post`,
  camp: `COALESCE(SUM(CASE WHEN r.status <> 'CANCELLED' THEN r.adults END),0) adults, COALESCE(SUM(CASE WHEN r.status <> 'CANCELLED' THEN r.children END),0) children`,
};
function listRoute(kind: Kind) {
  return async (req: Request, res: Response) => {
    try {
      const f = filters(req.query, kind);
      if ('error' in f) return res.status(400).json({ message: f.error });
      const order = SORTS[kind][one(req.query.sort)] || SORTS[kind][DEFAULT_SORT[kind]];
      const limit = Math.min(500, Math.max(5, Math.floor(Number(req.query.limit)) || 25));
      const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
      const { value, warning } = await withManual(kind, async (ctx) => {
        const sql = sqlFor(kind, ctx);
        const noRows = Promise.resolve([[]] as any);
        const [[sumRows], [rows], [scan], [tot]]: any = await Promise.all([
          db.query(`SELECT r.status, COUNT(*) n, COALESCE(SUM(r.amount),0) total FROM (${sql}) r ${f.sql} GROUP BY r.status`, f.args),
          db.query(`SELECT r.* FROM (${sql}) r ${f.sql} ORDER BY ${order} LIMIT ? OFFSET ?`, [...f.args, limit, (page - 1) * limit]),
          SHOWS_PEOPLE[kind] ? db.query(`SELECT r.members FROM (${sql}) r ${f.sql} LIMIT 5000`, f.args) : noRows,
          kind === 'magazine' || kind === 'camp' ? db.query(`SELECT ${TOTALS[kind]} FROM (${sql}) r ${f.sql}`, f.args) : noRows,
        ]);
        return { sumRows, rows, scan, tot, items: await build(rows as any[], kind, ctx), manual: ctx.manual };
      });
      const { sumRows, scan, tot, items } = value;
      const by = (st: string) => (sumRows as any[]).find((x) => x.status === st);
      const total = (sumRows as any[]).reduce((acc, x) => acc + Number(x.n), 0);
      let people = 0, complete = 0, withDob = 0;
      for (const r of scan as any[]) for (const m of readMembers(r.members)) { people++; if (m.gothram && m.nakshathiram && m.rasi) complete++; if (m.dob) withDob++; }
      const extra: Record<string, number> = {};
      for (const [k, v] of Object.entries((tot as any[])[0] || {})) extra[k] = Number(v) || 0;
      return res.json({
        total, page, limit, warning, manualReady: value.manual,
        summary: {
          entries: total, paidEntries: Number(by('PAID')?.n || 0), paidAmount: money(by('PAID')?.total),
          pendingEntries: Number(by('PENDING')?.n || 0), failedEntries: Number(by('FAILED')?.n || 0), freeEntries: Number(by('FREE')?.n || 0), cancelledEntries: Number(by('CANCELLED')?.n || 0),
          people, complete, withDob, capped: (scan as any[]).length >= 5000, extra,
        },
        items: items.map(publicRow),
      });
    } catch (e: any) { return fail(res, e, `Could not load the ${kind} register.`); }
  };
}

// ---------- Options (names for the filter, and which dates and date-of-birth columns exist) ----------
function optionsRoute(kind: Kind) {
  return async (_req: Request, res: Response) => {
    try {
      const [fam, dev, ctx] = await Promise.all([columnsOf('devotee_family_members'), columnsOf('devotees'), context(kind)]);
      const [rows]: any = kind === 'seva'
        ? await db.query(`SELECT DISTINCT seva_title AS item, category FROM seva_bookings WHERE seva_title IS NOT NULL AND seva_title <> '' ORDER BY seva_title LIMIT 300`)
        : kind === 'donation'
          ? await db.query(`SELECT DISTINCT fund_title AS item, COALESCE(NULLIF(category,''),'ashram') AS category FROM donation_booking WHERE fund_title IS NOT NULL AND fund_title <> '' ORDER BY fund_title LIMIT 300`)
          : kind === 'magazine'
            ? await db.query(`SELECT DISTINCT plan_name AS item, delivery AS category FROM magazine_subscriptions WHERE plan_name IS NOT NULL AND plan_name <> '' ORDER BY plan_name LIMIT 300`)
            : await db.query(`SELECT DISTINCT COALESCE(cm.title_en,'Camp') AS item, COALESCE(NULLIF(r.status,''),'registered') AS category FROM camp_registrations r LEFT JOIN camps cm ON cm.id = r.camp_id ORDER BY item LIMIT 300`);
      let list = rows as any[];
      if (ctx.manual) {
        try { const [m]: any = await db.query(`SELECT DISTINCT item_title AS item, category FROM register_manual_entries WHERE kind = ? AND item_title <> '' ORDER BY item_title LIMIT 300`, [kind]); list = [...list, ...(m as any[])]; } catch { /* online names only */ }
      }
      // The camps on offer, for the offline camp form: its name, dates and fee
      let catalog: { title: string; start?: string | null; end?: string | null; fee?: number | null; category?: string; amount?: number | null }[] = [];
      // The sevas and donation funds on offer (from the Sevas and Donation Funds pages), with their category and fixed amount, for the offline form's drop-down
      if (kind === 'seva' || kind === 'donation') {
        // A title can be plain text, a JSON text like {"en":"..","ta":".."}, or an object the database driver already parsed
        const locale = (v: any): string => {
          if (v == null) return '';
          if (typeof v === 'object') return String((v as any).en || (v as any).ta || '').replace(/\s+/g, ' ').trim();
          const t = String(v).trim();
          if (t.startsWith('{') && t.endsWith('}')) { try { const o = JSON.parse(t); return String(o.en || o.ta || '').replace(/\s+/g, ' ').trim(); } catch { return t; } }
          return t.replace(/\s+/g, ' ');
        };
        try {
          let table: Table = 'donation';
          if (kind === 'seva') { const [t]: any = await db.query("SHOW TABLES LIKE 'sevas'"); table = (t as any[]).length ? 'sevas' : 'offerings'; }
          const mc = await columnsOf(table);
          const titleCol = pick(mc, ['title_en', 'title', 'name']);
          if (titleCol) {
            const amtCol = pick(mc, ['amount', 'price', 'rate', 'base_amount', 'fixed_amount']);
            const [mr]: any = await db.query(`SELECT \`${titleCol}\` AS t, ${mc.includes('category') ? 'category' : "''"} AS c, ${amtCol ? `\`${amtCol}\`` : 'NULL'} AS a, ${mc.includes('price_type') ? 'price_type' : "'fixed'"} AS pt, ${mc.includes('status') ? 'status' : "'published'"} AS st FROM \`${table}\` LIMIT 500`);
            const once = new Set<string>();
            catalog = (mr as any[]).filter((r) => { const k = locale(r.t).toLowerCase(); if (r.st === 'draft' || !k || once.has(k)) return false; once.add(k); return true; }).map((r) => ({
              title: locale(r.t), category: kind === 'seva' ? (r.c === 'corpus' ? 'corpus' : 'seva') : (String(r.c || '').trim() || 'ashram'),
              amount: r.pt !== 'custom' && Number(r.a) > 0 ? money(r.a) : null,
            }));
          }
        } catch { /* the form falls back to the names used in earlier bookings */ }
        // Names used in bookings that are no longer on the pages still appear, with the category they were booked under
        const seen = new Set(catalog.map((c) => c.title.toLowerCase()));
        for (const r of list) { const t = locale(r.item); if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); catalog.push({ title: t, category: kind === 'seva' ? (r.category === 'corpus' ? 'corpus' : 'seva') : (String(r.category || '').trim() || 'ashram'), amount: null }); } }
        catalog.sort((x, y) => x.title.localeCompare(y.title));
      }
      if (kind === 'camp') {
        try {
          const cc = await columnsOf('camps');
          const fee = pick(cc, ['fee_amount']);
          const [cr]: any = await db.query(
            `SELECT c.title_en AS title, ${ctx.campStart ? `c.\`${ctx.campStart}\`` : 'NULL'} AS sd, ${ctx.campEnd ? `c.\`${ctx.campEnd}\`` : 'NULL'} AS ed, ${fee ? `c.\`${fee}\`` : 'NULL'} AS fee
               FROM camps c WHERE c.title_en IS NOT NULL AND c.title_en <> '' ORDER BY ${ctx.campStart ? `c.\`${ctx.campStart}\` DESC,` : ''} c.title_en LIMIT 200`);
          catalog = (cr as any[]).map((r) => ({ title: String(r.title), start: dateOnly(r.sd), end: dateOnly(r.ed), fee: r.fee == null ? null : money(r.fee) }));
        } catch { /* the form lets the camp name be typed */ }
      }
      return res.json({
        catalog,
        items: [...new Set(list.map((r) => String(r.item)))].sort((x, y) => x.localeCompare(y)),
        categories: [...new Set(list.map((r) => String(r.category || '')).filter(Boolean))],
        dobKept: { family: !!pick(fam, DOB_NAMES), devotee: !!pick(dev, DOB_NAMES) },
        hasEventDate: kind !== 'camp' || !!ctx.campStart,
        hasEndDate: kind === 'magazine' || (kind === 'camp' && !!ctx.campEnd),
        peopleList: kind === 'camp' ? !!ctx.peopleCol : SHOWS_PEOPLE[kind],
      });
    } catch (e: any) { return fail(res, e, 'Could not load the options.'); }
  };
}

// ---------- CSV ----------
// Seva, donation and camp: one line per person named (a booking with no names has one line). Magazine: one line per subscription.
const cell = (v: unknown) => {
  let t = v == null ? '' : String(v);
  if (/^[=@\t\r]|^[+-](?![\d\s])/.test(t)) t = `'${t}`; // a spreadsheet never runs this as a formula
  return `"${t.replace(/"/g, '""')}"`;
};
const PEOPLE_HEAD = ['Person no', 'Title', 'Name', 'Place', 'Relation', 'Gothram', 'Nakshatram', 'Rasi', 'Date of birth'];
function exportRoute(kind: Kind) {
  return async (req: Request, res: Response) => {
    try {
      const f = filters(req.query, kind);
      if ('error' in f) return res.status(400).json({ message: f.error });
      const order = SORTS[kind][one(req.query.sort)] || SORTS[kind][DEFAULT_SORT[kind]];
      const { value: rows } = await withManual(kind, async (ctx) => {
        const [raw]: any = await db.query(`SELECT r.* FROM (${sqlFor(kind, ctx)}) r ${f.sql} ORDER BY ${order} LIMIT 20000`, f.args);
        const built: Out[] = [];
        for (let i = 0; i < (raw as any[]).length; i += 400) built.push(...(await build((raw as any[]).slice(i, i + 400), kind, ctx)));
        return built;
      });
      console.log(`[audit] ${kind} register export: ${rows.length} entries, user ${who(req)}`);
      let lines: string[];
      if (kind === 'magazine') {
        const head = ['Sl no', 'Payment date', 'Receipt no', 'Devotee id', 'Subscriber', 'Phone', 'Email', 'Address', 'City', 'State', 'Pincode', 'Plan', 'Delivery', 'Months', 'Starts', 'Ends', 'Membership', 'Payment mode', 'Amount (INR)', 'Status', 'Entry', 'Other details'];
        lines = [head.map(cell).join(',')];
        rows.forEach((r, i) => lines.push([i + 1, r.paid_at, r.receipt_no, r.devotee_id, r.name, r.phone, r.email, r.address, r.city, r.state, r.pincode, r.item, r.category, r.months, r.event_date, r.end_date, r.membership, r.mode, r.amount, r.status, r.source === 'manual' ? 'On-site' : 'Online', r.details.map((d) => `${d.label}: ${d.value}`).join('; ')].map(cell).join(',')));
      } else {
        const lead = kind === 'seva' ? ['Sl no', 'Payment date', 'Seva date', 'Receipt no', 'Devotee id', 'Devotee', 'Phone', 'Email', 'City', 'State', 'Seva', 'Category', 'Amount (INR)', 'Status', 'Entry', 'Payment mode', 'Address']
          : kind === 'donation' ? ['Sl no', 'Payment date', 'Booking date', 'Receipt no', 'Devotee id', 'Donor', 'Phone', 'Email', 'City', 'State', 'Fund', 'Category', 'Amount (INR)', 'Status', 'Entry', 'Payment mode', 'Address']
            : ['Sl no', 'Registered on', 'Camp starts', 'Camp ends', 'Devotee id', 'Registrant', 'Phone', 'Email', 'City', 'State', 'Camp', 'Registration status', 'Adults', 'Children', 'Amount (INR)', 'Payment', 'Entry', 'Receipt no', 'Payment mode'];
        lines = [[...lead, ...PEOPLE_HEAD, 'Other details'].map(cell).join(',')];
        rows.forEach((r, i) => {
          const base = kind === 'camp'
            ? [i + 1, r.paid_at, r.event_date, r.end_date, r.devotee_id, r.name, r.phone, r.email, r.city, r.state, r.item, r.category, r.adults, r.children, r.amount, r.status, r.source === 'manual' ? 'On-site' : 'Online', r.receipt_no, r.mode]
            : [i + 1, r.paid_at, r.event_date, r.receipt_no, r.devotee_id, r.name, r.phone, r.email, r.city, r.state, r.item, r.category, r.amount, r.status, r.source === 'manual' ? 'On-site' : 'Online', r.mode, [r.address, r.pincode].filter(Boolean).join(' ')];
          const booking = r.details.map((d) => `${d.label}: ${d.value}`).join('; ');
          const people = r.members.length ? r.members : [null];
          people.forEach((m, j) => {
            const extra = [booking, ...(m ? m.extra.map((x) => `${x.label}: ${x.value}`) : [])].filter(Boolean).join('; ');
            lines.push([...base, m ? j + 1 : '', m?.title, m?.name, m?.place, m?.relation, m?.gothram, m?.nakshathiram, m?.rasi, m?.dob, extra].map(cell).join(','));
          });
        });
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${kind}-register.csv"`);
      return res.send('﻿' + lines.join('\r\n'));
    } catch (e: any) { return fail(res, e, 'Could not make the file.'); }
  };
}

// =====================================================================================================
// On-site (manual) entries: a devotee who gives at the ashram is written in here. One table holds both kinds.
// Entries are never deleted, only cancelled, so the receipt numbers always run without a gap in the record.
// =====================================================================================================
const who = (req: Request) => cut(String((req as any).user?.email ?? (req as any).user?.id ?? (req as any).user?.username ?? 'admin'), 100) || 'admin';
const MANUAL_DDL = `
CREATE TABLE IF NOT EXISTS register_manual_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind VARCHAR(10) NOT NULL,
  series VARCHAR(30) NOT NULL,
  serial INT UNSIGNED NOT NULL,
  receipt_no VARCHAR(70) NOT NULL,
  entry_date DATE NOT NULL,
  pooja_date DATE NULL,
  end_date DATE NULL,
  months SMALLINT UNSIGNED NULL,
  adults SMALLINT UNSIGNED NULL,
  children SMALLINT UNSIGNED NULL,
  item_title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL,
  payment_mode VARCHAR(20) NOT NULL DEFAULT 'cash',
  payment_ref VARCHAR(100) NULL,
  devotee_id VARCHAR(64) NULL,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  address VARCHAR(500) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  pincode VARCHAR(12) NULL,
  people LONGTEXT NULL,
  notes VARCHAR(500) NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE',
  cancel_reason VARCHAR(255) NULL,
  created_by VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_manual_receipt (kind, series, serial),
  KEY ix_manual_kind_date (kind, entry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
let manualReady: Promise<void> | null = null;
function ensureManualTable(): Promise<void> {
  if (!manualReady) {
    manualReady = (async () => {
      await db.query(MANUAL_DDL);
      // An older table (seva and donation only) gets the columns the magazine and camp entries use. This never blocks the seva and donation entries.
      try {
        await db.query('ALTER TABLE register_manual_entries ADD COLUMN IF NOT EXISTS end_date DATE NULL, ADD COLUMN IF NOT EXISTS months SMALLINT UNSIGNED NULL, ADD COLUMN IF NOT EXISTS adults SMALLINT UNSIGNED NULL, ADD COLUMN IF NOT EXISTS children SMALLINT UNSIGNED NULL');
      } catch (e: any) { console.error('Registers: could not add the magazine and camp columns to register_manual_entries:', e?.sqlMessage || e?.message || e); }
      colCache.delete('register_manual_entries');
    })().catch((e) => { manualReady = null; throw e; });
  }
  return manualReady;
}

const PAY_MODES = ['cash', 'upi', 'cheque', 'dd', 'card', 'bank', 'other'] as const;
const todayUtc = () => new Date().toISOString().slice(0, 10);
// The Indian financial year of a date, as in 2627 for April 2026 to March 2027
const fyOf = (day: string) => { const y = +day.slice(0, 4), m = +day.slice(5, 7); const a = m >= 4 ? y : y - 1; return `${pad2(a % 100)}${pad2((a + 1) % 100)}`; };
const SERIES_PREFIX: Record<Kind, string> = { seva: 'OS', donation: 'OD', magazine: 'OM', camp: 'OC' };
const defaultSeries = (kind: Kind, day: string) => `${SERIES_PREFIX[kind]}-${fyOf(day)}`;
const SERIES = /^[A-Za-z0-9][A-Za-z0-9-]{0,29}$/;

type Clean = {
  series: string | null; serial: number | null; entry_date: string; pooja_date: string | null; item_title: string; category: string; amount: number;
  payment_mode: string; payment_ref: string; name: string; phone: string; email: string; address: string; city: string; state: string; pincode: string; notes: string;
  devotee_id: string; people: Record<string, string>[]; end_date: string | null; months: number | null; adults: number | null; children: number | null;
};
const addMonths = (day: string, n: number) => { const d = new Date(day + 'T00:00:00Z'); const want = (d.getUTCMonth() + n) % 12; d.setUTCMonth(d.getUTCMonth() + n); if (d.getUTCMonth() !== (want + 12) % 12) d.setUTCDate(0); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
function cleanManual(kind: Kind, b: any): { error: string } | { data: Clean } {
  if (!b || typeof b !== 'object') return { error: 'Nothing was sent.' };
  const t = (v: unknown, n: number) => cut(typeof v === 'number' ? String(v) : v, n);
  const name = t(b.name, 200);
  if (!name) return { error: 'Please enter the devotee name.' };
  const amount = Math.round(Number(b.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 0 || (amount === 0 && kind !== 'camp')) return { error: kind === 'camp' ? 'Please enter the amount received (0 for a free camp).' : 'Please enter the amount received.' };
  if (amount > 10_000_000) return { error: 'The amount is too large. Please check it.' };
  const entry_date = t(b.entry_date, 10);
  if (!realDay(entry_date)) return { error: 'Please enter a valid receipt date.' };
  if (Date.parse(entry_date) > Date.parse(todayUtc()) + 86_400_000) return { error: 'The receipt date cannot be in the future.' };
  const pooja = t(b.pooja_date, 10);
  if (pooja && !realDay(pooja)) return { error: kind === 'seva' ? 'The pooja date is not valid.' : 'The start date is not valid.' };
  const endIn = t(b.end_date, 10);
  if (endIn && !realDay(endIn)) return { error: 'The end date is not valid.' };
  const item_title = t(b.item_title, 255);
  if (!item_title) return { error: kind === 'seva' ? 'Please enter the seva or pooja name.' : kind === 'donation' ? 'Please enter the fund name.' : kind === 'camp' ? 'Please enter the camp name.' : 'Please enter the subscription plan.' };
  const mode = t(b.payment_mode, 20).toLowerCase() || 'cash';
  if (!(PAY_MODES as readonly string[]).includes(mode)) return { error: 'Unknown payment mode.' };
  const phone = t(b.phone, 30);
  if (phone && !/^[+0-9 ()-]{7,30}$/.test(phone)) return { error: 'The mobile number is not valid.' };
  const email = t(b.email, 150);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: 'The email address is not valid.' };
  const pincode = t(b.pincode, 12);
  if (pincode && !/^[0-9A-Za-z -]{3,12}$/.test(pincode)) return { error: 'The pincode is not valid.' };
  let category = t(b.category, 50).toLowerCase();
  if (kind === 'seva') { category = category || 'seva'; if (category !== 'seva' && category !== 'corpus') return { error: 'Unknown category.' }; }
  else if (kind === 'magazine' || kind === 'camp') { category = category || (kind === 'magazine' ? 'print' : 'registered'); if (!/^[a-z0-9 _-]{1,50}$/.test(category)) return { error: 'Unknown category.' }; }
  else { category = category || 'ashram'; if (!/^[a-z0-9 _-]{1,50}$/.test(category)) return { error: 'Unknown category.' }; }
  const series = t(b.series, 30);
  if (series && !SERIES.test(series)) return { error: 'The receipt series can use letters, numbers and dashes only.' };
  let serial: number | null = null;
  if (b.serial !== undefined && b.serial !== null && String(b.serial).trim() !== '') {
    serial = Number(b.serial);
    if (!Number.isInteger(serial) || serial < 1 || serial > 9_999_999) return { error: 'The receipt number must be a whole number from 1 to 9999999.' };
  }
  let end_date: string | null = null, months: number | null = null, adults: number | null = null, children: number | null = null;
  let pooja_out: string | null = pooja || null;
  if (kind === 'magazine') {
    months = Math.round(Number(b.months));
    if (!Number.isInteger(months) || months < 1 || months > 120) return { error: 'Please enter the subscription length in months (1 to 120).' };
    if (!pooja) pooja_out = entry_date;
    end_date = endIn || addMonths(pooja_out as string, months);
    if (end_date < (pooja_out as string)) return { error: 'The end date cannot be before the start date.' };
    if (category !== 'digital' && !address_ok(b)) return { error: 'Please enter the postal address, the magazine is posted there.' };
  } else if (kind === 'camp') {
    adults = b.adults === '' || b.adults == null ? 0 : Math.round(Number(b.adults));
    children = b.children === '' || b.children == null ? 0 : Math.round(Number(b.children));
    if (!Number.isInteger(adults) || !Number.isInteger(children) || adults < 0 || children < 0 || adults > 1000 || children > 1000) return { error: 'Please check the number of adults and children.' };
    if (adults + children < 1) return { error: 'Please enter at least one adult or child.' };
    end_date = endIn || null;
    if (end_date && pooja_out && end_date < pooja_out) return { error: 'The camp end date cannot be before its start date.' };
  }
  const rawPeople = kind === 'seva' || kind === 'donation' ? (Array.isArray(b.people) ? b.people : []) : [];
  if (rawPeople.length > 5) return { error: 'A sankalpam can name up to 5 people.' };
  const people: Record<string, string>[] = [];
  for (const p of rawPeople) {
    if (!p || typeof p !== 'object') continue;
    const row = { name: t(p.name, 120), relation: t(p.relation, 60), place: t(p.place, 80), gothram: t(p.gothram, 80), nakshathiram: t(p.nakshathiram ?? p.nakshatram, 80), rasi: t(p.rasi, 80), dob: t(p.dob, 10) };
    if (row.dob) {
      if (!realDay(row.dob) || row.dob > todayUtc() || row.dob < '1900-01-01') return { error: `The date of birth for ${row.name || 'a person'} is not valid.` };
    }
    if (Object.values(row).some(Boolean)) people.push(row);
  }
  return { data: { series: series || null, serial, entry_date, pooja_date: pooja_out, item_title, category, amount, payment_mode: mode, payment_ref: t(b.payment_ref, 100), name, phone, email, address: t(b.address, 500), city: t(b.city, 100), state: t(b.state, 100), pincode, notes: t(b.notes, 500), devotee_id: t(b.devotee_id, 64), people, end_date, months, adults, children } };
}

const address_ok = (b: any) => !!(String(b?.address ?? '').trim() || String(b?.city ?? '').trim());
const manualOut = (r: any) => ({
  id: Number(r.id), kind: r.kind as Kind,
  end_date: dateOnly(r.end_date), months: r.months == null ? null : Number(r.months), adults: r.adults == null ? null : Number(r.adults), children: r.children == null ? null : Number(r.children), series: r.series as string, serial: Number(r.serial), receipt_no: r.receipt_no as string,
  entry_date: dateOnly(r.entry_date), pooja_date: dateOnly(r.pooja_date), item_title: r.item_title as string, category: r.category as string,
  amount: money(r.amount), payment_mode: r.payment_mode as string, payment_ref: (r.payment_ref || '') as string, devotee_id: (r.devotee_id || '') as string,
  name: r.name as string, phone: (r.phone || '') as string, email: (r.email || '') as string, address: (r.address || '') as string,
  city: (r.city || '') as string, state: (r.state || '') as string, pincode: (r.pincode || '') as string, notes: (r.notes || '') as string,
  status: r.status as string, cancel_reason: (r.cancel_reason || '') as string, people: readMembers(r.people), created_by: r.created_by as string | null, created_at: iso(r.created_at),
});
const isDup = (e: any) => e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062;
const MANUAL_HELP = 'Could not prepare the on-site entries table. Ask your developer to run register-manual-entries.sql on the database.';
const nextSerial = async (kind: string, series: string) => {
  const [[row]]: any = await db.query('SELECT COALESCE(MAX(serial),0) m FROM register_manual_entries WHERE kind = ? AND series = ?', [kind, series]);
  return Number(row?.m || 0) + 1;
};
const idOf = (req: Request) => { const v = String(req.params.id || ''); return /^\d{1,18}$/.test(v) ? v : null; };

function manualRoutes(kind: Kind) {
  const base = `/admin/${kind}/manual`;

  // The receipt number the next entry will get (the series for the date's financial year unless one is given)
  router.get(`${base}/next`, async (req, res) => {
    try {
      await ensureManualTable().catch((e) => { console.error('Registers:', MANUAL_HELP, e?.sqlMessage || e?.message || e); throw new Error(MANUAL_HELP); });
      const day = one(req.query.date);
      if (day && !realDay(day)) return res.status(400).json({ message: 'The date is not valid.' });
      const wanted = one(req.query.series).slice(0, 30);
      if (wanted && !SERIES.test(wanted)) return res.status(400).json({ message: 'The receipt series can use letters, numbers and dashes only.' });
      const series = wanted || defaultSeries(kind, day || todayUtc());
      const serial = await nextSerial(kind, series);
      return res.json({ series, serial, receipt_no: `${series}-${String(serial).padStart(4, '0')}` });
    } catch (e: any) { return fail(res, e, e?.message === MANUAL_HELP ? MANUAL_HELP : 'Could not work out the next receipt number.'); }
  });

  router.post(base, async (req, res) => {
    try {
      const c = cleanManual(kind, req.body);
      if ('error' in c) return res.status(400).json({ message: c.error });
      const d = c.data;
      await ensureManualTable().catch((e) => { console.error('Registers:', MANUAL_HELP, e?.sqlMessage || e?.message || e); throw new Error(MANUAL_HELP); });
      const series = d.series || defaultSeries(kind, d.entry_date);
      const auto = d.serial == null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const serial = auto ? await nextSerial(kind, series) : (d.serial as number);
        const receipt = `${series}-${String(serial).padStart(4, '0')}`;
        try {
          const [r]: any = await db.query(
            `INSERT INTO register_manual_entries (kind, series, serial, receipt_no, entry_date, pooja_date, end_date, months, adults, children, item_title, category, amount, payment_mode, payment_ref, devotee_id, name, phone, email, address, city, state, pincode, people, notes, created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [kind, series, serial, receipt, d.entry_date, d.pooja_date, d.end_date, d.months, d.adults, d.children, d.item_title, d.category, d.amount, d.payment_mode, d.payment_ref || null, d.devotee_id || null, d.name, d.phone || null, d.email || null, d.address || null, d.city || null, d.state || null, d.pincode || null, d.people.length ? JSON.stringify(d.people) : null, d.notes || null, who(req)]);
          console.log(`[audit] on-site ${kind} entry created: id ${r.insertId}, receipt ${receipt}, amount ${d.amount}, user ${who(req)}`);
          return res.status(201).json({ id: Number(r.insertId), receipt_no: receipt, series, serial });
        } catch (e: any) {
          if (!isDup(e)) throw e;
          if (!auto) return res.status(409).json({ message: `Receipt number ${receipt} is already used. Please use the next number.` });
        }
      }
      return res.status(409).json({ message: 'Another entry took that receipt number at the same moment. Please save again.' });
    } catch (e: any) { return fail(res, e, e?.message === MANUAL_HELP ? MANUAL_HELP : 'Could not save the entry.'); }
  });

  router.get(`${base}/:id`, async (req, res) => {
    try {
      const id = idOf(req);
      if (!id) return res.status(400).json({ message: 'Unknown entry.' });
      const [rows]: any = await db.query('SELECT * FROM register_manual_entries WHERE id = ? AND kind = ? LIMIT 1', [id, kind]);
      if (!rows.length) return res.status(404).json({ message: 'Entry not found.' });
      return res.json(manualOut(rows[0]));
    } catch (e: any) { return fail(res, e, 'Could not load the entry.'); }
  });

  router.put(`${base}/:id`, async (req, res) => {
    try {
      const id = idOf(req);
      if (!id) return res.status(400).json({ message: 'Unknown entry.' });
      const c = cleanManual(kind, req.body);
      if ('error' in c) return res.status(400).json({ message: c.error });
      const d = c.data;
      const [rows]: any = await db.query('SELECT * FROM register_manual_entries WHERE id = ? AND kind = ? LIMIT 1', [id, kind]);
      if (!rows.length) return res.status(404).json({ message: 'Entry not found.' });
      if (rows[0].status === 'CANCELLED') return res.status(400).json({ message: 'A cancelled entry cannot be changed.' });
      const series = d.series || rows[0].series;
      const serial = d.serial == null ? Number(rows[0].serial) : d.serial;
      const receipt = `${series}-${String(serial).padStart(4, '0')}`;
      try {
        await db.query(
          `UPDATE register_manual_entries SET series=?, serial=?, receipt_no=?, entry_date=?, pooja_date=?, end_date=?, months=?, adults=?, children=?, item_title=?, category=?, amount=?, payment_mode=?, payment_ref=?, devotee_id=COALESCE(NULLIF(?, ''), devotee_id), name=?, phone=?, email=?, address=?, city=?, state=?, pincode=?, people=?, notes=? WHERE id=? AND kind=?`,
          [series, serial, receipt, d.entry_date, d.pooja_date, d.end_date, d.months, d.adults, d.children, d.item_title, d.category, d.amount, d.payment_mode, d.payment_ref || null, d.devotee_id, d.name, d.phone || null, d.email || null, d.address || null, d.city || null, d.state || null, d.pincode || null, d.people.length ? JSON.stringify(d.people) : null, d.notes || null, id, kind]);
      } catch (e: any) {
        if (isDup(e)) return res.status(409).json({ message: `Receipt number ${receipt} is already used by another entry.` });
        throw e;
      }
      console.log(`[audit] on-site ${kind} entry changed: id ${id}, receipt ${receipt}, amount ${d.amount} (was ${rows[0].amount}), user ${who(req)}`);
      return res.json({ id: Number(id), receipt_no: receipt });
    } catch (e: any) { return fail(res, e, 'Could not save the changes.'); }
  });

  router.post(`${base}/:id/cancel`, async (req, res) => {
    try {
      const id = idOf(req);
      if (!id) return res.status(400).json({ message: 'Unknown entry.' });
      const reason = cut(req.body?.reason, 255);
      const [r]: any = await db.query(`UPDATE register_manual_entries SET status = 'CANCELLED', cancel_reason = ? WHERE id = ? AND kind = ? AND status <> 'CANCELLED'`, [reason || null, id, kind]);
      if (!r.affectedRows) {
        const [rows]: any = await db.query('SELECT status FROM register_manual_entries WHERE id = ? AND kind = ? LIMIT 1', [id, kind]);
        if (!rows.length) return res.status(404).json({ message: 'Entry not found.' });
      }
      console.log(`[audit] on-site ${kind} entry cancelled: id ${id}, reason "${reason}", user ${who(req)}`);
      return res.json({ id: Number(id), status: 'CANCELLED' });
    } catch (e: any) { return fail(res, e, 'Could not cancel the entry.'); }
  });
}
manualRoutes('seva');
manualRoutes('donation');
manualRoutes('magazine');
manualRoutes('camp');

// ---------- Find a devotee by mobile number, so the on-site form can fill in what is already saved ----------
// Looks in the registered devotees (with the people in their family list) and in earlier on-site entries.
type Candidate = {
  source: 'devotee' | 'onsite'; devotee_id: string; code: string; label: string; name: string; email: string; phone: string;
  address: string; city: string; state: string; pincode: string; people: Partial<Member>[];
};
const ADDRESS_COLS = ['address', 'address_line1', 'address_line_1', 'addressline1', 'street', 'street_address'];
const PINCODE_COLS = ['pincode', 'pin_code', 'zip', 'zipcode', 'zip_code', 'postal_code', 'postalcode'];
// The phone column with spaces, dashes, brackets and + removed, cut to the last `n` digits
const cleanPhone = (col: string, n: number) => `RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${col},' ',''),'-',''),'+',''),'(',''),')',''),${n})`;
const personOut = (m: Member) => ({ name: [m.title, m.name].filter(Boolean).join(' ').trim(), relation: m.relation, place: m.place || '', gothram: m.gothram, nakshathiram: m.nakshathiram, rasi: m.rasi, dob: ISO_DAY_ONLY.test(m.dob) ? m.dob : '' });
const ISO_DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

router.get('/admin/devotee-lookup', async (req, res) => {
  try {
    // One search box: a mobile number (7 to 15 digits) or a devotee id such as SDSS00001 (or just its number, like 1)
    const raw = (one(req.query.q) || one(req.query.phone)).trim().slice(0, 40);
    if (!raw) return res.status(400).json({ message: 'Please enter a mobile number or a devotee id.' });
    const phoneLike = /^[+0-9 ()-]+$/.test(raw);
    const digits = raw.replace(/\D/g, '');
    const byPhone = phoneLike && digits.length >= 7;
    if (byPhone && digits.length > 15) return res.status(400).json({ message: 'The mobile number is too long.' });
    if (!byPhone && !/^[A-Za-z0-9_-]{1,40}$/.test(raw)) return res.status(400).json({ message: 'Please enter the full mobile number or a devotee id such as SDSS00001.' });
    const n = Math.min(10, digits.length);
    const tail = digits.slice(-n);
    const out: Candidate[] = [];

    // 1. Registered devotees, and the people in their family list
    try {
      const dcols = await columnsOf('devotees');
      const addr = pick(dcols, ADDRESS_COLS), pin = pick(dcols, PINCODE_COLS), dob = pick(dcols, DOB_NAMES);
      const own = ['gothram', 'gotram', 'gotra', 'nakshathiram', 'nakshatram', 'nakshatra', 'rasi', 'raasi', 'rashi'].filter((c) => dcols.includes(c));
      const extra = [addr, pin, dob, ...own].filter((c): c is string => !!c).map((c) => `, \`${c}\``).join('');
      const hasCode = dcols.includes('devotee_code');
      // By mobile number, or by devotee id: the code (SDSS00001), the internal id, or the bare number matched against the end of a code
      const where = byPhone ? `${cleanPhone('phone', n)} = ?` : hasCode ? `(devotee_code = ? OR id = ? OR (? REGEXP '^[0-9]{1,8}$' AND devotee_code LIKE CONCAT('%', LPAD(?, 5, '0'))))` : 'id = ?';
      const args = byPhone ? [tail] : hasCode ? [raw, raw, raw, raw] : [raw];
      const [rows]: any = await db.query(
        `SELECT id, ${hasCode ? 'devotee_code AS code,' : "'' AS code,"} TRIM(CONCAT(COALESCE(first_name,''),' ',COALESCE(last_name,''))) AS name, email, phone, city, state${extra}
           FROM devotees WHERE ${where} ORDER BY id DESC LIMIT 5`, args);
      const ids = (rows as any[]).map((r) => String(r.id));
      const fam = new Map<string, any[]>();
      if (ids.length) {
        try {
          const fcols = await columnsOf('devotee_family_members');
          const fdob = pick(fcols, DOB_NAMES);
          const want = ['name', 'relation', 'place', 'gothram', 'nakshathiram', 'rasi'].filter((c) => fcols.includes(c));
          if (fcols.includes('devotee_id') && want.includes('name')) {
            const cols = [...want, ...(fdob ? [fdob] : [])].map((c) => `\`${c}\``).join(', ');
            const [list]: any = await db.query(`SELECT devotee_id, ${cols} FROM devotee_family_members WHERE devotee_id IN (${ids.map(() => '?').join(',')}) LIMIT 200`, ids);
            for (const f of list as any[]) {
              const m = memberFrom({ name: f.name, relation: f.relation, place: f.place, gothram: f.gothram, nakshathiram: f.nakshathiram, rasi: f.rasi, dob: fdob ? readDob(f[fdob]) : '' });
              const k = String(f.devotee_id);
              fam.set(k, [...(fam.get(k) || []), personOut(m)]);
            }
          }
        } catch (e: any) { console.error('Registers: family lookup skipped', e?.sqlMessage || e?.message || e); }
      }
      for (const r of rows as any[]) {
        const self = personOut(memberFrom({
          name: r.name, relation: 'Self', dob: dob ? readDob(r[dob]) : '',
          gothram: r.gothram || r.gotram || r.gotra || '', nakshathiram: r.nakshathiram || r.nakshatram || r.nakshatra || '', rasi: r.rasi || r.raasi || r.rashi || '',
        }));
        const others = (fam.get(String(r.id)) || []).filter((m) => norm(m.name) !== norm(self.name));
        out.push({
          source: 'devotee', devotee_id: String(r.id), code: cut(r.code, 30), label: `${r.name || 'Devotee'} (${r.code ? r.code : 'registered devotee'})`, name: cut(r.name, 200), email: cut(r.email, 150), phone: cut(r.phone, 30),
          address: addr ? cut(r[addr], 500) : '', city: cut(r.city, 100), state: cut(r.state, 100), pincode: pin ? cut(r[pin], 12) : '', people: [self, ...others].slice(0, 30),
        });
      }
    } catch (e: any) { console.error('Registers: devotee lookup skipped', e?.sqlMessage || e?.message || e); }

    // 2. Earlier on-site entries for the same number (the latest one)
    if (byPhone && out.length < 5) {
      try {
        const [rows]: any = await db.query(
          `SELECT name, email, phone, address, city, state, pincode, people FROM register_manual_entries
            WHERE phone IS NOT NULL AND ${cleanPhone('phone', n)} = ? AND status <> 'CANCELLED' ORDER BY id DESC LIMIT 1`, [tail]);
        for (const r of rows as any[]) {
          // A person already known as a registered devotee is not offered twice
          if (out.some((c) => norm(c.name) === norm(r.name))) continue;
          out.push({
            source: 'onsite', devotee_id: '', code: '', label: `${r.name} (earlier on-site entry)`, name: cut(r.name, 200), email: cut(r.email, 150), phone: cut(r.phone, 30),
            address: cut(r.address, 500), city: cut(r.city, 100), state: cut(r.state, 100), pincode: cut(r.pincode, 12), people: readMembers(r.people).map(personOut),
          });
        }
      } catch { /* the on-site table may not exist yet: nothing to find there */ }
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ found: out.length > 0, candidates: out });
  } catch (e: any) { return fail(res, e, 'Could not look up the mobile number.'); }
});

// ---------- Labels and renewal notices: the people to print for, with their postal address ----------
// Corpus labels come from the seva and donation registers (category "corpus", online and on-site). Subscription labels and renewal
// notices come from the magazine register. The address is the one written on the booking or subscription, otherwise the devotee's own.
const LABEL_MAX = 1500;
type LabelRow = {
  key: string; source: 'online' | 'manual'; devotee_id: string; name: string; phone: string; email: string; address: string[];
  item: string; category: string; amount: number; receipt_no: string; date: string; valid_from: string; valid_to: string; months: number | null; membership: string;
};
type Addr = { address: string; city: string; state: string; pincode: string };
async function addressesOf(ids: string[]): Promise<Map<string, Addr>> {
  const map = new Map<string, Addr>();
  if (!ids.length) return map;
  try {
    const dcols = await columnsOf('devotees');
    const addr = pick(dcols, ADDRESS_COLS), pin = pick(dcols, PINCODE_COLS);
    const cols = ['id', 'city', 'state', addr, pin].filter((c): c is string => !!c).map((c) => `\`${c}\``).join(', ');
    for (let i = 0; i < ids.length; i += 400) {
      const part = ids.slice(i, i + 400);
      const [rows]: any = await db.query(`SELECT ${cols} FROM devotees WHERE id IN (${part.map(() => '?').join(',')})`, part);
      for (const r of rows as any[]) map.set(String(r.id), { address: addr ? cut(r[addr], 300) : '', city: cut(r.city, 100), state: cut(r.state, 100), pincode: pin ? cut(r[pin], 12) : '' });
    }
  } catch (e: any) { console.error('Registers: devotee addresses skipped', e?.sqlMessage || e?.message || e); }
  return map;
}
const addressLines = (a: Addr) => [a.address, [a.city, a.state].filter(Boolean).join(', '), a.pincode ? `PIN ${a.pincode}` : ''].map((x) => String(x || '').trim()).filter(Boolean);

function labelsRoute(type: 'corpus' | 'subscription') {
  return async (req: Request, res: Response) => {
    try {
      const kinds: Kind[] = type === 'corpus' ? ['seva', 'donation'] : ['magazine'];
      const q: Request['query'] = type === 'corpus' ? { ...req.query, category: 'corpus', item: '' } : { ...req.query };
      let warning: string | undefined;
      const found: { kind: Kind; rows: any[] }[] = [];
      for (const kind of kinds) {
        const f = filters(q, kind);
        if ('error' in f) return res.status(400).json({ message: f.error });
        const order = kind === 'magazine' ? 'r.end_date ASC, r.id ASC' : 'r.paid_at ASC, r.id ASC';
        const { value, warning: w } = await withManual(kind, async (ctx) => {
          const [rows]: any = await db.query(`SELECT r.* FROM (${sqlFor(kind, ctx)}) r ${f.sql} ORDER BY ${order} LIMIT ?`, [...f.args, LABEL_MAX + 1]);
          return rows as any[];
        });
        if (w) warning = w;
        found.push({ kind, rows: value });
      }
      const all = found.flatMap((x) => x.rows.map((r) => ({ kind: x.kind, r })));
      const capped = all.length > LABEL_MAX;
      const used = all.slice(0, LABEL_MAX);
      const devs = await addressesOf([...new Set(used.map((x) => String(x.r.devotee_id || '')).filter(Boolean))]);
      const items: LabelRow[] = used.map(({ kind, r }) => {
        const own: Addr = { address: cut(r.address, 300), city: cut(r.city, 100), state: cut(r.state, 100), pincode: cut(r.pincode, 12) };
        const dev = devs.get(String(r.devotee_id || ''));
        // A booking with no address of its own uses the address saved on the devotee
        const a: Addr = !own.address && !own.pincode && dev ? { address: dev.address, city: own.city || dev.city, state: own.state || dev.state, pincode: dev.pincode } : own;
        return {
          key: `${kind}-${r.source === 'manual' ? 'm' : 'o'}-${r.id}`, source: r.source === 'manual' ? 'manual' : 'online', devotee_id: String(r.devotee_id || ''),
          name: cut(r.name, 200), phone: cut(r.phone, 30), email: cut(r.email, 150), address: addressLines(a),
          item: cut(r.item, 150), category: cut(r.category, 50), amount: money(r.amount), receipt_no: cut(r.receipt_no, 50),
          date: dateOnly(r.entry_date) || dateOnly(r.paid_at) || '', valid_from: kind === 'magazine' ? dateOnly(r.event_date) || '' : '', valid_to: kind === 'magazine' ? dateOnly(r.end_date) || '' : '',
          months: r.months == null ? null : Number(r.months) || null, membership: cut(r.membership, 20),
        };
      });
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ total: items.length, capped, limit: LABEL_MAX, warning, items });
    } catch (e: any) { return fail(res, e, 'Could not load the people to print.'); }
  };
}
router.get('/admin/labels/corpus', labelsRoute('corpus'));
router.get('/admin/labels/subscription', labelsRoute('subscription'));

// Devotee address labels: every devotee with a name, postal address and contact number (no booking needed).
// Filters: joined from/to, a search word, and whether an address is on record.
const DEVOTEE_LABEL_MAX = 5000;
router.get('/admin/labels/devotees', async (req: Request, res: Response) => {
  try {
    const one = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const from = one(req.query.from), to = one(req.query.to), term = one(req.query.q).slice(0, 80), addrMode = one(req.query.address);
    const day = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
    if ((from && !day(from)) || (to && !day(to))) return res.status(400).json({ message: 'Choose valid dates.' });
    if (from && to && from > to) return res.status(400).json({ message: 'The start date is after the end date.' });

    const dcols = await columnsOf('devotees');
    const has = (c: string) => dcols.some((x) => x.toLowerCase() === c);
    const comm = pick(dcols, ['comm_address']), perm = pick(dcols, ['perm_address']), fallback = pick(dcols, ADDRESS_COLS), pin = pick(dcols, PINCODE_COLS);
    const addrCols = [comm, perm, fallback].filter((c, i, l): c is string => !!c && l.indexOf(c) === i);
    const nameSql = has('first_name') || has('last_name')
      ? `TRIM(CONCAT(${has('first_name') ? "COALESCE(d.first_name,'')" : "''"}, ' ', ${has('last_name') ? "COALESCE(d.last_name,'')" : "''"}))`
      : `''`;
    const sel = ['d.id AS id', `${nameSql} AS name`, has('phone') ? 'd.phone AS phone' : "'' AS phone", has('email') ? 'd.email AS email' : "'' AS email",
      has('city') ? 'd.city AS city' : "'' AS city", has('state') ? 'd.state AS state' : "'' AS state", has('created_at') ? 'd.created_at AS joined' : 'NULL AS joined',
      pin ? `d.\`${pin}\` AS pin` : "'' AS pin", ...addrCols.map((c, i) => `d.\`${c}\` AS a${i}`)];
    const where: string[] = []; const args: any[] = [];
    if (from && has('created_at')) { where.push('d.created_at >= ?'); args.push(`${from} 00:00:00`); }
    if (to && has('created_at')) { where.push('d.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); args.push(`${to} 00:00:00`); }
    if (term) {
      const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
      const fields = [nameSql, has('phone') ? 'd.phone' : '', has('email') ? 'd.email' : '', has('city') ? 'd.city' : '', has('state') ? 'd.state' : '', 'd.id'].filter(Boolean);
      where.push(`(${fields.map((f) => `${f} LIKE ?`).join(' OR ')})`); fields.forEach(() => args.push(like));
    }
    const anyAddr = addrCols.length ? `(${addrCols.map((c) => `COALESCE(TRIM(d.\`${c}\`),'') <> ''`).join(' OR ')})` : '0=1';
    if (addrMode === 'with') where.push(anyAddr);
    if (addrMode === 'without') where.push(`NOT ${anyAddr}`);
    const [rows]: any = await db.query(
      `SELECT ${sel.join(', ')} FROM devotees d ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name ASC, d.id ASC LIMIT ?`, [...args, DEVOTEE_LABEL_MAX + 1]);
    const capped = rows.length > DEVOTEE_LABEL_MAX;
    const items: LabelRow[] = (rows as any[]).slice(0, DEVOTEE_LABEL_MAX).map((r) => {
      // The communication address first, then the permanent one. The city, state and PIN are added only when the address does not already say them.
      let text = '';
      for (let i = 0; i < addrCols.length && !text; i++) text = cut(r[`a${i}`], 400);
      const lines = text ? text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
      if (lines.length) {
        const low = text.toLowerCase();
        const extra = [[cut(r.city, 100), cut(r.state, 100)].filter((x) => x && !low.includes(x.toLowerCase())).join(', '), cut(r.pin, 12) && !low.includes(cut(r.pin, 12).toLowerCase()) ? `PIN ${cut(r.pin, 12)}` : ''].filter(Boolean);
        lines.push(...extra);
      }
      return {
        key: `dev-${r.id}`, source: 'online' as const, devotee_id: String(r.id || ''), name: cut(r.name, 200), phone: cut(r.phone, 30), email: cut(r.email, 150), address: lines.slice(0, 8),
        item: '', category: '', amount: 0, receipt_no: '', date: dateOnly(r.joined) || '', valid_from: '', valid_to: '', months: null, membership: '',
      };
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ total: items.length, capped, limit: DEVOTEE_LABEL_MAX, items });
  } catch (e: any) { return fail(res, e, 'Could not load the devotees to print.'); }
});

router.get('/admin/seva/options', optionsRoute('seva'));
router.get('/admin/seva/list', listRoute('seva'));
router.get('/admin/seva/export', exportRoute('seva'));
router.get('/admin/donation/options', optionsRoute('donation'));
router.get('/admin/donation/list', listRoute('donation'));
router.get('/admin/donation/export', exportRoute('donation'));
router.get('/admin/magazine/options', optionsRoute('magazine'));
router.get('/admin/magazine/list', listRoute('magazine'));
router.get('/admin/magazine/export', exportRoute('magazine'));
router.get('/admin/camp/options', optionsRoute('camp'));
router.get('/admin/camp/list', listRoute('camp'));
router.get('/admin/camp/export', exportRoute('camp'));

// Used by the dashboards (dashboards.ts) to read the same combined online and on-site rows as the registers
export { withManual, sqlFor };
export type { Kind };

export default router;