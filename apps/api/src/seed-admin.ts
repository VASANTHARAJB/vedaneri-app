import bcrypt from 'bcryptjs';
import { pool } from './db';

async function seedAdmin() {
  try {
    const email = 'admin@vedaneri.org';
    const password = 'Admin@123';
    const fullName = 'Ashram Super Admin';
    const role = 'superadmin';

    // 1. Password Hash Generate
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Existing users list check
    const [existing]: any = await pool.query('SELECT id, email, role, is_active FROM users');
    console.log('📋 Database-la currently irukra users:', existing);

    // 3. Upsert admin@vedaneri.org
    const [userCheck]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);

    if (userCheck.length > 0) {
      await pool.query(
        'UPDATE users SET password_hash = ?, is_active = 1, role = ? WHERE email = ?',
        [hashedPassword, role, email]
      );
      console.log(`✔ Updated credentials for existing user: ${email}`);
    } else {
      await pool.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, is_active)
         VALUES (UUID(), ?, ?, ?, ?, 1)`,
        [email, hashedPassword, fullName, role]
      );
      console.log(`✔ Created new superadmin: ${email}`);
    }

    console.log('\n=======================================');
    console.log('Login with:');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('=======================================\n');

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error seeding admin:', err.message);
    process.exit(1);
  }
}

seedAdmin();