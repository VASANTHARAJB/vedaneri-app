import { Router, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { config } from '../config';

const router = Router();
const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET || 'vedaneri-ashram-secret-key';

function authDevotee(req: any, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const d: any = jwt.verify(h.split(' ')[1], JWT_SECRET);
    const id = d.id || d.devotee_id || d.userId;
    if (!id) return res.status(401).json({ message: 'Unauthorized' });
    req.devoteeId = id;
    next();
  } catch {
    return res.status(401).json({ message: 'Session expired' });
  }
}

type Kind = 'seva_list' | 'seva_corpus' | 'donation_list' | 'donation_corpus' | 'ashram_donation';

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Everything the logged-in devotee has booked or donated. Only their own rows, no PAN or Aadhaar.
router.get('/history', authDevotee, async (req: any, res: Response) => {
  const devoteeId = String(req.devoteeId);
  const items: any[] = [];
  const errors: string[] = [];

  // ---- Sevas and seva corpus ----
  try {
    let rows: any;
    try {
      [rows] = await pool.query(
        `SELECT b.*, DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS bd, s.title_en AS s_title_en, s.title_ta AS s_title_ta
         FROM seva_bookings b LEFT JOIN sevas s ON s.id = b.seva_id
         WHERE b.devotee_id = ? ORDER BY b.id DESC LIMIT 200`,
        [devoteeId]
      );
    } catch (_) {
      // The join can fail on a collation mismatch; fall back to the booking rows alone
      [rows] = await pool.query(
        `SELECT b.*, DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS bd
         FROM seva_bookings b WHERE b.devotee_id = ? ORDER BY b.id DESC LIMIT 200`,
        [devoteeId]
      );
    }

    for (const b of rows || []) {
      const isCorpus = String(b.category || '').toLowerCase() === 'corpus';
      items.push({
        key: `seva-${b.id}`,
        kind: (isCorpus ? 'seva_corpus' : 'seva_list') as Kind,
        source: 'seva',
        id: b.id,
        title_en: b.s_title_en || b.seva_title || b.seva_name || b.title || 'Seva',
        title_ta: b.s_title_ta || b.s_title_en || b.seva_title || 'சேவை',
        amount: toNum(b.amount ?? b.total_amount ?? b.final_amount),
        status: String(b.status || 'PENDING').toUpperCase(),
        date: b.bd || '',
        created_at: b.created_at || null,
        receipt_no: b.receipt_no || null,
      });
    }
  } catch (e: any) {
    console.error('History: seva bookings failed:', e?.message || e);
    errors.push('seva');
  }

  // ---- Donations ----
  try {
    const [rows]: any = await pool.query(
      `SELECT id, receipt_no, fund_title, category, amount, status,
              DATE_FORMAT(booking_date, '%Y-%m-%d') AS bd, created_at
       FROM donation_booking WHERE devotee_id = ? ORDER BY id DESC LIMIT 200`,
      [devoteeId]
    );
    for (const b of rows || []) {
      const cat = String(b.category || '').toLowerCase();
      const kind: Kind = cat === 'corpus' ? 'donation_corpus' : cat === 'ashram' ? 'ashram_donation' : 'donation_list';
      items.push({
        key: `don-${b.id}`,
        kind,
        source: 'donation',
        id: b.id,
        title_en: b.fund_title || 'Donation',
        title_ta: b.fund_title || 'நன்கொடை',
        amount: toNum(b.amount),
        status: String(b.status || 'PENDING').toUpperCase(),
        date: b.bd || '',
        created_at: b.created_at || null,
        receipt_no: b.receipt_no || null,
      });
    }
  } catch (e: any) {
    console.error('History: donations failed:', e?.message || e);
    errors.push('donation');
  }

  // Newest first
  items.sort((a, b) => String(b.created_at || b.date).localeCompare(String(a.created_at || a.date)));

  return res.json({ items, errors });
});

export default router;