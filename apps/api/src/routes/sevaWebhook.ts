import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { generateSevaReceiptNo, dispatchNotifications } from './sevaPayment';

const router = Router();
const WEBHOOK_SECRET = process.env.RAZORPAY_SEVA_WEBHOOK_SECRET?.trim() || '';

// Mounted with express.raw() in index.ts, so req.body is the untouched Buffer.
router.post('/', async (req: Request, res: Response) => {
  if (!WEBHOOK_SECRET) {
    console.error('[Webhook] RAZORPAY_SEVA_WEBHOOK_SECRET is not set. Event rejected.');
    return res.status(500).json({ message: 'Webhook not configured' });
  }

  const signature = String(req.headers['x-razorpay-signature'] || '');
  const raw = req.body as Buffer;
  if (!signature || !Buffer.isBuffer(raw)) {
    return res.status(400).json({ message: 'Invalid request' });
  }

  // 1. Verify the call really came from Razorpay
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.warn('[Webhook] Signature mismatch. Event rejected.');
    return res.status(400).json({ message: 'Invalid signature' });
  }

  let event: any;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Invalid JSON' });
  }

  // 2. Only confirmed money changes a booking. Failed attempts can be retried
  //    by the devotee on the same order, so they are only logged.
  if (event?.event !== 'payment.captured') {
    if (event?.event === 'payment.failed') {
      console.log('[Webhook] payment.failed (attempt only, booking unchanged):', event?.payload?.payment?.entity?.order_id);
    }
    return res.json({ received: true, ignored: true });
  }

  const payment = event?.payload?.payment?.entity;
  const orderId = String(payment?.order_id || '');
  const paymentId = String(payment?.id || '');
  if (!orderId || !paymentId) {
    return res.json({ received: true, ignored: true });
  }

  try {
    const [rows]: any = await pool.query(
      'SELECT id, status, amount, receipt_no FROM seva_bookings WHERE razorpay_order_id = ? LIMIT 1',
      [orderId]
    );

    // Not a seva order (for example a donation order): nothing to do
    if (!rows || rows.length === 0) {
      return res.json({ received: true, ignored: true });
    }

    const booking = rows[0];

    // Already confirmed by the browser /verify call: nothing to do
    if (booking.status === 'SUCCESS') {
      return res.json({ received: true, alreadyConfirmed: true });
    }

    // The captured amount must match the booking amount
    if (Math.round(Number(booking.amount) * 100) !== Number(payment.amount)) {
      console.error('[Webhook] Amount mismatch. Needs manual review:', {
        bookingId: booking.id,
        orderId,
        paymentId,
        expected: Math.round(Number(booking.amount) * 100),
        received: payment.amount,
      });
      return res.json({ received: true, needsReview: true });
    }

    const receiptNo = booking.receipt_no || (await generateSevaReceiptNo());

    let result: any;
    try {
      [result] = await pool.query(
        `UPDATE seva_bookings SET
           status = 'SUCCESS',
           razorpay_payment_id = ?,
           receipt_no = ?
         WHERE id = ? AND status <> 'SUCCESS'`,
        [paymentId, receiptNo, booking.id]
      );
    } catch (dbErr: any) {
      if (dbErr?.code === 'ER_DUP_ENTRY') {
        // Money was taken but another active booking holds this date. Needs a manual refund or fix.
        console.error('[Webhook] Paid booking conflicts with another booking. Manual action needed:', {
          bookingId: booking.id,
          orderId,
          paymentId,
        });
        return res.json({ received: true, needsReview: true });
      }
      throw dbErr;
    }

    // Another request confirmed it first: no second notification
    if (!result || result.affectedRows === 0) {
      return res.json({ received: true, alreadyConfirmed: true });
    }

    console.log(`[Webhook] Booking ${booking.id} confirmed via webhook (${receiptNo}).`);
    void dispatchNotifications(booking.id, receiptNo, paymentId);

    return res.json({ received: true, confirmed: true });
  } catch (err: any) {
    // A real server error: return 500 so Razorpay retries later
    console.error('[Webhook] Processing error:', err?.message || err);
    return res.status(500).json({ message: 'Processing error' });
  }
});

export default router;