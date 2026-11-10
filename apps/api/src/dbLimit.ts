import { pool } from './db';

// The shared hosting database allows only a limited number of new connections per hour (the error says "max_connections_per_hour").
// A report page sends 15 to 20 queries at once, and each one could open a new connection. This lets only 3 run at the same time,
// so the pool reuses the same few connections instead of opening a burst of new ones.
const MAX_AT_ONCE = 3;
let busy = 0;
const waiting: Array<() => void> = [];

export const db = {
  async query(sql: string, args?: any[]): Promise<any> {
    if (busy >= MAX_AT_ONCE) await new Promise<void>((resolve) => waiting.push(resolve));
    busy++;
    try {
      return await pool.query(sql, args);
    } finally {
      busy--;
      const next = waiting.shift();
      if (next) next();
    }
  },
};