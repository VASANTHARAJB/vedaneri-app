import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import Razorpay from 'razorpay';
import { pool } from '../db';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { ensureMagazineTables } from '../services/magazineSchema';
import { sendMagazineReceipt, sendMagazineReminder } from '../services/magazineEmail';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const router = Router();
const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET || 'vedaneri-ashram-secret-key';
const HOLD_MINUTES = 15;
const IS_PROD = process.env.NODE_ENV === 'production';
// The real database reason is shown only outside production, to make set-up problems easy to find
const dbg = (e) => (IS_PROD ? undefined : e?.sqlMessage || e?.message || String(e));
// The tables are checked before every request, so a missing table can never cause a 500
router.use(async (_req, _res, next) => {
    try {
        await ensureMagazineTables();
    }
    catch { /* the request will report any real problem */ }
    next();
});
const clean = (v) => (v || '').replace(/["'\s]/g, '');
const ORG = { seva: 'SRI DAKSHINAMURTI SEVA SAMITI', donation: 'VEDANTA SASTHRA PRACHARA TRUST' };
const acctOf = (v) => (v === 'donation' ? 'donation' : 'seva');
function keysFor(a) {
    const p = a === 'donation' ? 'RAZORPAY_DONATION' : 'RAZORPAY_SEVA';
    return { id: clean(process.env[`${p}_KEY_ID`]), secret: clean(process.env[`${p}_KEY_SECRET`]) };
}
const clients = {};
function client(a) {
    const k = keysFor(a);
    if (!k.id || !k.secret)
        throw new Error('NOT_CONFIGURED');
    const key = `${a}:${k.id}`;
    if (!clients[key])
        clients[key] = new Razorpay({ key_id: k.id, key_secret: k.secret });
    return clients[key];
}
// ---------- Files: covers are public, PDFs are private (served only to logged-in devotees) ----------
const coverDir = path.resolve(__dirname, '../../uploads/magazine');
const pdfDir = path.resolve(__dirname, '../../private/magazine');
[coverDir, pdfDir].forEach((d) => { if (!fs.existsSync(d))
    fs.mkdirSync(d, { recursive: true }); });
const IMG = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
    storage: multer.diskStorage({
        destination: (_r, f, cb) => cb(null, f.fieldname === 'pdf' ? pdfDir : coverDir),
        filename: (_r, f, cb) => cb(null, `${f.fieldname}-${Date.now()}-${crypto.randomInt(0, 10000)}${f.fieldname === 'pdf' ? '.pdf' : IMG[f.mimetype] || '.jpg'}`),
    }),
    limits: { fileSize: 40 * 1024 * 1024, files: 2 },
    fileFilter: (_r, f, cb) => {
        if (f.fieldname === 'pdf')
            return f.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('The issue file must be a PDF.'));
        if (f.fieldname === 'cover')
            return IMG[f.mimetype] ? cb(null, true) : cb(new Error('The cover must be a JPG, PNG or WebP image.'));
        return cb(new Error('Unexpected file.'));
    },
});
function runUpload(req, res, next) {
    upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'pdf', maxCount: 1 }])(req, res, (err) => {
        if (err)
            return res.status(400).json({ message: err.message || 'File upload failed.' });
        next();
    });
}
const filesOf = (req) => req.files || {};
const dropNew = (files) => Object.values(files || {}).flat().forEach((f) => f?.path && fs.unlink(f.path, () => { }));
const rm = (dir, name) => { if (name)
    fs.unlink(path.join(dir, path.basename(name)), () => { }); };
const adminGuard = (req, res, next) => authenticate(req, res, next);
function authDevotee(req, res, next) {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer '))
        return res.status(401).json({ message: 'Unauthorized' });
    try {
        const d = jwt.verify(h.split(' ')[1], JWT_SECRET);
        const id = d.id || d.devotee_id || d.userId;
        if (!id)
            return res.status(401).json({ message: 'Unauthorized' });
        req.devoteeId = id;
        next();
    }
    catch {
        return res.status(401).json({ message: 'Session expired' });
    }
}
// ---------- Helpers ----------
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const IST = 330 * 60 * 1000;
const todayYmd = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const periodEnd = (start, months) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + months);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
};
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,59}$/u;
const PLACE_RE = /^[\p{L}\p{M}][\p{L}\p{M} .-]{0,59}$/u;
const EMAIL_RE = /^[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const CODE_RE = /^\+\d{1,4}$/;
const ADDR_BAD = /[^\p{L}\p{M}\p{N} ,.\-/#()\n]/gu;
const DELIVERIES = ['print', 'digital', 'both'];
const MODES = ['cash', 'upi', 'cheque', 'bank'];
const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s))
        s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
};
const csv = (res, name, head, rows) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    return res.send('\uFEFF' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n'));
};
// ---------- Receipt number MAG-YYyy-DDD-NNN ----------
async function generateReceiptNo() {
    const conn = await pool.getConnection();
    try {
        const now = new Date(Date.now() + IST);
        const y = now.getUTCFullYear(), m = now.getUTCMonth();
        const fyStart = m >= 3 ? y : y - 1;
        const fy = `${String(fyStart).slice(-2)}${String(fyStart + 1).slice(-2)}`;
        const doy = Math.floor((Date.UTC(y, m, now.getUTCDate()) - Date.UTC(y, 0, 1)) / 86400000) + 1;
        const key = `MAG-${fy}-${String(doy).padStart(3, '0')}`;
        await conn.query(`INSERT INTO receipt_counters (counter_key, last_number) VALUES (?, LAST_INSERT_ID(1))
       ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`, [key]);
        const [rows] = await conn.query('SELECT LAST_INSERT_ID() AS n');
        return `${key}-${String(Number(rows[0]?.n) || 1).padStart(3, '0')}`;
    }
    finally {
        conn.release();
    }
}
// ---------- Confirm a paid subscription (verify, sweeper and manual entry all use this) ----------
// A renewal starts the day after the current period ends, so there is no gap and no overlap.
export async function confirmSubscription(id, paymentId) {
    const [rows] = await pool.query('SELECT * FROM magazine_subscriptions WHERE id = ? LIMIT 1', [id]);
    const s = rows[0];
    if (!s)
        return null;
    if (s.status === 'ACTIVE')
        return s.receipt_no;
    const [last] = await pool.query(`SELECT DATE_FORMAT(MAX(end_date),'%Y-%m-%d') AS e FROM magazine_subscriptions WHERE devotee_id = ? AND status = 'ACTIVE' AND id <> ?`, [s.devotee_id, id]);
    const today = todayYmd();
    const start = last[0]?.e && last[0].e >= today ? addDays(last[0].e, 1) : today;
    const end = periodEnd(start, Number(s.duration_months));
    const receipt = s.receipt_no || (await generateReceiptNo());
    const [u] = await pool.query(`UPDATE magazine_subscriptions SET status='ACTIVE', start_date=?, end_date=?, receipt_no=?, razorpay_payment_id=?, reminder_30=0, reminder_7=0
     WHERE id = ? AND status <> 'ACTIVE'`, [start, end, receipt, paymentId.slice(0, 64), id]);
    if (u.affectedRows) {
        sendMagazineReceipt({
            to: s.email, name: s.first_name, org: ORG[acctOf(s.pay_account)], receiptNo: receipt, planName: s.plan_name, delivery: s.delivery,
            amount: Number(s.amount), paymentId, start, end,
        }).catch((e) => console.error('Magazine receipt email error:', e?.message || e));
    }
    return receipt;
}
// =================== ADMIN: ISSUES ===================
function readIssue(b) {
    const title_en = str(b.title_en, 255);
    if (!title_en)
        return { error: 'Please enter the issue title in English.' };
    const month = Math.floor(Number(b.issue_month));
    const year = Math.floor(Number(b.issue_year));
    if (!(month >= 1 && month <= 12))
        return { error: 'Choose the issue month.' };
    if (!(year >= 2000 && year <= 2100))
        return { error: 'Enter a valid issue year.' };
    return { v: { title_en, title_ta: str(b.title_ta, 255) || null, month, year, status: b.status === 'published' ? 'published' : 'draft' } };
}
router.get('/admin/issues', adminGuard, async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT id, title_en, title_ta, issue_month, issue_year, cover_url, status, (pdf_file IS NOT NULL) AS has_pdf, created_at
       FROM magazine_issues ORDER BY issue_year DESC, issue_month DESC LIMIT 500`);
        return res.json({ issues: rows });
    }
    catch (e) {
        console.error('Magazine issues error:', e?.sqlMessage || e?.message || e);
        return res.status(500).json({ message: 'Failed to load issues', detail: dbg(e) });
    }
});
router.post('/admin/issues', adminGuard, runUpload, async (req, res) => {
    const files = filesOf(req);
    try {
        const r = readIssue(req.body || {});
        if (r.error) {
            dropNew(files);
            return res.status(400).json({ message: r.error });
        }
        if (!files.pdf?.[0]) {
            dropNew(files);
            return res.status(400).json({ message: 'Please upload the issue PDF.' });
        }
        const id = crypto.randomUUID();
        const cover = files.cover?.[0] ? `/uploads/magazine/${files.cover[0].filename}` : null;
        await pool.query(`INSERT INTO magazine_issues (id, title_en, title_ta, issue_month, issue_year, cover_url, pdf_file, status) VALUES (?,?,?,?,?,?,?,?)`, [id, r.v.title_en, r.v.title_ta, r.v.month, r.v.year, cover, files.pdf[0].filename, r.v.status]);
        return res.status(201).json({ id });
    }
    catch (e) {
        dropNew(files);
        console.error('Magazine issue create error:', e?.sqlMessage || e?.message || e);
        return res.status(500).json({ message: 'Could not save the issue.', detail: dbg(e) });
    }
});
router.put('/admin/issues/:id', adminGuard, runUpload, async (req, res) => {
    const files = filesOf(req);
    try {
        const r = readIssue(req.body || {});
        if (r.error) {
            dropNew(files);
            return res.status(400).json({ message: r.error });
        }
        const [cur] = await pool.query('SELECT cover_url, pdf_file FROM magazine_issues WHERE id = ? LIMIT 1', [req.params.id]);
        if (!cur.length) {
            dropNew(files);
            return res.status(404).json({ message: 'Issue not found' });
        }
        let cover = cur[0].cover_url;
        let pdf = cur[0].pdf_file;
        if (files.cover?.[0]) {
            rm(coverDir, cover);
            cover = `/uploads/magazine/${files.cover[0].filename}`;
        }
        else if (req.body?.remove_cover === 'true') {
            rm(coverDir, cover);
            cover = null;
        }
        if (files.pdf?.[0]) {
            rm(pdfDir, pdf);
            pdf = files.pdf[0].filename;
        }
        await pool.query(`UPDATE magazine_issues SET title_en=?, title_ta=?, issue_month=?, issue_year=?, cover_url=?, pdf_file=?, status=? WHERE id=?`, [r.v.title_en, r.v.title_ta, r.v.month, r.v.year, cover, pdf, r.v.status, req.params.id]);
        return res.json({ saved: true });
    }
    catch (e) {
        dropNew(files);
        console.error('Magazine issue update error:', e?.sqlMessage || e?.message || e);
        return res.status(500).json({ message: 'Could not save the issue.', detail: dbg(e) });
    }
});
router.patch('/admin/issues/:id/status', adminGuard, async (req, res) => {
    try {
        if (!['draft', 'published'].includes(req.body?.status))
            return res.status(400).json({ message: 'Invalid status' });
        await pool.query('UPDATE magazine_issues SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
        return res.json({ saved: true });
    }
    catch (e) {
        console.error('Magazine issue status error:', e?.message || e);
        return res.status(500).json({ message: 'Could not change the status.' });
    }
});
router.delete('/admin/issues/:id', adminGuard, async (req, res) => {
    try {
        const [cur] = await pool.query('SELECT cover_url, pdf_file FROM magazine_issues WHERE id = ? LIMIT 1', [req.params.id]);
        await pool.query('DELETE FROM magazine_issues WHERE id = ?', [req.params.id]);
        if (cur[0]) {
            rm(coverDir, cur[0].cover_url);
            rm(pdfDir, cur[0].pdf_file);
        }
        return res.json({ removed: true });
    }
    catch (e) {
        console.error('Magazine issue delete error:', e?.message || e);
        return res.status(500).json({ message: 'Could not delete the issue.' });
    }
});
router.get('/admin/issues/:id/pdf', adminGuard, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT pdf_file FROM magazine_issues WHERE id = ? LIMIT 1', [req.params.id]);
        if (!rows[0]?.pdf_file)
            return res.status(404).json({ message: 'No PDF' });
        return res.sendFile(path.join(pdfDir, path.basename(rows[0].pdf_file)));
    }
    catch {
        return res.status(500).json({ message: 'Could not open the PDF.' });
    }
});
// =================== ADMIN: PLANS ===================
function readPlan(b) {
    const name_en = str(b.name_en, 255);
    if (!name_en)
        return { error: 'Please enter the plan name in English.' };
    const months = Math.floor(Number(b.duration_months));
    if (!(months >= 1 && months <= 240))
        return { error: 'Duration must be between 1 and 240 months.' };
    const price = Math.round(Number(b.price) * 100) / 100;
    if (!(price > 0) || price > 10000000)
        return { error: 'Enter a price greater than 0.' };
    const delivery = DELIVERIES.includes(b.delivery) ? b.delivery : 'print';
    return {
        v: {
            name_en, name_ta: str(b.name_ta, 255) || null,
            description_en: str(b.description_en, 2000) || null, description_ta: str(b.description_ta, 2000) || null,
            features_en: str(b.features_en, 2000) || null, features_ta: str(b.features_ta, 2000) || null,
            badge_en: str(b.badge_en, 40) || null, badge_ta: str(b.badge_ta, 40) || null,
            months, price, delivery, pay_account: acctOf(b.pay_account), status: b.status === 'published' ? 'published' : 'draft',
            sort_order: Math.floor(Number(b.sort_order) || 0),
        },
    };
}
router.get('/admin/plans', adminGuard, async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT p.*, (SELECT COUNT(*) FROM magazine_subscriptions s WHERE s.plan_id = p.id AND s.status = 'ACTIVE') AS active_subs
       FROM magazine_plans p ORDER BY p.sort_order ASC, p.price ASC LIMIT 200`);
        return res.json({ plans: rows.map((r) => ({ ...r, price: Number(r.price), active_subs: Number(r.active_subs) || 0 })) });
    }
    catch (e) {
        console.error('Magazine plans error:', e?.sqlMessage || e?.message || e);
        return res.status(500).json({ message: 'Failed to load plans', detail: dbg(e) });
    }
});
router.post('/admin/plans', adminGuard, async (req, res) => {
    try {
        const r = readPlan(req.body || {});
        if (r.error)
            return res.status(400).json({ message: r.error });
        const v = r.v;
        const id = crypto.randomUUID();
        await pool.query(`INSERT INTO magazine_plans (id, name_en, name_ta, description_en, description_ta, features_en, features_ta, badge_en, badge_ta,
         duration_months, delivery, price, pay_account, status, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, v.name_en, v.name_ta, v.description_en, v.description_ta, v.features_en, v.features_ta, v.badge_en, v.badge_ta,
            v.months, v.delivery, v.price, v.pay_account, v.status, v.sort_order]);
        return res.status(201).json({ id });
    }
    catch (e) {
        console.error('Magazine plan create error:', e?.sqlMessage || e?.message || e);
        return res.status(500).json({ message: 'Could not save the plan.', detail: dbg(e) });
    }
});
router.put('/admin/plans/:id', adminGuard, async (req, res) => {
    try {
        const r = readPlan(req.body || {});
        if (r.error)
            return res.status(400).json({ message: r.error });
        const v = r.v;
        await pool.query(`UPDATE magazine_plans SET name_en=?, name_ta=?, description_en=?, description_ta=?, features_en=?, features_ta=?, badge_en=?, badge_ta=?,
         duration_months=?, delivery=?, price=?, pay_account=?, status=?, sort_order=? WHERE id=?`, [v.name_en, v.name_ta, v.description_en, v.description_ta, v.features_en, v.features_ta, v.badge_en, v.badge_ta,
            v.months, v.delivery, v.price, v.pay_account, v.status, v.sort_order, req.params.id]);
        return res.json({ saved: true });
    }
    catch (e) {
        console.error('Magazine plan update error:', e?.sqlMessage || e?.message || e);
        return res.status(500).json({ message: 'Could not save the plan.', detail: dbg(e) });
    }
});
router.patch('/admin/plans/:id/status', adminGuard, async (req, res) => {
    try {
        if (!['draft', 'published'].includes(req.body?.status))
            return res.status(400).json({ message: 'Invalid status' });
        await pool.query('UPDATE magazine_plans SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
        return res.json({ saved: true });
    }
    catch (e) {
        console.error('Magazine plan status error:', e?.message || e);
        return res.status(500).json({ message: 'Could not change the status.' });
    }
});
router.delete('/admin/plans/:id', adminGuard, async (req, res) => {
    try {
        await pool.query('DELETE FROM magazine_plans WHERE id = ?', [req.params.id]);
        return res.json({ removed: true });
    }
    catch (e) {
        console.error('Magazine plan delete error:', e?.message || e);
        return res.status(500).json({ message: 'Could not delete the plan.' });
    }
});
// =================== ADMIN: SUBSCRIBERS ===================
const SUB_COLS = `id, plan_name, delivery, duration_months, amount, pay_account, payment_mode, first_name, last_name, email, phone, address, city, state, pincode,
  DATE_FORMAT(start_date,'%Y-%m-%d') AS start_date, DATE_FORMAT(end_date,'%Y-%m-%d') AS end_date, status, receipt_no, razorpay_payment_id, created_at`;
router.get('/admin/subscriptions', adminGuard, async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT ${SUB_COLS} FROM magazine_subscriptions WHERE status <> 'FAILED' ORDER BY id DESC LIMIT 3000`);
        return res.json({ subscriptions: rows.map((r) => ({ ...r, amount: Number(r.amount) })) });
    }
    catch (e) {
        console.error('Magazine subscribers error:', e?.sqlMessage || e?.message || e);
        return res.status(500).json({ message: 'Failed to load subscribers', detail: dbg(e) });
    }
});
router.get('/admin/subscriptions/export', adminGuard, async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT ${SUB_COLS} FROM magazine_subscriptions WHERE status <> 'FAILED' ORDER BY id ASC`);
        return csv(res, 'magazine-subscribers.csv', ['Receipt', 'First name', 'Last name', 'Email', 'Mobile', 'Plan', 'Delivery', 'Amount', 'Paid by', 'Status', 'Start', 'End', 'Address', 'City', 'State', 'Pincode', 'Payment ref'], rows.map((r) => [r.receipt_no, r.first_name, r.last_name, r.email, r.phone, r.plan_name, r.delivery, r.amount, r.payment_mode, r.status, r.start_date, r.end_date, r.address, r.city, r.state, r.pincode, r.razorpay_payment_id]));
    }
    catch (e) {
        console.error('Magazine export error:', e?.message || e);
        return res.status(500).json({ message: 'Export failed' });
    }
});
// Postal labels: active printed subscribers only
router.get('/admin/subscriptions/labels', adminGuard, async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT ${SUB_COLS} FROM magazine_subscriptions WHERE status = 'ACTIVE' AND delivery IN ('print','both') AND end_date >= ? ORDER BY pincode, id`, [todayYmd()]);
        return csv(res, 'magazine-labels.csv', ['Name', 'Address', 'City', 'State', 'Pincode', 'Mobile', 'Plan', 'Valid till'], rows.map((r) => [`${r.first_name} ${r.last_name}`, r.address, r.city, r.state, r.pincode, r.phone, r.plan_name, r.end_date]));
    }
    catch (e) {
        console.error('Magazine labels error:', e?.message || e);
        return res.status(500).json({ message: 'Export failed' });
    }
});
// Admin records a subscription paid outside the website (cash, UPI, cheque, bank transfer)
router.post('/admin/subscriptions/manual', adminGuard, async (req, res) => {
    try {
        const b = req.body || {};
        const fail = (field, message) => res.status(400).json({ message, field });
        const first = str(b.first_name, 60), last = str(b.last_name, 60);
        if (!NAME_RE.test(first))
            return fail('first_name', 'First name can contain only letters, spaces and . \' -');
        if (!NAME_RE.test(last))
            return fail('last_name', 'Last name can contain only letters, spaces and . \' -');
        const email = str(b.email, 100).toLowerCase();
        if (!EMAIL_RE.test(email))
            return fail('email', 'Please enter a valid email address.');
        const cc = str(b.country_code, 6) || '+91';
        const digits = String(b.phone || '').replace(/\D/g, '');
        if (!CODE_RE.test(cc))
            return fail('phone', 'Invalid country code.');
        if (cc === '+91' ? !/^[6-9]\d{9}$/.test(digits) : !/^\d{6,15}$/.test(digits))
            return fail('phone', 'Enter a valid mobile number.');
        const mode = String(b.payment_mode || '');
        if (!MODES.includes(mode))
            return fail('payment_mode', 'Choose how the payment was received.');
        const ref = str(b.payment_ref, 50).replace(/[^\p{L}\p{N} .\-/#]/gu, '');
        const [pr] = await pool.query('SELECT * FROM magazine_plans WHERE id = ? LIMIT 1', [str(b.plan_id, 36)]);
        if (!pr.length)
            return fail('plan_id', 'Choose a plan.');
        const plan = pr[0];
        let address = null, city = null, state = null, pincode = null;
        if (plan.delivery !== 'digital') {
            address = str(b.address, 300).replace(ADDR_BAD, '').trim();
            city = str(b.city, 60);
            state = str(b.state, 60);
            pincode = str(b.pincode, 10);
            if (address.length < 5)
                return fail('address', 'Enter the full postal address.');
            if (!PLACE_RE.test(city))
                return fail('city', 'Enter the city (letters only).');
            if (!PLACE_RE.test(state))
                return fail('state', 'Enter the state (letters only).');
            if (!/^\d{6}$/.test(pincode))
                return fail('pincode', 'Enter a 6 digit pincode.');
        }
        // Link to the devotee account when the email matches, so the subscriber sees it on the website
        const [dv] = await pool.query('SELECT id FROM devotees WHERE email = ? LIMIT 1', [email]);
        const devoteeId = dv[0]?.id ? String(dv[0].id) : `manual_${crypto.randomUUID().slice(0, 12)}`;
        const [ins] = await pool.query(`INSERT INTO magazine_subscriptions (plan_id, devotee_id, plan_name, delivery, duration_months, amount, pay_account, payment_mode,
         first_name, last_name, email, phone, address, city, state, pincode, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING')`, [plan.id, devoteeId, plan.name_en, plan.delivery, plan.duration_months, Number(plan.price), acctOf(plan.pay_account), mode,
            first, last, email, `${cc}${digits}`, address, city, state, pincode]);
        const receipt = await confirmSubscription(ins.insertId, ref ? `${mode.toUpperCase()}-${ref}` : mode.toUpperCase());
        return res.status(201).json({ id: ins.insertId, receiptNo: receipt });
    }
    catch (e) {
        console.error('Magazine manual subscription error:', e?.sqlMessage || e?.message || e);
        return res.status(500).json({ message: 'Could not add the subscriber.', detail: dbg(e) });
    }
});
// =================== PUBLIC ===================
router.get('/plans', async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT id, name_en, name_ta, description_en, description_ta, features_en, features_ta, badge_en, badge_ta, duration_months, delivery, price
       FROM magazine_plans WHERE status = 'published' ORDER BY sort_order ASC, price ASC`);
        return res.json({ plans: rows.map((r) => ({ ...r, price: Number(r.price) })) });
    }
    catch (e) {
        console.error('Magazine public plans error:', e?.message || e);
        return res.status(500).json({ plans: [] });
    }
});
router.get('/issues', async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT id, title_en, title_ta, issue_month, issue_year, cover_url FROM magazine_issues WHERE status = 'published' AND pdf_file IS NOT NULL
       ORDER BY issue_year DESC, issue_month DESC LIMIT 200`);
        return res.json({ issues: rows });
    }
    catch (e) {
        console.error('Magazine public issues error:', e?.message || e);
        return res.status(500).json({ issues: [] });
    }
});
// Reading needs a login
router.get('/issues/:id/pdf', authDevotee, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT pdf_file, title_en FROM magazine_issues WHERE id = ? AND status = 'published' LIMIT 1`, [req.params.id]);
        if (!rows[0]?.pdf_file)
            return res.status(404).json({ message: 'Issue not found' });
        res.setHeader('Content-Type', 'application/pdf');
        return res.sendFile(path.join(pdfDir, path.basename(rows[0].pdf_file)));
    }
    catch {
        return res.status(500).json({ message: 'Could not open the issue.' });
    }
});
router.get('/my', authDevotee, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT id, plan_name, delivery, amount, DATE_FORMAT(start_date,'%Y-%m-%d') AS start_date, DATE_FORMAT(end_date,'%Y-%m-%d') AS end_date, status, receipt_no, plan_id
       FROM magazine_subscriptions WHERE devotee_id = ? AND status IN ('ACTIVE','EXPIRED') ORDER BY id DESC LIMIT 50`, [String(req.devoteeId)]);
        return res.json({ subscriptions: rows.map((r) => ({ ...r, amount: Number(r.amount) })) });
    }
    catch (e) {
        console.error('My magazine error:', e?.message || e);
        return res.json({ subscriptions: [] });
    }
});
router.get('/receipt/:id', authDevotee, async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT ${SUB_COLS} FROM magazine_subscriptions WHERE id = ? AND devotee_id = ? AND status IN ('ACTIVE','EXPIRED') LIMIT 1`, [req.params.id, String(req.devoteeId)]);
        if (!rows.length)
            return res.status(404).json({ message: 'Receipt not found' });
        const r = rows[0];
        return res.json({ receipt: { ...r, amount: Number(r.amount), org: ORG[acctOf(r.pay_account)] } });
    }
    catch (e) {
        console.error('Magazine receipt error:', e?.message || e);
        return res.status(500).json({ message: 'Could not load the receipt.' });
    }
});
// =================== SUBSCRIBE / RENEW (login required) ===================
router.post('/subscribe', authDevotee, async (req, res) => {
    try {
        const b = req.body || {};
        const fail = (field, message) => res.status(400).json({ message, field });
        const devoteeId = String(req.devoteeId);
        const first = str(b.first_name, 60), last = str(b.last_name, 60);
        if (!NAME_RE.test(first))
            return fail('first_name', 'First name can contain only letters, spaces and . \' -');
        if (!NAME_RE.test(last))
            return fail('last_name', 'Last name can contain only letters, spaces and . \' -');
        const email = str(b.email, 100).toLowerCase();
        if (!EMAIL_RE.test(email))
            return fail('email', 'Please enter a valid email address.');
        const cc = str(b.country_code, 6) || '+91';
        const digits = String(b.phone || '').replace(/\D/g, '');
        if (!CODE_RE.test(cc))
            return fail('phone', 'Invalid country code.');
        if (cc === '+91' ? !/^[6-9]\d{9}$/.test(digits) : !/^\d{6,15}$/.test(digits))
            return fail('phone', 'Enter a valid mobile number.');
        const phone = `${cc}${digits}`;
        const [pr] = await pool.query(`SELECT * FROM magazine_plans WHERE id = ? AND status = 'published' LIMIT 1`, [str(b.plan_id, 36)]);
        if (!pr.length)
            return res.status(400).json({ message: 'This plan is not available.' });
        const plan = pr[0];
        const amount = Number(plan.price); // fixed price, always from the database
        const acct = acctOf(plan.pay_account);
        let address = null, city = null, state = null, pincode = null;
        if (plan.delivery !== 'digital') {
            address = str(b.address, 300).replace(ADDR_BAD, '').trim();
            city = str(b.city, 60);
            state = str(b.state, 60);
            pincode = str(b.pincode, 10);
            if (address.length < 5)
                return fail('address', 'Please enter your full postal address.');
            if (!PLACE_RE.test(city))
                return fail('city', 'Please enter your city (letters only).');
            if (!PLACE_RE.test(state))
                return fail('state', 'Please enter your state (letters only).');
            if (!/^\d{6}$/.test(pincode))
                return fail('pincode', 'Enter a 6 digit pincode.');
        }
        const k = keysFor(acct);
        if (!k.id || !k.secret) {
            console.error(`[Magazine] Razorpay keys for the ${acct} account are missing.`);
            return res.status(503).json({ message: 'Online payment is temporarily unavailable. Please try again later.' });
        }
        // Reuse an unpaid order made in the last few minutes for the same plan
        const [pend] = await pool.query(`SELECT id, razorpay_order_id FROM magazine_subscriptions
       WHERE devotee_id = ? AND plan_id = ? AND status = 'PENDING' AND razorpay_order_id IS NOT NULL AND created_at > (NOW() - INTERVAL ${HOLD_MINUTES} MINUTE)
       ORDER BY id DESC LIMIT 1`, [devoteeId, plan.id]);
        if (pend.length) {
            await pool.query(`UPDATE magazine_subscriptions SET first_name=?, last_name=?, email=?, phone=?, address=?, city=?, state=?, pincode=? WHERE id=?`, [first, last, email, phone, address, city, state, pincode, pend[0].id]);
            return res.json({ payment: { orderId: pend[0].razorpay_order_id, amount: Math.round(amount * 100), currency: 'INR', keyId: k.id, orgName: ORG[acct], subscriptionId: pend[0].id } });
        }
        const [ins] = await pool.query(`INSERT INTO magazine_subscriptions (plan_id, devotee_id, plan_name, delivery, duration_months, amount, pay_account, payment_mode, first_name, last_name, email, phone, address, city, state, pincode, status)
       VALUES (?,?,?,?,?,?,?,'online',?,?,?,?,?,?,?,?,'PENDING')`, [plan.id, devoteeId, plan.name_en, plan.delivery, plan.duration_months, amount, acct, first, last, email, phone, address, city, state, pincode]);
        const subId = ins.insertId;
        let order;
        try {
            order = await client(acct).orders.create({
                amount: Math.round(amount * 100), currency: 'INR', receipt: `MAG_${subId}`,
                notes: { subscriptionId: String(subId), planId: plan.id, devoteeId },
            });
        }
        catch (err) {
            await pool.query(`UPDATE magazine_subscriptions SET status='FAILED' WHERE id = ?`, [subId]);
            console.error('Magazine order error:', err?.error?.description || err?.message || err);
            return res.status(502).json({ message: 'Could not start the payment. Please try again.' });
        }
        await pool.query('UPDATE magazine_subscriptions SET razorpay_order_id = ? WHERE id = ?', [order.id, subId]);
        return res.json({ payment: { orderId: order.id, amount: order.amount, currency: order.currency, keyId: k.id, orgName: ORG[acct], subscriptionId: subId } });
    }
    catch (e) {
        console.error('Magazine subscribe error:', e?.sqlMessage || e?.message || e);
        return res.status(500).json({ message: 'Could not start the subscription. Please try again.' });
    }
});
router.post('/verify', authDevotee, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, subscriptionId } = req.body || {};
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !subscriptionId)
            return res.status(400).json({ message: 'Missing payment details' });
        const [rows] = await pool.query('SELECT id, status, pay_account, razorpay_order_id, receipt_no FROM magazine_subscriptions WHERE id = ? AND devotee_id = ? LIMIT 1', [subscriptionId, String(req.devoteeId)]);
        if (!rows.length)
            return res.status(404).json({ message: 'Subscription not found' });
        const s = rows[0];
        if (!s.razorpay_order_id || s.razorpay_order_id !== String(razorpay_order_id))
            return res.status(400).json({ message: 'Payment does not match this subscription' });
        if (s.status === 'ACTIVE')
            return res.json({ subscribed: true, subscriptionId: s.id, receiptNo: s.receipt_no });
        const secret = keysFor(acctOf(s.pay_account)).secret;
        if (!secret)
            return res.status(503).json({ message: 'Online payment is temporarily unavailable.' });
        const expected = crypto.createHmac('sha256', secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
        const a = Buffer.from(expected), b = Buffer.from(String(razorpay_signature));
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
            return res.status(400).json({ message: 'Signature verification failed' });
        const receiptNo = await confirmSubscription(s.id, String(razorpay_payment_id));
        return res.json({ subscribed: true, subscriptionId: s.id, receiptNo });
    }
    catch (e) {
        console.error('Magazine verify error:', e?.message || e);
        return res.status(500).json({ message: 'Could not confirm the payment. Please contact the ashram with your payment id.' });
    }
});
// =================== BACKGROUND JOB (runs every minute) ===================
let working = false;
export async function syncMagazine() {
    if (working)
        return;
    working = true;
    try {
        await ensureMagazineTables();
        const today = todayYmd();
        // 1. Mark finished subscriptions as expired
        await pool.query(`UPDATE magazine_subscriptions SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND end_date < ?`, [today]);
        // 2. Settle unpaid online orders: ask Razorpay before releasing anything
        const [pending] = await pool.query(`SELECT id, razorpay_order_id, amount, pay_account FROM magazine_subscriptions
       WHERE status = 'PENDING' AND created_at < (NOW() - INTERVAL ${HOLD_MINUTES} MINUTE) ORDER BY id ASC LIMIT 50`);
        for (const s of pending || []) {
            try {
                if (!s.razorpay_order_id) {
                    await pool.query(`UPDATE magazine_subscriptions SET status='FAILED' WHERE id=? AND status='PENDING'`, [s.id]);
                    continue;
                }
                const list = await client(acctOf(s.pay_account)).orders.fetchPayments(s.razorpay_order_id);
                const captured = (list?.items || []).find((p) => p.status === 'captured');
                if (!captured) {
                    await pool.query(`UPDATE magazine_subscriptions SET status='FAILED' WHERE id=? AND status='PENDING'`, [s.id]);
                    continue;
                }
                if (Math.round(Number(s.amount) * 100) !== Number(captured.amount)) {
                    console.error('[MagazineSync] Amount mismatch, needs review:', { id: s.id, paymentId: captured.id });
                    continue;
                }
                await confirmSubscription(s.id, String(captured.id));
                console.log(`[MagazineSync] Subscription ${s.id} confirmed from Razorpay.`);
            }
            catch (err) {
                console.warn(`[MagazineSync] Subscription ${s.id} skipped:`, err?.error?.description || err?.message || err);
            }
        }
        // 3. Renewal reminders (30 and 7 days before the end), skipped when the subscriber has already renewed
        const NOT_RENEWED = `NOT EXISTS (SELECT 1 FROM magazine_subscriptions n WHERE n.devotee_id = s.devotee_id AND n.status = 'ACTIVE' AND n.end_date > s.end_date)`;
        const due = async (flag, from, to) => {
            const [rows] = await pool.query(`SELECT s.id, s.email, s.first_name, s.plan_name, s.pay_account, DATE_FORMAT(s.end_date,'%Y-%m-%d') AS ed
         FROM magazine_subscriptions s
         WHERE s.status = 'ACTIVE' AND s.${flag} = 0 AND s.end_date >= ? AND s.end_date <= ? AND ${NOT_RENEWED} LIMIT 30`, [from, to]);
            for (const s of rows || []) {
                // Marked first so a slow email can never be sent twice
                await pool.query(`UPDATE magazine_subscriptions SET ${flag} = 1 ${flag === 'reminder_7' ? ', reminder_30 = 1' : ''} WHERE id = ?`, [s.id]);
                const left = Math.max(0, Math.round((new Date(`${s.ed}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000));
                sendMagazineReminder({ to: s.email, name: s.first_name, org: ORG[acctOf(s.pay_account)], planName: s.plan_name, end: s.ed, daysLeft: left })
                    .catch((e) => console.error('Magazine reminder email error:', e?.message || e));
            }
        };
        await due('reminder_7', today, addDays(today, 7));
        await due('reminder_30', addDays(today, 8), addDays(today, 30));
    }
    catch (e) {
        console.error('[MagazineSync] Run failed:', e?.sqlMessage || e?.message || e);
    }
    finally {
        working = false;
    }
}
export default router;
