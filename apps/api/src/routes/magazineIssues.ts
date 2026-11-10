import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

// Magazine issues that are put on the website to read or download (a cover photo and a PDF each).
// This is separate from the magazine subscription plans.
const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const dbg = (e: any) => (IS_PROD ? undefined : e?.sqlMessage || e?.message || String(e));
const fail = (res: Response, e: any, message: string) => {
  console.error(`MagazineIssues: ${message}`, e?.sqlMessage || e?.message || e);
  return res.status(500).json({ message, detail: dbg(e) });
};
const pid = (v: any) => String(Array.isArray(v) ? v[0] : v);
const adminGuard = (req: Request, res: Response, next: NextFunction) => authenticate(req as AuthenticatedRequest, res, next);

let ready: Promise<boolean> | null = null;
function ensureTable(): Promise<boolean> {
  if (!ready) {
    ready = pool.query(
      `CREATE TABLE IF NOT EXISTS magazine_editions (
        id int(11) NOT NULL AUTO_INCREMENT,
        title_en varchar(200) NOT NULL,
        title_ta varchar(300) DEFAULT NULL,
        label_en varchar(120) DEFAULT NULL,
        label_ta varchar(200) DEFAULT NULL,
        description_en text DEFAULT NULL,
        description_ta text DEFAULT NULL,
        issue_date date NOT NULL,
        cover_url varchar(500) DEFAULT NULL,
        pdf_url varchar(500) DEFAULT NULL,
        pdf_size bigint(20) DEFAULT NULL,
        status enum('draft','published') NOT NULL DEFAULT 'draft',
        created_at datetime DEFAULT current_timestamp(),
        updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id),
        KEY idx_status_date (status, issue_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ).then(() => true).catch((e: any) => { console.error('[MagazineIssues] table:', e?.sqlMessage || e?.message || e); ready = null; return false; });
  }
  return ready as Promise<boolean>;
}
void ensureTable();
router.use(async (_req, _res, next) => { try { await ensureTable(); } catch { /* reported by the request */ } next(); });

const dir = path.resolve(__dirname, '../../uploads/magazine-issues');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const PREFIX = '/uploads/magazine-issues/';
const rmUrl = (u?: string | null) => { if (u && u.startsWith(PREFIX)) fs.unlink(path.join(dir, path.basename(u)), () => {}); };

const MAX_PDF_MB = 80;
const rawName = () => `raw-${Date.now()}-${crypto.randomInt(0, 100000)}`;
const storage = multer.diskStorage({ destination: (_r, _f, cb) => cb(null, dir), filename: (_r, _f, cb) => cb(null, rawName()) });

const imageUpload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => (/^image\/(jpeg|png|webp)$/.test(f.mimetype) ? cb(null, true) : cb(new Error('The cover must be a JPG, PNG or WebP image.'))),
});
const pdfUpload = multer({
  storage,
  limits: { fileSize: MAX_PDF_MB * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => (f.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('The magazine must be a PDF file.'))),
});
const single = (u: multer.Multer, field: string, tooBig: string) => (req: Request, res: Response, next: NextFunction) => {
  u.single(field)(req, res, (err: any) => {
    if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? tooBig : err.message || 'Upload failed.' });
    next();
  });
};

const str = (v: any, max: number) => String(v ?? '').trim().slice(0, max);
const ownUrl = (v: any) => { const s = String(v ?? '').trim(); return s === '' ? '' : s.startsWith(PREFIX) && !s.includes('..') ? s : null; };

// ---------- Admin ----------
router.get('/admin', adminGuard, async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, title_en, title_ta, label_en, label_ta, description_en, description_ta, DATE_FORMAT(issue_date, '%Y-%m-%d') AS issue_date, cover_url, pdf_url, pdf_size, status, created_at FROM magazine_editions ORDER BY magazine_editions.issue_date DESC, id DESC`
    );
    return res.json({ issues: rows.map((r: any) => ({ ...r, pdf_size: r.pdf_size == null ? null : Number(r.pdf_size) })) });
  } catch (e: any) { return fail(res, e, 'Could not load the issues.'); }
});

// Reads and checks the form. Returns the values to save, or a message.
function readBody(b: any): { v?: any; message?: string } {
  const title_en = str(b?.title_en, 200);
  if (!title_en) return { message: 'Enter the title.' };
  const issue_date = str(b?.issue_date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issue_date) || Number.isNaN(Date.parse(issue_date))) return { message: 'Choose the issue date.' };
  const cover_url = ownUrl(b?.cover_url);
  const pdf_url = ownUrl(b?.pdf_url);
  if (cover_url === null || pdf_url === null) return { message: 'Upload the cover and the PDF again.' };
  const status = b?.status === 'published' ? 'published' : 'draft';
  if (status === 'published' && !pdf_url) return { message: 'Upload the PDF before publishing.' };
  return {
    v: {
      title_en, title_ta: str(b?.title_ta, 300) || null, label_en: str(b?.label_en, 120) || null, label_ta: str(b?.label_ta, 200) || null,
      description_en: str(b?.description_en, 4000) || null, description_ta: str(b?.description_ta, 4000) || null,
      issue_date, cover_url: cover_url || null, pdf_url: pdf_url || null, pdf_size: Number(b?.pdf_size) > 0 ? Math.round(Number(b.pdf_size)) : null, status,
    },
  };
}

router.post('/admin', adminGuard, async (req, res) => {
  try {
    const { v, message } = readBody(req.body);
    if (!v) return res.status(400).json({ message });
    const [r]: any = await pool.query(
      `INSERT INTO magazine_editions (title_en, title_ta, label_en, label_ta, description_en, description_ta, issue_date, cover_url, pdf_url, pdf_size, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [v.title_en, v.title_ta, v.label_en, v.label_ta, v.description_en, v.description_ta, v.issue_date, v.cover_url, v.pdf_url, v.pdf_size, v.status]
    );
    return res.json({ id: r.insertId });
  } catch (e: any) { return fail(res, e, 'Could not save the issue.'); }
});

router.put('/admin/:id', adminGuard, async (req, res) => {
  try {
    const id = Number(pid(req.params.id));
    const { v, message } = readBody(req.body);
    if (!v) return res.status(400).json({ message });
    const [old]: any = await pool.query('SELECT cover_url, pdf_url FROM magazine_editions WHERE id = ?', [id]);
    if (!old[0]) return res.status(404).json({ message: 'Issue not found.' });
    await pool.query(
      `UPDATE magazine_editions SET title_en=?, title_ta=?, label_en=?, label_ta=?, description_en=?, description_ta=?, issue_date=?, cover_url=?, pdf_url=?, pdf_size=?, status=? WHERE id=?`,
      [v.title_en, v.title_ta, v.label_en, v.label_ta, v.description_en, v.description_ta, v.issue_date, v.cover_url, v.pdf_url, v.pdf_size, v.status, id]
    );
    // A cover or PDF that was replaced or removed is deleted from the server
    if (old[0].cover_url && old[0].cover_url !== v.cover_url) rmUrl(old[0].cover_url);
    if (old[0].pdf_url && old[0].pdf_url !== v.pdf_url) rmUrl(old[0].pdf_url);
    return res.json({ saved: true });
  } catch (e: any) { return fail(res, e, 'Could not save the issue.'); }
});

router.patch('/admin/:id/status', adminGuard, async (req, res) => {
  try {
    const id = Number(pid(req.params.id));
    const status = req.body?.status === 'published' ? 'published' : 'draft';
    if (status === 'published') {
      const [r]: any = await pool.query('SELECT pdf_url FROM magazine_editions WHERE id = ?', [id]);
      if (!r[0]) return res.status(404).json({ message: 'Issue not found.' });
      if (!r[0].pdf_url) return res.status(400).json({ message: 'Upload the PDF before publishing.' });
    }
    await pool.query('UPDATE magazine_editions SET status = ? WHERE id = ?', [status, id]);
    return res.json({ status });
  } catch (e: any) { return fail(res, e, 'Could not change the status.'); }
});

router.delete('/admin/:id', adminGuard, async (req, res) => {
  try {
    const id = Number(pid(req.params.id));
    const [old]: any = await pool.query('SELECT cover_url, pdf_url FROM magazine_editions WHERE id = ?', [id]);
    if (!old[0]) return res.status(404).json({ message: 'Issue not found.' });
    await pool.query('DELETE FROM magazine_editions WHERE id = ?', [id]);
    rmUrl(old[0].cover_url); rmUrl(old[0].pdf_url);
    return res.json({ deleted: true });
  } catch (e: any) { return fail(res, e, 'Could not delete the issue.'); }
});

// Cover photo: saved as a smaller WebP
router.post('/admin/upload/cover', adminGuard, single(imageUpload, 'image', 'The cover is too large (up to 30MB).'), async (req: Request, res: Response) => {
  const f = (req as any).file;
  try {
    if (!f) return res.status(400).json({ message: 'Choose a cover photo.' });
    const name = `cover-${Date.now()}-${crypto.randomInt(0, 100000)}.webp`;
    await sharp(f.path).rotate().resize({ width: 900, height: 1300, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(dir, name));
    fs.unlink(f.path, () => {});
    return res.json({ url: `${PREFIX}${name}` });
  } catch (e: any) { if (f) fs.unlink(f.path, () => {}); return fail(res, e, 'Could not save the cover.'); }
});

// The magazine PDF. The file must really start with %PDF, the file type alone is not trusted.
router.post('/admin/upload/pdf', adminGuard, single(pdfUpload, 'pdf', `The PDF is too large (up to ${MAX_PDF_MB}MB).`), async (req: Request, res: Response) => {
  const f = (req as any).file;
  try {
    if (!f) return res.status(400).json({ message: 'Choose the PDF file.' });
    const fd = fs.openSync(f.path, 'r');
    const head = Buffer.alloc(5);
    fs.readSync(fd, head, 0, 5, 0);
    fs.closeSync(fd);
    if (head.toString('latin1') !== '%PDF-') { fs.unlink(f.path, () => {}); return res.status(400).json({ message: 'This file is not a valid PDF.' }); }
    const name = `issue-${Date.now()}-${crypto.randomInt(0, 100000)}.pdf`;
    fs.renameSync(f.path, path.join(dir, name));
    return res.json({ url: `${PREFIX}${name}`, size: f.size });
  } catch (e: any) { if (f) fs.unlink(f.path, () => {}); return fail(res, e, 'Could not save the PDF.'); }
});

// ---------- Public (the website): published issues, newest first ----------
router.get('/', async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, title_en, title_ta, label_en, label_ta, description_en, description_ta, DATE_FORMAT(issue_date, '%Y-%m-%d') AS issue_date, cover_url, pdf_url, pdf_size
       FROM magazine_editions WHERE status = 'published' AND pdf_url IS NOT NULL ORDER BY magazine_editions.issue_date DESC, id DESC`
    );
    return res.json({ issues: rows.map((r: any) => ({ ...r, pdf_size: r.pdf_size == null ? null : Number(r.pdf_size) })) });
  } catch { return res.status(500).json({ issues: [] }); }
});

export default router;