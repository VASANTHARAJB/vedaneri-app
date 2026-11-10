import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import {
  getSuggestion,
  getSuggestions,
  isValidIsoDate,
  ProviderConfigError,
  safeMessage,
} from '../panchangamProvider';
import { runPanchangamSync, getSyncStatus } from '../panchangamSync';
import { tamilDayOf, localPanchang, placeFromEnv, TAMIL_MONTH_NAMES } from '../panchangamCalendar';
import { hasExtraColumns } from '../panchangamColumns';

const router = Router();

// Who may do what
//   - GET /date            public: only the facts that are printed on forms and shown on the site (no ids, no staff names, no timestamps).
//   - everything else      needs a logged-in CMS user (the same guard the other CMS routes use).
// The name in the audit log comes from the login token, never from the request body, so it cannot be faked.
const adminGuard = (req: Request, res: Response, next: NextFunction) =>
  authenticate(req as AuthenticatedRequest, res, next);

const authorOf = (req: Request): string => {
  const u: any = (req as any).user || {};
  const name = [u.full_name, u.name, u.email, u.username].find((v) => typeof v === 'string' && v.trim());
  return String(name || 'Admin').trim().slice(0, 100);
};

// Real server errors stay in the server log; the browser only gets a short message.
const fail = (res: Response, e: any, message: string) => {
  console.error(`Panchangam: ${message}`, e?.sqlMessage || e?.message || e);
  return res.status(500).json({ message });
};

const clean = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);
const isCode = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 100;

// The extra details (only read when sql/panchangam-extra-columns.sql has been run)
const EXTRA_SELECT = ', rasi, yogam, karanam, sunrise, sunset, rahu_kalam, yamagandam, gulikai, auto_festivals, details_json';
const parseDetails = (v: unknown) => {
  try { return v ? JSON.parse(String(v)) : null; } catch { return null; }
};
const extraOut = (r: any) => ({
  rasi: r.rasi || null, yogam: r.yogam || null, karanam: r.karanam || null,
  sunrise: r.sunrise || null, sunset: r.sunset || null,
  rahuKalam: r.rahu_kalam || null, yamagandam: r.yamagandam || null, gulikai: r.gulikai || null,
  autoFestivals: r.auto_festivals ? String(r.auto_festivals).split(' · ') : [],
  details: parseDetails(r.details_json),
});

/* ---------------- public ---------------- */

// GET ONE DAY BY ENGLISH DATE (used by the on-site seva entry form and the printed sankalpa form)
// Returns the entry the Panchangam Manager holds for that date, or entry: null when none has been entered.
router.get('/date', async (req: Request, res: Response) => {
  try {
    const date = String(req.query.date || '').trim();
    if (!isValidIsoDate(date)) {
      return res.status(400).json({ message: 'date must be a real date in YYYY-MM-DD form' });
    }

    const extras = await hasExtraColumns();
    const [rows]: any = await pool.query(
      `SELECT
        DATE_FORMAT(calendar_date, '%Y-%m-%d') as calendar_date,
        tamil_year,
        tamil_month,
        tamil_date,
        thithi,
        nakshatram,
        special_event${extras ? EXTRA_SELECT : ''}
       FROM panchangam_calendar
       WHERE calendar_date = ?
       LIMIT 1`,
      [date]
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, entry: rows && rows.length ? rows[0] : null });
  } catch (error: any) {
    return fail(res, error, 'Failed to fetch panchangam for this date');
  }
});

// GET /public/month?year=2026&month=11   (English month, for the website calendar page)
// Every saved day of that English month with everything the website shows. Days not saved yet are simply missing.
router.get('/public/month', async (req: Request, res: Response) => {
  try {
    const y = Number(req.query.year);
    const m = Number(req.query.month);
    if (!Number.isInteger(y) || y < 2000 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) {
      return res.status(400).json({ message: 'year (2000-2100) and month (1-12) are required' });
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const extras = await hasExtraColumns();
    const [rows]: any = await pool.query(
      `SELECT DATE_FORMAT(calendar_date, '%Y-%m-%d') AS d, tamil_year, tamil_month, tamil_date, thithi, nakshatram, special_event${extras ? EXTRA_SELECT : ''}
         FROM panchangam_calendar WHERE calendar_date BETWEEN ? AND ? ORDER BY calendar_date`,
      [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(last)}`]
    );
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json({
      success: true, year: y, month: m,
      days: (rows || []).map((r: any) => ({
        date: r.d,
        weekday: new Date(`${r.d}T00:00:00Z`).getUTCDay(),
        tamilYear: r.tamil_year, tamilMonth: r.tamil_month, tamilDate: Number(r.tamil_date),
        thithi: r.thithi, nakshatram: r.nakshatram, specialEvent: r.special_event || null,
        ...extraOut(r),
      })),
    });
  } catch (error: any) {
    return fail(res, error, 'Failed to fetch the panchangam month');
  }
});

/* ---------------- CMS only ---------------- */

router.use(adminGuard);

// GET /month-span?startYear=2026&month=Karthigai (கார்த்திகை)
// The real English start date and number of days of one Tamil month, worked out from the Sun's position (not from a typed table).
// startYear = the English year in which that Tamil year began (Chithirai 1), e.g. 2026 for Parabhava 2026-27.
const TAMIL_MONTH_KEYS = TAMIL_MONTH_NAMES.map((n) => n.split(' (')[0].trim().toLowerCase());
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// First English date of Tamil month mi (0..11) in the Tamil year that began in English year y. mi = 12 means Chithirai of the next year.
function monthStartOf(y: number, mi: number): string {
  const yy = mi === 12 ? y + 1 : y;
  const m = mi === 12 ? 0 : mi;
  // the middle of the month is always well inside it, so the month is identified safely from there
  const mid = isoOf(Date.UTC(yy, 3, 14) + Math.round(m * 30.44 + 15) * 86400000);
  const td = tamilDayOf(mid);
  if (td.monthIndex !== m) throw new Error(`Month ${m} of ${yy} was expected on ${mid} but ${td.monthIndex} was found`);
  return td.monthStart;
}

router.get('/month-span', async (req: Request, res: Response) => {
  try {
    const startYear = Number(req.query.startYear);
    const key = clean(req.query.month, 100).split(' (')[0].trim().toLowerCase();
    const mi = TAMIL_MONTH_KEYS.indexOf(key);
    if (!Number.isInteger(startYear) || startYear < 1900 || startYear > 2200 || mi === -1) {
      return res.status(400).json({ message: 'A valid startYear and Tamil month are required' });
    }
    const start = monthStartOf(startYear, mi);
    const next = monthStartOf(startYear, mi + 1);
    const length = Math.round((new Date(`${next}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86400000);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, start, length });
  } catch (error: any) {
    return fail(res, error, 'Could not work out the month dates');
  }
});

// 1. GET ALL TAMIL YEARS
router.get('/years', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, year_name as name, english_span as englishSpan
       FROM panchangam_years
       ORDER BY created_at ASC`
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, years: rows || [] });
  } catch (error: any) {
    return fail(res, error, 'Failed to fetch years');
  }
});

// 2. ADD TAMIL YEAR
router.post('/years', async (req: Request, res: Response) => {
  try {
    const name = clean(req.body?.name, 100);
    const englishSpan = clean(req.body?.englishSpan, 50);
    if (!name || !englishSpan) {
      return res.status(400).json({ message: 'Year name and English span are required' });
    }

    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
    const given = clean(req.body?.id, 60).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const yearId = given || sanitized || `yr_${Date.now()}`;

    await pool.query(
      `INSERT INTO panchangam_years (id, year_name, english_span)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
        year_name = VALUES(year_name),
        english_span = VALUES(english_span)`,
      [yearId, name, englishSpan]
    );

    return res.json({ success: true, message: 'Year saved to database' });
  } catch (error: any) {
    return fail(res, error, 'Failed to save year to database');
  }
});

// 3. GET MONTH ENTRIES (strict exact match)
router.get('/month', async (req: Request, res: Response) => {
  try {
    const { year, month } = req.query;

    if (!isCode(year) || !isCode(month)) {
      return res.status(400).json({ message: 'year and month query params required' });
    }

    const [rows]: any = await pool.query(
      `SELECT
        id,
        DATE_FORMAT(calendar_date, '%Y-%m-%d') as calendar_date,
        tamil_year,
        tamil_month,
        tamil_date,
        thithi,
        nakshatram,
        special_event,
        created_by,
        updated_by,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
       FROM panchangam_calendar
       WHERE tamil_year = ? AND tamil_month = ?
       ORDER BY tamil_date ASC`,
      [String(year).trim(), String(month).trim()]
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, entries: rows || [] });
  } catch (error: any) {
    return fail(res, error, 'Failed to fetch panchangam data');
  }
});

// 3b. ONE ENGLISH MONTH AS A CALENDAR (used by the CMS calendar page)
// GET /month-view?year=2026&month=11
// For every English day: what is SAVED in the database (if anything) and what the sky calculation gives for the same day
// (Tamil month/date, thithi and nakshatram at sunrise, sunrise, sunset, when the thithi and nakshatram end).
// differs.* is true when a saved thithi/nakshatram is not the one running at sunrise, so a person can look at that day.
const letters = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '');
const pakshaOf = (v: string) => (/krishna|krushna|bahula/i.test(v) ? 'k' : /sukla|shukla|sudha/i.test(v) ? 's' : '');
const tithiBase = (v: string) => letters(v).replace(/krishna|krushna|bahula|sukla|shukla|sudha|paksha/g, '');
const sameThithi = (saved: string, calc: string) => {
  if (!saved) return true;
  if (tithiBase(saved) !== tithiBase(calc)) return false;
  const a = pakshaOf(saved);
  const b = pakshaOf(calc);
  return !a || !b || a === b;
};
const nakParts = (v: string) => {
  const i = v.indexOf('(');
  return { en: letters(i === -1 ? v : v.slice(0, i)), ta: i === -1 ? '' : v.slice(i + 1).replace(/\).*$/, '').trim() };
};
const sameNak = (saved: string, calc: string) => {
  if (!saved) return true;
  const a = nakParts(saved);
  const b = nakParts(calc);
  return (a.en !== '' && a.en === b.en) || (a.ta !== '' && a.ta === b.ta);
};

router.get('/month-view', async (req: Request, res: Response) => {
  try {
    const y = Number(req.query.year);
    const m = Number(req.query.month);
    if (!Number.isInteger(y) || y < 2000 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) {
      return res.status(400).json({ message: 'year (2000-2100) and month (1-12) are required' });
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const from = `${y}-${pad(m)}-01`;
    const to = `${y}-${pad(m)}-${pad(last)}`;

    const extras = await hasExtraColumns();
    const [rows]: any = await pool.query(
      `SELECT DATE_FORMAT(calendar_date, '%Y-%m-%d') AS d, tamil_year, tamil_month, tamil_date, thithi, nakshatram, special_event${extras ? EXTRA_SELECT : ''}
         FROM panchangam_calendar WHERE calendar_date BETWEEN ? AND ?`,
      [from, to]
    );
    const saved = new Map<string, any>();
    for (const r of rows || []) saved.set(r.d, r);

    const place = placeFromEnv();
    const days = [];
    for (let d = 1; d <= last; d++) {
      const date = `${y}-${pad(m)}-${pad(d)}`;
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      const s = saved.get(date) || null;
      let calc: any = null;
      try {
        const t = tamilDayOf(date, place);
        const l = localPanchang(date, place);
        calc = {
          tamilStartYear: t.startYear, tamilMonth: t.monthName, tamilDate: t.day,
          thithi: l.thithi, nakshatram: l.nakshatram,
          sunrise: l.sunrise, sunset: l.sunset, tithiEndsAt: l.tithiEndsAt, nakshatraEndsAt: l.nakshatraEndsAt,
          rasi: l.rasi, yogam: l.yogam, karanam: l.karanam, rahuKalam: l.rahuKalam, yamagandam: l.yamagandam, gulikai: l.gulikai,
          festivals: l.festivals, spans: l.spans,
        };
      } catch (e: any) {
        console.error(`Panchangam month-view: could not calculate ${date}:`, e?.message || e);
      }
      days.push({
        date,
        weekday,
        saved: s && {
          tamilYear: s.tamil_year, tamilMonth: s.tamil_month, tamilDate: Number(s.tamil_date),
          thithi: s.thithi || '', nakshatram: s.nakshatram || '', specialEvent: s.special_event || null,
          ...extraOut(s),
        },
        calc,
        differs: {
          thithi: Boolean(s && calc && !sameThithi(String(s.thithi || ''), calc.thithi)),
          nakshatram: Boolean(s && calc && !sameNak(String(s.nakshatram || ''), calc.nakshatram)),
        },
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true, year: y, month: m, place,
      savedCount: saved.size, totalDays: last, extraColumns: extras,
      days,
    });
  } catch (error: any) {
    return fail(res, error, 'Failed to build the month calendar');
  }
});

// 4. UPSERT SINGLE DATE (409 conflict guard + audit log, saved together in one transaction)
router.post('/upsert', async (req: Request, res: Response) => {
  const author = authorOf(req);
  let conn: any = null;
  try {
    const calendar_date = clean(req.body?.calendar_date, 10);
    const tamil_year = clean(req.body?.tamil_year, 100);
    const tamil_month = clean(req.body?.tamil_month, 100);
    const tDateNum = Number(req.body?.tamil_date);
    const thithi = clean(req.body?.thithi, 200);
    const nakshatram = clean(req.body?.nakshatram, 200);
    const special_event = clean(req.body?.special_event, 500) || null;

    if (!calendar_date || !tamil_year || !tamil_month || !req.body?.tamil_date) {
      return res.status(400).json({ message: 'Missing required calendar fields' });
    }
    if (!isValidIsoDate(calendar_date)) {
      return res.status(400).json({ message: 'calendar_date must be a real date in YYYY-MM-DD form' });
    }
    if (!Number.isInteger(tDateNum) || tDateNum < 1 || tDateNum > 32) {
      return res.status(400).json({ message: 'tamil_date must be a whole number from 1 to 32' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Conflict guard: does this English date already belong to a different Tamil day?
    const [existingDateRows]: any = await conn.query(
      `SELECT tamil_year, tamil_month, tamil_date
       FROM panchangam_calendar
       WHERE calendar_date = ? LIMIT 1 FOR UPDATE`,
      [calendar_date]
    );
    if (existingDateRows.length > 0) {
      const match = existingDateRows[0];
      const isDifferentDay =
        match.tamil_year !== tamil_year ||
        match.tamil_month !== tamil_month ||
        Number(match.tamil_date) !== tDateNum;
      if (isDifferentDay) {
        await conn.rollback();
        return res.status(409).json({
          message: `Conflict: English date ${calendar_date} is already assigned to ${match.tamil_year} - ${match.tamil_month} (Date ${match.tamil_date}). Delete or change that date first.`,
        });
      }
    }

    // INSERT or UPDATE, for the audit log
    const [existingTamilDayRows]: any = await conn.query(
      `SELECT id FROM panchangam_calendar
       WHERE tamil_year = ? AND tamil_month = ? AND tamil_date = ? LIMIT 1 FOR UPDATE`,
      [tamil_year, tamil_month, tDateNum]
    );
    const action = existingTamilDayRows.length > 0 ? 'UPDATE' : 'INSERT';

    await conn.query(
      `INSERT INTO panchangam_calendar
        (calendar_date, tamil_year, tamil_month, tamil_date, thithi, nakshatram, special_event, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        calendar_date = VALUES(calendar_date),
        thithi = VALUES(thithi),
        nakshatram = VALUES(nakshatram),
        special_event = VALUES(special_event),
        updated_by = VALUES(updated_by)`,
      [calendar_date, tamil_year, tamil_month, tDateNum, thithi, nakshatram, special_event, author, author]
    );

    await conn.query(
      `INSERT INTO panchangam_audit_logs
        (calendar_date, tamil_year, tamil_month, tamil_date, action, changed_by, payload_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [calendar_date, tamil_year, tamil_month, tDateNum, action, author, JSON.stringify({ thithi, nakshatram, special_event })]
    );

    await conn.commit();
    return res.json({ success: true, message: 'Panchangam entry saved successfully' });
  } catch (error: any) {
    if (conn) { try { await conn.rollback(); } catch { /* ignore */ } }
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Duplicate entry detected for this date or Tamil day.' });
    }
    return fail(res, error, 'Failed to save panchangam date');
  } finally {
    if (conn) conn.release();
  }
});

// 5. DELETE SINGLE ENTRY (audit log saved in the same transaction)
router.delete('/entry', async (req: Request, res: Response) => {
  const author = authorOf(req);
  let conn: any = null;
  try {
    const tamil_year = clean(req.body?.tamil_year, 100);
    const tamil_month = clean(req.body?.tamil_month, 100);
    const tDateNum = Number(req.body?.tamil_date);

    if (!tamil_year || !tamil_month || !Number.isInteger(tDateNum) || tDateNum < 1 || tDateNum > 32) {
      return res.status(400).json({ message: 'Tamil day coordinates required to delete' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existing]: any = await conn.query(
      `SELECT * FROM panchangam_calendar
       WHERE tamil_year = ? AND tamil_month = ? AND tamil_date = ? LIMIT 1 FOR UPDATE`,
      [tamil_year, tamil_month, tDateNum]
    );

    if (existing.length > 0) {
      await conn.query(
        `DELETE FROM panchangam_calendar
         WHERE tamil_year = ? AND tamil_month = ? AND tamil_date = ?`,
        [tamil_year, tamil_month, tDateNum]
      );
      await conn.query(
        `INSERT INTO panchangam_audit_logs
          (calendar_date, tamil_year, tamil_month, tamil_date, action, changed_by, payload_snapshot)
         VALUES (?, ?, ?, ?, 'DELETE', ?, ?)`,
        [existing[0].calendar_date, tamil_year, tamil_month, tDateNum, author, JSON.stringify(existing[0])]
      );
    }

    await conn.commit();
    return res.json({ success: true, message: 'Panchangam entry deleted' });
  } catch (error: any) {
    if (conn) { try { await conn.rollback(); } catch { /* ignore */ } }
    return fail(res, error, 'Failed to clear entry');
  } finally {
    if (conn) conn.release();
  }
});

// 6. SUGGEST ONE DAY FROM THE 3RD-PARTY PANCHANGAM API (read-only, never writes to the database)
// GET /suggest?date=YYYY-MM-DD   -> { success, suggestion: { thithi, nakshatram, ... } }
router.get('/suggest', async (req: Request, res: Response) => {
  try {
    const date = String(req.query.date || '').trim();
    if (!isValidIsoDate(date)) {
      return res.status(400).json({ message: 'date must be a real date in YYYY-MM-DD form' });
    }
    // The raw provider answer is only ever returned when the server owner switched PANCHANGAM_DEBUG on (never in production).
    const includeRaw = req.query.debug === '1' && process.env.PANCHANGAM_DEBUG === '1' && process.env.NODE_ENV !== 'production';
    const suggestion = await getSuggestion(date, { includeRaw });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, suggestion });
  } catch (error: any) {
    console.error('Panchangam suggest failed:', error?.message || error);
    if (error instanceof ProviderConfigError) {
      return res.status(503).json({ message: error.message });
    }
    return res.status(502).json({ message: safeMessage(error) });
  }
});

// 7. SUGGEST MANY DAYS (month review screen). Body: { dates: ['YYYY-MM-DD', ...] }  (max 40)
router.post('/suggest-batch', async (req: Request, res: Response) => {
  try {
    const raw = req.body?.dates;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) {
      return res.status(400).json({ message: 'dates must be an array of 1 to 40 dates' });
    }
    const dates: string[] = Array.from(new Set(raw.map((d: unknown) => String(d).trim())));
    if (dates.some((d) => !isValidIsoDate(d))) {
      return res.status(400).json({ message: 'One or more dates are not valid (YYYY-MM-DD)' });
    }
    const results = await getSuggestions(dates);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, results });
  } catch (error: any) {
    console.error('Panchangam suggest-batch failed:', error?.message || error);
    if (error instanceof ProviderConfigError) {
      return res.status(503).json({ message: error.message });
    }
    return res.status(502).json({ message: safeMessage(error) });
  }
});

// 8. AUTOMATIC FILL (the daily job in panchangamSync.ts does this by itself; these two let an admin look at it or run it now)
// GET /sync/status  -> schedule, source and the report of the last run
router.get('/sync/status', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ success: true, ...getSyncStatus() });
});

// POST /sync   Body: { days?: 1..400, from?: 'YYYY-MM-DD' }  -> fills the EMPTY days from that date (default today); never changes an existing entry
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const days = Number(req.body?.days);
    const from = typeof req.body?.from === 'string' ? req.body.from.trim() : undefined;
    const report = await runPanchangamSync({ days: Number.isFinite(days) && days > 0 ? days : undefined, from });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, report });
  } catch (error: any) {
    if (/already running/.test(error?.message || '')) return res.status(409).json({ message: 'A sync is already running' });
    return fail(res, error, 'Sync failed');
  }
});

export default router;