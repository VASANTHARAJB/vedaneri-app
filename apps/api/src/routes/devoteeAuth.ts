import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../db';
import { config } from '../config';
import { sendOtpEmail, sendResetEmail } from '../lib/mailer';

const router = Router();
const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET || 'vedaneri-ashram-secret-key';
const TOKEN_LIFETIME = '24h';
const IS_PROD = process.env.NODE_ENV === 'production';

if (IS_PROD && !(config.jwtSecret || process.env.JWT_SECRET)) {
  console.error('[Auth] JWT_SECRET is not set. Set it before running in production.');
}

// ---------- Uploads (images only) ----------
const uploadDir = path.resolve(__dirname, '../../uploads/avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || '.jpg';
    cb(null, `devotee-${Date.now()}-${crypto.randomInt(0, 10000)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (EXT_BY_MIME[file.mimetype]) return cb(null, true);
    cb(new Error('Only JPG, PNG or WebP images are allowed.'));
  },
});

// ---------- Allowed characters ----------
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,59}$/u;
const EMAIL_RE = /^[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const CODE_RE = /^\+\d{1,4}$/;
const TEXT_BAD = /[^\p{L}\p{M}\p{N} ().'-]/gu;
const cleanText = (v: any, max = 80) => String(v ?? '').replace(TEXT_BAD, '').replace(/\s{2,}/g, ' ').trim().slice(0, max);
const cleanNameLoose = (v: any) => String(v ?? '').replace(/[^\p{L}\p{M} .'-]/gu, '').replace(/\s{2,}/g, ' ').trim().slice(0, 60);

// ---------- Simple in-memory rate limiter ----------
type Hit = { count: number; resetAt: number };
const hits = new Map<string, Hit>();

function overLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  h.count += 1;
  return h.count > max;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
}, 5 * 60 * 1000).unref();

const ipOf = (req: Request) => String(req.ip || req.socket.remoteAddress || 'unknown');

const tooMany = (res: Response) =>
  res.status(429).json({ message: 'Too many attempts. Please wait a few minutes and try again.' });

// ---------- Helpers ----------
const newOtp = () => String(crypto.randomInt(100000, 1000000));

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function issueToken(d: any): string {
  return jwt.sign(
    { id: d.id, email: d.email, name: `${d.first_name} ${d.last_name}`.trim() },
    JWT_SECRET,
    { expiresIn: TOKEN_LIFETIME }
  );
}

function runUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('photo')(req, res, (err: any) => {
    if (err) return res.status(400).json({ message: err.message || 'Photo upload failed.' });
    next();
  });
}

// 1. REGISTER / CREATE ACCOUNT
router.post('/register', runUpload, async (req: Request, res: Response) => {
  const fail = (status: number, message: string) => {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(status).json({ message });
  };

  try {
    if (overLimit(`reg:${ipOf(req)}`, 10, 60 * 60 * 1000)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return tooMany(res);
    }

    const {
      first_name, last_name, email, phone, country_code = '+91',
      password, confirm_password, rasi, nakshathiram, gothram, terms_accepted,
    } = req.body || {};

    const termsOk = terms_accepted === true || terms_accepted === 'true' || terms_accepted === '1' || terms_accepted === 1;
    if (!termsOk) return fail(400, 'You must accept the Terms and Conditions.');

    if (!first_name || !last_name || !email || !phone || !password) {
      return fail(400, 'All mandatory fields are required.');
    }

    const firstName = String(first_name).trim();
    const lastName = String(last_name).trim();
    if (!NAME_RE.test(firstName)) return fail(400, 'First name can contain only letters, spaces and . \' -');
    if (!NAME_RE.test(lastName)) return fail(400, 'Last name can contain only letters, spaces and . \' -');

    const cleanEmail = String(email).trim().toLowerCase();
    if (cleanEmail.length > 100 || !EMAIL_RE.test(cleanEmail)) return fail(400, 'Please enter a valid email address.');

    const code = String(country_code).trim();
    if (!CODE_RE.test(code)) return fail(400, 'Invalid country code.');
    const phoneDigits = String(phone).replace(/\D/g, '');
    if (phoneDigits.length < 6 || phoneDigits.length > 15) return fail(400, 'Please enter a valid mobile number.');
    const cleanPhone = `${code}${phoneDigits}`;

    if (typeof password !== 'string' || password.length < 8) return fail(400, 'Password must be at least 8 characters.');
    if (password.length > 72) return fail(400, 'Password must be 72 characters or fewer.');
    if (password !== confirm_password) return fail(400, 'Password and Confirm Password do not match.');

    const rasiV = cleanText(rasi);
    const nakV = cleanText(nakshathiram);
    const gothV = cleanText(gothram);

    const [existing]: any = await pool.query(
      'SELECT id, email, phone, is_verified FROM devotees WHERE email = ? OR phone = ? LIMIT 1',
      [cleanEmail, cleanPhone]
    );

    const passwordHash = await bcrypt.hash(password, 10);
    const otpCode = newOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    const avatarUrl = req.file ? `/uploads/avatars/${req.file.filename}` : null;

    if (existing.length > 0) {
      const match = existing[0];

      if (match.is_verified === 1 || match.email !== cleanEmail) {
        return fail(400, 'An account with this email/mobile already exists. Please sign in.');
      }

      await pool.query(
        `UPDATE devotees SET first_name = ?, last_name = ?, password_hash = ?, otp_code = ?, otp_expires_at = ?,
           avatar_url = COALESCE(?, avatar_url)
         WHERE id = ?`,
        [firstName, lastName, passwordHash, otpCode, otpExpires, avatarUrl, match.id]
      );

      try {
        await sendOtpEmail(cleanEmail, otpCode, firstName);
      } catch (err: any) {
        console.error('Gmail SMTP Delivery Error:', err?.message || err);
      }

      return res.status(200).json({
        message: 'Account pending verification. A fresh OTP has been sent to your email.',
        email: cleanEmail,
        devoteeId: match.id,
      });
    }

    const devoteeId = `dev_${Date.now()}_${crypto.randomInt(0, 10000)}`;

    await pool.query(
      `INSERT INTO devotees
        (id, first_name, last_name, email, phone, password_hash, avatar_url, otp_code, otp_expires_at, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [devoteeId, firstName, lastName, cleanEmail, cleanPhone, passwordHash, avatarUrl, otpCode, otpExpires]
    );

    if (rasiV || nakV || gothV) {
      await pool.query(
        `INSERT INTO devotee_family_members (devotee_id, title, name, gothram, nakshathiram, rasi, relation)
         VALUES (?, 'Sri', ?, ?, ?, ?, 'Self')`,
        [devoteeId, `${firstName} ${lastName}`, gothV, nakV, rasiV]
      );
    }

    try {
      await sendOtpEmail(cleanEmail, otpCode, firstName);
    } catch (err: any) {
      console.error('Gmail SMTP Delivery Error:', err?.message || err);
    }

    return res.status(201).json({
      message: 'Account created! Please verify the OTP sent to your email.',
      email: cleanEmail,
      devoteeId,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return fail(500, 'Registration failed. Please try again.');
  }
});

// 2. RESEND OTP (sign-up verification)
router.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ message: 'A valid email is required' });

    if (overLimit(`resend-min:${email}`, 1, 60 * 1000) || overLimit(`resend-hr:${email}`, 5, 60 * 60 * 1000) || overLimit(`resend-ip:${ipOf(req)}`, 20, 60 * 60 * 1000)) {
      return tooMany(res);
    }

    const generic = { message: 'If this email has a pending account, a new OTP has been sent.', email };

    const [rows]: any = await pool.query(
      'SELECT id, first_name, is_verified FROM devotees WHERE email = ? LIMIT 1',
      [email]
    );

    if (!rows.length || rows[0].is_verified === 1) return res.json(generic);

    const devotee = rows[0];
    const otpCode = newOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query('UPDATE devotees SET otp_code = ?, otp_expires_at = ? WHERE id = ?', [otpCode, otpExpires, devotee.id]);

    try {
      await sendOtpEmail(email, otpCode, devotee.first_name);
    } catch (err: any) {
      console.error('Gmail SMTP Delivery Error:', err?.message || err);
    }

    return res.json(generic);
  } catch (error: any) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ message: 'Failed to resend OTP. Please try again.' });
  }
});

// 3. VERIFY OTP (sign-up)
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();

    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ message: 'The OTP must be 6 digits.' });

    if (overLimit(`otp:${email}`, 5, 10 * 60 * 1000) || overLimit(`otp-ip:${ipOf(req)}`, 30, 10 * 60 * 1000)) {
      return tooMany(res);
    }

    const [rows]: any = await pool.query(
      'SELECT id, email, first_name, last_name, otp_code, otp_expires_at FROM devotees WHERE email = ? LIMIT 1',
      [email]
    );

    if (!rows.length) return res.status(400).json({ message: 'Invalid OTP code' });
    const devotee = rows[0];

    if (!devotee.otp_code || !safeEqual(String(devotee.otp_code), otp)) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }
    if (new Date() > new Date(devotee.otp_expires_at)) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    await pool.query('UPDATE devotees SET is_verified = 1, otp_code = NULL, otp_expires_at = NULL WHERE id = ?', [devotee.id]);
    hits.delete(`otp:${email}`);

    return res.json({
      message: 'Account verified successfully!',
      token: issueToken(devotee),
      devotee: { id: devotee.id, first_name: devotee.first_name, last_name: devotee.last_name, email: devotee.email },
    });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ message: 'OTP verification failed. Please try again.' });
  }
});

// 4. DEVOTEE LOGIN
router.post('/login', async (req: Request, res: Response) => {
  try {
    const identifier = String(req.body?.identifier || '').trim();
    const password = req.body?.password;
    const terms_accepted = req.body?.terms_accepted;

    if (!terms_accepted) return res.status(400).json({ message: 'Please accept Terms and Conditions to login.' });
    if (!identifier || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Email/Phone and Password are required.' });
    }
    if (password.length > 72) return res.status(401).json({ message: 'Invalid credentials.' });

    const idKey = identifier.toLowerCase();
    if (overLimit(`login:${ipOf(req)}:${idKey}`, 8, 15 * 60 * 1000) || overLimit(`login-ip:${ipOf(req)}`, 60, 15 * 60 * 1000)) {
      return tooMany(res);
    }

    let rows: any;
    if (identifier.includes('@')) {
      const email = identifier.toLowerCase();
      if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email or mobile number.' });
      [rows] = await pool.query('SELECT * FROM devotees WHERE email = ? LIMIT 1', [email]);
    } else {
      if (/[^\d+\s-]/.test(identifier)) return res.status(400).json({ message: 'Enter a valid email or mobile number.' });
      const digits = identifier.replace(/\D/g, '');
      if (digits.length < 6) return res.status(400).json({ message: 'Enter a valid email or mobile number.' });
      const last10 = digits.slice(-10);
      [rows] = await pool.query('SELECT * FROM devotees WHERE RIGHT(phone, 10) = ? LIMIT 1', [last10]);
    }

    const invalid = { message: 'Invalid credentials. Please check your details and try again.' };
    if (!rows.length) return res.status(401).json(invalid);

    const devotee = rows[0];

    if (!devotee.password_hash) {
      return res.status(400).json({
        message: 'This account uses Google sign-in. Use Continue with Google, or choose Forgot password to set a password.',
      });
    }

    const isMatch = await bcrypt.compare(password, devotee.password_hash);
    if (!isMatch) return res.status(401).json(invalid);

    if (devotee.is_verified === 0) {
      return res.status(403).json({
        message: 'Account not verified. Please verify OTP first.',
        requiresOtp: true,
        email: devotee.email,
      });
    }

    hits.delete(`login:${ipOf(req)}:${idKey}`);

    return res.json({
      message: 'Login successful',
      token: issueToken(devotee),
      devotee: {
        id: devotee.id,
        first_name: devotee.first_name,
        last_name: devotee.last_name,
        email: devotee.email,
        phone: devotee.phone,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// 5. FORGOT PASSWORD: send a 6 digit code to the account's email
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });

    if (overLimit(`forgot-min:${email}`, 1, 60 * 1000) || overLimit(`forgot-hr:${email}`, 5, 60 * 60 * 1000) || overLimit(`forgot-ip:${ipOf(req)}`, 20, 60 * 60 * 1000)) {
      return tooMany(res);
    }

    // Same answer whether or not the account exists, so emails cannot be probed
    const generic = { message: 'If this email is registered, a reset code has been sent.', email };

    const [rows]: any = await pool.query('SELECT id, first_name FROM devotees WHERE email = ? LIMIT 1', [email]);
    if (!rows.length) return res.json(generic);

    const otpCode = newOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query('UPDATE devotees SET otp_code = ?, otp_expires_at = ? WHERE id = ?', [otpCode, otpExpires, rows[0].id]);

    try {
      await sendResetEmail(email, otpCode, rows[0].first_name);
    } catch (err: any) {
      console.error('Gmail SMTP Delivery Error:', err?.message || err);
    }

    return res.json(generic);
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Could not send the code. Please try again.' });
  }
});

// 6. RESET PASSWORD: check the code and save the new password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();
    const newPassword = req.body?.new_password;

    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ message: 'The code must be 6 digits.' });
    if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    if (newPassword.length > 72) return res.status(400).json({ message: 'Password must be 72 characters or fewer.' });

    if (overLimit(`reset:${email}`, 5, 10 * 60 * 1000) || overLimit(`reset-ip:${ipOf(req)}`, 30, 10 * 60 * 1000)) {
      return tooMany(res);
    }

    const [rows]: any = await pool.query(
      'SELECT id, otp_code, otp_expires_at FROM devotees WHERE email = ? LIMIT 1',
      [email]
    );
    const bad = { message: 'The code is not correct or has expired.' };
    if (!rows.length) return res.status(400).json(bad);

    const d = rows[0];
    if (!d.otp_code || !safeEqual(String(d.otp_code), otp)) return res.status(400).json(bad);
    if (!d.otp_expires_at || new Date() > new Date(d.otp_expires_at)) return res.status(400).json(bad);

    const hash = await bcrypt.hash(newPassword, 10);
    // Having the code proves the person owns this email, so the account is marked verified
    await pool.query(
      'UPDATE devotees SET password_hash = ?, is_verified = 1, otp_code = NULL, otp_expires_at = NULL WHERE id = ?',
      [hash, d.id]
    );
    hits.delete(`reset:${email}`);
    hits.delete(`login:${ipOf(req)}:${email}`);

    return res.json({ message: 'Password changed. Please sign in with your new password.' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Could not change the password. Please try again.' });
  }
});

// 7. GOOGLE SIGN-IN / SIGN-UP (the browser sends Google's signed token; it is checked here)
let googleClient: OAuth2Client | null = null;
const googleId = () => (process.env.GOOGLE_CLIENT_ID || '').replace(/["'\s]/g, '');

router.post('/google', async (req: Request, res: Response) => {
  try {
    const clientId = googleId();
    if (!clientId) return res.status(503).json({ message: 'Google sign-in is not available right now.' });

    if (overLimit(`google:${ipOf(req)}`, 30, 15 * 60 * 1000)) return tooMany(res);

    const credential = req.body?.credential;
    if (typeof credential !== 'string' || credential.length < 20 || credential.length > 4096) {
      return res.status(400).json({ message: 'Google sign-in failed. Please try again.' });
    }

    if (!googleClient) googleClient = new OAuth2Client(clientId);
    let payload: any;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ message: 'Google sign-in could not be verified. Please try again.' });
    }

    const email = String(payload?.email || '').trim().toLowerCase();
    const sub = String(payload?.sub || '');
    if (!payload?.email_verified || !email || !sub || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Your Google email is not verified.' });
    }

    const [rows]: any = await pool.query('SELECT * FROM devotees WHERE email = ? OR google_id = ? LIMIT 1', [email, sub]);

    let devotee: any;
    if (rows.length) {
      devotee = rows[0];
      if (devotee.google_id && devotee.google_id !== sub) {
        return res.status(400).json({ message: 'This email is linked to a different Google account.' });
      }
      // Google has verified this email, so an unverified account becomes verified and is linked
      await pool.query('UPDATE devotees SET google_id = ?, is_verified = 1, otp_code = NULL, otp_expires_at = NULL WHERE id = ?', [sub, devotee.id]);
    } else {
      const id = `dev_${Date.now()}_${crypto.randomInt(0, 10000)}`;
      const first = cleanNameLoose(payload.given_name) || cleanNameLoose(String(payload.name || '').split(' ')[0]) || 'Devotee';
      const last = cleanNameLoose(payload.family_name) || '';
      const picture = typeof payload.picture === 'string' && payload.picture.startsWith('https://') ? payload.picture.slice(0, 500) : null;

      await pool.query(
        `INSERT INTO devotees (id, first_name, last_name, email, phone, google_id, avatar_url, is_verified)
         VALUES (?, ?, ?, ?, '', ?, ?, 1)`,
        [id, first, last, email, sub, picture]
      );
      devotee = { id, first_name: first, last_name: last, email, phone: '' };
    }

    return res.json({
      message: 'Login successful',
      token: issueToken(devotee),
      devotee: {
        id: devotee.id,
        first_name: devotee.first_name,
        last_name: devotee.last_name,
        email: devotee.email,
        phone: devotee.phone || '',
      },
    });
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    return res.status(500).json({ message: 'Google sign-in failed. Please try again.' });
  }
});

export default router;