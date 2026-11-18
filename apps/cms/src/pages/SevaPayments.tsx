import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API, CSS, Notice, authHeader, failText, readJson, useFlash } from './DiscoverKit';
import { ActivityDots, Columns, Delta, Donut, HBars, LineChart, PDX_CSS, RevenueChart, inr, makeBuckets, rangeOf, short, when, ymd } from './PaymentCharts';
import type { DailyRow, Gran, Money, Preset } from './PaymentCharts';
import { useAuth } from '../lib/auth';
import { loadLogo, pageList } from './reportKit';
import { buildSevaReportXlsx } from './sevaReportXlsx';
import logoVspt from '@images/logo-vspt.png';
import logoSdss from '@images/logo-sdss.png';

// API points at .../api/v1/discover. The Seva payments API is .../api/v1/payments/admin/seva
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const SEVA = `${API_BASE}/payments/admin/seva`;

// The name and address printed at the top of the downloaded report (the two logos come from apps/web/public/images)
const ORG_NAME = 'SRI DAKSHINAMURTI SEVA SAMITI';
const ORG_ADDRESS: string[] = [
  'Chatrapatti Road, Vedapuri, Theni, Tamilnadu, India - 625 531',
  'Phone: 97517 51910, 94430 51910',
];
const EXPORT_LIMIT = 20000; // the most rows the server sends in one download
const PAGE_SIZES = [10, 25, 50, 100];
const ddmmyyyy = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}${d.slice(5, 7)}${d.slice(0, 4)}` : '');

type Cat = { category: 'seva' | 'corpus'; paid: Money; pending: Money; failed: Money };
type Summary = {
  paid: Money; pending: Money; failed: Money; average: number; successRate: number; payers: number; repeatDevotees: number; previous: Money | null;
  categories: Cat[]; daily: DailyRow[];
  top: { seva: string; category: string; count: number; amount: number }[];
  sevaTable: { seva: string; category: 'seva' | 'corpus'; bookings: number; paid: number; amount: number; failed: number; pending: number }[];
  states: { state: string; count: number; amount: number }[];
  ranges: { label: string; count: number; amount: number }[];
  activity: { weekday: number; block: number; count: number }[];
  upcoming: { date: string | null; count: number; amount: number }[];
  followUps: { id: number; devotee_id: string; name: string; phone: string | null; seva: string; category: 'seva' | 'corpus'; amount: number; status: 'PENDING' | 'FAILED'; paid_at: string }[];
  health: { paidNoReceipt: number; paidNoPaymentId: number; stuckPending: number };
  devotees: { devotee_id: string; name: string; phone: string; count: number; amount: number; last: string }[];
  sevas: string[];
};
type Member = { title: string; name: string; gothram: string; nakshathiram: string; rasi: string; relation: string };
type Row = {
  id: number; devotee_id: string; name: string; email: string | null; phone: string | null; city: string | null; state: string | null;
  seva: string; category: 'seva' | 'corpus'; amount: number; currency: string; status: 'PAID' | 'PENDING' | 'FAILED';
  seva_date: string | null; receipt_no: string | null; order_id: string | null; payment_id: string | null; members: Member[]; paid_at: string;
};

// Corpus = a gift to the seva fund. Seva (non-corpus) = a normal seva booking.
const CAT_LABEL: Record<string, string> = { corpus: 'Corpus', seva: 'Non-corpus seva' };
const CAT_COLOR: Record<string, string> = { corpus: '#7a1c1c', seva: '#ea580c' };
const SERIES = [{ key: 'corpus', label: CAT_LABEL.corpus, color: CAT_COLOR.corpus }, { key: 'seva', label: CAT_LABEL.seva, color: CAT_COLOR.seva }];
const STATUS_LABEL: Record<string, string> = { PAID: 'Paid', PENDING: 'Pending', FAILED: 'Failed' };
const STATUS_COLOR: Record<string, string> = { PAID: '#15803d', PENDING: '#b45309', FAILED: '#b91c1c' };
const SORTS: [string, string][] = [['date', 'Newest first'], ['oldest', 'Oldest first'], ['amount_desc', 'Highest amount'], ['amount_asc', 'Lowest amount'], ['name', 'Devotee name A-Z']];

const dateLabel = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

// "3 hours ago", "2 days ago"
function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (!Number.isFinite(mins)) return '';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} hr ago`;
  return `${Math.round(mins / 1440)} day${Math.round(mins / 1440) === 1 ? '' : 's'} ago`;
}
const telHref = (p: string | null) => (p && /^\+?[\d\s-]{6,20}$/.test(p) ? `tel:${p.replace(/[\s-]/g, '')}` : undefined);
// A spreadsheet never runs a cell that starts with = + - or @ as a formula
const csvCell = (v: unknown) => { let t = v == null ? '' : String(v); if (/^[=@\t\r]|^[+-](?![\d\s])/.test(t)) t = `'${t}`; return `"${t.replace(/"/g, '""')}"`; };

// A small heading that starts a group of cards
const Group = ({ title, note }: { title: string; note?: string }) => (
  <div style={{ margin: '22px 2px 10px' }}>
    <h2 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.02em', textTransform: 'uppercase', color: '#7a1c1c' }}>{title}</h2>
    {note && <p className="pdx-sub">{note}</p>}
  </div>
);

// An id with a small Copy button
function Copyable({ value, label }: { value: string | null; label: string }) {
  const [done, setDone] = useState(false);
  if (!value) return <span className="pdx-mut">-</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ wordBreak: 'break-all' }}>{value}</span>
      <button type="button" className="pdx-link" aria-label={`Copy ${label}`} onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* the browser may block copying */ }
      }}>{done ? 'Copied' : 'Copy'}</button>
    </span>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="pdx-card">
      <p className="pdx-kpi-l">{label}</p>
      <p className="pdx-kpi-n" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="pdx-sub">{sub}</p>}
    </div>
  );
}

export default function SevaPayments() {
  const { notice, flash, clear } = useFlash();
  const auth = useAuth() as any;
  // The page opens on the current month
  const [preset, setPreset] = useState<Preset>('month');
  const [from, setFrom] = useState(rangeOf('month').from);
  const [to, setTo] = useState(rangeOf('month').to);
  // Category, status, seva, sort and search filter the payments table (and the download). The charts follow the period only.
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [seva, setSeva] = useState('');
  const [sort, setSort] = useState('date');
  const [q, setQ] = useState('');
  const [qNow, setQNow] = useState('');
  const [page, setPage] = useState(1);
  const [gran, setGran] = useState<Gran>('day');
  const [mode, setMode] = useState<'bars' | 'area'>('bars');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [loadingSum, setLoadingSum] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [errSum, setErrSum] = useState('');
  const [errList, setErrList] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const seqSum = useRef(0);
  const seqList = useRef(0);
  const tableRef = useRef<HTMLElement>(null);

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
    if (category) p.set('category', category);
    if (status) p.set('status', status);
    if (seva) p.set('seva', seva);
    if (qNow) p.set('q', qNow);
    return p;
  }, [period, category, status, seva, qNow]);

  // Figures and charts: the dates only
  const loadSummary = useCallback(async () => {
    const mine = ++seqSum.current;
    setLoadingSum(true); setErrSum('');
    try {
      const res = await fetch(`${SEVA}/summary?${period()}`, { headers: authHeader(), cache: 'no-store' });
      const d = await readJson(res);
      if (!res.ok) throw new Error(failText(d, `Could not load the summary (${res.status}).`));
      if (mine !== seqSum.current) return; // a newer request has started
      setSummary(d);
    } catch (e: any) {
      if (mine === seqSum.current) setErrSum(`${e?.message || 'Could not load the seva payments.'} [${SEVA}]`);
    } finally { if (mine === seqSum.current) setLoadingSum(false); }
  }, [period]);

  // The payments table: the dates plus the category, status, seva, sort and search
  const loadList = useCallback(async () => {
    const mine = ++seqList.current;
    setLoadingList(true); setErrList('');
    try {
      const lp = tableParams(); lp.set('page', String(page)); lp.set('limit', String(limit)); lp.set('sort', sort);
      const res = await fetch(`${SEVA}/list?${lp}`, { headers: authHeader(), cache: 'no-store' });
      const d = await readJson(res);
      if (!res.ok) throw new Error(failText(d, `Could not load the payments (${res.status}).`));
      if (mine !== seqList.current) return;
      setRows(d.items || []); setTotal(d.total || 0);
    } catch (e: any) {
      if (mine === seqList.current) setErrList(`${e?.message || 'Could not load the seva payments.'} [${SEVA}]`);
    } finally { if (mine === seqList.current) setLoadingList(false); }
  }, [tableParams, page, limit, sort]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadList(); }, [loadList]);

  const err = errSum || errList;
  const loading = loadingSum || loadingList;
  const retry = () => { loadSummary(); loadList(); };

  // Takes the person to the payments table (after a filter was set from a card above)
  const goToTable = () => setTimeout(() => tableRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 50);

  function choose(p: Preset) {
    setPreset(p); setPage(1);
    if (p !== 'custom') { const r = rangeOf(p); setFrom(r.from); setTo(r.to); }
    setGran(p === 'year' || p === 'all' ? 'month' : 'day');
  }

  // One Excel file with everything: a Summary sheet and a sheet listing every booking that matches the filters (not only this page)
  async function download() {
    setBusy(true);
    try {
      const sp = tableParams(); sp.set('sort', sort);
      const [sumRes, csvRes, left, right] = await Promise.all([
        fetch(`${SEVA}/summary?${period()}`, { headers: authHeader(), cache: 'no-store' }).then(async (r) => {
          const d = await readJson(r);
          if (!r.ok) throw new Error(failText(d, 'Could not make the report.'));
          return d as Summary;
        }),
        fetch(`${SEVA}/export?${sp}`, { headers: authHeader(), cache: 'no-store' }).then(async (r) => {
          if (!r.ok) throw new Error(failText(await readJson(r), 'Could not make the report.'));
          return r.text();
        }),
        loadLogo(logoVspt),
        loadLogo(logoSdss),
      ]);
      const bits = [category ? CAT_LABEL[category] || category : 'Corpus and non-corpus', status ? STATUS_LABEL[status] || status : 'All statuses', seva ? `Seva: ${seva}` : 'All sevas'];
      if (qNow) bits.push(`Search: "${qNow}"`);
      const bytes = await buildSevaReportXlsx({
        org: { name: ORG_NAME, address: ORG_ADDRESS },
        from, to, generatedAt: new Date(), generatedBy: String(auth?.user?.email || auth?.user?.full_name || ''),
        filtersText: bits.join(', '), summary: sumRes as any, paymentsCsv: csvRes, exportLimit: EXPORT_LIMIT,
        catLabel: CAT_LABEL, logos: { left, right },
      });
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      const span = from || to ? `-${ddmmyyyy(from) || 'start'}-to-${ddmmyyyy(to) || ddmmyyyy(ymd(new Date()))}` : '-all';
      a.href = url; a.download = `Seva-payments-report${span}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e: any) { flash('err', e?.message || 'Could not make the report.'); } finally { setBusy(false); }
  }

  const pages = Math.max(1, Math.ceil(total / limit));
  const showFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showTo = Math.min(total, page * limit);
  const filtered = !!(category || status || seva || qNow);
  const buckets = summary ? makeBuckets(summary.daily, gran, from, to) : [];
  const cat = (c: string) => summary?.categories.find((x) => x.category === c);
  const catParts = SERIES.map((s) => ({ key: s.key, label: s.label, value: cat(s.key)?.paid.amount || 0, color: s.color }));
  const healthParts = summary ? [
    { key: 'PAID', label: `Paid (${summary.paid.count})`, value: summary.paid.count, color: STATUS_COLOR.PAID },
    { key: 'PENDING', label: `Pending (${summary.pending.count})`, value: summary.pending.count, color: STATUS_COLOR.PENDING },
    { key: 'FAILED', label: `Failed (${summary.failed.count})`, value: summary.failed.count, color: STATUS_COLOR.FAILED },
  ] : [];
  let acc = 0;
  const running = buckets.map((b) => { acc += b.total; return { label: b.label, value: Math.round(acc * 100) / 100, note: `${inr(b.total)} added this ${gran}` }; });
  const repeatPct = summary && summary.payers ? Math.round((summary.repeatDevotees / summary.payers) * 100) : 0;

  return (
    <div className="dc">
      <style>{CSS}</style>
      <style>{PDX_CSS}</style>
      <Notice notice={notice} onClear={clear} />
      <div className="pdx">
        <div className="pdx-top">
          <div>
            <h1 className="pdx-title">Seva payments</h1>
            <p className="pdx-sub" style={{ fontSize: 14 }}>Every seva and corpus booking with the devotee, the Razorpay ids and the sankalpam names. Money is counted only when a payment is paid.</p>
          </div>
          <button type="button" className="pdx-btn" onClick={download} disabled={busy || loading || total === 0}>{busy ? 'Preparing the report...' : 'Download report (Excel)'}</button>
        </div>

        {/* Period */}
        <div className="pdx-card" style={{ marginBottom: 14 }}>
          <div className="pdx-row" role="group" aria-label="Payment date">
            {([['month', 'This month'], ['30', 'Last 30 days'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Choose dates']] as [Preset, string][]).map(([id, label]) => (
              <button key={id} type="button" className={`pdx-btn${preset === id ? ' on' : ''}`} aria-pressed={preset === id} onClick={() => choose(id)}>{label}</button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="pdx-row" style={{ marginTop: 12 }}>
              <div><label className="pdx-lbl" htmlFor="sf">From</label><input id="sf" className="pdx-inp" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></div>
              <div><label className="pdx-lbl" htmlFor="st">To</label><input id="st" className="pdx-inp" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></div>
            </div>
          )}
        </div>

        {err ? (
          <div role="alert" className="pdx-err">{err} <button type="button" className="pdx-link" onClick={retry}>Try again</button></div>
        ) : (
          <div>
            <div className={loadingSum && summary ? 'pdx-busy' : ''} aria-busy={loadingSum}>
            <Group title="Summary" note="Money counted only when a payment is paid." />
            <div className="pdx-grid pdx-g-kpi">
              <div className="pdx-card pdx-hero">
                <p className="pdx-sub">Collected</p>
                <p className="pdx-big">{summary ? inr(summary.paid.amount) : '...'}</p>
                {summary && <Delta now={summary.paid.amount} before={summary.previous} />}
                <p className="pdx-sub" style={{ marginTop: 10 }}>{summary ? `${summary.paid.count} paid bookings` : ''}</p>
              </div>
              <Stat label="Devotees who paid" value={summary ? String(summary.payers) : '...'} sub={summary && summary.payers ? `${inr(summary.paid.amount / summary.payers)} on average each` : ''} />
              <Stat label="Average booking" value={summary ? inr(summary.average) : '...'} sub="of the paid bookings" />
              <Stat label="Sevas booked" value={summary ? String(summary.sevaTable.filter((t) => t.paid > 0).length) : '...'} sub="different sevas with a paid booking" />
            </div>
            <div className="pdx-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))' }}>
              <Stat label="Corpus" value={summary ? inr(cat('corpus')?.paid.amount || 0) : '...'} sub={summary ? `${cat('corpus')?.paid.count || 0} paid` : ''} color={CAT_COLOR.corpus} />
              <Stat label="Non-corpus seva" value={summary ? inr(cat('seva')?.paid.amount || 0) : '...'} sub={summary ? `${cat('seva')?.paid.count || 0} paid` : ''} color={CAT_COLOR.seva} />
              <Stat label="Pending" value={summary ? inr(summary.pending.amount) : '...'} sub={summary ? `${summary.pending.count} not completed` : ''} color={STATUS_COLOR.PENDING} />
              <Stat label="Failed" value={summary ? String(summary.failed.count) : '...'} sub={summary ? `${inr(summary.failed.amount)} not received` : ''} color={STATUS_COLOR.FAILED} />
            </div>

            <Group title="Collections" />
            <div className="pdx-grid pdx-g-main">
              <section className="pdx-card" aria-label="Revenue flow">
                <div className="pdx-head">
                  <div><h3>Revenue flow</h3><p className="pdx-sub">Money collected, corpus and non-corpus</p></div>
                  <div className="pdx-row" role="group" aria-label="Group by">
                    {(['day', 'week', 'month'] as Gran[]).map((g) => <button key={g} type="button" className={`pdx-btn${gran === g ? ' on' : ''}`} aria-pressed={gran === g} onClick={() => setGran(g)}>{g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}</button>)}
                  </div>
                </div>
                <RevenueChart data={buckets} mode={mode} series={SERIES} />
                {/* Bars / Line sit below the graph */}
                <div className="pdx-row" style={{ justifyContent: 'center', marginTop: 12 }} role="group" aria-label="Chart style">
                  {(['bars', 'area'] as const).map((m) => <button key={m} type="button" className={`pdx-btn${mode === m ? ' on' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'bars' ? 'Bars' : 'Line'}</button>)}
                </div>
                {mode === 'bars' ? <div className="pdx-key">{SERIES.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div> : <div className="pdx-key">The line shows both categories together. Hover a point for the split.</div>}
              </section>
              <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                <section className="pdx-card" aria-label="Corpus and non-corpus">
                  <h3>Corpus and non-corpus</h3>
                  <p className="pdx-sub" style={{ marginBottom: 10 }}>Share of the money collected</p>
                  <Donut parts={catParts} centerTop="Total" centerBottom={summary ? short(summary.paid.amount) : '...'} label="Money collected, corpus and non-corpus" />
                </section>
                <section className="pdx-card" aria-label="Health">
                  <h3>Health</h3>
                  <p className="pdx-sub" style={{ marginBottom: 10 }}>How many attempts ended well</p>
                  <Donut parts={healthParts} centerTop="Success" centerBottom={summary ? `${summary.successRate}%` : '...'} label="Share of paid, pending and failed bookings" />
                  {summary && <p className="pdx-sub" style={{ marginTop: 10 }}>{repeatPct}% of devotees paid more than once ({summary.repeatDevotees} of {summary.payers}).</p>}
                </section>
              </div>
            </div>
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="Running total">
                <h3>Running total</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>How the money adds up through the period</p>
                <LineChart label="Running total collected" points={running} />
              </section>
              <section className="pdx-card" aria-label="Booking sizes">
                <h3>Booking sizes</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Paid bookings by amount</p>
                <Columns label="Paid bookings by amount range" items={(summary?.ranges || []).map((r) => ({ label: r.label.replace(' to ', ' to '), value: r.count, note: `${r.count} booking${r.count === 1 ? '' : 's'}, ${inr(r.amount)}` }))} />
              </section>
            </div>

            <Group title="Sevas and devotees" />
            <section className="pdx-card" aria-label="Seva-wise report" style={{ marginBottom: 14 }}>
              <div className="pdx-head">
                <div><h3>Seva-wise report</h3><p className="pdx-sub">Every seva with its bookings and money. Press View to see its payments.</p></div>
                <button type="button" className="pdx-btn" disabled={!summary || summary.sevaTable.length === 0} onClick={() => {
                  if (!summary) return;
                  const head = ['Seva', 'Category', 'Bookings', 'Paid', 'Collected (INR)', 'Failed', 'Pending', 'Success rate %'];
                  const lines = [head.map(csvCell).join(',')].concat(summary.sevaTable.map((t) => [t.seva, CAT_LABEL[t.category], t.bookings, t.paid, t.amount, t.failed, t.pending, t.bookings ? Math.round((t.paid / t.bookings) * 100) : 0].map(csvCell).join(',')));
                  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
                  const a = document.createElement('a'); a.href = url; a.download = `seva-wise-report-${ymd(new Date())}.csv`; document.body.appendChild(a); a.click(); a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 2000);
                }}>Download report</button>
              </div>
              <div className="pdx-tablewrap">
                <table style={{ minWidth: 760 }}>
                  <thead><tr>{['Seva', 'Category', 'Bookings', 'Paid', 'Collected', 'Failed', 'Success', ''].map((h, i) => <th key={i} scope="col" style={{ textAlign: i >= 2 && i <= 5 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(!summary || summary.sevaTable.length === 0) && <tr><td colSpan={8} className="pdx-empty">No bookings in this period.</td></tr>}
                    {summary?.sevaTable.map((t) => {
                      const rate = t.bookings ? Math.round((t.paid / t.bookings) * 100) : 0;
                      return (
                        <tr key={`${t.category}-${t.seva}`}>
                          <td style={{ fontWeight: 700, maxWidth: 260 }}>{t.seva}</td>
                          <td><span className="pdx-pill"><i style={{ background: CAT_COLOR[t.category] }} />{CAT_LABEL[t.category]}</span></td>
                          <td style={{ textAlign: 'right' }}>{t.bookings}</td>
                          <td style={{ textAlign: 'right' }}>{t.paid}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{inr(t.amount)}</td>
                          <td style={{ textAlign: 'right', color: t.failed ? STATUS_COLOR.FAILED : undefined }}>{t.failed}</td>
                          <td style={{ minWidth: 110 }}>
                            <div className="pdx-bar" role="img" aria-label={`${rate}% of bookings were paid`}><div style={{ width: `${rate}%`, background: rate >= 70 ? STATUS_COLOR.PAID : rate >= 40 ? STATUS_COLOR.PENDING : STATUS_COLOR.FAILED }} /></div>
                            <p className="pdx-sub">{rate}%</p>
                          </td>
                          <td><button type="button" className="pdx-link" onClick={() => { setSeva(t.seva); setCategory(t.category); setPage(1); goToTable(); }}>View</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="pdx-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))' }}>
              <section className="pdx-card" aria-label="Top sevas">
                <h3>Top sevas</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>What brought in the most</p>
                <HBars items={(summary?.top || []).map((t) => ({ key: `${t.category}-${t.seva}`, label: t.seva, value: t.amount, color: CAT_COLOR[t.category] || '#7a1c1c', sub: `${CAT_LABEL[t.category] || t.category} · ${t.count} booking${t.count === 1 ? '' : 's'}` }))} />
              </section>
              <section className="pdx-card" aria-label="Top devotees">
                <h3>Top devotees</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Press a name to see all of that devotee&apos;s payments</p>
                {!summary || summary.devotees.length === 0 ? <p className="pdx-empty">Nothing yet.</p> : summary.devotees.map((d) => (
                  <div className="pdx-donor" key={d.devotee_id}>
                    <span className="pdx-ava" aria-hidden="true">{(d.name || '?').trim().charAt(0).toUpperCase()}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <button type="button" className="pdx-link" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 700, padding: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}
                        onClick={() => { setQ(d.devotee_id); setQNow(d.devotee_id); setPage(1); goToTable(); }}>{d.name || d.devotee_id}</button>
                      <p className="pdx-sub">{d.count} booking{d.count === 1 ? '' : 's'}{d.phone ? ` · ${d.phone}` : ''}</p>
                    </div>
                    <b>{inr(d.amount)}</b>
                  </div>
                ))}
              </section>
              <section className="pdx-card" aria-label="Devotees by state">
                <h3>Devotees by state</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>Money collected by where the devotee lives</p>
                <HBars items={(summary?.states || []).map((t) => ({ key: t.state, label: t.state, value: t.amount, color: '#e0a526', sub: `${t.count} booking${t.count === 1 ? '' : 's'}` }))} />
              </section>
              <section className="pdx-card" aria-label="When people pay">
                <h3>When people pay</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Paid bookings by weekday and time of day (server clock)</p>
                {summary && summary.activity.length > 0 ? <ActivityDots data={summary.activity} /> : <p className="pdx-empty">Nothing yet.</p>}
              </section>
            </div>

            <Group title="Needs attention" note="Things the temple office may want to act on." />
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="Follow up">
                <h3>Follow up</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Latest pending and failed bookings. A call can turn them into paid ones.</p>
                {!summary || summary.followUps.length === 0 ? <p className="pdx-empty">Nothing to follow up. </p> : summary.followUps.map((f) => (
                  <div className="pdx-donor" key={f.id}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || 'Unknown devotee'} <span className="pdx-pill" style={{ marginLeft: 6 }}><i style={{ background: STATUS_COLOR[f.status] }} />{STATUS_LABEL[f.status]}</span></p>
                      <p className="pdx-sub">{f.seva} · {ago(f.paid_at)}{f.phone ? ' · ' : ''}{f.phone && (telHref(f.phone) ? <a className="pdx-link" style={{ padding: 0 }} href={telHref(f.phone)}>{f.phone}</a> : f.phone)}</p>
                    </div>
                    <b>{inr(f.amount)}</b>
                  </div>
                ))}
              </section>
              <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                <section className="pdx-card" aria-label="Upcoming sevas">
                  <h3>Upcoming sevas</h3>
                  <p className="pdx-sub" style={{ marginBottom: 8 }}>Paid bookings by the date the seva is performed</p>
                  {!summary || summary.upcoming.length === 0 ? <p className="pdx-empty">No paid bookings with a future seva date.</p> : summary.upcoming.map((u) => (
                    <div className="pdx-donor" key={u.date || 'none'}>
                      <div style={{ flex: 1 }}><p style={{ fontWeight: 700 }}>{dateLabel(u.date)}</p><p className="pdx-sub">{u.count} booking{u.count === 1 ? '' : 's'}</p></div>
                      <b>{inr(u.amount)}</b>
                    </div>
                  ))}
                </section>
                <section className="pdx-card" aria-label="Health checks">
                  <h3>Health checks</h3>
                  <p className="pdx-sub" style={{ marginBottom: 8 }}>Records that may need a look</p>
                  {summary && ([
                    ['Paid bookings without a receipt number', summary.health.paidNoReceipt],
                    ['Paid bookings without a Razorpay payment id', summary.health.paidNoPaymentId],
                    ['Pending for more than a day', summary.health.stuckPending],
                  ] as [string, number][]).map(([text, n]) => (
                    <div className="pdx-donor" key={text}>
                      <span style={{ flex: 1, fontSize: 14 }}>{text}</span>
                      <span className="pdx-pill"><i style={{ background: n ? STATUS_COLOR.PENDING : STATUS_COLOR.PAID }} />{n ? n : 'All good'}</span>
                    </div>
                  ))}
                </section>
              </div>
            </div>

            </div>

            {/* The payments, with their own filters */}
            <Group title="All payments" />
            <section ref={tableRef} className="pdx-card" aria-label="Seva payments" style={{ marginBottom: 4, scrollMarginTop: 12 }}>
              <div className="pdx-head">
                <h3>Payments</h3>
                <span className="pdx-sub">{loadingList ? 'Loading...' : `${total} found`}</span>
              </div>
              <div className="pdx-row" style={{ marginBottom: 12 }}>
                <div>
                  <label className="pdx-lbl" htmlFor="sc">Category</label>
                  <select id="sc" className="pdx-inp" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
                    <option value="">Corpus and non-corpus</option>
                    <option value="corpus">Corpus only</option>
                    <option value="seva">Non-corpus seva only</option>
                  </select>
                </div>
                <div>
                  <label className="pdx-lbl" htmlFor="ss">Status</label>
                  <select id="ss" className="pdx-inp" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                    <option value="">All statuses</option>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: 0, maxWidth: 260 }}>
                  <label className="pdx-lbl" htmlFor="sv">Seva</label>
                  <select id="sv" className="pdx-inp" style={{ width: '100%' }} value={seva} onChange={(e) => { setSeva(e.target.value); setPage(1); }}>
                    <option value="">All sevas</option>
                    {(summary?.sevas || []).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="pdx-lbl" htmlFor="so">Sort by</label>
                  <select id="so" className="pdx-inp" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                    {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <label className="pdx-lbl" htmlFor="sq">Search devotees and payments</label>
                  <input id="sq" className="pdx-inp" style={{ width: '100%' }} value={q} maxLength={80} placeholder="Devotee name, phone, email, receipt, Razorpay id or sankalpam name" onChange={(e) => setQ(e.target.value)} />
                </div>
                {filtered && <button type="button" className="pdx-btn" onClick={() => { setCategory(''); setStatus(''); setSeva(''); setQ(''); setQNow(''); setPage(1); }}>Clear filters</button>}
              </div>
              <div className="pdx-tablewrap">
                <table style={{ minWidth: 1000 }}>
                  <thead>
                    <tr>{['Payment date', 'Devotee', 'Seva', 'Category', 'Amount', 'Status', 'Transaction id (Razorpay payment)', ''].map((h, i) => <th key={i} scope="col" style={{ textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {!loadingList && rows.length === 0 && (
                      <tr><td colSpan={8} className="pdx-empty">{filtered || preset !== 'all' ? 'No seva payments match these filters.' : 'No seva payments yet.'}</td></tr>
                    )}
                    {rows.map((r) => {
                      const isOpen = open === r.id;
                      return (
                        <React.Fragment key={r.id}>
                          <tr className={isOpen ? 'open' : ''}>
                            <td style={{ whiteSpace: 'nowrap' }}>{when(r.paid_at)}</td>
                            <td style={{ minWidth: 150 }}>
                              <p style={{ fontWeight: 700 }}>{r.name || <span className="pdx-mut">Unknown devotee</span>}</p>
                              <p className="pdx-sub">{r.phone || r.email || ''}</p>
                            </td>
                            <td style={{ maxWidth: 220 }}>
                              <p>{r.seva}</p>
                              {r.seva_date && <p className="pdx-sub">Seva on {dateLabel(r.seva_date)}</p>}
                            </td>
                            <td><span className="pdx-pill"><i style={{ background: CAT_COLOR[r.category] }} />{CAT_LABEL[r.category]}</span></td>
                            <td style={{ textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{inr(r.amount)}</td>
                            <td><span className="pdx-pill"><i style={{ background: STATUS_COLOR[r.status] }} />{STATUS_LABEL[r.status]}</span></td>
                            <td style={{ fontSize: 13, maxWidth: 230 }}><Copyable value={r.payment_id} label="transaction id" /></td>
                            <td><button type="button" className="pdx-link" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>{isOpen ? 'Hide' : 'Details'}</button></td>
                          </tr>
                          {isOpen && (
                            <tr className="open">
                              <td colSpan={8} style={{ paddingTop: 4 }}>
                                <dl>
                                  <div><dt>Transaction id (Razorpay payment)</dt><dd><Copyable value={r.payment_id} label="transaction id" /></dd></div>
                                  <div><dt>Razorpay order id</dt><dd><Copyable value={r.order_id} label="order id" /></dd></div>
                                  <div><dt>Receipt no</dt><dd>{r.receipt_no || '-'}</dd></div>
                                  <div><dt>Devotee id</dt><dd>{r.devotee_id}</dd></div>
                                  <div><dt>Email</dt><dd>{r.email || '-'}</dd></div>
                                  <div><dt>Phone</dt><dd>{r.phone || '-'}</dd></div>
                                  <div><dt>City and state</dt><dd>{[r.city, r.state].filter(Boolean).join(', ') || '-'}</dd></div>
                                  <div><dt>Seva date</dt><dd>{dateLabel(r.seva_date)}</dd></div>
                                </dl>
                                <p style={{ fontWeight: 700, margin: '14px 0 6px' }}>Sankalpam: the seva is performed for</p>
                                {r.members.length === 0 ? <p className="pdx-sub">No names were saved with this booking.</p> : (
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ minWidth: 520, fontSize: 13 }}>
                                      <thead><tr>{['Name', 'Relation', 'Gothram', 'Nakshatram', 'Rasi'].map((h) => <th key={h} scope="col" style={{ padding: '6px 10px' }}>{h}</th>)}</tr></thead>
                                      <tbody>
                                        {r.members.map((m, i) => (
                                          <tr key={i}>
                                            <td style={{ padding: '6px 10px' }}>{[m.title, m.name].filter(Boolean).join(' ') || '-'}</td>
                                            <td style={{ padding: '6px 10px' }}>{m.relation || '-'}</td>
                                            <td style={{ padding: '6px 10px' }}>{m.gothram || '-'}</td>
                                            <td style={{ padding: '6px 10px' }}>{m.nakshathiram || '-'}</td>
                                            <td style={{ padding: '6px 10px' }}>{m.rasi || '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                <div style={{ marginTop: 12 }}>
                                  <button type="button" className="pdx-btn" onClick={() => { setQ(r.devotee_id); setQNow(r.devotee_id); setPage(1); setOpen(null); }}>Show all payments of this devotee</button>
                                </div>
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
                  <label className="pdx-lbl" htmlFor="sl" style={{ margin: 0 }}>Rows per page</label>
                  <select id="sl" className="pdx-inp" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
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