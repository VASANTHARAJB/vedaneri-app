import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { pool } from '../db';
import { staffFrom, invalidateStaff, Staff, pageCols, parsePages, ALL_PAGE_SLUGS, SUPER } from '../middleware/roleAccess';

// Staff logins for the CMS.
// A super admin sees and manages every login.
// Any other login that has the "Users" page ticked (for example a general manager) manages only its own team: the logins it created itself.
// A team login can never be given more than the manager has, and never a super admin, general manager or developer role.
// Mount in index.ts:  app.use('/api/v1/users', usersRouter);
const router = Router();
router.use(async (req: Request, res: Response, next) => {
  try {
    const s = await staffFrom(req);
    if (!s) return res.status(401).json({ message: 'Please sign in again.' });
    if (!SUPER.includes(s.role) && !(s.pages || []).includes('users')) return res.status(403).json({ message: 'Your login does not have access to this page.' });
    (req as any).staff = s;
    return next();
  } catch (e: any) {
    console.error('Role check error:', e?.message || e);
    return res.status(503).json({ message: 'Could not check your access. Please try again.' });
  }
});
router.use(express.json({ limit: '20kb' }));
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

const STAFF_ROLES = ['superadmin', 'admin', 'gm', 'developer', 'website', 'payments', 'registration', 'sales', 'editor', 'priest'];
const NEW_ROLES = ['superadmin', 'admin', 'gm', 'developer', 'website', 'payments', 'registration', 'sales'];

// The roles a manager (not a super admin) may give to its team, and the most logins one manager may have
const TEAM_ROLES = ['admin', 'website', 'payments', 'registration', 'sales'];
const TEAM_LIMIT = 50;

const me = (req: Request) => (req as any).staff as Staff;
const isSuperReq = (req: Request) => SUPER.includes(me(req).role);
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordProblem(p: string): string {
  if (p.length < 8) return 'The password must be at least 8 characters.';
  if (p.length > 72) return 'The password must be 72 characters or fewer.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'The password needs at least one letter and one number.';
  return '';
}

// The users.role column may have been created as a fixed list (ENUM) that does not know "gm" and "developer".
// Once per start, widen it to plain text. Nothing is lost: every existing value is kept.
let rolesReady = false;
async function ensureRoles(): Promise<void> {
  if (rolesReady) return;
  try {
    const [r]: any = await pool.query(`SHOW COLUMNS FROM users LIKE 'role'`);
    const type = String(r?.[0]?.Type || r?.[0]?.type || '').toLowerCase();
    if (type.startsWith('enum')) {
      await pool.query(`ALTER TABLE users MODIFY role VARCHAR(30) NOT NULL`);
      console.log('[Users] users.role changed from a fixed list to VARCHAR(30) so gm and developer logins can be saved');
    }
    rolesReady = true;
  } catch (e: any) {
    console.error('[Users] could not widen users.role (run: ALTER TABLE users MODIFY role VARCHAR(30) NOT NULL;):', e?.sqlMessage || e?.message || e);
  }
}

// users.created_by holds the id of the login that made this login. Added once, as an empty column, so nothing existing changes.
let ownerReady = false;
async function ensureOwner(): Promise<boolean> {
  if (ownerReady) return true;
  try {
    const [r]: any = await pool.query(`SHOW COLUMNS FROM users LIKE 'created_by'`);
    if (!r?.length) {
      await pool.query(`ALTER TABLE users ADD COLUMN created_by VARCHAR(64) NULL`);
      console.log('[Users] users.created_by column added');
    }
    ownerReady = true;
  } catch (e: any) {
    console.error('[Users] could not add users.created_by (run: ALTER TABLE users ADD COLUMN created_by VARCHAR(64) NULL;):', e?.sqlMessage || e?.message || e);
  }
  return ownerReady;
}
const NEEDS_OWNER = 'The users table needs one more column. Ask the developer to run: ALTER TABLE users ADD COLUMN created_by VARCHAR(64) NULL;';

const COLS = 'id, email, phone, full_name, role, is_active, created_at, updated_at';
const cols = async () => COLS + (await ensureOwner() ? ', created_by' : '') + (await pageCols());
const shape = (r: any) => (r ? { ...r, page_access: parsePages(r.page_access) } : r);

// The ticked pages from the request. Only a super admin opens everything, so nothing is stored for a super admin.
// Every other role (including admin) opens only the ticked pages, so at least one page must be ticked.
// allowed = the pages the person making the change may give (null = any page, for a super admin)
function pagesFrom(v: unknown, role: string, allowed: string[] | null = null): { value: string | null; error?: string } {
  if (SUPER.includes(role)) return { value: null };
  if (!Array.isArray(v)) return { value: null, error: 'Tick the pages this login may open.' };
  const list = Array.from(new Set(v.filter((x): x is string => typeof x === 'string')));
  if (list.some((x) => !ALL_PAGE_SLUGS.includes(x))) return { value: null, error: 'One of the chosen pages is not known. Reload the page and try again.' };
  if (allowed && list.some((x) => !allowed.includes(x))) return { value: null, error: 'You can only give pages that you can open yourself.' };
  if (!list.length) return { value: null, error: 'Tick at least one page this login may open.' };
  return { value: JSON.stringify(ALL_PAGE_SLUGS.filter((x) => list.includes(x))) };
}
const NEEDS_SQL = 'The users table needs the one-time update in apps/api/sql/user-page-access.sql.';

// The pages a manager may give to its team: its own pages, except the Users page itself (a team cannot make teams)
const givable = (req: Request): string[] | null => (isSuperReq(req) ? null : (me(req).pages || []).filter((p) => p !== 'users'));

// One login the person may manage: a super admin any staff login, a manager only a login it created
async function findTarget(req: Request, id: string): Promise<any | null> {
  const [found]: any = await pool.query(`SELECT ${await cols()} FROM users WHERE id = ? LIMIT 1`, [id]);
  const t = found?.[0];
  if (!t || !STAFF_ROLES.includes(String(t.role))) return null;
  if (!isSuperReq(req)) {
    if (String(t.created_by || '') !== me(req).id) return null;
    if (!TEAM_ROLES.includes(String(t.role))) return null;
  }
  return t;
}

// Another active super admin must always remain
async function otherActiveSuperadmins(exceptId: string): Promise<number> {
  const [rows]: any = await pool.query(`SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin' AND is_active = 1 AND id <> ?`, [exceptId]);
  return Number(rows?.[0]?.n || 0);
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const list = await cols();
    let rows: any[];
    if (isSuperReq(req)) {
      [rows] = (await pool.query(`SELECT ${list} FROM users WHERE role IN (${STAFF_ROLES.map(() => '?').join(',')}) ORDER BY created_at ASC`, STAFF_ROLES)) as any;
    } else {
      if (!(await ensureOwner())) return res.json({ users: [], limit: TEAM_LIMIT });
      [rows] = (await pool.query(`SELECT ${list} FROM users WHERE created_by = ? AND role IN (${TEAM_ROLES.map(() => '?').join(',')}) ORDER BY created_at ASC`, [me(req).id, ...TEAM_ROLES])) as any;
    }
    // Who made each login, shown to a super admin
    const names = new Map<string, string>(rows.map((r: any) => [String(r.id), String(r.full_name || r.email || '')]));
    const out = rows.map((r: any) => ({ ...shape(r), created_by_name: r.created_by ? names.get(String(r.created_by)) || '' : '' }));
    return res.json({ users: out, limit: TEAM_LIMIT, scope: isSuperReq(req) ? 'all' : 'team' });
  } catch (e: any) {
    console.error('Users list error:', e?.message || e);
    return res.status(500).json({ message: 'Could not load the users.' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const full_name = text(req.body?.full_name);
    const email = text(req.body?.email).toLowerCase();
    const phone = text(req.body?.phone);
    const role = text(req.body?.role).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (full_name.length < 2 || full_name.length > 100) return res.status(400).json({ message: 'Enter the full name.', field: 'full_name' });
    if (!EMAIL.test(email) || email.length > 150) return res.status(400).json({ message: 'Enter a valid email address.', field: 'email' });
    if (phone && !/^[+0-9][0-9 ()-]{5,19}$/.test(phone)) return res.status(400).json({ message: 'Enter a valid phone number or leave it empty.', field: 'phone' });
    if (!NEW_ROLES.includes(role)) return res.status(400).json({ message: 'Choose a role.', field: 'role' });
    if (!isSuperReq(req) && !TEAM_ROLES.includes(role)) return res.status(403).json({ message: 'You cannot make a login with this role.', field: 'role' });
    const pw = passwordProblem(password);
    if (pw) return res.status(400).json({ message: pw, field: 'password' });
    const pa = pagesFrom(req.body?.page_access, role, givable(req));
    if (pa.error) return res.status(400).json({ message: pa.error, field: 'page_access' });
    if (pa.value && !(await pageCols())) return res.status(500).json({ message: NEEDS_SQL });
    if (!(await ensureOwner())) {
      if (!isSuperReq(req)) return res.status(500).json({ message: NEEDS_OWNER });
    }
    if (!isSuperReq(req)) {
      const [cnt]: any = await pool.query('SELECT COUNT(*) AS n FROM users WHERE created_by = ?', [me(req).id]);
      if (Number(cnt?.[0]?.n || 0) >= TEAM_LIMIT) return res.status(400).json({ message: `You can have at most ${TEAM_LIMIT} team logins. Remove one you no longer need.` });
    }
    await ensureRoles();

    const [dup]: any = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (dup?.length) return res.status(409).json({ message: 'A login with this email already exists.', field: 'email' });

    const id = randomUUID();
    const hash = await bcrypt.hash(password, 10);
    const fields = ['id', 'email', 'phone', 'password_hash', 'full_name', 'role', 'is_active'];
    const vals: any[] = [id, email, phone || null, hash, full_name, role, 1];
    if (ownerReady) { fields.push('created_by'); vals.push(me(req).id); }
    if (pa.value) { fields.push('page_access'); vals.push(pa.value); }
    await pool.query(`INSERT INTO users (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`, vals);
    console.log(`[Users] ${me(req).email} created ${email} (${role}${pa.value ? ', pages: ' + pa.value : ''})`);
    const [rows]: any = await pool.query(`SELECT ${await cols()} FROM users WHERE id = ?`, [id]);
    return res.status(201).json({ user: shape(rows[0]) });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A login with this email or phone already exists.' });
    if (e?.code === 'ER_BAD_NULL_ERROR' || e?.code === 'ER_WARN_DATA_OUT_OF_RANGE' || e?.code === 'WARN_DATA_TRUNCATED' || e?.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
      console.error('Users create error (run ALTER TABLE users MODIFY role VARCHAR(30) NOT NULL;):', e?.sqlMessage || e?.message);
      return res.status(500).json({ message: 'The users table does not accept this role yet. Run: ALTER TABLE users MODIFY role VARCHAR(30) NOT NULL;' });
    }
    console.error('Users create error:', e?.sqlMessage || e?.message || e);
    return res.status(500).json({ message: 'Could not create the login.' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const target = await findTarget(req, id);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    const self = me(req).id === id;
    const sets: string[] = [];
    const vals: any[] = [];

    if (req.body?.full_name !== undefined) {
      const v = text(req.body.full_name);
      if (v.length < 2 || v.length > 100) return res.status(400).json({ message: 'Enter the full name.', field: 'full_name' });
      sets.push('full_name = ?'); vals.push(v);
    }
    if (req.body?.phone !== undefined) {
      const v = text(req.body.phone);
      if (v && !/^[+0-9][0-9 ()-]{5,19}$/.test(v)) return res.status(400).json({ message: 'Enter a valid phone number or leave it empty.', field: 'phone' });
      sets.push('phone = ?'); vals.push(v || null);
    }

    const newRole = req.body?.role !== undefined ? text(req.body.role).toLowerCase() : String(target.role);
    const newActive = req.body?.is_active !== undefined ? (req.body.is_active ? 1 : 0) : Number(target.is_active);
    if (newRole !== String(target.role)) {
      if (!NEW_ROLES.includes(newRole)) return res.status(400).json({ message: 'Choose a valid role.', field: 'role' });
      if (!isSuperReq(req) && !TEAM_ROLES.includes(newRole)) return res.status(403).json({ message: 'You cannot give this role.', field: 'role' });
      if (self) return res.status(400).json({ message: 'You cannot change your own role.', field: 'role' });
      await ensureRoles();
      sets.push('role = ?'); vals.push(newRole);
    }
    if (newActive !== Number(target.is_active)) {
      if (self) return res.status(400).json({ message: 'You cannot deactivate your own login.' });
      sets.push('is_active = ?'); vals.push(newActive);
    }
    const losingSuper = String(target.role) === 'superadmin' && Number(target.is_active) === 1 && (newRole !== 'superadmin' || newActive === 0);
    if (losingSuper && (await otherActiveSuperadmins(id)) < 1) {
      return res.status(400).json({ message: 'At least one active super admin must remain.' });
    }

    if (req.body?.password !== undefined && req.body.password !== '') {
      const pw = typeof req.body.password === 'string' ? req.body.password : '';
      const bad = passwordProblem(pw);
      if (bad) return res.status(400).json({ message: bad, field: 'password' });
      sets.push('password_hash = ?'); vals.push(await bcrypt.hash(pw, 10));
    }

    // Pages: sent when changed. A super admin role clears them, because a super admin opens everything.
    // A login moved from super admin to another role must be given pages in the same save.
    const roleChanged = newRole !== String(target.role);
    if (req.body?.page_access !== undefined || (roleChanged && (SUPER.includes(newRole) || SUPER.includes(String(target.role))))) {
      const pa = pagesFrom(req.body?.page_access, newRole, givable(req));
      if (pa.error) return res.status(400).json({ message: pa.error, field: 'page_access' });
      if (!(await pageCols())) {
        if (pa.value) return res.status(500).json({ message: NEEDS_SQL });
      } else {
        sets.push('page_access = ?'); vals.push(pa.value);
      }
    }

    if (!sets.length) return res.status(400).json({ message: 'Nothing to change.' });
    await pool.query(`UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, [...vals, id]);
    invalidateStaff(id);
    console.log(`[Users] ${me(req).email} changed ${target.email}: ${sets.map((s) => s.split(' ')[0]).join(', ')}`);
    const [rows]: any = await pool.query(`SELECT ${await cols()} FROM users WHERE id = ?`, [id]);
    return res.json({ user: shape(rows[0]) });
  } catch (e: any) {
    if (e?.code === 'WARN_DATA_TRUNCATED' || e?.code === 'ER_BAD_NULL_ERROR' || e?.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
      console.error('Users update error (run ALTER TABLE users MODIFY role VARCHAR(30) NOT NULL;):', e?.sqlMessage || e?.message);
      return res.status(500).json({ message: 'The users table does not accept this role yet. Run: ALTER TABLE users MODIFY role VARCHAR(30) NOT NULL;' });
    }
    console.error('Users update error:', e?.sqlMessage || e?.message || e);
    return res.status(500).json({ message: 'Could not save the changes.' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (me(req).id === id) return res.status(400).json({ message: 'You cannot delete your own login.' });
    const target = await findTarget(req, id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (String(target.role) === 'superadmin' && Number(target.is_active) === 1 && (await otherActiveSuperadmins(id)) < 1) {
      return res.status(400).json({ message: 'At least one active super admin must remain.' });
    }
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    invalidateStaff(id);
    console.log(`[Users] ${me(req).email} deleted ${target.email}`);
    return res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ message: 'This login has records attached, so it cannot be deleted. Deactivate it instead.' });
    }
    console.error('Users delete error:', e?.sqlMessage || e?.message || e);
    return res.status(500).json({ message: 'Could not delete the login.' });
  }
});

export default router;