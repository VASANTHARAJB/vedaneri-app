import { Router, Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { config } from '../config';
import { sendBookingReceiptEmail } from '../services/emailService';
import { sendBookingWhatsAppNotification } from '../services/whatsappService';

const router = Router();
const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET || 'vedaneri-ashram-secret-key';
if (!config.jwtSecret && !process.env.JWT_SECRET) {
  console.warn('[sevaPayment] WARNING: no JWT secret configured, using the built-in fallback. Set JWT_SECRET.');
}

// Dedicated Seva Razorpay Instance
const key_id = process.env.RAZORPAY_SEVA_KEY_ID?.trim() || '';
const key_secret = process.env.RAZORPAY_SEVA_KEY_SECRET?.trim() || '';
const sevaRazorpay = new Razorpay({ key_id, key_secret });

const MAX_MEMBERS = 50;
const MAX_DAYS_AHEAD = 400;
const MAX_OPEN_AMOUNT = Number(process.env.MAX_OPEN_AMOUNT) > 0 ? Number(process.env.MAX_OPEN_AMOUNT) : 1000000;

function authDevotee(req: any, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const decoded: any = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const id = decoded.id || decoded.devotee_id || decoded.userId;
    if (!id) return res.status(401).json({ message: 'Unauthorized' });
    req.devoteeId = id;
    next();
  } catch {
    return res.status(401).json({ message: 'Session expired' });
  }
}

// -------------------------------------------------------------
// DATE HELPERS (all business dates are Indian Standard Time)
// -------------------------------------------------------------
const IST_OFFSET_MS = 330 * 60 * 1000;
const pad2 = (n: number) => String(n).padStart(2, '0');

function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function todayIST(): string {
  const d = istNow();
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function addDaysYmd(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

// Converts a DB DATE (JS Date or string) to YYYY-MM-DD
function toYmd(v: any): string {
  if (!v) return '';
  if (v instanceof Date) {
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }
  return String(v).slice(0, 10);
}

// -------------------------------------------------------------
// OTHER HELPERS
// -------------------------------------------------------------
function parseSankalpam(raw: any): { members: any[]; bookingDate: string } {
  if (!raw) return { members: [], bookingDate: '' };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return { members: parsed, bookingDate: '' };
    if (parsed && typeof parsed === 'object') {
      return {
        members: Array.isArray(parsed.members) ? parsed.members : [],
        bookingDate: parsed.booking_date ? String(parsed.booking_date).split('T')[0] : '',
      };
    }
  } catch (_) {}
  return { members: [], bookingDate: '' };
}

function getSevaTitle(seva: any): string {
  try {
    const t = typeof seva.title === 'string' ? JSON.parse(seva.title) : seva.title;
    if (t && typeof t === 'object') return String(t.en || t.ta || '');
    if (typeof t === 'string') return t;
  } catch (_) {
    if (typeof seva.title === 'string') return seva.title;
  }
  return '';
}

async function findSeva(key: string): Promise<any | null> {
  const [rows]: any = await pool.query('SELECT * FROM sevas WHERE id = ? OR slug = ? LIMIT 1', [key, key]);
  return rows && rows.length ? rows[0] : null;
}

function duplicateMessage(category: 'seva' | 'corpus'): string {
  return category === 'corpus'
    ? 'You have already made a contribution to this fund for the selected date. Please choose another date.'
    : 'You have already booked this seva for the selected date. Duplicate booking is not allowed.';
}

// -------------------------------------------------------------
// ATOMIC SEQUENTIAL RECEIPT GENERATOR (SDSS-YYyy-DDD-NNN)
// Uses ONE dedicated connection, because LAST_INSERT_ID() is per-connection.
// -------------------------------------------------------------
let isCounterTableReady = false;

async function ensureCounterTable(connection: any) {
  if (isCounterTableReady) return;
  await connection.query(`
    CREATE TABLE IF NOT EXISTS receipt_counters (
      counter_key VARCHAR(60) PRIMARY KEY,
      last_number INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  isCounterTableReady = true;
}

export async function generateSevaReceiptNo(): Promise<string> {
  const connection = await pool.getConnection();
  try {
    await ensureCounterTable(connection);

    const now = istNow();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth(); // 0 = Jan ... 3 = Apr

    // Financial year (April 1 to March 31)
    const fyStart = m >= 3 ? y : y - 1;
    const fyCode = `${String(fyStart).slice(-2)}${String(fyStart + 1).slice(-2)}`;

    // Day of the calendar year (001-366)
    const dayOfYear =
      Math.floor((Date.UTC(y, m, now.getUTCDate()) - Date.UTC(y, 0, 1)) / 86400000) + 1;
    const dayCode = String(dayOfYear).padStart(3, '0');

    const counterKey = `SDSS-${fyCode}-${dayCode}`;

    await connection.query(
      `INSERT INTO receipt_counters (counter_key, last_number)
       VALUES (?, LAST_INSERT_ID(1))
       ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`,
      [counterKey]
    );

    const [counterRows]: any = await connection.query('SELECT LAST_INSERT_ID() AS last_number');
    const sequenceNum = Number(counterRows[0]?.last_number) || 1;
    return `${counterKey}-${String(sequenceNum).padStart(3, '0')}`;
  } finally {
    connection.release();
  }
}

// -------------------------------------------------------------
// Sends the email and WhatsApp messages. NEVER throws:
// the payment is already saved, so a notification problem must not
// turn a successful payment into an error for the devotee.
// -------------------------------------------------------------
export async function dispatchNotifications(bookingId: number | string, receiptNo: string, paymentId: string) {
  try {
    const [bookingRows]: any = await pool.query(
      `SELECT sb.*, DATE_FORMAT(sb.booking_date, '%Y-%m-%d') AS booking_date_str,
              d.first_name, d.last_name, d.email, d.phone, d.comm_address, d.city, d.state
       FROM seva_bookings sb
       LEFT JOIN devotees d ON sb.devotee_id = d.id
       WHERE sb.id = ? LIMIT 1`,
      [bookingId]
    );
    if (!bookingRows || bookingRows.length === 0) return;

    const row = bookingRows[0];
    const category: 'seva' | 'corpus' = row.category === 'corpus' ? 'corpus' : 'seva';
    const parsed = parseSankalpam(row.sankalpam_data);
    const devoteeFullName = [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Devotee';
    const resolvedDate = row.booking_date_str || parsed.bookingDate || todayIST();

    const notificationPayload = {
      receiptNo,
      category,
      bookingDate: resolvedDate,
      sevaName: row.seva_title || 'Seva Offering',
      totalAmount: Number(row.amount || 0),
      paymentId,
      primaryDevotee: {
        name: devoteeFullName,
        email: row.email || '',
        phone: row.phone || '',
      },
      sankalpamMembers: parsed.members,
      deliveryType: (row.comm_address ? 'courier' : 'pickup') as 'courier' | 'pickup',
      deliveryAddress: {
        comm_address: row.comm_address || '',
        city: row.city || '',
        state: row.state || '',
      },
    };

    Promise.resolve(sendBookingReceiptEmail(notificationPayload)).catch((err: any) =>
      console.error('Email Dispatch Error:', err?.message || err)
    );

    Promise.resolve(
      sendBookingWhatsAppNotification({
        receiptNo,
        category,
        phone: row.phone || '',
        devoteeName: devoteeFullName,
        sevaName: row.seva_title || 'Seva Offering',
        bookingDate: resolvedDate,
        amount: Number(row.amount || 0),
      })
    ).catch((err: any) => console.error('WhatsApp Worker Dispatch Error:', err?.message || err));
  } catch (err: any) {
    console.error('Notification setup error:', err?.message || err);
  }
}

// -------------------------------------------------------------
// 1. DATES THIS DEVOTEE HAS ALREADY BOOKED / PAID FOR (Seva and Corpus)
// -------------------------------------------------------------
router.get('/my-booked-dates', authDevotee, async (req: any, res: Response) => {
  try {
    const sevaKey = String(req.query.sevaId || '').trim();
    if (!sevaKey) {
      return res.status(400).json({ message: 'sevaId query param required', bookedDates: [] });
    }

    const seva = await findSeva(sevaKey);
    if (!seva) {
      return res.json({ bookedDates: [] });
    }

    const [rows]: any = await pool.query(
      `SELECT DATE_FORMAT(booking_date, '%Y-%m-%d') AS d
       FROM seva_bookings
       WHERE devotee_id = ? AND seva_id = ?
         AND status = 'SUCCESS' AND booking_date IS NOT NULL AND booking_date >= ?`,
      [String(req.devoteeId), String(seva.id), todayIST()]
    );

    const bookedDates: string[] = Array.from(new Set<string>(rows.map((r: any) => String(r.d))));
    return res.json({ bookedDates });
  } catch (error: any) {
    console.error('Fetch Booked Dates Error:', error);
    return res.status(500).json({ bookedDates: [] });
  }
});

// -------------------------------------------------------------
// 2. CREATE ORDER
//    - price, title and category come from the database, never the browser
//    - ONE active booking per devotee + offering + date (Seva AND Corpus)
//    - an unfinished payment for the same date is reused instead of duplicated
// -------------------------------------------------------------
router.post('/create-order', authDevotee, async (req: any, res: Response) => {
  let category: 'seva' | 'corpus' = 'seva';
  try {
    const { sevaId, amount, bookingDate, sankalpamMembers } = req.body || {};
    const devoteeId = String(req.devoteeId);

    if (!sevaId) {
      return res.status(400).json({ message: 'sevaId is required' });
    }

    const seva = await findSeva(String(sevaId));
    if (!seva) {
      return res.status(404).json({ message: 'Offering not found' });
    }
    if (seva.status !== 'published') {
      return res.status(400).json({ message: 'This offering is not available for booking' });
    }

    const sevaUuid = String(seva.id);
    category = seva.category === 'corpus' ? 'corpus' : 'seva';
    const sevaTitle = getSevaTitle(seva) || 'Seva Booking';

    // ---- Amount: fixed price comes from the DB; open amount comes from the devotee
    const fixedAmount =
      Number(seva.amount) > 0 ? Number(seva.amount) : Number(seva.price) > 0 ? Number(seva.price) : 0;
    const isOpenAmount = seva.price_type === 'custom' || !(fixedAmount > 0);

    let finalAmount: number;
    if (isOpenAmount) {
      const requested = Math.round(Number(amount) * 100) / 100;
      if (!Number.isFinite(requested) || requested < 1) {
        return res.status(400).json({ message: 'Valid offering amount required' });
      }
      if (requested > MAX_OPEN_AMOUNT) {
        return res.status(400).json({
          message: `The amount is above the online limit of INR ${MAX_OPEN_AMOUNT.toLocaleString('en-IN')}. Please contact the ashram.`,
          code: 'AMOUNT_TOO_HIGH',
        });
      }
      finalAmount = requested;
    } else {
      finalAmount = fixedAmount;
    }

    // ---- Date validation (required for Seva AND Corpus)
    const cleanBookingDate = bookingDate ? String(bookingDate).split('T')[0] : '';
    if (!cleanBookingDate) {
      return res.status(400).json({ message: 'Booking date is required', code: 'DATE_REQUIRED' });
    }
    if (!isValidYmd(cleanBookingDate)) {
      return res.status(400).json({ message: 'Invalid booking date', code: 'INVALID_DATE' });
    }
    const today = todayIST();
    if (cleanBookingDate < today) {
      return res.status(400).json({ message: 'Booking date cannot be in the past', code: 'DATE_IN_PAST' });
    }
    if (cleanBookingDate > addDaysYmd(today, MAX_DAYS_AHEAD)) {
      return res.status(400).json({ message: 'Booking date is too far ahead', code: 'DATE_TOO_FAR' });
    }
    if (category === 'seva' && seva.recurrence_type === 'annual' && seva.event_date) {
      if (toYmd(seva.event_date) !== cleanBookingDate) {
        return res.status(400).json({
          message: 'This seva can only be booked on its festival date',
          code: 'DATE_NOT_ALLOWED',
        });
      }
    }
    const bookingDateValue: string = cleanBookingDate;

    // ---- Members
    const members = Array.isArray(sankalpamMembers) ? sankalpamMembers : [];
    if (members.length > MAX_MEMBERS) {
      return res.status(400).json({ message: `A maximum of ${MAX_MEMBERS} sankalpam members is allowed` });
    }
    const sankalpamPayload = JSON.stringify({
      booking_date: bookingDateValue,
      members,
    });

    // ---- Duplicate guard: same devotee + same offering + same date
    const [existing]: any = await pool.query(
      `SELECT id, status, amount, razorpay_order_id
       FROM seva_bookings
       WHERE devotee_id = ? AND seva_id = ?
         AND booking_date = ? AND status IN ('PENDING','SUCCESS')
       ORDER BY id DESC`,
      [devoteeId, sevaUuid, bookingDateValue]
    );

    if (existing.some((r: any) => r.status === 'SUCCESS')) {
      return res.status(409).json({
        message: duplicateMessage(category),
        code: 'SEVA_ALREADY_BOOKED',
        bookingDate: bookingDateValue,
      });
    }

    const pending = existing.find((r: any) => r.status === 'PENDING');
    if (pending) {
      // Same unfinished payment: reuse the same Razorpay order (no second order, no duplicate row)
      if (pending.razorpay_order_id && Number(pending.amount) === finalAmount) {
        await pool.query('UPDATE seva_bookings SET sankalpam_data = ? WHERE id = ? AND devotee_id = ?', [
          sankalpamPayload,
          pending.id,
          devoteeId,
        ]);
        return res.json({
          orderId: pending.razorpay_order_id,
          amount: Math.round(finalAmount * 100),
          currency: 'INR',
          keyId: key_id,
          bookingId: pending.id,
          reused: true,
        });
      }
      // Different amount or never got an order: close the old attempt
      await pool.query(
        `UPDATE seva_bookings SET status = 'FAILED'
         WHERE devotee_id = ? AND seva_id = ?
           AND booking_date = ? AND status = 'PENDING'`,
        [devoteeId, sevaUuid, bookingDateValue]
      );
    }

    // ---- Insert the booking
    const [insertResult]: any = await pool.query(
      `INSERT INTO seva_bookings
        (devotee_id, seva_id, seva_title, category, amount, booking_date, status, sankalpam_data)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [devoteeId, sevaUuid, sevaTitle, category, finalAmount, bookingDateValue, sankalpamPayload]
    );
    const bookingId = insertResult.insertId;

    // ---- Razorpay order
    let order: any;
    try {
      order = await sevaRazorpay.orders.create({
        amount: Math.round(finalAmount * 100),
        currency: 'INR',
        receipt: `SEVA_${bookingId}`,
        notes: {
          bookingId: String(bookingId),
          devoteeId,
          bookingDate: bookingDateValue,
        },
      });
    } catch (rzpError) {
      // Never leave a PENDING row without an order: it would block the date
      await pool.query("UPDATE seva_bookings SET status = 'FAILED' WHERE id = ?", [bookingId]);
      throw rzpError;
    }

    await pool.query('UPDATE seva_bookings SET razorpay_order_id = ? WHERE id = ?', [order.id, bookingId]);

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: key_id,
      bookingId,
    });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: duplicateMessage(category),
        code: 'SEVA_ALREADY_BOOKED',
      });
    }
    console.error('Order Error:', error);
    return res.status(500).json({
      message: error?.error?.description || error?.message || 'Failed to create order',
    });
  }
});

// -------------------------------------------------------------
// 3. VERIFY PAYMENT & DISPATCH CONFIRMATIONS
// -------------------------------------------------------------
router.post('/verify', authDevotee, async (req: any, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body || {};
    const devoteeId = String(req.devoteeId);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId) {
      return res.status(400).json({ message: 'Missing payment details' });
    }

    // The booking must belong to this devotee
    const [ownRows]: any = await pool.query(
      'SELECT id, status, receipt_no, razorpay_order_id FROM seva_bookings WHERE id = ? AND devotee_id = ? LIMIT 1',
      [bookingId, devoteeId]
    );
    if (!ownRows || ownRows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    const booking = ownRows[0];

    // The paid order must be the order created for THIS booking
    if (!booking.razorpay_order_id || booking.razorpay_order_id !== String(razorpay_order_id)) {
      return res.status(400).json({ message: 'Payment does not match this booking' });
    }

    // Already confirmed: return the same receipt (safe to retry)
    if (booking.status === 'SUCCESS' && booking.receipt_no) {
      return res.json({ success: true, receiptNo: booking.receipt_no, bookingId: booking.id });
    }

    // Signature check (constant-time). A bad signature does NOT mark the booking FAILED.
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    const a = Buffer.from(expectedSignature);
    const b = Buffer.from(String(razorpay_signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ message: 'Signature verification failed' });
    }

    const receiptNo = booking.receipt_no || (await generateSevaReceiptNo());

    let updateResult: any;
    try {
      [updateResult] = await pool.query(
        `UPDATE seva_bookings SET
           status = 'SUCCESS',
           razorpay_payment_id = ?,
           razorpay_signature = ?,
           receipt_no = ?
         WHERE id = ? AND devotee_id = ? AND status <> 'SUCCESS'`,
        [razorpay_payment_id, razorpay_signature, receiptNo, booking.id, devoteeId]
      );
    } catch (dbErr: any) {
      if (dbErr?.code === 'ER_DUP_ENTRY') {
        console.error('Paid booking conflicts with another active booking:', {
          bookingId: booking.id,
          paymentId: razorpay_payment_id,
        });
        return res.status(409).json({
          message: 'Payment received, but another booking exists for this offering and date. Please contact the ashram with your payment id.',
          code: 'PAYMENT_CONFLICT',
          paymentId: razorpay_payment_id,
        });
      }
      throw dbErr;
    }

    // Another request confirmed it first: return that receipt, no second notification
    if (!updateResult || updateResult.affectedRows === 0) {
      const [again]: any = await pool.query('SELECT receipt_no FROM seva_bookings WHERE id = ? LIMIT 1', [booking.id]);
      return res.json({ success: true, receiptNo: again?.[0]?.receipt_no || receiptNo, bookingId: booking.id });
    }

    // The payment is saved. Notifications run in the background and can never fail this response.
    void dispatchNotifications(booking.id, receiptNo, String(razorpay_payment_id));

    return res.json({ success: true, receiptNo, bookingId: booking.id });
  } catch (error: any) {
    console.error('Payment Verification Error:', error);
    return res.status(500).json({ message: error?.message || 'Verification failed' });
  }
});

// -------------------------------------------------------------
// 4. RECEIPT DETAILS (login required, own bookings only)
// -------------------------------------------------------------
router.get('/receipt/:bookingId', authDevotee, async (req: any, res: Response) => {
  try {
    const key = String(req.params.bookingId || '').trim();
    if (!key) return res.status(404).json({ message: 'Booking not found' });

    const isNumericId = /^\d+$/.test(key);
    const [rows]: any = await pool.query(
      `SELECT sb.*, DATE_FORMAT(sb.booking_date, '%Y-%m-%d') AS booking_date_str,
              d.first_name, d.last_name, d.email, d.phone, d.comm_address, d.city, d.state
       FROM seva_bookings sb
       LEFT JOIN devotees d ON sb.devotee_id = d.id
       WHERE ${isNumericId ? 'sb.id = ?' : 'sb.receipt_no = ?'} AND sb.devotee_id = ?
       LIMIT 1`,
      [key, String(req.devoteeId)]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const b = rows[0];
    const parsed = parseSankalpam(b.sankalpam_data);

    return res.json({
      receiptNo: b.receipt_no,
      category: b.category === 'corpus' ? 'corpus' : 'seva',
      bookingDate: b.booking_date_str || parsed.bookingDate || '',
      sevaName: b.seva_title || 'Seva Offering',
      amount: Number(b.amount || 0),
      paymentId: b.razorpay_payment_id || '',
      paymentStatus: b.status || 'PENDING',
      createdAt: b.created_at,
      primaryDevotee: {
        firstName: b.first_name || '',
        lastName: b.last_name || '',
        email: b.email || '',
        phone: b.phone || '',
      },
      sankalpamMembers: parsed.members,
      deliveryType: b.comm_address ? 'courier' : 'pickup',
      deliveryAddress: {
        comm_address: b.comm_address || '',
        city: b.city || '',
        state: b.state || '',
      },
    });
  } catch (error: any) {
    console.error('Receipt Fetch Error:', error);
    return res.status(500).json({ message: error.message });
  }
});

export default router;
