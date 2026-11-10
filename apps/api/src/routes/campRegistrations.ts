import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

// Camp registration from the website: one student per registration, with ID proof (number + document) and a profile photo.
// The ID number is stored encrypted, and the two files are kept OUTSIDE the public /uploads folder.
// Mount in index.ts:  app.use('/api/v1/camp-registrations', campRegistrationsRouter);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const router = Router();

const clean = (v?: string) => (v || '').replace(/["'\s]/g, '');
// Uses CAMP_ID_KEY (64 hex characters); falls back to DONATION_ID_KEY if that is the only key you have set
const keyHex = () => clean(process.env.CAMP_ID_KEY) || clean(process.env.DONATION_ID_KEY);
const keyBuf = () => {
  const k = keyHex();
  return /^[0-9a-fA-F]{64}$/.test(k) ? Buffer.from(k, 'hex') : null;
};

const ID_TYPES = ['aadhaar', 'pan', 'voter', 'passport'] as const;
type IdType = (typeof ID_TYPES)[number];

const MAX_FILE = 5 * 1024 * 1024; // 5 MB per file
const dir = path.resolve(__dirname, '../../private/camp');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// ---------- ID number checks ----------
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
const normalizeId = (v: string) => v.replace(/[\s-]/g, '').toUpperCase();
function idProblem(type: IdType, n: string): string | null {
  if (type === 'aadhaar') return isValidAadhaar(n) ? null : 'Please enter a valid 12-digit Aadhaar number.';
  if (type === 'pan') return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(n) ? null : 'Please enter a valid PAN (for example ABCDE1234F).';
  if (type === 'voter') return /^[A-Z]{3}[0-9]{7}$/.test(n) ? null : 'Please enter a valid Voter ID (EPIC) number (for example ABC1234567).';
  return /^[A-Z][0-9]{7}$/.test(n) ? null : 'Please enter a valid passport number (for example A1234567).';
}

// ---------- file checks: type is read from the file itself, not from what the browser says ----------
type Kind = { mime: string; ext: string };
function sniff(buf: Buffer): Kind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}
const PHOTO_OK = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOC_OK = new Set(['image/jpeg', 'image/png', 'application/pdf']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE, files: 2, fields: 20, fieldSize: 2000 },
});
function twoFiles(req: Request, res: Response, next: NextFunction) {
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'idDoc', maxCount: 1 }])(req, res, (err: any) => {
    if (err) {
      const big = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({ code: big ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED', field: big ? 'file' : undefined, message: big ? 'Each file must be 5 MB or smaller.' : 'The upload could not be read. Please try again.' });
    }
    next();
  });
}

// ---------- encryption ----------
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

// ---------- table ----------
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS camp_participants (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          ref VARCHAR(24) NOT NULL,
          camp_slug VARCHAR(160) NOT NULL,
          camp_name VARCHAR(255) DEFAULT NULL,
          name VARCHAR(150) NOT NULL,
          age TINYINT UNSIGNED NOT NULL,
          gender ENUM('male','female') NOT NULL,
          phone VARCHAR(20) NOT NULL,
          email VARCHAR(150) DEFAULT NULL,
          study VARCHAR(150) DEFAULT NULL,
          emergency VARCHAR(255) NOT NULL,
          accommodation ENUM('yes','no') NOT NULL DEFAULT 'yes',
          id_type ENUM('aadhaar','pan','voter','passport') NOT NULL,
          id_last4 CHAR(4) NOT NULL,
          id_number_enc TEXT NOT NULL,
          id_hash CHAR(64) NOT NULL,
          id_doc_file VARCHAR(80) NOT NULL,
          id_doc_mime VARCHAR(40) NOT NULL,
          photo_file VARCHAR(80) NOT NULL,
          photo_mime VARCHAR(40) NOT NULL,
          agreed TINYINT(1) NOT NULL DEFAULT 0,
          status ENUM('REGISTERED','CANCELLED') NOT NULL DEFAULT 'REGISTERED',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_camp_participants_ref (ref),
          UNIQUE KEY uq_camp_participants_idhash (camp_slug, id_hash),
          KEY idx_camp_participants_camp (camp_slug, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      )
      .then(() => undefined)
      .catch((e) => {
        tableReady = null; // try again on the next request
        throw e;
      });
  }
  return tableReady;
}

// ---------- simple per-address limit on the public form (the form accepts file uploads) ----------
const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 20;
function clientKey(req: Request): string {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.ip || 'unknown';
}
function limited(req: Request): boolean {
  const k = clientKey(req);
  const now = Date.now();
  const list = (hits.get(k) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(k, list);
  if (hits.size > 5000) for (const [key, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(key);
  return list.length > MAX_PER_WINDOW;
}

const fail = (res: Response, status: number, code: string, field: string | undefined, message: string) =>
  res.status(status).json({ code, field, message });

const rmFiles = (...names: string[]) => names.forEach((n) => n && fs.unlink(path.join(dir, n), () => {}));

// ====================== PUBLIC: register one student ======================
// POST /api/v1/camp-registrations   (multipart/form-data: fields + files "photo" and "idDoc")
router.post('/', twoFiles, async (req: Request, res: Response) => {
  const saved: string[] = [];
  try {
    if (limited(req)) return fail(res, 429, 'TOO_MANY', undefined, 'Too many attempts. Please try again after some time.');

    const key = keyBuf();
    if (!key) {
      console.error('[CampRegistration] CAMP_ID_KEY (64 hex characters) is not set; registrations are disabled.');
      return fail(res, 503, 'NOT_CONFIGURED', undefined, 'Registration is not available right now. Please try again later.');
    }

    const b: Record<string, string> = {};
    for (const k of Object.keys(req.body || {})) b[k] = String(req.body[k] ?? '').trim();

    const campSlug = b.campSlug || '';
    if (!/^[a-z0-9][a-z0-9-]{0,159}$/i.test(campSlug)) return fail(res, 400, 'INVALID_CAMP', undefined, 'Please choose a camp.');
    const campName = (b.campName || '').slice(0, 255) || null;

    const name = b.name || '';
    if (name.length < 2 || name.length > 150) return fail(res, 400, 'INVALID_NAME', 'name', 'Please enter the full name.');
    const age = Number(b.age);
    if (!Number.isInteger(age) || age < 1 || age > 120) return fail(res, 400, 'INVALID_AGE', 'age', 'Please enter a valid age.');
    if (b.gender !== 'male' && b.gender !== 'female') return fail(res, 400, 'INVALID_GENDER', 'gender', 'Please choose the gender.');
    if (!/^\+?[\d\s-]{7,15}$/.test(b.phone || '')) return fail(res, 400, 'INVALID_PHONE', 'phone', 'Please enter a valid phone number.');
    if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return fail(res, 400, 'INVALID_EMAIL', 'email', 'Please enter a valid email address.');
    if ((b.emergency || '').length < 5) return fail(res, 400, 'INVALID_EMERGENCY', 'emergency', 'Please enter an emergency contact (name and phone).');
    const accommodation = b.accommodation === 'no' ? 'no' : 'yes';
    if (b.agree !== 'true') return fail(res, 400, 'NOT_AGREED', 'agree', 'Please accept the dress code and rules to continue.');

    const idType = b.idType as IdType;
    if (!ID_TYPES.includes(idType)) return fail(res, 400, 'INVALID_ID_TYPE', 'idType', 'Please choose an ID proof type.');
    const idNumber = normalizeId(b.idNumber || '');
    const problem = idProblem(idType, idNumber);
    if (problem) return fail(res, 400, 'INVALID_ID_NUMBER', 'idNumber', problem);

    const files = (req.files || {}) as { [k: string]: Express.Multer.File[] };
    const photo = files.photo?.[0];
    const doc = files.idDoc?.[0];
    if (!photo) return fail(res, 400, 'PHOTO_REQUIRED', 'photo', 'Please upload the profile photo.');
    if (!doc) return fail(res, 400, 'DOC_REQUIRED', 'idDoc', 'Please upload the ID proof document.');
    const photoKind = sniff(photo.buffer);
    if (!photoKind || !PHOTO_OK.has(photoKind.mime)) return fail(res, 400, 'INVALID_PHOTO', 'photo', 'The profile photo must be a JPG, PNG or WebP image.');
    const docKind = sniff(doc.buffer);
    if (!docKind || !DOC_OK.has(docKind.mime)) return fail(res, 400, 'INVALID_DOC', 'idDoc', 'The ID proof must be a JPG, PNG image or a PDF.');

    await ensureTable();

    const idHash = crypto.createHmac('sha256', key).update(`${idType}:${idNumber}`).digest('hex');
    const idEnc = encryptValue(idNumber, key);

    const rand = () => crypto.randomBytes(16).toString('hex');
    const photoFile = `${rand()}.${photoKind.ext}`;
    const docFile = `${rand()}.${docKind.ext}`;
    fs.writeFileSync(path.join(dir, photoFile), photo.buffer, { mode: 0o600 });
    saved.push(photoFile);
    fs.writeFileSync(path.join(dir, docFile), doc.buffer, { mode: 0o600 });
    saved.push(docFile);

    const d = new Date(Date.now() + 330 * 60 * 1000); // India date for the reference
    const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

    for (let attempt = 0; attempt < 4; attempt++) {
      const ref = `CR-${stamp}-${crypto.randomInt(100000, 999999)}`;
      try {
        await pool.query(
          `INSERT INTO camp_participants
             (ref, camp_slug, camp_name, name, age, gender, phone, email, study, emergency, accommodation,
              id_type, id_last4, id_number_enc, id_hash, id_doc_file, id_doc_mime, photo_file, photo_mime, agreed)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
          [
            ref, campSlug, campName, name, age, b.gender, b.phone, b.email || null, (b.study || '').slice(0, 150) || null,
            b.emergency.slice(0, 255), accommodation, idType, idNumber.slice(-4), idEnc, idHash,
            docFile, docKind.mime, photoFile, photoKind.mime,
          ]
        );
        return res.status(201).json({ success: true, ref });
      } catch (e: any) {
        if (e?.code === 'ER_DUP_ENTRY') {
          if (String(e.message).includes('uq_camp_participants_idhash')) {
            rmFiles(...saved);
            return fail(res, 409, 'ALREADY_REGISTERED', 'idNumber', 'This ID has already been used to register for this camp.');
          }
          continue; // the reference collided: draw another one
        }
        throw e;
      }
    }
    rmFiles(...saved);
    return fail(res, 500, 'FAILED', undefined, 'The registration could not be saved. Please try again.');
  } catch (e: any) {
    rmFiles(...saved);
    console.error('[CampRegistration] failed:', e?.message || e);
    return fail(res, 500, 'FAILED', undefined, 'The registration could not be saved. Please try again.');
  }
});

// ====================== ADMIN (CMS login required) ======================
const adminGuard = (req: Request, res: Response, next: NextFunction) => authenticate(req as AuthenticatedRequest, res, next);

// GET /api/v1/camp-registrations/admin/list?campSlug=
router.get('/admin/list', adminGuard, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const slug = String(req.query.campSlug || '').trim();
    const [rows]: any = await pool.query(
      `SELECT id, ref, camp_slug, camp_name, name, age, gender, phone, email, study, emergency, accommodation,
              id_type, id_last4, status, created_at
         FROM camp_participants ${slug ? 'WHERE camp_slug = ?' : ''} ORDER BY created_at DESC LIMIT 2000`,
      slug ? [slug] : []
    );
    res.set('Cache-Control', 'no-store');
    return res.json({ registrations: rows || [] });
  } catch (e: any) {
    console.error('[CampRegistration] list failed:', e?.message || e);
    return res.status(500).json({ message: 'Failed to load camp registrations' });
  }
});

// GET /api/v1/camp-registrations/admin/:id/file/photo|doc   (the file itself)
router.get('/admin/:id/file/:kind', adminGuard, async (req: Request, res: Response) => {
  try {
    const kind = req.params.kind === 'photo' ? 'photo' : req.params.kind === 'doc' ? 'doc' : '';
    if (!kind) return res.status(400).json({ message: 'Invalid file type' });
    const [rows]: any = await pool.query(
      'SELECT id_doc_file, id_doc_mime, photo_file, photo_mime FROM camp_participants WHERE id = ? LIMIT 1',
      [Number(req.params.id)]
    );
    const r = rows?.[0];
    if (!r) return res.status(404).json({ message: 'Not found' });
    const file = path.basename(kind === 'photo' ? r.photo_file : r.id_doc_file); // basename: no path tricks
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) return res.status(404).json({ message: 'File missing on the server' });
    res.set('Content-Type', kind === 'photo' ? r.photo_mime : r.id_doc_mime);
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    return fs.createReadStream(full).pipe(res);
  } catch (e: any) {
    console.error('[CampRegistration] file failed:', e?.message || e);
    return res.status(500).json({ message: 'Failed to load the file' });
  }
});

// GET /api/v1/camp-registrations/admin/:id/id-number   (full ID number, decrypted; logged)
router.get('/admin/:id/id-number', adminGuard, async (req: Request, res: Response) => {
  try {
    const key = keyBuf();
    if (!key) return res.status(503).json({ message: 'Encryption key is not configured' });
    const [rows]: any = await pool.query('SELECT id, ref, id_type, id_number_enc FROM camp_participants WHERE id = ? LIMIT 1', [Number(req.params.id)]);
    const r = rows?.[0];
    if (!r) return res.status(404).json({ message: 'Not found' });
    console.log(`[CampRegistration] ID number viewed: ${r.ref} by ${(req as any).user?.email || (req as any).user?.id || 'admin'}`);
    res.set('Cache-Control', 'no-store');
    return res.json({ idType: r.id_type, idNumber: decryptValue(r.id_number_enc, key) });
  } catch (e: any) {
    console.error('[CampRegistration] id-number failed:', e?.message || e);
    return res.status(500).json({ message: 'Could not read the ID number' });
  }
});

export default router;