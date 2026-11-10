import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { sendContactAck, sendContactNotice } from '../services/contactEmail';

// The website contact form: saves each message, emails a copy to the sender, and lets the CMS read the messages.
const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const dbg = (e: any) => (IS_PROD ? undefined : e?.sqlMessage || e?.message || String(e));
const fail = (res: Response, e: any, message: string) => {
  console.error(`Contact: ${message}`, e?.sqlMessage || e?.message || e);
  return res.status(500).json({ message, detail: dbg(e) });
};
const pid = (v: any) => String(Array.isArray(v) ? v[0] : v);
const adminGuard = (req: Request, res: Response, next: NextFunction) => authenticate(req as AuthenticatedRequest, res, next);
const SECRET = `contact-form|${config.jwtSecret || process.env.JWT_SECRET || 'vedaneri-ashram-secret-key'}`;

let ready: Promise<boolean> | null = null;
function ensureTable(): Promise<boolean> {
  if (!ready) {
    ready = pool.query(
      `CREATE TABLE IF NOT EXISTS contact_page (
        id tinyint NOT NULL,
        content longtext DEFAULT NULL,
        updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ).then(() => pool.query(
      `CREATE TABLE IF NOT EXISTS contact_enquiries (
        id int(11) NOT NULL AUTO_INCREMENT,
        name varchar(100) NOT NULL,
        phone varchar(20) DEFAULT NULL,
        email varchar(150) DEFAULT NULL,
        topic varchar(100) DEFAULT NULL,
        message text NOT NULL,
        locale varchar(5) NOT NULL DEFAULT 'en',
        ip varchar(45) DEFAULT NULL,
        consent tinyint(1) NOT NULL DEFAULT 0,
        ack_sent tinyint(1) NOT NULL DEFAULT 0,
        status enum('new','done') NOT NULL DEFAULT 'new',
        created_at datetime DEFAULT current_timestamp(),
        PRIMARY KEY (id),
        KEY idx_status_created (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    )).then(() => true).catch((e: any) => { console.error('[Contact] table:', e?.sqlMessage || e?.message || e); ready = null; return false; });
  }
  return ready as Promise<boolean>;
}
void ensureTable();
router.use(async (_req, _res, next) => { try { await ensureTable(); } catch { /* reported by the request */ } next(); });

// ---------- Protection ----------
// 1. A signed token that the page asks for when the form opens. A form sent faster than MIN_FILL_MS, or without a
//    valid token, is refused. The signature stops a bot from making up its own timestamp.
const MIN_FILL_MS = 4000;
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
const sign = (body: string) => crypto.createHmac('sha256', SECRET).update(body).digest('hex').slice(0, 32);
function makeToken() {
  const body = `${Date.now()}.${crypto.randomBytes(6).toString('hex')}`;
  return `${body}.${sign(body)}`;
}
function checkToken(token: any): 'ok' | 'TOKEN' | 'TOO_FAST' {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return 'TOKEN';
  const body = `${parts[0]}.${parts[1]}`;
  const a = Buffer.from(sign(body)), b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 'TOKEN';
  const age = Date.now() - Number(parts[0]);
  if (!(age >= 0) || age > MAX_AGE_MS) return 'TOKEN';
  return age < MIN_FILL_MS ? 'TOO_FAST' : 'ok';
}

// 2. A limit on messages, kept in memory (it starts again when the API restarts)
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) { hits.set(key, list); return true; }
  list.push(now);
  hits.set(key, list);
  return false;
}
setInterval(() => {
  const now = Date.now();
  hits.forEach((list, k) => { const live = list.filter((t) => now - t < 3600_000); if (live.length) hits.set(k, live); else hits.delete(k); });
}, 10 * 60 * 1000).unref();

// 3. Cloudflare Turnstile ("I am not a robot"). Switched on only when TURNSTILE_SECRET_KEY is set in apps/api/.env.
async function turnstileOk(token: string, ip: string): Promise<boolean> {
  const secret = (process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) return true;
  if (!token) return false;
  try {
    const r = await (globalThis as any).fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }).toString(),
    });
    const d: any = await r.json();
    return !!d?.success;
  } catch (e: any) { console.error('[Contact] Turnstile check failed:', e?.message || e); return false; }
}

// ---------- Helpers ----------
const text = (v: any, max: number) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const oneLine = (v: any, max: number) => text(v, max).replace(/\s+/g, ' ');
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
// The same rules as the form in the browser, checked again here because a bot can skip the browser.
const DIALS = new Set(['91', '94', '65', '60', '971', '966', '974', '965', '968', '973', '1', '44', '61', '64', '49', '33', '41', '27', '81', '852', '230', '977', '880', '92']);
const cleanName = (v: any) => oneLine(v, 200).replace(/[^\p{L}\p{M}\s.'’-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 80);
const cleanTopic = (v: any) => oneLine(v, 200).replace(/[^\p{L}\p{M}\p{N}\s.,;:!?'’&()\-–/]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 100);
const cleanMsg = (v: any) => String(v ?? '').replace(/\r\n?|[\u2028\u2029]/g, '\n')
  .replace(/[^\p{L}\p{M}\p{N}\s.,;:!?'"‘’“”()\-–—/&@#%+=_₹]/gu, '').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 800);
const cell = (v: any) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

// ---------- Public ----------
router.get('/token', (req, res) => {
  if (limited(`tok:${req.ip}`, 60, 3600_000)) return res.status(429).json({ code: 'RATE' });
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ token: makeToken() });
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    const ip = String(req.ip || '').slice(0, 45);

    // A filled hidden field means a bot. It is told the message was sent and nothing is saved.
    if (String(b.website || '').trim()) return res.status(201).json({ ok: true, ack: false });

    const tk = checkToken(b.token);
    if (tk !== 'ok') return res.status(400).json({ code: tk, message: tk === 'TOO_FAST' ? 'Please wait a few seconds and try again.' : 'Please reload the page and try again.' });
    if (limited(`ip:${ip}`, 6, 3600_000)) return res.status(429).json({ code: 'RATE', message: 'Too many messages. Please try again later.' });
    if (!(await turnstileOk(String(b.turnstile || ''), ip))) return res.status(400).json({ code: 'BOT', message: 'The security check failed. Please try again.' });

    const name = cleanName(b.name);
    const dial = String(b.dial || '91').replace(/\D/g, '');
    let digits = String(b.phone || '').replace(/\D/g, '').replace(/^0+/, '');
    if (dial === '91' && digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    const email = oneLine(b.email, 120).toLowerCase();
    const topic = cleanTopic(b.topic);
    const message = cleanMsg(b.message);
    const locale = b.locale === 'ta' ? 'ta' : 'en';

    // The browser already removes forbidden characters, so a name that still has some did not come from the form
    if (name.length < 2 || name !== oneLine(b.name, 200).replace(/\s+/g, ' ').slice(0, 80)) return res.status(400).json({ code: 'name', message: 'Please enter your name (letters only).' });
    const phoneOk = DIALS.has(dial) && (dial === '91' ? /^[6-9]\d{9}$/.test(digits) : /^\d{6,14}$/.test(digits) && dial.length + digits.length <= 15);
    const emailOk = EMAIL_RE.test(email);
    if (!phoneOk && !emailOk) return res.status(400).json({ code: 'contact', message: 'Enter a valid mobile number or email.' });
    if (digits && !phoneOk) return res.status(400).json({ code: 'contact', message: 'Enter a valid mobile number.' });
    if (email && !emailOk) return res.status(400).json({ code: 'contact', message: 'Enter a valid email.' });
    if (!topic) return res.status(400).json({ code: 'topic', message: 'Please choose a topic.' });
    if (message.length < 10) return res.status(400).json({ code: 'message', message: 'Please write your message (at least 10 letters).' });
    if (b.consent !== true) return res.status(400).json({ code: 'consent', message: 'Please tick the box to continue.' });
    if ((message.match(/https?:\/\/|www\./gi) || []).length > 2) return res.status(400).json({ code: 'SPAM', message: 'Please remove the links from your message.' });
    // The same email address cannot be used to flood someone's inbox
    if (emailOk && limited(`mail:${email}`, 3, 3600_000)) return res.status(429).json({ code: 'RATE', message: 'Too many messages. Please try again later.' });

    const [r]: any = await pool.query(
      `INSERT INTO contact_enquiries (name, phone, email, topic, message, locale, ip, consent) VALUES (?,?,?,?,?,?,?,1)`,
      [name, phoneOk ? `+${dial}${digits}` : null, emailOk ? email : null, topic, message, locale, ip]
    );
    const id = Number(r.insertId);
    const mail = { id, name, email: emailOk ? email : null, phone: phoneOk ? `+${dial}${digits}` : null, topic, message, locale };

    // Copy to the sender. The answer says whether it was really sent.
    let ack = false;
    if (emailOk) {
      try {
        await sendContactAck({ ...mail, to: email });
        ack = true;
        await pool.query('UPDATE contact_enquiries SET ack_sent = 1 WHERE id = ?', [id]);
      } catch (e: any) { console.error('[Contact] Acknowledgement email failed:', e?.message || e); }
    }
    // Alert to the ashram. A failure here never affects the visitor.
    sendContactNotice(mail).catch((e: any) => console.error('[Contact] Notification email failed:', e?.message || e));

    return res.status(201).json({ ok: true, ack });
  } catch (e: any) { return fail(res, e, 'Could not send the message.'); }
});

// ---------- Admin (CMS) ----------
router.get('/admin/messages', adminGuard, async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, name, phone, email, topic, message, locale, ack_sent, status, created_at FROM contact_enquiries ORDER BY id DESC LIMIT 500`
    );
    const [c]: any = await pool.query(`SELECT status, COUNT(*) AS n FROM contact_enquiries GROUP BY status`);
    const counts = { new: 0, done: 0 } as Record<string, number>;
    c.forEach((x: any) => { counts[x.status] = Number(x.n); });
    return res.json({ messages: rows, counts });
  } catch (e: any) { return fail(res, e, 'Could not load the messages.'); }
});

router.get('/admin/messages/export', adminGuard, async (_req, res) => {
  try {
    const [rows]: any = await pool.query(`SELECT id, name, phone, email, topic, message, locale, ack_sent, status, created_at FROM contact_enquiries ORDER BY id ASC`);
    const head = ['Ref', 'Date', 'Name', 'Mobile', 'Email', 'Topic', 'Message', 'Language', 'Copy emailed', 'Status'];
    const lines = rows.map((r: any) => [r.id, r.created_at instanceof Date ? r.created_at.toISOString().slice(0, 16).replace('T', ' ') : r.created_at, r.name, r.phone, r.email, r.topic, r.message, r.locale, r.ack_sent ? 'yes' : 'no', r.status]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contact-messages.csv"');
    return res.send('﻿' + [head, ...lines].map((r: any[]) => r.map(cell).join(',')).join('\r\n'));
  } catch (e: any) { return fail(res, e, 'Export failed.'); }
});

router.patch('/admin/messages/:id', adminGuard, async (req, res) => {
  try {
    const status = req.body?.status === 'done' ? 'done' : 'new';
    const [r]: any = await pool.query('UPDATE contact_enquiries SET status = ? WHERE id = ?', [status, Number(pid(req.params.id))]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Message not found.' });
    return res.json({ status });
  } catch (e: any) { return fail(res, e, 'Could not change the status.'); }
});

router.delete('/admin/messages/:id', adminGuard, async (req, res) => {
  try {
    await pool.query('DELETE FROM contact_enquiries WHERE id = ?', [Number(pid(req.params.id))]);
    return res.json({ deleted: true });
  } catch (e: any) { return fail(res, e, 'Could not delete the message.'); }
});

// ---------- Page text (edited in the CMS under Contact, Page content) ----------
async function readPage() {
  const [rows]: any = await pool.query('SELECT content FROM contact_page WHERE id = 1 LIMIT 1');
  try { return rows[0]?.content ? JSON.parse(rows[0].content) : {}; } catch { return {}; }
}
router.get('/page', async (_req, res) => {
  try { res.setHeader('Cache-Control', 'no-store'); return res.json({ content: await readPage() }); }
  catch { return res.status(500).json({ content: {} }); }
});
router.get('/admin/page', adminGuard, async (_req, res) => {
  try { return res.json({ content: await readPage() }); } catch (e: any) { return fail(res, e, 'Could not load the page.'); }
});
router.put('/admin/page', adminGuard, async (req, res) => {
  try {
    const c = req.body?.content;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return res.status(400).json({ message: 'Invalid content.' });
    const json = JSON.stringify(c);
    if (json.length > 200000) return res.status(400).json({ message: 'The content is too large.' });
    await pool.query('INSERT INTO contact_page (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)', [json]);
    return res.json({ saved: true });
  } catch (e: any) { return fail(res, e, 'Could not save the page.'); }
});

export default router;