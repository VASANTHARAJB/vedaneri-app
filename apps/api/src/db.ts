import mysql from 'mysql2/promise';
import { config } from './config';

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 20000,
  // Keep connections alive and drop idle ones before the server closes them
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  maxIdle: 10,
  idleTimeout: 600000,
});

// ---------- The hourly connection limit of the shared hosting database ----------
// The host allows each database user only so many NEW connections per hour (error 1226, "max_connections_per_hour").
// Once it is reached, every further attempt fails, and the sync jobs and page loads keep trying, which only makes things worse.
// So after that error the API stops asking the database for a short while and answers at once with the same error.
const LIMIT_PAUSE_MS = 2 * 60 * 1000;
let limitUntil = 0;
let limitError: any = null;

const isHourlyLimit = (e: any) =>
  e?.errno === 1226 || e?.code === 'ER_USER_LIMIT_REACHED' || /max_connections_per_hour/i.test(String(e?.message || ''));

function noteLimit(e: any) {
  if (!isHourlyLimit(e)) return;
  if (Date.now() >= limitUntil) {
    console.warn(`[DB] The hourly connection limit is reached. Pausing database calls for ${LIMIT_PAUSE_MS / 60000} minutes. ${e?.message || ''}`);
  }
  limitError = e;
  limitUntil = Date.now() + LIMIT_PAUSE_MS;
}

function pausedError() {
  // The same error again, without touching the database
  return limitError || Object.assign(new Error("User has exceeded the 'max_connections_per_hour' resource"), { code: 'ER_USER_LIMIT_REACHED', errno: 1226 });
}

// Run a query and retry once if the connection was reset by the server
const RETRYABLE = ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'EPIPE', 'ETIMEDOUT'];
const originalQuery = pool.query.bind(pool) as any;
const originalGetConnection = pool.getConnection.bind(pool) as any;

(pool as any).query = async (...args: any[]) => {
  if (Date.now() < limitUntil) throw pausedError();
  try {
    return await originalQuery(...args);
  } catch (err: any) {
    noteLimit(err);
    if (RETRYABLE.includes(err?.code)) {
      console.warn(`[DB] ${err.code}, retrying the query once`);
      return await originalQuery(...args);
    }
    throw err;
  }
};

// Code that takes a connection itself (for example for a transaction) follows the same pause
(pool as any).getConnection = async (...args: any[]) => {
  if (Date.now() < limitUntil) throw pausedError();
  try {
    return await originalGetConnection(...args);
  } catch (err: any) {
    noteLimit(err);
    throw err;
  }
};

export async function testDbConnection() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    console.log('✔ Connected to MariaDB database successfully');
  } catch (err: any) {
    console.error('❌ Database connection failed:', err.message);
  }
}