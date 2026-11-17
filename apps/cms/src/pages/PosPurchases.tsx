import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlash } from './DiscoverKit';
import { inr, ymd } from './PaymentCharts';
import { Card, Field, Item, Modal, Preset, PosShell, RangeBar, dmy, posApi, posDownload, qtyText, rangeFor } from './PosKit';

// Stock coming in. Saving a purchase adds the quantities to the stock and makes the purchase price the item's cost.
type Purchase = { id: number; bill_no: string; supplier_id: number | null; supplier: string; supplier_bill: string; purchase_date: string; total: number; notes: string; status: 'ACTIVE' | 'CANCELLED'; cancel_reason: string; by: string; lines: number };
type PurchaseDetail = Purchase & { items: { item_id: number; name: string; sku: string; unit: string; qty: number; cost: number; amount: number }[] };
type Supplier = { id: number; name: string; active: boolean };
type Line = { cat: string; item_id: string; qty: string; cost: string };
const NO_CAT = '__none'; // items that have no category

export default function PosPurchases() {
  const { notice, flash, clear } = useFlash();
  const first = rangeFor('month');
  const [from, setFrom] = useState(first.from);
  const [to, setTo] = useState(first.to);
  const [preset, setPreset] = useState<Preset>('month');
  const [supplier, setSupplier] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Purchase[]>([]);
  const [total, setTotal] = useState(0);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<PurchaseDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [form, setForm] = useState<{ supplier_id: string; supplier_bill: string; purchase_date: string; notes: string; lines: Line[]; update_cost: boolean } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const params = useCallback(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (supplier) p.set('supplier', supplier);
    if (status) p.set('status', status);
    if (q.trim()) p.set('q', q.trim());
    return p;
  }, [from, to, supplier, status, q]);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await posApi<{ items: Purchase[]; total: number }>(`/purchases?${params()}`); setRows(r.items); setTotal(r.total); }
    catch (e: any) { flash('err', e?.message || 'Could not load the purchases.'); }
    finally { setLoading(false); }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => {
    posApi<{ items: Supplier[] }>('/suppliers').then((r) => setSuppliers(r.items)).catch(() => undefined);
    posApi<{ items: Item[] }>('/items?active=1').then((r) => setItems(r.items)).catch(() => undefined);
  }, []);

  const view = async (id: number) => { try { setOpen(await posApi<PurchaseDetail>(`/purchases/${id}`)); setCancelling(false); setReason(''); setErr(''); } catch (e: any) { flash('err', e?.message || 'Could not open the purchase.'); } };
  const cancel = async () => {
    if (!open) return;
    if (!reason.trim()) { setErr('Please write the reason for cancelling.'); return; }
    setBusy(true); setErr('');
    try { await posApi(`/purchases/${open.id}/cancel`, { method: 'POST', body: { reason } }); flash('ok', `Purchase ${open.bill_no} cancelled and the stock taken out.`); setOpen(null); load(); }
    catch (e: any) { setErr(e?.message || 'Could not cancel the purchase.'); }
    finally { setBusy(false); }
  };

  const stockable = useMemo(() => items.filter((i) => i.track_stock), [items]);
  const newForm = () => { setErr(''); setForm({ supplier_id: '', supplier_bill: '', purchase_date: ymd(new Date()), notes: '', lines: [{ cat: '', item_id: '', qty: '', cost: '' }], update_cost: true }); };
  const setLine = (k: number, patch: Partial<Line>) => setForm((f) => (f ? { ...f, lines: f.lines.map((l, i) => (i === k ? { ...l, ...patch } : l)) } : f));
  const pickItem = (k: number, id: string) => { const it = items.find((i) => String(i.id) === id); setLine(k, { item_id: id, cost: it ? String(it.cost || '') : '' }); };
  // The categories of the items that can be bought, and the items of one category
  const categories = useMemo(() => Array.from(new Set(stockable.map((i) => i.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [stockable]);
  const hasUncategorised = useMemo(() => stockable.some((i) => !i.category), [stockable]);
  const itemsOf = (cat: string) => (cat === '' ? stockable : cat === NO_CAT ? stockable.filter((i) => !i.category) : stockable.filter((i) => i.category === cat));
  // Choosing another category clears the item when it does not belong to it
  const pickCat = (k: number, cat: string) => setForm((f) => {
    if (!f) return f;
    return { ...f, lines: f.lines.map((l, i) => {
      if (i !== k) return l;
      const keep = l.item_id && itemsOf(cat).some((x) => String(x.id) === l.item_id);
      return keep ? { ...l, cat } : { ...l, cat, item_id: '', cost: '' };
    }) };
  });
  const formTotal = form ? form.lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.cost) || 0), 0) : 0;
  const save = async () => {
    if (!form) return;
    setErr('');
    const lines = form.lines.filter((l) => l.item_id || l.qty || l.cost);
    if (!lines.length) { setErr('Add at least one item.'); return; }
    if (lines.some((l) => !l.item_id || !(Number(l.qty) > 0) || l.cost === '' || Number(l.cost) < 0)) { setErr('Every line needs an item, a quantity above zero and a cost.'); return; }
    setBusy(true);
    try {
      const r = await posApi<{ bill_no: string }>('/purchases', { method: 'POST', body: { supplier_id: form.supplier_id ? Number(form.supplier_id) : null, supplier_bill: form.supplier_bill, purchase_date: form.purchase_date, notes: form.notes, update_cost: form.update_cost, lines: lines.map((l) => ({ item_id: Number(l.item_id), qty: Number(l.qty), cost: Number(l.cost) })) } });
      flash('ok', `Purchase ${r.bill_no} saved and the stock added.`); setForm(null); load();
      posApi<{ items: Item[] }>('/items?active=1').then((x) => setItems(x.items)).catch(() => undefined);
    } catch (e: any) { setErr(e?.message || 'Could not save the purchase.'); }
    finally { setBusy(false); }
  };

  return (
    <PosShell title="Purchases (Stock In)" sub="Record what you buy from suppliers. The stock goes up when you save." notice={notice} clear={clear}
      actions={<>
        <button type="button" className="pdx-btn" onClick={() => posDownload(`/export?type=purchases&${params()}`, 'pos-purchases.csv').catch((e) => flash('err', e.message))}>Download CSV</button>
        <button type="button" className="pdx-btn ps-btn-main" onClick={newForm}>+ New purchase</button>
      </>}>
      <div className="pdx-card" style={{ marginBottom: 14 }}>
        <RangeBar from={from} to={to} preset={preset} onChange={(f, t, p) => { setFrom(f); setTo(t); setPreset(p); }} />
        <div className="ps-grid">
          <Field label="Supplier"><select className="pdx-inp" value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">All</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Status"><select className="pdx-inp" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="ACTIVE">Active</option><option value="CANCELLED">Cancelled</option></select></Field>
          <Field label="Search"><input className="pdx-inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Purchase no, supplier bill" autoComplete="off" /></Field>
        </div>
      </div>
      <div className="ps-cards"><Card label="Purchases in this period" value={rows.filter((r) => r.status === 'ACTIVE').length} /><Card label="Amount bought" value={inr(total)} /></div>
      <div className="ps-table-wrap">
        <table className="ps-table">
          <thead><tr><th>Purchase</th><th>Date</th><th>Supplier</th><th className="r">Items</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={`click${p.status === 'CANCELLED' ? ' off' : ''}`} onClick={() => view(p.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') view(p.id); }}>
                <td><b>{p.bill_no}</b>{p.status === 'CANCELLED' && <span className="ps-pill out" style={{ marginLeft: 6 }}>Cancelled</span>}</td>
                <td>{dmy(p.purchase_date)}</td>
                <td>{p.supplier || '-'}{p.supplier_bill && <small>Bill {p.supplier_bill}</small>}</td>
                <td className="r">{p.lines}</td>
                <td className="r"><b>{inr(p.total)}</b></td>
              </tr>
            ))}
            {!loading && !rows.length && <tr><td colSpan={5}><p className="ps-empty">No purchases for these filters.</p></td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title={`Purchase ${open.bill_no}`} onClose={() => setOpen(null)}
          foot={cancelling ? (
            <><button type="button" className="pdx-btn" onClick={() => setCancelling(false)}>Keep it</button><button type="button" className="pdx-btn ps-btn-main" onClick={cancel} disabled={busy}>{busy ? 'Cancelling...' : 'Cancel this purchase'}</button></>
          ) : (open.status === 'ACTIVE' ? <button type="button" className="pdx-btn" onClick={() => { setCancelling(true); setErr(''); }}>Cancel purchase</button> : undefined)}>
          {err && <div className="ps-err" role="alert">{err}</div>}
          <p style={{ margin: '0 0 10px', fontSize: 14 }}>{dmy(open.purchase_date)} | {open.supplier || 'No supplier'}{open.supplier_bill && ` | Supplier bill ${open.supplier_bill}`} | entered by {open.by}</p>
          {open.status === 'CANCELLED' && <div className="ps-err">Cancelled: {open.cancel_reason}</div>}
          <div className="ps-table-wrap">
            <table className="ps-table">
              <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Cost</th><th className="r">Amount</th></tr></thead>
              <tbody>{open.items.map((l, i) => <tr key={i}><td>{l.name}<small>{l.sku}</small></td><td className="r">{qtyText(l.qty)} {l.unit}</td><td className="r">{inr(l.cost)}</td><td className="r">{inr(l.amount)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="ps-total big"><span>Total</span><span>{inr(open.total)}</span></div>
          {open.notes && <p style={{ fontSize: 13, color: '#6b7280' }}>{open.notes}</p>}
          {cancelling && <div style={{ marginTop: 12 }}><Field label="Reason for cancelling *"><input className="pdx-inp" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus autoComplete="off" /></Field></div>}
        </Modal>
      )}

      {form && (
        <Modal title="New purchase" onClose={() => setForm(null)} wide
          foot={<><button type="button" className="pdx-btn" onClick={() => setForm(null)}>Cancel</button><button type="button" className="pdx-btn ps-btn-main" onClick={save} disabled={busy}>{busy ? 'Saving...' : `Save purchase (${inr(formTotal)})`}</button></>}>
          {err && <div className="ps-err" role="alert">{err}</div>}
          <div className="ps-grid" style={{ marginTop: 0 }}>
            <Field label="Supplier"><select className="pdx-inp" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}><option value="">Not recorded</option>{suppliers.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Supplier's bill no"><input className="pdx-inp" value={form.supplier_bill} onChange={(e) => setForm({ ...form, supplier_bill: e.target.value })} autoComplete="off" /></Field>
            <Field label="Purchase date"><input className="pdx-inp" type="date" value={form.purchase_date} max={ymd(new Date())} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="ps-line" style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}><span>Category and item</span><span>Quantity</span><span>Cost each</span><span /></div>
            {form.lines.map((l, k) => (
              <div className="ps-line" key={k}>
                <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                  <select className="pdx-inp" value={l.cat} onChange={(e) => pickCat(k, e.target.value)} aria-label="Category">
                    <option value="">All categories</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    {hasUncategorised && <option value={NO_CAT}>No category</option>}
                  </select>
                  <select className="pdx-inp" value={l.item_id} onChange={(e) => pickItem(k, e.target.value)} aria-label="Item">
                    <option value="">{itemsOf(l.cat).length ? 'Choose an item' : 'No items in this category'}</option>
                    {itemsOf(l.cat).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <input className="pdx-inp" type="number" min="0" step="0.001" value={l.qty} onChange={(e) => setLine(k, { qty: e.target.value })} aria-label="Quantity" />
                <input className="pdx-inp" type="number" min="0" step="0.01" value={l.cost} onChange={(e) => setLine(k, { cost: e.target.value })} aria-label="Cost each" />
                <button type="button" className="ps-x" onClick={() => setForm({ ...form, lines: form.lines.length > 1 ? form.lines.filter((_, i) => i !== k) : form.lines })} aria-label="Remove line">×</button>
              </div>
            ))}
            <button type="button" className="pdx-btn" onClick={() => setForm({ ...form, lines: [...form.lines, { cat: '', item_id: '', qty: '', cost: '' }] })}>+ Add another item</button>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, fontSize: 14 }}><input type="checkbox" checked={form.update_cost} onChange={(e) => setForm({ ...form, update_cost: e.target.checked })} /> Use these costs as the items' cost price from now on</label>
          <div style={{ marginTop: 10 }}><Field label="Notes"><input className="pdx-inp" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} autoComplete="off" /></Field></div>
        </Modal>
      )}
    </PosShell>
  );
}