import { pool } from './db';

// The extra panchangam columns (rasi, yogam, karanam, sunrise, sunset, rahu_kalam, yamagandam, gulikai, auto_festivals, details_json) are added with
// sql/panchangam-extra-columns.sql. Until that has been run, the API keeps working exactly as before and leaves them out.
// A "yes" is remembered for good; a "no" is checked again after a minute, so running the SQL needs no API restart.

export const EXTRA_COLUMNS = ['rasi', 'yogam', 'karanam', 'sunrise', 'sunset', 'rahu_kalam', 'yamagandam', 'gulikai', 'auto_festivals', 'details_json'] as const;

let known = false;
let checkedAt = 0;

export async function hasExtraColumns(): Promise<boolean> {
  if (known) return true;
  if (Date.now() - checkedAt < 60000) return false;
  checkedAt = Date.now();
  try {
    const [rows]: any = await pool.query(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'panchangam_calendar' AND COLUMN_NAME IN (${EXTRA_COLUMNS.map(() => '?').join(',')})`,
      [...EXTRA_COLUMNS]
    );
    known = Number(rows?.[0]?.n) === EXTRA_COLUMNS.length;
  } catch (e: any) {
    console.error('Panchangam: could not check the extra columns:', e?.sqlMessage || e?.message || e);
    known = false;
  }
  return known;
}