import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

// Content for the About pages. One row per page, chosen by its slug.
const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const dbg = (e: any) => (IS_PROD ? undefined : e?.sqlMessage || e?.message || String(e));
const fail = (res: Response, e: any, message: string) => {
  console.error(`AboutPages: ${message}`, e?.sqlMessage || e?.message || e);
  return res.status(500).json({ message, detail: dbg(e) });
};
const pid = (v: any) => String(Array.isArray(v) ? v[0] : v);

const SLUGS = ['omkarananda', 'ashramam', 'adhishtanam', 'vidyapitham'];
const adminGuard = (req: Request, res: Response, next: NextFunction) => authenticate(req as AuthenticatedRequest, res, next);

let ready: Promise<boolean> | null = null;
function ensureTable(): Promise<boolean> {
  if (!ready) {
    ready = pool.query(
      `CREATE TABLE IF NOT EXISTS page_content (
        slug varchar(60) NOT NULL,
        content longtext DEFAULT NULL,
        image_url varchar(500) DEFAULT NULL,
        updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ).then(() => true).catch((e: any) => { console.error('[AboutPages] table:', e?.sqlMessage || e?.message || e); ready = null; return false; });
  }
  return ready;
}
void ensureTable();
router.use(async (_req, _res, next) => { try { await ensureTable(); } catch { /* reported by the request */ } next(); });

const dir = path.resolve(__dirname, '../../uploads/pages');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const PREFIX = '/uploads/pages/';
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

async function read(slug: string) {
  const [rows]: any = await pool.query('SELECT content, image_url FROM page_content WHERE slug = ? LIMIT 1', [slug]);
  let content: any = {};
  try { content = rows[0]?.content ? JSON.parse(rows[0].content) : {}; } catch { content = {}; }
  return { content, image_url: rows[0]?.image_url || null };
}

// Every uploaded-image URL found anywhere inside the content
function urlsIn(v: any, out: Set<string> = new Set()): Set<string> {
  if (typeof v === 'string') { if (v.startsWith(PREFIX)) out.add(v); }
  else if (Array.isArray(v)) v.forEach((x) => urlsIn(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => urlsIn(x, out));
  return out;
}

// ---------- Admin ----------
router.get('/admin/:slug', adminGuard, async (req, res) => {
  try {
    const slug = pid(req.params.slug);
    if (!SLUGS.includes(slug)) return res.status(404).json({ message: 'Unknown page' });
    return res.json(await read(slug));
  } catch (e: any) { return fail(res, e, 'Could not load the page.'); }
});

router.put('/admin/:slug', adminGuard, async (req, res) => {
  try {
    const slug = pid(req.params.slug);
    if (!SLUGS.includes(slug)) return res.status(404).json({ message: 'Unknown page' });
    const c = req.body?.content;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return res.status(400).json({ message: 'Invalid content.' });
    const json = JSON.stringify(c);
    if (json.length > 500000) return res.status(400).json({ message: 'The content is too large.' });
    const before = urlsIn((await read(slug)).content);
    await pool.query(
      `INSERT INTO page_content (slug, content) VALUES (?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)`,
      [slug, json]
    );
    // Photos that are no longer used by the page are deleted
    const after = urlsIn(c);
    before.forEach((u) => { if (!after.has(u)) rmUrl(u); });
    return res.json({ saved: true });
  } catch (e: any) { return fail(res, e, 'Could not save the page.'); }
});

// Uploads one photo anywhere on the page and returns its URL. The CMS stores the URL in the content.
router.post('/admin/:slug/upload', adminGuard, oneImage, async (req: Request, res: Response) => {
  const f = (req as any).file;
  try {
    const slug = pid(req.params.slug);
    if (!SLUGS.includes(slug)) { if (f) fs.unlink(f.path, () => {}); return res.status(404).json({ message: 'Unknown page' }); }
    if (!f) return res.status(400).json({ message: 'Choose a photo.' });
    const w = Math.min(2400, Math.max(400, Number(req.query.w) || 1600));
    const name = `${slug}-${Date.now()}-${crypto.randomInt(0, 100000)}.webp`;
    await sharp(f.path).rotate().resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(dir, name));
    fs.unlink(f.path, () => {});
    return res.json({ url: `${PREFIX}${name}` });
  } catch (e: any) { if (f) fs.unlink(f.path, () => {}); return fail(res, e, 'Could not save the photo.'); }
});

// Single portrait photo (used by the Omkarananda page)
router.post('/admin/:slug/image', adminGuard, oneImage, async (req: Request, res: Response) => {
  const f = (req as any).file;
  try {
    const slug = pid(req.params.slug);
    if (!SLUGS.includes(slug)) { if (f) fs.unlink(f.path, () => {}); return res.status(404).json({ message: 'Unknown page' }); }
    if (!f) return res.status(400).json({ message: 'Choose a photo.' });
    const name = `${slug}-${Date.now()}.webp`;
    await sharp(f.path).rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(dir, name));
    fs.unlink(f.path, () => {});
    const old = (await read(slug)).image_url;
    const url = `${PREFIX}${name}`;
    await pool.query(`INSERT INTO page_content (slug, image_url) VALUES (?, ?) ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)`, [slug, url]);
    rmUrl(old);
    return res.json({ image_url: url });
  } catch (e: any) { if (f) fs.unlink(f.path, () => {}); return fail(res, e, 'Could not save the photo.'); }
});

router.delete('/admin/:slug/image', adminGuard, async (req, res) => {
  try {
    const slug = pid(req.params.slug);
    const old = (await read(slug)).image_url;
    await pool.query('UPDATE page_content SET image_url = NULL WHERE slug = ?', [slug]);
    rmUrl(old);
    return res.json({ removed: true });
  } catch (e: any) { return fail(res, e, 'Could not remove the photo.'); }
});

// ---------- Public (the website) ----------
router.get('/:slug', async (req, res) => {
  try {
    const slug = pid(req.params.slug);
    if (!SLUGS.includes(slug)) return res.status(404).json({ content: {}, image_url: null });
    return res.json(await read(slug));
  } catch { return res.status(500).json({ content: {}, image_url: null }); }
});

export default router;