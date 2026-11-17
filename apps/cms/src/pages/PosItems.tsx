import React, { useCallback, useEffect, useState } from 'react';
import { useFlash } from './DiscoverKit';
import { inr } from './PaymentCharts';
import { Field, Modal, PosShell, Item, posApi, posDownload, qtyText } from './PosKit';

// Items the shop sells: code, name, category, selling price (GST included), cost, GST percent, and the stock level that triggers a re-order warning.
type Form = {
  id: number | null; name: string; sku: string; barcode: string; category: string; unit: string; price: string; cost: string; gst_percent: string;
  track_stock: boolean; reorder_level: string; opening_stock: string; active: boolean; new_category: string;
};
const blank: Form = { id: null, name: '', sku: '', barcode: '', category: '', unit: 'pcs', price: '', cost: '', gst_percent: '0', track_stock: true, reorder_level: '0', opening_stock: '', active: true, new_category: '' };
const NEW_CAT = '__new__';
const UNITS = ['pcs', 'kg', 'gm', 'litre', 'ml', 'packet', 'box', 'bundle', 'dozen', 'bottle', 'set', 'metre'];
const GST_RATES = ['0', '5', '12', '18', '28'];
type CatRow = { name: string; items: number };

export default function PosItems() {
  const { notice, flash, clear } = useFlash();
  const [items, setItems] = useState<Item[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [active, setActive] = useState('1');
  const [low, setLow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [manage, setManage] = useState<{ rows: CatRow[]; add: string; edit: string | null; to: string; err: string; busy: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set('q', q.trim());
      if (cat) p.set('category', cat);
      if (active) p.set('active', active);
      if (low) p.set('low', '1');
      const r = await posApi<{ items: Item[]; categories: string[] }>(`/items?${p}`);
      setItems(r.items); setCats(r.categories);
    } catch (e: any) { flash('err', e?.message || 'Could not load the items.'); }
    finally { setLoading(false); }
  }, [q, cat, active, low]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const edit = (i: Item) => { setFormErr(''); setForm({ id: i.id, name: i.name, sku: i.sku, barcode: i.barcode, category: i.category, unit: i.unit, price: String(i.price), cost: String(i.cost), gst_percent: String(i.gst_percent), track_stock: i.track_stock, reorder_level: String(i.reorder_level), opening_stock: '', active: i.active, new_category: '' }); };
  const save = async () => {
    if (!form) return;
    setBusy(true); setFormErr('');
    try {
      const category = form.category === NEW_CAT ? form.new_category.trim().replace(/\s+/g, ' ') : form.category;
      if (form.category === NEW_CAT && !category) throw new Error('Please type the name of the new category, or choose an existing one.');
      const body = { ...form, category, price: Number(form.price), cost: Number(form.cost || 0), gst_percent: Number(form.gst_percent || 0), reorder_level: Number(form.reorder_level || 0), opening_stock: Number(form.opening_stock || 0) };
      if (form.price.trim() === '') throw new Error('Please enter the selling price.');
      await posApi(form.id ? `/items/${form.id}` : '/items', { method: form.id ? 'PUT' : 'POST', body });
      flash('ok', form.id ? 'Item saved.' : 'Item added.');
      setForm(null); load();
    } catch (e: any) { setFormErr(e?.message || 'Could not save the item.'); }
    finally { setBusy(false); }
  };
  // ---- categories: create, rename, delete ----
  const openManage = async () => {
    setManage({ rows: [], add: '', edit: null, to: '', err: '', busy: true });
    try { const r = await posApi<{ items: CatRow[] }>('/categories'); setManage((m) => ({ rows: r.items, add: m?.add || '', edit: null, to: '', err: '', busy: false })); }
    catch (e: any) { setManage(null); flash('err', e?.message || 'Could not load the categories.'); }
  };
  const catCall = async (fn: () => Promise<unknown>, done: string) => {
    if (!manage) return;
    setManage((m) => (m ? { ...m, busy: true, err: '' } : m));
    try {
      await fn();
      const r = await posApi<{ items: CatRow[] }>('/categories');
      setManage((m) => (m ? { ...m, rows: r.items, add: '', edit: null, to: '', busy: false } : m));
      flash('ok', done); load();
    } catch (e: any) { setManage((m) => (m ? { ...m, busy: false, err: e?.message || 'Something went wrong.' } : m)); }
  };
  const addCat = () => { if (manage) catCall(() => posApi('/categories', { method: 'POST', body: { name: manage.add } }), 'Category added.'); };
  const renameCat = () => { if (manage?.edit) catCall(() => posApi('/categories', { method: 'PUT', body: { from: manage.edit, to: manage.to } }), 'Category renamed.'); };
  const deleteCat = (name: string) => catCall(() => posApi(`/categories?name=${encodeURIComponent(name)}`, { method: 'DELETE' }), 'Category deleted.');

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <PosShell title="Items" sub="Everything the shop sells. Prices include GST. Stock is counted from purchases and sales, so it is never typed in by hand after the opening stock." notice={notice} clear={clear}
      actions={<>
        <button type="button" className="pdx-btn" onClick={openManage}>Categories</button>
        <button type="button" className="pdx-btn" onClick={() => posDownload('/export?type=stock', 'pos-items.csv').catch((e) => flash('err', e.message))}>Download CSV</button>
        <button type="button" className="pdx-btn ps-btn-main" onClick={() => { setFormErr(''); setForm(blank); }}>+ Add item</button>
      </>}>
      <div className="pdx-card" style={{ marginBottom: 14 }}>
        <div className="ps-grid" style={{ marginTop: 0 }}>
          <Field label="Search"><input className="pdx-inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, code, barcode" autoComplete="off" /></Field>
          <Field label="Category"><select className="pdx-inp" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Show"><select className="pdx-inp" value={active} onChange={(e) => setActive(e.target.value)}><option value="1">Items for sale</option><option value="0">Stopped items</option><option value="">All</option></select></Field>
          <Field label="Stock"><select className="pdx-inp" value={low ? '1' : ''} onChange={(e) => setLow(e.target.value === '1')}><option value="">All</option><option value="1">Low or out of stock</option></select></Field>
        </div>
      </div>
      <div className="ps-table-wrap">
        <table className="ps-table">
          <thead><tr><th>Code</th><th>Item</th><th>Category</th><th className="r">Price</th><th className="r">Cost</th><th className="r">GST</th><th className="r">Stock</th><th /></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className={i.active ? '' : 'off'}>
                <td>{i.sku}{i.barcode && <small>{i.barcode}</small>}</td>
                <td><b>{i.name}</b>{!i.active && <span className="ps-pill x" style={{ marginLeft: 6 }}>Stopped</span>}</td>
                <td>{i.category || '-'}</td>
                <td className="r">{inr(i.price)}<small>per {i.unit}</small></td>
                <td className="r">{inr(i.cost)}</td>
                <td className="r">{i.gst_percent}%</td>
                <td className="r">{i.track_stock ? <><span className={`ps-pill ${i.stock <= 0 ? 'out' : i.stock <= i.reorder_level ? 'low' : 'ok'}`}>{qtyText(i.stock)} {i.unit}</span></> : <small>not counted</small>}</td>
                <td className="r"><button type="button" className="ps-link" onClick={() => edit(i)}>Edit</button></td>
              </tr>
            ))}
            {!loading && !items.length && <tr><td colSpan={8}><p className="ps-empty">No items yet. Click "+ Add item" to add the first one.</p></td></tr>}
          </tbody>
        </table>
      </div>
      {loading && <p className="ps-empty">Loading...</p>}

      {form && (
        <Modal title={form.id ? 'Edit item' : 'Add item'} onClose={() => setForm(null)}
          foot={<><button type="button" className="pdx-btn" onClick={() => setForm(null)}>Cancel</button><button type="button" className="pdx-btn ps-btn-main" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save item'}</button></>}>
          {formErr && <div className="ps-err" role="alert">{formErr}</div>}
          <div className="ps-grid" style={{ marginTop: 0 }}>
            <div style={{ gridColumn: '1 / -1' }}><Field label="Item name *"><input className="pdx-inp" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus autoComplete="off" /></Field></div>
            <Field label="Item code" hint={form.id ? '' : 'Leave blank for an automatic code'}><input className="pdx-inp" value={form.sku} onChange={(e) => set('sku', e.target.value)} autoComplete="off" /></Field>
            <Field label="Barcode"><input className="pdx-inp" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} autoComplete="off" /></Field>
            <Field label="Category">
              <select className="pdx-inp" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">No category</option>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                {form.category && form.category !== NEW_CAT && !cats.includes(form.category) && <option value={form.category}>{form.category}</option>}
                <option value={NEW_CAT}>+ New category...</option>
              </select>
              {form.category === NEW_CAT && <input className="pdx-inp" style={{ marginTop: 6 }} value={form.new_category} onChange={(e) => set('new_category', e.target.value)} placeholder="Type the new category name" aria-label="New category name" autoFocus autoComplete="off" />}
            </Field>
            <Field label="Unit">
              <select className="pdx-inp" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                {form.unit && !UNITS.includes(form.unit) && <option value={form.unit}>{form.unit}</option>}
              </select>
            </Field>
            <Field label="Selling price (with GST) *"><input className="pdx-inp" type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} /></Field>
            <Field label="Cost price"><input className="pdx-inp" type="number" min="0" step="0.01" value={form.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
            <Field label="GST % in the price"><select className="pdx-inp" value={GST_RATES.includes(form.gst_percent) ? form.gst_percent : ''} onChange={(e) => set('gst_percent', e.target.value)}>{GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}{!GST_RATES.includes(form.gst_percent) && <option value="">{form.gst_percent}%</option>}</select></Field>
            {!form.id && <Field label="Opening stock" hint="What is on the shelf today"><input className="pdx-inp" type="number" min="0" step="0.001" value={form.opening_stock} onChange={(e) => set('opening_stock', e.target.value)} disabled={!form.track_stock} /></Field>}
            <Field label="Low stock alert" hint="You get an alert when the stock falls to this number"><input className="pdx-inp" type="number" min="0" step="0.001" value={form.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} disabled={!form.track_stock} /></Field>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, fontSize: 14 }}><input type="checkbox" checked={form.track_stock} onChange={(e) => set('track_stock', e.target.checked)} /> Count the stock of this item (untick for services)</label>
          {form.id && <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 14 }}><input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> For sale (untick to stop selling it; past bills are kept)</label>}
        </Modal>
      )}
      {manage && (
        <Modal title="Item categories" onClose={() => setManage(null)}>
          {manage.err && <div className="ps-err" role="alert">{manage.err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="pdx-inp" style={{ flex: 1 }} value={manage.add} onChange={(e) => setManage({ ...manage, add: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } }} placeholder="New category, for example Books" aria-label="New category" autoComplete="off" autoFocus />
            <button type="button" className="pdx-btn ps-btn-main" onClick={addCat} disabled={manage.busy || !manage.add.trim()}>Add</button>
          </div>
          <div className="ps-table-wrap" style={{ marginTop: 14, maxHeight: 340 }}>
            <table className="ps-table">
              <thead><tr><th>Category</th><th className="r">Items</th><th /></tr></thead>
              <tbody>
                {manage.rows.map((c) => (
                  <tr key={c.name}>
                    <td>{manage.edit === c.name
                      ? <input className="pdx-inp" style={{ width: '100%' }} value={manage.to} onChange={(e) => setManage({ ...manage, to: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') renameCat(); if (e.key === 'Escape') setManage({ ...manage, edit: null }); }} aria-label={`New name for ${c.name}`} autoFocus autoComplete="off" />
                      : <b>{c.name}</b>}</td>
                    <td className="r">{c.items}</td>
                    <td className="r">
                      {manage.edit === c.name ? (
                        <><button type="button" className="ps-link" onClick={renameCat} disabled={manage.busy}>Save</button>{' '}<button type="button" className="ps-link" onClick={() => setManage({ ...manage, edit: null })}>Cancel</button></>
                      ) : (
                        <><button type="button" className="ps-link" onClick={() => setManage({ ...manage, edit: c.name, to: c.name, err: '' })}>Rename</button>{' '}
                          <button type="button" className="ps-link" onClick={() => deleteCat(c.name)} disabled={manage.busy || c.items > 0} title={c.items > 0 ? 'Move its items to another category first' : 'Delete'} style={c.items > 0 ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}>Delete</button></>
                      )}
                    </td>
                  </tr>
                ))}
                {!manage.busy && !manage.rows.length && <tr><td colSpan={3}><p className="ps-empty">No categories yet. Add the first one above.</p></td></tr>}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '10px 0 0' }}>A category can be deleted only when no item uses it. Renaming changes it on all its items.</p>
        </Modal>
      )}
    </PosShell>
  );
}