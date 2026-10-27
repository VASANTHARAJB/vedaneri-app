import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const [rows]: any = await pool.query(
      'SELECT id, email, full_name, role, password_hash, is_active FROM users WHERE email = ? LIMIT 1',
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

    const token = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: '24h' });

    return res.json({
      token,
      user: tokenPayload,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.get('/me', (req: Request, res: Response, next) => {
  authenticate(req as AuthenticatedRequest, res, next);
}, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  return res.json({ user: authReq.user });
});

export default router;