import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../db';
import { authenticate } from '../middleware/auth';
import { ensureDiscoverTables } from '../services/discoverSchema';
const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const dbg = (e) => (IS_PROD ? undefined : e?.sqlMessage || e?.message || String(e));
const fail = (res, e, message) => {
    console.error(`Discover: ${message}`, e?.sqlMessage || e?.message || e);
    return res.status(500).json({ message, detail: dbg(e) });
};
const pid = (v) => String(Array.isArray(v) ? v[0] : v);
// The tables are checked before every request
router.use(async (_req, _res, next) => {
    try {
        await ensureDiscoverTables();
    }
    catch { /* the request will report any real problem */ }
    next();
});
const adminGuard = (req, res, next) => authenticate(req, res, next);
// ---------- Files (public, served from /uploads/discover) ----------
const MAX_MB = 200; // limit for each file (photo or audio), in MB
const MAX_IMG = MAX_MB * 1024 * 1024;
const dir = path.resolve(__dirname, '../../uploads/discover');
if (!fs.existsSync(dir))
    fs.mkdirSync(dir, { recursive: true });
const AUDIO_EXT = {
    'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac',
    'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/ogg': '.ogg',
};
const IMG_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
    storage: multer.diskStorage({
        destination: (_r, _f, cb) => cb(null, dir),
        filename: (_r, f, cb) => {
            const ext = f.fieldname === 'audio' ? AUDIO_EXT[f.mimetype] : IMG_EXT[f.mimetype];
            cb(null, `${f.fieldname}-${Date.now()}-${crypto.randomInt(0, 100000)}${ext || ''}`);
        },
    }),
    limits: { fileSize: MAX_IMG, files: 41 },
    fileFilter: (_r, f, cb) => {
        if (f.fieldname === 'audio')
            return AUDIO_EXT[f.mimetype] ? cb(null, true) : cb(new Error('The audio must be an MP3, M4A, AAC, WAV or OGG file.'));
        if (f.fieldname === 'cover' || f.fieldname === 'photos')
            return IMG_EXT[f.mimetype] ? cb(null, true) : cb(new Error('Images must be JPG, PNG or WebP.'));
        return cb(new Error('Unexpected file.'));
    },
});
const filesOf = (req) => req.files || {};
const dropNew = (files) => Object.values(files || {}).flat().forEach((f) => f?.path && fs.unlink(f.path, () => { }));
const urlOf = (f) => `/uploads/discover/${f.filename}`;
const rmUrl = (u) => { if (u)
    fs.unlink(path.join(dir, path.basename(u)), () => { }); };
const rmMany = (...list) => Array.from(new Set(list.filter(Boolean))).forEach((u) => rmUrl(u));
function runUpload(req, res, next) {
    upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }, { name: 'photos', maxCount: 40 }])(req, res, (err) => {
        if (err) {
            return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? `A file is too large (up to ${MAX_MB}MB each).` : err.message || 'Upload failed.' });
        }
        const f = filesOf(req);
        const big = [...(f.cover || []), ...(f.photos || [])].find((x) => x.size > MAX_IMG);
        if (big) {
            dropNew(f);
            return res.status(400).json({ message: `Each image must be under ${MAX_MB}MB.` });
        }
        next();
    });
}
// ---------- Image optimisation (the original is kept; web copy and thumbnail are small) ----------
async function makeCopies(file) {
    const original = urlOf(file);
    const base = path.basename(file.filename, path.extname(file.filename));
    const webName = `${base}-web.webp`;
    const thumbName = `${base}-thumb.webp`;
    try {
        await sharp(file.path).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(dir, webName));
        await sharp(file.path).rotate().resize({ width: 500, height: 500, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toFile(path.join(dir, thumbName));
        return { web: `/uploads/discover/${webName}`, thumb: `/uploads/discover/${thumbName}` };
    }
    catch (e) {
        console.warn('Discover: could not optimise an image, the original is used.', e?.message || e);
        rmUrl(`/uploads/discover/${webName}`);
        rmUrl(`/uploads/discover/${thumbName}`);
        return { web: original, thumb: original };
    }
}
// A cover image for audio: one optimised copy replaces the original
async function coverCopy(file) {
    const base = path.basename(file.filename, path.extname(file.filename));
    const name = `${base}-cover.webp`;
    try {
        await sharp(file.path).rotate().resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(dir, name));
        fs.unlink(file.path, () => { });
        return `/uploads/discover/${name}`;
    }
    catch (e) {
        console.warn('Discover: could not optimise the cover, the original is used.', e?.message || e);
        rmUrl(`/uploads/discover/${name}`);
        return urlOf(file);
    }
}
// ---------- Helpers ----------
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime());
const KINDS = ['audio', 'video', 'album'];
const TABLE = { audio: 'discover_audio', video: 'discover_video', album: 'discover_albums' };
const isKind = (k) => KINDS.includes(k);
function ytId(u) {
    try {
        const x = new URL(u.trim());
        const h = x.hostname.replace(/^www\./, '').replace(/^m\./, '');
        let id = null;
        if (h === 'youtu.be')
            id = x.pathname.slice(1).split('/')[0];
        else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
            if (x.pathname === '/watch')
                id = x.searchParams.get('v');
            else {
                const m = x.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/);
                if (m)
                    id = m[2];
            }
        }
        return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    catch {
        return null;
    }
}
async function readCommon(kind, b) {
    const title_en = str(b.title_en, 255);
    if (!title_en)
        return { error: 'Please enter the title in English.' };
    const d = str(b.item_date, 10);
    if (d && !isYmd(d))
        return { error: 'The date is not valid.' };
    const category_id = str(b.category_id, 36) || null;
    if (category_id) {
        const [r] = await pool.query('SELECT id FROM discover_categories WHERE id = ? AND kind = ? LIMIT 1', [category_id, kind]);
        if (!r.length)
            return { error: 'Choose a category from the list.' };
    }
    return {
        v: {
            title_en, title_ta: str(b.title_ta, 255) || null, category_id, item_date: d || null,
            status: b.status === 'published' ? 'published' : 'draft', sort_order: Math.floor(Number(b.sort_order) || 0),
        },
    };
}
const ORDER = 'ORDER BY x.sort_order ASC, x.item_date DESC, x.created_at DESC';
const DATE = `DATE_FORMAT(x.item_date,'%Y-%m-%d') AS item_date`;
const SEL = {
    audio: `SELECT x.id, x.kind, x.category_id, c.name_en AS category_en, c.name_ta AS category_ta, x.title_en, x.title_ta, x.audio_url, x.cover_url, ${DATE}, x.status, x.sort_order,
          (SELECT COUNT(*) FROM discover_audio_classes k WHERE k.audio_id = x.id) AS class_count
          FROM discover_audio x LEFT JOIN discover_categories c ON c.id = x.category_id`,
    video: `SELECT x.id, x.kind, x.category_id, c.name_en AS category_en, c.name_ta AS category_ta, x.title_en, x.title_ta, x.youtube_id, x.youtube_url, ${DATE}, x.status, x.sort_order,
          (SELECT COUNT(*) FROM discover_video_classes k WHERE k.video_id = x.id) AS class_count,
          (SELECT k.youtube_id FROM discover_video_classes k WHERE k.video_id = x.id ORDER BY k.sort_order ASC, k.created_at ASC LIMIT 1) AS first_youtube_id
          FROM discover_video x LEFT JOIN discover_categories c ON c.id = x.category_id`,
    album: `SELECT x.id, x.category_id, c.name_en AS category_en, c.name_ta AS category_ta, x.title_en, x.title_ta, x.cover_url, COALESCE(x.cover_thumb_url, x.cover_url) AS cover_thumb_url, ${DATE}, x.status, x.sort_order,
          (SELECT COUNT(*) FROM discover_album_photos p WHERE p.album_id = x.id) AS photo_count
          FROM discover_albums x LEFT JOIN discover_categories c ON c.id = x.category_id`,
};
const num = (r) => ({
    ...r,
    photo_count: r.photo_count !== undefined ? Number(r.photo_count) : undefined,
    class_count: r.class_count !== undefined ? Number(r.class_count) : undefined,
});
// =================== ADMIN: CATEGORIES ===================
router.get('/admin/categories', adminGuard, async (req, res) => {
    try {
        const kind = String(req.query.kind || '');
        if (!isKind(kind))
            return res.status(400).json({ message: 'Invalid kind' });
        const [rows] = await pool.query(`SELECT c.id, c.kind, c.name_en, c.name_ta, c.sort_order, (SELECT COUNT(*) FROM ${TABLE[kind]} t WHERE t.category_id = c.id) AS items
       FROM discover_categories c WHERE c.kind = ? ORDER BY c.sort_order ASC, c.name_en ASC`, [kind]);
        return res.json({ categories: rows.map((r) => ({ ...r, items: Number(r.items) || 0 })) });
    }
    catch (e) {
        return fail(res, e, 'Failed to load categories');
    }
});
function readCat(b) {
    const name_en = str(b.name_en, 150);
    if (!name_en)
        return { error: 'Please enter the category name in English.' };
    return { v: { name_en, name_ta: str(b.name_ta, 150) || null, sort_order: Math.floor(Number(b.sort_order) || 0) } };
}
router.post('/admin/categories', adminGuard, async (req, res) => {
    try {
        const kind = String(req.body?.kind || '');
        if (!isKind(kind))
            return res.status(400).json({ message: 'Invalid kind' });
        const r = readCat(req.body || {});
        if (r.error)
            return res.status(400).json({ message: r.error });
        const id = crypto.randomUUID();
        await pool.query('INSERT INTO discover_categories (id, kind, name_en, name_ta, sort_order) VALUES (?,?,?,?,?)', [id, kind, r.v.name_en, r.v.name_ta, r.v.sort_order]);
        return res.status(201).json({ id });
    }
    catch (e) {
        return fail(res, e, 'Could not save the category.');
    }
});
router.put('/admin/categories/:id', adminGuard, async (req, res) => {
    try {
        const r = readCat(req.body || {});
        if (r.error)
            return res.status(400).json({ message: r.error });
        await pool.query('UPDATE discover_categories SET name_en=?, name_ta=?, sort_order=? WHERE id=?', [r.v.name_en, r.v.name_ta, r.v.sort_order, pid(req.params.id)]);
        return res.json({ saved: true });
    }
    catch (e) {
        return fail(res, e, 'Could not save the category.');
    }
});
// Items of a deleted category stay and become "no category"
router.delete('/admin/categories/:id', adminGuard, async (req, res) => {
    try {
        const id = pid(req.params.id);
        const [c] = await pool.query('SELECT kind FROM discover_categories WHERE id = ? LIMIT 1', [id]);
        if (!c.length)
            return res.json({ removed: true });
        await pool.query(`UPDATE ${TABLE[c[0].kind]} SET category_id = NULL WHERE category_id = ?`, [id]);
        await pool.query('DELETE FROM discover_categories WHERE id = ?', [id]);
        return res.json({ removed: true });
    }
    catch (e) {
        return fail(res, e, 'Could not delete the category.');
    }
});
// Status change for all three kinds
[['audio', 'audio'], ['video', 'video'], ['albums', 'album']].forEach(([route, kind]) => {
    router.patch(`/admin/${route}/:id/status`, adminGuard, async (req, res) => {
        try {
            if (!['draft', 'published'].includes(req.body?.status))
                return res.status(400).json({ message: 'Invalid status' });
            await pool.query(`UPDATE ${TABLE[kind]} SET status = ? WHERE id = ?`, [req.body.status, pid(req.params.id)]);
            return res.json({ saved: true });
        }
        catch (e) {
            return fail(res, e, 'Could not change the status.');
        }
    });
});
// =================== ADMIN: AUDIO (single file or a series of classes) ===================
router.get('/admin/audio', adminGuard, async (_req, res) => {
    try {
        const [rows] = await pool.query(`${SEL.audio} ${ORDER} LIMIT 1000`);
        return res.json({ items: rows.map(num) });
    }
    catch (e) {
        return fail(res, e, 'Failed to load audio');
    }
});
router.post('/admin/audio', adminGuard, runUpload, async (req, res) => {
    const files = filesOf(req);
    try {
        const r = await readCommon('audio', req.body || {});
        if (r.error) {
            dropNew(files);
            return res.status(400).json({ message: r.error });
        }
        const series = req.body?.kind === 'series';
        if (!series && !files.audio?.[0]) {
            dropNew(files);
            return res.status(400).json({ message: 'Please upload the audio file.' });
        }
        if (series && files.audio?.[0])
            rmUrl(urlOf(files.audio[0])); // a series keeps its audio in its classes
        const v = r.v, id = crypto.randomUUID();
        const cover = files.cover?.[0] ? await coverCopy(files.cover[0]) : null;
        await pool.query(`INSERT INTO discover_audio (id, kind, category_id, title_en, title_ta, audio_url, cover_url, item_date, status, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)`, [id, series ? 'series' : 'single', v.category_id, v.title_en, v.title_ta, series ? null : urlOf(files.audio[0]), cover, v.item_date, v.status, v.sort_order]);
        return res.status(201).json({ id });
    }
    catch (e) {
        dropNew(files);
        return fail(res, e, 'Could not save the audio.');
    }
});
router.put('/admin/audio/:id', adminGuard, runUpload, async (req, res) => {
    const files = filesOf(req);
    try {
        const id = pid(req.params.id);
        const r = await readCommon('audio', req.body || {});
        if (r.error) {
            dropNew(files);
            return res.status(400).json({ message: r.error });
        }
        const [cur] = await pool.query('SELECT kind, audio_url, cover_url FROM discover_audio WHERE id = ? LIMIT 1', [id]);
        if (!cur.length) {
            dropNew(files);
            return res.status(404).json({ message: 'Audio not found' });
        }
        let audio = cur[0].audio_url, cover = cur[0].cover_url;
        if (cur[0].kind === 'single' && files.audio?.[0]) {
            rmUrl(audio);
            audio = urlOf(files.audio[0]);
        }
        else if (files.audio?.[0])
            rmUrl(urlOf(files.audio[0]));
        if (files.cover?.[0]) {
            rmUrl(cover);
            cover = await coverCopy(files.cover[0]);
        }
        else if (req.body?.remove_cover === 'true') {
            rmUrl(cover);
            cover = null;
        }
        const v = r.v;
        await pool.query(`UPDATE discover_audio SET category_id=?, title_en=?, title_ta=?, audio_url=?, cover_url=?, item_date=?, status=?, sort_order=? WHERE id=?`, [v.category_id, v.title_en, v.title_ta, audio, cover, v.item_date, v.status, v.sort_order, id]);
        return res.json({ saved: true });
    }
    catch (e) {
        dropNew(files);
        return fail(res, e, 'Could not save the audio.');
    }
});
router.delete('/admin/audio/:id', adminGuard, async (req, res) => {
    try {
        const id = pid(req.params.id);
        const [cur] = await pool.query('SELECT audio_url, cover_url FROM discover_audio WHERE id = ? LIMIT 1', [id]);
        const [cls] = await pool.query('SELECT audio_url FROM discover_audio_classes WHERE audio_id = ?', [id]);
        await pool.query('DELETE FROM discover_audio_classes WHERE audio_id = ?', [id]);
        await pool.query('DELETE FROM discover_audio WHERE id = ?', [id]);
        if (cur[0])
            rmMany(cur[0].audio_url, cur[0].cover_url);
        cls.forEach((c) => rmUrl(c.audio_url));
        return res.json({ removed: true });
    }
    catch (e) {
        return fail(res, e, 'Could not delete the audio.');
    }
});
// ----- Classes of an audio series -----
const CLS = `SELECT id, audio_id, title_en, title_ta, audio_url, DATE_FORMAT(class_date,'%Y-%m-%d') AS class_date, sort_order FROM discover_audio_classes`;
router.get('/admin/audio/:id/classes', adminGuard, async (req, res) => {
    try {
        const [rows] = await pool.query(`${CLS} WHERE audio_id = ? ORDER BY sort_order ASC, created_at ASC`, [pid(req.params.id)]);
        return res.json({ classes: rows });
    }
    catch (e) {
        return fail(res, e, 'Failed to load the classes');
    }
});
function readClass(b) {
    const d = str(b.class_date, 10);
    if (d && !isYmd(d))
        return { error: 'The date is not valid.' };
    return { v: { title_en: str(b.title_en, 255), title_ta: str(b.title_ta, 255) || null, class_date: d || null } };
}
router.post('/admin/audio/:id/classes', adminGuard, runUpload, async (req, res) => {
    const files = filesOf(req);
    try {
        const id = pid(req.params.id);
        const [p] = await pool.query(`SELECT kind FROM discover_audio WHERE id = ? LIMIT 1`, [id]);
        if (!p.length) {
            dropNew(files);
            return res.status(404).json({ message: 'Audio not found' });
        }
        if (p[0].kind !== 'series') {
            dropNew(files);
            return res.status(400).json({ message: 'Classes can be added only to a Regular classes audio.' });
        }
        const r = readClass(req.body || {});
        if (r.error) {
            dropNew(files);
            return res.status(400).json({ message: r.error });
        }
        if (!files.audio?.[0]) {
            dropNew(files);
            return res.status(400).json({ message: 'Please upload the audio file for this class.' });
        }
        const [m] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS n FROM discover_audio_classes WHERE audio_id = ?', [id]);
        const n = (Number(m[0]?.n) || 0) + 1;
        const title = r.v.title_en || `Class ${n}`;
        const cid = crypto.randomUUID();
        await pool.query(`INSERT INTO discover_audio_classes (id, audio_id, title_en, title_ta, audio_url, class_date, sort_order) VALUES (?,?,?,?,?,?,?)`, [cid, id, title, r.v.title_ta, urlOf(files.audio[0]), r.v.class_date, n]);
        return res.status(201).json({ id: cid });
    }
    catch (e) {
        dropNew(files);
        return fail(res, e, 'Could not save the class.');
    }
});
router.put('/admin/audio-classes/:classId', adminGuard, runUpload, async (req, res) => {
    const files = filesOf(req);
    try {
        const cid = pid(req.params.classId);
        const r = readClass(req.body || {});
        if (r.error) {
            dropNew(files);
            return res.status(400).json({ message: r.error });
        }
        const [cur] = await pool.query('SELECT audio_url, sort_order FROM discover_audio_classes WHERE id = ? LIMIT 1', [cid]);
        if (!cur.length) {
            dropNew(files);
            return res.status(404).json({ message: 'Class not found' });
        }
        let audio = cur[0].audio_url;
        if (files.audio?.[0]) {
            rmUrl(audio);
            audio = urlOf(files.audio[0]);
        }
        const title = r.v.title_en || `Class ${cur[0].sort_order}`;
        await pool.query('UPDATE discover_audio_classes SET title_en=?, title_ta=?, audio_url=?, class_date=? WHERE id=?', [title, r.v.title_ta, audio, r.v.class_date, cid]);
        return res.json({ saved: true });
    }
    catch (e) {
        dropNew(files);
        return fail(res, e, 'Could not save the class.');
    }
});
router.delete('/admin/audio-classes/:classId', adminGuard, async (req, res) => {
    try {
        const cid = pid(req.params.classId);
        const [cur] = await pool.query('SELECT audio_url FROM discover_audio_classes WHERE id = ? LIMIT 1', [cid]);
        await pool.query('DELETE FROM discover_audio_classes WHERE id = ?', [cid]);
        if (cur[0])
            rmUrl(cur[0].audio_url);
        return res.json({ removed: true });
    }
    catch (e) {
        return fail(res, e, 'Could not delete the class.');
    }
});
// =================== ADMIN: VIDEO (YouTube link only; single or a series of classes) ===================
router.get('/admin/video', adminGuard, async (_req, res) => {
    try {
        const [rows] = await pool.query(`${SEL.video} ${ORDER} LIMIT 1000`);
        return res.json({ items: rows.map(num) });
    }
    catch (e) {
        return fail(res, e, 'Failed to load videos');
    }
});
router.post('/admin/video', adminGuard, async (req, res) => {
    try {
        const r = await readCommon('video', req.body || {});
        if (r.error)
            return res.status(400).json({ message: r.error });
        const series = req.body?.kind === 'series';
        let link = null, yid = null;
        if (!series) {
            link = str(req.body?.youtube_url, 300);
            yid = ytId(link);
            if (!yid)
                return res.status(400).json({ message: 'Please paste a valid YouTube link.' });
        }
        const v = r.v, id = crypto.randomUUID();
        await pool.query(`INSERT INTO discover_video (id, kind, category_id, title_en, title_ta, youtube_id, youtube_url, item_date, status, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)`, [id, series ? 'series' : 'single', v.category_id, v.title_en, v.title_ta, yid, link, v.item_date, v.status, v.sort_order]);
        return res.status(201).json({ id });
    }
    catch (e) {
        return fail(res, e, 'Could not save the video.');
    }
});
router.put('/admin/video/:id', adminGuard, async (req, res) => {
    try {
        const id = pid(req.params.id);
        const r = await readCommon('video', req.body || {});
        if (r.error)
            return res.status(400).json({ message: r.error });
        const [cur] = await pool.query('SELECT kind, youtube_id, youtube_url FROM discover_video WHERE id = ? LIMIT 1', [id]);
        if (!cur.length)
            return res.status(404).json({ message: 'Video not found' });
        let link = cur[0].youtube_url, yid = cur[0].youtube_id;
        if (cur[0].kind === 'single') {
            link = str(req.body?.youtube_url, 300);
            yid = ytId(link);
            if (!yid)
                return res.status(400).json({ message: 'Please paste a valid YouTube link.' });
        }
        const v = r.v;
        await pool.query(`UPDATE discover_video SET category_id=?, title_en=?, title_ta=?, youtube_id=?, youtube_url=?, item_date=?, status=?, sort_order=? WHERE id=?`, [v.category_id, v.title_en, v.title_ta, yid, link, v.item_date, v.status, v.sort_order, id]);
        return res.json({ saved: true });
    }
    catch (e) {
        return fail(res, e, 'Could not save the video.');
    }
});
router.delete('/admin/video/:id', adminGuard, async (req, res) => {
    try {
        const id = pid(req.params.id);
        await pool.query('DELETE FROM discover_video_classes WHERE video_id = ?', [id]);
        await pool.query('DELETE FROM discover_video WHERE id = ?', [id]);
        return res.json({ removed: true });
    }
    catch (e) {
        return fail(res, e, 'Could not delete the video.');
    }
});
// ----- Classes of a video series -----
const VCLS = `SELECT id, video_id, title_en, title_ta, youtube_id, youtube_url, DATE_FORMAT(class_date,'%Y-%m-%d') AS class_date, sort_order FROM discover_video_classes`;
router.get('/admin/video/:id/classes', adminGuard, async (req, res) => {
    try {
        const [rows] = await pool.query(`${VCLS} WHERE video_id = ? ORDER BY sort_order ASC, created_at ASC`, [pid(req.params.id)]);
        return res.json({ classes: rows });
    }
    catch (e) {
        return fail(res, e, 'Failed to load the classes');
    }
});
router.post('/admin/video/:id/classes', adminGuard, async (req, res) => {
    try {
        const id = pid(req.params.id);
        const [p] = await pool.query('SELECT kind FROM discover_video WHERE id = ? LIMIT 1', [id]);
        if (!p.length)
            return res.status(404).json({ message: 'Video not found' });
        if (p[0].kind !== 'series')
            return res.status(400).json({ message: 'Classes can be added only to a Regular classes video.' });
        const r = readClass(req.body || {});
        if (r.error)
            return res.status(400).json({ message: r.error });
        const link = str(req.body?.youtube_url, 300);
        const yid = ytId(link);
        if (!yid)
            return res.status(400).json({ message: 'Please paste a valid YouTube link for this class.' });
        const [m] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS n FROM discover_video_classes WHERE video_id = ?', [id]);
        const n = (Number(m[0]?.n) || 0) + 1;
        const cid = crypto.randomUUID();
        await pool.query(`INSERT INTO discover_video_classes (id, video_id, title_en, title_ta, youtube_id, youtube_url, class_date, sort_order) VALUES (?,?,?,?,?,?,?,?)`, [cid, id, r.v.title_en || `Class ${n}`, r.v.title_ta, yid, link, r.v.class_date, n]);
        return res.status(201).json({ id: cid });
    }
    catch (e) {
        return fail(res, e, 'Could not save the class.');
    }
});
router.put('/admin/video-classes/:classId', adminGuard, async (req, res) => {
    try {
        const cid = pid(req.params.classId);
        const r = readClass(req.body || {});
        if (r.error)
            return res.status(400).json({ message: r.error });
        const [cur] = await pool.query('SELECT sort_order FROM discover_video_classes WHERE id = ? LIMIT 1', [cid]);
        if (!cur.length)
            return res.status(404).json({ message: 'Class not found' });
        const link = str(req.body?.youtube_url, 300);
        const yid = ytId(link);
        if (!yid)
            return res.status(400).json({ message: 'Please paste a valid YouTube link.' });
        await pool.query('UPDATE discover_video_classes SET title_en=?, title_ta=?, youtube_id=?, youtube_url=?, class_date=? WHERE id=?', [r.v.title_en || `Class ${cur[0].sort_order}`, r.v.title_ta, yid, link, r.v.class_date, cid]);
        return res.json({ saved: true });
    }
    catch (e) {
        return fail(res, e, 'Could not save the class.');
    }
});
router.delete('/admin/video-classes/:classId', adminGuard, async (req, res) => {
    try {
        await pool.query('DELETE FROM discover_video_classes WHERE id = ?', [pid(req.params.classId)]);
        return res.json({ removed: true });
    }
    catch (e) {
        return fail(res, e, 'Could not delete the class.');
    }
});
// =================== ADMIN: ALBUMS ===================
const PHOTO_COLS = 'id, image_url, COALESCE(web_url, image_url) AS web_url, COALESCE(thumb_url, image_url) AS thumb_url, sort_order';
router.get('/admin/albums', adminGuard, async (_req, res) => {
    try {
        const [rows] = await pool.query(`${SEL.album} ${ORDER} LIMIT 1000`);
        return res.json({ items: rows.map(num) });
    }
    catch (e) {
        return fail(res, e, 'Failed to load albums');
    }
});
router.get('/admin/albums/:id', adminGuard, async (req, res) => {
    try {
        const [p] = await pool.query(`SELECT ${PHOTO_COLS} FROM discover_album_photos WHERE album_id = ? ORDER BY sort_order ASC, created_at ASC`, [pid(req.params.id)]);
        return res.json({ photos: p });
    }
    catch (e) {
        return fail(res, e, 'Failed to load photos');
    }
});
// Saves each photo with its web copy and thumbnail. Returns the first photo (for the cover).
async function addPhotos(albumId, list) {
    const [m] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS n FROM discover_album_photos WHERE album_id = ?', [albumId]);
    let n = Number(m[0]?.n) || 0;
    let first = null;
    for (const f of list) {
        n += 1;
        const u = urlOf(f);
        const copies = await makeCopies(f);
        if (!first)
            first = { url: u, thumb: copies.thumb };
        await pool.query('INSERT INTO discover_album_photos (id, album_id, image_url, web_url, thumb_url, sort_order) VALUES (?,?,?,?,?,?)', [crypto.randomUUID(), albumId, u, copies.web, copies.thumb, n]);
    }
    return first;
}
router.post('/admin/albums', adminGuard, runUpload, async (req, res) => {
    const files = filesOf(req);
    try {
        const r = await readCommon('album', req.body || {});
        if (r.error) {
            dropNew(files);
            return res.status(400).json({ message: r.error });
        }
        if (!files.photos?.length) {
            dropNew(files);
            return res.status(400).json({ message: 'Please add at least one photo.' });
        }
        const v = r.v, id = crypto.randomUUID();
        await pool.query(`INSERT INTO discover_albums (id, category_id, title_en, title_ta, cover_url, cover_thumb_url, item_date, status, sort_order) VALUES (?,?,?,?,?,?,?,?,?)`, [id, v.category_id, v.title_en, v.title_ta, null, null, v.item_date, v.status, v.sort_order]);
        const first = await addPhotos(id, files.photos);
        await pool.query('UPDATE discover_albums SET cover_url = ?, cover_thumb_url = ? WHERE id = ?', [first?.url || null, first?.thumb || null, id]);
        return res.status(201).json({ id });
    }
    catch (e) {
        dropNew(files);
        return fail(res, e, 'Could not save the album.');
    }
});
router.put('/admin/albums/:id', adminGuard, async (req, res) => {
    try {
        const r = await readCommon('album', req.body || {});
        if (r.error)
            return res.status(400).json({ message: r.error });
        const v = r.v;
        await pool.query(`UPDATE discover_albums SET category_id=?, title_en=?, title_ta=?, item_date=?, status=?, sort_order=? WHERE id=?`, [v.category_id, v.title_en, v.title_ta, v.item_date, v.status, v.sort_order, pid(req.params.id)]);
        return res.json({ saved: true });
    }
    catch (e) {
        return fail(res, e, 'Could not save the album.');
    }
});
router.post('/admin/albums/:id/photos', adminGuard, runUpload, async (req, res) => {
    const files = filesOf(req);
    try {
        const albumId = pid(req.params.id);
        if (!files.photos?.length) {
            dropNew(files);
            return res.status(400).json({ message: 'Choose at least one photo.' });
        }
        const [a] = await pool.query('SELECT cover_url FROM discover_albums WHERE id = ? LIMIT 1', [albumId]);
        if (!a.length) {
            dropNew(files);
            return res.status(404).json({ message: 'Album not found' });
        }
        const first = await addPhotos(albumId, files.photos);
        if (!a[0].cover_url && first)
            await pool.query('UPDATE discover_albums SET cover_url = ?, cover_thumb_url = ? WHERE id = ?', [first.url, first.thumb, albumId]);
        return res.json({ added: files.photos.length });
    }
    catch (e) {
        dropNew(files);
        return fail(res, e, 'Could not add the photos.');
    }
});
router.delete('/admin/albums/:id/photos/:photoId', adminGuard, async (req, res) => {
    try {
        const albumId = pid(req.params.id), photoId = pid(req.params.photoId);
        const [p] = await pool.query('SELECT image_url, web_url, thumb_url FROM discover_album_photos WHERE id = ? AND album_id = ? LIMIT 1', [photoId, albumId]);
        if (!p.length)
            return res.json({ removed: true });
        await pool.query('DELETE FROM discover_album_photos WHERE id = ?', [photoId]);
        rmMany(p[0].image_url, p[0].web_url, p[0].thumb_url);
        const [a] = await pool.query('SELECT cover_url FROM discover_albums WHERE id = ? LIMIT 1', [albumId]);
        if (a[0]?.cover_url === p[0].image_url) {
            const [n] = await pool.query('SELECT image_url, COALESCE(thumb_url, image_url) AS thumb_url FROM discover_album_photos WHERE album_id = ? ORDER BY sort_order ASC LIMIT 1', [albumId]);
            await pool.query('UPDATE discover_albums SET cover_url = ?, cover_thumb_url = ? WHERE id = ?', [n[0]?.image_url || null, n[0]?.thumb_url || null, albumId]);
        }
        return res.json({ removed: true });
    }
    catch (e) {
        return fail(res, e, 'Could not remove the photo.');
    }
});
router.patch('/admin/albums/:id/cover', adminGuard, async (req, res) => {
    try {
        const albumId = pid(req.params.id);
        const [p] = await pool.query('SELECT image_url, COALESCE(thumb_url, image_url) AS thumb_url FROM discover_album_photos WHERE id = ? AND album_id = ? LIMIT 1', [str(req.body?.photoId, 36), albumId]);
        if (!p.length)
            return res.status(404).json({ message: 'Photo not found' });
        await pool.query('UPDATE discover_albums SET cover_url = ?, cover_thumb_url = ? WHERE id = ?', [p[0].image_url, p[0].thumb_url, albumId]);
        return res.json({ saved: true });
    }
    catch (e) {
        return fail(res, e, 'Could not set the cover.');
    }
});
router.delete('/admin/albums/:id', adminGuard, async (req, res) => {
    try {
        const id = pid(req.params.id);
        const [p] = await pool.query('SELECT image_url, web_url, thumb_url FROM discover_album_photos WHERE album_id = ?', [id]);
        await pool.query('DELETE FROM discover_album_photos WHERE album_id = ?', [id]);
        await pool.query('DELETE FROM discover_albums WHERE id = ?', [id]);
        p.forEach((x) => rmMany(x.image_url, x.web_url, x.thumb_url));
        return res.json({ removed: true });
    }
    catch (e) {
        return fail(res, e, 'Could not delete the album.');
    }
});
// =================== PUBLIC (for the website, next step) ===================
router.get('/categories', async (req, res) => {
    try {
        const kind = String(req.query.kind || '');
        if (!isKind(kind))
            return res.status(400).json({ categories: [] });
        const [rows] = await pool.query(`SELECT c.id, c.name_en, c.name_ta FROM discover_categories c
       WHERE c.kind = ? AND EXISTS (SELECT 1 FROM ${TABLE[kind]} t WHERE t.category_id = c.id AND t.status = 'published')
       ORDER BY c.sort_order ASC, c.name_en ASC`, [kind]);
        return res.json({ categories: rows });
    }
    catch {
        return res.status(500).json({ categories: [] });
    }
});
[['audio', 'audio'], ['video', 'video'], ['albums', 'album']].forEach(([route, kind]) => {
    router.get(`/${route}`, async (req, res) => {
        try {
            const cat = str(req.query.category, 36);
            const [rows] = await pool.query(`${SEL[kind]} WHERE x.status = 'published' ${cat ? 'AND x.category_id = ?' : ''} ${ORDER} LIMIT 500`, cat ? [cat] : []);
            return res.json({ items: rows.map(num) });
        }
        catch {
            return res.status(500).json({ items: [] });
        }
    });
});
// The classes of a published series
router.get('/audio/:id/classes', async (req, res) => {
    try {
        const id = pid(req.params.id);
        const [a] = await pool.query(`SELECT id FROM discover_audio WHERE id = ? AND kind = 'series' AND status = 'published' LIMIT 1`, [id]);
        if (!a.length)
            return res.status(404).json({ classes: [] });
        const [rows] = await pool.query(`${CLS} WHERE audio_id = ? ORDER BY sort_order ASC, created_at ASC`, [id]);
        return res.json({ classes: rows });
    }
    catch {
        return res.status(500).json({ classes: [] });
    }
});
router.get('/video/:id/classes', async (req, res) => {
    try {
        const id = pid(req.params.id);
        const [a] = await pool.query(`SELECT id FROM discover_video WHERE id = ? AND kind = 'series' AND status = 'published' LIMIT 1`, [id]);
        if (!a.length)
            return res.status(404).json({ classes: [] });
        const [rows] = await pool.query(`${VCLS} WHERE video_id = ? ORDER BY sort_order ASC, created_at ASC`, [id]);
        return res.json({ classes: rows });
    }
    catch {
        return res.status(500).json({ classes: [] });
    }
});
// Public album: the grid uses thumb_url, the viewer uses web_url
router.get('/albums/:id', async (req, res) => {
    try {
        const id = pid(req.params.id);
        const [a] = await pool.query(`${SEL.album} WHERE x.id = ? AND x.status = 'published' LIMIT 1`, [id]);
        if (!a.length)
            return res.status(404).json({ message: 'Album not found' });
        const [p] = await pool.query('SELECT id, COALESCE(web_url, image_url) AS web_url, COALESCE(thumb_url, image_url) AS thumb_url FROM discover_album_photos WHERE album_id = ? ORDER BY sort_order ASC', [id]);
        return res.json({ album: num(a[0]), photos: p });
    }
    catch {
        return res.status(500).json({ message: 'Failed to load the album' });
    }
});
export default router;
