import { Router, Request, Response, NextFunction } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { sendDonationReceiptEmail } from '../services/donationEmail';
import { sendBookingWhatsAppNotification } from '../services/whatsappService';

// Load apps/api/.env no matter where the API was started from (does not override existing values)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const router = Router();
const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET || 'vedaneri-ashram-secret-key';

// ---------- Donation settings (read at request time; quotes and spaces removed) ----------
const clean = (v?: string) => (v || '').replace(/["'\s]/g, '');
const donationKeyId = () => clean(process.env.RAZORPAY_DONATION_KEY_ID);
const donationKeySecret = () => clean(process.env.RAZORPAY_DONATION_KEY_SECRET);
const idKeyHex = () => clean(process.env.DONATION_ID_KEY);

function missingConfig(): string[] {
  const missing: string[] = [];
  if (!donationKeyId()) missing.push('RAZORPAY_DONATION_KEY_ID');
  if (!donationKeySecret()) missing.push('RAZORPAY_DONATION_KEY_SECRET');
  if (!/^[0-9a-fA-F]{64}$/.test(idKeyHex())) missing.push('DONATION_ID_KEY (needs exactly 64 hex characters)');
  return missing;
}

const startupMissing = missingConfig();
if (startupMissing.length) {
  console.warn('[Donation] Missing configuration. Donations are disabled until set:', startupMissing.join(', '));
} else {
  console.log('[Donation] Configuration loaded.');
}

// Donations use their OWN Razorpay account. No fallback to the Seva keys.
let rzp: Razorpay | null = null;
let rzpKeyId = '';
function getRazorpay(): Razorpay {
  const id = donationKeyId();
  const secret = donationKeySecret();
  if (!id || !secret) throw new Error('Donation payments are not configured');
  if (!rzp || rzpKeyId !== id) {
    rzp = new Razorpay({ key_id: id, key_secret: secret });
    rzpKeyId = id;
  }
  return rzp;
}

// ---------- Aadhaar encryption (AES-256-GCM) ----------
function encryptValue(plain: string): string {
  const key = Buffer.from(idKeyHex(), 'hex');
  if (key.length !== 32) throw new Error('Encryption key not configured');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

// ---------- Aadhaar checksum (Verhoeff) ----------
const VD = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
  [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0],
];
const VP = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],
  [9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];
function isValidAadhaar(a: string): boolean {
  if (!/^[2-9][0-9]{11}$/.test(a)) return false;
  let c = 0;
  const digits = a.split('').reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = VD[c][VP[i % 8][digits[i]]];
  return c === 0;
}

const MAX_OPEN_AMOUNT = Number(process.env.MAX_OPEN_AMOUNT) > 0 ? Number(process.env.MAX_OPEN_AMOUNT) : 1000000;
const GRACE_MINUTES = Number(process.env.PENDING_GRACE_MINUTES) > 0 ? Number(process.env.PENDING_GRACE_MINUTES) : 10;
const MAX_DAYS_AHEAD = 400;
const MAX_MEMBERS = 15;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

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

const adminGuard = (req: Request, res: Response, next: NextFunction) =>
  authenticate(req as AuthenticatedRequest, res, next);

// ---------- India-time date helpers ----------
const IST_MS = 330 * 60 * 1000;
const pad2 = (n: number) => String(n).padStart(2, '0');
const istNow = () => new Date(Date.now() + IST_MS);
const todayYmd = () => {
  const d = istNow();
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};
const isValidYmd = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const addDays = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
};
const toDisplay = (ymd: string) => {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
};

// ---------- receipt number DON-YYyy-DDD-NNN ----------
async function generateReceiptNo(): Promise<string> {
  const conn = await pool.getConnection();
  try {
    const now = istNow();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const fyStart = m >= 3 ? y : y - 1;
    const fy = `${String(fyStart).slice(-2)}${String(fyStart + 1).slice(-2)}`;
    const doy = Math.floor((Date.UTC(y, m, now.getUTCDate()) - Date.UTC(y, 0, 1)) / 86400000) + 1;
    const key = `DON-${fy}-${String(doy).padStart(3, '0')}`;
    await conn.query(
      `INSERT INTO receipt_counters (counter_key, last_number) VALUES (?, LAST_INSERT_ID(1))
       ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
      [key]
    );
    const [rows]: any = await conn.query('SELECT LAST_INSERT_ID() AS n');
    return `${key}-${String(Number(rows[0]?.n) || 1).padStart(3, '0')}`;
  } finally {
    conn.release();
  }
}

// ---------- notifications (never throw) ----------
async function dispatchNotifications(bookingId: number | string, receiptNo: string, paymentId: string) {
  try {
    const [rows]: any = await pool.query(
      `SELECT b.*, DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS bd, d.first_name, d.last_name, d.email, d.phone
       FROM donation_booking b LEFT JOIN devotees d ON b.devotee_id = d.id WHERE b.id = ? LIMIT 1`,
      [bookingId]
    );
    if (!rows || !rows.length) return;
    const b = rows[0];
    const name = [b.first_name, b.last_name].filter(Boolean).join(' ') || 'Donor';

    Promise.resolve(
      sendDonationReceiptEmail({
        receiptNo,
        fundName: b.fund_title || 'Donation',
        amount: Number(b.amount || 0),
        paymentId,
        donorName: name,
        email: b.email || '',
        phone: b.phone || '',
        panNumber: b.pan_number || '',
        paidOn: toDisplay(b.bd) || toDisplay(todayYmd()),
      })
    ).catch((e: any) => console.error('Donation email error:', e?.message || e));

    Promise.resolve(
      sendBookingWhatsAppNotification({
        receiptNo,
        category: 'corpus',
        phone: b.phone || '',
        devoteeName: name,
        sevaName: b.fund_title || 'Donation',
        bookingDate: b.bd || todayYmd(),
        amount: Number(b.amount || 0),
      })
    ).catch((e: any) => console.error('Donation WhatsApp error:', e?.message || e));
  } catch (e: any) {
    console.error('Donation notification setup error:', e?.message || e);
  }
}

// ---------- shared confirm (verify, webhook, sweeper) ----------
export async function confirmDonation(
  bookingId: number,
  paymentId: string,
  signature: string | null
): Promise<{ receiptNo: string; newlyConfirmed: boolean }> {
  const [rows]: any = await pool.query('SELECT status, receipt_no FROM donation_booking WHERE id = ? LIMIT 1', [bookingId]);
  const row = rows && rows[0];
  if (row && row.status === 'SUCCESS' && row.receipt_no) return { receiptNo: row.receipt_no, newlyConfirmed: false };

  const receiptNo = (row && row.receipt_no) || (await generateReceiptNo());
  const [r]: any = await pool.query(
    `UPDATE donation_booking SET status='SUCCESS', razorpay_payment_id=?, razorpay_signature=?, receipt_no=?
     WHERE id=? AND status <> 'SUCCESS'`,
    [paymentId, signature, receiptNo, bookingId]
  );
  if (!r || r.affectedRows === 0) {
    const [again]: any = await pool.query('SELECT receipt_no FROM donation_booking WHERE id = ? LIMIT 1', [bookingId]);
    return { receiptNo: again?.[0]?.receipt_no || receiptNo, newlyConfirmed: false };
  }
  void dispatchNotifications(bookingId, receiptNo, paymentId);
  return { receiptNo, newlyConfirmed: true };
}

const dupMessage = 'You have already donated to this fund for the selected date. Please choose another date.';

// Cleans the family members list. Returns an error text or the clean list.
function cleanMembers(input: any): { error?: string; members?: any[] } {
  if (!Array.isArray(input) || input.length === 0) return { error: 'Please add at least one family member.' };
  if (input.length > MAX_MEMBERS) return { error: `You can add up to ${MAX_MEMBERS} family members.` };
  const out: any[] = [];
  for (let i = 0; i < input.length; i++) {
    const m = input[i] || {};
    const name = String(m.name || '').trim().slice(0, 120);
    const gothram = String(m.gothram || '').trim().slice(0, 80);
    if (!name) return { error: `Member ${i + 1}: please enter the name.` };
    if (!gothram) return { error: `Member ${i + 1}: please select the gothram.` };
    out.push({
      title: String(m.title || 'Sri').trim().slice(0, 12),
      name,
      gothram,
      nakshathiram: String(m.nakshathiram || '').trim().slice(0, 80),
      rasi: String(m.rasi || '').trim().slice(0, 80),
      relation: String(m.relation || '').trim().slice(0, 80),
    });
  }
  return { members: out };
}

// 0. SAVED PAN / AADHAAR (masked only; the full numbers never leave the server)
router.get('/my-ids', authDevotee, async (req: any, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT pan_number, aadhaar_last4 FROM donor_ids WHERE devotee_id = ? LIMIT 1',
      [String(req.devoteeId)]
    );
    if (!rows || !rows.length) return res.json({ saved: false });
    const r = rows[0];
    return res.json({
      saved: true,
      panMasked: `XXXXXX${String(r.pan_number).slice(6)}`,
      aadhaarMasked: `XXXX XXXX ${r.aadhaar_last4}`,
    });
  } catch (e: any) {
    console.error('Donor ids lookup error:', e?.message || e);
    return res.json({ saved: false });
  }
});

// 1. DATES THIS DONOR HAS ALREADY PAID FOR A FUND
router.get('/my-booked-dates', authDevotee, async (req: any, res: Response) => {
  try {
    const key = String(req.query.donationId || '').trim();
    if (!key) return res.status(400).json({ bookedDates: [] });
    const [f]: any = await pool.query('SELECT id FROM donation WHERE id = ? OR slug = ? LIMIT 1', [key, key]);
    if (!f || !f.length) return res.json({ bookedDates: [] });

    const [rows]: any = await pool.query(
      `SELECT DATE_FORMAT(booking_date, '%Y-%m-%d') AS d FROM donation_booking
       WHERE devotee_id = ? AND donation_id = ? AND status = 'SUCCESS'
         AND booking_date IS NOT NULL AND booking_date >= ?`,
      [String(req.devoteeId), String(f[0].id), todayYmd()]
    );
    return res.json({ bookedDates: Array.from(new Set<string>(rows.map((r: any) => String(r.d)))) });
  } catch (e: any) {
    console.error('Donation booked-dates error:', e);
    return res.status(500).json({ bookedDates: [] });
  }
});

// 2. CREATE ORDER (amount for fixed funds comes from the database)
router.post('/create-order', authDevotee, async (req: any, res: Response) => {
  try {
    const missing = missingConfig();
    if (missing.length) {
      console.error('[Donation] Cannot create order. Missing configuration:', missing.join(', '));
      return res.status(503).json({
        message: 'Online donations are temporarily unavailable. Please try again later.',
        missing,
      });
    }

    const { donationId, amount, bookingDate, panNumber, aadhaarNumber, useSavedIds, familyMembers, address } = req.body || {};
    const devoteeId = String(req.devoteeId);
    if (!donationId) return res.status(400).json({ message: 'donationId is required' });

    const [fr]: any = await pool.query(
      `SELECT *, DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date_str FROM donation WHERE id = ? OR slug = ? LIMIT 1`,
      [String(donationId), String(donationId)]
    );
    const fund = fr && fr[0];
    if (!fund) return res.status(404).json({ message: 'Donation fund not found' });
    if (fund.status !== 'published') return res.status(400).json({ message: 'This donation fund is not available right now' });

    // Amount
    const fixed = fund.price_type === 'fixed' && Number(fund.amount) > 0 ? Number(fund.amount) : 0;
    let finalAmount: number;
    if (fixed > 0) {
      finalAmount = fixed;
    } else {
      const n = Math.round(Number(amount) * 100) / 100;
      if (!Number.isFinite(n) || n < 1) return res.status(400).json({ message: 'Please enter a valid donation amount' });
      if (n > MAX_OPEN_AMOUNT) {
        return res.status(400).json({
          message: `The amount is above the online limit of INR ${MAX_OPEN_AMOUNT.toLocaleString('en-IN')}. Please contact the ashram.`,
          code: 'AMOUNT_TOO_HIGH',
        });
      }
      finalAmount = n;
    }

    // Date
    const date = bookingDate ? String(bookingDate).split('T')[0] : '';
    if (!date) return res.status(400).json({ message: 'Donation date is required', code: 'DATE_REQUIRED' });
    if (!isValidYmd(date)) return res.status(400).json({ message: 'Invalid date', code: 'INVALID_DATE' });
    const today = todayYmd();
    if (date < today) return res.status(400).json({ message: 'The date cannot be in the past', code: 'DATE_IN_PAST' });
    if (date > addDays(today, MAX_DAYS_AHEAD)) return res.status(400).json({ message: 'The date is too far ahead', code: 'DATE_TOO_FAR' });
    if (fund.recurrence_type === 'annual' && fund.event_date_str && fund.event_date_str !== date) {
      return res.status(400).json({ message: 'This fund accepts donations only on its festival date', code: 'DATE_NOT_ALLOWED' });
    }

    // PAN and Aadhaar: use the saved ones, or validate the new ones and save them
    let pan = '';
    let aadhaarEnc = '';
    let aadhaarLast4 = '';
    let newIds = false;

    if (useSavedIds) {
      const [saved]: any = await pool.query(
        'SELECT pan_number, aadhaar_enc, aadhaar_last4 FROM donor_ids WHERE devotee_id = ? LIMIT 1',
        [devoteeId]
      );
      if (!saved || !saved.length) {
        return res.status(400).json({ message: 'No saved PAN and Aadhaar found. Please enter them.', code: 'SAVED_IDS_MISSING' });
      }
      pan = saved[0].pan_number;
      aadhaarEnc = saved[0].aadhaar_enc;
      aadhaarLast4 = saved[0].aadhaar_last4;
    } else {
      pan = String(panNumber || '').trim().toUpperCase();
      if (!PAN_REGEX.test(pan)) return res.status(400).json({ message: 'Please enter a valid PAN (for example ABCDE1234F)', code: 'INVALID_PAN' });

      const aadhaar = String(aadhaarNumber || '').replace(/\s/g, '');
      if (!isValidAadhaar(aadhaar)) return res.status(400).json({ message: 'Please enter a valid 12-digit Aadhaar number', code: 'INVALID_AADHAAR' });

      aadhaarEnc = encryptValue(aadhaar);
      aadhaarLast4 = aadhaar.slice(-4);
      newIds = true;
    }

    // Family members (mandatory)
    const mem = cleanMembers(familyMembers);
    if (mem.error) return res.status(400).json({ message: mem.error, code: 'INVALID_MEMBERS' });

    // Address (mandatory)
    const addr = address || {};
    const comm = String(addr.comm || '').trim().slice(0, 500);
    const perm = String(addr.perm || '').trim().slice(0, 500) || comm;
    const city = String(addr.city || '').trim().slice(0, 100);
    const stateName = String(addr.state || '').trim().slice(0, 100);
    if (!comm || !city || !stateName) return res.status(400).json({ message: 'Please enter your full address, city and state', code: 'INVALID_ADDRESS' });

    const membersJson = JSON.stringify(mem.members);

    // Remember the numbers for this donor's next donation
    if (newIds) {
      await pool.query(
        `INSERT INTO donor_ids (devotee_id, pan_number, aadhaar_enc, aadhaar_last4) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE pan_number = VALUES(pan_number), aadhaar_enc = VALUES(aadhaar_enc), aadhaar_last4 = VALUES(aadhaar_last4)`,
        [devoteeId, pan, aadhaarEnc, aadhaarLast4]
      );
    }

    // Duplicate guard: same donor + fund + date
    const [existing]: any = await pool.query(
      `SELECT id, status, amount, razorpay_order_id FROM donation_booking
       WHERE devotee_id = ? AND donation_id = ? AND booking_date = ? AND status IN ('PENDING','SUCCESS')
       ORDER BY id DESC`,
      [devoteeId, fund.id, date]
    );
    if (existing.some((r: any) => r.status === 'SUCCESS')) {
      return res.status(409).json({ message: dupMessage, code: 'DONATION_ALREADY_MADE', bookingDate: date });
    }
    const pending = existing.find((r: any) => r.status === 'PENDING');
    if (pending) {
      if (pending.razorpay_order_id && Number(pending.amount) === finalAmount) {
        await pool.query(
          `UPDATE donation_booking SET pan_number=?, aadhaar_enc=?, aadhaar_last4=?, donor_address=?, donor_perm_address=?,
             donor_city=?, donor_state=?, family_members=? WHERE id = ?`,
          [pan, aadhaarEnc, aadhaarLast4, comm, perm, city, stateName, membersJson, pending.id]
        );
        return res.json({
          orderId: pending.razorpay_order_id,
          amount: Math.round(finalAmount * 100),
          currency: 'INR',
          keyId: donationKeyId(),
          bookingId: pending.id,
          reused: true,
        });
      }
      await pool.query(
        `UPDATE donation_booking SET status='FAILED'
         WHERE devotee_id = ? AND donation_id = ? AND booking_date = ? AND status = 'PENDING'`,
        [devoteeId, fund.id, date]
      );
    }

    const [ins]: any = await pool.query(
      `INSERT INTO donation_booking
         (devotee_id, donation_id, fund_title, category, amount, booking_date, pan_number, aadhaar_enc, aadhaar_last4,
          donor_address, donor_perm_address, donor_city, donor_state, family_members, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        devoteeId, fund.id, String(fund.title_en).slice(0, 255), fund.category || 'ashram', finalAmount, date,
        pan, aadhaarEnc, aadhaarLast4, comm, perm, city, stateName, membersJson,
      ]
    );
    const bookingId = ins.insertId;

    let order: any;
    try {
      order = await getRazorpay().orders.create({
        amount: Math.round(finalAmount * 100),
        currency: 'INR',
        receipt: `DON_${bookingId}`,
        notes: { bookingId: String(bookingId), devoteeId, donationId: String(fund.id), date },
      });
    } catch (err) {
      await pool.query("UPDATE donation_booking SET status='FAILED' WHERE id = ?", [bookingId]);
      throw err;
    }
    await pool.query('UPDATE donation_booking SET razorpay_order_id = ? WHERE id = ?', [order.id, bookingId]);

    return res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: donationKeyId(), bookingId });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: dupMessage, code: 'DONATION_ALREADY_MADE' });
    }
    console.error('Donation order error:', e?.error?.description || e?.message || e);
    return res.status(500).json({ message: e?.error?.description || e?.message || 'Failed to create donation order' });
  }
});

// 3. VERIFY PAYMENT
router.post('/verify', authDevotee, async (req: any, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body || {};
    const devoteeId = String(req.devoteeId);
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return res.status(400).json({ message: 'Missing payment details' });
    }

    const [own]: any = await pool.query(
      'SELECT id, status, receipt_no, razorpay_order_id FROM donation_booking WHERE id = ? AND devotee_id = ? LIMIT 1',
      [bookingId, devoteeId]
    );
    if (!own || !own.length) return res.status(404).json({ message: 'Donation not found' });
    const bk = own[0];
    if (!bk.razorpay_order_id || bk.razorpay_order_id !== String(razorpay_order_id)) {
      return res.status(400).json({ message: 'Payment does not match this donation' });
    }
    if (bk.status === 'SUCCESS' && bk.receipt_no) {
      return res.json({ success: true, receiptNo: bk.receipt_no, bookingId: bk.id });
    }

    const secret = donationKeySecret();
    if (!secret) return res.status(503).json({ message: 'Online donations are temporarily unavailable.' });

    const expected = crypto.createHmac('sha256', secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(razorpay_signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ message: 'Signature verification failed' });
    }

    try {
      const r = await confirmDonation(bk.id, String(razorpay_payment_id), String(razorpay_signature));
      return res.json({ success: true, receiptNo: r.receiptNo, bookingId: bk.id });
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') {
        console.error('Paid donation conflicts with another booking:', { bookingId: bk.id, paymentId: razorpay_payment_id });
        return res.status(409).json({
          message: 'Payment received, but another donation exists for this fund and date. Please contact the ashram with your payment id.',
          code: 'PAYMENT_CONFLICT',
          paymentId: razorpay_payment_id,
        });
      }
      throw e;
    }
  } catch (e: any) {
    console.error('Donation verify error:', e);
    return res.status(500).json({ message: e?.message || 'Verification failed' });
  }
});

// 4. RECEIPT (login required, own donations only; PAN and Aadhaar are masked)
router.get('/receipt/:key', authDevotee, async (req: any, res: Response) => {
  try {
    const key = String(req.params.key || '').trim();
    if (!key) return res.status(404).json({ message: 'Donation not found' });
    const numeric = /^\d+$/.test(key);
    const [rows]: any = await pool.query(
      `SELECT b.*, DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS bd, d.first_name, d.last_name, d.email, d.phone
       FROM donation_booking b LEFT JOIN devotees d ON b.devotee_id = d.id
       WHERE ${numeric ? 'b.id = ?' : 'b.receipt_no = ?'} AND b.devotee_id = ? LIMIT 1`,
      [key, String(req.devoteeId)]
    );
    if (!rows || !rows.length) return res.status(404).json({ message: 'Donation not found' });
    const b = rows[0];

    let members: any[] = [];
    try {
      members = b.family_members ? JSON.parse(b.family_members) : [];
    } catch {
      members = [];
    }

    return res.json({
      receiptNo: b.receipt_no,
      category: b.category,
      fundName: b.fund_title,
      donationDate: b.bd || '',
      amount: Number(b.amount || 0),
      paymentId: b.razorpay_payment_id || '',
      paymentStatus: b.status || 'PENDING',
      createdAt: b.created_at,
      panNumber: b.pan_number ? `XXXXXX${String(b.pan_number).slice(6)}` : '',
      aadhaarNumber: b.aadhaar_last4 ? `XXXX XXXX ${b.aadhaar_last4}` : '',
      familyMembers: members,
      donor: {
        firstName: b.first_name || '',
        lastName: b.last_name || '',
        email: b.email || '',
        phone: b.phone || '',
        address: b.donor_address || '',
        city: b.donor_city || '',
        state: b.donor_state || '',
      },
    });
  } catch (e: any) {
    console.error('Donation receipt error:', e);
    return res.status(500).json({ message: 'Failed to load receipt' });
  }
});

// 5. ADMIN: received donations (CMS). Aadhaar is never returned in full.
router.get('/admin/list', adminGuard, async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status || '').toUpperCase();
    const where = ['SUCCESS', 'PENDING', 'FAILED'].includes(status) ? 'WHERE b.status = ?' : '';
    const [rows]: any = await pool.query(
      `SELECT b.id, b.receipt_no, b.fund_title, b.category, b.amount, b.status, b.razorpay_payment_id, b.pan_number,
              b.aadhaar_last4, b.donor_city, b.donor_state,
              DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS donation_date, b.created_at,
              d.first_name, d.last_name, d.email, d.phone
       FROM donation_booking b LEFT JOIN devotees d ON b.devotee_id = d.id
       ${where} ORDER BY b.id DESC LIMIT 500`,
      where ? [status] : []
    );
    const [t]: any = await pool.query(
      `SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS s FROM donation_booking WHERE status = 'SUCCESS'`
    );
    return res.json({ donations: rows || [], totals: { count: Number(t[0]?.c) || 0, amount: Number(t[0]?.s) || 0 } });
  } catch (e: any) {
    console.error('Admin donation list error:', e);
    return res.status(500).json({ message: 'Failed to load donations' });
  }
});

// 6. PENDING SWEEPER: asks Razorpay before marking anything FAILED
let sweeping = false;
export async function syncPendingDonations(): Promise<void> {
  if (sweeping || !donationKeyId() || !donationKeySecret()) return;
  sweeping = true;
  try {
    const [rows]: any = await pool.query(
      `SELECT id, razorpay_order_id, amount FROM donation_booking
       WHERE status = 'PENDING' AND created_at < (NOW() - INTERVAL ? MINUTE) ORDER BY id ASC LIMIT 50`,
      [GRACE_MINUTES]
    );
    for (const b of rows || []) {
      try {
        if (!b.razorpay_order_id) {
          await pool.query("UPDATE donation_booking SET status='FAILED' WHERE id = ? AND status='PENDING'", [b.id]);
          continue;
        }
        const list: any = await getRazorpay().orders.fetchPayments(b.razorpay_order_id);
        const captured = (list?.items || []).find((p: any) => p.status === 'captured');
        if (!captured) {
          await pool.query("UPDATE donation_booking SET status='FAILED' WHERE id = ? AND status='PENDING'", [b.id]);
          console.log(`[DonationSync] Donation ${b.id} marked FAILED (no captured payment).`);
          continue;
        }
        if (Math.round(Number(b.amount) * 100) !== Number(captured.amount)) {
          console.error('[DonationSync] Amount mismatch, needs review:', { bookingId: b.id, paymentId: captured.id });
          continue;
        }
        const r = await confirmDonation(b.id, String(captured.id), null);
        if (r.newlyConfirmed) console.log(`[DonationSync] Donation ${b.id} confirmed (${r.receiptNo}).`);
      } catch (err: any) {
        console.warn(`[DonationSync] Donation ${b.id} skipped:`, err?.error?.description || err?.message || err);
      }
    }
  } catch (e: any) {
    console.error('[DonationSync] Run failed:', e?.message || e);
  } finally {
    sweeping = false;
  }
}

export default router;