import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const IS_PROD = process.env.NODE_ENV === 'production';

// Secrets must come from the environment (.env locally, Render in production)
function secret(name: string, ...alts: string[]): string {
  for (const n of [name, ...alts]) {
    const v = process.env[n];
    if (v) return v;
  }
  if (IS_PROD) throw new Error(`Missing required environment variable: ${name}`);
  console.warn(`[config] ${name} is not set. Add it to your .env file.`);
  return '';
}

export const config = {
  // Render provides PORT; locally API_PORT / PORT_API still work
  port: Number(process.env.PORT || process.env.API_PORT || process.env.PORT_API) || 4000,
  jwtSecret: secret('JWT_SECRET', 'JWT_ACCESS_SECRET'),
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s: string) => s.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:3001'],
  db: {
    host: process.env.DB_HOST || '193.203.184.213',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'u846163676_omkara_veda',
    password: secret('DB_PASSWORD'),
    database: process.env.DB_NAME || 'u846163676_omkara',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  },
};