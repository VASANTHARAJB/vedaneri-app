import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityDots, Delta, Donut, PDX_CSS, RevenueChart, inr, makeBuckets, rangeOf, short, when, ymd } from './PaymentCharts';
import type { Gran, Money, Preset } from './PaymentCharts';
import { API, CSS, Notice, authHeader, failText, readJson, useFlash } from './DiscoverKit';

// API points at .../api/v1/discover. The Payments API is .../api/v1/payments
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const PAY = `${API_BASE}/payments`;

type Summary = {
  paid: Money; pending: Money; failed: Money; average: number; successRate: number; payers: number; previous: Money | null;
  sources: { source: string; count: number; amount: number }[];
  daily: { day: string; source: string; count: number; amount: number }[];
  activity: { weekday: number; block: number; count: number }[];
  top: { item: string; source: string; count: number; amount: number }[];
  donors: { name: string; key: string; count: number; amount: number; last: string }[];
};
type Row = {
  ref: string; source: string; item: string; amount: number; status: 'PAID' | 'PENDING' | 'FAILED';
  name: string; email: string | null; phone: string | null; receipt_no: string | null; mode: string;
  order_id: string | null; payment_id: string | null; paid_at: string;
};

const TYPE: Record<string, string> = { donation: 'Donation', seva: 'Seva', camp: 'Camp', magazine: 'Magazine' };
const TYPES = Object.keys(TYPE);
const SRC_COLOR: Record<string, string> = { donation: '#7a1c1c', seva: '#ea580c', camp: '#e0a526', magazine: '#7c3aed' };
const SERIES = TYPES.map((t) => ({ key: t, label: TYPE[t], color: SRC_COLOR[t] }));
const STATUS_LABEL: Record<string, string> = { PAID: 'Paid', PENDING: 'Pending', FAILED: 'Failed' };
const STATUS_COLOR: Record<string, string> = { PAID: '#15803d', PENDING: '#b45309', FAILED: '#b91c1c' };

export default function PaymentsDashboard() {
  const { notice, flash, clear } = useFlash();
  const [preset, setPreset] = useState<Preset>('30');
  const [from, setFrom] = useState(rangeOf('30').from);
  const [to, setTo] = useState(rangeOf('30').to);
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [qNow, setQNow] = useState('');
  const [page, setPage] = useState(1);
  const [gran, setGran] = useState<Gran>('day');
  const [mode, setMode] = useState<'bars' | 'area'>('bars');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const LIMIT = 25;
  const seq = useRef(0);

  // The search box waits a moment after typing before it asks the server
  useEffect(() => {
    const t = setTimeout(() => { setQNow(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const qs = useCallback((withText: boolean) => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (source) p.set('source', source);
    if (status) p.set('status', status);
    if (withText && qNow) p.set('q', qNow);
    return p;
  }, [from, to, source, status, qNow]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setErr('');
    try {
      const sp = qs(false); // the charts follow the dates and the filters, not the search words
      const lp = qs(true); lp.set('page', String(page)); lp.set('limit', String(LIMIT));
      const [a, b] = await Promise.all([
        fetch(`${PAY}/admin/summary?${sp}`, { headers: authHeader(), cache: 'no-store' }),
        fetch(`${PAY}/admin/list?${lp}`, { headers: authHeader(), cache: 'no-store' }),
      ]);
      const [da, db] = await Promise.all([readJson(a), readJson(b)]);
      if (!a.ok) throw new Error(failText(da, `Could not load the summary (${a.status}).`));
      if (!b.ok) throw new Error(failText(db, `Could not load the payments (${b.status}).`));
      if (mine !== seq.current) return; // a newer request has started
      setSummary(da); setRows(db.items || []); setTotal(db.total || 0);
    } catch (e: any) {
      if (mine === seq.current) setErr(`${e?.message || 'Could not load the payments.'} [${PAY}]`);
    } finally { if (mine === seq.current) setLoading(false); }
  }, [qs, page]);
  useEffect(() => { load(); }, [load]);

  function choose(p: Preset) {
    setPreset(p); setPage(1);
    if (p !== 'custom') { const r = rangeOf(p); setFrom(r.from); setTo(r.to); }
    // A long period reads better by week or month
    if (p === 'year') setGran('month'); else if (p === 'all') setGran('month'); else setGran('day');
  }

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(`${PAY}/admin/export?${qs(true)}`, { headers: authHeader() });
      if (!res.ok) { flash('err', failText(await readJson(res), 'Could not make the file.')); return; }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `payments-${ymd(new Date())}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy(false); }
  }

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const filtered = !!(source || status || qNow);
  const buckets = summary ? makeBuckets(summary.daily, gran, from, to) : [];
  const typeParts = summary ? summary.sources.map((s) => ({ key: s.source, label: TYPE[s.source] || s.source, value: s.amount, color: SRC_COLOR[s.source] || '#888' })) : [];
  const healthParts = summary ? [
    { key: 'PAID', label: `Paid (${summary.paid.count})`, value: summary.paid.count, color: STATUS_COLOR.PAID },
    { key: 'PENDING', label: `Pending (${summary.pending.count})`, value: summary.pending.count, color: STATUS_COLOR.PENDING },
    { key: 'FAILED', label: `Failed (${summary.failed.count})`, value: summary.failed.count, color: STATUS_COLOR.FAILED },
  ] : [];
  const topMax = Math.max(1, ...(summary?.top.map((t) => t.amount) || [1]));

  return (
    <div className="dc">
      <style>{CSS}</style>
      <style>{PDX_CSS}</style>
      <Notice notice={notice} onClear={clear} />
      <div className="pdx">
        <div className="pdx-top">
          <div>
            <h1 className="pdx-title">Payments</h1>
            <p className="pdx-sub" style={{ fontSize: 14 }}>Donations, sevas, camp fees and magazine subscriptions. Money is counted only when a payment is paid.</p>
          </div>
          <button type="button" className="pdx-btn" onClick={download} disabled={busy || loading || total === 0}>{busy ? 'Preparing...' : 'Download CSV'}</button>
        </div>

        {/* Filters */}
        <div className="pdx-card" style={{ marginBottom: 14 }}>
          <div className="pdx-row" style={{ marginBottom: 12 }} role="group" aria-label="Period">
            {([['month', 'This month'], ['30', 'Last 30 days'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Choose dates']] as [Preset, string][]).map(([id, label]) => (
              <button key={id} type="button" className={`pdx-btn${preset === id ? ' on' : ''}`} aria-pressed={preset === id} onClick={() => choose(id)}>{label}</button>
            ))}
          </div>
          <div className="pdx-row">
            {preset === 'custom' && (
              <>
                <div><label className="pdx-lbl" htmlFor="pf">From</label><input id="pf" className="pdx-inp" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></div>
                <div><label className="pdx-lbl" htmlFor="pt">To</label><input id="pt" className="pdx-inp" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></div>
              </>
            )}
            <div>
              <label className="pdx-lbl" htmlFor="ps">Type</label>
              <select id="ps" className="pdx-inp" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}>
                <option value="">All types</option>
                {TYPES.map((v) => <option key={v} value={v}>{TYPE[v]}</option>)}
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="pst">Status</label>
              <select id="pst" className="pdx-inp" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label className="pdx-lbl" htmlFor="pq">Search the payments table</label>
              <input id="pq" className="pdx-inp" style={{ width: '100%' }} value={q} maxLength={80} placeholder="Name, email, phone, receipt or payment id" onChange={(e) => setQ(e.target.value)} />
            </div>
            {filtered && <button type="button" className="pdx-btn" onClick={() => { setSource(''); setStatus(''); setQ(''); setQNow(''); setPage(1); }}>Clear filters</button>}
          </div>
        </div>

        {err ? (
          <div role="alert" className="pdx-err">{err} <button type="button" className="pdx-link" onClick={load}>Try again</button></div>
        ) : (
          <div className={loading && summary ? 'pdx-busy' : ''} aria-busy={loading}>
            {/* Headline figures */}
            <div className="pdx-grid pdx-g-kpi">
              <div className="pdx-card pdx-hero">
                <p className="pdx-sub">Collected</p>
                <p className="pdx-big">{summary ? inr(summary.paid.amount) : '...'}</p>
                {summary && <Delta now={summary.paid.amount} before={summary.previous} />}
                <p className="pdx-sub" style={{ marginTop: 10 }}>{summary ? `${summary.paid.count} paid payments from ${summary.payers} ${summary.payers === 1 ? 'person' : 'people'}` : ''}</p>
              </div>
              <div className="pdx-card">
                <p className="pdx-kpi-l">Average payment</p>
                <p className="pdx-kpi-n">{summary ? inr(summary.average) : '...'}</p>
                <p className="pdx-sub">of the paid payments</p>
              </div>
              <div className="pdx-card">
                <p className="pdx-kpi-l">Pending</p>
                <p className="pdx-kpi-n" style={{ color: STATUS_COLOR.PENDING }}>{summary ? inr(summary.pending.amount) : '...'}</p>
                <p className="pdx-sub">{summary ? `${summary.pending.count} not completed` : ''}</p>
              </div>
              <div className="pdx-card">
                <p className="pdx-kpi-l">Failed</p>
                <p className="pdx-kpi-n" style={{ color: STATUS_COLOR.FAILED }}>{summary ? summary.failed.count : '...'}</p>
                <p className="pdx-sub">{summary ? `${inr(summary.failed.amount)} not received` : ''}</p>
              </div>
            </div>

            {/* Revenue flow + split */}
            <div className="pdx-grid pdx-g-main">
              <section className="pdx-card" aria-label="Revenue flow">
                <div className="pdx-head">
                  <div><h3>Revenue flow</h3><p className="pdx-sub">Money collected, by type</p></div>
                  <div className="pdx-row">
                    <div className="pdx-row" role="group" aria-label="Group by">
                      {(['day', 'week', 'month'] as Gran[]).map((g) => <button key={g} type="button" className={`pdx-btn${gran === g ? ' on' : ''}`} aria-pressed={gran === g} onClick={() => setGran(g)}>{g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}</button>)}
                    </div>
                    <div className="pdx-row" role="group" aria-label="Chart style">
                      {(['bars', 'area'] as const).map((m) => <button key={m} type="button" className={`pdx-btn${mode === m ? ' on' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'bars' ? 'Bars' : 'Line'}</button>)}
                    </div>
                  </div>
                </div>
                <RevenueChart data={buckets} mode={mode} series={SERIES} />
                {mode === 'bars' ? <div className="pdx-key">{TYPES.map((t) => <span key={t}><i style={{ background: SRC_COLOR[t] }} />{TYPE[t]}</span>)}</div> : <div className="pdx-key">The line shows all types together. Hover a point for the split.</div>}
              </section>

              <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                <section className="pdx-card" aria-label="Collected by type">
                  <h3>Where it came from</h3>
                  <p className="pdx-sub" style={{ marginBottom: 10 }}>Share of the money collected</p>
                  <Donut parts={typeParts} centerTop="Total" centerBottom={summary ? short(summary.paid.amount) : '...'} label="Money collected by type" />
                </section>
                <section className="pdx-card" aria-label="Payment health">
                  <h3>Payment health</h3>
                  <p className="pdx-sub" style={{ marginBottom: 10 }}>How many attempts ended well</p>
                  <Donut parts={healthParts} centerTop="Success" centerBottom={summary ? `${summary.successRate}%` : '...'} label="Share of paid, pending and failed payments" />
                </section>
              </div>
            </div>

            {/* Top items, top payers, activity */}
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="Top items">
                <h3>Top items</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>What brought in the most</p>
                {!summary || summary.top.length === 0 ? <p className="pdx-empty">Nothing yet.</p> : (
                  <ul className="pdx-seg">
                    {summary.top.map((t) => (
                      <li key={`${t.source}-${t.item}`}>
                        <div className="r"><span className="n" title={t.item}>{t.item}</span><b>{inr(t.amount)}</b></div>
                        <div className="pdx-bar" role="img" aria-label={`${t.item}: ${inr(t.amount)}`}><div style={{ width: `${(t.amount / topMax) * 100}%`, background: SRC_COLOR[t.source] || '#7a1c1c' }} /></div>
                        <p className="pdx-sub">{TYPE[t.source]} · {t.count} payment{t.count === 1 ? '' : 's'}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="pdx-card" aria-label="Top supporters">
                <h3>Top supporters</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Devotees who gave the most in this period</p>
                {!summary || summary.donors.length === 0 ? <p className="pdx-empty">Nothing yet.</p> : summary.donors.map((d) => (
                  <div className="pdx-donor" key={d.key}>
                    <span className="pdx-ava" aria-hidden="true">{(d.name || d.key || '?').trim().charAt(0).toUpperCase()}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name || d.key}</p>
                      <p className="pdx-sub">{d.count} payment{d.count === 1 ? '' : 's'}{d.last ? ` · last ${when(d.last).split(',')[0]}` : ''}</p>
                    </div>
                    <b>{inr(d.amount)}</b>
                  </div>
                ))}
              </section>

              <section className="pdx-card" aria-label="When people pay">
                <h3>When people pay</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Paid payments by weekday and time of day (server clock)</p>
                {summary && summary.activity.length > 0 ? <ActivityDots data={summary.activity} /> : <p className="pdx-empty">Nothing yet.</p>}
              </section>
            </div>

            {/* The payments */}
            <section className="pdx-card" aria-label="Payments" style={{ marginBottom: 4 }}>
              <div className="pdx-head">
                <h3>Payments</h3>
                <span className="pdx-sub">{loading ? 'Loading...' : `${total} found`}</span>
              </div>
              <div className="pdx-tablewrap">
                <table>
                  <thead>
                    <tr>{['Date', 'Type', 'Item', 'Name', 'Amount', 'Status', ''].map((h, i) => <th key={i} scope="col" style={{ textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {!loading && rows.length === 0 && (
                      <tr><td colSpan={7} className="pdx-empty">{filtered || preset !== 'all' ? 'No payments match these filters.' : 'No payments yet.'}</td></tr>
                    )}
                    {rows.map((r) => {
                      const isOpen = open === r.ref;
                      return (
                        <React.Fragment key={r.ref}>
                          <tr className={isOpen ? 'open' : ''}>
                            <td style={{ whiteSpace: 'nowrap' }}>{when(r.paid_at)}</td>
                            <td><span className="pdx-pill"><i style={{ background: SRC_COLOR[r.source] }} />{TYPE[r.source] || r.source}</span></td>
                            <td style={{ maxWidth: 240 }}>{r.item}</td>
                            <td>{r.name || <span className="pdx-mut">-</span>}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{inr(r.amount)}</td>
                            <td><span className="pdx-pill"><i style={{ background: STATUS_COLOR[r.status] }} />{STATUS_LABEL[r.status]}</span></td>
                            <td><button type="button" className="pdx-link" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.ref)}>{isOpen ? 'Hide' : 'Details'}</button></td>
                          </tr>
                          {isOpen && (
                            <tr className="open">
                              <td colSpan={7} style={{ paddingTop: 4 }}>
                                <dl>
                                  {([['Receipt no', r.receipt_no], ['Email', r.email], ['Phone', r.phone], ['Mode', r.mode], ['Order id', r.order_id], ['Payment id', r.payment_id]] as [string, string | null][]).map(([k, v]) => (
                                    <div key={k}><dt>{k}</dt><dd>{v || '-'}</dd></div>
                                  ))}
                                </dl>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <div className="pdx-row" style={{ justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
                  <button type="button" className="pdx-btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</button>
                  <span style={{ fontSize: 14 }}>Page {page} of {pages}</span>
                  <button type="button" className="pdx-btn" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}