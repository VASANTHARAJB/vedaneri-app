import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlash } from './DiscoverKit';
import { Field, PosShell, Item, posApi, qtyText, timeText } from './PosKit';

// Fix the stock when the shelf and the system disagree (damaged, lost, gifted, or a stock count). Every adjustment is kept with its reason and who made it.
type Adj = { id: number; qty: number; note: string; by: string; at: string; name: string; sku: string; unit: string };
const REASONS = ['Stock count', 'Damaged', 'Lost', 'Expired', 'Gift / offered at the ashram', 'Returned to supplier', 'Other'];

// These reasons always take stock OUT: type how many pieces went, and that number is subtracted (100 in stock, 2 damaged -> 98).
const REMOVAL_REASONS = ['Damaged', 'Lost', 'Expired', 'Gift / offered at the ashram', 'Returned to supplier'];

// counted = the stock becomes the number typed (a stock count); remove = the number typed is taken out; change = +5 adds, -2 removes
type How = 'counted' | 'remove' | 'change';
const howFor = (reason: string): How => (reason === 'Stock count' ? 'counted' : REMOVAL_REASONS.includes(reason) ? 'remove' : 'change');

export default function PosAdjustments() {
  const { notice, flash, clear } = useFlash();
  const [items, setItems] = useState<Item[]>([]);
  const [hist, setHist] = useState<Adj[]>([]);
  const [itemId, setItemId] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [how, setHow] = useState<How>(howFor(REASONS[0]));
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([posApi<{ items: Item[] }>('/stock'), posApi<{ items: Adj[] }>('/adjustments')]);
      setItems(s.items); setHist(h.items);
    } catch (e: any) { flash('err', e?.message || 'Could not load the page.'); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  // The way of entering follows the reason, so "Damaged" can never replace the stock with the damaged number
  const pickReason = (r: string) => { setReason(r); setHow(howFor(r)); setValue(''); setErr(''); };

  const item = useMemo(() => items.find((i) => String(i.id) === itemId), [items, itemId]);
  const num = value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const after = item && num !== null
    ? (how === 'counted' ? num : how === 'remove' ? item.stock - num : item.stock + num)
    : null;

  const save = async () => {
    setErr('');
    if (!item) { setErr('Please choose an item.'); return; }
    if (num === null) {
      setErr(how === 'counted' ? 'Please enter the quantity you counted.' : how === 'remove' ? 'Please enter how many to take out.' : 'Please enter the change, such as 5 or -2.');
      return;
    }
    if (how === 'counted' && num < 0) { setErr('The counted quantity cannot be below zero.'); return; }
    if (how === 'remove' && !(num > 0)) { setErr('Enter how many to take out, as a number above zero.'); return; }
    if (how === 'change' && num === 0) { setErr('The change cannot be zero.'); return; }
    if (after !== null && after < 0) { setErr(`Only ${qtyText(item.stock)} ${item.unit} in stock. You cannot take out more than that.`); return; }
    if (reason === 'Other' && !note.trim()) { setErr('Please write the reason.'); return; }
    setBusy(true);
    try {
      const text = reason === 'Other' ? note.trim() : [reason, note.trim()].filter(Boolean).join(': ');
      const body = how === 'counted' ? { counted: num } : { change: how === 'remove' ? -num : num };
      await posApi('/adjustments', { method: 'POST', body: { item_id: item.id, reason: text, ...body } });
      flash('ok', `Stock of ${item.name} updated.`);
      setValue(''); setNote(''); load();
    } catch (e: any) { setErr(e?.message || 'Could not save the adjustment.'); }
    finally { setBusy(false); }
  };

  const valueLabel =
    how === 'counted' ? `Quantity counted${item ? ` (${item.unit})` : ''}`
    : how === 'remove' ? `How many to take out${item ? ` (${item.unit})` : ''}`
    : 'Change (+5 to add, -2 to remove)';

  return (
    <PosShell title="Stock Adjustments" sub="Use this when the shelf and the system do not match. Normal buying and selling update the stock by themselves." notice={notice} clear={clear}>
      <div className="ps-two">
        <div className="pdx-card">
          <b style={{ fontSize: 15 }}>New adjustment</b>
          {err && <div className="ps-err" role="alert" style={{ marginTop: 10 }}>{err}</div>}
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <Field label="Item"><select className="pdx-inp" value={itemId} onChange={(e) => setItemId(e.target.value)}><option value="">Choose an item</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name} ({qtyText(i.stock)} {i.unit})</option>)}</select></Field>
            <Field label="Reason"><select className="pdx-inp" value={reason} onChange={(e) => pickReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
            {reason === 'Other' && (
              <div className="ps-seg" role="group" aria-label="How to adjust">
                <button type="button" className={how === 'change' ? 'on' : ''} onClick={() => { setHow('change'); setValue(''); }}>Add or remove some</button>
                <button type="button" className={how === 'counted' ? 'on' : ''} onClick={() => { setHow('counted'); setValue(''); }}>I counted the shelf</button>
              </div>
            )}
            {how === 'remove' && <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Type only the number that was {reason === 'Returned to supplier' ? 'returned' : reason === 'Gift / offered at the ashram' ? 'given' : reason.toLowerCase()}. It is taken out of the stock.</p>}
            {how === 'counted' && <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>The stock will become the number you count on the shelf.</p>}
            <Field label={valueLabel}>
              <input className="pdx-inp" type="number" step="0.001" min={how === 'counted' || how === 'remove' ? 0 : undefined} value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
            {item && after !== null && <p style={{ margin: 0, fontSize: 14 }}>Stock will change from <b>{qtyText(item.stock)}</b> to <b style={{ color: after < 0 ? '#b91c1c' : '#15803d' }}>{qtyText(after)}</b> {item.unit}.</p>}
            <Field label={reason === 'Other' ? 'Write the reason *' : 'More detail (optional)'}><input className="pdx-inp" value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" /></Field>
            <div><button type="button" className="pdx-btn ps-btn-main" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save adjustment'}</button></div>
          </div>
        </div>
        <div className="pdx-card">
          <b style={{ fontSize: 15 }}>Recent adjustments</b>
          <div className="ps-table-wrap" style={{ marginTop: 10, maxHeight: 480 }}>
            <table className="ps-table">
              <thead><tr><th>When</th><th>Item</th><th className="r">Change</th><th>Reason</th></tr></thead>
              <tbody>
                {hist.map((a) => (
                  <tr key={a.id}><td>{timeText(a.at)}<small>{a.by}</small></td><td>{a.name}</td><td className="r" style={{ color: a.qty < 0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>{a.qty > 0 ? '+' : ''}{qtyText(a.qty)} {a.unit}</td><td>{a.note}</td></tr>
                ))}
                {!hist.length && <tr><td colSpan={4}><p className="ps-empty">No adjustments yet.</p></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PosShell>
  );
}