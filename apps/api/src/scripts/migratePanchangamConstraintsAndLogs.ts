import { pool } from '../db';

async function migratePanchangam() {
  console.log('⏳ Running Panchangam constraints and audit log migration...');

  try {
    // 1. Clean up duplicate records on (tamil_year, tamil_month, tamil_date) keeping the latest ID
    await pool.query(`
      DELETE p1 FROM panchangam_calendar p1
      INNER JOIN panchangam_calendar p2 
      WHERE p1.id < p2.id 
        AND p1.tamil_year = p2.tamil_year 
        AND p1.tamil_month = p2.tamil_month 
        AND p1.tamil_date = p2.tamil_date;
    `);
    console.log('✅ Duplicate Tamil day records purged.');

    // 2. Add 'created_by' and 'updated_by' columns if they don't exist
    await pool.query(`
      ALTER TABLE panchangam_calendar
      ADD COLUMN IF NOT EXISTS created_by VARCHAR(150) NULL AFTER special_event,
      ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150) NULL AFTER created_by;
    `);

    // 3. Ensure calendar_date has a UNIQUE constraint
    const [calDateIndexes]: any = await pool.query(`
      SHOW INDEX FROM panchangam_calendar WHERE Column_name = 'calendar_date' AND Non_unique = 0;
    `);
    if (calDateIndexes.length === 0) {
      await pool.query(`
        ALTER TABLE panchangam_calendar 
        ADD UNIQUE KEY uq_calendar_date (calendar_date);
      `);
      console.log('✅ Added UNIQUE constraint to calendar_date.');
    }

    // 4. Add composite UNIQUE constraint on (tamil_year, tamil_month, tamil_date)
    const [tamilDayIndexes]: any = await pool.query(`
      SHOW INDEX FROM panchangam_calendar WHERE Key_name = 'uq_tamil_day';
    `);
    if (tamilDayIndexes.length === 0) {
      await pool.query(`
        ALTER TABLE panchangam_calendar 
        ADD UNIQUE KEY uq_tamil_day (tamil_year, tamil_month, tamil_date);
      `);
      console.log('✅ Added composite UNIQUE constraint uq_tamil_day on (tamil_year, tamil_month, tamil_date).');
    }

    // 5. Create Audit Logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS panchangam_audit_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        calendar_date DATE NOT NULL,
        tamil_year VARCHAR(150) NOT NULL,
        tamil_month VARCHAR(100) NOT NULL,
        tamil_date INT NOT NULL,
        action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
        changed_by VARCHAR(150) NOT NULL,
        payload_snapshot JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_date (calendar_date),
        INDEX idx_audit_tamil (tamil_year, tamil_month, tamil_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table panchangam_audit_logs created and ready.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migratePanchangam();