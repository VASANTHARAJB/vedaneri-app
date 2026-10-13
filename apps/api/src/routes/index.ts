import { Router } from 'express';
import { pool } from '../db';
import { notImplemented } from '../middleware/notImplemented';

export const router = Router();

router.get('/health', async (_req, res) => {
  let db = 'down';
  try { await pool.query('SELECT 1'); db = 'up'; } catch { /* reported below */ }
  res.status(db === 'up' ? 200 : 503).json({ ok: db === 'up', db, time: new Date().toISOString() });
});

// Build steps replace these placeholders one by one.
router.use('/auth', notImplemented('auth'));
router.use('/public', notImplemented('public content'));
router.use('/admin', notImplemented('admin'));
router.use('/webhooks', notImplemented('webhooks'));
