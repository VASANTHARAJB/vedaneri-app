import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: Number(process.env.API_PORT || process.env.PORT_API) || 4000,
  jwtSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'vedaneri_jwt_secret_2026',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s: string) => s.trim())
    : ['http://localhost:3000', 'http://localhost:3001'],
  db: {
    host: process.env.DB_HOST || '193.203.184.213',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'u846163676_omkara_veda',
    password: process.env.DB_PASSWORD || 'Omkara@2026',
    database: process.env.DB_NAME || 'u846163676_omkara',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  },
};