import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { config } from '../config';

// Staff roles. superadmin and admin can open every page; the other four see only their own group of pages.
export const ADMINS = ['superadmin', 'admin'];
const WEBSITE = [...ADMINS, 'website', 'editor', 'priest'];
const PAYMENTS = [...ADMINS, 'payments'];
const REGISTERS = [...ADMINS, 'registration'];
const SALES = [...ADMINS, 'sales'];

// First path segment of a website-content API. Its admin calls are /<segment>/admin/...
const WEBSITE_SEGMENTS = new Set([
  'camps', 'sevas', 'donations', 'donation-funds', 'magazine', 'home', 'about', 'accommodation', 'contact',
  'discover', 'offerings', 'panchangam', 'page-content', 'media',
]);

// Who may call an admin API. Returns null for paths this guard does not cover (public and devotee APIs).
export function rolesFor(rawPath: string): string[] | null {
  const p = rawPath.toLowerCase().replace(/\/+$/, '') || '/';
  if (/^\/users(\/|$)/.test(p)) return null; // the users router checks superadmin itself
  // Identity documents of camp attendees: admins only
  if (/^\/camps\/admin\/(attendee\/|[^/]+\/attendees)/.test(p)) return ADMINS;
  if (/^\/payments(\/|$)/.test(p)) return PAYMENTS;
  if (/^\/devotees-admin(\/|$)/.test(p)) return PAYMENTS;
  if (/^\/registers(\/|$)/.test(p)) return REGISTERS;
  if (/^\/pos(\/|$)/.test(p)) return SALES;
  const m = /^\/([a-z0-9-]+)\/admin(\/|$)/.exec(p);
  if (m) return WEBSITE_SEGMENTS.has(m[1]) ? WEBSITE : ADMINS;
  return null;
}

export interface Staff { id: string; email: string; name: string; role: string }

// The role is read from the database (not only from the token) so a changed role or a deactivated login takes effect at once.
const cache = new Map<string, { s: Staff | null; at: number }>();
const TTL = 30_000;
export const invalidateStaff = (id?: string) => { if (id) cache.delete(id); else cache.clear(); };

export async function staffFrom(req: Request): Promise<Staff | null> {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  let id = '';
  try {
    const d: any = jwt.verify(h.slice(7), config.jwtSecret);
    id = String(d?.id || '');
  } catch {
    return null;
  }
  if (!id) return null;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.s;
  const [rows]: any = await pool.query('SELECT id, email, full_name, role, is_active FROM users WHERE id = ? LIMIT 1', [id]);
  const r = rows?.[0];
  const s: Staff | null = r && Number(r.is_active) !== 0
    ? { id: String(r.id), email: String(r.email), name: String(r.full_name || ''), role: String(r.role || '').toLowerCase() }
    : null;
  cache.set(id, { s, at: Date.now() });
  return s;
}

// Mount once in index.ts, before the routers:  app.use('/api/v1', roleAccess);
export async function roleAccess(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') return next();
  const allowed = rolesFor(req.path);
  if (!allowed) return next();
  try {
    const s = await staffFrom(req);
    if (!s) return res.status(401).json({ message: 'Please sign in again.' });
    if (!allowed.includes(s.role)) {
      console.warn(`[Access] ${s.email} (${s.role}) was refused ${req.method} ${req.path}`);
      return res.status(403).json({ message: 'Your login does not have access to this page.' });
    }
    (req as any).staff = s;
    return next();
  } catch (e: any) {
    console.error('Role check error:', e?.message || e);
    return res.status(503).json({ message: 'Could not check your access. Please try again.' });
  }
}

export function requireStaff(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const s = await staffFrom(req);
      if (!s) return res.status(401).json({ message: 'Please sign in again.' });
      if (!roles.includes(s.role)) return res.status(403).json({ message: 'Only a super admin can do this.' });
      (req as any).staff = s;
      return next();
    } catch (e: any) {
      console.error('Role check error:', e?.message || e);
      return res.status(503).json({ message: 'Could not check your access. Please try again.' });
    }
  };
}