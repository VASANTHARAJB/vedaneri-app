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

// The CMS page names (the first part of the page address) that each API area belongs to.
// A login with its own ticked list of pages may call an API when it holds at least one of these pages.
const WEBSITE_SLUGS = [
  'content-stats', 'sevas', 'panchangam-calendar', 'panchangam', 'donations', 'camps', 'magazine', 'page-home',
  'about-swami', 'about-ashramam', 'about-adhishtanam', 'about-vidyapitham', 'page-accommodation', 'page-contact',
  'discover-audio', 'discover-video', 'discover-album',
];
const PAYMENT_SLUGS = ['payments-dashboard', 'seva-payments', 'payment-donations', 'payment-magazine', 'devotees', 'devotee-records'];
const REGISTER_SLUGS = ['seva-register', 'donation-register', 'magazine-register', 'camp-register', 'printing-labels'];
const POS_SLUGS = ['pos', 'pos-new-sale', 'pos-sales', 'pos-items', 'pos-stock', 'pos-purchases', 'pos-suppliers', 'pos-adjustments', 'pos-reports'];

// Every page a login can be given. The Users page is not in the list: only a super admin opens it.
export const ALL_PAGE_SLUGS = ['dashboard', ...WEBSITE_SLUGS, ...PAYMENT_SLUGS, ...REGISTER_SLUGS, ...POS_SLUGS, 'settings'];

const SEGMENT_SLUGS: Record<string, string[]> = {
  camps: ['camps'],
  sevas: ['sevas'],
  donations: ['donations'],
  'donation-funds': ['donations'],
  magazine: ['magazine'],
  home: ['page-home'],
  about: ['about-swami', 'about-ashramam', 'about-adhishtanam', 'about-vidyapitham'],
  accommodation: ['page-accommodation'],
  contact: ['page-contact'],
  discover: ['discover-audio', 'discover-video', 'discover-album'],
  panchangam: ['panchangam', 'panchangam-calendar'],
  offerings: ['sevas', 'donations'],
  'page-content': WEBSITE_SLUGS,
  media: WEBSITE_SLUGS,
  settings: ['settings'],
};

// Which pages open an admin API. null = administrators only.
export function slugsFor(rawPath: string): string[] | null {
  const p = rawPath.toLowerCase().replace(/\/+$/, '') || '/';
  if (/^\/camps\/admin\/(attendee\/|[^/]+\/attendees)/.test(p)) return null;
  if (/^\/payments(\/|$)/.test(p)) return PAYMENT_SLUGS;
  if (/^\/devotees-admin(\/|$)/.test(p)) return ['devotees', 'devotee-records'];
  if (/^\/registers(\/|$)/.test(p)) return REGISTER_SLUGS;
  if (/^\/pos(\/|$)/.test(p)) return POS_SLUGS;
  const m = /^\/([a-z0-9-]+)\/admin(\/|$)/.exec(p);
  if (m) return SEGMENT_SLUGS[m[1]] || null;
  return null;
}

// page_access is stored as text holding a JSON list; empty or unreadable means "use the role's pages"
export function parsePages(v: unknown): string[] | null {
  let a: unknown = v;
  if (typeof v === 'string') { try { a = JSON.parse(v); } catch { return null; } }
  if (!Array.isArray(a)) return null;
  const out = Array.from(new Set(a.filter((x): x is string => typeof x === 'string' && ALL_PAGE_SLUGS.includes(x))));
  return out.length ? out : null;
}

// ", page_access" once the column exists (see apps/api/sql/user-page-access.sql), so the app still starts and signs in before the update is run
let hasCol = false;
export async function pageCols(): Promise<string> {
  if (hasCol) return ', page_access';
  try {
    const [r]: any = await pool.query(`SHOW COLUMNS FROM users LIKE 'page_access'`);
    if (r?.length) { hasCol = true; return ', page_access'; }
  } catch { /* fall through */ }
  return '';
}

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

export interface Staff { id: string; email: string; name: string; role: string; pages: string[] | null }

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
  const [rows]: any = await pool.query(`SELECT id, email, full_name, role, is_active${await pageCols()} FROM users WHERE id = ? LIMIT 1`, [id]);
  const r = rows?.[0];
  const s: Staff | null = r && Number(r.is_active) !== 0
    ? { id: String(r.id), email: String(r.email), name: String(r.full_name || ''), role: String(r.role || '').toLowerCase(), pages: parsePages(r.page_access) }
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
    // A login with its own ticked pages is checked against those pages; every other login against its role.
    // Administrators always have everything.
    let ok: boolean;
    if (ADMINS.includes(s.role)) ok = true;
    else if (s.pages) { const need = slugsFor(req.path); ok = !!need && need.some((x) => s.pages!.includes(x)); }
    else ok = allowed.includes(s.role);
    if (!ok) {
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