import { Router, Request, Response, NextFunction } from 'express';
import { execFile } from 'child_process';
import { format } from 'util';
import os from 'os';
import { db } from '../dbLimit';
import { staffFrom, SUPER } from '../middleware/roleAccess';
import { withManual, sqlFor } from './registers';
import type { Kind } from './registers';

// Dashboards for the general manager (gm), the admin and the developer.
// Mount in index.ts, after the roleAccess line:  app.use('/api/v1/dashboards', dashboardsRouter);
// Each endpoint opens only for a super admin or a login that was given that dashboard page on the Users page.
const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

const guard = (slug: string) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const s = await staffFrom(req);
    if (!s) return res.status(401).json({ message: 'Please sign in again.' });
    if (!SUPER.includes(s.role) && !(s.pages || []).includes(slug)) return res.status(403).json({ message: 'Your login does not have access to this page.' });
    (req as any).staff = s;
    return next();
  } catch (e: any) {
    console.error('Dashboard access check error:', e?.message || e);
    return res.status(503).json({ message: 'Could not check your access. Please try again.' });
  }
};

// ---------- Recent server errors, kept in memory for the developer dashboard ----------
type LogLine = { at: string; level: 'error' | 'warn'; text: string };
const LOG: LogLine[] = [];
const clean = (t: string) => t.replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***').replace(/(password|secret|token)=\S+/gi, '$1=***').slice(0, 500);
for (const level of ['error', 'warn'] as const) {
  const orig = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    try { LOG.push({ at: new Date().toISOString(), level, text: clean(format(...args)) }); if (LOG.length > 80) LOG.shift(); } catch { /* never break logging */ }
    orig(...args);
  };
}

// ---------- A short memory so a dashboard that is opened often does not use up the shared database connections ----------
const CACHE = new Map<string, { at: number; data: any }>();
async function cached(key: string, fresh: boolean, build: () => Promise<any>): Promise<any> {
  const hit = CACHE.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age < (fresh ? 10_000 : 45_000)) return hit.data;
  const data = await build();
  CACHE.set(key, { at: Date.now(), data });
  return data;
}

const KINDS: Kind[] = ['seva', 'donation', 'magazine', 'camp'];
const n = (v: unknown) => Number(v) || 0;
const OK = `r.status IN ('PAID','FREE')`;
// How the money came in: on-site entries by the mode typed at the counter, online ones by their gateway mode or plainly "online"
const MODE = `CASE WHEN r.source='manual' THEN COALESCE(NULLIF(LOWER(r.mode),''),'cash') WHEN r.mode IS NOT NULL AND r.mode <> '' THEN LOWER(r.mode) ELSE 'online' END`;
const IST = `DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE)`;
const MONTH = `DATE_FORMAT(r.paid_at,'%Y%m') = DATE_FORMAT(CURDATE(),'%Y%m')`;
const TODAY = `DATE(r.paid_at) = CURDATE()`;
// The financial year starts on 1 April
const fyStart = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04-01`; };

async function none<T>(p: Promise<T>, fallback: T, what: string): Promise<T> {
  try { return await p; } catch (e: any) { console.error(`Dashboard: ${what} failed:`, e?.sqlMessage || e?.message || e); return fallback; }
}

// Totals for one register (online and on-site entries together)
async function kindTotals(kind: Kind) {
  const { value } = await withManual(kind, async (ctx) => {
    const sql = sqlFor(kind, ctx);
    const [[t]]: any = await db.query(
      `SELECT
         COALESCE(SUM(${OK} AND ${TODAY}),0) today_n, COALESCE(SUM(IF(${OK} AND ${TODAY}, r.amount, 0)),0) today_amt,
         COALESCE(SUM(${OK} AND ${TODAY} AND r.source='manual'),0) today_off_n, COALESCE(SUM(IF(${OK} AND ${TODAY} AND r.source='manual', r.amount, 0)),0) today_off_amt,
         COALESCE(SUM(${OK} AND ${MONTH}),0) month_n, COALESCE(SUM(IF(${OK} AND ${MONTH}, r.amount, 0)),0) month_amt,
         COALESCE(SUM(${OK} AND ${MONTH} AND r.source='manual'),0) month_off_n, COALESCE(SUM(IF(${OK} AND ${MONTH} AND r.source='manual', r.amount, 0)),0) month_off_amt,
         COALESCE(SUM(${OK} AND r.paid_at >= ?),0) year_n, COALESCE(SUM(IF(${OK} AND r.paid_at >= ?, r.amount, 0)),0) year_amt,
         COALESCE(SUM(r.status='PENDING' AND r.paid_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)),0) pending_n,
         COALESCE(SUM(r.status='FAILED' AND r.paid_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)),0) failed_n,
         COALESCE(SUM(r.status='CANCELLED' AND r.paid_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)),0) cancelled_n,
         COALESCE(SUM(${OK} AND r.event_date >= CURDATE() AND r.event_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)),0) next7_n,
         COALESCE(SUM(${OK} AND r.event_date >= CURDATE()),0) upcoming_n,
         COALESCE(SUM(r.membership='ACTIVE' AND r.end_date >= CURDATE() AND r.end_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)),0) expiring_n,
         COALESCE(SUM(r.membership='ACTIVE'),0) active_n,
         COALESCE(SUM(IF(${OK} AND ${MONTH}, COALESCE(r.adults,0) + COALESCE(r.children,0), 0)),0) people_month
       FROM (${sql}) r`,
      [fyStart(), fyStart()]
    );
    const [days]: any = await db.query(
      `SELECT DATE_FORMAT(r.paid_at,'%Y-%m-%d') d, COUNT(*) c, COALESCE(SUM(r.amount),0) a
         FROM (${sql}) r WHERE ${OK} AND r.paid_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) GROUP BY DATE_FORMAT(r.paid_at,'%Y-%m-%d')`
    );
    const top: any = kind === 'seva' || kind === 'donation' || kind === 'camp'
      ? (await db.query(
          `SELECT r.item item, COUNT(*) c, COALESCE(SUM(r.amount),0) a FROM (${sql}) r
            WHERE ${OK} AND ${MONTH} AND r.item IS NOT NULL AND r.item <> '' GROUP BY r.item ORDER BY a DESC, c DESC LIMIT 5`
        ))[0]
      : [];
    const [modes]: any = await db.query(
      `SELECT ${MODE} m, COUNT(*) c, COALESCE(SUM(r.amount),0) a FROM (${sql}) r WHERE ${OK} AND ${MONTH} GROUP BY m ORDER BY a DESC`
    );
    return { t, days, top, modes };
  });
  const t = value.t || {};
  return {
    kind,
    today: { n: n(t.today_n), amount: n(t.today_amt), offline_n: n(t.today_off_n), offline_amount: n(t.today_off_amt) },
    month: { n: n(t.month_n), amount: n(t.month_amt), offline_n: n(t.month_off_n), offline_amount: n(t.month_off_amt) },
    year: { n: n(t.year_n), amount: n(t.year_amt) },
    pending: n(t.pending_n), failed: n(t.failed_n), cancelled: n(t.cancelled_n),
    next7: n(t.next7_n), upcoming: n(t.upcoming_n), expiring: n(t.expiring_n), active: n(t.active_n),
    days: (value.days as any[]).map((d) => ({ d: String(d.d), n: n(d.c), amount: n(d.a) })),
    top: (value.top as any[]).map((x) => ({ item: String(x.item), n: n(x.c), amount: n(x.a) })),
    people_month: n(t.people_month),
    modes: (value.modes as any[]).map((x) => ({ mode: String(x.m), n: n(x.c), amount: n(x.a) })),
  };
}

// The last 14 days with zeros filled in, summed across the registers
function fillDays(list: Awaited<ReturnType<typeof kindTotals>>[]) {
  const out: { d: string; amount: number; n: number; by: Record<string, number> }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const row = { d: key, amount: 0, n: 0, by: {} as Record<string, number> };
    for (const k of list) {
      const hit = k.days.find((d) => d.d === key);
      row.by[k.kind] = hit ? hit.amount : 0;
      if (hit) { row.amount += hit.amount; row.n += hit.n; }
    }
    out.push(row);
  }
  return out;
}

const sum = (list: Awaited<ReturnType<typeof kindTotals>>[], f: (k: Awaited<ReturnType<typeof kindTotals>>) => number) => list.reduce((a, k) => a + f(k), 0);

async function allKinds() {
  // One after another, so a dashboard never opens more than a few database connections at once
  const out: Awaited<ReturnType<typeof kindTotals>>[] = [];
  for (const k of KINDS) {
    out.push(await none(kindTotals(k), {
      kind: k, today: { n: 0, amount: 0, offline_n: 0, offline_amount: 0 }, month: { n: 0, amount: 0, offline_n: 0, offline_amount: 0 }, year: { n: 0, amount: 0 },
      pending: 0, failed: 0, cancelled: 0, next7: 0, upcoming: 0, expiring: 0, active: 0, days: [], top: [], people_month: 0, modes: [],
    }, `${k} totals`));
  }
  return out;
}

async function devoteeCounts() {
  return none((async () => {
    const [[r]]: any = await db.query(`SELECT COUNT(*) total, COALESCE(SUM(created_at >= DATE_FORMAT(CURDATE(),'%Y-%m-01')),0) month, COALESCE(SUM(DATE(created_at) = CURDATE()),0) today FROM devotees`);
    return { total: n(r?.total), month: n(r?.month), today: n(r?.today) };
  })(), { total: 0, month: 0, today: 0 }, 'devotee counts');
}


// ---------- Point of sale (the shop): its tables are made when a POS page is first opened, so this is empty until then ----------
const EMPTY_POS = {
  today: { bills: 0, total: 0 }, month: { bills: 0, total: 0, cancelled: 0 }, year: { bills: 0, total: 0 },
  profit_month: 0, purchases_month: 0, stock_value: 0, low_count: 0, modes: [] as { mode: string; bills: number; total: number }[], top: [] as { name: string; qty: number; amount: number }[],
  available: false,
};
async function posBlock(): Promise<typeof EMPTY_POS> {
  const [has]: any = await db.query(`SHOW TABLES LIKE 'pos_sales'`);
  if (!has?.length) return EMPTY_POS;
  const D = `DATE(s.sale_date) = DATE(${IST})`;
  const M = `DATE_FORMAT(s.sale_date,'%Y-%m') = DATE_FORMAT(${IST},'%Y-%m')`;
  const [[t]]: any = await db.query(
    `SELECT COALESCE(SUM(s.status='ACTIVE' AND ${D}),0) tn, COALESCE(SUM(IF(s.status='ACTIVE' AND ${D}, s.total, 0)),0) ta,
            COALESCE(SUM(s.status='ACTIVE' AND ${M}),0) mn, COALESCE(SUM(IF(s.status='ACTIVE' AND ${M}, s.total, 0)),0) ma,
            COALESCE(SUM(IF(s.status='ACTIVE' AND ${M}, s.gst_total, 0)),0) mg, COALESCE(SUM(s.status='CANCELLED' AND ${M}),0) mc,
            COALESCE(SUM(s.status='ACTIVE' AND s.sale_date >= ?),0) yn, COALESCE(SUM(IF(s.status='ACTIVE' AND s.sale_date >= ?, s.total, 0)),0) ya
       FROM pos_sales s`, [fyStart(), fyStart()]
  );
  const [[c]]: any = await db.query(
    `SELECT COALESCE(SUM(l.qty * l.cost),0) c FROM pos_sale_lines l JOIN pos_sales s ON s.id = l.sale_id WHERE s.status='ACTIVE' AND ${M}`
  );
  const [[p]]: any = await db.query(
    `SELECT COALESCE(SUM(p.total),0) t FROM pos_purchases p WHERE p.status='ACTIVE' AND DATE_FORMAT(p.purchase_date,'%Y-%m') = DATE_FORMAT(${IST},'%Y-%m')`
  );
  const [modes]: any = await db.query(`SELECT s.pay_mode m, COUNT(*) c, COALESCE(SUM(s.total),0) a FROM pos_sales s WHERE s.status='ACTIVE' AND ${M} GROUP BY s.pay_mode ORDER BY a DESC`);
  const [top]: any = await db.query(
    `SELECT l.name, SUM(l.qty) q, SUM(l.amount) a FROM pos_sale_lines l JOIN pos_sales s ON s.id = l.sale_id WHERE s.status='ACTIVE' AND ${M} GROUP BY l.item_id, l.name ORDER BY a DESC LIMIT 5`
  );
  let stockValue = 0, lowCount = 0;
  try {
    const J = 'LEFT JOIN (SELECT item_id, SUM(qty) q FROM pos_stock_moves GROUP BY item_id) s ON s.item_id = i.id';
    const [[v]]: any = await db.query(`SELECT COALESCE(SUM(GREATEST(COALESCE(s.q,0),0) * i.cost),0) v FROM pos_items i ${J} WHERE i.active = 1 AND i.track_stock = 1`);
    const [[l]]: any = await db.query(`SELECT COUNT(*) n FROM pos_items i ${J} WHERE i.active = 1 AND i.track_stock = 1 AND COALESCE(s.q,0) <= i.reorder_level`);
    stockValue = n(v?.v); lowCount = n(l?.n);
  } catch { /* the stock tables are not there yet */ }
  const total = n(t.ma), gst = n(t.mg);
  return {
    today: { bills: n(t.tn), total: n(t.ta) }, month: { bills: n(t.mn), total: total, cancelled: n(t.mc) }, year: { bills: n(t.yn), total: n(t.ya) },
    profit_month: Math.round((total - gst - n(c?.c)) * 100) / 100, purchases_month: n(p?.t), stock_value: Math.round(stockValue), low_count: lowCount,
    modes: (modes as any[]).map((x) => ({ mode: String(x.m), bills: n(x.c), total: n(x.a) })),
    top: (top as any[]).map((x) => ({ name: String(x.name), qty: n(x.q), amount: n(x.a) })),
    available: true,
  };
}

// ---------- Devotee details: counts only (names and numbers are in the Devotee pages and the download) ----------
async function devoteeDetails() {
  const [[r]]: any = await db.query(
    `SELECT COUNT(*) total, COALESCE(SUM(created_at >= DATE_FORMAT(CURDATE(),'%Y-%m-01')),0) month, COALESCE(SUM(DATE(created_at) = CURDATE()),0) today,
            COALESCE(SUM(phone IS NOT NULL AND phone <> ''),0) with_phone, COALESCE(SUM(email IS NOT NULL AND email <> ''),0) with_email FROM devotees`
  );
  const [cities]: any = await db.query(`SELECT TRIM(city) c, COUNT(*) n FROM devotees WHERE city IS NOT NULL AND TRIM(city) <> '' GROUP BY TRIM(city) ORDER BY n DESC LIMIT 5`);
  const [states]: any = await db.query(`SELECT TRIM(state) c, COUNT(*) n FROM devotees WHERE state IS NOT NULL AND TRIM(state) <> '' GROUP BY TRIM(state) ORDER BY n DESC LIMIT 5`);
  return {
    total: n(r?.total), month: n(r?.month), today: n(r?.today), with_phone: n(r?.with_phone), with_email: n(r?.with_email),
    cities: (cities as any[]).map((x) => ({ name: String(x.c), n: n(x.n) })), states: (states as any[]).map((x) => ({ name: String(x.c), n: n(x.n) })),
  };
}

// ---------- General manager: money and the money-making registers ----------
router.get('/gm', guard('dashboard-gm'), async (req: Request, res: Response) => {
  try {
    const data = await cached('gm', req.query.fresh === '1', async () => {
      const kinds = await allKinds();
      const devotees = await devoteeCounts();
      const pos = await none(posBlock(), EMPTY_POS, 'point of sale totals');
      const details = await none(devoteeDetails(), { total: 0, month: 0, today: 0, with_phone: 0, with_email: 0, cities: [], states: [] }, 'devotee details');
      // The month's money by how it was paid, across the four registers
      const modeSum = new Map<string, { mode: string; n: number; amount: number; by: Record<string, number> }>();
      for (const k of kinds) for (const m of k.modes) {
        const cur = modeSum.get(m.mode) || { mode: m.mode, n: 0, amount: 0, by: {} };
        cur.n += m.n; cur.amount += m.amount; cur.by[k.kind] = (cur.by[k.kind] || 0) + m.amount; modeSum.set(m.mode, cur);
      }
      return {
        generated_at: new Date().toISOString(),
        financial_year_start: fyStart(),
        pos, details,
        payment_modes: Array.from(modeSum.values()).sort((a, b) => b.amount - a.amount),
        totals: {
          today: { n: sum(kinds, (k) => k.today.n), amount: sum(kinds, (k) => k.today.amount), offline_amount: sum(kinds, (k) => k.today.offline_amount) },
          month: { n: sum(kinds, (k) => k.month.n), amount: sum(kinds, (k) => k.month.amount), offline_amount: sum(kinds, (k) => k.month.offline_amount) },
          year: { n: sum(kinds, (k) => k.year.n), amount: sum(kinds, (k) => k.year.amount) },
        },
        kinds: kinds.map(({ days, ...k }) => k),
        days: fillDays(kinds),
        devotees,
      };
    });
    return res.json(data);
  } catch (e: any) {
    console.error('GM dashboard error:', e?.sqlMessage || e?.message || e);
    return res.status(500).json({ message: 'Could not load the dashboard.' });
  }
});


// ---------- GM reports: the figures for a period, as data. The page turns them into an Excel file. ----------
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const goodDay = (v: unknown) => { const t = String(v || ''); return DAY.test(t) && !Number.isNaN(Date.parse(`${t}T00:00:00Z`)) ? t : ''; };
const PARTS = ['summary', 'transactions', 'registrations', 'pos', 'devotees'] as const;
const CAP = 15000;

router.get('/gm/report', guard('dashboard-gm'), async (req: Request, res: Response) => {
  try {
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    const to = goodDay(req.query.to) || today;
    const from = goodDay(req.query.from) || `${to.slice(0, 8)}01`;
    if (from > to) return res.status(400).json({ message: 'The start date is after the end date.' });
    const asked = String(req.query.parts || 'summary').split(',').map((x) => x.trim());
    const parts = PARTS.filter((p) => asked.includes(p));
    if (!parts.length) return res.status(400).json({ message: 'Choose what to download.' });
    const RANGE = `DATE(r.paid_at) BETWEEN ? AND ?`;
    const out: any = { generated_at: new Date().toISOString(), from, to, parts, truncated: [] as string[] };

    // Entries of the four registers (online and on-site) in the period; the transactions and registrations sheets both come from them
    const wantEntries = parts.includes('transactions') || parts.includes('registrations');
    const entries: any[] = [];
    const perKind: any[] = [];
    if (wantEntries || parts.includes('summary')) {
      for (const kind of KINDS) {
        await none((async () => {
          const { value } = await withManual(kind, async (ctx) => {
            const sql = sqlFor(kind, ctx);
            const [[t]]: any = await db.query(
              `SELECT COALESCE(SUM(${OK}),0) n, COALESCE(SUM(IF(${OK}, r.amount, 0)),0) amt,
                      COALESCE(SUM(${OK} AND r.source='manual'),0) off_n, COALESCE(SUM(IF(${OK} AND r.source='manual', r.amount, 0)),0) off_amt,
                      COALESCE(SUM(r.status='PENDING'),0) pending, COALESCE(SUM(r.status='FAILED'),0) failed, COALESCE(SUM(r.status='CANCELLED'),0) cancelled
                 FROM (${sql}) r WHERE ${RANGE}`, [from, to]);
            const [modes]: any = await db.query(
              `SELECT ${MODE} m, COUNT(*) c, COALESCE(SUM(r.amount),0) a FROM (${sql}) r WHERE ${OK} AND ${RANGE} GROUP BY m ORDER BY a DESC`, [from, to]);
            let rows: any[] = [];
            if (wantEntries) {
              [rows] = await db.query(
                `SELECT r.source, DATE_FORMAT(r.paid_at,'%Y-%m-%d %H:%i:%s') paid_at, CAST(r.event_date AS CHAR) event_date, CAST(r.end_date AS CHAR) end_date,
                        r.receipt_no, r.devotee_id, r.name, r.phone, r.email, r.city, r.state, r.address, r.pincode, r.item, r.category, r.amount,
                        ${MODE} mode, r.status, r.payment_ref, r.adults, r.children, r.months, r.membership, r.notes
                   FROM (${sql}) r WHERE ${RANGE} ORDER BY r.paid_at DESC LIMIT ${CAP + 1}`, [from, to]);
            }
            return { t, modes, rows };
          });
          perKind.push({
            kind, entries: n(value.t.n), amount: n(value.t.amt), offline_entries: n(value.t.off_n), offline_amount: n(value.t.off_amt),
            pending: n(value.t.pending), failed: n(value.t.failed), cancelled: n(value.t.cancelled),
            modes: (value.modes as any[]).map((x) => ({ mode: String(x.m), n: n(x.c), amount: n(x.a) })),
          });
          if (value.rows.length > CAP) out.truncated.push(`${kind} register (first ${CAP} rows)`);
          for (const r of (value.rows as any[]).slice(0, CAP)) entries.push({ register: kind, ...r, amount: n(r.amount) });
        })(), undefined, `${kind} report`);
      }
      entries.sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)));
    }
    if (parts.includes('transactions')) out.transactions = entries;
    if (parts.includes('registrations')) out.registrations = entries.filter((e) => e.status !== 'FAILED');

    // Point of sale: sales, items sold and purchases in the period
    if (parts.includes('pos') || parts.includes('summary')) {
      out.pos = await none((async () => {
        const [has]: any = await db.query(`SHOW TABLES LIKE 'pos_sales'`);
        if (!has?.length) return { available: false, summary: null, sales: [], items: [], purchases: [] };
        const W = `s.status = 'ACTIVE' AND DATE(s.sale_date) BETWEEN ? AND ?`;
        const [[sum]]: any = await db.query(`SELECT COUNT(*) bills, COALESCE(SUM(s.subtotal),0) subtotal, COALESCE(SUM(s.discount),0) discount, COALESCE(SUM(s.gst_total),0) gst, COALESCE(SUM(s.total),0) total FROM pos_sales s WHERE ${W}`, [from, to]);
        const [[cost]]: any = await db.query(`SELECT COALESCE(SUM(l.qty * l.cost),0) c FROM pos_sale_lines l JOIN pos_sales s ON s.id = l.sale_id WHERE ${W}`, [from, to]);
        const [[pur]]: any = await db.query(`SELECT COALESCE(SUM(p.total),0) t, COUNT(*) b FROM pos_purchases p WHERE p.status = 'ACTIVE' AND p.purchase_date BETWEEN ? AND ?`, [from, to]);
        const [modes]: any = await db.query(`SELECT s.pay_mode m, COUNT(*) c, COALESCE(SUM(s.total),0) a FROM pos_sales s WHERE ${W} GROUP BY s.pay_mode ORDER BY a DESC`, [from, to]);
        const total = n(sum.total), gst = n(sum.gst);
        const summary = { bills: n(sum.bills), subtotal: n(sum.subtotal), discount: n(sum.discount), gst, total, cost: n(cost.c), profit: Math.round((total - gst - n(cost.c)) * 100) / 100, purchases: n(pur.t), purchase_bills: n(pur.b), modes: (modes as any[]).map((x) => ({ mode: String(x.m), bills: n(x.c), total: n(x.a) })) };
        if (!parts.includes('pos')) return { available: true, summary, sales: [], items: [], purchases: [] };
        const [sales]: any = await db.query(
          `SELECT s.bill_no, DATE_FORMAT(s.sale_date,'%Y-%m-%d %H:%i:%s') sale_date, s.customer_name, s.phone, s.subtotal, s.discount, s.gst_total, s.total, s.pay_mode, s.pay_ref, s.status, s.created_by
             FROM pos_sales s WHERE DATE(s.sale_date) BETWEEN ? AND ? ORDER BY s.sale_date DESC, s.id DESC LIMIT ${CAP + 1}`, [from, to]);
        const [items]: any = await db.query(
          `SELECT l.name, l.unit, SUM(l.qty) qty, SUM(l.amount) amount, SUM(l.qty * l.cost) cost FROM pos_sale_lines l JOIN pos_sales s ON s.id = l.sale_id WHERE ${W} GROUP BY l.item_id, l.name, l.unit ORDER BY amount DESC LIMIT 1000`, [from, to]);
        const [purchases]: any = await db.query(
          `SELECT p.bill_no, DATE_FORMAT(p.purchase_date,'%Y-%m-%d') purchase_date, su.name supplier, p.supplier_bill, p.total, p.status FROM pos_purchases p LEFT JOIN pos_suppliers su ON su.id = p.supplier_id
            WHERE p.purchase_date BETWEEN ? AND ? ORDER BY p.purchase_date DESC, p.id DESC LIMIT ${CAP}`, [from, to]);
        if (sales.length > CAP) out.truncated.push(`POS sales (first ${CAP} rows)`);
        return {
          available: true, summary,
          sales: (sales as any[]).slice(0, CAP).map((r) => ({ ...r, subtotal: n(r.subtotal), discount: n(r.discount), gst_total: n(r.gst_total), total: n(r.total) })),
          items: (items as any[]).map((r) => ({ name: String(r.name), unit: String(r.unit), qty: n(r.qty), amount: n(r.amount), profit: Math.round((n(r.amount) - n(r.cost)) * 100) / 100 })),
          purchases: (purchases as any[]).map((r) => ({ ...r, total: n(r.total) })),
        };
      })(), { available: false, summary: null, sales: [], items: [], purchases: [] }, 'POS report');
    }

    // Devotees registered in the period (no identity numbers, passwords or one-time codes)
    if (parts.includes('devotees') || parts.includes('summary')) {
      const [[c]]: any = await db.query(`SELECT COUNT(*) n FROM devotees WHERE DATE(created_at) BETWEEN ? AND ?`, [from, to]);
      out.devotee_count = n(c?.n);
      if (parts.includes('devotees')) {
        const [cols]: any = await db.query(`SHOW COLUMNS FROM devotees`);
        const have = new Set((cols as any[]).map((x) => String(x.Field)));
        const want = ['devotee_code', 'id', 'first_name', 'last_name', 'phone', 'email', 'residency', 'comm_address', 'city', 'state'].filter((x) => have.has(x));
        const [rows]: any = await db.query(
          `SELECT ${want.map((x) => `\`${x}\``).join(', ')}, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') created_at FROM devotees WHERE DATE(created_at) BETWEEN ? AND ? ORDER BY created_at DESC LIMIT ${CAP + 1}`, [from, to]);
        if (rows.length > CAP) out.truncated.push(`devotees (first ${CAP} rows)`);
        out.devotees = (rows as any[]).slice(0, CAP);
      }
    }

    if (parts.includes('summary')) {
      const order = new Map(KINDS.map((k, i) => [k as string, i]));
      out.kinds = perKind.sort((a, b) => (order.get(a.kind) ?? 0) - (order.get(b.kind) ?? 0));
    }
    console.log(`[Report] ${(req as any).staff?.email} downloaded ${parts.join(', ')} for ${from} to ${to}`);
    return res.json(out);
  } catch (e: any) {
    console.error('GM report error:', e?.sqlMessage || e?.message || e);
    return res.status(500).json({ message: 'Could not make the report.' });
  }
});

// ---------- Admin: what is happening at the counters, and what needs attention ----------
router.get('/admin', guard('dashboard-admin'), async (req: Request, res: Response) => {
  try {
    const data = await cached('admin', req.query.fresh === '1', async () => {
      const kinds = await allKinds();
      const devotees = await devoteeCounts();

      // Who entered what at the counters today
      const counters = await none((async () => {
        const [rows]: any = await db.query(
          `SELECT created_by, kind, COUNT(*) c, COALESCE(SUM(amount),0) a FROM register_manual_entries
            WHERE entry_date = CURDATE() AND status = 'ACTIVE' GROUP BY created_by, kind`
        );
        let names = new Map<string, string>();
        try {
          const [u]: any = await db.query(`SELECT id, full_name, email FROM users`);
          names = new Map((u as any[]).map((x) => [String(x.id), String(x.full_name || x.email || x.id)]));
        } catch { /* show the stored value */ }
        const by = new Map<string, { who: string; n: number; amount: number; kinds: Record<string, number> }>();
        for (const r of rows as any[]) {
          const key = String(r.created_by ?? '');
          const cur = by.get(key) || { who: names.get(key) || key || 'Unknown', n: 0, amount: 0, kinds: {} };
          cur.n += n(r.c); cur.amount += n(r.a); cur.kinds[String(r.kind)] = (cur.kinds[String(r.kind)] || 0) + n(r.c);
          by.set(key, cur);
        }
        return Array.from(by.values()).sort((a, b) => b.n - a.n).slice(0, 12);
      })(), [] as any[], 'counter entries');

      // The latest entries across the four registers
      const recent: any[] = [];
      for (const k of KINDS) {
        const rows = await none((async () => {
          const { value } = await withManual(k, async (ctx) => (await db.query(
            `SELECT r.id, r.source, r.name, r.item, r.amount, r.status, r.receipt_no, DATE_FORMAT(r.paid_at,'%Y-%m-%d %H:%i') at
               FROM (${sqlFor(k, ctx)}) r ORDER BY r.paid_at DESC LIMIT 6`
          ))[0]);
          return value as any[];
        })(), [] as any[], `${k} latest entries`);
        for (const r of rows) recent.push({ kind: k, id: String(r.id), source: String(r.source), name: String(r.name || ''), item: String(r.item || ''), amount: n(r.amount), status: String(r.status), receipt_no: r.receipt_no ? String(r.receipt_no) : '', at: String(r.at || '') });
      }
      recent.sort((a, b) => b.at.localeCompare(a.at));

      const staff = await none((async () => {
        const [rows]: any = await db.query(`SELECT role, COUNT(*) c, COALESCE(SUM(is_active = 1),0) active FROM users GROUP BY role`);
        return (rows as any[]).filter((r) => String(r.role) !== 'devotee').map((r) => ({ role: String(r.role), n: n(r.c), active: n(r.active) }));
      })(), [] as any[], 'staff counts');

      return {
        generated_at: new Date().toISOString(),
        kinds: kinds.map(({ days, top, ...k }) => k),
        today: { n: sum(kinds, (k) => k.today.n), amount: sum(kinds, (k) => k.today.amount), offline_n: sum(kinds, (k) => k.today.offline_n), offline_amount: sum(kinds, (k) => k.today.offline_amount) },
        attention: {
          pending: sum(kinds, (k) => k.pending), failed: sum(kinds, (k) => k.failed), cancelled: sum(kinds, (k) => k.cancelled),
          magazine_expiring: kinds.find((k) => k.kind === 'magazine')?.expiring || 0,
        },
        next7: sum(kinds, (k) => k.next7),
        counters, recent: recent.slice(0, 12), staff, devotees,
      };
    });
    return res.json(data);
  } catch (e: any) {
    console.error('Admin dashboard error:', e?.sqlMessage || e?.message || e);
    return res.status(500).json({ message: 'Could not load the dashboard.' });
  }
});

// ---------- Developer: is the server and the database healthy ----------
const git = (args: string[]) => new Promise<string>((resolve) => {
  execFile('git', args, { timeout: 3000, cwd: process.cwd() }, (err, out) => resolve(err ? '' : String(out).trim()));
});

router.get('/developer', guard('dashboard-developer'), async (req: Request, res: Response) => {
  try {
    const data = await cached('developer', req.query.fresh === '1', async () => {
      const t0 = Date.now();
      let dbOk = true, dbError = '', dbVersion = '';
      try { const [v]: any = await db.query('SELECT VERSION() v'); dbVersion = String(v?.[0]?.v || ''); } catch (e: any) { dbOk = false; dbError = String(e?.code || e?.message || e).slice(0, 200); }
      const dbMs = Date.now() - t0;

      const tables = dbOk ? await none((async () => {
        const [rows]: any = await db.query(
          `SELECT TABLE_NAME name, TABLE_ROWS r, ROUND((DATA_LENGTH + INDEX_LENGTH) / 1048576, 1) mb FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_ROWS DESC LIMIT 15`
        );
        return (rows as any[]).map((x) => ({ name: String(x.name), rows: n(x.r), mb: n(x.mb) }));
      })(), [] as any[], 'table sizes') : [];

      const threads = dbOk ? await none((async () => {
        const [rows]: any = await db.query(`SHOW STATUS WHERE Variable_name IN ('Threads_connected','Threads_running','Uptime')`);
        const m: Record<string, number> = {};
        for (const r of rows as any[]) m[String(r.Variable_name)] = n(r.Value);
        return m;
      })(), {} as Record<string, number>, 'database status') : {};

      const roles = dbOk ? await none((async () => {
        const [rows]: any = await db.query(`SELECT role, COUNT(*) c, COALESCE(SUM(is_active = 1),0) active FROM users GROUP BY role`);
        return (rows as any[]).map((r) => ({ role: String(r.role), n: n(r.c), active: n(r.active) }));
      })(), [] as any[], 'role counts') : [];

      const manual = dbOk ? await none((async () => {
        const [rows]: any = await db.query(`SELECT kind, COUNT(*) c, COALESCE(SUM(status='CANCELLED'),0) x, MAX(created_at) last FROM register_manual_entries GROUP BY kind`);
        return (rows as any[]).map((r) => ({ kind: String(r.kind), n: n(r.c), cancelled: n(r.x), last: r.last ? new Date(r.last).toISOString() : '' }));
      })(), [] as any[], 'offline entry counts') : [];

      const [commit, when, subject, branch] = await Promise.all([
        git(['rev-parse', '--short', 'HEAD']), git(['log', '-1', '--format=%cI']), git(['log', '-1', '--format=%s']), git(['rev-parse', '--abbrev-ref', 'HEAD']),
      ]);
      const mem = process.memoryUsage();
      return {
        generated_at: new Date().toISOString(),
        server: {
          node: process.version, platform: `${os.platform()} ${os.release()}`, env: process.env.NODE_ENV || 'development',
          pid: process.pid, uptime_s: Math.round(process.uptime()), host: os.hostname(),
          rss_mb: Math.round(mem.rss / 1048576), heap_mb: Math.round(mem.heapUsed / 1048576), heap_total_mb: Math.round(mem.heapTotal / 1048576),
          load: os.loadavg().map((x) => Math.round(x * 100) / 100), cpus: os.cpus().length,
          free_mb: Math.round(os.freemem() / 1048576), total_mb: Math.round(os.totalmem() / 1048576),
        },
        deploy: { commit, branch, committed_at: when, message: subject.slice(0, 160) },
        database: { ok: dbOk, error: dbError, version: dbVersion, ping_ms: dbMs, threads_connected: threads.Threads_connected || 0, threads_running: threads.Threads_running || 0, server_uptime_s: threads.Uptime || 0 },
        tables, roles, manual,
        log: LOG.slice(-40).reverse(),
      };
    });
    return res.json(data);
  } catch (e: any) {
    console.error('Developer dashboard error:', e?.sqlMessage || e?.message || e);
    return res.status(500).json({ message: 'Could not load the dashboard.' });
  }
});

export default router;