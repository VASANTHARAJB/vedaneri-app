import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFlash } from './DiscoverKit';
import { inr } from './PaymentCharts';
import { Card, Field, Modal, PosShell, Item, posApi, posDownload, qtyText, timeText } from './PosKit';

// What is on the shelf now. The number comes from adding up every purchase, sale, cancellation and adjustment for the item.
type Summary = { items: number; low: number; out: number; valueAtCost: number; valueAtPrice: number };
type Move = { id: number; qty: number; kind: string; label: string; ref_id: number | null; note: string; by: string; at: string };

export default function PosStock() {
  const { notice, flash, clear } = useFlash();
  const [items, setItems] = useState<Item[]>([]);
  const [sum, setSum] = useState<Summary | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [low, setLow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hist, setHist] = useState<{ item: Item; moves: Move[] | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set('q', q.trim());
      if (cat) p.set('category', cat);
      if (low) p.set('low', '1');
      const r = await posApi<{ items: Item[]; summary: Summary }>(`/stock?${p}`);
      setItems(r.items); setSum(r.summary);
    } catch (e: any) { flash('err', e?.message || 'Could not load the stock.'); }
    finally { setLoading(false); }
  }, [q, cat, low]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => { posApi<{ categories: string[] }>('/items?active=1').then((r) => setCats(r.categories)).catch(() => undefined); }, []);

  const open = async (item: Item) => {
    setHist({ item, moves: null });
    try { const r = await posApi<{ items: Move[] }>(`/stock/${item.id}/moves`); setHist({ item, moves: r.items }); }
    catch (e: any) { flash('err', e?.message || 'Could not load the history.'); setHist(null); }
  };

  return (
    <PosShell title="Stock" sub="What is on the shelf now. Items below their re-order level are marked, so you know what to buy." notice={notice} clear={clear}
      actions={<>
        <Link to="/pos-adjustments" className="pdx-btn" style={{ textDecoration: 'none' }}>Adjust stock</Link>
        <button type="button" className="pdx-btn" onClick={() => posDownload('/export?type=stock', 'pos-stock.csv').catch((e) => flash('err', e.message))}>Download CSV</button>
      </>}>
      {sum && (
        <div className="ps-cards">
          <Card label="Items kept in stock" value={sum.items} />
          <Card label="Low stock" value={sum.low} tone={sum.low ? 'warn' : undefined} sub="at or below the re-order level" />
          <Card label="Out of stock" value={sum.out} tone={sum.out ? 'warn' : undefined} />
          <Card label="Stock value (at cost)" value={inr(sum.valueAtCost)} sub={`${inr(sum.valueAtPrice)} at selling price`} />
        </div>
      )}
      <div className="pdx-card" style={{ marginBottom: 14 }}>
        <div className="ps-grid" style={{ marginTop: 0 }}>
          <Field label="Search"><input className="pdx-inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, code" autoComplete="off" /></Field>
          <Field label="Category"><select className="pdx-inp" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Show"><select className="pdx-inp" value={low ? '1' : ''} onChange={(e) => setLow(e.target.value === '1')}><option value="">All items</option><option value="1">Low or out of stock only</option></select></Field>
        </div>
      </div>
      <div className="ps-table-wrap">
        <table className="ps-table">
          <thead><tr><th>Item</th><th>Category</th><th className="r">In stock</th><th className="r">Re-order at</th><th className="r">Value (cost)</th><th /></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td><b>{i.name}</b><small>{i.sku}</small></td>
                <td>{i.category || '-'}</td>
                <td className="r"><span className={`ps-pill ${i.stock <= 0 ? 'out' : i.stock <= i.reorder_level ? 'low' : 'ok'}`}>{qtyText(i.stock)} {i.unit}</span></td>
                <td className="r">{qtyText(i.reorder_level)}</td>
                <td className="r">{inr(Math.max(0, i.stock) * i.cost)}</td>
                <td className="r"><button type="button" className="ps-link" onClick={() => open(i)}>History</button></td>
              </tr>
            ))}
            {!loading && !items.length && <tr><td colSpan={6}><p className="ps-empty">{low ? 'Nothing is low on stock.' : 'No items that keep stock yet. Add them under Items.'}</p></td></tr>}
          </tbody>
        </table>
      </div>
      {hist && (
        <Modal title={`${hist.item.name} - stock history`} onClose={() => setHist(null)} wide>
          {!hist.moves ? <p className="ps-empty">Loading...</p> : (
            <div className="ps-table-wrap" style={{ maxHeight: 420 }}>
              <table className="ps-table">
                <thead><tr><th>When</th><th>What</th><th className="r">Change</th><th>Note</th><th>By</th></tr></thead>
                <tbody>
                  {hist.moves.map((m) => (
                    <tr key={m.id}><td>{timeText(m.at)}</td><td>{m.label}</td><td className="r" style={{ color: m.qty < 0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>{m.qty > 0 ? '+' : ''}{qtyText(m.qty)}</td><td>{m.note}</td><td>{m.by}</td></tr>
                  ))}
                  {!hist.moves.length && <tr><td colSpan={5}><p className="ps-empty">No movements yet.</p></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </PosShell>
  );
}