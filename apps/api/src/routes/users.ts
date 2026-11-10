import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { pool } from '../db';
import { requireStaff, invalidateStaff, Staff } from '../middleware/roleAccess';

// Staff logins for the CMS. Super admin only.
// Mount in index.ts:  app.use('/api/v1/users', usersRouter);
const router = Router();
router.use(requireStaff('superadmin'));
router.use(express.json({ limit: '20kb' }));
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

const STAFF_ROLES = ['superadmin', 'admin', 'website', 'payments', 'registration', 'sales', 'editor', 'priest'];
const NEW_ROLES = ['superadmin', 'admin', 'website', 'payments', 'registration', 'sales'];

const me = (req: Request) => (req as any).staff as Staff;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordProblem(p: string): string {
  if (p.length < 8) return 'The password must be at least 8 characters.';
  if (p.length > 72) return 'The password must be 72 characters or fewer.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'The password needs at least one letter and one number.';
  return '';
}

const COLS = 'id, email, phone, full_name, role, is_active, created_at, updated_at';

// Another active super admin must always remain
async function otherActiveSuperadmins(exceptId: string): Promise<number> {
  const [rows]: any = await pool.query(`SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin' AND is_active = 1 AND id <> ?`, [exceptId]);
  return Number(rows?.[0]?.n || 0);
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT ${COLS} FROM users WHERE role IN (${STAFF_ROLES.map(() => '?').join(',')}) ORDER BY created_at ASC`,
      STAFF_ROLES
    );
    return res.json({ users: rows });
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
    const pw = passwordProblem(password);
    if (pw) return res.status(400).json({ message: pw, field: 'password' });

    const [dup]: any = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (dup?.length) return res.status(409).json({ message: 'A login with this email already exists.', field: 'email' });

    const id = randomUUID();
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (id, email, phone, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [id, email, phone || null, hash, full_name, role]
    );
    console.log(`[Users] ${me(req).email} created ${email} (${role})`);
    const [rows]: any = await pool.query(`SELECT ${COLS} FROM users WHERE id = ?`, [id]);
    return res.status(201).json({ user: rows[0] });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A login with this email or phone already exists.' });
    if (e?.code === 'ER_BAD_NULL_ERROR' || e?.code === 'ER_WARN_DATA_OUT_OF_RANGE' || e?.code === 'WARN_DATA_TRUNCATED' || e?.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
      console.error('Users create error (run apps/api/sql/staff-roles.sql):', e?.sqlMessage || e?.message);
      return res.status(500).json({ message: 'The users table needs the one-time update in apps/api/sql/staff-roles.sql.' });
    }
    console.error('Users create error:', e?.sqlMessage || e?.message || e);
    return res.status(500).json({ message: 'Could not create the login.' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const [found]: any = await pool.query(`SELECT ${COLS} FROM users WHERE id = ? LIMIT 1`, [id]);
    const target = found?.[0];
    if (!target || !STAFF_ROLES.includes(String(target.role))) return res.status(404).json({ message: 'User not found.' });

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
      if (self) return res.status(400).json({ message: 'You cannot change your own role.', field: 'role' });
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

    if (!sets.length) return res.status(400).json({ message: 'Nothing to change.' });
    await pool.query(`UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, [...vals, id]);
    invalidateStaff(id);
    console.log(`[Users] ${me(req).email} changed ${target.email}: ${sets.map((s) => s.split(' ')[0]).join(', ')}`);
    const [rows]: any = await pool.query(`SELECT ${COLS} FROM users WHERE id = ?`, [id]);
    return res.json({ user: rows[0] });
  } catch (e: any) {
    if (e?.code === 'WARN_DATA_TRUNCATED' || e?.code === 'ER_BAD_NULL_ERROR' || e?.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
      console.error('Users update error (run apps/api/sql/staff-roles.sql):', e?.sqlMessage || e?.message);
      return res.status(500).json({ message: 'The users table needs the one-time update in apps/api/sql/staff-roles.sql.' });
    }
    console.error('Users update error:', e?.sqlMessage || e?.message || e);
    return res.status(500).json({ message: 'Could not save the changes.' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (me(req).id === id) return res.status(400).json({ message: 'You cannot delete your own login.' });
    const [found]: any = await pool.query('SELECT id, email, role, is_active FROM users WHERE id = ? LIMIT 1', [id]);
    const target = found?.[0];
    if (!target || !STAFF_ROLES.includes(String(target.role))) return res.status(404).json({ message: 'User not found.' });
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