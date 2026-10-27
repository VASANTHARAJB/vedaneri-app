import { Router, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { config } from '../config';

const router = Router();
const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET || 'vedaneri-ashram-secret-key';
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const idKeyHex = () => (process.env.DONATION_ID_KEY || '').replace(/["'\s]/g, '');

function encryptValue(plain: string): string {
  const key = Buffer.from(idKeyHex(), 'hex');
  if (key.length !== 32) throw new Error('Encryption key not configured');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

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

// The donor's own donations only. PAN and Aadhaar are never returned.
router.get('/my-donations', authDevotee, async (req: any, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, receipt_no, fund_title, category, amount, status,
              DATE_FORMAT(booking_date, '%Y-%m-%d') AS donation_date, created_at
       FROM donation_booking WHERE devotee_id = ? ORDER BY id DESC LIMIT 100`,
      [String(req.devoteeId)]
    );
    return res.json({ donations: rows || [] });
  } catch (e: any) {
    console.error('My donations error:', e?.message || e);
    return res.status(500).json({ donations: [], message: 'Failed to load donations' });
  }
});

// Save or replace PAN and Aadhaar
router.put('/ids', authDevotee, async (req: any, res: Response) => {
  try {
    if (!/^[0-9a-fA-F]{64}$/.test(idKeyHex())) {
      return res.status(503).json({ message: 'Saving is temporarily unavailable.' });
    }
    const pan = String(req.body?.panNumber || '').trim().toUpperCase();
    const aadhaar = String(req.body?.aadhaarNumber || '').replace(/\s/g, '');
    if (!PAN_REGEX.test(pan)) return res.status(400).json({ message: 'Please enter a valid PAN (for example ABCDE1234F)', code: 'INVALID_PAN' });
    if (!isValidAadhaar(aadhaar)) return res.status(400).json({ message: 'Please enter a valid 12-digit Aadhaar number', code: 'INVALID_AADHAAR' });

    await pool.query(
      `INSERT INTO donor_ids (devotee_id, pan_number, aadhaar_enc, aadhaar_last4) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE pan_number = VALUES(pan_number), aadhaar_enc = VALUES(aadhaar_enc), aadhaar_last4 = VALUES(aadhaar_last4)`,
      [String(req.devoteeId), pan, encryptValue(aadhaar), aadhaar.slice(-4)]
    );
    return res.json({ saved: true, panMasked: `XXXXXX${pan.slice(6)}`, aadhaarMasked: `XXXX XXXX ${aadhaar.slice(-4)}` });
  } catch (e: any) {
    console.error('Save ids error:', e?.message || e);
    return res.status(500).json({ message: 'Could not save. Please try again.' });
  }
});

// Remove the saved numbers (past receipts are kept as they are)
router.delete('/ids', authDevotee, async (req: any, res: Response) => {
  try {
    await pool.query('DELETE FROM donor_ids WHERE devotee_id = ?', [String(req.devoteeId)]);
    return res.json({ removed: true });
  } catch (e: any) {
    console.error('Remove ids error:', e?.message || e);
    return res.status(500).json({ message: 'Could not remove. Please try again.' });
  }
});

export default router;