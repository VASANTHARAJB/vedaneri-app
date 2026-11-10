import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

// The Accommodation page: its text, its three photos and its links, edited in the CMS under Accommodation.
const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const dbg = (e: any) => (IS_PROD ? undefined : e?.sqlMessage || e?.message || String(e));
const fail = (res: Response, e: any, message: string) => {
  console.error(`Accommodation: ${message}`, e?.sqlMessage || e?.message || e);
  return res.status(500).json({ message, detail: dbg(e) });
};
const adminGuard = (req: Request, res: Response, next: NextFunction) => authenticate(req as AuthenticatedRequest, res, next);

let ready: Promise<boolean> | null = null;
function ensureTable(): Promise<boolean> {
  if (!ready) {
    ready = pool.query(
      `CREATE TABLE IF NOT EXISTS accommodation_page (
        id tinyint NOT NULL,
        content longtext DEFAULT NULL,
        updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ).then(() => true).catch((e: any) => { console.error('[Accommodation] table:', e?.sqlMessage || e?.message || e); ready = null; return false; });
  }
  return ready as Promise<boolean>;
}
void ensureTable();
router.use(async (_req, _res, next) => { try { await ensureTable(); } catch { /* reported by the request */ } next(); });

const dir = path.resolve(__dirname, '../../uploads/accommodation');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const PREFIX = '/uploads/accommodation/';
const rmUrl = (u?: string | null) => { if (u && u.startsWith(PREFIX)) fs.unlink(path.join(dir, path.basename(u)), () => {}); };

const upload = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, dir),
    filename: (_r, _f, cb) => cb(null, `raw-${Date.now()}-${crypto.randomInt(0, 100000)}`),
  }),
  limits: { fileSize: 60 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => (/^image\/(jpeg|png|webp)$/.test(f.mimetype) ? cb(null, true) : cb(new Error('The photo must be a JPG, PNG or WebP image.'))),
});
function oneImage(req: Request, res: Response, next: NextFunction) {
  upload.single('image')(req, res, (err: any) => {
    if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'The photo is too large (up to 60MB).' : err.message || 'Upload failed.' });
    next();
  });
}

async function readPage() {
  const [rows]: any = await pool.query('SELECT content FROM accommodation_page WHERE id = 1 LIMIT 1');
  try { return rows[0]?.content ? JSON.parse(rows[0].content) : {}; } catch { return {}; }
}
// Every uploaded-photo URL found anywhere inside the content
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
    if (json.length > 200000) return res.status(400).json({ message: 'The content is too large.' });
    const before = urlsIn(await readPage());
    await pool.query('INSERT INTO accommodation_page (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)', [json]);
    // Photos that the page no longer uses are deleted
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
    const name = `accommodation-${Date.now()}-${crypto.randomInt(0, 100000)}.webp`;
    await sharp(f.path).rotate().resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(dir, name));
    fs.unlink(f.path, () => {});
    return res.json({ url: `${PREFIX}${name}` });
  } catch (e: any) { if (f) fs.unlink(f.path, () => {}); return fail(res, e, 'Could not save the photo.'); }
});

export default router;