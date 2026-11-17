import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../dbLimit';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

// 80G file for the Donation Register: every PAID online donation of a date range (usually a financial year).
// The file carries only the donor name, PAN and mobile number.
// Mounted at /api/v1/registers/admin/donation80g (before the registers router).
// Only the roles listed below may use it, because the file carries PAN numbers. Every request is written to the server log.
const G80_ROLES = ['superadmin', 'admin']; // add 'registration' here to let the register staff download it too

const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const fail = (res: Response, e: any, message: string) => {
  console.error(`Donation80g: ${message}`, e?.sqlMessage || e?.message || e);
  return res.status(500).json({ message, detail: IS_PROD ? undefined : e?.sqlMessage || e?.message || String(e) });
};

router.use((req: Request, res: Response, next: NextFunction) => authenticate(req as AuthenticatedRequest, res, next));
router.use((req: Request, res: Response, next: NextFunction) => {
  const u: any = (req as any).user || {};
  if (!G80_ROLES.includes(String(u.role || '').toLowerCase())) {
    return res.status(403).json({ message: 'Only an admin can use the 80G file.' });
  }
  res.setHeader('Cache-Control', 'no-store');
  return next();
});
const who = (req: Request) => {
  const u: any = (req as any).user || {};
  return String(u.email || u.full_name || u.id || 'unknown');
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDay = (d: string) => DAY.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
const one = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const PAN_OK = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const cleanPan = (v: unknown) => String(v || '').trim().toUpperCase();
const maskPan = (p: string) => (p.length >= 10 ? `${p.slice(0, 2)}•••••${p.slice(-3)}` : p ? '•••••' : '');
const cell = (v: unknown) => {
  let s = v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 19).replace('T', ' ') : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // a spreadsheet must never run a typed value as a formula
  return `"${s.replace(/"/g, '""')}"`;
};

function range(req: Request): { from: string; to: string } | { error: string } {
  const from = one(req.query.from), to = one(req.query.to);
  if (!realDay(from) || !realDay(to) || Date.parse(to) < Date.parse(from)) return { error: 'Choose a valid from and to date.' };
  return { from, to };
}

// Paid donations with the PAN of the booking, otherwise the PAN saved on the devotee's profile
const SELECT = `
  SELECT b.id, b.receipt_no, b.created_at, b.fund_title, b.category, b.amount, b.razorpay_payment_id,
         COALESCE(NULLIF(TRIM(b.pan_number), ''), NULLIF(TRIM(d.pan_number), ''), NULLIF(TRIM(x.pan_number), '')) AS pan,
         b.donor_address, b.donor_city, b.donor_state, d.id AS devotee_id,
         TRIM(CONCAT(COALESCE(d.first_name,''), ' ', COALESCE(d.last_name,''))) AS name, d.email, d.phone
    FROM donation_booking b
    LEFT JOIN devotees d ON d.id = b.devotee_id
    LEFT JOIN (SELECT devotee_id, MAX(pan_number) AS pan_number FROM donor_ids GROUP BY devotee_id) x ON x.devotee_id = b.devotee_id
   WHERE b.status = 'SUCCESS' AND b.created_at >= ? AND b.created_at < DATE_ADD(?, INTERVAL 1 DAY)
   ORDER BY b.created_at ASC, b.id ASC`;

// What is in the range: counts, the total and a preview (PAN is masked on screen; the downloaded file has it in full)
router.get('/preview', async (req, res) => {
  try {
    const r = range(req);
    if ('error' in r) return res.status(400).json({ message: r.error });
    const [rows]: any = await db.query(`${SELECT} LIMIT 20000`, [`${r.from} 00:00:00`, `${r.to} 00:00:00`]);
    let withPan = 0, badPan = 0;
    for (const x of rows) {
      const p = cleanPan(x.pan);
      if (p) { withPan++; if (!PAN_OK.test(p)) badPan++; }
    }
    return res.json({
      count: rows.length, withPan, withoutPan: rows.length - withPan, badPan,
      rows: rows.slice(-100).reverse().map((x: any) => ({
        id: x.id, name: x.name || '', phone: x.phone || '', pan: maskPan(cleanPan(x.pan)),
      })),
    });
  } catch (e: any) { return fail(res, e, 'Could not load the 80G donations.'); }
});

router.get('/export', async (req, res) => {
  try {
    const r = range(req);
    if ('error' in r) return res.status(400).json({ message: r.error });
    const [rows]: any = await db.query(`${SELECT} LIMIT 20000`, [`${r.from} 00:00:00`, `${r.to} 00:00:00`]);
    console.log(`[audit] 80G file from the Donation Register (${r.from} to ${r.to}, ${rows.length} rows) downloaded by ${who(req)}`);
    const head = ['Donor name', 'PAN', 'Mobile'];
    const lines = [head.map(cell).join(',')];
    for (const x of rows) {
      const pan = cleanPan(x.pan);
      lines.push([x.name, pan, x.phone].map(cell).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="80g-donations-${r.from}-to-${r.to}.csv"`);
    return res.send('﻿' + lines.join('\r\n'));
  } catch (e: any) { return fail(res, e, 'Could not make the 80G file.'); }
});

export default router;