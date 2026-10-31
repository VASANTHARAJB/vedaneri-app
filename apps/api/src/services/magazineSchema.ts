import { pool } from '../db';

const TABLES = [
  `CREATE TABLE IF NOT EXISTS magazine_issues (
    id varchar(36) NOT NULL,
    title_en varchar(255) NOT NULL,
    title_ta varchar(255) DEFAULT NULL,
    issue_month tinyint NOT NULL,
    issue_year smallint NOT NULL,
    cover_url varchar(500) DEFAULT NULL,
    pdf_file varchar(255) DEFAULT NULL,
    status enum('draft','published') NOT NULL DEFAULT 'draft',
    created_at datetime DEFAULT current_timestamp(),
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS magazine_plans (
    id varchar(36) NOT NULL,
    name_en varchar(255) NOT NULL,
    name_ta varchar(255) DEFAULT NULL,
    description_en text DEFAULT NULL,
    description_ta text DEFAULT NULL,
    duration_months int NOT NULL DEFAULT 12,
    delivery enum('print','digital','both') NOT NULL DEFAULT 'print',
    price decimal(10,2) NOT NULL DEFAULT 0.00,
    pay_account enum('seva','donation') NOT NULL DEFAULT 'seva',
    status enum('draft','published') NOT NULL DEFAULT 'draft',
    sort_order int NOT NULL DEFAULT 0,
    created_at datetime DEFAULT current_timestamp(),
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS magazine_subscriptions (
    id int NOT NULL AUTO_INCREMENT,
    plan_id varchar(36) NOT NULL,
    devotee_id varchar(100) NOT NULL,
    plan_name varchar(255) NOT NULL,
    delivery enum('print','digital','both') NOT NULL,
    duration_months int NOT NULL,
    amount decimal(10,2) NOT NULL,
    pay_account enum('seva','donation') NOT NULL DEFAULT 'seva',
    first_name varchar(80) NOT NULL,
    last_name varchar(80) NOT NULL,
    email varchar(150) NOT NULL,
    phone varchar(24) DEFAULT NULL,
    address varchar(400) DEFAULT NULL,
    city varchar(100) DEFAULT NULL,
    state varchar(100) DEFAULT NULL,
    pincode varchar(10) DEFAULT NULL,
    start_date date DEFAULT NULL,
    end_date date DEFAULT NULL,
    status enum('PENDING','ACTIVE','EXPIRED','FAILED') NOT NULL DEFAULT 'PENDING',
    receipt_no varchar(40) DEFAULT NULL,
    razorpay_order_id varchar(64) DEFAULT NULL,
    razorpay_payment_id varchar(64) DEFAULT NULL,
    reminder_30 tinyint NOT NULL DEFAULT 0,
    reminder_7 tinyint NOT NULL DEFAULT 0,
    created_at datetime DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    KEY idx_msub_devotee (devotee_id),
    KEY idx_msub_status_end (status, end_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

// Works on both MySQL and MariaDB (no ADD COLUMN IF NOT EXISTS needed)
async function addColumn(table: string, column: string, definition: string) {
  const [r]: any = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  );
  if (!r.length) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function run(): Promise<boolean> {
  try {
    for (const q of TABLES) await pool.query(q);
    await addColumn('magazine_plans', 'features_en', 'text DEFAULT NULL');
    await addColumn('magazine_plans', 'features_ta', 'text DEFAULT NULL');
    await addColumn('magazine_plans', 'badge_en', 'varchar(40) DEFAULT NULL');
    await addColumn('magazine_plans', 'badge_ta', 'varchar(40) DEFAULT NULL');
    await addColumn('magazine_subscriptions', 'payment_mode', `varchar(10) NOT NULL DEFAULT 'online'`);
    console.log('[Magazine] Tables are ready.');
    return true;
  } catch (e: any) {
    console.error('[Magazine] Could not create or update the tables:', e?.sqlMessage || e?.message || e);
    return false;
  }
}

// Runs once; if it failed, the next request tries again
let ready: Promise<boolean> | null = null;
export function ensureMagazineTables(): Promise<boolean> {
  if (!ready) {
    ready = run().then((ok) => {
      if (!ok) ready = null;
      return ok;
    });
  }
  return ready;
}

void ensureMagazineTables();