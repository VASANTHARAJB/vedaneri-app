import { Router, Request, Response, NextFunction, json as jsonBody } from 'express';
import { pool } from '../db';
import { db } from '../dbLimit';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

// Point of sale for the ashram shop: items, suppliers, stock in (purchases), billing, stock adjustments, and reports.
// Stock is never stored as a number that can drift: every change (purchase, sale, cancel, adjustment) is a line in pos_stock_moves,
// and the stock of an item is the sum of its lines. Bills and purchases are never deleted, only cancelled, so the numbers run without a gap.
// Prices are the selling prices the customer pays (GST included); the GST inside a bill is worked out from each item's GST percent.
// The tables are created by this file on first use; pos-tables.sql holds the same definitions in case the database user cannot create tables.
const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const dbg = (e: any) => (IS_PROD ? undefined : e?.sqlMessage || e?.message || String(e));
const fail = (res: Response, e: any, message: string) => {
  console.error(`POS: ${message}`, e?.sqlMessage || e?.message || e);
  return res.status(500).json({ message, detail: dbg(e) });
};
const adminGuard = (req: Request, res: Response, next: NextFunction) => authenticate(req as AuthenticatedRequest, res, next);
router.use(adminGuard);
router.use(jsonBody({ limit: '300kb' }));
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// ---------- helpers ----------
class Bad extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDay = (d: string) => DAY.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
const one = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const r2 = (v: any) => Math.round(Number(v || 0) * 100) / 100;
const r3 = (v: any) => Math.round(Number(v || 0) * 1000) / 1000;
const pad2 = (n: number) => String(n).padStart(2, '0');
const dateOnly = (d: any) => (d instanceof Date ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : d ? String(d).slice(0, 10) : null);
const stamp = (d: any) => (d instanceof Date ? d.toISOString() : d ? String(d) : null);
const who = (req: Request) => cut(String((req as any).user?.email ?? (req as any).user?.id ?? (req as any).user?.username ?? 'admin'), 100) || 'admin';
const idOf = (v: unknown) => { const s = String(v ?? ''); return /^\d{1,12}$/.test(s) && Number(s) > 0 ? Number(s) : null; };
const fyOf = (day: string) => { const y = +day.slice(0, 4), m = +day.slice(5, 7); const a = m >= 4 ? y : y - 1; return `${pad2(a % 100)}${pad2((a + 1) % 100)}`; };
const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const wrap = (message: string, fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
  try { await fn(req, res); } catch (e: any) {
    if (e instanceof Bad) return res.status(e.status).json({ message: e.message });
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'That value is already used.' });
    return fail(res, e, message);
  }
};

// ---------- tables ----------
const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS pos_items (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT, sku VARCHAR(40) NOT NULL, barcode VARCHAR(60) NULL, name VARCHAR(200) NOT NULL,
    category VARCHAR(80) NOT NULL DEFAULT '', unit VARCHAR(20) NOT NULL DEFAULT 'pcs', price DECIMAL(12,2) NOT NULL, cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    gst_percent DECIMAL(5,2) NOT NULL DEFAULT 0, track_stock TINYINT(1) NOT NULL DEFAULT 1, reorder_level DECIMAL(12,3) NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uq_pos_sku (sku), KEY ix_pos_barcode (barcode), KEY ix_pos_name (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pos_suppliers (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(200) NOT NULL, phone VARCHAR(30) NULL, email VARCHAR(150) NULL, address VARCHAR(500) NULL,
    gstin VARCHAR(20) NULL, notes VARCHAR(500) NULL, active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), KEY ix_pos_sup_name (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pos_categories (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(80) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uq_pos_cat (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pos_counters (series VARCHAR(30) NOT NULL, last_serial INT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (series)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pos_stock_moves (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, item_id INT UNSIGNED NOT NULL, qty DECIMAL(12,3) NOT NULL, kind VARCHAR(14) NOT NULL, ref_id BIGINT UNSIGNED NULL,
    note VARCHAR(255) NULL, created_by VARCHAR(100) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), KEY ix_pos_move_item (item_id, created_at), KEY ix_pos_move_kind (kind, ref_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pos_purchases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, bill_no VARCHAR(30) NOT NULL, supplier_id INT UNSIGNED NULL, supplier_bill VARCHAR(60) NULL, purchase_date DATE NOT NULL,
    total DECIMAL(12,2) NOT NULL, notes VARCHAR(500) NULL, status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE', cancel_reason VARCHAR(255) NULL, created_by VARCHAR(100) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id), UNIQUE KEY uq_pos_pur_no (bill_no), KEY ix_pos_pur_date (purchase_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pos_purchase_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, purchase_id BIGINT UNSIGNED NOT NULL, item_id INT UNSIGNED NOT NULL, qty DECIMAL(12,3) NOT NULL, cost DECIMAL(12,2) NOT NULL,
    amount DECIMAL(12,2) NOT NULL, PRIMARY KEY (id), KEY ix_pos_pl_purchase (purchase_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pos_sales (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, bill_no VARCHAR(30) NOT NULL, sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, customer_name VARCHAR(200) NULL,
    phone VARCHAR(30) NULL, subtotal DECIMAL(12,2) NOT NULL, discount DECIMAL(12,2) NOT NULL DEFAULT 0, gst_total DECIMAL(12,2) NOT NULL DEFAULT 0, total DECIMAL(12,2) NOT NULL,
    pay_mode VARCHAR(12) NOT NULL DEFAULT 'cash', pay_ref VARCHAR(100) NULL, notes VARCHAR(500) NULL, status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE', cancel_reason VARCHAR(255) NULL,
    created_by VARCHAR(100) NULL, PRIMARY KEY (id), UNIQUE KEY uq_pos_sale_no (bill_no), KEY ix_pos_sale_date (sale_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS pos_sale_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, sale_id BIGINT UNSIGNED NOT NULL, item_id INT UNSIGNED NOT NULL, name VARCHAR(200) NOT NULL, unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
    qty DECIMAL(12,3) NOT NULL, price DECIMAL(12,2) NOT NULL, cost DECIMAL(12,2) NOT NULL DEFAULT 0, gst_percent DECIMAL(5,2) NOT NULL DEFAULT 0, amount DECIMAL(12,2) NOT NULL,
    PRIMARY KEY (id), KEY ix_pos_sl_sale (sale_id), KEY ix_pos_sl_item (item_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];
const HELP = 'The point-of-sale tables could not be created. Ask your host to let the database user create tables, or run pos-tables.sql once in phpMyAdmin.';
let ready: Promise<void> | null = null;
const ensure = () => {
  if (!ready) ready = (async () => { for (const s of DDL) await db.query(s); })().catch((e) => { ready = null; console.error('POS:', HELP, e?.sqlMessage || e?.message || e); throw new Bad(HELP, 500); });
  return ready;
};
router.use(async (_req, res, next) => { try { await ensure(); next(); } catch (e: any) { res.status(e?.status || 500).json({ message: e?.message || HELP }); } });

// One database connection for the whole of a sale or purchase, so stock and bill are saved together or not at all
async function tx<T>(fn: (c: any) => Promise<T>): Promise<T> {
  const c = await (pool as any).getConnection();
  try { await c.beginTransaction(); const out = await fn(c); await c.commit(); return out; }
  catch (e) { try { await c.rollback(); } catch { /* connection already lost */ } throw e; }
  finally { c.release(); }
}
// The next number in a series, such as PS-2627-0001. The counter row is locked until the transaction ends, so two bills never share a number.
async function nextNo(c: any, series: string): Promise<string> {
  await c.query('INSERT INTO pos_counters (series, last_serial) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_serial = last_serial + 1', [series]);
  const [[row]]: any = await c.query('SELECT last_serial FROM pos_counters WHERE series = ?', [series]);
  return `${series}-${String(row.last_serial).padStart(4, '0')}`;
}
const STOCK_JOIN = 'LEFT JOIN (SELECT item_id, SUM(qty) q FROM pos_stock_moves GROUP BY item_id) s ON s.item_id = i.id';
const itemOut = (r: any) => ({
  id: Number(r.id), sku: r.sku as string, barcode: (r.barcode || '') as string, name: r.name as string, category: (r.category || '') as string, unit: (r.unit || 'pcs') as string,
  price: r2(r.price), cost: r2(r.cost), gst_percent: r2(r.gst_percent), track_stock: !!r.track_stock, reorder_level: r3(r.reorder_level), active: !!r.active,
  stock: r.stock == null ? 0 : r3(r.stock),
});

// =====================================================================================================
// Categories: a list the shop keeps (so one can exist before any item uses it). Items still carry the category name.
// =====================================================================================================
async function allCategories(): Promise<string[]> {
  const [rows]: any = await db.query("SELECT name FROM pos_categories UNION SELECT DISTINCT category FROM pos_items WHERE category <> '' ORDER BY 1");
  return (rows as any[]).map((r) => String(r.name));
}
const catName = (v: unknown) => {
  const n = cut(v, 80).replace(/\s+/g, ' ');
  if (!n) throw new Bad('Please enter the category name.');
  return n;
};
router.get('/categories', wrap('Could not load the categories.', async (_req, res) => {
  const [rows]: any = await db.query("SELECT n.name, COUNT(i.id) items FROM (SELECT name FROM pos_categories UNION SELECT DISTINCT category FROM pos_items WHERE category <> '') n LEFT JOIN pos_items i ON i.category = n.name GROUP BY n.name ORDER BY n.name");
  res.json({ items: (rows as any[]).map((r) => ({ name: String(r.name), items: Number(r.items) })) });
}));
router.post('/categories', wrap('Could not save the category.', async (req, res) => {
  const name = catName(req.body?.name);
  const [[dup]]: any = await db.query("SELECT 1 x FROM pos_categories WHERE name = ? UNION SELECT 1 FROM pos_items WHERE category = ? LIMIT 1", [name, name]);
  if (dup) throw new Bad(`The category "${name}" already exists.`, 409);
  await db.query('INSERT INTO pos_categories (name) VALUES (?)', [name]);
  res.status(201).json({ name });
}));
router.put('/categories', wrap('Could not rename the category.', async (req, res) => {
  const from = catName(req.body?.from), to = catName(req.body?.to);
  if (from === to) return res.json({ name: to });
  await tx(async (c) => {
    const [[dup]]: any = await c.query('SELECT 1 x FROM pos_categories WHERE name = ? AND name <> ? UNION SELECT 1 FROM pos_items WHERE category = ? AND category <> ? LIMIT 1', [to, from, to, from]);
    if (dup) throw new Bad(`The category "${to}" already exists.`, 409);
    await c.query('DELETE FROM pos_categories WHERE name = ?', [from]);
    await c.query('INSERT IGNORE INTO pos_categories (name) VALUES (?)', [to]);
    await c.query('UPDATE pos_items SET category = ? WHERE category = ?', [to, from]);
  });
  res.json({ name: to });
}));
router.delete('/categories', wrap('Could not delete the category.', async (req, res) => {
  const name = catName(req.query.name);
  const [[used]]: any = await db.query('SELECT COUNT(*) n FROM pos_items WHERE category = ?', [name]);
  if (Number(used.n) > 0) throw new Bad(`${used.n} item${Number(used.n) === 1 ? ' uses' : 's use'} this category. Move ${Number(used.n) === 1 ? 'it' : 'them'} to another category first.`, 409);
  await db.query('DELETE FROM pos_categories WHERE name = ?', [name]);
  res.json({ ok: true });
}));

// =====================================================================================================
// Items
// =====================================================================================================
function cleanItem(b: any) {
  const name = cut(b?.name, 200);
  if (!name) throw new Bad('Please enter the item name.');
  const price = Number(b?.price), cost = Number(b?.cost || 0), gst = Number(b?.gst_percent || 0), reorder = Number(b?.reorder_level || 0);
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) throw new Bad('Please enter a valid selling price.');
  if (!Number.isFinite(cost) || cost < 0 || cost > 10_000_000) throw new Bad('Please enter a valid cost price.');
  if (!Number.isFinite(gst) || gst < 0 || gst > 100) throw new Bad('GST must be between 0 and 100.');
  if (!Number.isFinite(reorder) || reorder < 0 || reorder > 1_000_000) throw new Bad('Please enter a valid re-order level.');
  const sku = cut(b?.sku, 40);
  if (sku && !/^[A-Za-z0-9][A-Za-z0-9._\/-]{0,39}$/.test(sku)) throw new Bad('The item code may use letters, numbers, dot, dash and slash only.');
  return { name, sku, barcode: cut(b?.barcode, 60), category: cut(b?.category, 80), unit: cut(b?.unit, 20) || 'pcs', price: r2(price), cost: r2(cost), gst_percent: r2(gst), reorder_level: r3(reorder), track_stock: b?.track_stock === false ? 0 : 1, active: b?.active === false ? 0 : 1 };
}
router.get('/items', wrap('Could not load the items.', async (req, res) => {
  const where: string[] = [], args: any[] = [];
  const text = one(req.query.q).slice(0, 60);
  if (text) { const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`; where.push('(i.name LIKE ? OR i.sku LIKE ? OR i.barcode LIKE ? OR i.category LIKE ?)'); args.push(like, like, like, like); }
  const cat = one(req.query.category).slice(0, 80);
  if (cat) { where.push('i.category = ?'); args.push(cat); }
  const active = one(req.query.active);
  if (active === '1' || active === '0') { where.push('i.active = ?'); args.push(Number(active)); }
  if (one(req.query.low) === '1') where.push('i.track_stock = 1 AND COALESCE(s.q,0) <= i.reorder_level');
  const [rows]: any = await db.query(`SELECT i.*, COALESCE(s.q,0) stock FROM pos_items i ${STOCK_JOIN} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY i.name ASC LIMIT 2000`, args);
  res.json({ items: (rows as any[]).map(itemOut), categories: await allCategories() });
}));
router.post('/items', wrap('Could not save the item.', async (req, res) => {
  const d = cleanItem(req.body);
  const opening = Number(req.body?.opening_stock || 0);
  if (!Number.isFinite(opening) || opening < 0 || opening > 1_000_000) throw new Bad('Please enter a valid opening stock.');
  const id = await tx(async (c) => {
    // An item without a code gets one: ITM-000123 (taken from the row number)
    const [r]: any = await c.query('INSERT INTO pos_items (sku, barcode, name, category, unit, price, cost, gst_percent, track_stock, reorder_level, active) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [d.sku || `TMP-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, d.barcode || null, d.name, d.category, d.unit, d.price, d.cost, d.gst_percent, d.track_stock, d.reorder_level, d.active]);
    const newId = Number(r.insertId);
    if (d.category) await c.query('INSERT IGNORE INTO pos_categories (name) VALUES (?)', [d.category]);
    if (!d.sku) await c.query('UPDATE pos_items SET sku = ? WHERE id = ?', [`ITM-${String(newId).padStart(6, '0')}`, newId]);
    if (opening > 0 && d.track_stock) await c.query("INSERT INTO pos_stock_moves (item_id, qty, kind, note, created_by, created_at) VALUES (?,?,'OPENING','Opening stock',?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))", [newId, r3(opening), who(req)]);
    return newId;
  });
  res.status(201).json({ id });
}));
router.put('/items/:id', wrap('Could not save the item.', async (req, res) => {
  const id = idOf(req.params.id); if (!id) throw new Bad('Unknown item.');
  const d = cleanItem(req.body);
  if (!d.sku) throw new Bad('The item code cannot be empty.');
  const [r]: any = await db.query('UPDATE pos_items SET sku=?, barcode=?, name=?, category=?, unit=?, price=?, cost=?, gst_percent=?, track_stock=?, reorder_level=?, active=? WHERE id=?',
    [d.sku, d.barcode || null, d.name, d.category, d.unit, d.price, d.cost, d.gst_percent, d.track_stock, d.reorder_level, d.active, id]);
  if (!r.affectedRows) throw new Bad('Item not found.', 404);
  if (d.category) await db.query('INSERT IGNORE INTO pos_categories (name) VALUES (?)', [d.category]);
  res.json({ ok: true });
}));

// =====================================================================================================
// Suppliers
// =====================================================================================================
const supOut = (r: any) => ({ id: Number(r.id), name: r.name as string, phone: (r.phone || '') as string, email: (r.email || '') as string, address: (r.address || '') as string, gstin: (r.gstin || '') as string, notes: (r.notes || '') as string, active: !!r.active, purchases: Number(r.purchases || 0), purchased: r2(r.purchased) });
function cleanSupplier(b: any) {
  const name = cut(b?.name, 200); if (!name) throw new Bad('Please enter the supplier name.');
  const email = cut(b?.email, 150);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Bad('Please enter a valid email address.');
  const gstin = cut(b?.gstin, 20).toUpperCase();
  if (gstin && !/^[0-9A-Z]{15}$/.test(gstin)) throw new Bad('A GSTIN has 15 letters and numbers.');
  return { name, phone: cut(b?.phone, 30), email, address: cut(b?.address, 500), gstin, notes: cut(b?.notes, 500), active: b?.active === false ? 0 : 1 };
}
router.get('/suppliers', wrap('Could not load the suppliers.', async (req, res) => {
  const text = one(req.query.q).slice(0, 60);
  const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const [rows]: any = await db.query(
    `SELECT s.*, COUNT(p.id) purchases, COALESCE(SUM(p.total),0) purchased FROM pos_suppliers s LEFT JOIN pos_purchases p ON p.supplier_id = s.id AND p.status = 'ACTIVE'
     ${text ? 'WHERE s.name LIKE ? OR s.phone LIKE ?' : ''} GROUP BY s.id ORDER BY s.name ASC LIMIT 1000`, text ? [like, like] : []);
  res.json({ items: (rows as any[]).map(supOut) });
}));
router.post('/suppliers', wrap('Could not save the supplier.', async (req, res) => {
  const d = cleanSupplier(req.body);
  const [r]: any = await db.query('INSERT INTO pos_suppliers (name, phone, email, address, gstin, notes, active) VALUES (?,?,?,?,?,?,?)', [d.name, d.phone || null, d.email || null, d.address || null, d.gstin || null, d.notes || null, d.active]);
  res.status(201).json({ id: Number(r.insertId) });
}));
router.put('/suppliers/:id', wrap('Could not save the supplier.', async (req, res) => {
  const id = idOf(req.params.id); if (!id) throw new Bad('Unknown supplier.');
  const d = cleanSupplier(req.body);
  const [r]: any = await db.query('UPDATE pos_suppliers SET name=?, phone=?, email=?, address=?, gstin=?, notes=?, active=? WHERE id=?', [d.name, d.phone || null, d.email || null, d.address || null, d.gstin || null, d.notes || null, d.active, id]);
  if (!r.affectedRows) throw new Bad('Supplier not found.', 404);
  res.json({ ok: true });
}));

// =====================================================================================================
// Stock and adjustments
// =====================================================================================================
const KINDS: Record<string, string> = { OPENING: 'Opening stock', PURCHASE: 'Purchase', PURCHASE_VOID: 'Purchase cancelled', SALE: 'Sale', SALE_VOID: 'Sale cancelled', ADJUST: 'Adjustment' };
router.get('/stock', wrap('Could not load the stock.', async (req, res) => {
  const where: string[] = ['i.track_stock = 1'], args: any[] = [];
  const text = one(req.query.q).slice(0, 60);
  if (text) { const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`; where.push('(i.name LIKE ? OR i.sku LIKE ? OR i.category LIKE ?)'); args.push(like, like, like); }
  const cat = one(req.query.category).slice(0, 80);
  if (cat) { where.push('i.category = ?'); args.push(cat); }
  where.push('i.active = 1');
  const low = one(req.query.low) === '1';
  const [rows]: any = await db.query(`SELECT i.*, COALESCE(s.q,0) stock FROM pos_items i ${STOCK_JOIN} WHERE ${where.join(' AND ')} ${low ? 'AND COALESCE(s.q,0) <= i.reorder_level' : ''} ORDER BY (COALESCE(s.q,0) <= i.reorder_level) DESC, i.name ASC LIMIT 2000`, args);
  const items = (rows as any[]).map(itemOut);
  res.json({
    items, summary: {
      items: items.length, low: items.filter((i) => i.stock <= i.reorder_level).length, out: items.filter((i) => i.stock <= 0).length,
      valueAtCost: r2(items.reduce((a, i) => a + Math.max(0, i.stock) * i.cost, 0)), valueAtPrice: r2(items.reduce((a, i) => a + Math.max(0, i.stock) * i.price, 0)),
    },
  });
}));
router.get('/stock/:id/moves', wrap('Could not load the stock history.', async (req, res) => {
  const id = idOf(req.params.id); if (!id) throw new Bad('Unknown item.');
  const [rows]: any = await db.query("SELECT id, qty, kind, ref_id, note, created_by, DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s') at_ts FROM pos_stock_moves WHERE item_id = ? ORDER BY id DESC LIMIT 200", [id]);
  res.json({ items: (rows as any[]).map((r) => ({ id: Number(r.id), qty: r3(r.qty), kind: r.kind as string, label: KINDS[r.kind] || r.kind, ref_id: r.ref_id == null ? null : Number(r.ref_id), note: (r.note || '') as string, by: (r.created_by || '') as string, at: r.at_ts as string })) });
}));
router.get('/adjustments', wrap('Could not load the adjustments.', async (req, res) => {
  const [rows]: any = await db.query(`SELECT m.id, m.qty, m.note, m.created_by, DATE_FORMAT(m.created_at,'%Y-%m-%dT%H:%i:%s') at_ts, i.name, i.sku, i.unit FROM pos_stock_moves m JOIN pos_items i ON i.id = m.item_id WHERE m.kind = 'ADJUST' ORDER BY m.id DESC LIMIT 300`);
  res.json({ items: (rows as any[]).map((r) => ({ id: Number(r.id), qty: r3(r.qty), note: (r.note || '') as string, by: (r.created_by || '') as string, at: r.at_ts as string, name: r.name as string, sku: r.sku as string, unit: r.unit as string })) });
}));
// Either the quantity counted on the shelf (the system works out the difference) or the change itself (+5 or -2)
router.post('/adjustments', wrap('Could not save the adjustment.', async (req, res) => {
  const item = idOf(req.body?.item_id); if (!item) throw new Bad('Please choose an item.');
  const reason = cut(req.body?.reason, 200); if (!reason) throw new Bad('Please write the reason (for example damaged, counted, gift).');
  await tx(async (c) => {
    const [[it]]: any = await c.query('SELECT id, track_stock FROM pos_items WHERE id = ? FOR UPDATE', [item]);
    if (!it) throw new Bad('Item not found.', 404);
    if (!it.track_stock) throw new Bad('This item does not keep stock.');
    const [[cur]]: any = await c.query('SELECT COALESCE(SUM(qty),0) q FROM pos_stock_moves WHERE item_id = ?', [item]);
    let delta: number;
    if (req.body?.counted !== undefined && req.body?.counted !== '' && req.body?.counted !== null) {
      const counted = Number(req.body.counted);
      if (!Number.isFinite(counted) || counted < 0 || counted > 1_000_000) throw new Bad('Please enter the counted quantity (0 or more).');
      delta = r3(counted - Number(cur.q));
    } else {
      delta = r3(Number(req.body?.change));
      if (!Number.isFinite(delta) || Math.abs(delta) > 1_000_000) throw new Bad('Please enter the change, such as 5 or -2.');
      if (Number(cur.q) + delta < 0) throw new Bad('The stock cannot go below zero.');
    }
    if (delta === 0) throw new Bad('Nothing to change: the stock already matches.');
    await c.query("INSERT INTO pos_stock_moves (item_id, qty, kind, note, created_by, created_at) VALUES (?,?,'ADJUST',?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))", [item, delta, reason, who(req)]);
    console.log(`[audit] POS stock adjusted: item ${item}, change ${delta}, reason "${reason}", user ${who(req)}`);
  });
  res.status(201).json({ ok: true });
}));

// =====================================================================================================
// Purchases (stock in)
// =====================================================================================================
const purOut = (r: any) => ({ id: Number(r.id), bill_no: r.bill_no as string, supplier_id: r.supplier_id == null ? null : Number(r.supplier_id), supplier: (r.supplier || '') as string, supplier_bill: (r.supplier_bill || '') as string, purchase_date: dateOnly(r.purchase_date), total: r2(r.total), notes: (r.notes || '') as string, status: r.status as string, cancel_reason: (r.cancel_reason || '') as string, by: (r.created_by || '') as string, lines: Number(r.lines || 0) });
function rangeWhere(col: string, q: Request['query'], where: string[], args: any[]) {
  const from = one(q.from), to = one(q.to);
  if (from) { if (!realDay(from)) throw new Bad('The "from" date is not valid.'); where.push(`${col} >= ?`); args.push(`${from} 00:00:00`); }
  if (to) { if (!realDay(to)) throw new Bad('The "to" date is not valid.'); where.push(`${col} < DATE_ADD(?, INTERVAL 1 DAY)`); args.push(`${to} 00:00:00`); }
}
router.get('/purchases', wrap('Could not load the purchases.', async (req, res) => {
  const where: string[] = [], args: any[] = [];
  rangeWhere('p.purchase_date', req.query, where, args);
  const sup = idOf(req.query.supplier); if (sup) { where.push('p.supplier_id = ?'); args.push(sup); }
  const st = one(req.query.status).toUpperCase(); if (st === 'ACTIVE' || st === 'CANCELLED') { where.push('p.status = ?'); args.push(st); }
  const text = one(req.query.q).slice(0, 60);
  if (text) { const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`; where.push('(p.bill_no LIKE ? OR p.supplier_bill LIKE ? OR s.name LIKE ?)'); args.push(like, like, like); }
  const [rows]: any = await db.query(
    `SELECT p.*, s.name supplier, (SELECT COUNT(*) FROM pos_purchase_lines l WHERE l.purchase_id = p.id) \`lines\` FROM pos_purchases p LEFT JOIN pos_suppliers s ON s.id = p.supplier_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.purchase_date DESC, p.id DESC LIMIT 500`, args);
  const items = (rows as any[]).map(purOut);
  res.json({ items, total: r2(items.filter((p) => p.status === 'ACTIVE').reduce((a, p) => a + p.total, 0)) });
}));
router.get('/purchases/:id', wrap('Could not load the purchase.', async (req, res) => {
  const id = idOf(req.params.id); if (!id) throw new Bad('Unknown purchase.');
  const [rows]: any = await db.query('SELECT p.*, s.name supplier FROM pos_purchases p LEFT JOIN pos_suppliers s ON s.id = p.supplier_id WHERE p.id = ?', [id]);
  if (!rows.length) throw new Bad('Purchase not found.', 404);
  const [lines]: any = await db.query('SELECT l.item_id, l.qty, l.cost, l.amount, i.name, i.sku, i.unit FROM pos_purchase_lines l JOIN pos_items i ON i.id = l.item_id WHERE l.purchase_id = ? ORDER BY l.id', [id]);
  res.json({ ...purOut(rows[0]), items: (lines as any[]).map((l) => ({ item_id: Number(l.item_id), name: l.name as string, sku: l.sku as string, unit: l.unit as string, qty: r3(l.qty), cost: r2(l.cost), amount: r2(l.amount) })) });
}));
router.post('/purchases', wrap('Could not save the purchase.', async (req, res) => {
  const day = one(req.body?.purchase_date) || todayIst();
  if (!realDay(day)) throw new Bad('The purchase date is not valid.');
  const supplier = req.body?.supplier_id ? idOf(req.body.supplier_id) : null;
  if (req.body?.supplier_id && !supplier) throw new Bad('Unknown supplier.');
  const raw: any[] = Array.isArray(req.body?.lines) ? req.body.lines : [];
  if (!raw.length) throw new Bad('Add at least one item.');
  if (raw.length > 200) throw new Bad('A purchase can have up to 200 items.');
  const lines = raw.map((l) => {
    const item = idOf(l?.item_id), qty = r3(Number(l?.qty)), cost = r2(Number(l?.cost));
    if (!item) throw new Bad('A line has no item.');
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1_000_000) throw new Bad('Every quantity must be more than zero.');
    if (!Number.isFinite(cost) || cost < 0 || cost > 10_000_000) throw new Bad('Every cost must be 0 or more.');
    return { item, qty, cost, amount: r2(qty * cost) };
  });
  const total = r2(lines.reduce((a, l) => a + l.amount, 0));
  const out = await tx(async (c) => {
    if (supplier) { const [[s]]: any = await c.query('SELECT id FROM pos_suppliers WHERE id = ?', [supplier]); if (!s) throw new Bad('Supplier not found.', 404); }
    const ids = [...new Set(lines.map((l) => l.item))];
    const [found]: any = await c.query(`SELECT id, track_stock FROM pos_items WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    if ((found as any[]).length !== ids.length) throw new Bad('One of the items no longer exists.');
    const billNo = await nextNo(c, `PU-${fyOf(day)}`);
    const [r]: any = await c.query('INSERT INTO pos_purchases (bill_no, supplier_id, supplier_bill, purchase_date, total, notes, created_by, created_at) VALUES (?,?,?,?,?,?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))', [billNo, supplier, cut(req.body?.supplier_bill, 60) || null, day, total, cut(req.body?.notes, 500) || null, who(req)]);
    const pid = Number(r.insertId);
    for (const l of lines) {
      await c.query('INSERT INTO pos_purchase_lines (purchase_id, item_id, qty, cost, amount) VALUES (?,?,?,?,?)', [pid, l.item, l.qty, l.cost, l.amount]);
      await c.query("INSERT INTO pos_stock_moves (item_id, qty, kind, ref_id, note, created_by, created_at) VALUES (?,?,'PURCHASE',?,?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))", [l.item, l.qty, pid, billNo, who(req)]);
      // The latest purchase price becomes the item's cost, which is what profit is worked out from
      if (req.body?.update_cost !== false) await c.query('UPDATE pos_items SET cost = ? WHERE id = ?', [l.cost, l.item]);
    }
    return { id: pid, bill_no: billNo };
  });
  console.log(`[audit] POS purchase ${out.bill_no}: total ${total}, user ${who(req)}`);
  res.status(201).json(out);
}));
router.post('/purchases/:id/cancel', wrap('Could not cancel the purchase.', async (req, res) => {
  const id = idOf(req.params.id); if (!id) throw new Bad('Unknown purchase.');
  const reason = cut(req.body?.reason, 200); if (!reason) throw new Bad('Please write the reason for cancelling.');
  await tx(async (c) => {
    const [[p]]: any = await c.query('SELECT id, status, bill_no FROM pos_purchases WHERE id = ? FOR UPDATE', [id]);
    if (!p) throw new Bad('Purchase not found.', 404);
    if (p.status === 'CANCELLED') throw new Bad('This purchase is already cancelled.', 409);
    const [lines]: any = await c.query('SELECT item_id, qty FROM pos_purchase_lines WHERE purchase_id = ?', [id]);
    for (const l of lines as any[]) {
      const [[cur]]: any = await c.query('SELECT COALESCE(SUM(qty),0) q FROM pos_stock_moves WHERE item_id = ?', [l.item_id]);
      if (Number(cur.q) - Number(l.qty) < 0) throw new Bad('Some of this stock has already been sold, so the purchase cannot be cancelled. Use a stock adjustment instead.', 409);
    }
    await c.query("UPDATE pos_purchases SET status = 'CANCELLED', cancel_reason = ? WHERE id = ?", [reason, id]);
    for (const l of lines as any[]) await c.query("INSERT INTO pos_stock_moves (item_id, qty, kind, ref_id, note, created_by, created_at) VALUES (?,?,'PURCHASE_VOID',?,?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))", [l.item_id, -Number(l.qty), id, `${p.bill_no} cancelled`, who(req)]);
  });
  console.log(`[audit] POS purchase ${id} cancelled, user ${who(req)}`);
  res.json({ ok: true });
}));

// =====================================================================================================
// Sales (billing)
// =====================================================================================================
const MODES = ['cash', 'upi', 'card', 'other'] as const;
const saleOut = (r: any) => ({
  id: Number(r.id), bill_no: r.bill_no as string, sale_date: r.sale_ts ?? stamp(r.sale_date), customer_name: (r.customer_name || '') as string, phone: (r.phone || '') as string,
  subtotal: r2(r.subtotal), discount: r2(r.discount), gst_total: r2(r.gst_total), total: r2(r.total), pay_mode: r.pay_mode as string, pay_ref: (r.pay_ref || '') as string, notes: (r.notes || '') as string,
  status: r.status as string, cancel_reason: (r.cancel_reason || '') as string, by: (r.created_by || '') as string, lines: Number(r.lines || 0),
});
router.get('/sales', wrap('Could not load the sales.', async (req, res) => {
  const where: string[] = [], args: any[] = [];
  rangeWhere('s.sale_date', req.query, where, args);
  const st = one(req.query.status).toUpperCase(); if (st === 'ACTIVE' || st === 'CANCELLED') { where.push('s.status = ?'); args.push(st); }
  const mode = one(req.query.mode); if (mode) { if (!(MODES as readonly string[]).includes(mode)) throw new Bad('Unknown payment mode.'); where.push('s.pay_mode = ?'); args.push(mode); }
  const text = one(req.query.q).slice(0, 60);
  if (text) { const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`; where.push('(s.bill_no LIKE ? OR s.customer_name LIKE ? OR s.phone LIKE ?)'); args.push(like, like, like); }
  const [rows]: any = await db.query(`SELECT s.*, DATE_FORMAT(s.sale_date,'%Y-%m-%dT%H:%i:%s') sale_ts, (SELECT COUNT(*) FROM pos_sale_lines l WHERE l.sale_id = s.id) \`lines\` FROM pos_sales s ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.sale_date DESC, s.id DESC LIMIT 500`, args);
  const items = (rows as any[]).map(saleOut);
  const live = items.filter((s) => s.status === 'ACTIVE');
  res.json({ items, summary: { bills: live.length, total: r2(live.reduce((a, s) => a + s.total, 0)), cancelled: items.length - live.length, discount: r2(live.reduce((a, s) => a + s.discount, 0)), gst: r2(live.reduce((a, s) => a + s.gst_total, 0)) }, capped: items.length >= 500 });
}));
router.get('/sales/:id', wrap('Could not load the bill.', async (req, res) => {
  const id = idOf(req.params.id); if (!id) throw new Bad('Unknown bill.');
  const [rows]: any = await db.query("SELECT s.*, DATE_FORMAT(s.sale_date,'%Y-%m-%dT%H:%i:%s') sale_ts FROM pos_sales s WHERE s.id = ?", [id]);
  if (!rows.length) throw new Bad('Bill not found.', 404);
  const [lines]: any = await db.query('SELECT item_id, name, unit, qty, price, gst_percent, amount FROM pos_sale_lines WHERE sale_id = ? ORDER BY id', [id]);
  res.json({ ...saleOut(rows[0]), items: (lines as any[]).map((l) => ({ item_id: Number(l.item_id), name: l.name as string, unit: l.unit as string, qty: r3(l.qty), price: r2(l.price), gst_percent: r2(l.gst_percent), amount: r2(l.amount) })) });
}));
router.post('/sales', wrap('Could not save the bill.', async (req, res) => {
  const raw: any[] = Array.isArray(req.body?.lines) ? req.body.lines : [];
  if (!raw.length) throw new Bad('Add at least one item to the bill.');
  if (raw.length > 100) throw new Bad('A bill can have up to 100 lines.');
  const mode = one(req.body?.pay_mode) || 'cash';
  if (!(MODES as readonly string[]).includes(mode)) throw new Bad('Unknown payment mode.');
  const discount = r2(Number(req.body?.discount || 0));
  if (!Number.isFinite(discount) || discount < 0) throw new Bad('The discount must be 0 or more.');
  const phone = cut(req.body?.phone, 30);
  if (phone && !/^[0-9+() -]{6,30}$/.test(phone)) throw new Bad('Please enter a valid mobile number or leave it blank.');
  const want = new Map<number, { qty: number; price: number | null }[]>();
  for (const l of raw) {
    const item = idOf(l?.item_id), qty = r3(Number(l?.qty));
    if (!item) throw new Bad('A line has no item.');
    if (!Number.isFinite(qty) || qty <= 0 || qty > 100_000) throw new Bad('Every quantity must be more than zero.');
    let price: number | null = null;
    if (l?.price !== undefined && l?.price !== null && l?.price !== '') { price = r2(Number(l.price)); if (!Number.isFinite(price) || price < 0) throw new Bad('A price is not valid.'); }
    if (!want.has(item)) want.set(item, []);
    want.get(item)!.push({ qty, price });
  }
  const now = new Date(Date.now() + 5.5 * 3600_000).toISOString().replace('T', ' ').slice(0, 19);
  const out = await tx(async (c) => {
    const ids = [...want.keys()];
    const [items]: any = await c.query(`SELECT * FROM pos_items WHERE id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, ids);
    const byId = new Map<number, any>((items as any[]).map((i) => [Number(i.id), i]));
    const [stocks]: any = await c.query(`SELECT item_id, SUM(qty) q FROM pos_stock_moves WHERE item_id IN (${ids.map(() => '?').join(',')}) GROUP BY item_id`, ids);
    const stock = new Map<number, number>((stocks as any[]).map((s) => [Number(s.item_id), Number(s.q)]));
    const lines: { item: any; qty: number; price: number; amount: number }[] = [];
    for (const [id, parts] of want) {
      const it = byId.get(id);
      if (!it) throw new Bad('One of the items no longer exists.');
      if (!it.active) throw new Bad(`${it.name} is not for sale any more.`);
      const total = r3(parts.reduce((a, p) => a + p.qty, 0));
      if (it.track_stock && (stock.get(id) || 0) < total) throw new Bad(`Not enough stock of ${it.name}: ${r3(stock.get(id) || 0)} ${it.unit} left, ${total} wanted.`, 409);
      for (const p of parts) { const price = p.price ?? r2(it.price); lines.push({ item: it, qty: p.qty, price, amount: r2(p.qty * price) }); }
    }
    const subtotal = r2(lines.reduce((a, l) => a + l.amount, 0));
    if (discount > subtotal) throw new Bad('The discount cannot be more than the bill.');
    const total = r2(subtotal - discount);
    // GST is inside the prices; the discount is shared across the lines in proportion before the GST is worked out
    let gst = 0;
    for (const l of lines) { const net = subtotal > 0 ? l.amount - (discount * l.amount) / subtotal : 0; const g = Number(l.item.gst_percent); gst += net - net / (1 + g / 100); }
    gst = r2(gst);
    const billNo = await nextNo(c, `PS-${fyOf(now.slice(0, 10))}`);
    const [r]: any = await c.query('INSERT INTO pos_sales (bill_no, sale_date, customer_name, phone, subtotal, discount, gst_total, total, pay_mode, pay_ref, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [billNo, now, cut(req.body?.customer_name, 200) || null, phone || null, subtotal, discount, gst, total, mode, cut(req.body?.pay_ref, 100) || null, cut(req.body?.notes, 500) || null, who(req)]);
    const sid = Number(r.insertId);
    for (const l of lines) {
      await c.query('INSERT INTO pos_sale_lines (sale_id, item_id, name, unit, qty, price, cost, gst_percent, amount) VALUES (?,?,?,?,?,?,?,?,?)', [sid, l.item.id, l.item.name, l.item.unit, l.qty, l.price, r2(l.item.cost), r2(l.item.gst_percent), l.amount]);
      if (l.item.track_stock) await c.query("INSERT INTO pos_stock_moves (item_id, qty, kind, ref_id, note, created_by, created_at) VALUES (?,?,'SALE',?,?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))", [l.item.id, -l.qty, sid, billNo, who(req)]);
    }
    return { id: sid, bill_no: billNo, total };
  });
  console.log(`[audit] POS sale ${out.bill_no}: total ${out.total}, ${mode}, user ${who(req)}`);
  res.status(201).json(out);
}));
router.post('/sales/:id/cancel', wrap('Could not cancel the bill.', async (req, res) => {
  const id = idOf(req.params.id); if (!id) throw new Bad('Unknown bill.');
  const reason = cut(req.body?.reason, 200); if (!reason) throw new Bad('Please write the reason for cancelling.');
  await tx(async (c) => {
    const [[s]]: any = await c.query('SELECT id, status, bill_no FROM pos_sales WHERE id = ? FOR UPDATE', [id]);
    if (!s) throw new Bad('Bill not found.', 404);
    if (s.status === 'CANCELLED') throw new Bad('This bill is already cancelled.', 409);
    await c.query("UPDATE pos_sales SET status = 'CANCELLED', cancel_reason = ? WHERE id = ?", [reason, id]);
    // The stock of every item that kept stock goes back
    const [moves]: any = await c.query("SELECT item_id, qty FROM pos_stock_moves WHERE kind = 'SALE' AND ref_id = ?", [id]);
    for (const m of moves as any[]) await c.query("INSERT INTO pos_stock_moves (item_id, qty, kind, ref_id, note, created_by, created_at) VALUES (?,?,'SALE_VOID',?,?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))", [m.item_id, -Number(m.qty), id, `${s.bill_no} cancelled`, who(req)]);
  });
  console.log(`[audit] POS sale ${id} cancelled, user ${who(req)}`);
  res.json({ ok: true });
}));

// =====================================================================================================
// Dashboard and reports
// =====================================================================================================
router.get('/dashboard', wrap('Could not load the dashboard.', async (_req, res) => {
  const [[t]]: any = await db.query("SELECT COUNT(*) bills, COALESCE(SUM(total),0) total FROM pos_sales WHERE status='ACTIVE' AND DATE(sale_date) = DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE))");
  const [[m]]: any = await db.query("SELECT COUNT(*) bills, COALESCE(SUM(total),0) total FROM pos_sales WHERE status='ACTIVE' AND DATE_FORMAT(sale_date,'%Y-%m') = DATE_FORMAT(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE),'%Y-%m')");
  const [days]: any = await db.query("SELECT DATE_FORMAT(sale_date,'%Y-%m-%d') d, COUNT(*) bills, SUM(total) total FROM pos_sales WHERE status='ACTIVE' AND sale_date >= DATE_SUB(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE), INTERVAL 13 DAY) GROUP BY d ORDER BY d");
  const [top]: any = await db.query("SELECT l.name, SUM(l.qty) qty, SUM(l.amount) amount FROM pos_sale_lines l JOIN pos_sales s ON s.id = l.sale_id WHERE s.status='ACTIVE' AND s.sale_date >= DATE_SUB(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 330 MINUTE), INTERVAL 29 DAY) GROUP BY l.item_id, l.name ORDER BY amount DESC LIMIT 6");
  const [low]: any = await db.query(`SELECT i.id, i.name, i.unit, i.reorder_level, COALESCE(s.q,0) stock FROM pos_items i ${STOCK_JOIN} WHERE i.active = 1 AND i.track_stock = 1 AND COALESCE(s.q,0) <= i.reorder_level ORDER BY COALESCE(s.q,0) ASC, i.name LIMIT 8`);
  const [[lowN]]: any = await db.query(`SELECT COUNT(*) n FROM pos_items i ${STOCK_JOIN} WHERE i.active = 1 AND i.track_stock = 1 AND COALESCE(s.q,0) <= i.reorder_level`);
  const [[val]]: any = await db.query(`SELECT COALESCE(SUM(GREATEST(COALESCE(s.q,0),0) * i.cost),0) v, COUNT(*) n FROM pos_items i ${STOCK_JOIN} WHERE i.active = 1 AND i.track_stock = 1`);
  const [recent]: any = await db.query("SELECT s.*, DATE_FORMAT(s.sale_date,'%Y-%m-%dT%H:%i:%s') sale_ts, (SELECT COUNT(*) FROM pos_sale_lines l WHERE l.sale_id = s.id) `lines` FROM pos_sales s ORDER BY s.id DESC LIMIT 6");
  res.json({
    today: { bills: Number(t.bills), total: r2(t.total) }, month: { bills: Number(m.bills), total: r2(m.total) }, stockValue: r2(val.v), stockItems: Number(val.n), lowCount: Number(lowN.n),
    days: (days as any[]).map((d) => ({ d: String(d.d), bills: Number(d.bills), total: r2(d.total) })),
    top: (top as any[]).map((r) => ({ name: r.name as string, qty: r3(r.qty), amount: r2(r.amount) })),
    low: (low as any[]).map((r) => ({ id: Number(r.id), name: r.name as string, unit: r.unit as string, stock: r3(r.stock), reorder_level: r3(r.reorder_level) })),
    recent: (recent as any[]).map(saleOut),
  });
}));

router.get('/reports', wrap('Could not make the report.', async (req, res) => {
  const where: string[] = ["s.status = 'ACTIVE'"], args: any[] = [];
  rangeWhere('s.sale_date', req.query, where, args);
  const W = `WHERE ${where.join(' AND ')}`;
  const [[sum]]: any = await db.query(`SELECT COUNT(*) bills, COALESCE(SUM(s.subtotal),0) subtotal, COALESCE(SUM(s.discount),0) discount, COALESCE(SUM(s.gst_total),0) gst, COALESCE(SUM(s.total),0) total FROM pos_sales s ${W}`, args);
  const [[cost]]: any = await db.query(`SELECT COALESCE(SUM(l.qty * l.cost),0) c FROM pos_sale_lines l JOIN pos_sales s ON s.id = l.sale_id ${W}`, args);
  const [byDay]: any = await db.query(`SELECT DATE_FORMAT(s.sale_date,'%Y-%m-%d') d, COUNT(*) bills, SUM(s.total) total FROM pos_sales s ${W} GROUP BY d ORDER BY d`, args);
  const [byMode]: any = await db.query(`SELECT s.pay_mode mode, COUNT(*) bills, SUM(s.total) total FROM pos_sales s ${W} GROUP BY s.pay_mode ORDER BY total DESC`, args);
  const [byItem]: any = await db.query(`SELECT l.name, l.unit, SUM(l.qty) qty, SUM(l.amount) amount, SUM(l.qty * l.cost) cost FROM pos_sale_lines l JOIN pos_sales s ON s.id = l.sale_id ${W} GROUP BY l.item_id, l.name, l.unit ORDER BY amount DESC LIMIT 100`, args);
  const [byCat]: any = await db.query(`SELECT COALESCE(NULLIF(i.category,''),'No category') category, SUM(l.qty) qty, SUM(l.amount) amount FROM pos_sale_lines l JOIN pos_sales s ON s.id = l.sale_id LEFT JOIN pos_items i ON i.id = l.item_id ${W} GROUP BY category ORDER BY amount DESC`, args);
  const pw: string[] = ["p.status = 'ACTIVE'"], pa: any[] = [];
  rangeWhere('p.purchase_date', req.query, pw, pa);
  const [[pur]]: any = await db.query(`SELECT COUNT(*) bills, COALESCE(SUM(p.total),0) total FROM pos_purchases p WHERE ${pw.join(' AND ')}`, pa);
  const total = r2(sum.total), gst = r2(sum.gst), c = r2(cost.c);
  res.json({
    summary: { bills: Number(sum.bills), subtotal: r2(sum.subtotal), discount: r2(sum.discount), gst, total, cost: c, profit: r2(total - gst - c), purchases: r2(pur.total), purchaseBills: Number(pur.bills) },
    byDay: (byDay as any[]).map((r) => ({ d: String(r.d), bills: Number(r.bills), total: r2(r.total) })),
    byMode: (byMode as any[]).map((r) => ({ mode: r.mode as string, bills: Number(r.bills), total: r2(r.total) })),
    byItem: (byItem as any[]).map((r) => ({ name: r.name as string, unit: r.unit as string, qty: r3(r.qty), amount: r2(r.amount), profit: r2(Number(r.amount) - Number(r.cost)) })),
    byCategory: (byCat as any[]).map((r) => ({ category: r.category as string, qty: r3(r.qty), amount: r2(r.amount) })),
  });
}));

const csv = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
router.get('/export', wrap('Could not make the file.', async (req, res) => {
  const type = one(req.query.type);
  let head: string[] = [], data: any[][] = [];
  if (type === 'sales') {
    const where: string[] = [], args: any[] = [];
    rangeWhere('s.sale_date', req.query, where, args);
    const [rows]: any = await db.query(`SELECT s.*, DATE_FORMAT(s.sale_date,'%Y-%m-%dT%H:%i:%s') sale_ts FROM pos_sales s ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY s.sale_date, s.id LIMIT 20000`, args);
    head = ['Bill no', 'Date', 'Customer', 'Mobile', 'Subtotal', 'Discount', 'GST included', 'Total', 'Payment', 'Reference', 'Status', 'Cancel reason', 'Billed by'];
    data = (rows as any[]).map((r) => [r.bill_no, r.sale_ts, r.customer_name, r.phone, r2(r.subtotal), r2(r.discount), r2(r.gst_total), r2(r.total), r.pay_mode, r.pay_ref, r.status, r.cancel_reason, r.created_by]);
  } else if (type === 'stock') {
    const [rows]: any = await db.query(`SELECT i.*, COALESCE(s.q,0) stock FROM pos_items i ${STOCK_JOIN} ORDER BY i.name`);
    head = ['Code', 'Barcode', 'Item', 'Category', 'Unit', 'Price', 'Cost', 'GST %', 'Stock', 'Re-order level', 'Stock value (cost)', 'Active'];
    data = (rows as any[]).map((r) => [r.sku, r.barcode, r.name, r.category, r.unit, r2(r.price), r2(r.cost), r2(r.gst_percent), r.track_stock ? r3(r.stock) : '', r3(r.reorder_level), r.track_stock ? r2(Math.max(0, Number(r.stock)) * Number(r.cost)) : '', r.active ? 'Yes' : 'No']);
  } else if (type === 'purchases') {
    const where: string[] = [], args: any[] = [];
    rangeWhere('p.purchase_date', req.query, where, args);
    const [rows]: any = await db.query(`SELECT p.*, s.name supplier FROM pos_purchases p LEFT JOIN pos_suppliers s ON s.id = p.supplier_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.purchase_date, p.id LIMIT 20000`, args);
    head = ['Purchase no', 'Date', 'Supplier', 'Supplier bill', 'Total', 'Status', 'Entered by'];
    data = (rows as any[]).map((r) => [r.bill_no, dateOnly(r.purchase_date), r.supplier, r.supplier_bill, r2(r.total), r.status, r.created_by]);
  } else throw new Bad('Unknown file type.');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pos-${type}.csv"`);
  res.send('﻿' + [head, ...data].map((row) => row.map(csv).join(',')).join('\r\n'));
}));

export default router;