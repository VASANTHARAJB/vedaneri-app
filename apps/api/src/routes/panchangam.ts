import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

// 1. GET ALL TAMIL YEARS
router.get('/years', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, year_name as name, english_span as englishSpan 
       FROM panchangam_years 
       ORDER BY created_at ASC`
    );
    return res.json({ success: true, years: rows || [] });
  } catch (error: any) {
    console.error('❌ Fetch Years Error:', error);
    return res.status(500).json({ message: 'Failed to fetch years' });
  }
});

// 2. ADD TAMIL YEAR
router.post('/years', async (req: Request, res: Response) => {
  try {
    const { id, name, englishSpan } = req.body;
    if (!name || !englishSpan) {
      return res.status(400).json({ message: 'Year name and English span are required' });
    }

    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
    const yearId = id || (sanitized || `yr_${Date.now()}`);

    await pool.query(
      `INSERT INTO panchangam_years (id, year_name, english_span) 
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE 
        year_name = VALUES(year_name),
        english_span = VALUES(english_span)`,
      [yearId, name.trim(), englishSpan.trim()]
    );

    return res.json({ success: true, message: 'Year saved to database' });
  } catch (error: any) {
    console.error('❌ Add Year Error:', error);
    return res.status(500).json({ message: 'Failed to save year to database' });
  }
});

// 3. GET MONTH ENTRIES (Strict Exact Match)
router.get('/month', async (req: Request, res: Response) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ message: 'year and month query params required' });
    }

    const [rows]: any = await pool.query(
      `SELECT 
        id,
        DATE_FORMAT(calendar_date, '%Y-%m-%d') as calendar_date,
        tamil_year,
        tamil_month,
        tamil_date,
        thithi,
        nakshatram,
        special_event,
        created_by,
        updated_by,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
       FROM panchangam_calendar 
       WHERE tamil_year = ? AND tamil_month = ?
       ORDER BY tamil_date ASC`,
      [String(year).trim(), String(month).trim()]
    );

    return res.json({ success: true, entries: rows || [] });
  } catch (error: any) {
    console.error('❌ Fetch Month Error:', error);
    return res.status(500).json({ message: error?.message || 'Failed to fetch panchangam data' });
  }
});

// 4. UPSERT SINGLE DATE (With 409 Conflict Guard + Audit Logs)
router.post('/upsert', async (req: Request, res: Response) => {
  try {
    const {
      calendar_date,
      tamil_year,
      tamil_month,
      tamil_date,
      thithi,
      nakshatram,
      special_event,
      user_name,
    } = req.body;

    if (!calendar_date || !tamil_year || !tamil_month || !tamil_date) {
      return res.status(400).json({ message: 'Missing required calendar fields' });
    }

    const tDateNum = Number(tamil_date);
    const author = user_name || 'Admin';

    // Conflict Guard: Check if this calendar_date belongs to a different Tamil day
    const [existingDateRows]: any = await pool.query(
      `SELECT id, tamil_year, tamil_month, tamil_date 
       FROM panchangam_calendar 
       WHERE calendar_date = ? LIMIT 1`,
      [calendar_date]
    );

    if (existingDateRows.length > 0) {
      const match = existingDateRows[0];
      const isDifferentDay =
        match.tamil_year !== tamil_year ||
        match.tamil_month !== tamil_month ||
        Number(match.tamil_date) !== tDateNum;

      if (isDifferentDay) {
        return res.status(409).json({
          message: `Conflict: English date ${calendar_date} is already assigned to ${match.tamil_year} - ${match.tamil_month} (Date ${match.tamil_date}). Delete or change that date first.`,
        });
      }
    }

    // Determine if INSERT or UPDATE for audit log
    const [existingTamilDayRows]: any = await pool.query(
      `SELECT id FROM panchangam_calendar 
       WHERE tamil_year = ? AND tamil_month = ? AND tamil_date = ? LIMIT 1`,
      [tamil_year, tamil_month, tDateNum]
    );
    const action = existingTamilDayRows.length > 0 ? 'UPDATE' : 'INSERT';

    // Perform Upsert on both unique keys
    await pool.query(
      `INSERT INTO panchangam_calendar 
        (calendar_date, tamil_year, tamil_month, tamil_date, thithi, nakshatram, special_event, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        calendar_date = VALUES(calendar_date),
        thithi = VALUES(thithi),
        nakshatram = VALUES(nakshatram),
        special_event = VALUES(special_event),
        updated_by = VALUES(updated_by)`,
      [
        calendar_date,
        tamil_year,
        tamil_month,
        tDateNum,
        thithi || '',
        nakshatram || '',
        special_event || null,
        author,
        author,
      ]
    );

    // Record Audit Log
    await pool.query(
      `INSERT INTO panchangam_audit_logs 
        (calendar_date, tamil_year, tamil_month, tamil_date, action, changed_by, payload_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        calendar_date,
        tamil_year,
        tamil_month,
        tDateNum,
        action,
        author,
        JSON.stringify({ thithi, nakshatram, special_event }),
      ]
    );

    return res.json({ success: true, message: 'Panchangam entry saved successfully' });
  } catch (error: any) {
    console.error('❌ Upsert Error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Duplicate entry detected for this date or Tamil day.' });
    }
    return res.status(500).json({ message: error?.message || 'Failed to save panchangam date' });
  }
});

// 5. DELETE SINGLE ENTRY (With Audit Log)
router.delete('/entry', async (req: Request, res: Response) => {
  try {
    const { calendar_date, tamil_year, tamil_month, tamil_date, user_name } = req.body;
    const author = user_name || 'Admin';

    if (!tamil_year || !tamil_month || !tamil_date) {
      return res.status(400).json({ message: 'Tamil day coordinates required to delete' });
    }

    const tDateNum = Number(tamil_date);

    // Fetch existing record before deletion for audit trail
    const [existing]: any = await pool.query(
      `SELECT * FROM panchangam_calendar 
       WHERE tamil_year = ? AND tamil_month = ? AND tamil_date = ? LIMIT 1`,
      [tamil_year, tamil_month, tDateNum]
    );

    if (existing.length > 0) {
      await pool.query(
        `DELETE FROM panchangam_calendar 
         WHERE tamil_year = ? AND tamil_month = ? AND tamil_date = ?`,
        [tamil_year, tamil_month, tDateNum]
      );

      // Record Audit Log
      await pool.query(
        `INSERT INTO panchangam_audit_logs 
          (calendar_date, tamil_year, tamil_month, tamil_date, action, changed_by, payload_snapshot)
         VALUES (?, ?, ?, ?, 'DELETE', ?, ?)`,
        [
          existing[0].calendar_date,
          tamil_year,
          tamil_month,
          tDateNum,
          author,
          JSON.stringify(existing[0]),
        ]
      );
    }

    return res.json({ success: true, message: 'Panchangam entry deleted' });
  } catch (error: any) {
    console.error('❌ Delete Error:', error);
    return res.status(500).json({ message: error?.message || 'Failed to clear entry' });
  }
});

export default router;