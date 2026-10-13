import path from 'path';
import dotenv from 'dotenv';

// .env sits at the repo root: apps/api/src -> ../../../.env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const need = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required environment variable: ${key}`);
  return v;
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    database: need('DB_NAME'),
    user: need('DB_USER'),
    password: need('DB_PASSWORD'),
  },
  jwt: {
    accessSecret: need('JWT_ACCESS_SECRET'),
    refreshSecret: need('JWT_REFRESH_SECRET'),
    accessMinutes: Number(process.env.ACCESS_TOKEN_MINUTES ?? 15),
    refreshDays: Number(process.env.REFRESH_TOKEN_DAYS ?? 14),
  },
};
