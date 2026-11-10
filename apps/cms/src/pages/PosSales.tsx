import React, { useCallback, useEffect, useState } from 'react';
import { useFlash } from './DiscoverKit';
import { inr } from './PaymentCharts';
import { Card, Field, MODE_LABEL, Modal, Preset, PosShell, RangeBar, SaleDetail, SaleRow, posApi, posDownload, printBill, qtyText, rangeFor, timeText } from './PosKit';

// Every bill that has been made. Open one to print it again or cancel it (cancelling puts the stock back; the bill number stays in the record).
type Summary = { bills: number; total: number; cancelled: number; discount: number; gst: number };

export default function PosSales() {
  const { notice, flash, clear } = useFlash();
  const first = rangeFor('today');
  const [from, setFrom] = useState(first.from);
  const [to, setTo] = useState(first.to);
  const [preset, setPreset] = useState<Preset>('today');
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [sum, setSum] = useState<Summary | null>(null);
  const [capped, setCapped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<SaleDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const params = useCallback(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (status) p.set('status', status);
    if (mode) p.set('mode', mode);
    if (q.trim()) p.set('q', q.trim());
    return p;
  }, [from, to, status, mode, q]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await posApi<{ items: SaleRow[]; summary: Summary; capped: boolean }>(`/sales?${params()}`);
      setRows(r.items); setSum(r.summary); setCapped(r.capped);
    } catch (e: any) { flash('err', e?.message || 'Could not load the sales.'); }
    finally { setLoading(false); }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const view = async (id: number) => {
    try { setOpen(await posApi<SaleDetail>(`/sales/${id}`)); setCancelling(false); setReason(''); setErr(''); }
    catch (e: any) { flash('err', e?.message || 'Could not open the bill.'); }
  };
  const cancel = async () => {
    if (!open) return;
    if (!reason.trim()) { setErr('Please write the reason for cancelling.'); return; }
    setBusy(true); setErr('');
    try { await posApi(`/sales/${open.id}/cancel`, { method: 'POST', body: { reason } }); flash('ok', `Bill ${open.bill_no} cancelled and the stock put back.`); setOpen(null); load(); }
    catch (e: any) { setErr(e?.message || 'Could not cancel the bill.'); }
    finally { setBusy(false); }
  };

  return (
    <PosShell title="Sales" sub="All bills. Open a bill to print it again or cancel it." notice={notice} clear={clear}
      actions={<button type="button" className="pdx-btn" onClick={() => posDownload(`/export?type=sales&${params()}`, 'pos-sales.csv').catch((e) => flash('err', e.message))}>Download CSV</button>}>
      <div className="pdx-card" style={{ marginBottom: 14 }}>
        <RangeBar from={from} to={to} preset={preset} onChange={(f, t, p) => { setFrom(f); setTo(t); setPreset(p); }} />
        <div className="ps-grid">
          <Field label="Status"><select className="pdx-inp" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="ACTIVE">Active</option><option value="CANCELLED">Cancelled</option></select></Field>
          <Field label="Payment"><select className="pdx-inp" value={mode} onChange={(e) => setMode(e.target.value)}><option value="">All</option>{Object.entries(MODE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Search"><input className="pdx-inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill no, customer, mobile" autoComplete="off" /></Field>
        </div>
      </div>
      {sum && <div className="ps-cards"><Card label="Bills" value={sum.bills} sub={sum.cancelled ? `${sum.cancelled} cancelled` : undefined} /><Card label="Sales" value={inr(sum.total)} tone="good" /><Card label="Discount given" value={inr(sum.discount)} /><Card label="GST inside the sales" value={inr(sum.gst)} /></div>}
      {capped && <div className="pdx-card" style={{ background: '#fffbeb', borderColor: '#fde68a', marginBottom: 14, fontSize: 13 }}>Only the latest 500 bills are shown. Narrow the dates to see the rest.</div>}
      <div className="ps-table-wrap">
        <table className="ps-table">
          <thead><tr><th>Bill</th><th>Date</th><th>Customer</th><th className="r">Items</th><th>Payment</th><th className="r">Total</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className={`click${s.status === 'CANCELLED' ? ' off' : ''}`} onClick={() => view(s.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') view(s.id); }}>
                <td><b>{s.bill_no}</b>{s.status === 'CANCELLED' && <span className="ps-pill out" style={{ marginLeft: 6 }}>Cancelled</span>}</td>
                <td>{timeText(s.sale_date)}<small>{s.by}</small></td>
                <td>{s.customer_name || '-'}<small>{s.phone}</small></td>
                <td className="r">{s.lines}</td>
                <td>{MODE_LABEL[s.pay_mode] || s.pay_mode}</td>
                <td className="r"><b>{inr(s.total)}</b></td>
              </tr>
            ))}
            {!loading && !rows.length && <tr><td colSpan={6}><p className="ps-empty">No bills for these filters.</p></td></tr>}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title={`Bill ${open.bill_no}`} onClose={() => setOpen(null)}
          foot={cancelling ? (
            <><button type="button" className="pdx-btn" onClick={() => setCancelling(false)}>Keep the bill</button><button type="button" className="pdx-btn ps-btn-main" onClick={cancel} disabled={busy}>{busy ? 'Cancelling...' : 'Cancel this bill'}</button></>
          ) : (
            <>
              {open.status === 'ACTIVE' && <button type="button" className="pdx-btn" onClick={() => { setCancelling(true); setErr(''); }}>Cancel bill</button>}
              <button type="button" className="pdx-btn" onClick={() => printBill(open, 'a5')}>Print A5</button>
              <button type="button" className="pdx-btn ps-btn-main" onClick={() => printBill(open, '80')}>Print receipt</button>
            </>
          )}>
          {err && <div className="ps-err" role="alert">{err}</div>}
          <p style={{ margin: '0 0 10px', fontSize: 14 }}>{timeText(open.sale_date)} by {open.by}{open.customer_name && <> | <b>{open.customer_name}</b> {open.phone}</>}</p>
          {open.status === 'CANCELLED' && <div className="ps-err">Cancelled: {open.cancel_reason}</div>}
          <div className="ps-table-wrap">
            <table className="ps-table">
              <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
              <tbody>{open.items.map((l, i) => <tr key={i}><td>{l.name}{l.gst_percent ? <small>GST {l.gst_percent}%</small> : null}</td><td className="r">{qtyText(l.qty)} {l.unit}</td><td className="r">{inr(l.price)}</td><td className="r">{inr(l.amount)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="ps-total"><span>Sub total</span><span>{inr(open.subtotal)}</span></div>
          {open.discount > 0 && <div className="ps-total"><span>Discount</span><span>-{inr(open.discount)}</span></div>}
          <div className="ps-total big"><span>Total</span><span>{inr(open.total)}</span></div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>Paid by {MODE_LABEL[open.pay_mode] || open.pay_mode}{open.pay_ref && ` (${open.pay_ref})`}. GST inside the bill: {inr(open.gst_total)}.</p>
          {cancelling && <div style={{ marginTop: 12 }}><Field label="Reason for cancelling *"><input className="pdx-inp" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus autoComplete="off" /></Field></div>}
        </Modal>
      )}
    </PosShell>
  );
}