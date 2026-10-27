import { pool } from '../db';

async function initPanchangamTables() {
  console.log('⏳ Creating Panchangam Tables in MariaDB...');

  try {
    // 1. TAMIL YEARS TABLE (Pudhu varushangalai save seiya)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS panchangam_years (
        id VARCHAR(100) PRIMARY KEY,
        year_name VARCHAR(150) NOT NULL UNIQUE,
        english_span VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table 1: panchangam_years ready.');

    // 2. DAILY PANCHANGAM CALENDAR TABLE (Dhinam dhinam ulla thedhigalukku)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS panchangam_calendar (
        id INT AUTO_INCREMENT PRIMARY KEY,
        calendar_date DATE NOT NULL UNIQUE,
        tamil_year VARCHAR(150) NOT NULL,
        tamil_month VARCHAR(100) NOT NULL,
        tamil_date INT NOT NULL,
        thithi VARCHAR(150) NOT NULL,
        nakshatram VARCHAR(150) NOT NULL,
        special_event VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cal_date (calendar_date),
        INDEX idx_year_month (tamil_year, tamil_month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table 2: panchangam_calendar ready.');

    // 3. SEED DEFAULT YEARS (Arambakkata 4 varushangal auto-insert aagum)
    const defaultYears = [
      ['viswavasu', 'Viswavasu (விஸ்வாவசு)', '2025 - 2026'],
      ['parabhava', 'Parabhava (பராபவ)', '2026 - 2027'],
      ['plavanga', 'Plavanga (ப்ளவங்க)', '2027 - 2028'],
      ['keelaka', 'Keelaka (கீலக)', '2028 - 2029'],
    ];

    for (const [id, year_name, english_span] of defaultYears) {
      await pool.query(
        `INSERT INTO panchangam_years (id, year_name, english_span) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE english_span = VALUES(english_span)`,
        [id, year_name, english_span]
      );
    }
    console.log('✅ Default Tamil Years seeded into database.');

  } catch (error) {
    console.error('❌ Error creating tables:', error);
  } finally {
    process.exit(0);
  }
}

initPanchangamTables();