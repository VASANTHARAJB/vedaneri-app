import { Router, Response } from 'express';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

// Dashboard figures. Every number comes from the same tables the Payments and Registers pages use:
// seva_bookings (seva and corpus), donation_booking, magazine_subscriptions, devotees and users.
// Only paid bookings count (status = 'SUCCESS'). Nothing here is sample data.
const router = Router();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const AMT = 'CAST(amount AS DECIMAL(14,2))';

// A failed query must not break the dashboard, but it must leave a trace in the server log
const logFail = (name: string) => (err: any) =>
  console.error(`[dashboard] "${name}" query failed:`, err?.code || '', err?.sqlMessage || err?.message || err);

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayLabel = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

// The chart buckets for each range: [from, to] day strings with a label
function buckets(timeline: string, today: string) {
  const out: { label: string; from: string; to: string }[] = [];
  if (timeline === '1Y') {
    const first = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(first);
      d.setUTCMonth(d.getUTCMonth() - i);
      const key = d.toISOString().slice(0, 7);
      out.push({ label: MONTHS[d.getUTCMonth()], from: `${key}-01`, to: `${key}-31` });
    }
    return out;
  }
  const [size, count] = timeline === '7D' ? [1, 7] : timeline === '30D' ? [5, 6] : [15, 6];
  for (let i = 0; i < count; i++) {
    const from = addDays(today, -(size * (count - i) - 1));
    out.push({ label: dayLabel(from), from, to: addDays(from, size - 1) });
  }
  return out;
}

router.get('/stats', (req, res, next) => {
  authenticate(req as AuthenticatedRequest, res, next);
}, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const raw = String(req.query.timeline || '1Y');
    const timeline = ['7D', '30D', '90D', '1Y'].includes(raw) ? raw : '1Y';

    let today = new Date().toISOString().slice(0, 10);
    try {
      const [[t]]: any = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d");
      if (t?.d) today = t.d;
    } catch (e) { logFail('today')(e); }

    // 1. Metric totals
    let totalRevenue = 0;
    try {
      const [rows]: any = await pool.query(`SELECT COALESCE(SUM(${AMT}), 0) AS total FROM seva_bookings WHERE status = 'SUCCESS'`);
      totalRevenue = Number(rows[0]?.total || 0);
    } catch (e) { logFail('totalRevenue')(e); }

    // Sevas booked for today (booking_date is the seva date)
    let todaysSankalpam = 0;
    try {
      const [rows]: any = await pool.query(`SELECT COUNT(*) AS total FROM seva_bookings WHERE status = 'SUCCESS' AND DATE(booking_date) = CURDATE()`);
      todaysSankalpam = Number(rows[0]?.total || 0);
    } catch (e) { logFail('todaysSankalpam')(e); }

    // Paid donations to annadhanam funds (matched by the fund name)
    let annadhanamTotal = 0;
    try {
      const [rows]: any = await pool.query(
        `SELECT COALESCE(SUM(${AMT}), 0) AS total FROM donation_booking WHERE status = 'SUCCESS' AND LOWER(fund_title) LIKE '%annadhan%'`
      );
      annadhanamTotal = Number(rows[0]?.total || 0);
    } catch (e) { logFail('annadhanamTotal')(e); }

    // Active magazine subscribers who receive the print copy by post
    let postSubscribers = 0;
    try {
      const [rows]: any = await pool.query(`SELECT COUNT(*) AS total FROM magazine_subscriptions WHERE status = 'ACTIVE' AND delivery IN ('print', 'both')`);
      postSubscribers = Number(rows[0]?.total || 0);
    } catch (e) { logFail('postSubscribers')(e); }

    // 2. Chart: paid revenue (seva + donation) and number of paid seva bookings, per bucket
    const bks = buckets(timeline, today);
    const rangeStart = bks[0].from;
    const revenue = bks.map(() => 0);
    const bookings = bks.map(() => 0);
    try {
      const [rows]: any = await pool.query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, 'seva' AS src, COUNT(*) AS n, COALESCE(SUM(${AMT}), 0) AS t
           FROM seva_bookings WHERE status = 'SUCCESS' AND created_at >= ? GROUP BY d
         UNION ALL
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d'), 'donation', COUNT(*), COALESCE(SUM(${AMT}), 0)
           FROM donation_booking WHERE status = 'SUCCESS' AND created_at >= ? GROUP BY 1`,
        [`${rangeStart} 00:00:00`, `${rangeStart} 00:00:00`]
      );
      for (const r of rows as any[]) {
        const i = bks.findIndex((b) => r.d >= b.from && r.d <= b.to);
        if (i < 0) continue;
        revenue[i] += Number(r.t);
        if (r.src === 'seva') bookings[i] += Number(r.n);
      }
    } catch (e) { logFail('chart')(e); }
    const maxRev = Math.max(...revenue, 0);
    const maxBook = Math.max(...bookings, 0);

    // 3. Where the money came from in this range (top 4 seva or fund names)
    let sevaMix: any[] = [];
    try {
      const [mixRows]: any = await pool.query(
        `SELECT title AS label, SUM(t) AS amount FROM (
           SELECT seva_title AS title, ${AMT} AS t FROM seva_bookings WHERE status = 'SUCCESS' AND created_at >= ?
           UNION ALL
           SELECT fund_title, ${AMT} FROM donation_booking WHERE status = 'SUCCESS' AND created_at >= ?
         ) x WHERE title IS NOT NULL AND title <> '' GROUP BY title ORDER BY amount DESC LIMIT 4`,
        [`${rangeStart} 00:00:00`, `${rangeStart} 00:00:00`]
      );
      const rowsList = mixRows as any[];
      const grand = rowsList.reduce((a, r) => a + Number(r.amount), 0);
      const colors = ['#7a1c1c', '#ea580c', '#f59e0b', '#0f766e'];
      if (grand > 0) {
        sevaMix = rowsList.map((r, i) => ({
          label: r.label,
          amount: `₹${Number(r.amount).toLocaleString('en-IN')}`,
          pct: Math.round((Number(r.amount) / grand) * 100),
          color: colors[i % colors.length],
        }));
      }
    } catch (e) { logFail('sevaMix')(e); }

    // 4. Latest paid seva bookings
    let recentTransactions: any[] = [];
    try {
      const [txRows]: any = await pool.query(
        `SELECT COALESCE(NULLIF(b.receipt_no, ''), CONCAT('S', b.id)) AS id,
                COALESCE(NULLIF(TRIM(CONCAT(COALESCE(v.first_name,''), ' ', COALESCE(v.last_name,''))), ''), 'Devotee') AS devotee,
                CONCAT_WS(', ', NULLIF(v.city, ''), NULLIF(v.state, '')) AS spiritualInfo,
                b.seva_title AS seva,
                COALESCE(NULLIF(b.category, ''), 'seva') AS type,
                CONCAT('₹ ', FORMAT(CAST(b.amount AS DECIMAL(14,2)), 0)) AS amount,
                DATE_FORMAT(b.created_at, '%d %b %Y') AS date
           FROM seva_bookings b LEFT JOIN devotees v ON v.id = b.devotee_id
          WHERE b.status = 'SUCCESS'
          ORDER BY b.created_at DESC, b.id DESC
          LIMIT 6`
      );
      recentTransactions = txRows || [];
    } catch (e) { logFail('recentTransactions')(e); }

    // 5. Staff accounts
    let staffMembers: any[] = [];
    try {
      const [userRows]: any = await pool.query(
        `SELECT id, full_name AS name, role,
                CASE WHEN is_active = 1 THEN 'online' ELSE 'idle' END AS status,
                'Web Portal' AS device,
                DATE_FORMAT(updated_at, '%d %b, %H:%i') AS lastSeen
           FROM users
          ORDER BY is_active DESC, role ASC`
      );
      staffMembers = userRows || [];
    } catch (e) { logFail('staffMembers')(e); }

    return res.json({
      metrics: {
        totalRevenue: `₹ ${totalRevenue.toLocaleString('en-IN')}`,
        todaysSankalpam: `${todaysSankalpam}`,
        annadhanamTotal: `₹ ${annadhanamTotal.toLocaleString('en-IN')}`,
        postSubscribers: `${postSubscribers}`,
      },
      chartData: {
        labels: bks.map((b) => b.label),
        revenue: revenue.map((v) => (maxRev > 0 ? Math.round((v / maxRev) * 100) : 0)),
        bookings: bookings.map((v) => (maxBook > 0 ? Math.round((v / maxBook) * 100) : 0)),
      },
      recentTransactions,
      staffMembers,
      sevaMix,
      isLive: true,
    });
  } catch (error: any) {
    console.error('Dashboard telemetry error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

export default router;