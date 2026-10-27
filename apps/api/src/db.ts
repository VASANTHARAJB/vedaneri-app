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
  maxIdle: 2,
  idleTimeout: 30000,
});

// Run a query and retry once if the connection was reset by the server
const RETRYABLE = ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'EPIPE', 'ETIMEDOUT'];
const originalQuery = pool.query.bind(pool) as any;

(pool as any).query = async (...args: any[]) => {
  try {
    return await originalQuery(...args);
  } catch (err: any) {
    if (RETRYABLE.includes(err?.code)) {
      console.warn(`[DB] ${err.code}, retrying the query once`);
      return await originalQuery(...args);
    }
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