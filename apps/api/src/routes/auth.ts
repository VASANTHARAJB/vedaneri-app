import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { pageCols, parsePages } from '../middleware/roleAccess';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const [rows]: any = await pool.query(
      `SELECT id, email, full_name, role, password_hash, is_active${await pageCols()} FROM users WHERE email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];

    if (user.is_active === 0 || user.is_active === false) {
      return res.status(403).json({ message: 'Account is deactivated. Contact administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    };

    // The login lasts 24 hours; after that the CMS signs out and asks for the password again
    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '24h' });

    return res.json({
      token,
      user: { ...tokenPayload, page_access: parsePages(user.page_access) },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Who am I right now. Read from the database so a changed role or a deactivated login shows up at once.
router.get('/me', (req: Request, res: Response, next) => {
  authenticate(req as AuthenticatedRequest, res, next);
}, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const id = String((authReq.user as any)?.id || '');
    if (!id) return res.status(401).json({ message: 'Please sign in again.' });
    const [rows]: any = await pool.query(`SELECT id, email, full_name, role, is_active${await pageCols()} FROM users WHERE id = ? LIMIT 1`, [id]);
    const u = rows?.[0];
    if (!u) return res.status(401).json({ message: 'Please sign in again.' });
    if (Number(u.is_active) === 0) return res.status(403).json({ message: 'Account is deactivated. Contact administrator.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role, page_access: parsePages(u.page_access) } });
  } catch (e: any) {
    console.error('Me error:', e?.message || e);
    return res.status(500).json({ message: 'Could not check your login.' });
  }
});

export default router;