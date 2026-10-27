import Razorpay from 'razorpay';
import { pool } from '../db';
import { generateSevaReceiptNo, dispatchNotifications } from '../routes/sevaPayment';

const key_id = process.env.RAZORPAY_SEVA_KEY_ID?.trim() || '';
const key_secret = process.env.RAZORPAY_SEVA_KEY_SECRET?.trim() || '';
const razorpay = new Razorpay({ key_id, key_secret });

const GRACE_MINUTES =
  Number(process.env.PENDING_GRACE_MINUTES) > 0 ? Number(process.env.PENDING_GRACE_MINUTES) : 5;

let running = false;

async function markFailed(id: number) {
  await pool.query("UPDATE seva_bookings SET status = 'FAILED' WHERE id = ? AND status = 'PENDING'", [id]);
}

export async function syncPendingBookings(): Promise<void> {
  if (running) return; // never overlap two runs
  running = true;

  try {
    const [rows]: any = await pool.query(
      `SELECT id, razorpay_order_id, amount, receipt_no
       FROM seva_bookings
       WHERE status = 'PENDING' AND created_at < (NOW() - INTERVAL ? MINUTE)
       ORDER BY id ASC
       LIMIT 50`,
      [GRACE_MINUTES]
    );

    for (const b of rows || []) {
      try {
        // Never reached Razorpay: nothing can have been paid
        if (!b.razorpay_order_id) {
          await markFailed(b.id);
          continue;
        }

        const list: any = await razorpay.orders.fetchPayments(b.razorpay_order_id);
        const captured = (list?.items || []).find((p: any) => p.status === 'captured');

        // Not paid: the devotee closed or cancelled the payment window
        if (!captured) {
          await markFailed(b.id);
          console.log(`[PendingSync] Booking ${b.id} marked FAILED (no captured payment).`);
          continue;
        }

        // Paid but the browser never confirmed: confirm it now
        if (Math.round(Number(b.amount) * 100) !== Number(captured.amount)) {
          console.error('[PendingSync] Amount mismatch. Needs manual review:', {
            bookingId: b.id,
            orderId: b.razorpay_order_id,
            paymentId: captured.id,
          });
          continue;
        }

        const receiptNo = b.receipt_no || (await generateSevaReceiptNo());
        try {
          const [result]: any = await pool.query(
            `UPDATE seva_bookings SET status = 'SUCCESS', razorpay_payment_id = ?, receipt_no = ?
             WHERE id = ? AND status = 'PENDING'`,
            [captured.id, receiptNo, b.id]
          );
          if (result?.affectedRows > 0) {
            console.log(`[PendingSync] Booking ${b.id} confirmed (${receiptNo}).`);
            void dispatchNotifications(b.id, receiptNo, String(captured.id));
          }
        } catch (dbErr: any) {
          if (dbErr?.code === 'ER_DUP_ENTRY') {
            console.error('[PendingSync] Paid booking conflicts with another booking. Manual action needed:', {
              bookingId: b.id,
              paymentId: captured.id,
            });
          } else {
            throw dbErr;
          }
        }
      } catch (err: any) {
        // Razorpay or network problem: leave it PENDING and retry next minute
        console.warn(`[PendingSync] Booking ${b.id} skipped:`, err?.error?.description || err?.message || err);
      }
    }
  } catch (err: any) {
    console.error('[PendingSync] Run failed:', err?.message || err);
  } finally {
    running = false;
  }
}