import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ---------- image upload ----------
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `fund-${Date.now()}-${Math.round(Math.random() * 1e4)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed'));
  },
});

const guard = (req: Request, res: Response, next: NextFunction) =>
  authenticate(req as AuthenticatedRequest, res, next);

// ---------- helpers ----------
const RECURRENCES = ['none', 'annual', 'monthly_tithi'];
const CATEGORIES = ['donation', 'corpus', 'ashram'];

function slugify(title: string): string {
  const base = String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'fund'}-${Date.now().toString().slice(-4)}`;
}

function formatDDMMYYYY(ymd: string | null): string {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

async function nextTithiDate(trigger: string): Promise<string | null> {
  if (!trigger) return null;
  try {
    const [rows]: any = await pool.query(
      `SELECT DATE_FORMAT(calendar_date, '%Y-%m-%d') AS d
       FROM panchangam_calendar
       WHERE (thithi LIKE ? OR special_event LIKE ?) AND calendar_date >= CURDATE()
       ORDER BY calendar_date ASC LIMIT 1`,
      [`%${trigger}%`, `%${trigger}%`]
    );
    return rows && rows.length ? rows[0].d : null;
  } catch (e) {
    console.error('[DonationFunds] next tithi lookup failed:', e);
    return null;
  }
}

async function shapeRow(r: any) {
  const recurrence = RECURRENCES.includes(r.recurrence_type) ? r.recurrence_type : 'none';
  const trigger = r.tithi_trigger || r.panchangam_tag || '';
  let nextDate: string | null = r.event_date_str || null;

  if (recurrence === 'monthly_tithi') {
    const found = await nextTithiDate(trigger);
    if (found) nextDate = found;
  }

  const titleEn = r.title_en || 'Fund';
  const titleTa = r.title_ta || titleEn;
  const dateStr = recurrence !== 'none' && nextDate ? formatDDMMYYYY(nextDate) : '';
  const amount = Number(r.amount) || 0;

  return {
    id: String(r.id),
    slug: r.slug,
    category: CATEGORIES.includes(r.category) ? r.category : 'ashram',
    title_en: titleEn,
    title_ta: titleTa,
    display_title_en: dateStr && !titleEn.includes(dateStr) ? `${titleEn} - ${dateStr}` : titleEn,
    display_title_ta: dateStr && !titleTa.includes(dateStr) ? `${titleTa} - ${dateStr}` : titleTa,
    description_en: r.description_en || '',
    description_ta: r.description_ta || '',
    amount,
    price: amount,
    price_type: r.price_type === 'fixed' ? 'fixed' : 'custom',
    status: r.status === 'draft' ? 'draft' : 'published',
    image_url: r.image_url || '',
    is_event_seva: recurrence !== 'none',
    recurrence_type: recurrence,
    event_date: nextDate,
    tithi_trigger: r.tithi_trigger || '',
    panchangam_tag: r.panchangam_tag || '',
    sort_order: Number(r.sort_order) || 0,
    last_updated: r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-IN') : '',
  };
}

function parseBody(body: any): { error?: string; data?: any } {
  const title_en = String(body?.title_en || '').trim();
  if (!title_en) return { error: 'English title is required' };

  const category = CATEGORIES.includes(body?.category) ? body.category : 'donation';

  const price_type = body?.price_type === 'fixed' ? 'fixed' : 'custom';
  let amount = 0;
  if (price_type === 'fixed') {
    amount = Math.round(Number(body?.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 1) return { error: 'A fixed amount of at least 1 is required' };
    if (amount > 10000000) return { error: 'Amount is too large' };
  }

  const recurrence_type = RECURRENCES.includes(body?.recurrence_type) ? body.recurrence_type : 'none';
  let event_date: string | null = null;
  let tithi_trigger: string | null = null;

  if (recurrence_type === 'annual') {
    const d = String(body?.event_date || '').split('T')[0];
    if (!isValidYmd(d)) return { error: 'A valid festival date is required for an annual fund' };
    event_date = d;
  }
  if (recurrence_type === 'monthly_tithi') {
    tithi_trigger = String(body?.tithi_trigger || '').trim().slice(0, 100);
    if (!tithi_trigger) return { error: 'Choose a tithi for a monthly fund' };
  }

  const imageUrl = String(body?.image_url || '').trim();
  if (imageUrl && !/^\/uploads\/[\w.\-]+$/.test(imageUrl) && !/^https?:\/\//.test(imageUrl)) {
    return { error: 'Invalid image address' };
  }

  return {
    data: {
      category,
      title_en: title_en.slice(0, 255),
      title_ta: String(body?.title_ta || '').trim().slice(0, 255) || title_en.slice(0, 255),
      description_en: String(body?.description_en || '').trim(),
      description_ta: String(body?.description_ta || '').trim(),
      price_type,
      amount,
      status: body?.status === 'draft' ? 'draft' : 'published',
      image_url: imageUrl,
      recurrence_type,
      event_date,
      tithi_trigger,
      panchangam_tag: String(body?.panchangam_tag || '').trim().slice(0, 150) || tithi_trigger,
    },
  };
}

const SELECT_COLS = `*, DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date_str`;

// 1. PUBLIC LIST (published only). Optional filter: ?category=donation|corpus|ashram
router.get('/', async (req: Request, res: Response) => {
  try {
    const cat = String(req.query.category || '');
    const useCat = CATEGORIES.includes(cat);
    const [rows]: any = await pool.query(
      `SELECT ${SELECT_COLS} FROM donation WHERE status = 'published' ${useCat ? 'AND category = ?' : ''}
       ORDER BY sort_order ASC, created_at DESC`,
      useCat ? [cat] : []
    );
    const funds = await Promise.all((rows || []).map(shapeRow));
    return res.json({ funds });
  } catch (error: any) {
    console.error('Fetch donation funds error:', error);
    return res.status(500).json({ message: 'Failed to fetch donation funds' });
  }
});

// 2. ADMIN LIST (all funds, login required)
router.get('/admin', guard, async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT ${SELECT_COLS} FROM donation ORDER BY sort_order ASC, created_at DESC`
    );
    const funds = await Promise.all((rows || []).map(shapeRow));
    const stats = {
      total: funds.length,
      published: funds.filter((f: any) => f.status === 'published').length,
      drafts: funds.filter((f: any) => f.status === 'draft').length,
      open: funds.filter((f: any) => f.price_type === 'custom').length,
      donation: funds.filter((f: any) => f.category === 'donation').length,
      corpus: funds.filter((f: any) => f.category === 'corpus').length,
      ashram: funds.filter((f: any) => f.category === 'ashram').length,
    };
    return res.json({ funds, stats });
  } catch (error: any) {
    console.error('Fetch admin donation funds error:', error);
    return res.status(500).json({ message: 'Failed to fetch donation funds' });
  }
});

// 3. IMAGE UPLOAD
router.post('/upload', guard, (req: Request, res: Response) => {
  upload.single('image')(req, res, (err: any) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    return res.json({ url: `/uploads/${req.file.filename}` });
  });
});

// 4. CREATE
router.post('/', guard, async (req: Request, res: Response) => {
  try {
    const parsed = parseBody(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const d = parsed.data;

    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO donation
        (id, slug, category, title_en, title_ta, description_en, description_ta, price_type, amount,
         status, image_url, recurrence_type, event_date, tithi_trigger, panchangam_tag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, slugify(d.title_en), d.category, d.title_en, d.title_ta, d.description_en, d.description_ta,
        d.price_type, d.amount, d.status, d.image_url, d.recurrence_type, d.event_date,
        d.tithi_trigger, d.panchangam_tag,
      ]
    );
    return res.status(201).json({ message: 'Created successfully', id });
  } catch (error: any) {
    console.error('Create donation fund error:', error);
    return res.status(500).json({ message: 'Failed to create donation fund' });
  }
});

// 5. UPDATE
router.put('/:id', guard, async (req: Request, res: Response) => {
  try {
    const parsed = parseBody(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const d = parsed.data;

    const [result]: any = await pool.query(
      `UPDATE donation SET
         category = ?, title_en = ?, title_ta = ?, description_en = ?, description_ta = ?, price_type = ?, amount = ?,
         status = ?, image_url = ?, recurrence_type = ?, event_date = ?, tithi_trigger = ?, panchangam_tag = ?
       WHERE id = ?`,
      [
        d.category, d.title_en, d.title_ta, d.description_en, d.description_ta, d.price_type, d.amount,
        d.status, d.image_url, d.recurrence_type, d.event_date, d.tithi_trigger, d.panchangam_tag,
        req.params.id,
      ]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Donation fund not found' });
    return res.json({ message: 'Updated successfully', id: req.params.id });
  } catch (error: any) {
    console.error('Update donation fund error:', error);
    return res.status(500).json({ message: 'Failed to update donation fund' });
  }
});

// 6. TOGGLE PUBLISHED / DRAFT
router.patch('/:id/toggle-status', guard, async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query(
      `UPDATE donation SET status = IF(status = 'published', 'draft', 'published') WHERE id = ?`,
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Donation fund not found' });
    return res.json({ message: 'Status toggled successfully' });
  } catch (error: any) {
    console.error('Toggle donation fund error:', error);
    return res.status(500).json({ message: 'Failed to toggle status' });
  }
});

// 7. DELETE (blocked when donations exist for the fund)
router.delete('/:id', guard, async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query('DELETE FROM donation WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Donation fund not found' });
    return res.json({ message: 'Deleted successfully' });
  } catch (error: any) {
    if (error?.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        message: 'This fund has donations recorded against it and cannot be deleted. Move it to Draft instead.',
      });
    }
    console.error('Delete donation fund error:', error);
    return res.status(500).json({ message: 'Failed to delete donation fund' });
  }
});

export default router;