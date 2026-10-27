import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db';
import { config } from '../config';

const router = Router();
const JWT_SECRET = config.jwtSecret || 'vedaneri-ashram-secret-key';

// Upload configuration for avatars
const uploadDir = path.resolve(__dirname, '../../uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e4)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
});

// Middleware to extract devotee from Bearer Token
function authDevotee(req: any, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.devoteeId = decoded.id;
    next();
  } catch (_) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
}

// --------------------------------------------------------------------------
// 1. PUBLIC DEVOTEE AUTH (Mobile Quick Login / Auto Register for Seva Booking)
// --------------------------------------------------------------------------
router.post('/auth', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone || String(phone).replace(/\D/g, '').length < 10) {
      return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);

    // Check if devotee already exists
    const [rows]: any = await pool.query(
      `SELECT id, first_name, last_name, email, phone, aadhaar_number, pan_number, 
              avatar_url, comm_address, city, state, residency 
       FROM devotees WHERE phone = ? LIMIT 1`,
      [cleanPhone]
    );

    let devotee = rows && rows.length > 0 ? rows[0] : null;
    let isNew = false;

    // Auto-create devotee if new
    if (!devotee) {
      const devoteeId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO devotees (id, phone, first_name, created_at, updated_at) 
         VALUES (?, ?, 'Devotee', NOW(), NOW())`,
        [devoteeId, cleanPhone]
      );

      const [newRows]: any = await pool.query(
        `SELECT id, first_name, last_name, email, phone, aadhaar_number, pan_number, 
                avatar_url, comm_address, city, state, residency 
         FROM devotees WHERE id = ? LIMIT 1`,
        [devoteeId]
      );
      devotee = newRows[0];
      isNew = true;
    }

    // Fetch existing family members if any
    const [family]: any = await pool.query(
      `SELECT id, title, name, gothram, nakshathiram, rasi, relation 
       FROM devotee_family_members WHERE devotee_id = ?`,
      [devotee.id]
    );

    // Sign official JWT accepted by authDevotee
    const token = jwt.sign(
      { id: devotee.id, phone: devotee.phone },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const displayName = [devotee.first_name, devotee.last_name].filter(Boolean).join(' ') || 'Devotee';

    return res.json({
      success: true,
      message: isNew ? 'Devotee registered successfully' : 'Devotee logged in successfully',
      isNew,
      token,
      devotee: {
        id: devotee.id,
        phone: devotee.phone,
        first_name: devotee.first_name || '',
        last_name: devotee.last_name || '',
        display_name: displayName,
        email: devotee.email || '',
        aadhaar_number: devotee.aadhaar_number || '',
        pan_number: devotee.pan_number || '',
        comm_address: devotee.comm_address || '',
        city: devotee.city || '',
        state: devotee.state || '',
        avatar_url: devotee.avatar_url || '',
      },
      familyMembers: family || [],
    });
  } catch (error: any) {
    console.error('Devotee auth error:', error);
    return res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
});

// --------------------------------------------------------------------------
// 2. GET DEVOTEE PROFILE & FAMILY MEMBERS
// --------------------------------------------------------------------------
router.get('/profile', authDevotee, async (req: any, res: Response) => {
  try {
    const [devotees]: any = await pool.query(
      `SELECT id, first_name, last_name, email, phone, aadhaar_number, pan_number, 
              avatar_url, comm_address, city, state, residency 
       FROM devotees WHERE id = ? LIMIT 1`,
      [req.devoteeId]
    );

    if (devotees.length === 0) {
      return res.status(404).json({ message: 'Devotee not found' });
    }

    const [family]: any = await pool.query(
      `SELECT id, title, name, gothram, nakshathiram, rasi, relation 
       FROM devotee_family_members WHERE devotee_id = ?`,
      [req.devoteeId]
    );

    return res.json({
      profile: devotees[0],
      familyMembers: family || [],
    });
  } catch (error: any) {
    console.error('Fetch profile error:', error);
    return res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
});

// --------------------------------------------------------------------------
// 3. SAVE BOOKING PROFILE (With Multer & Family Sync)
// --------------------------------------------------------------------------
router.post(
  '/save-booking-profile',
  authDevotee,
  upload.single('photo'),
  async (req: any, res: Response) => {
    try {
      const {
        first_name,
        last_name,
        phone,
        aadhaar_number,
        pan_number,
        comm_address,
        city,
        state,
        family_members,
      } = req.body;

      // Convert empty strings to null to avoid UNIQUE key collisions in MariaDB
      const cleanAadhaar =
        aadhaar_number && aadhaar_number.trim().length > 0
          ? aadhaar_number.replace(/\s+/g, '')
          : null;

      const cleanPan =
        pan_number && pan_number.trim().length > 0
          ? pan_number.trim().toUpperCase()
          : null;

      const avatarUrl = req.file ? `/uploads/avatars/${req.file.filename}` : undefined;

      // Update devotees table
      if (avatarUrl) {
        await pool.query(
          `UPDATE devotees SET 
            first_name = ?, last_name = ?, phone = ?, aadhaar_number = ?, pan_number = ?, 
            comm_address = ?, city = ?, state = ?, avatar_url = ?
           WHERE id = ?`,
          [
            first_name?.trim() || '',
            last_name?.trim() || '',
            phone?.trim() || '',
            cleanAadhaar,
            cleanPan,
            comm_address || null,
            city || '',
            state || '',
            avatarUrl,
            req.devoteeId,
          ]
        );
      } else {
        await pool.query(
          `UPDATE devotees SET 
            first_name = ?, last_name = ?, phone = ?, aadhaar_number = ?, pan_number = ?, 
            comm_address = ?, city = ?, state = ?
           WHERE id = ?`,
          [
            first_name?.trim() || '',
            last_name?.trim() || '',
            phone?.trim() || '',
            cleanAadhaar,
            cleanPan,
            comm_address || null,
            city || '',
            state || '',
            req.devoteeId,
          ]
        );
      }

      // Parse and sync family_members
      if (family_members) {
        let membersList = [];
        try {
          membersList =
            typeof family_members === 'string'
              ? JSON.parse(family_members)
              : family_members;
        } catch (_) {
          membersList = [];
        }

        if (Array.isArray(membersList)) {
          // Replace previous family records
          await pool.query('DELETE FROM devotee_family_members WHERE devotee_id = ?', [req.devoteeId]);

          for (const m of membersList) {
            if (m.name && m.name.trim()) {
              await pool.query(
                `INSERT INTO devotee_family_members 
                  (devotee_id, title, name, gothram, nakshathiram, rasi, relation)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  req.devoteeId,
                  m.title || 'Sri',
                  m.name.trim(),
                  m.gothram || '',
                  m.nakshathiram || '',
                  m.rasi || '',
                  m.relation || 'Family',
                ]
              );
            }
          }
        }
      }

      return res.json({
        message: 'Profile updated successfully',
        avatar_url: avatarUrl,
      });
    } catch (error: any) {
      console.error('Save profile error:', error);
      return res.status(500).json({ message: error.message || 'Failed to save profile' });
    }
  }
);

// --------------------------------------------------------------------------
// 4. CHANGE PASSWORD
// --------------------------------------------------------------------------
router.post('/change-password', authDevotee, async (req: any, res: Response) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    const [rows]: any = await pool.query(
      'SELECT password_hash FROM devotees WHERE id = ? LIMIT 1',
      [req.devoteeId]
    );

    if (rows.length === 0 || !rows[0].password_hash) {
      return res.status(400).json({ message: 'User not found or uses Google sign in' });
    }

    const bcrypt = await import('bcryptjs');
    const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(new_password, salt);

    await pool.query('UPDATE devotees SET password_hash = ? WHERE id = ?', [newHash, req.devoteeId]);

    return res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to update password', error: error.message });
  }
});

// --------------------------------------------------------------------------
// 5. DELETE DEVOTEE ACCOUNT
// --------------------------------------------------------------------------
router.delete('/account', authDevotee, async (req: any, res: Response) => {
  try {
    await pool.query('DELETE FROM devotee_family_members WHERE devotee_id = ?', [req.devoteeId]);
    await pool.query('DELETE FROM devotees WHERE id = ?', [req.devoteeId]);
    return res.json({ message: 'Account permanently deleted' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to delete account', error: error.message });
  }
});

export default router;