import { pool } from '../db';

const CAMPS = `
CREATE TABLE IF NOT EXISTS camps (
  id varchar(36) NOT NULL,
  slug varchar(160) NOT NULL,
  title_en varchar(255) NOT NULL,
  title_ta varchar(255) DEFAULT NULL,
  description_en text DEFAULT NULL,
  description_ta text DEFAULT NULL,
  venue_en varchar(255) DEFAULT NULL,
  venue_ta varchar(255) DEFAULT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time varchar(8) DEFAULT NULL,
  end_time varchar(8) DEFAULT NULL,
  image_url varchar(500) DEFAULT NULL,
  fee_type enum('free','paid') NOT NULL DEFAULT 'free',
  fee_amount decimal(10,2) NOT NULL DEFAULT 0.00,
  seats int(11) NOT NULL DEFAULT 0,
  status enum('draft','published','closed') NOT NULL DEFAULT 'draft',
  created_at datetime DEFAULT current_timestamp(),
  updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_camps_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const REGS = (devoteeFk: boolean) => `
CREATE TABLE IF NOT EXISTS camp_registrations (
  id int(11) NOT NULL AUTO_INCREMENT,
  camp_id varchar(36) NOT NULL,
  devotee_id varchar(100) NOT NULL,
  name varchar(150) NOT NULL,
  phone varchar(24) DEFAULT NULL,
  email varchar(150) DEFAULT NULL,
  members int(11) NOT NULL DEFAULT 1,
  notes varchar(500) DEFAULT NULL,
  status enum('REGISTERED','CANCELLED') NOT NULL DEFAULT 'REGISTERED',
  created_at datetime DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_camp_devotee (camp_id, devotee_id),
  CONSTRAINT fk_campreg_camp FOREIGN KEY (camp_id) REFERENCES camps (id) ON DELETE CASCADE
  ${devoteeFk ? ', CONSTRAINT fk_campreg_devotee FOREIGN KEY (devotee_id) REFERENCES devotees (id) ON DELETE CASCADE' : ''}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

export async function ensureCampsTables(): Promise<void> {
  try {
    await pool.query(CAMPS);
    try {
      await pool.query(REGS(true));
    } catch (e: any) {
      console.warn('[Camps] Registrations table without the devotee link:', e?.message || e);
      await pool.query(REGS(false));
    }

    // Payment account for each camp
    await pool.query(`ALTER TABLE camps ADD COLUMN IF NOT EXISTS pay_account enum('seva','donation') NOT NULL DEFAULT 'seva'`);

    // Full registration details and payment fields
    await pool.query(`ALTER TABLE camp_registrations
      MODIFY COLUMN phone varchar(24) DEFAULT NULL,
      MODIFY COLUMN status enum('PENDING','REGISTERED','CANCELLED','FAILED') NOT NULL DEFAULT 'REGISTERED',
      ADD COLUMN IF NOT EXISTS first_name varchar(80) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS last_name varchar(80) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS adults int(11) NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS children int(11) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS city varchar(100) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS state varchar(100) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS amount decimal(10,2) NOT NULL DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS payment_status enum('NONE','PENDING','PAID','FAILED') NOT NULL DEFAULT 'NONE',
      ADD COLUMN IF NOT EXISTS razorpay_order_id varchar(64) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS razorpay_payment_id varchar(64) DEFAULT NULL`);

    console.log('[Camps] Tables are ready.');
  } catch (e: any) {
    console.error('[Camps] Could not create or update the tables:', e?.message || e);
  }
}

void ensureCampsTables();