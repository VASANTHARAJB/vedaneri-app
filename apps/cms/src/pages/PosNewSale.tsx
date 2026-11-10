import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFlash } from './DiscoverKit';
import { inr } from './PaymentCharts';
import { BillHead, Field, Item, MODE_LABEL, PosShell, SaleDetail, loadHead, posApi, printBill, qtyText, saveHead } from './PosKit';

// The counter screen. Type or scan to find an item (Enter adds it), change the quantity, take the payment, and print the bill.
type Line = { item: Item; qty: string; price: string };
type Done = { id: number; bill_no: string; total: number };
const MODES = Object.keys(MODE_LABEL);

export default function PosNewSale() {
  const { notice, flash, clear } = useFlash();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState('');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState('cash');
  const [ref, setRef] = useState('');
  const [tendered, setTendered] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<Done | null>(null);
  const [size, setSize] = useState<'80' | 'a5'>('80');
  const [head, setHead] = useState<BillHead>(loadHead());
  const search = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setItems((await posApi<{ items: Item[] }>('/items?active=1')).items); }
    catch (e: any) { flash('err', e?.message || 'Could not load the items.'); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  useEffect(() => { search.current?.focus(); }, [done]);

  const cats = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((i) => (!cat || i.category === cat) && (!t || i.name.toLowerCase().includes(t) || i.sku.toLowerCase().includes(t) || i.barcode.toLowerCase() === t)).slice(0, 120);
  }, [items, q, cat]);
  const inCart = (id: number) => lines.filter((l) => l.item.id === id).reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const left = (i: Item) => (i.track_stock ? i.stock - inCart(i.id) : Infinity);

  const add = (i: Item) => {
    if (left(i) < 1 && i.track_stock) { flash('err', `${i.name} is out of stock.`); return; }
    setDone(null); setErr('');
    setLines((ls) => {
      const at = ls.findIndex((l) => l.item.id === i.id && l.price === String(i.price));
      if (at >= 0) return ls.map((l, k) => (k === at ? { ...l, qty: qtyText((Number(l.qty) || 0) + 1) } : l));
      return [...ls, { item: i, qty: '1', price: String(i.price) }];
    });
  };
  const onEnter = () => {
    const t = q.trim().toLowerCase(); if (!t) return;
    // A scanned barcode or a typed code is matched exactly first; otherwise the first match in the list is used
    const exact = items.find((i) => i.barcode.toLowerCase() === t || i.sku.toLowerCase() === t) || (shown.length === 1 ? shown[0] : shown[0]);
    if (exact) { add(exact); setQ(''); } else flash('err', 'No item matches that.');
  };
  const setLine = (k: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, i) => (i === k ? { ...l, ...patch } : l)));
  const bump = (k: number, d: number) => setLines((ls) => ls.flatMap((l, i) => { if (i !== k) return [l]; const n = Math.round(((Number(l.qty) || 0) + d) * 1000) / 1000; return n <= 0 ? [] : [{ ...l, qty: qtyText(n) }]; }));

  const subtotal = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const disc = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const total = Math.round((subtotal - disc) * 100) / 100;
  const change = mode === 'cash' && tendered !== '' ? Math.round((Number(tendered) - total) * 100) / 100 : null;

  const reset = () => { setLines([]); setDiscount(''); setCustomer(''); setPhone(''); setMode('cash'); setRef(''); setTendered(''); setErr(''); };
  const save = async (print: boolean) => {
    setErr('');
    if (!lines.length) { setErr('Add at least one item.'); return; }
    if (lines.some((l) => !(Number(l.qty) > 0))) { setErr('Every quantity must be more than zero.'); return; }
    if (Number(discount) > subtotal) { setErr('The discount cannot be more than the bill.'); return; }
    setBusy(true);
    try {
      const r = await posApi<Done>('/sales', { method: 'POST', body: {
        lines: lines.map((l) => ({ item_id: l.item.id, qty: Number(l.qty), price: l.price === String(l.item.price) ? undefined : Number(l.price) })),
        discount: disc, customer_name: customer, phone, pay_mode: mode, pay_ref: ref,
      } });
      setDone(r); reset(); load();
      if (print) {
        try { const s = await posApi<SaleDetail>(`/sales/${r.id}`); if (!printBill(s, size)) flash('err', 'Saved, but the bill could not be prepared for printing. Print it from Sales.'); }
        catch { flash('err', 'Saved, but the bill could not be prepared for printing. Print it from Sales.'); }
      }
    } catch (e: any) { setErr(e?.message || 'Could not save the bill.'); load(); }
    finally { setBusy(false); }
  };
  const reprint = async () => { if (!done) return; try { const s = await posApi<SaleDetail>(`/sales/${done.id}`); printBill(s, size); } catch (e: any) { flash('err', e?.message || 'Could not print.'); } };

  return (
    <PosShell title="New Sale" sub="Type a name or code, or scan the barcode, and press Enter to add the item." notice={notice} clear={clear}>
      {done && (
        <div className="pdx-card" style={{ marginBottom: 14, borderColor: '#bbf7d0', background: '#f0fdf4' }} role="status">
          <b>Bill {done.bill_no} saved - {inr(done.total)}.</b>{' '}
          <button type="button" className="ps-link" onClick={reprint}>Print again</button>{' '}
          <button type="button" className="ps-link" onClick={() => setDone(null)}>Start next bill</button>
        </div>
      )}
      <div className="ps-pos">
        <div className="pdx-card">
          <div className="ps-grid" style={{ marginTop: 0, gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
            <input ref={search} className="pdx-inp" style={{ fontSize: 16, padding: '11px 14px' }} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
              placeholder="Search or scan..." aria-label="Search items" autoComplete="off" />
            <select className="pdx-inp" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          {loading ? <p className="ps-empty">Loading items...</p> : (
            <div className="ps-picks">
              {shown.map((i) => (
                <button key={i.id} type="button" className="ps-pick" onClick={() => add(i)} disabled={i.track_stock && left(i) < 1}>
                  <b>{i.name}</b><span>{inr(i.price)} / {i.unit}</span>
                  <span style={{ color: i.track_stock && i.stock <= i.reorder_level ? '#b45309' : '#6b7280' }}>{i.track_stock ? `${qtyText(i.stock)} in stock` : 'service'}</span>
                </button>
              ))}
              {!shown.length && <p className="ps-empty" style={{ gridColumn: '1 / -1' }}>{items.length ? 'No item matches.' : 'No items yet. Add them under Items first.'}</p>}
            </div>
          )}
        </div>

        <div className="pdx-card ps-cart">
          <b style={{ fontSize: 15 }}>Bill</b>
          {err && <div className="ps-err" role="alert" style={{ marginTop: 10 }}>{err}</div>}
          <div style={{ marginTop: 10 }}>
            {lines.map((l, k) => (
              <div key={`${l.item.id}-${k}`} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14 }}>
                  <b>{l.item.name}</b><button type="button" className="ps-link" onClick={() => bump(k, -1e9)} aria-label={`Remove ${l.item.name}`}>Remove</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <span className="ps-qty">
                    <button type="button" onClick={() => bump(k, -1)} aria-label="Less">-</button>
                    <input className="pdx-inp" type="number" min="0" step="any" value={l.qty} onChange={(e) => setLine(k, { qty: e.target.value })} aria-label={`Quantity of ${l.item.name}`} />
                    <button type="button" onClick={() => bump(k, 1)} aria-label="More" disabled={l.item.track_stock && left(l.item) < 1}>+</button>
                  </span>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>x</span>
                  <input className="pdx-inp" style={{ width: 84 }} type="number" min="0" step="0.01" value={l.price} onChange={(e) => setLine(k, { price: e.target.value })} aria-label={`Price of ${l.item.name}`} />
                  <b style={{ marginLeft: 'auto' }}>{inr((Number(l.qty) || 0) * (Number(l.price) || 0))}</b>
                </div>
              </div>
            ))}
            {!lines.length && <p className="ps-empty" style={{ padding: 14 }}>No items yet.</p>}
          </div>
          <div className="ps-total"><span>Sub total</span><span>{inr(subtotal)}</span></div>
          <div className="ps-total"><span>Discount</span><input className="pdx-inp" style={{ width: 100, textAlign: 'right' }} type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} aria-label="Discount" /></div>
          <div className="ps-total big"><span>Total</span><span>{inr(total)}</span></div>

          <div className="ps-seg" style={{ marginTop: 12 }} role="group" aria-label="Payment mode">
            {MODES.map((m) => <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{MODE_LABEL[m]}</button>)}
          </div>
          {mode === 'cash' && (
            <div className="ps-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Cash given"><input className="pdx-inp" type="number" min="0" step="0.01" value={tendered} onChange={(e) => setTendered(e.target.value)} /></Field>
              <Field label="Change to return"><div className="pdx-inp" style={{ background: '#faf5f0', fontWeight: 800, color: change !== null && change < 0 ? '#b91c1c' : '#15803d' }}>{change === null ? '-' : change < 0 ? `short ${inr(-change)}` : inr(change)}</div></Field>
            </div>
          )}
          {(mode === 'upi' || mode === 'card' || mode === 'other') && <div style={{ marginTop: 10 }}><Field label="Reference (optional)"><input className="pdx-inp" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UPI / card reference" autoComplete="off" /></Field></div>}
          <div className="ps-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Customer (optional)"><input className="pdx-inp" value={customer} onChange={(e) => setCustomer(e.target.value)} autoComplete="off" /></Field>
            <Field label="Mobile (optional)"><input className="pdx-inp" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" /></Field>
          </div>
          <div className="ps-seg" style={{ marginTop: 12 }} role="group" aria-label="Bill size">
            <button type="button" className={size === '80' ? 'on' : ''} onClick={() => setSize('80')}>80 mm receipt</button>
            <button type="button" className={size === 'a5' ? 'on' : ''} onClick={() => setSize('a5')}>A5 bill</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="pdx-btn ps-btn-main" style={{ flex: 1 }} onClick={() => save(true)} disabled={busy || !lines.length}>{busy ? 'Saving...' : 'Save and print'}</button>
            <button type="button" className="pdx-btn" onClick={() => save(false)} disabled={busy || !lines.length}>Save only</button>
            <button type="button" className="pdx-btn" onClick={reset} disabled={busy || !lines.length}>Clear</button>
          </div>
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Bill heading</summary>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              <input className="pdx-inp" aria-label="Shop name" value={head.name} onChange={(e) => { const h = { ...head, name: e.target.value }; setHead(h); saveHead(h); }} />
              <input className="pdx-inp" aria-label="Address line" value={head.line} onChange={(e) => { const h = { ...head, line: e.target.value }; setHead(h); saveHead(h); }} />
              <input className="pdx-inp" aria-label="Footer line" value={head.footer} onChange={(e) => { const h = { ...head, footer: e.target.value }; setHead(h); saveHead(h); }} />
              <small style={{ color: '#6b7280' }}>Printed at the top and bottom of every bill on this computer.</small>
            </div>
          </details>
        </div>
      </div>
    </PosShell>
  );
}