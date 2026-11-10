import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../dbLimit';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

// Devotee details and devotee reports (read only), for the CMS.
// Passwords, OTP codes, Google ids and Aadhaar numbers are never read or sent. PAN numbers are hidden in the list: they are sent only
// when an admin presses "Show PAN" (for 80G receipts) or downloads the 80G file, and each of those is written to the server log.
// Money counts only paid payments: donations, sevas, magazine subscriptions and camp fees.
const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const dbg = (e: any) => (IS_PROD ? undefined : e?.sqlMessage || e?.message || String(e));
const fail = (res: Response, e: any, message: string) => {
  console.error(`Devotees: ${message}`, e?.sqlMessage || e?.message || e);
  return res.status(500).json({ message, detail: dbg(e) });
};
const adminGuard = (req: Request, res: Response, next: NextFunction) => authenticate(req as AuthenticatedRequest, res, next);
router.use(adminGuard);

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDay = (d: string) => DAY.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
const one = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const money = (v: any) => Math.round(Number(v || 0) * 100) / 100;
const dayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
const dayStr = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
const iso = (d: any) => (d instanceof Date ? d.toISOString() : d ? String(d) : null);

// The tables were not all made with the same collation, so every id and word that is joined or united is converted first.
const C = (x: string) => `CONVERT(${x} USING utf8mb4) COLLATE utf8mb4_unicode_ci`;

// One row per PAID payment, from the four payment tables
const PAY = `
  SELECT ${C('b.devotee_id')} AS devotee_id, 'donation' COLLATE utf8mb4_unicode_ci AS source, ${C('b.fund_title')} AS item, b.amount AS amount, b.created_at AS paid_at
    FROM donation_booking b WHERE b.status = 'SUCCESS'
  UNION ALL
  SELECT ${C('b.devotee_id')}, 'seva', ${C('b.seva_title')}, b.amount, b.created_at
    FROM seva_bookings b WHERE b.status = 'SUCCESS'
  UNION ALL
  SELECT ${C('m.devotee_id')}, 'magazine', ${C('m.plan_name')}, m.amount, m.created_at
    FROM magazine_subscriptions m WHERE m.status IN ('ACTIVE','EXPIRED')
  UNION ALL
  SELECT ${C('r.devotee_id')}, 'camp', ${C("COALESCE(c.title_en, 'Camp')")}, r.amount, r.created_at
    FROM camp_registrations r LEFT JOIN camps c ON c.id = r.camp_id
   WHERE r.amount > 0 AND r.payment_status = 'PAID'`;

const SOURCES = ['donation', 'seva', 'camp', 'magazine'] as const;

// One row per devotee, with the money they paid and the number of family members saved
const DEV = `
  SELECT d.id AS id, TRIM(CONCAT(COALESCE(d.first_name,''),' ',COALESCE(d.last_name,''))) AS name,
         d.email AS email, d.phone AS phone, d.residency AS residency, d.comm_address AS comm_address, d.perm_address AS perm_address,
         d.city AS city, d.state AS state, d.created_at AS joined_at, d.avatar_url AS avatar_url, d.is_verified AS verified,
         CASE WHEN d.google_id IS NOT NULL AND d.google_id <> '' THEN 'google' ELSE 'password' END AS login,
         CASE WHEN COALESCE(d.pan_number,'') <> '' OR i.devotee_id IS NOT NULL THEN 1 ELSE 0 END AS has_pan,
         COALESCE(a.n,0) AS pay_n, COALESCE(a.total,0) AS pay_total, a.last_paid AS last_paid,
         COALESCE(a.t_donation,0) AS t_donation, COALESCE(a.t_seva,0) AS t_seva, COALESCE(a.t_camp,0) AS t_camp, COALESCE(a.t_magazine,0) AS t_magazine,
         COALESCE(fm.n,0) AS family_n,
         COALESCE(a.last_paid, d.created_at) AS last_active
    FROM devotees d
    LEFT JOIN (SELECT p.devotee_id, COUNT(*) n, SUM(p.amount) total, MAX(p.paid_at) last_paid,
                      SUM(CASE WHEN p.source = 'donation' THEN p.amount ELSE 0 END) t_donation,
                      SUM(CASE WHEN p.source = 'seva' THEN p.amount ELSE 0 END) t_seva,
                      SUM(CASE WHEN p.source = 'camp' THEN p.amount ELSE 0 END) t_camp,
                      SUM(CASE WHEN p.source = 'magazine' THEN p.amount ELSE 0 END) t_magazine
                 FROM (${PAY}) p GROUP BY p.devotee_id) a ON a.devotee_id = ${C('d.id')}
    LEFT JOIN (SELECT ${C('f.devotee_id')} AS devotee_id, COUNT(*) n FROM devotee_family_members f GROUP BY f.devotee_id) fm ON fm.devotee_id = ${C('d.id')}
    LEFT JOIN (SELECT DISTINCT ${C('x.devotee_id')} AS devotee_id FROM donor_ids x) i ON i.devotee_id = ${C('d.id')}`;

const SORT: Record<string, string> = {
  newest: 'v.joined_at DESC, v.id DESC', oldest: 'v.joined_at ASC, v.id ASC', name: 'v.name ASC, v.joined_at DESC',
  paid: 'v.pay_total DESC, v.joined_at DESC', active: 'v.last_active DESC, v.id DESC', family: 'v.family_n DESC, v.joined_at DESC',
};

function filters(q: Request['query'], withText = true) {
  const where: string[] = [];
  const args: any[] = [];
  const residency = one(q.residency);
  if (residency) { if (!['indian', 'nri'].includes(residency)) return { error: 'Unknown residency.' } as const; where.push('v.residency = ?'); args.push(residency); }
  const state = one(q.state).slice(0, 100);
  if (state) { where.push('v.state = ?'); args.push(state); }
  const verified = one(q.verified);
  if (verified) { if (!['yes', 'no'].includes(verified)) return { error: 'Unknown verified filter.' } as const; where.push(verified === 'yes' ? 'v.verified = 1' : '(v.verified IS NULL OR v.verified = 0)'); }
  const paid = one(q.paid);
  if (paid) { if (!['yes', 'no'].includes(paid)) return { error: 'Unknown paid filter.' } as const; where.push(paid === 'yes' ? 'v.pay_n > 0' : 'v.pay_n = 0'); }
  const login = one(q.login);
  if (login) { if (!['google', 'password'].includes(login)) return { error: 'Unknown sign-in filter.' } as const; where.push('v.login = ?'); args.push(login); }
  const from = one(q.from), to = one(q.to);
  if (from) { if (!realDay(from)) return { error: 'The "from" date is not valid.' } as const; where.push('v.joined_at >= ?'); args.push(`${from} 00:00:00`); }
  if (to) { if (!realDay(to)) return { error: 'The "to" date is not valid.' } as const; where.push('v.joined_at < DATE_ADD(?, INTERVAL 1 DAY)'); args.push(`${to} 00:00:00`); }
  const text = withText ? one(q.q).slice(0, 80) : '';
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push('(v.name LIKE ? OR v.email LIKE ? OR v.phone LIKE ? OR v.id LIKE ? OR v.city LIKE ? OR v.state LIKE ?)');
    args.push(like, like, like, like, like, like);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', args } as const;
}

const row = (r: any) => ({
  id: r.id, name: r.name || '', email: r.email, phone: r.phone, residency: r.residency, city: r.city, state: r.state,
  comm_address: r.comm_address, perm_address: r.perm_address, avatar_url: r.avatar_url, verified: Number(r.verified) === 1,
  login: r.login, has_pan: Number(r.has_pan) === 1, joined_at: iso(r.joined_at), last_active: iso(r.last_active), last_paid: iso(r.last_paid),
  pay_count: Number(r.pay_n), pay_total: money(r.pay_total), family_count: Number(r.family_n),
  totals: { donation: money(r.t_donation), seva: money(r.t_seva), camp: money(r.t_camp), magazine: money(r.t_magazine) },
});

// ---------- The list ----------
router.get('/admin/devotees/list', async (req, res) => {
  try {
    const f = filters(req.query);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const order = SORT[one(req.query.sort)] || SORT.newest;
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 25));
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const [[t]]: any = await db.query(
      `SELECT COUNT(*) n, SUM(CASE WHEN v.verified = 1 THEN 1 ELSE 0 END) verified_n, SUM(CASE WHEN v.pay_n > 0 THEN 1 ELSE 0 END) paid_n, COALESCE(SUM(v.pay_total),0) total FROM (${DEV}) v ${f.sql}`, f.args);
    const [rows]: any = await db.query(`SELECT v.* FROM (${DEV}) v ${f.sql} ORDER BY ${order} LIMIT ? OFFSET ?`, [...f.args, limit, (page - 1) * limit]);
    const [states]: any = await db.query(`SELECT DISTINCT state FROM devotees WHERE state <> '' ORDER BY state LIMIT 100`);
    return res.json({
      total: Number(t.n), page, limit, items: rows.map(row),
      totals: { devotees: Number(t.n), verified: Number(t.verified_n || 0), paying: Number(t.paid_n || 0), paid: money(t.total) },
      states: states.map((s: any) => s.state),
    });
  } catch (e: any) { return fail(res, e, 'Could not load the devotees.'); }
});

// ---------- CSV (opens in Excel) ----------
const cell = (v: unknown) => {
  let s = v == null ? '' : v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 19) : String(v);
  if (/^([=@\t\r]|[+\-](?![\d\s]))/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
router.get('/admin/devotees/export', async (req, res) => {
  try {
    const f = filters(req.query);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const order = SORT[one(req.query.sort)] || SORT.newest;
    const [rows]: any = await db.query(`SELECT v.* FROM (${DEV}) v ${f.sql} ORDER BY ${order} LIMIT 20000`, f.args);
    const head = ['Devotee id', 'Name', 'Phone', 'Email', 'Residency', 'Communication address', 'Permanent address', 'City', 'State', 'Joined', 'Email verified', 'Sign-in', 'PAN given', 'Family members', 'Paid payments', 'Total paid (INR)', 'Donations (INR)', 'Sevas (INR)', 'Camps (INR)', 'Magazine (INR)', 'Last paid'];
    const lines = [head.map(cell).join(',')];
    for (const raw of rows) {
      const r = row(raw);
      lines.push([r.id, r.name, r.phone, r.email, r.residency, r.comm_address, r.perm_address, r.city, r.state, raw.joined_at, r.verified ? 'Yes' : 'No', r.login, r.has_pan ? 'Yes' : 'No', r.family_count, r.pay_count, r.pay_total, r.totals.donation, r.totals.seva, r.totals.camp, r.totals.magazine, raw.last_paid].map(cell).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="devotees.csv"');
    return res.send('﻿' + lines.join('\r\n'));
  } catch (e: any) { return fail(res, e, 'Could not make the file.'); }
});

// ---------- Reports ----------
router.get('/admin/devotees/report', async (req, res) => {
  try {
    const from = one(req.query.from), to = one(req.query.to);
    if (from && !realDay(from)) return res.status(400).json({ message: 'The "from" date is not valid.' });
    if (to && !realDay(to)) return res.status(400).json({ message: 'The "to" date is not valid.' });
    // devotees who joined in the period (all devotees when there are no dates)
    const w: string[] = []; const wa: any[] = [];
    if (from) { w.push('v.joined_at >= ?'); wa.push(`${from} 00:00:00`); }
    if (to) { w.push('v.joined_at < DATE_ADD(?, INTERVAL 1 DAY)'); wa.push(`${to} 00:00:00`); }
    const inPeriod = w.length ? `WHERE ${w.join(' AND ')}` : '';
    // payments made in the period
    const pw: string[] = []; const pa: any[] = [];
    if (from) { pw.push('p.paid_at >= ?'); pa.push(`${from} 00:00:00`); }
    if (to) { pw.push('p.paid_at < DATE_ADD(?, INTERVAL 1 DAY)'); pa.push(`${to} 00:00:00`); }
    const payWhere = pw.length ? `WHERE ${pw.join(' AND ')}` : '';
    const run = (sql: string, args: any[] = []) => db.query(sql, args).then((r: any) => r[0] as any[]);

    let prev: Promise<any[]> | null = null;
    if (from && to && dayNum(to) >= dayNum(from)) {
      const len = dayNum(to) - dayNum(from) + 1;
      prev = run('SELECT COUNT(*) n FROM devotees v0 WHERE v0.created_at >= ? AND v0.created_at < DATE_ADD(?, INTERVAL 1 DAY)', [`${dayStr(dayNum(from) - len)} 00:00:00`, `${dayStr(dayNum(from) - 1)} 00:00:00`]);
    }
    const base = from ? run('SELECT COUNT(*) n FROM devotees WHERE created_at < ?', [`${from} 00:00:00`]) : Promise.resolve([{ n: 0 }] as any[]);

    const [all, signups, residency, login, states, cities, segments, bands, mix, top, dormant, newPaid, families, gotra, nakshatra, rasi, activity, health, prevRows, baseRows] = await Promise.all([
      run(`SELECT COUNT(*) n, SUM(CASE WHEN v.verified = 1 THEN 1 ELSE 0 END) verified_n, SUM(CASE WHEN v.residency = 'nri' THEN 1 ELSE 0 END) nri_n,
                  SUM(CASE WHEN v.pay_n > 0 THEN 1 ELSE 0 END) paying_n, SUM(CASE WHEN v.pay_n > 1 THEN 1 ELSE 0 END) repeat_n,
                  SUM(CASE WHEN v.family_n > 0 THEN 1 ELSE 0 END) with_family, COALESCE(SUM(v.family_n),0) family_total, COALESCE(SUM(v.pay_total),0) lifetime
             FROM (${DEV}) v`),
      run(`SELECT DATE_FORMAT(v.joined_at,'%Y-%m-%d') dy, COUNT(*) n FROM (${DEV}) v ${inPeriod} GROUP BY dy ORDER BY dy`, wa),
      run(`SELECT v.residency k, COUNT(*) n FROM (${DEV}) v ${inPeriod} GROUP BY v.residency`, wa),
      run(`SELECT v.login k, COUNT(*) n FROM (${DEV}) v ${inPeriod} GROUP BY v.login`, wa),
      run(`SELECT COALESCE(NULLIF(v.state,''),'Not given') k, COUNT(*) n, COALESCE(SUM(v.pay_total),0) total FROM (${DEV}) v ${inPeriod} GROUP BY k ORDER BY n DESC, total DESC LIMIT 8`, wa),
      run(`SELECT COALESCE(NULLIF(v.city,''),'Not given') k, COUNT(*) n, COALESCE(SUM(v.pay_total),0) total FROM (${DEV}) v ${inPeriod} GROUP BY k ORDER BY n DESC, total DESC LIMIT 8`, wa),
      run(`SELECT CASE WHEN v.pay_n = 0 THEN 1 WHEN v.pay_n = 1 THEN 2 WHEN v.pay_n <= 3 THEN 3 ELSE 4 END b, COUNT(*) n, COALESCE(SUM(v.pay_total),0) total FROM (${DEV}) v ${inPeriod} GROUP BY b ORDER BY b`, wa),
      run(`SELECT CASE WHEN v.pay_total = 0 THEN 0 WHEN v.pay_total <= 1000 THEN 1 WHEN v.pay_total <= 5000 THEN 2 WHEN v.pay_total <= 25000 THEN 3 ELSE 4 END b, COUNT(*) n, COALESCE(SUM(v.pay_total),0) total FROM (${DEV}) v ${inPeriod} GROUP BY b ORDER BY b`, wa),
      run(`SELECT p.source, COUNT(*) n, COUNT(DISTINCT p.devotee_id) people, COALESCE(SUM(p.amount),0) total FROM (${PAY}) p ${payWhere} GROUP BY p.source`, pa),
      run(`SELECT v.id, v.name, v.phone, COUNT(*) n, COALESCE(SUM(p.amount),0) total, MAX(p.paid_at) last_at
             FROM (${PAY}) p JOIN (${DEV}) v ON v.id COLLATE utf8mb4_unicode_ci = p.devotee_id ${payWhere} GROUP BY v.id, v.name, v.phone ORDER BY total DESC LIMIT 8`, pa),
      // joined more than 30 days ago and never paid: people the temple office could invite
      run(`SELECT v.id, v.name, v.phone, v.email, v.city, v.joined_at FROM (${DEV}) v WHERE v.pay_n = 0 AND v.joined_at < DATE_SUB(NOW(), INTERVAL 30 DAY) ORDER BY v.joined_at DESC LIMIT 8`),
      run(`SELECT COUNT(*) n, SUM(CASE WHEN v.pay_n > 0 THEN 1 ELSE 0 END) paid_n FROM (${DEV}) v ${inPeriod}`, wa),
      run(`SELECT CASE WHEN n = 1 THEN 1 WHEN n = 2 THEN 2 WHEN n <= 4 THEN 3 ELSE 4 END b, COUNT(*) devotees FROM (SELECT f.devotee_id, COUNT(*) n FROM devotee_family_members f GROUP BY f.devotee_id) x GROUP BY b ORDER BY b`),
      run(`SELECT TRIM(SUBSTRING_INDEX(f.gothram,'(',1)) k, COUNT(*) n FROM devotee_family_members f WHERE COALESCE(f.gothram,'') <> '' GROUP BY k ORDER BY n DESC LIMIT 8`),
      run(`SELECT TRIM(SUBSTRING_INDEX(f.nakshathiram,'(',1)) k, COUNT(*) n FROM devotee_family_members f WHERE COALESCE(f.nakshathiram,'') <> '' GROUP BY k ORDER BY n DESC LIMIT 8`),
      run(`SELECT TRIM(SUBSTRING_INDEX(f.rasi,'(',1)) k, COUNT(*) n FROM devotee_family_members f WHERE COALESCE(f.rasi,'') <> '' GROUP BY k ORDER BY n DESC LIMIT 8`),
      run(`SELECT DAYOFWEEK(v.joined_at) - 1 w, FLOOR(HOUR(v.joined_at) / 4) b, COUNT(*) n FROM (${DEV}) v ${inPeriod} GROUP BY w, b`, wa),
      run(`SELECT SUM(CASE WHEN COALESCE(v.phone,'') = '' THEN 1 ELSE 0 END) no_phone,
                  SUM(CASE WHEN COALESCE(v.comm_address,'') = '' THEN 1 ELSE 0 END) no_address,
                  SUM(CASE WHEN COALESCE(v.state,'') = '' THEN 1 ELSE 0 END) no_state,
                  SUM(CASE WHEN v.verified IS NULL OR v.verified = 0 THEN 1 ELSE 0 END) unverified,
                  SUM(CASE WHEN v.family_n = 0 THEN 1 ELSE 0 END) no_family
             FROM (${DEV}) v ${inPeriod}`, wa),
      prev ? prev : Promise.resolve([] as any[]),
      base,
    ]);

    const a = all[0] as any;
    const inP = (newPaid[0] as any) || {};
    const h = (health[0] as any) || {};
    const bucketOf = (rows: any[], i: number, key = 'b') => rows.find((x: any) => Number(x[key]) === i);
    const SEG = ['Never paid', 'Paid once', 'Paid 2 or 3 times', 'Paid 4 or more times'];
    const BAND = ['Not paid yet', 'Up to ₹1,000', '₹1,001 to ₹5,000', '₹5,001 to ₹25,000', 'Above ₹25,000'];
    const FAM = ['1 member', '2 members', '3 or 4 members', '5 or more'];
    const members = Number(a.family_total || 0), withFamily = Number(a.with_family || 0);
    return res.json({
      totals: {
        devotees: Number(a.n || 0), verified: Number(a.verified_n || 0), nri: Number(a.nri_n || 0), paying: Number(a.paying_n || 0), repeat: Number(a.repeat_n || 0),
        withFamily, familyMembers: members, avgFamily: withFamily ? Math.round((members / withFamily) * 10) / 10 : 0, lifetime: money(a.lifetime),
      },
      period: { joined: Number(inP.n || 0), joinedAndPaid: Number(inP.paid_n || 0), previous: prevRows[0] ? Number((prevRows[0] as any).n) : null, before: Number((baseRows[0] as any)?.n || 0) },
      signups: signups.map((r: any) => ({ day: r.dy, count: Number(r.n) })),
      residency: residency.map((r: any) => ({ key: r.k, count: Number(r.n) })),
      login: login.map((r: any) => ({ key: r.k, count: Number(r.n) })),
      states: states.map((r: any) => ({ name: r.k, count: Number(r.n), amount: money(r.total) })),
      cities: cities.map((r: any) => ({ name: r.k, count: Number(r.n), amount: money(r.total) })),
      segments: SEG.map((label, i) => { const r = bucketOf(segments, i + 1); return { label, count: r ? Number(r.n) : 0, amount: r ? money(r.total) : 0 }; }),
      bands: BAND.map((label, i) => { const r = bucketOf(bands, i); return { label, count: r ? Number(r.n) : 0, amount: r ? money(r.total) : 0 }; }),
      mix: SOURCES.map((s) => { const r = mix.find((x: any) => x.source === s); return { source: s, count: r ? Number(r.n) : 0, people: r ? Number(r.people) : 0, amount: r ? money(r.total) : 0 }; }),
      top: top.map((r: any) => ({ id: r.id, name: r.name || '', phone: r.phone || '', count: Number(r.n), amount: money(r.total), last: iso(r.last_at) })),
      dormant: dormant.map((r: any) => ({ id: r.id, name: r.name || '', phone: r.phone || '', email: r.email || '', city: r.city || '', joined_at: iso(r.joined_at) })),
      familySizes: FAM.map((label, i) => { const r = bucketOf(families, i + 1); return { label, count: r ? Number(r.devotees) : 0 }; }),
      gothram: gotra.map((r: any) => ({ name: r.k, count: Number(r.n) })),
      nakshatram: nakshatra.map((r: any) => ({ name: r.k, count: Number(r.n) })),
      rasi: rasi.map((r: any) => ({ name: r.k, count: Number(r.n) })),
      activity: activity.map((r: any) => ({ weekday: Number(r.w), block: Number(r.b), count: Number(r.n) })),
      health: { noPhone: Number(h.no_phone || 0), noAddress: Number(h.no_address || 0), noState: Number(h.no_state || 0), unverified: Number(h.unverified || 0), noFamily: Number(h.no_family || 0) },
    });
  } catch (e: any) { return fail(res, e, 'Could not load the devotee report.'); }
});

// ---------- One devotee: profile, family and every payment ----------
router.get('/admin/devotees/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return res.status(400).json({ message: 'Not a valid devotee id.' });
    const [rows]: any = await db.query(`SELECT v.* FROM (${DEV}) v WHERE v.id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ message: 'Devotee not found.' });
    const [family]: any = await db.query(`SELECT id, title, name, gothram, nakshathiram, rasi, relation FROM devotee_family_members WHERE devotee_id = ? ORDER BY id LIMIT 50`, [id]);
    // every payment attempt of this devotee, with one status word
    const ST = (col: string) => `CASE ${col} WHEN 'SUCCESS' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END`;
    const [pays]: any = await db.query(
      `SELECT * FROM (
         SELECT 'donation' AS source, b.fund_title AS item, b.amount AS amount, ${ST('b.status')} AS status, b.receipt_no AS receipt_no, b.razorpay_payment_id AS payment_id, b.created_at AS paid_at FROM donation_booking b WHERE b.devotee_id = ?
         UNION ALL
         SELECT 'seva', b.seva_title, b.amount, ${ST('b.status')}, b.receipt_no, b.razorpay_payment_id, b.created_at FROM seva_bookings b WHERE b.devotee_id = ?
         UNION ALL
         SELECT 'magazine', m.plan_name, m.amount, CASE m.status WHEN 'ACTIVE' THEN 'PAID' WHEN 'EXPIRED' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END, m.receipt_no, m.razorpay_payment_id, m.created_at FROM magazine_subscriptions m WHERE m.devotee_id = ?
         UNION ALL
         SELECT 'camp', COALESCE(c.title_en,'Camp'), r.amount, CASE r.payment_status WHEN 'PAID' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END, NULL, r.razorpay_payment_id, r.created_at
           FROM camp_registrations r LEFT JOIN camps c ON c.id = r.camp_id WHERE r.devotee_id = ? AND r.amount > 0 AND r.payment_status <> 'NONE'
       ) u ORDER BY u.paid_at DESC LIMIT 50`, [id, id, id, id]);
    const [camps]: any = await db.query(
      `SELECT r.id, COALESCE(c.title_en,'Camp') title, r.adults, r.children, r.status, r.amount, r.payment_status, r.created_at
         FROM camp_registrations r LEFT JOIN camps c ON c.id = r.camp_id WHERE r.devotee_id = ? ORDER BY r.created_at DESC LIMIT 20`, [id]);
    return res.json({
      devotee: row(rows[0]),
      family: family.map((m: any) => ({ id: m.id, title: m.title || '', name: m.name || '', gothram: m.gothram || '', nakshathiram: m.nakshathiram || '', rasi: m.rasi || '', relation: m.relation || '' })),
      payments: pays.map((p: any) => ({ source: p.source, item: p.item, amount: money(p.amount), status: p.status, receipt_no: p.receipt_no, payment_id: p.payment_id, paid_at: iso(p.paid_at) })),
      camps: camps.map((c: any) => ({ id: c.id, title: c.title, adults: Number(c.adults) || 0, children: Number(c.children) || 0, status: c.status, amount: money(c.amount), payment_status: c.payment_status, registered_at: iso(c.created_at) })),
    });
  } catch (e: any) { return fail(res, e, 'Could not load the devotee.'); }
});

// ---------- PAN numbers, for 80G receipts (admin only, written to the log) ----------
const PAN_OK = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ADMIN_ROLES = ['superadmin', 'admin'];
const who = (req: Request) => {
  const u: any = (req as any).user || (req as any).auth || {};
  return { role: String(u.role || '').toLowerCase(), name: String(u.email || u.full_name || u.id || 'unknown') };
};
function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_ROLES.includes(who(req).role)) return res.status(403).json({ message: 'Only an admin can see PAN numbers.' });
  res.setHeader('Cache-Control', 'no-store');
  return next();
}
const cleanPan = (v: unknown) => String(v || '').trim().toUpperCase();

// The PAN of each donation of one devotee, plus the PAN saved on the profile
router.get('/admin/devotees/:id/pan', adminOnly, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return res.status(400).json({ message: 'Not a valid devotee id.' });
    const [prof]: any = await db.query(
      `SELECT d.pan_number AS profile_pan, (SELECT x.pan_number FROM donor_ids x WHERE x.devotee_id = d.id LIMIT 1) AS saved_pan FROM devotees d WHERE d.id = ?`, [id]);
    if (!prof.length) return res.status(404).json({ message: 'Devotee not found.' });
    const [rows]: any = await db.query(
      `SELECT b.id, b.receipt_no, b.fund_title, b.amount, b.booking_date, b.created_at, b.pan_number, b.donor_address, b.donor_city, b.donor_state
         FROM donation_booking b WHERE b.devotee_id = ? AND b.status = 'SUCCESS' ORDER BY b.created_at DESC LIMIT 100`, [id]);
    console.log(`[audit] PAN viewed by ${who(req).name} (${who(req).role}) for devotee ${id}`);
    const profilePan = cleanPan(prof[0].profile_pan) || cleanPan(prof[0].saved_pan);
    return res.json({
      profile: { pan: profilePan, valid: profilePan ? PAN_OK.test(profilePan) : null },
      donations: rows.map((r: any) => {
        const pan = cleanPan(r.pan_number);
        return { id: r.id, receipt_no: r.receipt_no, fund: r.fund_title, amount: money(r.amount), date: iso(r.created_at), pan, valid: pan ? PAN_OK.test(pan) : null, address: [r.donor_address, r.donor_city, r.donor_state].filter(Boolean).join(', ') };
      }),
    });
  } catch (e: any) { return fail(res, e, 'Could not load the PAN numbers.'); }
});

// 80G file: every PAID donation in a date range with the donor, PAN and address (opens in Excel)
router.get('/admin/donations-80g/export', adminOnly, async (req, res) => {
  try {
    const from = one(req.query.from), to = one(req.query.to);
    if (!realDay(from) || !realDay(to) || dayNum(to) < dayNum(from)) return res.status(400).json({ message: 'Choose a valid from and to date.' });
    const [rows]: any = await db.query(
      `SELECT b.receipt_no, b.created_at, b.booking_date, b.fund_title, b.category, b.amount, b.currency, b.razorpay_payment_id, b.pan_number,
              b.donor_address, b.donor_city, b.donor_state, d.id AS devotee_id, TRIM(CONCAT(COALESCE(d.first_name,''),' ',COALESCE(d.last_name,''))) AS name, d.email, d.phone
         FROM donation_booking b LEFT JOIN devotees d ON d.id = b.devotee_id
        WHERE b.status = 'SUCCESS' AND b.created_at >= ? AND b.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        ORDER BY b.created_at ASC LIMIT 20000`, [`${from} 00:00:00`, `${to} 00:00:00`]);
    console.log(`[audit] 80G file (${from} to ${to}, ${rows.length} rows) downloaded by ${who(req).name} (${who(req).role})`);
    const head = ['Receipt no', 'Donation date', 'Donor name', 'PAN', 'PAN format', 'Address', 'City', 'State', 'Fund', 'Category', 'Amount (INR)', 'Razorpay payment id', 'Phone', 'Email', 'Devotee id'];
    const lines = [head.map(cell).join(',')];
    for (const r of rows) {
      const pan = cleanPan(r.pan_number);
      lines.push([r.receipt_no, r.created_at, r.name, pan, pan ? (PAN_OK.test(pan) ? 'OK' : 'Check') : 'Missing', r.donor_address, r.donor_city, r.donor_state, r.fund_title, r.category, money(r.amount), r.razorpay_payment_id, r.phone, r.email, r.devotee_id].map(cell).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="80g-donations-${from}-to-${to}.csv"`);
    return res.send('﻿' + lines.join('\r\n'));
  } catch (e: any) { return fail(res, e, 'Could not make the 80G file.'); }
});

export default router;