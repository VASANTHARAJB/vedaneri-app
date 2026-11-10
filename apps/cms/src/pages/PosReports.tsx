import React, { useCallback, useEffect, useState } from 'react';
import { useFlash } from './DiscoverKit';
import { inr } from './PaymentCharts';
import { Bars, Card, MODE_LABEL, Preset, PosShell, RangeBar, posApi, posDownload, qtyText, rangeFor, shortDay } from './PosKit';

// Sales, GST and profit for a period. Profit = sales - GST inside the sales - the cost of what was sold (the item's cost when it was sold).
type Rep = {
  summary: { bills: number; subtotal: number; discount: number; gst: number; total: number; cost: number; profit: number; purchases: number; purchaseBills: number };
  byDay: { d: string; bills: number; total: number }[]; byMode: { mode: string; bills: number; total: number }[];
  byItem: { name: string; unit: string; qty: number; amount: number; profit: number }[]; byCategory: { category: string; qty: number; amount: number }[];
};

export default function PosReports() {
  const { notice, flash, clear } = useFlash();
  const first = rangeFor('month');
  const [from, setFrom] = useState(first.from);
  const [to, setTo] = useState(first.to);
  const [preset, setPreset] = useState<Preset>('month');
  const [r, setR] = useState<Rep | null>(null);
  const [loading, setLoading] = useState(true);

  const params = useCallback(() => { const p = new URLSearchParams(); if (from) p.set('from', from); if (to) p.set('to', to); return p; }, [from, to]);
  const load = useCallback(async () => {
    setLoading(true);
    try { setR(await posApi<Rep>(`/reports?${params()}`)); }
    catch (e: any) { flash('err', e?.message || 'Could not make the report.'); }
    finally { setLoading(false); }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const s = r?.summary;
  const maxCat = Math.max(1, ...(r?.byCategory.map((c) => c.amount) || [1]));
  const dl = (type: string, file: string) => posDownload(`/export?type=${type}&${params()}`, file).catch((e) => flash('err', e.message));
  return (
    <PosShell title="POS Reports" sub="Sales, GST and profit for the dates you choose. Cancelled bills are left out." notice={notice} clear={clear}
      actions={<>
        <button type="button" className="pdx-btn" onClick={() => dl('sales', 'pos-sales.csv')}>Sales CSV</button>
        <button type="button" className="pdx-btn" onClick={() => dl('purchases', 'pos-purchases.csv')}>Purchases CSV</button>
        <button type="button" className="pdx-btn" onClick={() => posDownload('/export?type=stock', 'pos-stock.csv').catch((e) => flash('err', e.message))}>Stock CSV</button>
      </>}>
      <div className="pdx-card" style={{ marginBottom: 14 }}><RangeBar from={from} to={to} preset={preset} onChange={(f, t, p) => { setFrom(f); setTo(t); setPreset(p); }} /></div>
      {!r || !s ? <p className="ps-empty">{loading ? 'Loading...' : 'No data.'}</p> : (
        <>
          <div className="ps-cards">
            <Card label="Sales" value={inr(s.total)} sub={`${s.bills} bill${s.bills === 1 ? '' : 's'}`} tone="good" />
            <Card label="GST inside the sales" value={inr(s.gst)} />
            <Card label="Cost of goods sold" value={inr(s.cost)} />
            <Card label="Profit" value={inr(s.profit)} sub="sales - GST - cost" tone={s.profit < 0 ? 'warn' : 'good'} />
            <Card label="Discount given" value={inr(s.discount)} />
            <Card label="Bought from suppliers" value={inr(s.purchases)} sub={`${s.purchaseBills} purchase${s.purchaseBills === 1 ? '' : 's'}`} />
          </div>
          <div className="ps-two" style={{ marginBottom: 14 }}>
            <div className="pdx-card"><b style={{ fontSize: 15 }}>Sales by day</b><div style={{ marginTop: 10 }}><Bars data={r.byDay.map((x) => ({ label: shortDay(x.d), value: x.total }))} /></div></div>
            <div className="pdx-card">
              <b style={{ fontSize: 15 }}>By payment mode</b>
              <div className="ps-table-wrap" style={{ marginTop: 10 }}>
                <table className="ps-table"><thead><tr><th>Mode</th><th className="r">Bills</th><th className="r">Amount</th></tr></thead><tbody>
                  {r.byMode.map((m) => <tr key={m.mode}><td>{MODE_LABEL[m.mode] || m.mode}</td><td className="r">{m.bills}</td><td className="r"><b>{inr(m.total)}</b></td></tr>)}
                  {!r.byMode.length && <tr><td colSpan={3}><p className="ps-empty">No sales.</p></td></tr>}
                </tbody></table>
              </div>
              <b style={{ fontSize: 15, display: 'block', marginTop: 16 }}>By category</b>
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                {r.byCategory.map((c) => <div key={c.category}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{c.category}</span><b>{inr(c.amount)}</b></div><div className="ps-bar"><i style={{ width: `${(c.amount / maxCat) * 100}%` }} /></div></div>)}
              </div>
            </div>
          </div>
          <div className="pdx-card">
            <b style={{ fontSize: 15 }}>Items sold {r.byItem.length >= 100 ? '(top 100)' : ''}</b>
            <div className="ps-table-wrap" style={{ marginTop: 10, maxHeight: 480 }}>
              <table className="ps-table">
                <thead><tr><th>Item</th><th className="r">Quantity</th><th className="r">Sales</th><th className="r">Profit (with GST)</th></tr></thead>
                <tbody>
                  {r.byItem.map((i, k) => <tr key={`${i.name}-${k}`}><td>{i.name}</td><td className="r">{qtyText(i.qty)} {i.unit}</td><td className="r"><b>{inr(i.amount)}</b></td><td className="r" style={{ color: i.profit < 0 ? '#b91c1c' : undefined }}>{inr(i.profit)}</td></tr>)}
                  {!r.byItem.length && <tr><td colSpan={4}><p className="ps-empty">No sales in this period.</p></td></tr>}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 0' }}>The profit per item is the sale minus the cost, before taking out GST, so it is a little higher than the Profit card above.</p>
          </div>
        </>
      )}
    </PosShell>
  );
}