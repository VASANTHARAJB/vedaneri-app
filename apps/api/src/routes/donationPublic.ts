import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

const CATEGORIES = ['donation', 'corpus', 'ashram'];
const RECURRENCES = ['none', 'annual', 'monthly_tithi'];

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
    console.error('[DonatePublic] tithi lookup failed:', e);
    return null;
  }
}

// Only the fields the website needs
async function toPublic(r: any) {
  const recurrence = RECURRENCES.includes(r.recurrence_type) ? r.recurrence_type : 'none';
  const trigger = r.tithi_trigger || r.panchangam_tag || '';
  let eventDate: string | null = r.event_date_str || null;
  if (recurrence === 'monthly_tithi') {
    const next = await nextTithiDate(trigger);
    if (next) eventDate = next;
  }

  const titleEn = r.title_en || 'Fund';
  return {
    id: String(r.id),
    slug: r.slug,
    category: CATEGORIES.includes(r.category) ? r.category : 'ashram',
    title_en: titleEn,
    title_ta: r.title_ta || titleEn,
    description_en: r.description_en || '',
    description_ta: r.description_ta || r.description_en || '',
    amount: Number(r.amount) || 0,
    price_type: r.price_type === 'fixed' ? 'fixed' : 'custom',
    image_url: r.image_url || '',
    recurrence_type: recurrence,
    event_date: eventDate,
    tithi_trigger: r.tithi_trigger || '',
    status: 'published',
  };
}

const COLS = `*, DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date_str`;

// GET /api/v1/donate/funds?category=donation,corpus
router.get('/funds', async (req: Request, res: Response) => {
  try {
    const wanted = String(req.query.category || '')
      .split(',')
      .map((c) => c.trim())
      .filter((c) => CATEGORIES.includes(c));

    const where = wanted.length ? `AND category IN (${wanted.map(() => '?').join(',')})` : '';
    const [rows]: any = await pool.query(
      `SELECT ${COLS} FROM donation WHERE status = 'published' ${where}
       ORDER BY sort_order ASC, created_at DESC`,
      wanted
    );
    const funds = await Promise.all((rows || []).map(toPublic));
    res.set('Cache-Control', 'no-store');
    return res.json({ funds });
  } catch (error: any) {
    console.error('Public donation funds error:', error);
    return res.status(500).json({ message: 'Failed to load donation funds' });
  }
});

// GET /api/v1/donate/funds/:slug  (fund detail page)
router.get('/funds/:slug', async (req: Request, res: Response) => {
  try {
    const key = String(req.params.slug || '').trim();
    const [rows]: any = await pool.query(
      `SELECT ${COLS} FROM donation WHERE status = 'published' AND (slug = ? OR id = ?) LIMIT 1`,
      [key, key]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'Donation fund not found' });
    res.set('Cache-Control', 'no-store');
    return res.json({ fund: await toPublic(rows[0]) });
  } catch (error: any) {
    console.error('Public donation fund error:', error);
    return res.status(500).json({ message: 'Failed to load donation fund' });
  }
});

export default router;