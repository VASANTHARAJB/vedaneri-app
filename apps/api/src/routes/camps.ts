import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET || 'vedaneri-ashram-secret-key';

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
    },
  };
}

const CAMP_SELECT = `SELECT c.*, DATE_FORMAT(c.start_date,'%Y-%m-%d') AS sd, DATE_FORMAT(c.end_date,'%Y-%m-%d') AS ed,
  COALESCE((SELECT SUM(r.members) FROM camp_registrations r WHERE r.camp_id = c.id AND r.status = 'REGISTERED'), 0) AS registered
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
         start_time, end_time, image_url, fee_type, fee_amount, seats, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, slug, v.title_en, v.title_ta, v.description_en, v.description_ta, v.venue_en, v.venue_ta, v.start_date, v.end_date,
       v.start_time, v.end_time, image, v.fee_type, v.fee_amount, v.seats, v.status]
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
         start_time=?, end_time=?, image_url=?, fee_type=?, fee_amount=?, seats=?, status=? WHERE id=?`,
      [v.title_en, v.title_ta, v.description_en, v.description_ta, v.venue_en, v.venue_ta, v.start_date, v.end_date,
       v.start_time, v.end_time, image, v.fee_type, v.fee_amount, v.seats, v.status, req.params.id]
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
      `SELECT id, name, first_name, last_name, phone, email, members, adults, children, city, state, notes, status, created_at
       FROM camp_registrations WHERE camp_id = ? ORDER BY id DESC LIMIT 2000`,
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
      `SELECT first_name, last_name, name, phone, email, adults, children, members, city, state, notes, status, created_at
       FROM camp_registrations WHERE camp_id = ? ORDER BY id ASC`,
      [req.params.id]
    );
    const head = ['First name', 'Last name', 'Mobile', 'Email', 'Adults', 'Children', 'Total people', 'City', 'State', 'Note', 'Status', 'Registered on'];
    const lines = [head.map(cell).join(',')];
    for (const r of rows) {
      const first = r.first_name || String(r.name || '').split(' ')[0] || '';
      const last = r.last_name || String(r.name || '').split(' ').slice(1).join(' ');
      lines.push(
        [first, last, r.phone, r.email, r.adults, r.children, r.members, r.city, r.state, r.notes, r.status,
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

// =================== PUBLIC (website) ===================
router.get('/public', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `${CAMP_SELECT} WHERE c.status IN ('published','closed') AND c.end_date >= ? ORDER BY c.start_date ASC LIMIT 100`,
      [todayYmd()]
    );
    return res.json({ camps: rows.map(shape) });
  } catch (e: any) {
    console.error('Camps public error:', e?.message || e);
    return res.status(500).json({ camps: [] });
  }
});

router.get('/public/:slug', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(`${CAMP_SELECT} WHERE c.slug = ? AND c.status IN ('published','closed') LIMIT 1`, [req.params.slug]);
    if (!rows.length) return res.status(404).json({ message: 'Camp not found' });
    return res.json({ camp: shape(rows[0]) });
  } catch (e: any) {
    console.error('Camp public one error:', e?.message || e);
    return res.status(500).json({ message: 'Failed to load the camp' });
  }
});

// Camps this devotee has already registered for (so the website can show "You are registered")
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

// Devotee registration (login required). Every field is checked again here.
router.post('/:id/register', authDevotee, async (req: any, res: Response) => {
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

    const city = str(b.city, 60);
    if (!PLACE_RE.test(city)) return fail('city', 'Please enter your city (letters only).');
    const stateRaw = str(b.state, 60);
    if (stateRaw && !PLACE_RE.test(stateRaw)) return fail('state', 'State can contain only letters.');

    const notes = str(b.notes, 500).replace(NOTE_BAD, '') || null;

    const [cs]: any = await pool.query(`${CAMP_SELECT} WHERE c.id = ? LIMIT 1`, [req.params.id]);
    if (!cs.length || cs[0].status !== 'published') return res.status(400).json({ message: 'Registration is not open for this camp.' });
    const camp = shape(cs[0]);
    if (camp.end_date < todayYmd()) return res.status(400).json({ message: 'This camp has already ended.' });

    // If this devotee is changing an earlier registration, their old people are not counted twice
    const [mine]: any = await pool.query(
      `SELECT members FROM camp_registrations WHERE camp_id = ? AND devotee_id = ? AND status = 'REGISTERED' LIMIT 1`,
      [camp.id, String(req.devoteeId)]
    );
    const already = mine.length ? Number(mine[0].members) || 0 : 0;
    if (camp.seats > 0 && camp.registered - already + members > camp.seats) {
      const left = Math.max(0, camp.seats - (camp.registered - already));
      return res.status(400).json({
        message: left > 0 ? `Only ${left} seat${left === 1 ? '' : 's'} left for this camp.` : 'This camp is full.',
        code: 'FULL',
        field: 'adults',
      });
    }

    await pool.query(
      `INSERT INTO camp_registrations
         (camp_id, devotee_id, name, first_name, last_name, phone, email, adults, children, members, city, state, notes, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'REGISTERED')
       ON DUPLICATE KEY UPDATE name = VALUES(name), first_name = VALUES(first_name), last_name = VALUES(last_name),
         phone = VALUES(phone), email = VALUES(email), adults = VALUES(adults), children = VALUES(children),
         members = VALUES(members), city = VALUES(city), state = VALUES(state), notes = VALUES(notes), status = 'REGISTERED'`,
      [camp.id, String(req.devoteeId), `${first} ${last}`, first, last, phone, email, adults, children, members, city, stateRaw || null, notes]
    );
    return res.json({ registered: true, members });
  } catch (e: any) {
    console.error('Camp register error:', e?.message || e);
    return res.status(500).json({ message: 'Could not register. Please try again.' });
  }
});

export default router;