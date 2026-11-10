import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import Razorpay from 'razorpay';
import { pool } from '../db';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const router = Router();
const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET || 'vedaneri-ashram-secret-key';
const HOLD_MINUTES = 15;

// ---------- Razorpay: two accounts. Each camp chooses one. ----------
type Acct = 'seva' | 'donation';
const clean = (v?: string) => (v || '').replace(/["'\s]/g, '');
const ORG: Record<Acct, string> = {
  seva: 'SRI DAKSHINAMURTI SEVA SAMITI',
  donation: 'VEDANTA SASTHRA PRACHARA TRUST',
};
const acctOf = (v: any): Acct => (v === 'donation' ? 'donation' : 'seva');

function keysFor(a: Acct) {
  const p = a === 'donation' ? 'RAZORPAY_DONATION' : 'RAZORPAY_SEVA';
  return { id: clean(process.env[`${p}_KEY_ID`]), secret: clean(process.env[`${p}_KEY_SECRET`]) };
}
const clients: Record<string, Razorpay> = {};
function client(a: Acct): Razorpay {
  const k = keysFor(a);
  if (!k.id || !k.secret) throw new Error('NOT_CONFIGURED');
  const key = `${a}:${k.id}`;
  if (!clients[key]) clients[key] = new Razorpay({ key_id: k.id, key_secret: k.secret });
  return clients[key];
}

// ---------- Uploads (images only) ----------
const uploadDir = path.resolve(__dirname, '../../uploads/camps');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, uploadDir),
    filename: (_r, f, cb) => cb(null, `camp-${Date.now()}-${crypto.randomInt(0, 10000)}${EXT[f.mimetype] || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => (EXT[f.mimetype] ? cb(null, true) : cb(new Error('Only JPG, PNG or WebP images are allowed.'))),
});

function runUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('image')(req, res, (err: any) => {
    if (err) return res.status(400).json({ message: err.message || 'Image upload failed.' });
    next();
  });
}

// ---------- Attendee ID proof + photo (kept OUTSIDE the public /uploads folder) ----------
const privateDir = path.resolve(__dirname, '../../private/camp');
if (!fs.existsSync(privateDir)) fs.mkdirSync(privateDir, { recursive: true });

const idKeyBuf = (): Buffer | null => {
  const k = clean(process.env.CAMP_ID_KEY) || clean(process.env.DONATION_ID_KEY);
  return /^[0-9a-fA-F]{64}$/.test(k) ? Buffer.from(k, 'hex') : null;
};
function encryptValue(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}
function decryptValue(blob: string, key: Buffer): string {
  const [iv, tag, enc] = blob.split(':').map((p) => Buffer.from(p, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

type IdType = 'aadhaar' | 'pan' | 'voter' | 'passport';
const ID_TYPES: IdType[] = ['aadhaar', 'pan', 'voter', 'passport'];
const CHILD_ID_TYPES: IdType[] = ['aadhaar', 'pan', 'passport']; // a Voter ID needs age 18+

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
  const d = a.split('').reverse().map(Number);
  for (let i = 0; i < d.length; i++) c = VD[c][VP[i % 8][d[i]]];
  return c === 0;
}
const normalizeId = (v: string) => String(v || '').replace(/[\s-]/g, '').toUpperCase();
function idProblem(type: IdType, n: string): string | null {
  if (type === 'aadhaar') return isValidAadhaar(n) ? null : 'Enter a valid 12-digit Aadhaar number.';
  if (type === 'pan') return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(n) ? null : 'Enter a valid PAN (for example ABCDE1234F).';
  if (type === 'voter') return /^[A-Z]{3}[0-9]{7}$/.test(n) ? null : 'Enter a valid Voter ID (EPIC) number (for example ABC1234567).';
  return /^[A-Z][0-9]{7}$/.test(n) ? null : 'Enter a valid passport number (for example A1234567).';
}

// The file type is read from the file itself, not from what the browser says
function sniffFile(full: string): string | null {
  let fd = -1;
  try {
    fd = fs.openSync(full, 'r');
    const b = Buffer.alloc(12);
    const n = fs.readSync(fd, b, 0, 12, 0);
    if (n < 12) return null;
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
    if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
    if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
    return null;
  } catch {
    return null;
  } finally {
    if (fd >= 0) fs.closeSync(fd);
  }
}
const PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOC_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf']);

const attendeeUpload = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, privateDir),
    filename: (_r, _f, cb) => cb(null, crypto.randomBytes(16).toString('hex')),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 50, fields: 40, fieldSize: 20000 },
});
function runRegisterUpload(req: Request, res: Response, next: NextFunction) {
  attendeeUpload.any()(req, res, (err: any) => {
    if (err) {
      const files = (req.files as Express.Multer.File[]) || [];
      files.forEach((f) => fs.unlink(f.path, () => {}));
      const big = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({ message: big ? 'Each file must be 5 MB or smaller.' : 'The upload could not be read. Please try again.' });
    }
    next();
  });
}

let attendeeTable: Promise<void> | null = null;
function ensureAttendeeTable(): Promise<void> {
  if (!attendeeTable) {
    attendeeTable = pool
      .query(
        `CREATE TABLE IF NOT EXISTS camp_attendees (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          registration_id INT NOT NULL,
          camp_id VARCHAR(36) NOT NULL,
          seq SMALLINT UNSIGNED NOT NULL,
          kind ENUM('adult','child') NOT NULL DEFAULT 'adult',
          name VARCHAR(150) NOT NULL,
          id_type ENUM('aadhaar','pan','voter','passport') NOT NULL,
          id_last4 CHAR(4) NOT NULL,
          id_number_enc TEXT NOT NULL,
          id_hash CHAR(64) NOT NULL,
          id_doc_file VARCHAR(80) NOT NULL,
          id_doc_mime VARCHAR(40) NOT NULL,
          photo_file VARCHAR(80) NOT NULL,
          photo_mime VARCHAR(40) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_camp_attendees_reg (registration_id),
          KEY idx_camp_attendees_camp_hash (camp_id, id_hash)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      )
      .then(() => undefined)
      .catch((e) => {
        attendeeTable = null;
        throw e;
      });
  }
  return attendeeTable;
}

// Removes the attendees of a registration together with their files
async function purgeAttendees(registrationId: number | string): Promise<void> {
  try {
    await ensureAttendeeTable();
    const [rows]: any = await pool.query('SELECT id_doc_file, photo_file FROM camp_attendees WHERE registration_id = ?', [registrationId]);
    for (const r of rows || []) {
      [r.id_doc_file, r.photo_file].forEach((f: string) => f && fs.unlink(path.join(privateDir, path.basename(f)), () => {}));
    }
    await pool.query('DELETE FROM camp_attendees WHERE registration_id = ?', [registrationId]);
  } catch (e: any) {
    console.error('[Camps] purgeAttendees failed:', e?.message || e);
  }
}

const adminGuard = (req: Request, res: Response, next: NextFunction) =>
  authenticate(req as AuthenticatedRequest, res, next);

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

// ---------- Helpers ----------
const STATUSES = ['draft', 'published', 'closed'];
const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z').getTime());
const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const todayYmd = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
const str = (v: any, max: number) => String(v ?? '').trim().slice(0, max);

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,59}$/u;
const PLACE_RE = /^[\p{L}\p{M}][\p{L}\p{M} .-]{0,59}$/u;
const EMAIL_RE = /^[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const CODE_RE = /^\+\d{1,4}$/;
const NOTE_BAD = /[^\p{L}\p{M}\p{N} ,.\-/#():;!?'\n]/gu;

function slugify(t: string) {
  return (t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'camp').slice(0, 100);
}

async function uniqueSlug(base: string, exceptId?: string) {
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const [rows]: any = await pool.query('SELECT id FROM camps WHERE slug = ? LIMIT 1', [slug]);
    if (!rows.length || rows[0].id === exceptId) return slug;
    slug = `${base}-${crypto.randomInt(100, 9999)}`;
  }
  return `${base}-${Date.now()}`;
}

function readBody(b: any): { error?: string; v?: any } {
  const title_en = str(b.title_en, 255);
  if (!title_en) return { error: 'Please enter the camp title in English.' };
  const start_date = str(b.start_date, 10);
  const end_date = str(b.end_date, 10) || start_date;
  if (!isYmd(start_date)) return { error: 'Please choose a valid start date.' };
  if (!isYmd(end_date)) return { error: 'Please choose a valid end date.' };
  if (end_date < start_date) return { error: 'The end date cannot be before the start date.' };
  const start_time = str(b.start_time, 5);
  const end_time = str(b.end_time, 5);
  if (start_time && !isTime(start_time)) return { error: 'Start time is not valid.' };
  if (end_time && !isTime(end_time)) return { error: 'End time is not valid.' };
  const status = STATUSES.includes(b.status) ? b.status : 'draft';
  const fee_type = b.fee_type === 'paid' ? 'paid' : 'free';
  const fee_amount = fee_type === 'paid' ? Math.round(Number(b.fee_amount) * 100) / 100 : 0;
  if (fee_type === 'paid' && !(fee_amount > 0)) return { error: 'Enter a fee amount greater than 0, or choose Free.' };
  const seats = Math.floor(Number(b.seats) || 0);
  if (seats < 0 || seats > 100000) return { error: 'Seats must be 0 (unlimited) or more.' };
  return {
    v: {
      title_en,
      title_ta: str(b.title_ta, 255) || null,
      description_en: str(b.description_en, 5000) || null,
      description_ta: str(b.description_ta, 5000) || null,
      venue_en: str(b.venue_en, 255) || null,
      venue_ta: str(b.venue_ta, 255) || null,
      start_date, end_date,
      start_time: start_time || null,
      end_time: end_time || null,
      fee_type, fee_amount, seats, status,
      pay_account: acctOf(b.pay_account),
    },
  };
}

// Seats taken = confirmed registrations + unpaid ones still inside the hold time
const HELD = `(r.status = 'REGISTERED' OR (r.status = 'PENDING' AND r.created_at > (NOW() - INTERVAL ${HOLD_MINUTES} MINUTE)))`;
const CAMP_SELECT = `SELECT c.*, DATE_FORMAT(c.start_date,'%Y-%m-%d') AS sd, DATE_FORMAT(c.end_date,'%Y-%m-%d') AS ed,
  COALESCE((SELECT SUM(r.members) FROM camp_registrations r WHERE r.camp_id = c.id AND ${HELD}), 0) AS registered
  FROM camps c`;
const shape = (r: any) => ({ ...r, start_date: r.sd, end_date: r.ed, registered: Number(r.registered) || 0, fee_amount: Number(r.fee_amount) || 0 });

// =================== ADMIN (CMS) ===================
router.get('/admin/list', adminGuard, async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(`${CAMP_SELECT} ORDER BY c.start_date DESC, c.created_at DESC LIMIT 500`);
    return res.json({ camps: rows.map(shape) });
  } catch (e: any) {
    console.error('Camps list error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to load camps' });
  }
});

router.post('/admin', adminGuard, runUpload, async (req: Request, res: Response) => {
  const drop = () => req.file && fs.unlink(req.file.path, () => {});
  try {
    const r = readBody(req.body || {});
    if (r.error) { drop(); return res.status(400).json({ message: r.error }); }
    const v = r.v;
    const id = crypto.randomUUID();
    const slug = await uniqueSlug(slugify(v.title_en));
    const image = req.file ? `/uploads/camps/${req.file.filename}` : null;
    await pool.query(
      `INSERT INTO camps (id, slug, title_en, title_ta, description_en, description_ta, venue_en, venue_ta, start_date, end_date,
         start_time, end_time, image_url, fee_type, fee_amount, seats, status, pay_account)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, slug, v.title_en, v.title_ta, v.description_en, v.description_ta, v.venue_en, v.venue_ta, v.start_date, v.end_date,
       v.start_time, v.end_time, image, v.fee_type, v.fee_amount, v.seats, v.status, v.pay_account]
    );
    return res.status(201).json({ id, slug });
  } catch (e: any) {
    drop();
    console.error('Camp create error:', e?.message || e);
    return res.status(500).json({ message: 'Could not save the camp.' });
  }
});

router.put('/admin/:id', adminGuard, runUpload, async (req: Request, res: Response) => {
  const drop = () => req.file && fs.unlink(req.file.path, () => {});
  try {
    const r = readBody(req.body || {});
    if (r.error) { drop(); return res.status(400).json({ message: r.error }); }
    const v = r.v;
    const [cur]: any = await pool.query('SELECT image_url FROM camps WHERE id = ? LIMIT 1', [req.params.id]);
    if (!cur.length) { drop(); return res.status(404).json({ message: 'Camp not found' }); }

    const removeImage = req.body?.remove_image === 'true';
    let image: string | null = cur[0].image_url;
    if (req.file) image = `/uploads/camps/${req.file.filename}`;
    else if (removeImage) image = null;

    await pool.query(
      `UPDATE camps SET title_en=?, title_ta=?, description_en=?, description_ta=?, venue_en=?, venue_ta=?, start_date=?, end_date=?,
         start_time=?, end_time=?, image_url=?, fee_type=?, fee_amount=?, seats=?, status=?, pay_account=? WHERE id=?`,
      [v.title_en, v.title_ta, v.description_en, v.description_ta, v.venue_en, v.venue_ta, v.start_date, v.end_date,
       v.start_time, v.end_time, image, v.fee_type, v.fee_amount, v.seats, v.status, v.pay_account, req.params.id]
    );
    return res.json({ saved: true });
  } catch (e: any) {
    drop();
    console.error('Camp update error:', e?.message || e);
    return res.status(500).json({ message: 'Could not save the camp.' });
  }
});

router.patch('/admin/:id/status', adminGuard, async (req: Request, res: Response) => {
  try {
    if (!STATUSES.includes(req.body?.status)) return res.status(400).json({ message: 'Invalid status' });
    await pool.query('UPDATE camps SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
    return res.json({ saved: true });
  } catch (e: any) {
    console.error('Camp status error:', e?.message || e);
    return res.status(500).json({ message: 'Could not change the status.' });
  }
});

router.delete('/admin/:id', adminGuard, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM camps WHERE id = ?', [req.params.id]);
    return res.json({ removed: true });
  } catch (e: any) {
    console.error('Camp delete error:', e?.message || e);
    return res.status(500).json({ message: 'Could not delete the camp.' });
  }
});

router.get('/admin/:id/registrations', adminGuard, async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, name, first_name, last_name, phone, email, members, adults, children, city, state, notes, status,
              amount, payment_status, razorpay_payment_id, created_at
       FROM camp_registrations WHERE camp_id = ? AND status <> 'FAILED' ORDER BY id DESC LIMIT 2000`,
      [req.params.id]
    );
    return res.json({ registrations: rows });
  } catch (e: any) {
    console.error('Camp registrations error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to load registrations' });
  }
});

// CSV that opens in Excel. Cells starting with = + - @ are neutralised.
const cell = (v: any) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

router.get('/admin/:id/registrations/export', adminGuard, async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT first_name, last_name, name, phone, email, adults, children, members, city, state, notes, status,
              amount, payment_status, razorpay_payment_id, created_at
       FROM camp_registrations WHERE camp_id = ? AND status <> 'FAILED' ORDER BY id ASC`,
      [req.params.id]
    );
    const head = ['First name', 'Last name', 'Mobile', 'Email', 'Adults', 'Children', 'Total people', 'City', 'State', 'Note', 'Status',
      'Amount', 'Payment', 'Payment id', 'Registered on'];
    const lines = [head.map(cell).join(',')];
    for (const r of rows) {
      const first = r.first_name || String(r.name || '').split(' ')[0] || '';
      const last = r.last_name || String(r.name || '').split(' ').slice(1).join(' ');
      lines.push(
        [first, last, r.phone, r.email, r.adults, r.children, r.members, r.city, r.state, r.notes, r.status,
          r.amount, r.payment_status, r.razorpay_payment_id,
          r.created_at ? new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' ') : '']
          .map(cell).join(',')
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="camp-registrations.csv"');
    return res.send('\uFEFF' + lines.join('\r\n'));
  } catch (e: any) {
    console.error('Camp export error:', e?.message || e);
    return res.status(500).json({ message: 'Export failed' });
  }
});

// ----- Attendees of a camp: who is coming, with which ID (CMS login required) -----
router.get('/admin/:id/attendees', adminGuard, async (req: Request, res: Response) => {
  try {
    await ensureAttendeeTable();
    const [rows]: any = await pool.query(
      `SELECT a.id, a.registration_id, a.seq, a.kind, a.name, a.id_type, a.id_last4, a.created_at,
              r.status, r.payment_status, r.first_name AS reg_first, r.last_name AS reg_last, r.phone AS reg_phone
         FROM camp_attendees a JOIN camp_registrations r ON r.id = a.registration_id
        WHERE a.camp_id = ? AND r.status <> 'FAILED' ORDER BY a.registration_id DESC, a.seq ASC LIMIT 5000`,
      [req.params.id]
    );
    res.set('Cache-Control', 'no-store');
    return res.json({ attendees: rows });
  } catch (e: any) {
    console.error('Camp attendees error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to load attendees' });
  }
});

// The photo or ID document itself (the CMS fetches it with its login token and shows it)
router.get('/admin/attendee/:attId/file/:kind', adminGuard, async (req: Request, res: Response) => {
  try {
    const kind = req.params.kind === 'photo' ? 'photo' : req.params.kind === 'doc' ? 'doc' : '';
    if (!kind) return res.status(400).json({ message: 'Invalid file type' });
    await ensureAttendeeTable();
    const [rows]: any = await pool.query('SELECT id_doc_file, id_doc_mime, photo_file, photo_mime FROM camp_attendees WHERE id = ? LIMIT 1', [Number(req.params.attId)]);
    const r = rows?.[0];
    if (!r) return res.status(404).json({ message: 'Not found' });
    const full = path.join(privateDir, path.basename(kind === 'photo' ? r.photo_file : r.id_doc_file));
    if (!fs.existsSync(full)) return res.status(404).json({ message: 'File missing on the server' });
    res.set('Content-Type', kind === 'photo' ? r.photo_mime : r.id_doc_mime);
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    return fs.createReadStream(full).pipe(res);
  } catch (e: any) {
    console.error('Camp attendee file error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to load the file' });
  }
});

// Full ID number, decrypted (every view is written to the server log)
router.get('/admin/attendee/:attId/id-number', adminGuard, async (req: Request, res: Response) => {
  try {
    const key = idKeyBuf();
    if (!key) return res.status(503).json({ message: 'Encryption key is not configured' });
    await ensureAttendeeTable();
    const [rows]: any = await pool.query('SELECT id, registration_id, id_type, id_number_enc FROM camp_attendees WHERE id = ? LIMIT 1', [Number(req.params.attId)]);
    const r = rows?.[0];
    if (!r) return res.status(404).json({ message: 'Not found' });
    console.log(`[Camps] ID number viewed: attendee ${r.id} (registration ${r.registration_id}) by ${(req as any).user?.email || (req as any).user?.id || 'admin'}`);
    res.set('Cache-Control', 'no-store');
    return res.json({ idType: r.id_type, idNumber: decryptValue(r.id_number_enc, key) });
  } catch (e: any) {
    console.error('Camp attendee id error:', e?.message || e);
    return res.status(500).json({ message: 'Could not read the ID number' });
  }
});

// =================== PUBLIC (website) ===================
router.get('/public', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `${CAMP_SELECT} WHERE c.status IN ('published','closed') AND c.end_date >= ? ORDER BY c.start_date ASC LIMIT 100`,
      [todayYmd()]
    );
    // pay_account is internal and not sent to visitors
    return res.json({ camps: rows.map((r: any) => { const { pay_account, ...rest } = shape(r); return rest; }) });
  } catch (e: any) {
    console.error('Camps public error:', e?.message || e);
    return res.status(500).json({ camps: [] });
  }
});

router.get('/public/:slug', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(`${CAMP_SELECT} WHERE c.slug = ? AND c.status IN ('published','closed') LIMIT 1`, [req.params.slug]);
    if (!rows.length) return res.status(404).json({ message: 'Camp not found' });
    const { pay_account, ...rest } = shape(rows[0]);
    return res.json({ camp: rest });
  } catch (e: any) {
    console.error('Camp public one error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to load the camp' });
  }
});

// Camps this devotee has already registered for
router.get('/my-registrations', authDevotee, async (req: any, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT camp_id, members FROM camp_registrations WHERE devotee_id = ? AND status = 'REGISTERED'`,
      [String(req.devoteeId)]
    );
    return res.json({ registrations: rows });
  } catch (e: any) {
    console.error('My camps error:', e?.message || e);
    return res.json({ registrations: [] });
  }
});

// =================== REGISTER (login required) ===================
// Free camp: registers at once. Paid camp: creates a payment order; the registration is confirmed in /verify.
// One registration per devotee per camp. It cannot be changed afterwards.
router.post('/:id/register', authDevotee, runRegisterUpload, async (req: any, res: Response) => {
  // Every uploaded file is deleted again if this request does not end well
  const uploaded: Express.Multer.File[] = (req.files as Express.Multer.File[]) || [];
  const keep = new Set<string>();
  res.on('finish', () => {
    uploaded.forEach((f) => {
      if (res.statusCode >= 400 || !keep.has(f.path)) fs.unlink(f.path, () => {});
    });
  });
  let regIdForCleanup: number | null = null;
  try {
    const b = req.body || {};
    const fail = (field: string, message: string) => res.status(400).json({ message, field });

    const first = str(b.first_name, 60);
    const last = str(b.last_name, 60);
    if (!NAME_RE.test(first)) return fail('first_name', 'First name can contain only letters, spaces and . \' -');
    if (!NAME_RE.test(last)) return fail('last_name', 'Last name can contain only letters, spaces and . \' -');

    const email = str(b.email, 100).toLowerCase();
    if (!EMAIL_RE.test(email)) return fail('email', 'Please enter a valid email address.');

    const cc = str(b.country_code, 6) || '+91';
    const digits = String(b.phone || '').replace(/\D/g, '');
    if (!CODE_RE.test(cc)) return fail('phone', 'Invalid country code.');
    if (cc === '+91' ? !/^[6-9]\d{9}$/.test(digits) : !/^\d{6,15}$/.test(digits)) {
      return fail('phone', cc === '+91' ? 'Enter a 10 digit mobile number.' : 'Enter a valid mobile number.');
    }
    const phone = `${cc}${digits}`;

    const adults = Math.floor(Number(b.adults));
    const children = Math.floor(Number(b.children) || 0);
    if (!Number.isFinite(adults) || adults < 1 || adults > 20) return fail('adults', 'Adults must be between 1 and 20.');
    if (children < 0 || children > 20) return fail('children', 'Children must be between 0 and 20.');
    const members = adults + children;
    if (members > 25) return fail('adults', 'You can register up to 25 people at a time.');

    // ----- Each attendee: name, ID proof type + number, ID document and profile photo (all required) -----
    const key = idKeyBuf();
    if (!key) {
      console.error('[Camps] CAMP_ID_KEY (64 hex characters) is not set; registrations are disabled.');
      return res.status(503).json({ message: 'Registration is temporarily unavailable. Please try again later.' });
    }
    let rawAtt: any[] = [];
    try { rawAtt = JSON.parse(String(b.attendees || '[]')); } catch { rawAtt = []; }
    if (!Array.isArray(rawAtt) || rawAtt.length !== members) return fail('adults', 'Please fill in the details of every attendee.');
    const fileBy = new Map<string, Express.Multer.File>();
    uploaded.forEach((f) => fileBy.set(f.fieldname, f));

    type Att = { seq: number; kind: 'adult' | 'child'; name: string; idType: IdType; idNumber: string; doc: Express.Multer.File; docMime: string; photo: Express.Multer.File; photoMime: string };
    const attendees: Att[] = [];
    const seenIds = new Set<string>();
    for (let i = 0; i < members; i++) {
      const a = rawAtt[i] || {};
      const kind: 'adult' | 'child' = i < adults ? 'adult' : 'child';
      const f = (k: string) => `att-${i}-${k}`;
      const name = str(a.name, 150);
      if (!NAME_RE.test(name)) return fail(f('name'), 'Enter the name (letters only).');
      const idType = String(a.idType || '') as IdType;
      const allowed = kind === 'child' ? CHILD_ID_TYPES : ID_TYPES;
      if (!allowed.includes(idType)) return fail(f('idType'), kind === 'child' ? 'Choose Aadhaar, PAN or Passport for a child.' : 'Choose an ID proof.');
      const idNumber = normalizeId(a.idNumber);
      const bad = idProblem(idType, idNumber);
      if (bad) return fail(f('idNumber'), bad);
      const dupKey = `${idType}:${idNumber}`;
      if (seenIds.has(dupKey)) return fail(f('idNumber'), 'The same ID number is used for two attendees.');
      seenIds.add(dupKey);

      const doc = fileBy.get(`doc_${i}`);
      const photo = fileBy.get(`photo_${i}`);
      if (!doc) return fail(f('doc'), 'Upload the ID proof document.');
      if (!photo) return fail(f('photo'), 'Upload the profile photo.');
      const docMime = sniffFile(doc.path);
      if (!docMime || !DOC_MIME.has(docMime)) return fail(f('doc'), 'The ID proof must be a JPG, PNG image or a PDF.');
      const photoMime = sniffFile(photo.path);
      if (!photoMime || !PHOTO_MIME.has(photoMime)) return fail(f('photo'), 'The photo must be a JPG, PNG or WebP image.');
      attendees.push({ seq: i + 1, kind, name, idType, idNumber, doc, docMime, photo, photoMime });
    }

    const city = str(b.city, 60);
    if (!PLACE_RE.test(city)) return fail('city', 'Please enter your city (letters only).');
    const stateRaw = str(b.state, 60);
    if (stateRaw && !PLACE_RE.test(stateRaw)) return fail('state', 'State can contain only letters.');

    const notes = str(b.notes, 500).replace(NOTE_BAD, '') || null;
    const devoteeId = String(req.devoteeId);

    const [cs]: any = await pool.query(`${CAMP_SELECT} WHERE c.id = ? LIMIT 1`, [req.params.id]);
    if (!cs.length || cs[0].status !== 'published') return res.status(400).json({ message: 'Registration is not open for this camp.' });
    const camp = shape(cs[0]);
    if (camp.end_date < todayYmd()) return res.status(400).json({ message: 'This camp has already ended.' });

    // One registration only
    const [ex]: any = await pool.query(
      `SELECT id, status, amount, razorpay_order_id FROM camp_registrations WHERE camp_id = ? AND devotee_id = ? LIMIT 1`,
      [camp.id, devoteeId]
    );
    const existing = ex[0];
    if (existing && existing.status === 'REGISTERED') {
      return res.status(409).json({ message: 'You have already registered for this camp.', code: 'ALREADY_REGISTERED' });
    }

    // Seats, not counting this devotee's own earlier unpaid attempt
    if (camp.seats > 0) {
      const [t]: any = await pool.query(
        `SELECT COALESCE(SUM(r.members),0) AS n FROM camp_registrations r WHERE r.camp_id = ? AND r.devotee_id <> ? AND ${HELD}`,
        [camp.id, devoteeId]
      );
      const taken = Number(t[0]?.n) || 0;
      if (taken + members > camp.seats) {
        const left = Math.max(0, camp.seats - taken);
        return res.status(400).json({
          message: left > 0 ? `Only ${left} seat${left === 1 ? '' : 's'} left for this camp.` : 'This camp is full.',
          code: 'FULL',
          field: 'adults',
        });
      }
    }

    // The same ID cannot be used by someone else's confirmed or still-held registration for this camp
    await ensureAttendeeTable();
    const hashOf = (a: Att) => crypto.createHmac('sha256', key).update(`${a.idType}:${a.idNumber}`).digest('hex');
    const hashes = attendees.map(hashOf);
    const [used]: any = await pool.query(
      `SELECT a.id_hash FROM camp_attendees a JOIN camp_registrations r ON r.id = a.registration_id
       WHERE a.camp_id = ? AND r.devotee_id <> ? AND ${HELD} AND a.id_hash IN (${hashes.map(() => '?').join(',')})`,
      [camp.id, devoteeId, ...hashes]
    );
    if (used.length) {
      const hit = new Set(used.map((u: any) => u.id_hash));
      const idx = hashes.findIndex((h) => hit.has(h));
      return fail(`att-${idx}-idNumber`, 'This ID has already been used to register for this camp.');
    }

    const paid = camp.fee_type === 'paid' && camp.fee_amount > 0;
    const amount = paid ? Math.round(camp.fee_amount * members * 100) / 100 : 0;
    const acct = acctOf(cs[0].pay_account);

    if (paid) {
      const k = keysFor(acct);
      if (!k.id || !k.secret) {
        console.error(`[Camps] Razorpay keys for the ${acct} account are missing.`);
        return res.status(503).json({ message: 'Online payment is temporarily unavailable. Please try again later.' });
      }
    }

    // Save the registration (PENDING until paid, or REGISTERED at once when free)
    await pool.query(
      `INSERT INTO camp_registrations
         (camp_id, devotee_id, name, first_name, last_name, phone, email, adults, children, members, city, state, notes,
          amount, payment_status, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), first_name = VALUES(first_name), last_name = VALUES(last_name),
         phone = VALUES(phone), email = VALUES(email), adults = VALUES(adults), children = VALUES(children),
         members = VALUES(members), city = VALUES(city), state = VALUES(state), notes = VALUES(notes),
         amount = VALUES(amount), payment_status = VALUES(payment_status), status = VALUES(status),
         created_at = NOW()`,
      [camp.id, devoteeId, `${first} ${last}`, first, last, phone, email, adults, children, members, city, stateRaw || null, notes,
        amount, paid ? 'PENDING' : 'NONE', paid ? 'PENDING' : 'REGISTERED']
    );

    const [row]: any = await pool.query('SELECT id FROM camp_registrations WHERE camp_id = ? AND devotee_id = ? LIMIT 1', [camp.id, devoteeId]);
    const regId = row[0].id;
    regIdForCleanup = regId;

    // Replace any earlier attempt's attendees, then save these (files stay on disk, ID numbers are stored encrypted)
    await purgeAttendees(regId);
    for (let i = 0; i < attendees.length; i++) {
      const a = attendees[i];
      await pool.query(
        `INSERT INTO camp_attendees
           (registration_id, camp_id, seq, kind, name, id_type, id_last4, id_number_enc, id_hash, id_doc_file, id_doc_mime, photo_file, photo_mime)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [regId, camp.id, a.seq, a.kind, a.name, a.idType, a.idNumber.slice(-4), encryptValue(a.idNumber, key), hashes[i],
          path.basename(a.doc.path), a.docMime, path.basename(a.photo.path), a.photoMime]
      );
      keep.add(a.doc.path);
      keep.add(a.photo.path);
    }

    if (!paid) return res.json({ registered: true, members });

    const keys = keysFor(acct);

    // Reuse the earlier order when nothing about the amount changed
    if (existing && existing.status === 'PENDING' && existing.razorpay_order_id && Number(existing.amount) === amount) {
      return res.json({
        payment: { orderId: existing.razorpay_order_id, amount: Math.round(amount * 100), currency: 'INR', keyId: keys.id, orgName: ORG[acct], registrationId: regId },
        members,
      });
    }

    let order: any;
    try {
      order = await client(acct).orders.create({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: `CAMP_${regId}`,
        notes: { campId: camp.id, registrationId: String(regId), devoteeId },
      });
    } catch (err: any) {
      await pool.query(`UPDATE camp_registrations SET status = 'FAILED', payment_status = 'FAILED' WHERE id = ?`, [regId]);
      await purgeAttendees(regId);
      console.error('Camp order error:', err?.error?.description || err?.message || err);
      return res.status(502).json({ message: 'Could not start the payment. Please try again.' });
    }
    await pool.query('UPDATE camp_registrations SET razorpay_order_id = ? WHERE id = ?', [order.id, regId]);

    return res.json({
      payment: { orderId: order.id, amount: order.amount, currency: order.currency, keyId: keys.id, orgName: ORG[acct], registrationId: regId },
      members,
    });
  } catch (e: any) {
    if (regIdForCleanup) await purgeAttendees(regIdForCleanup); // do not leave half-saved attendees behind
    console.error('Camp register error:', e?.message || e);
    return res.status(500).json({ message: 'Could not register. Please try again.' });
  }
});

// Confirms the payment and completes the registration
router.post('/:id/verify', authDevotee, async (req: any, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, registrationId } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !registrationId) {
      return res.status(400).json({ message: 'Missing payment details' });
    }

    const [rows]: any = await pool.query(
      `SELECT r.id, r.status, r.members, r.razorpay_order_id, c.pay_account
       FROM camp_registrations r JOIN camps c ON c.id = r.camp_id
       WHERE r.id = ? AND r.camp_id = ? AND r.devotee_id = ? LIMIT 1`,
      [registrationId, req.params.id, String(req.devoteeId)]
    );
    if (!rows.length) return res.status(404).json({ message: 'Registration not found' });
    const r = rows[0];
    if (!r.razorpay_order_id || r.razorpay_order_id !== String(razorpay_order_id)) {
      return res.status(400).json({ message: 'Payment does not match this registration' });
    }
    if (r.status === 'REGISTERED') return res.json({ registered: true, members: r.members });

    const secret = keysFor(acctOf(r.pay_account)).secret;
    if (!secret) return res.status(503).json({ message: 'Online payment is temporarily unavailable.' });

    const expected = crypto.createHmac('sha256', secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(razorpay_signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ message: 'Signature verification failed' });
    }

    await pool.query(
      `UPDATE camp_registrations SET status = 'REGISTERED', payment_status = 'PAID', razorpay_payment_id = ? WHERE id = ?`,
      [String(razorpay_payment_id), r.id]
    );
    return res.json({ registered: true, members: r.members });
  } catch (e: any) {
    console.error('Camp verify error:', e?.message || e);
    return res.status(500).json({ message: 'Could not confirm the payment. Please contact the ashram with your payment id.' });
  }
});

// Settles unpaid registrations whose payment window was closed. Asks Razorpay before releasing the seats.
let sweeping = false;
export async function syncPendingCampPayments(): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    const [rows]: any = await pool.query(
      `SELECT r.id, r.razorpay_order_id, r.amount, c.pay_account
       FROM camp_registrations r JOIN camps c ON c.id = r.camp_id
       WHERE r.status = 'PENDING' AND r.created_at < (NOW() - INTERVAL ${HOLD_MINUTES} MINUTE) ORDER BY r.id ASC LIMIT 50`
    );
    for (const r of rows || []) {
      try {
        if (!r.razorpay_order_id) {
          await pool.query(`UPDATE camp_registrations SET status = 'FAILED', payment_status = 'FAILED' WHERE id = ? AND status = 'PENDING'`, [r.id]);
          await purgeAttendees(r.id);
          continue;
        }
        const list: any = await client(acctOf(r.pay_account)).orders.fetchPayments(r.razorpay_order_id);
        const captured = (list?.items || []).find((p: any) => p.status === 'captured');
        if (!captured) {
          await pool.query(`UPDATE camp_registrations SET status = 'FAILED', payment_status = 'FAILED' WHERE id = ? AND status = 'PENDING'`, [r.id]);
          await purgeAttendees(r.id); // the uploaded ID proofs are not kept for an unpaid attempt
          continue;
        }
        if (Math.round(Number(r.amount) * 100) !== Number(captured.amount)) {
          console.error('[CampSync] Amount mismatch, needs review:', { registrationId: r.id, paymentId: captured.id });
          continue;
        }
        await pool.query(
          `UPDATE camp_registrations SET status = 'REGISTERED', payment_status = 'PAID', razorpay_payment_id = ? WHERE id = ? AND status = 'PENDING'`,
          [String(captured.id), r.id]
        );
        console.log(`[CampSync] Registration ${r.id} confirmed from Razorpay.`);
      } catch (err: any) {
        console.warn(`[CampSync] Registration ${r.id} skipped:`, err?.error?.description || err?.message || err);
      }
    }
  } catch (e: any) {
    console.error('[CampSync] Run failed:', e?.message || e);
  } finally {
    sweeping = false;
  }
}

export default router;