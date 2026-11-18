import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityDots, Delta, Donut, PDX_CSS, RevenueChart, inr, makeBuckets, rangeOf, short, when, ymd } from './PaymentCharts';
import type { Gran, Money, Preset } from './PaymentCharts';
import { API, CSS, Notice, authHeader, failText, readJson, useFlash } from './DiscoverKit';
import { useAuth } from '../lib/auth';
import { buildPaymentsReportXlsx, loadLogo } from './paymentsReportXlsx';
import logoVspt from '@images/logo-vspt.png';
import logoSdss from '@images/logo-sdss.png';

// API points at .../api/v1/discover. The Payments API is .../api/v1/payments
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const PAY = `${API_BASE}/payments`;

// The name and address printed at the top of the downloaded report (the two logos come from apps/web/public/images).
// Write the address lines, phone number and registration numbers here, one per line.
const ORG_NAME = 'SRI DAKSHINAMURTI SEVA SAMITI';
const ORG_ADDRESS: string[] = [
  'Chatrapatti Road, Vedapuri, Theni, Tamilnadu, India - 625 531',
  'Phone: 97517 51910, 94430 51910',
];
const EXPORT_LIMIT = 20000; // the most rows the server sends in one download
const PAGE_SIZES = [10, 25, 50, 100];
const ddmmyyyy = (ymd: string) => (/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${ymd.slice(8, 10)}${ymd.slice(5, 7)}${ymd.slice(0, 4)}` : '');

// 1 2 3 ... 8 9 10 ... 20 : the pages to show next to the current one
function pageList(page: number, pages: number): (number | '...')[] {
  const keep = new Set<number>([1, pages, page - 1, page, page + 1]);
  const out: (number | '...')[] = [];
  let prev = 0;
  [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b).forEach((n) => {
    if (n - prev > 1) out.push('...');
    out.push(n); prev = n;
  });
  return out;
}

async function payText(path: string): Promise<string> {
  const res = await fetch(`${PAY}${path}`, { headers: authHeader(), cache: 'no-store' });
  if (!res.ok) throw new Error(failText(await readJson(res), 'Could not make the report.'));
  return res.text();
}

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
  const auth = useAuth() as any;
  // The page opens on the current month
  const [preset, setPreset] = useState<Preset>('month');
  const [from, setFrom] = useState(rangeOf('month').from);
  const [to, setTo] = useState(rangeOf('month').to);
  // These three filter the payments table (and the CSV download). The charts follow the period only.
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [qNow, setQNow] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [gran, setGran] = useState<Gran>('day');
  const [mode, setMode] = useState<'bars' | 'area'>('bars');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingSum, setLoadingSum] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [errSum, setErrSum] = useState('');
  const [errList, setErrList] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seqSum = useRef(0);
  const seqList = useRef(0);

  // The search box waits a moment after typing before it asks the server
  useEffect(() => {
    const t = setTimeout(() => { setQNow(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const period = useCallback(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p;
  }, [from, to]);

  const tableParams = useCallback(() => {
    const p = period();
    if (source) p.set('source', source);
    if (status) p.set('status', status);
    if (qNow) p.set('q', qNow);
    return p;
  }, [period, source, status, qNow]);

  // Charts and figures: the dates only
  const loadSummary = useCallback(async () => {
    const mine = ++seqSum.current;
    setLoadingSum(true); setErrSum('');
    try {
      const res = await fetch(`${PAY}/admin/summary?${period()}`, { headers: authHeader(), cache: 'no-store' });
      const d = await readJson(res);
      if (!res.ok) throw new Error(failText(d, `Could not load the summary (${res.status}).`));
      if (mine !== seqSum.current) return; // a newer request has started
      setSummary(d);
    } catch (e: any) {
      if (mine === seqSum.current) setErrSum(`${e?.message || 'Could not load the payments.'} [${PAY}]`);
    } finally { if (mine === seqSum.current) setLoadingSum(false); }
  }, [period]);

  // The payments table: the dates plus the type, status and search
  const loadList = useCallback(async () => {
    const mine = ++seqList.current;
    setLoadingList(true); setErrList('');
    try {
      const lp = tableParams(); lp.set('page', String(page)); lp.set('limit', String(limit));
      const res = await fetch(`${PAY}/admin/list?${lp}`, { headers: authHeader(), cache: 'no-store' });
      const d = await readJson(res);
      if (!res.ok) throw new Error(failText(d, `Could not load the payments (${res.status}).`));
      if (mine !== seqList.current) return;
      setRows(d.items || []); setTotal(d.total || 0);
    } catch (e: any) {
      if (mine === seqList.current) setErrList(`${e?.message || 'Could not load the payments.'} [${PAY}]`);
    } finally { if (mine === seqList.current) setLoadingList(false); }
  }, [tableParams, page, limit]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadList(); }, [loadList]);

  const err = errSum || errList;
  const loading = loadingSum || loadingList;
  const retry = () => { loadSummary(); loadList(); };

  function choose(p: Preset) {
    setPreset(p); setPage(1);
    if (p !== 'custom') { const r = rangeOf(p); setFrom(r.from); setTo(r.to); }
    // A long period reads better by week or month
    if (p === 'year') setGran('month'); else if (p === 'all') setGran('month'); else setGran('day');
  }

  // One Excel file with everything: a Summary sheet and a Payments sheet listing every payment that matches the filters (not only this page)
  async function download() {
    setBusy(true);
    try {
      const [sumRes, csv, left, right] = await Promise.all([
        fetch(`${PAY}/admin/summary?${period()}`, { headers: authHeader(), cache: 'no-store' }).then(async (r) => {
          const d = await readJson(r);
          if (!r.ok) throw new Error(failText(d, 'Could not make the report.'));
          return d as Summary;
        }),
        payText(`/admin/export?${tableParams()}`),
        loadLogo(logoVspt),
        loadLogo(logoSdss),
      ]);
      const bits = [source ? `Type: ${TYPE[source] || source}` : 'All types', status ? `Status: ${STATUS_LABEL[status] || status}` : 'All statuses'];
      if (qNow) bits.push(`Search: "${qNow}"`);
      const bytes = await buildPaymentsReportXlsx({
        org: { name: ORG_NAME, address: ORG_ADDRESS },
        from, to, generatedAt: new Date(), generatedBy: String(auth?.user?.email || auth?.user?.full_name || ''),
        filtersText: bits.join(', '), summary: sumRes, paymentsCsv: csv, exportLimit: EXPORT_LIMIT,
        typeLabel: TYPE, logos: { left, right },
      });
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const span = from || to ? `-${ddmmyyyy(from) || 'start'}-to-${ddmmyyyy(to) || ddmmyyyy(ymd(new Date()))}` : '-all';
      a.href = url; a.download = `Payments-report${span}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) { flash('err', e?.message || 'Could not make the report.'); } finally { setBusy(false); }
  }

  const pages = Math.max(1, Math.ceil(total / limit));
  const showFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showTo = Math.min(total, page * limit);
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
          <button type="button" className="pdx-btn" onClick={download} disabled={busy || loading || total === 0}>{busy ? 'Preparing the report...' : 'Download report (Excel)'}</button>
        </div>

        {/* Period */}
        <div className="pdx-card" style={{ marginBottom: 14 }}>
          <div className="pdx-row" role="group" aria-label="Period">
            {([['month', 'This month'], ['30', 'Last 30 days'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Choose dates']] as [Preset, string][]).map(([id, label]) => (
              <button key={id} type="button" className={`pdx-btn${preset === id ? ' on' : ''}`} aria-pressed={preset === id} onClick={() => choose(id)}>{label}</button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="pdx-row" style={{ marginTop: 12 }}>
              <div><label className="pdx-lbl" htmlFor="pf">From</label><input id="pf" className="pdx-inp" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></div>
              <div><label className="pdx-lbl" htmlFor="pt">To</label><input id="pt" className="pdx-inp" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></div>
            </div>
          )}
        </div>

        {err ? (
          <div role="alert" className="pdx-err">{err} <button type="button" className="pdx-link" onClick={retry}>Try again</button></div>
        ) : (
          <div>
            <div className={loadingSum && summary ? 'pdx-busy' : ''} aria-busy={loadingSum}>
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
                    <div className="pdx-row" role="group" aria-label="Group by">
                      {(['day', 'week', 'month'] as Gran[]).map((g) => <button key={g} type="button" className={`pdx-btn${gran === g ? ' on' : ''}`} aria-pressed={gran === g} onClick={() => setGran(g)}>{g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}</button>)}
                    </div>
                  </div>
                  <RevenueChart data={buckets} mode={mode} series={SERIES} />
                  {/* Bars / Line sit below the graph */}
                  <div className="pdx-row" style={{ justifyContent: 'center', marginTop: 12 }} role="group" aria-label="Chart style">
                    {(['bars', 'area'] as const).map((m) => <button key={m} type="button" className={`pdx-btn${mode === m ? ' on' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'bars' ? 'Bars' : 'Line'}</button>)}
                  </div>
                  {mode === 'bars' ? <div className="pdx-key">{TYPES.map((t) => <span key={t}><i style={{ background: SRC_COLOR[t] }} />{TYPE[t]}</span>)}</div> : <div className="pdx-key">The line shows all types together. Hover a point for the split.</div>}
                </section>

                <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                  <section className="pdx-card" aria-label="Sources">
                    <h3>Sources</h3>
                    <p className="pdx-sub" style={{ marginBottom: 10 }}>Share of the money collected</p>
                    <Donut parts={typeParts} centerTop="Total" centerBottom={summary ? short(summary.paid.amount) : '...'} label="Money collected by type" />
                  </section>
                  <section className="pdx-card" aria-label="Health">
                    <h3>Health</h3>
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
            </div>

            {/* The payments history, with its own filters */}
            <section className="pdx-card" aria-label="Payments" style={{ marginBottom: 4 }}>
              <div className="pdx-head">
                <h3>Payments</h3>
                <span className="pdx-sub">{loadingList ? 'Loading...' : `${total} found`}</span>
              </div>
              <div className="pdx-row" style={{ marginBottom: 12 }}>
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
                  <label className="pdx-lbl" htmlFor="pq">Search</label>
                  <input id="pq" className="pdx-inp" style={{ width: '100%' }} value={q} maxLength={80} placeholder="Name, email, phone, receipt or payment id" onChange={(e) => setQ(e.target.value)} />
                </div>
                {filtered && <button type="button" className="pdx-btn" onClick={() => { setSource(''); setStatus(''); setQ(''); setQNow(''); setPage(1); }}>Clear filters</button>}
              </div>
              <div className="pdx-tablewrap">
                <table>
                  <thead>
                    <tr>{['Date', 'Type', 'Item', 'Name', 'Amount', 'Status', ''].map((h, i) => <th key={i} scope="col" style={{ textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {!loadingList && rows.length === 0 && (
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
              {/* Always shown: the count, the pages, and how many rows to a page */}
              <div className="pdx-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 14 }}>{loadingList ? 'Loading...' : total === 0 ? 'Showing 0 payments' : `Showing ${showFrom}-${showTo} of ${total} payment${total === 1 ? '' : 's'}`}</span>
                <div className="pdx-row" role="navigation" aria-label="Pages" style={{ alignItems: 'center' }}>
                  <button type="button" className="pdx-btn" disabled={page <= 1 || loadingList} onClick={() => setPage(page - 1)}>Previous</button>
                  {pageList(page, pages).map((n, i) => n === '...'
                    ? <span key={`gap${i}`} style={{ padding: '0 4px' }}>...</span>
                    : <button key={n} type="button" className={`pdx-btn${n === page ? ' on' : ''}`} aria-current={n === page ? 'page' : undefined} disabled={loadingList} onClick={() => setPage(n)}>{n}</button>)}
                  <button type="button" className="pdx-btn" disabled={page >= pages || loadingList} onClick={() => setPage(page + 1)}>Next</button>
                </div>
                <div className="pdx-row" style={{ alignItems: 'center' }}>
                  <label className="pdx-lbl" htmlFor="pl" style={{ margin: 0 }}>Rows per page</label>
                  <select id="pl" className="pdx-inp" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                    {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}