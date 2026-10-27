import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

// 1. Setup Image Upload Directory
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `seva-${Date.now()}-${Math.round(Math.random() * 1e4)}${ext}`;
    cb(null, uniqueName);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Helper: Safely resolve table name (sevas or offerings)
async function getTableName(): Promise<string> {
  try {
    const [rows]: any = await pool.query("SHOW TABLES LIKE 'sevas'");
    if (rows && rows.length > 0) return 'sevas';
  } catch (_) {}
  return 'offerings';
}

// Helper: Safely extract string from locale JSON or string
function parseLocaleField(val: any, lang: 'en' | 'ta' = 'en'): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseLocaleField(parsed, lang);
      } catch (_) {
        return val;
      }
    }
    return val;
  }
  if (typeof val === 'object') {
    return lang === 'ta'
      ? String(val.ta || val.tamil || val.en || '')
      : String(val.en || val.english || val.ta || '');
  }
  return String(val);
}

// Helper: Format Date to DD.MM.YYYY
function formatDDMMYYYY(d: Date | string | null): string {
  if (!d) return '';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const dd = String(dateObj.getUTCDate()).padStart(2, '0');
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// -------------------------------------------------------------
// 1. IMAGE UPLOAD
// -------------------------------------------------------------
router.post(
  '/upload',
  (req: Request, res: Response, next: NextFunction) => {
    authenticate(req as AuthenticatedRequest, res, next);
  },
  upload.single('image'),
  (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    return res.json({ url: `/uploads/${req.file.filename}` });
  }
);

// -------------------------------------------------------------
// 2. GET ALL SEVAS / CORPUS (With Dynamic Panchangam Next Date)
// -------------------------------------------------------------
router.get('/', async (_req: Request, res: Response) => {
  try {
    const table = await getTableName();
    const [rows]: any = await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);

    const sevas = await Promise.all(
      (rows || []).map(async (r: any) => {
        const rawTitle = r.title_en ?? r.title ?? r.name;
        const titleEn = parseLocaleField(rawTitle, 'en') || 'Item';
        const titleTa = parseLocaleField(r.title_ta ?? r.title_tamil ?? rawTitle, 'ta') || titleEn;

        const rawDesc = r.description_en ?? r.description;
        const descEn = parseLocaleField(rawDesc, 'en');
        const descTa = parseLocaleField(r.description_ta ?? r.description_tamil ?? rawDesc, 'ta');

        // Safe price extractor
        const candidateAmounts = [r.amount, r.price, r.rate, r.base_amount, r.fixed_amount];
        let amt = 0;
        for (const val of candidateAmounts) {
          if (val !== null && val !== undefined && val !== '' && !isNaN(Number(val)) && Number(val) > 0) {
            amt = Number(val);
            break;
          }
        }

        const category = r.category === 'corpus' ? 'corpus' : 'seva';
        const priceType = r.price_type === 'custom' ? 'custom' : 'fixed';
        const status = r.status === 'draft' || r.is_active === 0 ? 'draft' : 'published';
        const pkId = r.id ?? r.offering_id ?? r.seva_id ?? r._id;

        // --- DYNAMIC PANCHANGAM EVENT & TITHI CALCULATION ---
        const isEventSeva = Boolean(r.is_event_seva);
        const recurrenceType = r.recurrence_type || (isEventSeva ? 'annual' : 'none');
        const tithiTrigger = r.tithi_trigger || r.panchangam_tag || '';
        let nextEventDate: string | null = r.event_date ? new Date(r.event_date).toISOString().split('T')[0] : null;
        let panchangamDetails: any = null;

        // If Monthly Tithi Seva (e.g., Monthly Skanda Shashti), find the NEXT upcoming date from panchangam_calendar
        if (recurrenceType === 'monthly_tithi' && tithiTrigger) {
          try {
            const [panchangamRows]: any = await pool.query(
              `SELECT 
                DATE_FORMAT(calendar_date, '%Y-%m-%d') as calendar_date,
                tamil_year,
                tamil_month,
                tamil_date,
                thithi,
                nakshatram,
                special_event
               FROM panchangam_calendar
               WHERE (thithi LIKE ? OR special_event LIKE ?)
                 AND calendar_date >= CURDATE()
               ORDER BY calendar_date ASC
               LIMIT 1`,
              [`%${tithiTrigger}%`, `%${tithiTrigger}%`]
            );

            if (panchangamRows && panchangamRows.length > 0) {
              nextEventDate = panchangamRows[0].calendar_date;
              panchangamDetails = panchangamRows[0];
            }
          } catch (e) {
            console.error('Error auto-fetching next panchangam date:', e);
          }
        }

        // Generate clean display titles with date (e.g. "Sri Skanda Shashti Puja - 15.11.2026")
        let displayTitleEn = titleEn;
        let displayTitleTa = titleTa;

        if ((isEventSeva || recurrenceType !== 'none') && nextEventDate) {
          const dateStr = formatDDMMYYYY(nextEventDate);
          if (dateStr && !titleEn.includes(dateStr)) {
            displayTitleEn = `${titleEn} - ${dateStr}`;
          }
          if (dateStr && !titleTa.includes(dateStr)) {
            displayTitleTa = `${titleTa} - ${dateStr}`;
          }
        }

        return {
          id: String(pkId),
          slug: r.slug || `seva-${pkId}`,
          title_en: titleEn,
          title_ta: titleTa,
          display_title_en: displayTitleEn,
          display_title_ta: displayTitleTa,
          description_en: descEn,
          description_ta: descTa,
          amount: amt,
          price: amt,
          price_type: priceType,
          category,
          status,
          image_url: r.image_url || r.image || '',
          // Event Pinning & Monthly Tithi Sync Fields
          is_event_seva: isEventSeva,
          recurrence_type: recurrenceType, // 'none' | 'annual' | 'monthly_tithi'
          event_date: nextEventDate,
          tithi_trigger: tithiTrigger,
          panchangam_tag: r.panchangam_tag || '',
          panchangam_details: panchangamDetails,
          last_updated: r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-IN') : 'Live',
        };
      })
    );

    const total = sevas.length;
    const sevaCount = sevas.filter((s: any) => s.category === 'seva').length;
    const corpusCount = sevas.filter((s: any) => s.category === 'corpus').length;
    const publishedCount = sevas.filter((s: any) => s.status === 'published').length;

    return res.json({
      sevas,
      stats: { total, sevaCount, corpusCount, publishedCount },
    });
  } catch (error: any) {
    console.error('Fetch offerings error:', error);
    return res.status(500).json({ message: 'Failed to fetch catalog', error: error.message });
  }
});

// -------------------------------------------------------------
// 3. GET UPCOMING 12 MONTH DATES FOR A RECURRING SEVA
// -------------------------------------------------------------
router.get('/:id/upcoming-dates', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const table = await getTableName();

    const [rows]: any = await pool.query(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Seva not found' });
    }

    const item = rows[0];
    const trigger = item.tithi_trigger || item.panchangam_tag || 'Sashti';

    // Fetch the next 12 occurrences from panchangam_calendar
    const [dates]: any = await pool.query(
      `SELECT 
        DATE_FORMAT(calendar_date, '%Y-%m-%d') as calendar_date,
        tamil_year,
        tamil_month,
        tamil_date,
        thithi,
        nakshatram,
        special_event
       FROM panchangam_calendar
       WHERE (thithi LIKE ? OR special_event LIKE ?)
         AND calendar_date >= CURDATE()
       ORDER BY calendar_date ASC
       LIMIT 12`,
      [`%${trigger}%`, `%${trigger}%`]
    );

    return res.json({
      success: true,
      seva_id: id,
      trigger,
      upcoming_dates: dates || [],
    });
  } catch (error: any) {
    console.error('Fetch upcoming dates error:', error);
    return res.status(500).json({ message: 'Failed to fetch dates', error: error.message });
  }
});

// -------------------------------------------------------------
// 4. UPDATE SEVA / CORPUS
// -------------------------------------------------------------
router.put(
  '/:id',
  (req: Request, res: Response, next: NextFunction) => {
    authenticate(req as AuthenticatedRequest, res, next);
  },
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const table = await getTableName();

      const {
        title_en,
        title_ta,
        description_en,
        description_ta,
        amount,
        price,
        price_type,
        category,
        status,
        image_url,
        is_event_seva,
        recurrence_type,
        event_date,
        tithi_trigger,
        panchangam_tag,
      } = req.body;

      const [colRows]: any = await pool.query(`SHOW COLUMNS FROM ${table}`);
      const columns = colRows.map((c: any) => c.Field);
      const pkCol =
        colRows.find((c: any) => c.Key === 'PRI')?.Field ||
        (columns.includes('id') ? 'id' : columns[0]);

      const updates: string[] = [];
      const values: any[] = [];

      // Clean numeric amount
      const rawAmt = amount ?? price ?? 0;
      const cleanNum =
        typeof rawAmt === 'string'
          ? Number(rawAmt.replace(/[^0-9.]/g, '')) || 0
          : Number(rawAmt) || 0;
      const finalAmount = price_type === 'custom' ? 0 : cleanNum;

      // 1. Title
      if (columns.includes('title_en')) {
        updates.push('title_en = ?');
        values.push(title_en || '');
        if (columns.includes('title_ta')) {
          updates.push('title_ta = ?');
          values.push(title_ta || title_en || '');
        }
      } else if (columns.includes('title')) {
        updates.push('title = ?');
        values.push(JSON.stringify({ en: title_en || '', ta: title_ta || title_en || '' }));
      } else if (columns.includes('name')) {
        updates.push('name = ?');
        values.push(title_en || '');
      }

      // 2. Description
      if (columns.includes('description_en')) {
        updates.push('description_en = ?');
        values.push(description_en || '');
        if (columns.includes('description_ta')) {
          updates.push('description_ta = ?');
          values.push(description_ta || description_en || '');
        }
      } else if (columns.includes('description')) {
        updates.push('description = ?');
        values.push(JSON.stringify({ en: description_en || '', ta: description_ta || '' }));
      }

      // 3. Price columns
      const priceCols = ['amount', 'price', 'rate', 'base_amount', 'fixed_amount'];
      for (const col of priceCols) {
        if (columns.includes(col)) {
          updates.push(`${col} = ?`);
          values.push(finalAmount);
        }
      }

      if (columns.includes('price_type')) {
        updates.push('price_type = ?');
        values.push(price_type || 'fixed');
      }

      if (columns.includes('category')) {
        updates.push('category = ?');
        values.push(category || 'seva');
      }

      // 4. Status
      if (columns.includes('status')) {
        updates.push('status = ?');
        values.push(status || 'published');
      }
      if (columns.includes('is_active')) {
        updates.push('is_active = ?');
        values.push(status === 'draft' ? 0 : 1);
      } else if (columns.includes('active')) {
        updates.push('active = ?');
        values.push(status === 'draft' ? 0 : 1);
      }

      // 5. Image
      if (columns.includes('image_url')) {
        updates.push('image_url = ?');
        values.push(image_url || '');
      } else if (columns.includes('image')) {
        updates.push('image = ?');
        values.push(image_url || '');
      }

      // 6. Event Pinning & Tithi Sync Fields
      if (columns.includes('is_event_seva')) {
        updates.push('is_event_seva = ?');
        values.push(is_event_seva ? 1 : 0);
      }
      if (columns.includes('recurrence_type')) {
        updates.push('recurrence_type = ?');
        values.push(recurrence_type || (is_event_seva ? 'annual' : 'none'));
      }
      if (columns.includes('event_date')) {
        updates.push('event_date = ?');
        values.push(event_date || null);
      }
      if (columns.includes('tithi_trigger')) {
        updates.push('tithi_trigger = ?');
        values.push(tithi_trigger || panchangam_tag || null);
      }
      if (columns.includes('panchangam_tag')) {
        updates.push('panchangam_tag = ?');
        values.push(panchangam_tag || tithi_trigger || null);
      }

      if (columns.includes('updated_at')) {
        updates.push('updated_at = NOW()');
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'No valid columns to update' });
      }

      values.push(id);
      const sqlQuery = `UPDATE ${table} SET ${updates.join(', ')} WHERE ${pkCol} = ?`;
      await pool.query(sqlQuery, values);

      return res.json({
        message: 'Updated successfully',
        id,
        amount: finalAmount,
      });
    } catch (error: any) {
      console.error('Update offering error:', error);
      return res.status(500).json({ message: 'Failed to update item', error: error.message });
    }
  }
);

// -------------------------------------------------------------
// 5. CREATE SEVA / CORPUS
// -------------------------------------------------------------
router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    authenticate(req as AuthenticatedRequest, res, next);
  },
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const table = await getTableName();
      const {
        title_en,
        title_ta,
        description_en,
        description_ta,
        amount,
        price,
        price_type = 'fixed',
        category = 'seva',
        status = 'published',
        image_url = '',
        is_event_seva = false,
        recurrence_type = 'none',
        event_date = null,
        tithi_trigger = '',
        panchangam_tag = '',
      } = req.body;

      if (!title_en) {
        return res.status(400).json({ message: 'English Title is required' });
      }

      const [colRows]: any = await pool.query(`SHOW COLUMNS FROM ${table}`);
      const columns = colRows.map((c: any) => c.Field);
      const data: Record<string, any> = {};

      const rawAmt = amount ?? price ?? 0;
      const cleanNum =
        typeof rawAmt === 'string'
          ? Number(rawAmt.replace(/[^0-9.]/g, '')) || 0
          : Number(rawAmt) || 0;
      const finalAmount = price_type === 'custom' ? 0 : cleanNum;

      // Handle UUID if primary key is char/varchar
      const idCol = colRows.find((c: any) => c.Field === 'id');
      if (
        idCol &&
        (idCol.Type.includes('char') || idCol.Type.includes('varchar')) &&
        !idCol.Default
      ) {
        data.id = crypto.randomUUID();
      }

      if (columns.includes('slug')) {
        data.slug =
          String(title_en)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') +
          '-' +
          Date.now().toString().slice(-4);
      }

      if (columns.includes('title_en')) {
        data.title_en = title_en;
        if (columns.includes('title_ta')) data.title_ta = title_ta || title_en;
      } else if (columns.includes('title')) {
        data.title = JSON.stringify({ en: title_en, ta: title_ta || title_en });
      } else if (columns.includes('name')) {
        data.name = title_en;
      }

      if (columns.includes('description_en')) {
        data.description_en = description_en || '';
        if (columns.includes('description_ta'))
          data.description_ta = description_ta || description_en || '';
      } else if (columns.includes('description')) {
        data.description = JSON.stringify({ en: description_en || '', ta: description_ta || '' });
      }

      if (columns.includes('amount')) data.amount = finalAmount;
      if (columns.includes('price')) data.price = finalAmount;
      if (columns.includes('rate')) data.rate = finalAmount;
      if (columns.includes('base_amount')) data.base_amount = finalAmount;

      if (columns.includes('price_type')) data.price_type = price_type;
      if (columns.includes('category')) data.category = category;
      if (columns.includes('status')) data.status = status;

      if (columns.includes('is_active')) data.is_active = status === 'published' ? 1 : 0;
      else if (columns.includes('active')) data.active = status === 'published' ? 1 : 0;

      if (columns.includes('image_url')) data.image_url = image_url;
      else if (columns.includes('image')) data.image = image_url;

      // Event Pinning & Tithi Sync Fields
      if (columns.includes('is_event_seva')) data.is_event_seva = is_event_seva ? 1 : 0;
      if (columns.includes('recurrence_type')) data.recurrence_type = recurrence_type || (is_event_seva ? 'annual' : 'none');
      if (columns.includes('event_date')) data.event_date = event_date || null;
      if (columns.includes('tithi_trigger')) data.tithi_trigger = tithi_trigger || panchangam_tag || null;
      if (columns.includes('panchangam_tag')) data.panchangam_tag = panchangam_tag || tithi_trigger || null;

      if (columns.includes('created_at')) data.created_at = new Date();
      if (columns.includes('updated_at')) data.updated_at = new Date();

      const keys = Object.keys(data);
      const vals = Object.values(data);
      const placeholders = keys.map(() => '?').join(', ');

      const [result]: any = await pool.query(
        `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
        vals
      );

      return res
        .status(201)
        .json({ message: 'Created successfully', id: data.id || result.insertId });
    } catch (error: any) {
      console.error('Create error:', error);
      return res.status(500).json({ message: 'Failed to create item', error: error.message });
    }
  }
);

// -------------------------------------------------------------
// 6. STATUS TOGGLE (Publish <-> Draft)
// -------------------------------------------------------------
router.patch(
  '/:id/toggle-status',
  (req: Request, res: Response, next: NextFunction) => {
    authenticate(req as AuthenticatedRequest, res, next);
  },
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const table = await getTableName();
      const [colRows]: any = await pool.query(`SHOW COLUMNS FROM ${table}`);
      const columns = colRows.map((c: any) => c.Field);
      const pkCol =
        colRows.find((c: any) => c.Key === 'PRI')?.Field ||
        (columns.includes('id') ? 'id' : columns[0]);

      if (columns.includes('status')) {
        await pool.query(
          `UPDATE ${table} SET status = IF(status = 'published', 'draft', 'published'), updated_at = NOW() WHERE ${pkCol} = ?`,
          [id]
        );
      }
      if (columns.includes('is_active')) {
        await pool.query(
          `UPDATE ${table} SET is_active = IF(is_active = 1, 0, 1), updated_at = NOW() WHERE ${pkCol} = ?`,
          [id]
        );
      } else if (columns.includes('active')) {
        await pool.query(
          `UPDATE ${table} SET active = IF(active = 1, 0, 1), updated_at = NOW() WHERE ${pkCol} = ?`,
          [id]
        );
      }

      return res.json({ message: 'Status toggled successfully' });
    } catch (error: any) {
      return res.status(500).json({ message: 'Failed to toggle status', error: error.message });
    }
  }
);

// -------------------------------------------------------------
// 7. DELETE
// -------------------------------------------------------------
router.delete(
  '/:id',
  (req: Request, res: Response, next: NextFunction) => {
    authenticate(req as AuthenticatedRequest, res, next);
  },
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const table = await getTableName();
      const [colRows]: any = await pool.query(`SHOW COLUMNS FROM ${table}`);
      const columns = colRows.map((c: any) => c.Field);
      const pkCol =
        colRows.find((c: any) => c.Key === 'PRI')?.Field ||
        (columns.includes('id') ? 'id' : columns[0]);

      await pool.query(`DELETE FROM ${table} WHERE ${pkCol} = ?`, [id]);
      return res.json({ message: 'Deleted successfully' });
    } catch (error: any) {
      return res.status(500).json({ message: 'Failed to delete item', error: error.message });
    }
  }
);

export default router;