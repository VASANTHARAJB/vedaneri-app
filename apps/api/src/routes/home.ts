import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

// The Home page: its text (English and Tamil), photos, links, festival times and the audio file, edited in the CMS under Home Page.
const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const dbg = (e: any) => (IS_PROD ? undefined : e?.sqlMessage || e?.message || String(e));
const fail = (res: Response, e: any, message: string) => {
  console.error(`Home: ${message}`, e?.sqlMessage || e?.message || e);
  return res.status(500).json({ message, detail: dbg(e) });
};
const adminGuard = (req: Request, res: Response, next: NextFunction) => authenticate(req as AuthenticatedRequest, res, next);

let ready: Promise<boolean> | null = null;
function ensureTable(): Promise<boolean> {
  if (!ready) {
    ready = pool.query(
      `CREATE TABLE IF NOT EXISTS home_page (
        id tinyint NOT NULL,
        content longtext DEFAULT NULL,
        updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ).then(() => true).catch((e: any) => { console.error('[Home] table:', e?.sqlMessage || e?.message || e); ready = null; return false; });
  }
  return ready as Promise<boolean>;
}
void ensureTable();
router.use(async (_req, _res, next) => { try { await ensureTable(); } catch { /* reported by the request */ } next(); });

const dir = path.resolve(__dirname, '../../uploads/home');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const PREFIX = '/uploads/home/';
const rmUrl = (u?: string | null) => { if (u && u.startsWith(PREFIX)) fs.unlink(path.join(dir, path.basename(u)), () => {}); };
const rnd = () => `${Date.now()}-${crypto.randomInt(0, 100000)}`;

// ---------- Photos ----------
const uploadImage = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, dir),
    filename: (_r, _f, cb) => cb(null, `raw-${rnd()}`),
  }),
  limits: { fileSize: 60 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => (/^image\/(jpeg|png|webp)$/.test(f.mimetype) ? cb(null, true) : cb(new Error('The photo must be a JPG, PNG or WebP image.'))),
});
function oneImage(req: Request, res: Response, next: NextFunction) {
  uploadImage.single('image')(req, res, (err: any) => {
    if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'The photo is too large (up to 60MB).' : err.message || 'Upload failed.' });
    next();
  });
}

// ---------- Audio ----------
const AUDIO_MAX = 100 * 1024 * 1024;
const AUDIO_EXT: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a',
  'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
};
const uploadAudio = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, dir),
    // The name is made here, with an extension chosen from the file type, never taken from the visitor
    filename: (_r, f, cb) => cb(null, `audio-${rnd()}.${AUDIO_EXT[f.mimetype] || 'mp3'}`),
  }),
  limits: { fileSize: AUDIO_MAX, files: 1 },
  fileFilter: (_r, f, cb) => (AUDIO_EXT[f.mimetype] ? cb(null, true) : cb(new Error('The audio must be an MP3, M4A, OGG or WAV file.'))),
});
function oneAudio(req: Request, res: Response, next: NextFunction) {
  uploadAudio.single('audio')(req, res, (err: any) => {
    if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'The audio is too large (up to 100MB).' : err.message || 'Upload failed.' });
    next();
  });
}

async function readPage() {
  const [rows]: any = await pool.query('SELECT content FROM home_page WHERE id = 1 LIMIT 1');
  try { return rows[0]?.content ? JSON.parse(rows[0].content) : {}; } catch { return {}; }
}
// Every uploaded-file URL found anywhere inside the content
function urlsIn(v: any, out: Set<string> = new Set()): Set<string> {
  if (typeof v === 'string') { if (v.startsWith(PREFIX)) out.add(v); }
  else if (Array.isArray(v)) v.forEach((x) => urlsIn(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => urlsIn(x, out));
  return out;
}

// ---------- Public (the website) ----------
router.get('/page', async (_req, res) => {
  try { res.setHeader('Cache-Control', 'no-store'); return res.json({ content: await readPage() }); }
  catch { return res.status(500).json({ content: {} }); }
});

// ---------- Admin (CMS) ----------
router.get('/admin/page', adminGuard, async (_req, res) => {
  try { return res.json({ content: await readPage() }); } catch (e: any) { return fail(res, e, 'Could not load the page.'); }
});

router.put('/admin/page', adminGuard, async (req, res) => {
  try {
    const c = req.body?.content;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return res.status(400).json({ message: 'Invalid content.' });
    const json = JSON.stringify(c);
    if (json.length > 600000) return res.status(400).json({ message: 'The content is too large.' });
    const before = urlsIn(await readPage());
    await pool.query('INSERT INTO home_page (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)', [json]);
    // Photos and audio that the page no longer uses are deleted
    const after = urlsIn(c);
    before.forEach((u) => { if (!after.has(u)) rmUrl(u); });
    return res.json({ saved: true });
  } catch (e: any) { return fail(res, e, 'Could not save the page.'); }
});

// Uploads one photo and returns its URL. The CMS stores the URL in the content.
router.post('/admin/upload', adminGuard, oneImage, async (req: Request, res: Response) => {
  const f = (req as any).file;
  try {
    if (!f) return res.status(400).json({ message: 'Choose a photo.' });
    const w = Math.min(2400, Math.max(400, Number(req.query.w) || 1400));
    const name = `home-${rnd()}.webp`;
    await sharp(f.path).rotate().resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(dir, name));
    fs.unlink(f.path, () => {});
    return res.json({ url: `${PREFIX}${name}` });
  } catch (e: any) { if (f) fs.unlink(f.path, () => {}); return fail(res, e, 'Could not save the photo.'); }
});

// Uploads the audio file of the audio bar and returns its URL.
router.post('/admin/upload-audio', adminGuard, oneAudio, (req: Request, res: Response) => {
  const f = (req as any).file;
  if (!f) return res.status(400).json({ message: 'Choose an audio file.' });
  return res.json({ url: `${PREFIX}${f.filename}` });
});

export default router;