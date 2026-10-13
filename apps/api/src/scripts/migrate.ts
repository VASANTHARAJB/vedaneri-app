import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { config } from '../config';

// Runs database/migrations/*.sql in name order, once each.
async function main() {
  const dir = path.resolve(__dirname, '../../../../database/migrations');
  const conn = await mysql.createConnection({ ...config.db, charset: 'utf8mb4', multipleStatements: true });
  await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(190) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [rows] = await conn.query('SELECT name FROM schema_migrations');
  const done = new Set((rows as { name: string }[]).map((r) => r.name));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) { console.log('skip   ', file); continue; }
    console.log('apply  ', file);
    await conn.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
  }
  await conn.end();
  console.log('migrations complete');
}
main().catch((e) => { console.error(e); process.exit(1); });
