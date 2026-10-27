import { Router, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { config } from '../config';

const router = Router();
const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET || 'vedaneri-ashram-secret-key';

// Dedicated Donation / 80G Razorpay Instance
const key_id = process.env.RAZORPAY_DONATION_KEY_ID?.trim() || '';
const key_secret = process.env.RAZORPAY_DONATION_KEY_SECRET?.trim() || '';
const donationRazorpay = new Razorpay({ key_id, key_secret });

function authDevotee(req: any, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const decoded: any = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.devoteeId = decoded.id || decoded.devotee_id || decoded.userId;
    next();
  } catch {
    return res.status(401).json({ message: 'Session expired' });
  }
}

// POST /api/v1/payment/donation/create-order
router.post('/create-order', authDevotee, async (req: any, res: Response) => {
  try {
    const { sevaId, sevaTitle, amount, panNumber } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Valid donation amount required' });
    }

    const [insertResult]: any = await pool.query(
      `INSERT INTO seva_bookings 
        (devotee_id, seva_id, seva_title, category, amount, status, sankalpam_data) 
       VALUES (?, ?, ?, 'corpus', ?, 'PENDING', ?)`,
      [
        String(req.devoteeId),
        parseInt(String(sevaId), 10) || 0,
        String(sevaTitle || 'Ashram Donation (80G)'),
        Number(amount),
        JSON.stringify({ panNumber: panNumber || '' }),
      ]
    );

    const bookingId = insertResult.insertId;

    const order = await donationRazorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: 'INR',
      receipt: `DONATION_${bookingId}`,
      notes: { bookingId: String(bookingId), devoteeId: String(req.devoteeId), category: '80G' },
    });

    await pool.query('UPDATE seva_bookings SET razorpay_order_id = ? WHERE id = ?', [
      order.id,
      bookingId,
    ]);

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: key_id,
      bookingId,
    });
  } catch (error: any) {
    console.error('❌ Donation Order Error:', error);
    return res.status(500).json({
      message: error?.error?.description || error?.message || 'Failed to create Donation order',
    });
  }
});

// POST /api/v1/payment/donation/verify
router.post('/verify', authDevotee, async (req: any, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await pool.query('UPDATE seva_bookings SET status = "FAILED" WHERE id = ?', [bookingId]);
      return res.status(400).json({ message: 'Signature verification failed' });
    }

    const year = new Date().getFullYear();
    const receiptNo = `VDA-80G-${year}-${Math.floor(100000 + Math.random() * 900000)}`;

    await pool.query(
      `UPDATE seva_bookings SET 
        status = 'SUCCESS',
        razorpay_payment_id = ?,
        razorpay_signature = ?,
        receipt_no = ?
       WHERE id = ? AND devotee_id = ?`,
      [razorpay_payment_id, razorpay_signature, receiptNo, bookingId, String(req.devoteeId)]
    );

    return res.json({ success: true, receiptNo, bookingId });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Verification failed' });
  }
});

export default router;