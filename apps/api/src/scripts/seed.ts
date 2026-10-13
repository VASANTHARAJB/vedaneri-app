import argon2 from 'argon2';
import { config } from '../config';
import { pool } from '../db';

// Creates the first super_admin from SEED_ADMIN_* in .env. Safe to re-run.
async function main() {
  void config;
  const email = process.env.SEED_ADMIN_EMAIL;
  const name = process.env.SEED_ADMIN_NAME ?? 'Site Admin';
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env');
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  await pool.query(
    `INSERT INTO admin_users (email, name, password_hash, role) VALUES (?, ?, ?, 'super_admin')
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [email, name, hash],
  );
  console.log(`admin ready: ${email}`);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
