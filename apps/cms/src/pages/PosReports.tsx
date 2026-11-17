import React, { useCallback, useEffect, useState } from 'react';
import { authHeader, failText, readJson, useFlash } from './DiscoverKit';
import { inr } from './PaymentCharts';
import { Bars, Card, MODE_LABEL, POS_BASE, Preset, PosShell, RangeBar, loadHead, posApi, qtyText, rangeFor, shortDay } from './PosKit';
import { useAuth } from '../lib/auth';
import { buildReportXlsx } from './posReportXlsx';
import type { Rep } from './posReportXlsx';

// Sales, GST and profit for a period. Profit = sales - GST inside the sales - the cost of what was sold (the item's cost when it was sold).

// The name and address printed at the top of the downloaded report.
// Write the address lines, phone number and GST / registration number here, one per line. If this list is empty,
// the address line of "Bill heading" on the New Sale screen is used instead.
const ORG_NAME = 'SRI DAKSHINAMURTI SEVA SAMITI';
const ORG_ADDRESS: string[] = [];

const ddmmyyyy = (ymd: string) => (/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${ymd.slice(8, 10)}${ymd.slice(5, 7)}${ymd.slice(0, 4)}` : '');

async function posText(path: string): Promise<string> {
  const res = await fetch(`${POS_BASE}${path}`, { headers: authHeader(), cache: 'no-store' });
  if (!res.ok) throw new Error(failText(await readJson(res), 'Could not make the report.'));
  return res.text();
}

export default function PosReports() {
  const { notice, flash, clear } = useFlash();
  const auth = useAuth() as any;
  const first = rangeFor('month');
  const [from, setFrom] = useState(first.from);
  const [to, setTo] = useState(first.to);
  const [preset, setPreset] = useState<Preset>('month');
  const [r, setR] = useState<Rep | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const params = useCallback(() => { const p = new URLSearchParams(); if (from) p.set('from', from); if (to) p.set('to', to); return p; }, [from, to]);
  const load = useCallback(async () => {
    setLoading(true);
    try { setR(await posApi<Rep>(`/reports?${params()}`)); }
    catch (e: any) { flash('err', e?.message || 'Could not make the report.'); }
    finally { setLoading(false); }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  // One file with everything: Summary, Sales, Purchases and Stock sheets
  const download = async () => {
    setBusy(true);
    try {
      const [rep, salesCsv, purchasesCsv, stockCsv] = await Promise.all([
        posApi<Rep>(`/reports?${params()}`),
        posText(`/export?type=sales&${params()}`),
        posText(`/export?type=purchases&${params()}`),
        posText('/export?type=stock'),
      ]);
      const head = loadHead();
      const bytes = await buildReportXlsx({
        org: { name: ORG_NAME, address: ORG_ADDRESS.length ? ORG_ADDRESS : [head.line].filter(Boolean) },
        from, to, generatedAt: new Date(), generatedBy: String(auth?.user?.email || auth?.user?.full_name || ''),
        rep, salesCsv, purchasesCsv, stockCsv, modeLabel: MODE_LABEL,
      });
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const span = from || to ? `-${ddmmyyyy(from) || 'start'}-to-${ddmmyyyy(to) || 'today'}` : '-all';
      a.href = url; a.download = `SDSS-sale-report${span}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) { flash('err', e?.message || 'Could not make the report.'); }
    finally { setBusy(false); }
  };

  const s = r?.summary;
  const maxCat = Math.max(1, ...(r?.byCategory.map((c) => c.amount) || [1]));
  return (
    <PosShell title="POS Reports" sub="Sales, GST and profit for the dates you choose. Cancelled bills are left out." notice={notice} clear={clear}
      actions={<button type="button" className="pdx-btn ps-btn-main" onClick={download} disabled={busy}>{busy ? 'Preparing the report...' : 'Download report (Excel)'}</button>}>
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