import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../dbLimit';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

// Payments dashboard (read only): donations, sevas, camp fees and magazine subscriptions in one list.
// Money figures count only PAID payments. Aadhaar and PAN are never read here.
const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const dbg = (e: any) => (IS_PROD ? undefined : e?.sqlMessage || e?.message || String(e));
const fail = (res: Response, e: any, message: string) => {
  console.error(`Payments: ${message}`, e?.sqlMessage || e?.message || e);
  return res.status(500).json({ message, detail: dbg(e) });
};
const adminGuard = (req: Request, res: Response, next: NextFunction) => authenticate(req as AuthenticatedRequest, res, next);
router.use(adminGuard);

const SOURCES = ['donation', 'seva', 'camp', 'magazine'] as const;
const STATUSES = ['PAID', 'PENDING', 'FAILED'] as const;

// One row per payment, from the four tables, with the same columns and one status word (PAID / PENDING / FAILED).
// Camp registrations without a fee, and magazine subscriptions that were never started, are left out.
const UNIFIED = `
  SELECT 'donation' COLLATE utf8mb4_unicode_ci AS source, CONCAT('d', b.id) COLLATE utf8mb4_unicode_ci AS ref,
         b.fund_title COLLATE utf8mb4_unicode_ci AS item, b.amount AS amount,
         CASE b.status WHEN 'SUCCESS' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END COLLATE utf8mb4_unicode_ci AS status,
         TRIM(CONCAT(COALESCE(v.first_name,''),' ',COALESCE(v.last_name,''))) COLLATE utf8mb4_unicode_ci AS name,
         v.email COLLATE utf8mb4_unicode_ci AS email, v.phone COLLATE utf8mb4_unicode_ci AS phone,
         b.receipt_no COLLATE utf8mb4_unicode_ci AS receipt_no, b.razorpay_order_id COLLATE utf8mb4_unicode_ci AS order_id,
         b.razorpay_payment_id COLLATE utf8mb4_unicode_ci AS payment_id, 'online' COLLATE utf8mb4_unicode_ci AS mode,
         b.created_at AS paid_at
    FROM donation_booking b LEFT JOIN devotees v ON v.id = b.devotee_id
  UNION ALL
  SELECT 'seva', CONCAT('s', b.id), b.seva_title, b.amount,
         CASE b.status WHEN 'SUCCESS' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END,
         TRIM(CONCAT(COALESCE(v.first_name,''),' ',COALESCE(v.last_name,''))), v.email, v.phone,
         b.receipt_no, b.razorpay_order_id, b.razorpay_payment_id, 'online', b.created_at
    FROM seva_bookings b LEFT JOIN devotees v ON v.id = b.devotee_id
  UNION ALL
  SELECT 'camp', CONCAT('c', r.id), COALESCE(c.title_en, 'Camp'), r.amount,
         CASE r.payment_status WHEN 'PAID' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END,
         TRIM(CONCAT(COALESCE(r.first_name,''),' ',COALESCE(r.last_name,''))), r.email, r.phone,
         NULL, r.razorpay_order_id, r.razorpay_payment_id, 'online', r.created_at
    FROM camp_registrations r LEFT JOIN camps c ON c.id = r.camp_id
   WHERE r.amount > 0 AND r.payment_status <> 'NONE'
  UNION ALL
  SELECT 'magazine', CONCAT('m', m.id), m.plan_name, m.amount,
         CASE m.status WHEN 'ACTIVE' THEN 'PAID' WHEN 'EXPIRED' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END,
         TRIM(CONCAT(COALESCE(m.first_name,''),' ',COALESCE(m.last_name,''))), m.email, m.phone,
         m.receipt_no, m.razorpay_order_id, m.razorpay_payment_id, COALESCE(m.payment_mode, 'online'), m.created_at
    FROM magazine_subscriptions m`;

// ---------- Filters (every value is a bound parameter; nothing from the request is put into the SQL text) ----------
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDay = (d: string) => DAY.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
const one = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function filters(q: Request['query'], withText = true) {
  const where: string[] = [];
  const args: any[] = [];
  const source = one(q.source);
  if (source) { if (!(SOURCES as readonly string[]).includes(source)) return { error: 'Unknown source.' } as const; where.push('p.source = ?'); args.push(source); }
  const status = one(q.status).toUpperCase();
  if (status) { if (!(STATUSES as readonly string[]).includes(status)) return { error: 'Unknown status.' } as const; where.push('p.status = ?'); args.push(status); }
  const from = one(q.from), to = one(q.to);
  if (from) { if (!realDay(from)) return { error: 'The "from" date is not valid.' } as const; where.push('p.paid_at >= ?'); args.push(`${from} 00:00:00`); }
  if (to) { if (!realDay(to)) return { error: 'The "to" date is not valid.' } as const; where.push('p.paid_at < DATE_ADD(?, INTERVAL 1 DAY)'); args.push(`${to} 00:00:00`); }
  const text = withText ? one(q.q).slice(0, 80) : '';
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push('(p.name LIKE ? OR p.email LIKE ? OR p.phone LIKE ? OR p.item LIKE ? OR p.receipt_no LIKE ? OR p.order_id LIKE ? OR p.payment_id LIKE ?)');
    args.push(like, like, like, like, like, like, like);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', args } as const;
}

const money = (v: any) => Math.round(Number(v || 0) * 100) / 100;

// ---------- Summary: everything the dashboard draws ----------
const dayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
const dayStr = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

router.get('/admin/summary', async (req, res) => {
  try {
    const f = filters(req.query, false);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const paidOnly = f.sql ? `${f.sql} AND p.status = 'PAID'` : `WHERE p.status = 'PAID'`;
    const run = (sql: string, args: any[] = f.args) => db.query(sql, args).then((r: any) => r[0] as any[]);
    const from = one(req.query.from), to = one(req.query.to);

    // The period just before this one, of the same length, so the dashboard can show "up 12% on the last period"
    let prev: Promise<any[]> | null = null;
    if (from && to && dayNum(to) >= dayNum(from)) {
      const len = dayNum(to) - dayNum(from) + 1;
      const pf = filters({ ...req.query, from: dayStr(dayNum(from) - len), to: dayStr(dayNum(from) - 1) }, false);
      if (!('error' in pf)) prev = run(`SELECT COUNT(*) n, COALESCE(SUM(p.amount),0) total FROM (${UNIFIED}) p ${pf.sql ? `${pf.sql} AND` : 'WHERE'} p.status = 'PAID'`, pf.args);
    }

    const [tot, src, daily, activity, top, donors, payers, prevRows] = await Promise.all([
      run(`SELECT p.status, COUNT(*) n, COALESCE(SUM(p.amount),0) total FROM (${UNIFIED}) p ${f.sql} GROUP BY p.status`),
      run(`SELECT p.source, COUNT(*) n, COALESCE(SUM(p.amount),0) total FROM (${UNIFIED}) p ${paidOnly} GROUP BY p.source`),
      run(`SELECT DATE_FORMAT(p.paid_at,'%Y-%m-%d') d, p.source, COUNT(*) n, COALESCE(SUM(p.amount),0) total FROM (${UNIFIED}) p ${paidOnly} GROUP BY d, p.source ORDER BY d`),
      run(`SELECT DAYOFWEEK(p.paid_at) - 1 w, FLOOR(HOUR(p.paid_at) / 4) b, COUNT(*) n FROM (${UNIFIED}) p ${paidOnly} GROUP BY w, b`),
      run(`SELECT p.item, p.source, COUNT(*) n, COALESCE(SUM(p.amount),0) total FROM (${UNIFIED}) p ${paidOnly} GROUP BY p.item, p.source ORDER BY total DESC LIMIT 6`),
      run(`SELECT COALESCE(NULLIF(p.email,''), NULLIF(p.phone,''), NULLIF(p.name,''), 'Unknown') k, MAX(p.name) name, COUNT(*) n, COALESCE(SUM(p.amount),0) total, MAX(p.paid_at) last_at
             FROM (${UNIFIED}) p ${paidOnly} GROUP BY k ORDER BY total DESC LIMIT 8`),
      run(`SELECT COUNT(DISTINCT COALESCE(NULLIF(p.email,''), NULLIF(p.phone,''), NULLIF(p.name,''), 'Unknown')) n FROM (${UNIFIED}) p ${paidOnly}`),
      prev ? prev : Promise.resolve([] as any[]),
    ]);

    const by: Record<string, { count: number; amount: number }> = {};
    for (const r of tot) by[r.status] = { count: Number(r.n), amount: money(r.total) };
    const paid = by.PAID || { count: 0, amount: 0 };
    const attempts = paid.count + (by.FAILED?.count || 0) + (by.PENDING?.count || 0);

    // The same figures by day (all types together), kept for the simple day bars
    const days: { day: string; count: number; amount: number }[] = [];
    for (const r of daily) {
      const last = days[days.length - 1];
      if (last && last.day === r.d) { last.count += Number(r.n); last.amount = money(last.amount + Number(r.total)); }
      else days.push({ day: r.d, count: Number(r.n), amount: money(r.total) });
    }
    const pv = prevRows[0] as any;
    return res.json({
      paid, pending: by.PENDING || { count: 0, amount: 0 }, failed: by.FAILED || { count: 0, amount: 0 },
      average: paid.count ? money(paid.amount / paid.count) : 0,
      successRate: attempts ? Math.round((paid.count / attempts) * 1000) / 10 : 0,
      payers: Number((payers[0] as any)?.n || 0),
      previous: pv ? { count: Number(pv.n), amount: money(pv.total) } : null,
      sources: SOURCES.map((s) => { const r = src.find((x: any) => x.source === s); return { source: s, count: r ? Number(r.n) : 0, amount: r ? money(r.total) : 0 }; }),
      days,
      daily: daily.map((r: any) => ({ day: r.d, source: r.source, count: Number(r.n), amount: money(r.total) })),
      activity: activity.map((r: any) => ({ weekday: Number(r.w), block: Number(r.b), count: Number(r.n) })),
      top: top.map((r: any) => ({ item: r.item, source: r.source, count: Number(r.n), amount: money(r.total) })),
      donors: donors.map((r: any) => ({ name: r.name || '', key: r.k, count: Number(r.n), amount: money(r.total), last: r.last_at instanceof Date ? r.last_at.toISOString() : r.last_at })),
    });
  } catch (e: any) { return fail(res, e, 'Could not load the summary.'); }
});

// ---------- The list ----------
router.get('/admin/list', async (req, res) => {
  try {
    const f = filters(req.query);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 25));
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const [[cnt]]: any = await db.query(`SELECT COUNT(*) n FROM (${UNIFIED}) p ${f.sql}`, f.args);
    const [rows]: any = await db.query(
      `SELECT p.* FROM (${UNIFIED}) p ${f.sql} ORDER BY p.paid_at DESC, p.ref DESC LIMIT ? OFFSET ?`, [...f.args, limit, (page - 1) * limit]);
    return res.json({
      total: Number(cnt.n), page, limit,
      items: rows.map((r: any) => ({ ...r, amount: money(r.amount), paid_at: r.paid_at instanceof Date ? r.paid_at.toISOString() : r.paid_at })),
    });
  } catch (e: any) { return fail(res, e, 'Could not load the payments.'); }
});

// ---------- CSV download (opens in Excel) ----------
// A cell that starts with = + - @ is prefixed with a quote so a spreadsheet never runs it as a formula.
const cell = (v: unknown) => {
  let s = v == null ? '' : v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 19) : String(v);
  if (/^([=@\t\r]|[+\-](?![\d\s]))/.test(s)) s = `'${s}`; // a phone like +9198... is safe and stays as it is
  return `"${s.replace(/"/g, '""')}"`;
};
router.get('/admin/export', async (req, res) => {
  try {
    const f = filters(req.query);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const [rows]: any = await db.query(`SELECT p.* FROM (${UNIFIED}) p ${f.sql} ORDER BY p.paid_at DESC, p.ref DESC LIMIT 20000`, f.args);
    const head = ['Date', 'Type', 'Item', 'Amount (INR)', 'Status', 'Name', 'Email', 'Phone', 'Receipt no', 'Mode', 'Order id', 'Payment id'];
    const lines = [head.map(cell).join(',')];
    for (const r of rows) lines.push([r.paid_at, r.source, r.item, money(r.amount), r.status, r.name, r.email, r.phone, r.receipt_no, r.mode, r.order_id, r.payment_id].map(cell).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
    return res.send('﻿' + lines.join('\r\n'));
  } catch (e: any) { return fail(res, e, 'Could not make the file.'); }
});

// =====================================================================================================
// Seva payments: every seva and corpus booking with the devotee, the Razorpay ids and the sankalpam names.
// A "corpus" booking is a gift to the seva fund; a "seva" booking is a normal seva. (seva_bookings.category)
// =====================================================================================================
const SEVA_ROWS = `
  SELECT b.id AS id, b.devotee_id AS devotee_id, v.devotee_code AS devotee_code,
         TRIM(CONCAT(COALESCE(v.first_name,''),' ',COALESCE(v.last_name,''))) AS name,
         v.email AS email, v.phone AS phone, v.city AS city, v.state AS state,
         b.seva_id AS seva_id, b.seva_title AS seva, b.category AS category, b.amount AS amount, b.currency AS currency,
         CASE b.status WHEN 'SUCCESS' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END AS status,
         b.booking_date AS seva_date, b.receipt_no AS receipt_no,
         b.razorpay_order_id AS order_id, b.razorpay_payment_id AS payment_id,
         b.sankalpam_data AS members, b.created_at AS paid_at
    FROM seva_bookings b LEFT JOIN devotees v ON v.id = b.devotee_id`;
const CATEGORIES = ['seva', 'corpus'] as const;
const SEVA_SORT: Record<string, string> = {
  date: 's.paid_at DESC, s.id DESC', oldest: 's.paid_at ASC, s.id ASC',
  amount_desc: 'CAST(s.amount AS DECIMAL(14,2)) DESC, s.id DESC', amount_asc: 'CAST(s.amount AS DECIMAL(14,2)) ASC, s.id DESC', name: 's.name ASC, s.paid_at DESC',
};

function sevaFilters(q: Request['query'], withText = true) {
  const where: string[] = [];
  const args: any[] = [];
  const category = one(q.category);
  if (category) { if (!(CATEGORIES as readonly string[]).includes(category)) return { error: 'Unknown category.' } as const; where.push('s.category = ?'); args.push(category); }
  const status = one(q.status).toUpperCase();
  if (status) { if (!(STATUSES as readonly string[]).includes(status)) return { error: 'Unknown status.' } as const; where.push('s.status = ?'); args.push(status); }
  const seva = one(q.seva).slice(0, 255);
  if (seva) { where.push('s.seva = ?'); args.push(seva); }
  const from = one(q.from), to = one(q.to);
  if (from) { if (!realDay(from)) return { error: 'The "from" date is not valid.' } as const; where.push('s.paid_at >= ?'); args.push(`${from} 00:00:00`); }
  if (to) { if (!realDay(to)) return { error: 'The "to" date is not valid.' } as const; where.push('s.paid_at < DATE_ADD(?, INTERVAL 1 DAY)'); args.push(`${to} 00:00:00`); }
  const text = withText ? one(q.q).slice(0, 80) : '';
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    // devotee name, phone, email, devotee id, seva name, receipt, Razorpay ids, and the names written for the sankalpam
    where.push('(s.name LIKE ? OR s.email LIKE ? OR s.phone LIKE ? OR s.devotee_id LIKE ? OR s.devotee_code LIKE ? OR s.seva LIKE ? OR s.receipt_no LIKE ? OR s.order_id LIKE ? OR s.payment_id LIKE ? OR s.members LIKE ?)');
    args.push(like, like, like, like, like, like, like, like, like, like);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', args } as const;
}

const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
// The people the seva is performed for (name, gothram, nakshatram, rasi), read safely from the saved JSON
function memberList(raw: unknown) {
  try {
    const a = JSON.parse(String(raw || '[]'));
    if (!Array.isArray(a)) return [];
    return a.slice(0, 30).map((m: any) => ({ title: cut(m?.title, 20), name: cut(m?.name, 120), gothram: cut(m?.gothram, 80), nakshathiram: cut(m?.nakshathiram, 80), rasi: cut(m?.rasi, 80), relation: cut(m?.relation, 60) }));
  } catch { return []; }
}
const dateOnly = (d: any) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : d ? String(d).slice(0, 10) : null);
const sevaRow = (r: any) => ({
  id: r.id, devotee_id: r.devotee_id, devotee_code: r.devotee_code || '', name: r.name || '', email: r.email, phone: r.phone, city: r.city, state: r.state,
  seva: r.seva, category: r.category, amount: money(r.amount), currency: r.currency || 'INR', status: r.status,
  seva_date: dateOnly(r.seva_date), receipt_no: r.receipt_no, order_id: r.order_id, payment_id: r.payment_id,
  members: memberList(r.members), paid_at: r.paid_at instanceof Date ? r.paid_at.toISOString() : r.paid_at,
});

router.get('/admin/seva/summary', async (req, res) => {
  try {
    const f = sevaFilters(req.query, true); // the figures follow the search words too
    if ('error' in f) return res.status(400).json({ message: f.error });
    // The same filters without the payment dates: used for the upcoming sevas, which are about the seva date, not the payment date
    const fa = sevaFilters({ ...req.query, from: '', to: '' }, false);
    if ('error' in fa) return res.status(400).json({ message: fa.error });
    const add = (w: { sql: string }, cond: string) => (w.sql ? `${w.sql} AND ${cond}` : `WHERE ${cond}`);
    const paidOnly = add(f, `s.status = 'PAID'`);
    const run = (sql: string, args: any[] = f.args) => db.query(sql, args).then((r: any) => r[0] as any[]);
    const from = one(req.query.from), to = one(req.query.to);

    // The period just before this one, of the same length
    let prev: Promise<any[]> | null = null;
    if (from && to && dayNum(to) >= dayNum(from)) {
      const len = dayNum(to) - dayNum(from) + 1;
      const pf = sevaFilters({ ...req.query, from: dayStr(dayNum(from) - len), to: dayStr(dayNum(from) - 1) }, true);
      if (!('error' in pf)) prev = run(`SELECT COUNT(*) n, COALESCE(SUM(s.amount),0) total FROM (${SEVA_ROWS}) s ${add(pf, `s.status = 'PAID'`)}`, pf.args);
    }

    const [matrix, daily, sevaTable, devotees, payers, repeat, options, states, ranges, activity, upcoming, follow, health, prevRows] = await Promise.all([
      run(`SELECT s.category, s.status, COUNT(*) n, COALESCE(SUM(s.amount),0) total FROM (${SEVA_ROWS}) s ${f.sql} GROUP BY s.category, s.status`),
      run(`SELECT DATE_FORMAT(s.paid_at,'%Y-%m-%d') d, s.category, COUNT(*) n, COALESCE(SUM(s.amount),0) total FROM (${SEVA_ROWS}) s ${paidOnly} GROUP BY d, s.category ORDER BY d`),
      // One line per seva: every attempt, how many were paid, and the money
      run(`SELECT s.seva, s.category, COUNT(*) n,
                  SUM(CASE WHEN s.status = 'PAID' THEN 1 ELSE 0 END) paid_n,
                  COALESCE(SUM(CASE WHEN s.status = 'PAID' THEN s.amount ELSE 0 END),0) paid_total,
                  SUM(CASE WHEN s.status = 'FAILED' THEN 1 ELSE 0 END) failed_n,
                  SUM(CASE WHEN s.status = 'PENDING' THEN 1 ELSE 0 END) pending_n
             FROM (${SEVA_ROWS}) s ${f.sql} GROUP BY s.seva, s.category ORDER BY paid_total DESC, n DESC LIMIT 25`),
      run(`SELECT s.devotee_id, MAX(s.name) name, MAX(s.phone) phone, COUNT(*) n, COALESCE(SUM(s.amount),0) total, MAX(s.paid_at) last_at
             FROM (${SEVA_ROWS}) s ${paidOnly} GROUP BY s.devotee_id ORDER BY total DESC LIMIT 8`),
      run(`SELECT COUNT(DISTINCT s.devotee_id) n FROM (${SEVA_ROWS}) s ${paidOnly}`),
      run(`SELECT COUNT(*) n FROM (SELECT s.devotee_id FROM (${SEVA_ROWS}) s ${paidOnly} GROUP BY s.devotee_id HAVING COUNT(*) > 1) r`),
      db.query('SELECT DISTINCT seva_title FROM seva_bookings ORDER BY seva_title LIMIT 300').then((r: any) => r[0] as any[]),
      run(`SELECT COALESCE(NULLIF(s.state,''), 'Not given') st, COUNT(*) n, COALESCE(SUM(s.amount),0) total FROM (${SEVA_ROWS}) s ${paidOnly} GROUP BY st ORDER BY total DESC LIMIT 8`),
      run(`SELECT CASE WHEN s.amount <= 500 THEN 1 WHEN s.amount <= 1000 THEN 2 WHEN s.amount <= 2500 THEN 3 WHEN s.amount <= 5000 THEN 4 ELSE 5 END b, COUNT(*) n, COALESCE(SUM(s.amount),0) total
             FROM (${SEVA_ROWS}) s ${paidOnly} GROUP BY b ORDER BY b`),
      run(`SELECT DAYOFWEEK(s.paid_at) - 1 w, FLOOR(HOUR(s.paid_at) / 4) b, COUNT(*) n FROM (${SEVA_ROWS}) s ${paidOnly} GROUP BY w, b`),
      run(`SELECT s.seva_date d, COUNT(*) n, COALESCE(SUM(s.amount),0) total FROM (${SEVA_ROWS}) s ${add(fa, `s.status = 'PAID' AND s.seva_date >= CURDATE()`)} GROUP BY d ORDER BY d LIMIT 8`, fa.args),
      run(`SELECT s.* FROM (${SEVA_ROWS}) s ${add(f, `s.status <> 'PAID'`)} ORDER BY s.paid_at DESC LIMIT 8`),
      run(`SELECT SUM(CASE WHEN s.status = 'PAID' AND (s.receipt_no IS NULL OR s.receipt_no = '') THEN 1 ELSE 0 END) no_receipt,
                  SUM(CASE WHEN s.status = 'PAID' AND (s.payment_id IS NULL OR s.payment_id = '') THEN 1 ELSE 0 END) no_payment_id,
                  SUM(CASE WHEN s.status = 'PENDING' AND s.paid_at < DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) stuck_pending
             FROM (${SEVA_ROWS}) s ${f.sql}`),
      prev ? prev : Promise.resolve([] as any[]),
    ]);

    const cell = (c: string, st: string) => { const r = matrix.find((x: any) => x.category === c && x.status === st); return { count: r ? Number(r.n) : 0, amount: r ? money(r.total) : 0 }; };
    const categories = CATEGORIES.map((c) => ({ category: c, paid: cell(c, 'PAID'), pending: cell(c, 'PENDING'), failed: cell(c, 'FAILED') }));
    const sum = (k: 'paid' | 'pending' | 'failed') => ({ count: categories.reduce((a, c) => a + c[k].count, 0), amount: money(categories.reduce((a, c) => a + c[k].amount, 0)) });
    const paid = sum('paid'), pending = sum('pending'), failed = sum('failed');
    const attempts = paid.count + pending.count + failed.count;
    const pv = prevRows[0] as any;
    const h = (health[0] || {}) as any;
    const RANGE_LABEL = ['Up to ₹500', '₹501 to ₹1,000', '₹1,001 to ₹2,500', '₹2,501 to ₹5,000', 'Above ₹5,000'];
    return res.json({
      paid, pending, failed,
      average: paid.count ? money(paid.amount / paid.count) : 0,
      successRate: attempts ? Math.round((paid.count / attempts) * 1000) / 10 : 0,
      payers: Number((payers[0] as any)?.n || 0), repeatDevotees: Number((repeat[0] as any)?.n || 0),
      previous: pv ? { count: Number(pv.n), amount: money(pv.total) } : null,
      categories,
      // rows of the same shape as the overview, with the category as the "source", so the same chart draws them
      daily: daily.map((r: any) => ({ day: r.d, source: r.category, count: Number(r.n), amount: money(r.total) })),
      sevaTable: sevaTable.map((r: any) => ({ seva: r.seva, category: r.category, bookings: Number(r.n), paid: Number(r.paid_n), amount: money(r.paid_total), failed: Number(r.failed_n), pending: Number(r.pending_n) })),
      top: sevaTable.filter((r: any) => Number(r.paid_n) > 0).slice(0, 8).map((r: any) => ({ seva: r.seva, category: r.category, count: Number(r.paid_n), amount: money(r.paid_total) })),
      devotees: devotees.map((r: any) => ({ devotee_id: r.devotee_id, name: r.name || '', phone: r.phone || '', count: Number(r.n), amount: money(r.total), last: r.last_at instanceof Date ? r.last_at.toISOString() : r.last_at })),
      states: states.map((r: any) => ({ state: r.st, count: Number(r.n), amount: money(r.total) })),
      ranges: RANGE_LABEL.map((label, i) => { const r = ranges.find((x: any) => Number(x.b) === i + 1); return { label, count: r ? Number(r.n) : 0, amount: r ? money(r.total) : 0 }; }),
      activity: activity.map((r: any) => ({ weekday: Number(r.w), block: Number(r.b), count: Number(r.n) })),
      upcoming: upcoming.map((r: any) => ({ date: dateOnly(r.d), count: Number(r.n), amount: money(r.total) })),
      followUps: follow.map((r: any) => { const x = sevaRow(r); return { id: x.id, devotee_id: x.devotee_id, name: x.name, phone: x.phone, seva: x.seva, category: x.category, amount: x.amount, status: x.status, paid_at: x.paid_at }; }),
      health: { paidNoReceipt: Number(h.no_receipt || 0), paidNoPaymentId: Number(h.no_payment_id || 0), stuckPending: Number(h.stuck_pending || 0) },
      sevas: options.map((r: any) => r.seva_title).filter(Boolean),
    });
  } catch (e: any) { return fail(res, e, 'Could not load the seva summary.'); }
});

router.get('/admin/seva/list', async (req, res) => {
  try {
    const f = sevaFilters(req.query);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const order = SEVA_SORT[one(req.query.sort)] || SEVA_SORT.date;
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 25));
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const [[cnt]]: any = await db.query(`SELECT COUNT(*) n FROM (${SEVA_ROWS}) s ${f.sql}`, f.args);
    const [rows]: any = await db.query(`SELECT s.* FROM (${SEVA_ROWS}) s ${f.sql} ORDER BY ${order} LIMIT ? OFFSET ?`, [...f.args, limit, (page - 1) * limit]);
    return res.json({ total: Number(cnt.n), page, limit, items: rows.map(sevaRow) });
  } catch (e: any) { return fail(res, e, 'Could not load the seva payments.'); }
});

router.get('/admin/seva/export', async (req, res) => {
  try {
    const f = sevaFilters(req.query);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const order = SEVA_SORT[one(req.query.sort)] || SEVA_SORT.date;
    const [rows]: any = await db.query(`SELECT s.* FROM (${SEVA_ROWS}) s ${f.sql} ORDER BY ${order} LIMIT 20000`, f.args);
    const head = ['Payment date', 'Devotee', 'Phone', 'Email', 'City', 'State', 'Seva', 'Category', 'Seva date', 'Amount (INR)', 'Status', 'Receipt no', 'Razorpay order id', 'Razorpay payment id (transaction id)', 'Sankalpam names'];
    const lines = [head.map(cell).join(',')];
    for (const raw of rows) {
      const r = sevaRow(raw);
      const names = r.members.map((m: any) => `${[m.title, m.name].filter(Boolean).join(' ')} (${[m.relation, m.gothram, m.nakshathiram, m.rasi].filter(Boolean).join('; ')})`).join(' | ');
      lines.push([raw.paid_at, r.name, r.phone, r.email, r.city, r.state, r.seva, r.category === 'corpus' ? 'Corpus' : 'Seva', r.seva_date, r.amount, r.status, r.receipt_no, r.order_id, r.payment_id, names].map(cell).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="seva-payments.csv"');
    return res.send('﻿' + lines.join('\r\n'));
  } catch (e: any) { return fail(res, e, 'Could not make the file.'); }
});

// =====================================================================================================
// Donation payments: every donation / corpus-fund gift with the donor, Razorpay ids and the names written.
// Categories come from the data (donation_booking.category: "corpus", "ashram", ...), so a new category just appears.
// PAN, Aadhaar and the payment signature are never sent: only "PAN given: yes / no" is shown.
// =====================================================================================================
const DON_ROWS = `
  SELECT b.id AS id, b.devotee_id AS devotee_id, v.devotee_code AS devotee_code,
         TRIM(CONCAT(COALESCE(v.first_name,''),' ',COALESCE(v.last_name,''))) AS name,
         v.email AS email, v.phone AS phone,
         COALESCE(NULLIF(b.donor_city,''), v.city) AS city, COALESCE(NULLIF(b.donor_state,''), v.state) AS state,
         b.donation_id AS fund_id, b.fund_title AS fund, COALESCE(NULLIF(b.category,''),'ashram') AS category,
         b.amount AS amount, b.currency AS currency,
         CASE b.status WHEN 'SUCCESS' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END AS status,
         b.booking_date AS donation_date, b.receipt_no AS receipt_no,
         b.razorpay_order_id AS order_id, b.razorpay_payment_id AS payment_id,
         CASE WHEN b.pan_number IS NULL OR b.pan_number = '' THEN 0 ELSE 1 END AS has_pan,
         b.family_members AS members, b.created_at AS paid_at
    FROM donation_booking b LEFT JOIN devotees v ON v.id = b.devotee_id`;
const DON_SORT: Record<string, string> = {
  date: 'd.paid_at DESC, d.id DESC', oldest: 'd.paid_at ASC, d.id ASC',
  amount_desc: 'CAST(d.amount AS DECIMAL(14,2)) DESC, d.id DESC', amount_asc: 'CAST(d.amount AS DECIMAL(14,2)) ASC, d.id DESC', name: 'd.name ASC, d.paid_at DESC',
};

function donFilters(q: Request['query'], withText = true) {
  const where: string[] = [];
  const args: any[] = [];
  const category = one(q.category);
  if (category) { if (!/^[A-Za-z0-9 _-]{1,50}$/.test(category)) return { error: 'Unknown category.' } as const; where.push('d.category = ?'); args.push(category); }
  const status = one(q.status).toUpperCase();
  if (status) { if (!(STATUSES as readonly string[]).includes(status)) return { error: 'Unknown status.' } as const; where.push('d.status = ?'); args.push(status); }
  const fund = one(q.fund).slice(0, 255);
  if (fund) { where.push('d.fund = ?'); args.push(fund); }
  const from = one(q.from), to = one(q.to);
  if (from) { if (!realDay(from)) return { error: 'The "from" date is not valid.' } as const; where.push('d.paid_at >= ?'); args.push(`${from} 00:00:00`); }
  if (to) { if (!realDay(to)) return { error: 'The "to" date is not valid.' } as const; where.push('d.paid_at < DATE_ADD(?, INTERVAL 1 DAY)'); args.push(`${to} 00:00:00`); }
  const text = withText ? one(q.q).slice(0, 80) : '';
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push('(d.name LIKE ? OR d.email LIKE ? OR d.phone LIKE ? OR d.devotee_id LIKE ? OR d.devotee_code LIKE ? OR d.fund LIKE ? OR d.receipt_no LIKE ? OR d.order_id LIKE ? OR d.payment_id LIKE ? OR d.members LIKE ?)');
    args.push(like, like, like, like, like, like, like, like, like, like);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', args } as const;
}

const donRow = (r: any) => ({
  id: r.id, devotee_id: r.devotee_id, devotee_code: r.devotee_code || '', name: r.name || '', email: r.email, phone: r.phone, city: r.city, state: r.state,
  fund: r.fund, category: r.category, amount: money(r.amount), currency: r.currency || 'INR', status: r.status,
  donation_date: dateOnly(r.donation_date), receipt_no: r.receipt_no, order_id: r.order_id, payment_id: r.payment_id,
  has_pan: Number(r.has_pan) === 1, members: memberList(r.members), paid_at: r.paid_at instanceof Date ? r.paid_at.toISOString() : r.paid_at,
});

router.get('/admin/donation/summary', async (req, res) => {
  try {
    const f = donFilters(req.query, true); // the figures follow the search words too
    if ('error' in f) return res.status(400).json({ message: f.error });
    const add = (w: { sql: string }, cond: string) => (w.sql ? `${w.sql} AND ${cond}` : `WHERE ${cond}`);
    const paidOnly = add(f, `d.status = 'PAID'`);
    const run = (sql: string, args: any[] = f.args) => db.query(sql, args).then((r: any) => r[0] as any[]);
    const from = one(req.query.from), to = one(req.query.to);

    let prev: Promise<any[]> | null = null;
    if (from && to && dayNum(to) >= dayNum(from)) {
      const len = dayNum(to) - dayNum(from) + 1;
      const pf = donFilters({ ...req.query, from: dayStr(dayNum(from) - len), to: dayStr(dayNum(from) - 1) }, true);
      if (!('error' in pf)) prev = run(`SELECT COUNT(*) n, COALESCE(SUM(d.amount),0) total FROM (${DON_ROWS}) d ${add(pf, `d.status = 'PAID'`)}`, pf.args);
    }

    const [matrix, daily, fundTable, donors, payers, repeat, options, states, cities, ranges, activity, follow, health, prevRows] = await Promise.all([
      run(`SELECT d.category, d.status, COUNT(*) n, COALESCE(SUM(d.amount),0) total FROM (${DON_ROWS}) d ${f.sql} GROUP BY d.category, d.status`),
      run(`SELECT DATE_FORMAT(d.paid_at,'%Y-%m-%d') dy, d.category, COUNT(*) n, COALESCE(SUM(d.amount),0) total FROM (${DON_ROWS}) d ${paidOnly} GROUP BY dy, d.category ORDER BY dy`),
      run(`SELECT d.fund, d.category, COUNT(*) n,
                  SUM(CASE WHEN d.status = 'PAID' THEN 1 ELSE 0 END) paid_n,
                  COALESCE(SUM(CASE WHEN d.status = 'PAID' THEN d.amount ELSE 0 END),0) paid_total,
                  SUM(CASE WHEN d.status = 'FAILED' THEN 1 ELSE 0 END) failed_n,
                  SUM(CASE WHEN d.status = 'PENDING' THEN 1 ELSE 0 END) pending_n
             FROM (${DON_ROWS}) d ${f.sql} GROUP BY d.fund, d.category ORDER BY paid_total DESC, n DESC LIMIT 25`),
      run(`SELECT d.devotee_id, MAX(d.name) name, MAX(d.phone) phone, COUNT(*) n, COALESCE(SUM(d.amount),0) total, MAX(d.paid_at) last_at
             FROM (${DON_ROWS}) d ${paidOnly} GROUP BY d.devotee_id ORDER BY total DESC LIMIT 8`),
      run(`SELECT COUNT(DISTINCT d.devotee_id) n FROM (${DON_ROWS}) d ${paidOnly}`),
      run(`SELECT COUNT(*) n FROM (SELECT d.devotee_id FROM (${DON_ROWS}) d ${paidOnly} GROUP BY d.devotee_id HAVING COUNT(*) > 1) r`),
      db.query(`SELECT DISTINCT fund_title, COALESCE(NULLIF(category,''),'ashram') category FROM donation_booking ORDER BY fund_title LIMIT 300`).then((r: any) => r[0] as any[]),
      run(`SELECT COALESCE(NULLIF(d.state,''), 'Not given') st, COUNT(*) n, COALESCE(SUM(d.amount),0) total FROM (${DON_ROWS}) d ${paidOnly} GROUP BY st ORDER BY total DESC LIMIT 8`),
      run(`SELECT COALESCE(NULLIF(d.city,''), 'Not given') ct, COUNT(*) n, COALESCE(SUM(d.amount),0) total FROM (${DON_ROWS}) d ${paidOnly} GROUP BY ct ORDER BY total DESC LIMIT 8`),
      run(`SELECT CASE WHEN d.amount <= 500 THEN 1 WHEN d.amount <= 1000 THEN 2 WHEN d.amount <= 2500 THEN 3 WHEN d.amount <= 5000 THEN 4 ELSE 5 END b, COUNT(*) n, COALESCE(SUM(d.amount),0) total
             FROM (${DON_ROWS}) d ${paidOnly} GROUP BY b ORDER BY b`),
      run(`SELECT DAYOFWEEK(d.paid_at) - 1 w, FLOOR(HOUR(d.paid_at) / 4) b, COUNT(*) n FROM (${DON_ROWS}) d ${paidOnly} GROUP BY w, b`),
      run(`SELECT d.* FROM (${DON_ROWS}) d ${add(f, `d.status <> 'PAID'`)} ORDER BY d.paid_at DESC LIMIT 8`),
      run(`SELECT SUM(CASE WHEN d.status = 'PAID' AND (d.receipt_no IS NULL OR d.receipt_no = '') THEN 1 ELSE 0 END) no_receipt,
                  SUM(CASE WHEN d.status = 'PAID' AND (d.payment_id IS NULL OR d.payment_id = '') THEN 1 ELSE 0 END) no_payment_id,
                  SUM(CASE WHEN d.status = 'PAID' AND d.has_pan = 0 THEN 1 ELSE 0 END) no_pan,
                  SUM(CASE WHEN d.status = 'PENDING' AND d.paid_at < DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) stuck_pending
             FROM (${DON_ROWS}) d ${f.sql}`),
      prev ? prev : Promise.resolve([] as any[]),
    ]);

    const cats = Array.from(new Set<string>([...matrix.map((r: any) => String(r.category)), ...options.map((r: any) => String(r.category))])).sort();
    const cell2 = (c: string, st: string) => { const r = matrix.find((x: any) => x.category === c && x.status === st); return { count: r ? Number(r.n) : 0, amount: r ? money(r.total) : 0 }; };
    const categories = cats.map((c) => ({ category: c, paid: cell2(c, 'PAID'), pending: cell2(c, 'PENDING'), failed: cell2(c, 'FAILED') }));
    const sum = (k: 'paid' | 'pending' | 'failed') => ({ count: categories.reduce((a, c) => a + c[k].count, 0), amount: money(categories.reduce((a, c) => a + c[k].amount, 0)) });
    const paid = sum('paid'), pending = sum('pending'), failed = sum('failed');
    const attempts = paid.count + pending.count + failed.count;
    const pv = prevRows[0] as any;
    const h = (health[0] || {}) as any;
    const RANGE_LABEL = ['Up to ₹500', '₹501 to ₹1,000', '₹1,001 to ₹2,500', '₹2,501 to ₹5,000', 'Above ₹5,000'];
    return res.json({
      paid, pending, failed,
      average: paid.count ? money(paid.amount / paid.count) : 0,
      successRate: attempts ? Math.round((paid.count / attempts) * 1000) / 10 : 0,
      payers: Number((payers[0] as any)?.n || 0), repeatDonors: Number((repeat[0] as any)?.n || 0),
      previous: pv ? { count: Number(pv.n), amount: money(pv.total) } : null,
      categories,
      daily: daily.map((r: any) => ({ day: r.dy, source: r.category, count: Number(r.n), amount: money(r.total) })),
      fundTable: fundTable.map((r: any) => ({ fund: r.fund, category: r.category, bookings: Number(r.n), paid: Number(r.paid_n), amount: money(r.paid_total), failed: Number(r.failed_n), pending: Number(r.pending_n) })),
      top: fundTable.filter((r: any) => Number(r.paid_n) > 0).slice(0, 8).map((r: any) => ({ fund: r.fund, category: r.category, count: Number(r.paid_n), amount: money(r.paid_total) })),
      donors: donors.map((r: any) => ({ devotee_id: r.devotee_id, name: r.name || '', phone: r.phone || '', count: Number(r.n), amount: money(r.total), last: r.last_at instanceof Date ? r.last_at.toISOString() : r.last_at })),
      states: states.map((r: any) => ({ state: r.st, count: Number(r.n), amount: money(r.total) })),
      cities: cities.map((r: any) => ({ city: r.ct, count: Number(r.n), amount: money(r.total) })),
      ranges: RANGE_LABEL.map((label, i) => { const r = ranges.find((x: any) => Number(x.b) === i + 1); return { label, count: r ? Number(r.n) : 0, amount: r ? money(r.total) : 0 }; }),
      activity: activity.map((r: any) => ({ weekday: Number(r.w), block: Number(r.b), count: Number(r.n) })),
      followUps: follow.map((r: any) => { const x = donRow(r); return { id: x.id, devotee_id: x.devotee_id, name: x.name, phone: x.phone, fund: x.fund, category: x.category, amount: x.amount, status: x.status, paid_at: x.paid_at }; }),
      health: { paidNoReceipt: Number(h.no_receipt || 0), paidNoPaymentId: Number(h.no_payment_id || 0), paidNoPan: Number(h.no_pan || 0), stuckPending: Number(h.stuck_pending || 0) },
      funds: options.map((r: any) => ({ fund: r.fund_title, category: r.category })).filter((r: any) => r.fund),
      categoryList: cats,
    });
  } catch (e: any) { return fail(res, e, 'Could not load the donation summary.'); }
});

router.get('/admin/donation/list', async (req, res) => {
  try {
    const f = donFilters(req.query);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const order = DON_SORT[one(req.query.sort)] || DON_SORT.date;
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 25));
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const [[cnt]]: any = await db.query(`SELECT COUNT(*) n FROM (${DON_ROWS}) d ${f.sql}`, f.args);
    const [rows]: any = await db.query(`SELECT d.* FROM (${DON_ROWS}) d ${f.sql} ORDER BY ${order} LIMIT ? OFFSET ?`, [...f.args, limit, (page - 1) * limit]);
    return res.json({ total: Number(cnt.n), page, limit, items: rows.map(donRow) });
  } catch (e: any) { return fail(res, e, 'Could not load the donation payments.'); }
});

router.get('/admin/donation/export', async (req, res) => {
  try {
    const f = donFilters(req.query);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const order = DON_SORT[one(req.query.sort)] || DON_SORT.date;
    const [rows]: any = await db.query(`SELECT d.* FROM (${DON_ROWS}) d ${f.sql} ORDER BY ${order} LIMIT 20000`, f.args);
    const head = ['Payment date', 'Donor', 'Phone', 'Email', 'City', 'State', 'Fund', 'Category', 'Donation date', 'Amount (INR)', 'Status', 'Receipt no', 'Razorpay order id', 'Razorpay payment id (transaction id)', 'PAN given', 'Names'];
    const lines = [head.map(cell).join(',')];
    for (const raw of rows) {
      const r = donRow(raw);
      const names = r.members.map((m: any) => `${[m.title, m.name].filter(Boolean).join(' ')} (${[m.relation, m.gothram, m.nakshathiram, m.rasi].filter(Boolean).join('; ')})`).join(' | ');
      lines.push([raw.paid_at, r.name, r.phone, r.email, r.city, r.state, r.fund, r.category, r.donation_date, r.amount, r.status, r.receipt_no, r.order_id, r.payment_id, r.has_pan ? 'Yes' : 'No', names].map(cell).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="donation-payments.csv"');
    return res.send('﻿' + lines.join('\r\n'));
  } catch (e: any) { return fail(res, e, 'Could not make the file.'); }
});

// =====================================================================================================
// Magazine payments: every subscription with the subscriber, plan, delivery address, dates and Razorpay ids.
// "status" is the payment (PAID / PENDING / FAILED). "membership" is the subscription itself (ACTIVE / EXPIRED).
// =====================================================================================================
const MAG_ROWS = `
  SELECT m.id AS id, m.devotee_id AS devotee_id, v.devotee_code AS devotee_code,
         TRIM(CONCAT(COALESCE(m.first_name,''),' ',COALESCE(m.last_name,''))) AS name,
         m.email AS email, m.phone AS phone, m.address AS address, m.city AS city, m.state AS state, m.pincode AS pincode,
         m.plan_id AS plan_id, m.plan_name AS plan, m.delivery AS delivery, m.duration_months AS months,
         m.amount AS amount, m.pay_account AS pay_account,
         CASE m.status WHEN 'ACTIVE' THEN 'PAID' WHEN 'EXPIRED' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END AS status,
         m.status AS membership, m.start_date AS start_date, m.end_date AS end_date,
         m.receipt_no AS receipt_no, m.razorpay_order_id AS order_id, m.razorpay_payment_id AS payment_id,
         COALESCE(NULLIF(m.payment_mode,''),'online') AS mode, m.reminder_30 AS r30, m.reminder_7 AS r7, m.created_at AS paid_at
    FROM magazine_subscriptions m
    LEFT JOIN devotees v ON CONVERT(v.id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(m.devotee_id USING utf8mb4) COLLATE utf8mb4_unicode_ci`;
const DELIVERIES = ['print', 'digital', 'both'] as const;
const MAG_SORT: Record<string, string> = {
  date: 'g.paid_at DESC, g.id DESC', oldest: 'g.paid_at ASC, g.id ASC',
  amount_desc: 'CAST(g.amount AS DECIMAL(14,2)) DESC, g.id DESC', amount_asc: 'CAST(g.amount AS DECIMAL(14,2)) ASC, g.id DESC', name: 'g.name ASC, g.paid_at DESC',
  ending: 'g.end_date ASC, g.id DESC',
};

function magFilters(q: Request['query'], withText = true) {
  const where: string[] = [];
  const args: any[] = [];
  const delivery = one(q.category);
  if (delivery) { if (!(DELIVERIES as readonly string[]).includes(delivery)) return { error: 'Unknown delivery type.' } as const; where.push('g.delivery = ?'); args.push(delivery); }
  const status = one(q.status).toUpperCase();
  if (status) { if (!(STATUSES as readonly string[]).includes(status)) return { error: 'Unknown status.' } as const; where.push('g.status = ?'); args.push(status); }
  const membership = one(q.membership).toUpperCase();
  if (membership) { if (!['ACTIVE', 'EXPIRED'].includes(membership)) return { error: 'Unknown subscription state.' } as const; where.push('g.membership = ?'); args.push(membership); }
  const mode = one(q.mode).toLowerCase();
  if (mode) { if (!/^[a-z]{1,10}$/.test(mode)) return { error: 'Unknown payment mode.' } as const; where.push('g.mode = ?'); args.push(mode); }
  const plan = one(q.plan).slice(0, 255);
  if (plan) { where.push('g.plan = ?'); args.push(plan); }
  const from = one(q.from), to = one(q.to);
  if (from) { if (!realDay(from)) return { error: 'The "from" date is not valid.' } as const; where.push('g.paid_at >= ?'); args.push(`${from} 00:00:00`); }
  if (to) { if (!realDay(to)) return { error: 'The "to" date is not valid.' } as const; where.push('g.paid_at < DATE_ADD(?, INTERVAL 1 DAY)'); args.push(`${to} 00:00:00`); }
  const text = withText ? one(q.q).slice(0, 80) : '';
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push('(g.name LIKE ? OR g.email LIKE ? OR g.phone LIKE ? OR g.devotee_id LIKE ? OR g.devotee_code LIKE ? OR g.plan LIKE ? OR g.receipt_no LIKE ? OR g.order_id LIKE ? OR g.payment_id LIKE ? OR g.pincode LIKE ? OR g.city LIKE ?)');
    args.push(like, like, like, like, like, like, like, like, like, like, like);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', args } as const;
}

const magRow = (r: any) => ({
  id: r.id, devotee_id: r.devotee_id, devotee_code: r.devotee_code || '', name: r.name || '', email: r.email, phone: r.phone,
  address: r.address, city: r.city, state: r.state, pincode: r.pincode,
  plan: r.plan, delivery: r.delivery, months: Number(r.months) || 0, amount: money(r.amount), pay_account: r.pay_account,
  status: r.status, membership: r.membership, start_date: dateOnly(r.start_date), end_date: dateOnly(r.end_date),
  receipt_no: r.receipt_no, order_id: r.order_id, payment_id: r.payment_id, mode: r.mode,
  reminder_30: Number(r.r30) === 1, reminder_7: Number(r.r7) === 1,
  paid_at: r.paid_at instanceof Date ? r.paid_at.toISOString() : r.paid_at,
});

router.get('/admin/magazine/summary', async (req, res) => {
  try {
    const f = magFilters(req.query, true); // the figures follow the search words too
    if ('error' in f) return res.status(400).json({ message: f.error });
    // The same filters without the payment dates: the subscription figures are about the subscription dates, not the payment dates
    const fa = magFilters({ ...req.query, from: '', to: '' }, false);
    if ('error' in fa) return res.status(400).json({ message: fa.error });
    const add = (w: { sql: string }, cond: string) => (w.sql ? `${w.sql} AND ${cond}` : `WHERE ${cond}`);
    const paidOnly = add(f, `g.status = 'PAID'`);
    const run = (sql: string, args: any[] = f.args) => db.query(sql, args).then((r: any) => r[0] as any[]);
    const from = one(req.query.from), to = one(req.query.to);

    let prev: Promise<any[]> | null = null;
    if (from && to && dayNum(to) >= dayNum(from)) {
      const len = dayNum(to) - dayNum(from) + 1;
      const pf = magFilters({ ...req.query, from: dayStr(dayNum(from) - len), to: dayStr(dayNum(from) - 1) }, true);
      if (!('error' in pf)) prev = run(`SELECT COUNT(*) n, COALESCE(SUM(g.amount),0) total FROM (${MAG_ROWS}) g ${add(pf, `g.status = 'PAID'`)}`, pf.args);
    }

    const [matrix, daily, planTable, subs, payers, repeat, options, states, cities, months, modes, activity, expiring, follow, health, live, prevRows] = await Promise.all([
      run(`SELECT g.delivery, g.status, COUNT(*) n, COALESCE(SUM(g.amount),0) total FROM (${MAG_ROWS}) g ${f.sql} GROUP BY g.delivery, g.status`),
      run(`SELECT DATE_FORMAT(g.paid_at,'%Y-%m-%d') dy, g.delivery, COUNT(*) n, COALESCE(SUM(g.amount),0) total FROM (${MAG_ROWS}) g ${paidOnly} GROUP BY dy, g.delivery ORDER BY dy`),
      run(`SELECT g.plan, g.delivery, COUNT(*) n,
                  SUM(CASE WHEN g.status = 'PAID' THEN 1 ELSE 0 END) paid_n,
                  COALESCE(SUM(CASE WHEN g.status = 'PAID' THEN g.amount ELSE 0 END),0) paid_total,
                  SUM(CASE WHEN g.status = 'FAILED' THEN 1 ELSE 0 END) failed_n,
                  SUM(CASE WHEN g.status = 'PENDING' THEN 1 ELSE 0 END) pending_n
             FROM (${MAG_ROWS}) g ${f.sql} GROUP BY g.plan, g.delivery ORDER BY paid_total DESC, n DESC LIMIT 25`),
      run(`SELECT g.devotee_id, MAX(g.name) name, MAX(g.phone) phone, COUNT(*) n, COALESCE(SUM(g.amount),0) total, MAX(g.paid_at) last_at
             FROM (${MAG_ROWS}) g ${paidOnly} GROUP BY g.devotee_id ORDER BY total DESC LIMIT 8`),
      run(`SELECT COUNT(DISTINCT g.devotee_id) n FROM (${MAG_ROWS}) g ${paidOnly}`),
      run(`SELECT COUNT(*) n FROM (SELECT g.devotee_id FROM (${MAG_ROWS}) g ${paidOnly} GROUP BY g.devotee_id HAVING COUNT(*) > 1) r`),
      db.query('SELECT DISTINCT plan_name FROM magazine_subscriptions ORDER BY plan_name LIMIT 100').then((r: any) => r[0] as any[]),
      run(`SELECT COALESCE(NULLIF(g.state,''), 'Not given') st, COUNT(*) n, COALESCE(SUM(g.amount),0) total FROM (${MAG_ROWS}) g ${paidOnly} GROUP BY st ORDER BY total DESC LIMIT 8`),
      run(`SELECT COALESCE(NULLIF(g.city,''), 'Not given') ct, COUNT(*) n, COALESCE(SUM(g.amount),0) total FROM (${MAG_ROWS}) g ${paidOnly} GROUP BY ct ORDER BY total DESC LIMIT 8`),
      run(`SELECT g.months m, COUNT(*) n, COALESCE(SUM(g.amount),0) total FROM (${MAG_ROWS}) g ${paidOnly} GROUP BY g.months ORDER BY g.months`),
      run(`SELECT g.mode, COUNT(*) n, COALESCE(SUM(g.amount),0) total FROM (${MAG_ROWS}) g ${paidOnly} GROUP BY g.mode`),
      run(`SELECT DAYOFWEEK(g.paid_at) - 1 w, FLOOR(HOUR(g.paid_at) / 4) b, COUNT(*) n FROM (${MAG_ROWS}) g ${paidOnly} GROUP BY w, b`),
      // Active subscriptions that end within 30 days: the people to ask to renew
      run(`SELECT g.* FROM (${MAG_ROWS}) g ${add(fa, `g.membership = 'ACTIVE' AND g.end_date >= CURDATE() AND g.end_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`)} ORDER BY g.end_date ASC LIMIT 10`, fa.args),
      run(`SELECT g.* FROM (${MAG_ROWS}) g ${add(f, `g.status <> 'PAID'`)} ORDER BY g.paid_at DESC LIMIT 8`),
      run(`SELECT SUM(CASE WHEN g.status = 'PAID' AND (g.receipt_no IS NULL OR g.receipt_no = '') THEN 1 ELSE 0 END) no_receipt,
                  SUM(CASE WHEN g.status = 'PAID' AND g.mode = 'online' AND (g.payment_id IS NULL OR g.payment_id = '') THEN 1 ELSE 0 END) no_payment_id,
                  SUM(CASE WHEN g.status = 'PAID' AND g.delivery <> 'digital' AND (g.address IS NULL OR g.address = '' OR g.pincode IS NULL OR g.pincode = '') THEN 1 ELSE 0 END) no_address,
                  SUM(CASE WHEN g.membership = 'ACTIVE' AND g.end_date < CURDATE() THEN 1 ELSE 0 END) lapsed,
                  SUM(CASE WHEN g.status = 'PENDING' AND g.paid_at < DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) stuck_pending
             FROM (${MAG_ROWS}) g ${f.sql}`),
      run(`SELECT SUM(CASE WHEN g.membership = 'ACTIVE' AND g.end_date >= CURDATE() THEN 1 ELSE 0 END) active_n,
                  SUM(CASE WHEN g.membership = 'EXPIRED' OR (g.membership = 'ACTIVE' AND g.end_date < CURDATE()) THEN 1 ELSE 0 END) expired_n,
                  SUM(CASE WHEN g.membership = 'ACTIVE' AND g.end_date >= CURDATE() AND g.end_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) ending_n,
                  SUM(CASE WHEN g.membership = 'ACTIVE' AND g.end_date >= CURDATE() AND g.delivery <> 'digital' THEN 1 ELSE 0 END) print_n
             FROM (${MAG_ROWS}) g ${fa.sql}`, fa.args),
      prev ? prev : Promise.resolve([] as any[]),
    ]);

    const cell2 = (c: string, st: string) => { const r = matrix.find((x: any) => x.delivery === c && x.status === st); return { count: r ? Number(r.n) : 0, amount: r ? money(r.total) : 0 }; };
    const categories = DELIVERIES.map((c) => ({ category: c, paid: cell2(c, 'PAID'), pending: cell2(c, 'PENDING'), failed: cell2(c, 'FAILED') }));
    const sum = (k: 'paid' | 'pending' | 'failed') => ({ count: categories.reduce((a, c) => a + c[k].count, 0), amount: money(categories.reduce((a, c) => a + c[k].amount, 0)) });
    const paid = sum('paid'), pending = sum('pending'), failed = sum('failed');
    const attempts = paid.count + pending.count + failed.count;
    const pv = prevRows[0] as any;
    const h = (health[0] || {}) as any;
    const l = (live[0] || {}) as any;
    return res.json({
      paid, pending, failed,
      average: paid.count ? money(paid.amount / paid.count) : 0,
      successRate: attempts ? Math.round((paid.count / attempts) * 1000) / 10 : 0,
      payers: Number((payers[0] as any)?.n || 0), repeatSubscribers: Number((repeat[0] as any)?.n || 0),
      previous: pv ? { count: Number(pv.n), amount: money(pv.total) } : null,
      subscriptions: { active: Number(l.active_n || 0), expired: Number(l.expired_n || 0), endingSoon: Number(l.ending_n || 0), toPost: Number(l.print_n || 0) },
      categories,
      daily: daily.map((r: any) => ({ day: r.dy, source: r.delivery, count: Number(r.n), amount: money(r.total) })),
      planTable: planTable.map((r: any) => ({ plan: r.plan, category: r.delivery, bookings: Number(r.n), paid: Number(r.paid_n), amount: money(r.paid_total), failed: Number(r.failed_n), pending: Number(r.pending_n) })),
      top: planTable.filter((r: any) => Number(r.paid_n) > 0).slice(0, 8).map((r: any) => ({ plan: r.plan, category: r.delivery, count: Number(r.paid_n), amount: money(r.paid_total) })),
      subscribers: subs.map((r: any) => ({ devotee_id: r.devotee_id, name: r.name || '', phone: r.phone || '', count: Number(r.n), amount: money(r.total), last: r.last_at instanceof Date ? r.last_at.toISOString() : r.last_at })),
      states: states.map((r: any) => ({ state: r.st, count: Number(r.n), amount: money(r.total) })),
      cities: cities.map((r: any) => ({ city: r.ct, count: Number(r.n), amount: money(r.total) })),
      durations: months.map((r: any) => ({ months: Number(r.m), count: Number(r.n), amount: money(r.total) })),
      modes: modes.map((r: any) => ({ mode: r.mode, count: Number(r.n), amount: money(r.total) })),
      activity: activity.map((r: any) => ({ weekday: Number(r.w), block: Number(r.b), count: Number(r.n) })),
      expiring: expiring.map((r: any) => { const x = magRow(r); return { id: x.id, devotee_id: x.devotee_id, name: x.name, phone: x.phone, email: x.email, plan: x.plan, end_date: x.end_date, amount: x.amount }; }),
      followUps: follow.map((r: any) => { const x = magRow(r); return { id: x.id, devotee_id: x.devotee_id, name: x.name, phone: x.phone, plan: x.plan, category: x.delivery, amount: x.amount, status: x.status, paid_at: x.paid_at }; }),
      health: { paidNoReceipt: Number(h.no_receipt || 0), paidNoPaymentId: Number(h.no_payment_id || 0), printNoAddress: Number(h.no_address || 0), lapsed: Number(h.lapsed || 0), stuckPending: Number(h.stuck_pending || 0) },
      plans: options.map((r: any) => r.plan_name).filter(Boolean),
    });
  } catch (e: any) { return fail(res, e, 'Could not load the magazine summary.'); }
});

router.get('/admin/magazine/list', async (req, res) => {
  try {
    const f = magFilters(req.query);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const order = MAG_SORT[one(req.query.sort)] || MAG_SORT.date;
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 25));
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const [[cnt]]: any = await db.query(`SELECT COUNT(*) n FROM (${MAG_ROWS}) g ${f.sql}`, f.args);
    const [rows]: any = await db.query(`SELECT g.* FROM (${MAG_ROWS}) g ${f.sql} ORDER BY ${order} LIMIT ? OFFSET ?`, [...f.args, limit, (page - 1) * limit]);
    return res.json({ total: Number(cnt.n), page, limit, items: rows.map(magRow) });
  } catch (e: any) { return fail(res, e, 'Could not load the magazine payments.'); }
});

router.get('/admin/magazine/export', async (req, res) => {
  try {
    const f = magFilters(req.query);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const order = MAG_SORT[one(req.query.sort)] || MAG_SORT.date;
    const [rows]: any = await db.query(`SELECT g.* FROM (${MAG_ROWS}) g ${f.sql} ORDER BY ${order} LIMIT 20000`, f.args);
    const head = ['Payment date', 'Subscriber', 'Phone', 'Email', 'Address', 'City', 'State', 'Pincode', 'Plan', 'Delivery', 'Months', 'Start date', 'End date', 'Amount (INR)', 'Payment status', 'Subscription', 'Mode', 'Receipt no', 'Razorpay order id', 'Razorpay payment id (transaction id)'];
    const lines = [head.map(cell).join(',')];
    for (const raw of rows) {
      const r = magRow(raw);
      lines.push([raw.paid_at, r.name, r.phone, r.email, r.address, r.city, r.state, r.pincode, r.plan, r.delivery, r.months, r.start_date, r.end_date, r.amount, r.status, r.membership, r.mode, r.receipt_no, r.order_id, r.payment_id].map(cell).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="magazine-payments.csv"');
    return res.send('﻿' + lines.join('\r\n'));
  } catch (e: any) { return fail(res, e, 'Could not make the file.'); }
});

// =====================================================================================================
// Camp payments: every camp fee with the registrant, the camp, how many people, and the Razorpay ids.
// Only registrations that carry a fee are listed (free camps have no payment). Category = when the camp is:
// "upcoming" (not started), "ongoing", "past". Aadhaar, ID documents and photos are never read here.
// =====================================================================================================
const CAMP_ROWS = `
  SELECT r.id AS id, r.devotee_id AS devotee_id, v.devotee_code AS devotee_code,
         COALESCE(NULLIF(TRIM(CONCAT(COALESCE(r.first_name,''),' ',COALESCE(r.last_name,''))),''), NULLIF(r.name,''),
                  TRIM(CONCAT(COALESCE(v.first_name,''),' ',COALESCE(v.last_name,'')))) AS name,
         COALESCE(NULLIF(r.email,''), v.email) AS email, COALESCE(NULLIF(r.phone,''), v.phone) AS phone,
         COALESCE(NULLIF(r.city,''), v.city) AS city, COALESCE(NULLIF(r.state,''), v.state) AS state,
         r.camp_id AS camp_id, COALESCE(cm.title_en, 'Camp') AS camp,
         cm.start_date AS camp_start, cm.end_date AS camp_end,
         CASE WHEN cm.start_date IS NOT NULL AND cm.start_date > CURDATE() THEN 'upcoming'
              WHEN cm.end_date IS NOT NULL AND cm.end_date >= CURDATE() THEN 'ongoing'
              ELSE 'past' END AS category,
         r.adults AS adults, r.children AS children, r.members AS people,
         r.amount AS amount,
         CASE r.payment_status WHEN 'PAID' THEN 'PAID' WHEN 'FAILED' THEN 'FAILED' ELSE 'PENDING' END AS status,
         r.status AS registration, r.razorpay_order_id AS order_id, r.razorpay_payment_id AS payment_id, r.created_at AS paid_at
    FROM camp_registrations r LEFT JOIN camps cm ON cm.id = r.camp_id LEFT JOIN devotees v ON v.id = r.devotee_id
   WHERE r.amount > 0 AND r.payment_status <> 'NONE'`;
const CAMP_CATEGORIES = ['upcoming', 'ongoing', 'past'] as const;
const CAMP_SORT: Record<string, string> = {
  date: 'k.paid_at DESC, k.id DESC', oldest: 'k.paid_at ASC, k.id ASC',
  amount_desc: 'CAST(k.amount AS DECIMAL(14,2)) DESC, k.id DESC', amount_asc: 'CAST(k.amount AS DECIMAL(14,2)) ASC, k.id DESC', name: 'k.name ASC, k.paid_at DESC',
};

function campFilters(q: Request['query'], withText = true) {
  const where: string[] = [];
  const args: any[] = [];
  const category = one(q.category);
  if (category) { if (!(CAMP_CATEGORIES as readonly string[]).includes(category)) return { error: 'Unknown category.' } as const; where.push('k.category = ?'); args.push(category); }
  const status = one(q.status).toUpperCase();
  if (status) { if (!(STATUSES as readonly string[]).includes(status)) return { error: 'Unknown status.' } as const; where.push('k.status = ?'); args.push(status); }
  const camp = one(q.camp).slice(0, 255);
  if (camp) { where.push('k.camp = ?'); args.push(camp); }
  const from = one(q.from), to = one(q.to);
  if (from) { if (!realDay(from)) return { error: 'The "from" date is not valid.' } as const; where.push('k.paid_at >= ?'); args.push(`${from} 00:00:00`); }
  if (to) { if (!realDay(to)) return { error: 'The "to" date is not valid.' } as const; where.push('k.paid_at < DATE_ADD(?, INTERVAL 1 DAY)'); args.push(`${to} 00:00:00`); }
  const text = withText ? one(q.q).slice(0, 80) : '';
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push('(k.name LIKE ? OR k.email LIKE ? OR k.phone LIKE ? OR k.devotee_id LIKE ? OR k.devotee_code LIKE ? OR k.camp LIKE ? OR k.order_id LIKE ? OR k.payment_id LIKE ?)');
    args.push(like, like, like, like, like, like, like, like);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', args } as const;
}

const campRow = (r: any) => ({
  id: r.id, devotee_id: r.devotee_id, devotee_code: r.devotee_code || '', name: r.name || '', email: r.email, phone: r.phone, city: r.city, state: r.state,
  camp: r.camp, category: r.category, camp_start: dateOnly(r.camp_start), camp_end: dateOnly(r.camp_end),
  adults: Number(r.adults) || 0, children: Number(r.children) || 0, people: Number(r.people) || 0,
  amount: money(r.amount), currency: 'INR', status: r.status, registration: r.registration,
  order_id: r.order_id, payment_id: r.payment_id, paid_at: r.paid_at instanceof Date ? r.paid_at.toISOString() : r.paid_at,
});

router.get('/admin/camp/summary', async (req, res) => {
  try {
    const f = campFilters(req.query, true); // the figures follow the search words too
    if ('error' in f) return res.status(400).json({ message: f.error });
    // The same filters without the payment dates: used for the camps ahead, which are about the camp date, not the payment date
    const fa = campFilters({ ...req.query, from: '', to: '' }, true);
    if ('error' in fa) return res.status(400).json({ message: fa.error });
    const add = (w: { sql: string }, cond: string) => (w.sql ? `${w.sql} AND ${cond}` : `WHERE ${cond}`);
    const paidOnly = add(f, `k.status = 'PAID'`);
    const run = (sql: string, args: any[] = f.args) => db.query(sql, args).then((r: any) => r[0] as any[]);
    const from = one(req.query.from), to = one(req.query.to);

    let prev: Promise<any[]> | null = null;
    if (from && to && dayNum(to) >= dayNum(from)) {
      const len = dayNum(to) - dayNum(from) + 1;
      const pf = campFilters({ ...req.query, from: dayStr(dayNum(from) - len), to: dayStr(dayNum(from) - 1) }, true);
      if (!('error' in pf)) prev = run(`SELECT COUNT(*) n, COALESCE(SUM(k.amount),0) total FROM (${CAMP_ROWS}) k ${add(pf, `k.status = 'PAID'`)}`, pf.args);
    }

    const [matrix, daily, campTable, devotees, payers, repeat, options, states, ranges, activity, ahead, follow, health, people, prevRows] = await Promise.all([
      run(`SELECT k.category, k.status, COUNT(*) n, COALESCE(SUM(k.amount),0) total FROM (${CAMP_ROWS}) k ${f.sql} GROUP BY k.category, k.status`),
      run(`SELECT DATE_FORMAT(k.paid_at,'%Y-%m-%d') d, k.category, COUNT(*) n, COALESCE(SUM(k.amount),0) total FROM (${CAMP_ROWS}) k ${paidOnly} GROUP BY d, k.category ORDER BY d`),
      // One line per camp: every attempt, how many were paid, the money and the people
      run(`SELECT k.camp, k.category, MAX(k.camp_start) camp_start, COUNT(*) n,
                  SUM(CASE WHEN k.status = 'PAID' THEN 1 ELSE 0 END) paid_n,
                  COALESCE(SUM(CASE WHEN k.status = 'PAID' THEN k.amount ELSE 0 END),0) paid_total,
                  COALESCE(SUM(CASE WHEN k.status = 'PAID' THEN k.people ELSE 0 END),0) paid_people,
                  SUM(CASE WHEN k.status = 'FAILED' THEN 1 ELSE 0 END) failed_n,
                  SUM(CASE WHEN k.status = 'PENDING' THEN 1 ELSE 0 END) pending_n
             FROM (${CAMP_ROWS}) k ${f.sql} GROUP BY k.camp, k.category ORDER BY paid_total DESC, n DESC LIMIT 25`),
      run(`SELECT k.devotee_id, MAX(k.name) name, MAX(k.phone) phone, COUNT(*) n, COALESCE(SUM(k.amount),0) total, MAX(k.paid_at) last_at
             FROM (${CAMP_ROWS}) k ${paidOnly} GROUP BY k.devotee_id ORDER BY total DESC LIMIT 8`),
      run(`SELECT COUNT(DISTINCT k.devotee_id) n FROM (${CAMP_ROWS}) k ${paidOnly}`),
      run(`SELECT COUNT(*) n FROM (SELECT k.devotee_id FROM (${CAMP_ROWS}) k ${paidOnly} GROUP BY k.devotee_id HAVING COUNT(*) > 1) r`),
      db.query(`SELECT DISTINCT COALESCE(cm.title_en, 'Camp') AS title FROM camp_registrations r LEFT JOIN camps cm ON cm.id = r.camp_id WHERE r.amount > 0 AND r.payment_status <> 'NONE' ORDER BY title LIMIT 300`).then((r: any) => r[0] as any[]),
      run(`SELECT COALESCE(NULLIF(k.state,''), 'Not given') st, COUNT(*) n, COALESCE(SUM(k.amount),0) total FROM (${CAMP_ROWS}) k ${paidOnly} GROUP BY st ORDER BY total DESC LIMIT 8`),
      run(`SELECT CASE WHEN k.amount <= 500 THEN 1 WHEN k.amount <= 1000 THEN 2 WHEN k.amount <= 2500 THEN 3 WHEN k.amount <= 5000 THEN 4 ELSE 5 END b, COUNT(*) n, COALESCE(SUM(k.amount),0) total
             FROM (${CAMP_ROWS}) k ${paidOnly} GROUP BY b ORDER BY b`),
      run(`SELECT DAYOFWEEK(k.paid_at) - 1 w, FLOOR(HOUR(k.paid_at) / 4) b, COUNT(*) n FROM (${CAMP_ROWS}) k ${paidOnly} GROUP BY w, b`),
      // Camps that have not ended yet, with the paid registrations and people so far
      run(`SELECT k.camp, MAX(k.camp_start) camp_start, MAX(k.camp_end) camp_end, COUNT(*) n, COALESCE(SUM(k.people),0) people, COALESCE(SUM(k.amount),0) total
             FROM (${CAMP_ROWS}) k ${add(fa, `k.status = 'PAID' AND k.category IN ('upcoming','ongoing') AND k.registration <> 'CANCELLED'`)}
             GROUP BY k.camp ORDER BY camp_start ASC LIMIT 8`, fa.args),
      run(`SELECT k.* FROM (${CAMP_ROWS}) k ${add(f, `k.status <> 'PAID'`)} ORDER BY k.paid_at DESC LIMIT 8`),
      run(`SELECT SUM(CASE WHEN k.status = 'PAID' AND (k.payment_id IS NULL OR k.payment_id = '') THEN 1 ELSE 0 END) no_payment_id,
                  SUM(CASE WHEN k.status = 'PAID' AND k.registration = 'CANCELLED' THEN 1 ELSE 0 END) paid_cancelled,
                  SUM(CASE WHEN k.status = 'PAID' AND k.registration <> 'REGISTERED' AND k.registration <> 'CANCELLED' THEN 1 ELSE 0 END) paid_not_registered,
                  SUM(CASE WHEN k.status = 'PENDING' AND k.paid_at < DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) stuck_pending
             FROM (${CAMP_ROWS}) k ${f.sql}`),
      run(`SELECT COALESCE(SUM(k.people),0) people, COALESCE(SUM(k.adults),0) adults, COALESCE(SUM(k.children),0) children FROM (${CAMP_ROWS}) k ${paidOnly}`),
      prev ? prev : Promise.resolve([] as any[]),
    ]);

    const cellOf = (c: string, st: string) => { const r = matrix.find((x: any) => x.category === c && x.status === st); return { count: r ? Number(r.n) : 0, amount: r ? money(r.total) : 0 }; };
    const categories = CAMP_CATEGORIES.map((c) => ({ category: c, paid: cellOf(c, 'PAID'), pending: cellOf(c, 'PENDING'), failed: cellOf(c, 'FAILED') }));
    const sum = (k: 'paid' | 'pending' | 'failed') => ({ count: categories.reduce((a, c) => a + c[k].count, 0), amount: money(categories.reduce((a, c) => a + c[k].amount, 0)) });
    const paid = sum('paid'), pending = sum('pending'), failed = sum('failed');
    const attempts = paid.count + pending.count + failed.count;
    const pv = prevRows[0] as any;
    const h = (health[0] || {}) as any;
    const pp = (people[0] || {}) as any;
    const RANGE_LABEL = ['Up to ₹500', '₹501 to ₹1,000', '₹1,001 to ₹2,500', '₹2,501 to ₹5,000', 'Above ₹5,000'];
    return res.json({
      paid, pending, failed,
      average: paid.count ? money(paid.amount / paid.count) : 0,
      successRate: attempts ? Math.round((paid.count / attempts) * 1000) / 10 : 0,
      payers: Number((payers[0] as any)?.n || 0), repeatDevotees: Number((repeat[0] as any)?.n || 0),
      people: { total: Number(pp.people || 0), adults: Number(pp.adults || 0), children: Number(pp.children || 0) },
      previous: pv ? { count: Number(pv.n), amount: money(pv.total) } : null,
      categories,
      daily: daily.map((r: any) => ({ day: r.d, source: r.category, count: Number(r.n), amount: money(r.total) })),
      campTable: campTable.map((r: any) => ({ camp: r.camp, category: r.category, start: dateOnly(r.camp_start), registrations: Number(r.n), paid: Number(r.paid_n), amount: money(r.paid_total), people: Number(r.paid_people), failed: Number(r.failed_n), pending: Number(r.pending_n) })),
      top: campTable.filter((r: any) => Number(r.paid_n) > 0).slice(0, 8).map((r: any) => ({ camp: r.camp, category: r.category, count: Number(r.paid_n), people: Number(r.paid_people), amount: money(r.paid_total) })),
      devotees: devotees.map((r: any) => ({ devotee_id: r.devotee_id, name: r.name || '', phone: r.phone || '', count: Number(r.n), amount: money(r.total), last: r.last_at instanceof Date ? r.last_at.toISOString() : r.last_at })),
      states: states.map((r: any) => ({ state: r.st, count: Number(r.n), amount: money(r.total) })),
      ranges: RANGE_LABEL.map((label, i) => { const r = ranges.find((x: any) => Number(x.b) === i + 1); return { label, count: r ? Number(r.n) : 0, amount: r ? money(r.total) : 0 }; }),
      activity: activity.map((r: any) => ({ weekday: Number(r.w), block: Number(r.b), count: Number(r.n) })),
      ahead: ahead.map((r: any) => ({ camp: r.camp, start: dateOnly(r.camp_start), end: dateOnly(r.camp_end), count: Number(r.n), people: Number(r.people), amount: money(r.total) })),
      followUps: follow.map((r: any) => { const x = campRow(r); return { id: x.id, devotee_id: x.devotee_id, name: x.name, phone: x.phone, camp: x.camp, category: x.category, amount: x.amount, status: x.status, paid_at: x.paid_at }; }),
      health: { paidNoPaymentId: Number(h.no_payment_id || 0), paidCancelled: Number(h.paid_cancelled || 0), paidNotRegistered: Number(h.paid_not_registered || 0), stuckPending: Number(h.stuck_pending || 0) },
      camps: options.map((r: any) => r.title).filter(Boolean),
    });
  } catch (e: any) { return fail(res, e, 'Could not load the camp summary.'); }
});

router.get('/admin/camp/list', async (req, res) => {
  try {
    const f = campFilters(req.query);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const order = CAMP_SORT[one(req.query.sort)] || CAMP_SORT.date;
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 25));
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const [[cnt]]: any = await db.query(`SELECT COUNT(*) n FROM (${CAMP_ROWS}) k ${f.sql}`, f.args);
    const [rows]: any = await db.query(`SELECT k.* FROM (${CAMP_ROWS}) k ${f.sql} ORDER BY ${order} LIMIT ? OFFSET ?`, [...f.args, limit, (page - 1) * limit]);
    return res.json({ total: Number(cnt.n), page, limit, items: rows.map(campRow) });
  } catch (e: any) { return fail(res, e, 'Could not load the camp payments.'); }
});

router.get('/admin/camp/export', async (req, res) => {
  try {
    const f = campFilters(req.query);
    if ('error' in f) return res.status(400).json({ message: f.error });
    const order = CAMP_SORT[one(req.query.sort)] || CAMP_SORT.date;
    const [rows]: any = await db.query(`SELECT k.* FROM (${CAMP_ROWS}) k ${f.sql} ORDER BY ${order} LIMIT 20000`, f.args);
    const head = ['Payment date', 'Registrant', 'Phone', 'Email', 'City', 'State', 'Camp', 'When', 'Camp start', 'Camp end', 'People', 'Adults', 'Children', 'Amount (INR)', 'Payment status', 'Registration', 'Razorpay order id', 'Razorpay payment id (transaction id)'];
    const lines = [head.map(cell).join(',')];
    for (const raw of rows) {
      const r = campRow(raw);
      lines.push([raw.paid_at, r.name, r.phone, r.email, r.city, r.state, r.camp, r.category, r.camp_start, r.camp_end, r.people, r.adults, r.children, r.amount, r.status, r.registration, r.order_id, r.payment_id].map(cell).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="camp-payments.csv"');
    return res.send('﻿' + lines.join('\r\n'));
  } catch (e: any) { return fail(res, e, 'Could not make the file.'); }
});

export default router;