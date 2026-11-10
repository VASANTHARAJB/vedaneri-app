import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API, CSS, Notice, authHeader, failText, readJson, useFlash } from './DiscoverKit';
import { ActivityDots, Columns, Delta, Donut, HBars, LineChart, PDX_CSS, RevenueChart, inr, makeBuckets, rangeOf, short, when, ymd } from './PaymentCharts';
import type { DailyRow, Gran, Money, Preset } from './PaymentCharts';

// API points at .../api/v1/discover. The Donation payments API is .../api/v1/payments/admin/donation
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const DON = `${API_BASE}/payments/admin/donation`;

type Cat = { category: string; paid: Money; pending: Money; failed: Money };
type Summary = {
  paid: Money; pending: Money; failed: Money; average: number; successRate: number; payers: number; repeatDonors: number; previous: Money | null;
  categories: Cat[]; daily: DailyRow[];
  top: { fund: string; category: string; count: number; amount: number }[];
  fundTable: { fund: string; category: string; bookings: number; paid: number; amount: number; failed: number; pending: number }[];
  states: { state: string; count: number; amount: number }[];
  cities: { city: string; count: number; amount: number }[];
  ranges: { label: string; count: number; amount: number }[];
  activity: { weekday: number; block: number; count: number }[];
  followUps: { id: number; devotee_id: string; name: string; phone: string | null; fund: string; category: string; amount: number; status: 'PENDING' | 'FAILED'; paid_at: string }[];
  health: { paidNoReceipt: number; paidNoPaymentId: number; paidNoPan: number; stuckPending: number };
  donors: { devotee_id: string; name: string; phone: string; count: number; amount: number; last: string }[];
  funds: { fund: string; category: string }[]; categoryList: string[];
};
type Member = { title: string; name: string; gothram: string; nakshathiram: string; rasi: string; relation: string };
type Row = {
  id: number; devotee_id: string; name: string; email: string | null; phone: string | null; city: string | null; state: string | null;
  fund: string; category: string; amount: number; currency: string; status: 'PAID' | 'PENDING' | 'FAILED';
  donation_date: string | null; receipt_no: string | null; order_id: string | null; payment_id: string | null; has_pan: boolean; members: Member[]; paid_at: string;
};

// Categories come from the data. Corpus and ashram have fixed names and colours; any new category gets the next colour.
const KNOWN_LABEL: Record<string, string> = { corpus: 'Corpus fund', ashram: 'Ashram fund' };
const KNOWN_COLOR: Record<string, string> = { corpus: '#7a1c1c', ashram: '#ea580c' };
const EXTRA = ['#e0a526', '#7c3aed', '#0e7490', '#be185d'];
const catLabel = (c: string) => KNOWN_LABEL[c] || c.replace(/[-_]+/g, ' ').replace(/^./, (x) => x.toUpperCase());
function colorOf(c: string, list: string[]) {
  if (KNOWN_COLOR[c]) return KNOWN_COLOR[c];
  const i = list.filter((x) => !KNOWN_COLOR[x]).indexOf(c);
  return EXTRA[(i < 0 ? 0 : i) % EXTRA.length];
}
const STATUS_LABEL: Record<string, string> = { PAID: 'Paid', PENDING: 'Pending', FAILED: 'Failed' };
const STATUS_COLOR: Record<string, string> = { PAID: '#15803d', PENDING: '#b45309', FAILED: '#b91c1c' };
const SORTS: [string, string][] = [['date', 'Newest first'], ['oldest', 'Oldest first'], ['amount_desc', 'Highest amount'], ['amount_asc', 'Lowest amount'], ['name', 'Donor name A-Z']];

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

export default function DonationPayments() {
  const { notice, flash, clear } = useFlash();
  const [preset, setPreset] = useState<Preset>('30');
  const [from, setFrom] = useState(rangeOf('30').from);
  const [to, setTo] = useState(rangeOf('30').to);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [fund, setFund] = useState('');
  const [sort, setSort] = useState('date');
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
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const LIMIT = 25;
  const seq = useRef(0);
  const tableRef = useRef<HTMLElement>(null);

  // The search box waits a moment after typing before it asks the server
  useEffect(() => {
    const t = setTimeout(() => { setQNow(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const qs = useCallback((withText: boolean) => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (category) p.set('category', category);
    if (status) p.set('status', status);
    if (fund) p.set('fund', fund);
    if (withText && qNow) p.set('q', qNow);
    return p;
  }, [from, to, category, status, fund, qNow]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setErr('');
    try {
      const sp = qs(false); // the charts follow the dates and the filters, not the search words
      const lp = qs(true); lp.set('page', String(page)); lp.set('limit', String(LIMIT)); lp.set('sort', sort);
      const [a, b] = await Promise.all([
        fetch(`${DON}/summary?${sp}`, { headers: authHeader(), cache: 'no-store' }),
        fetch(`${DON}/list?${lp}`, { headers: authHeader(), cache: 'no-store' }),
      ]);
      const [da, db] = await Promise.all([readJson(a), readJson(b)]);
      if (!a.ok) throw new Error(failText(da, `Could not load the summary (${a.status}).`));
      if (!b.ok) throw new Error(failText(db, `Could not load the payments (${b.status}).`));
      if (mine !== seq.current) return; // a newer request has started
      setSummary(da); setRows(db.items || []); setTotal(db.total || 0);
    } catch (e: any) {
      if (mine === seq.current) setErr(`${e?.message || 'Could not load the donation payments.'} [${DON}]`);
    } finally { if (mine === seq.current) setLoading(false); }
  }, [qs, page, sort]);
  useEffect(() => { load(); }, [load]);

  function choose(p: Preset) {
    setPreset(p); setPage(1);
    if (p !== 'custom') { const r = rangeOf(p); setFrom(r.from); setTo(r.to); }
    setGran(p === 'year' || p === 'all' ? 'month' : 'day');
  }

  async function download() {
    setBusy(true);
    try {
      const p = qs(true); p.set('sort', sort);
      const res = await fetch(`${DON}/export?${p}`, { headers: authHeader() });
      if (!res.ok) { flash('err', failText(await readJson(res), 'Could not make the file.')); return; }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `donation-payments-${ymd(new Date())}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy(false); }
  }

  const periodText = from || to ? `${from ? dateLabel(from) : 'the start'} to ${to ? dateLabel(to) : 'today'}` : 'all dates';
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const filtered = !!(category || status || fund || qNow);
  const buckets = summary ? makeBuckets(summary.daily, gran, from, to) : [];
  const catList = summary?.categoryList || [];
  const SERIES = catList.map((c) => ({ key: c, label: catLabel(c), color: colorOf(c, catList) }));
  const cc = (c: string) => colorOf(c, catList);
  const catParts = SERIES.map((s) => ({ key: s.key, label: s.label, value: summary?.categories.find((x) => x.category === s.key)?.paid.amount || 0, color: s.color }));
  const healthParts = summary ? [
    { key: 'PAID', label: `Paid (${summary.paid.count})`, value: summary.paid.count, color: STATUS_COLOR.PAID },
    { key: 'PENDING', label: `Pending (${summary.pending.count})`, value: summary.pending.count, color: STATUS_COLOR.PENDING },
    { key: 'FAILED', label: `Failed (${summary.failed.count})`, value: summary.failed.count, color: STATUS_COLOR.FAILED },
  ] : [];
  let acc = 0;
  const running = buckets.map((b) => { acc += b.total; return { label: b.label, value: Math.round(acc * 100) / 100, note: `${inr(b.total)} added this ${gran}` }; });
  const repeatPct = summary && summary.payers ? Math.round((summary.repeatDonors / summary.payers) * 100) : 0;

  return (
    <div className="dc">
      <style>{CSS}</style>
      <style>{PDX_CSS}</style>
      <Notice notice={notice} onClear={clear} />
      <div className="pdx">
        <div className="pdx-top">
          <div>
            <h1 className="pdx-title">Donation payments</h1>
            <p className="pdx-sub" style={{ fontSize: 14 }}>Every donation and corpus gift with the donor, the Razorpay ids and the names written. Money is counted only when a payment is paid.</p>
          </div>
          <button type="button" className="pdx-btn" onClick={download} disabled={busy || loading || total === 0}>{busy ? 'Preparing...' : 'Download CSV'}</button>
        </div>

        {/* Filters */}
        <div className="pdx-card" style={{ marginBottom: 14 }}>
          <div className="pdx-row" style={{ marginBottom: 12 }} role="group" aria-label="Payment date">
            {([['month', 'This month'], ['30', 'Last 30 days'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Choose dates']] as [Preset, string][]).map(([id, label]) => (
              <button key={id} type="button" className={`pdx-btn${preset === id ? ' on' : ''}`} aria-pressed={preset === id} onClick={() => choose(id)}>{label}</button>
            ))}
          </div>
          <div className="pdx-row">
            <div><label className="pdx-lbl" htmlFor="sf">From</label><input id="sf" className="pdx-inp" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); setPage(1); }} /></div>
            <div><label className="pdx-lbl" htmlFor="st">To</label><input id="st" className="pdx-inp" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPreset('custom'); setPage(1); }} /></div>
            <div>
              <label className="pdx-lbl" htmlFor="sc">Category</label>
              <select id="sc" className="pdx-inp" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
                <option value="">All categories</option>
                {catList.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
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
              <label className="pdx-lbl" htmlFor="sv">Fund</label>
              <select id="sv" className="pdx-inp" style={{ width: '100%' }} value={fund} onChange={(e) => { setFund(e.target.value); setPage(1); }}>
                <option value="">All funds</option>
                {(summary?.funds || []).filter((x) => !category || x.category === category).map((x) => <option key={x.fund} value={x.fund}>{x.fund}</option>)}
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="so">Sort by</label>
              <select id="so" className="pdx-inp" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label className="pdx-lbl" htmlFor="sq">Search donors and payments</label>
              <input id="sq" className="pdx-inp" style={{ width: '100%' }} value={q} maxLength={80} placeholder="Donor name, phone, email, receipt, Razorpay id or fund" onChange={(e) => setQ(e.target.value)} />
            </div>
            {filtered && <button type="button" className="pdx-btn" onClick={() => { setCategory(''); setStatus(''); setFund(''); setQ(''); setQNow(''); setPage(1); }}>Clear filters</button>}
          </div>
        </div>

        {err ? (
          <div role="alert" className="pdx-err">{err} <button type="button" className="pdx-link" onClick={load}>Try again</button></div>
        ) : (
          <div className={loading && summary ? 'pdx-busy' : ''} aria-busy={loading}>
            <Group title="Summary" note={`Money counted only when a payment is paid. Period: ${periodText}.`} />
            <div className="pdx-grid pdx-g-kpi">
              <div className="pdx-card pdx-hero">
                <p className="pdx-sub">Collected</p>
                <p className="pdx-big">{summary ? inr(summary.paid.amount) : '...'}</p>
                {summary && <Delta now={summary.paid.amount} before={summary.previous} />}
                <p className="pdx-sub" style={{ marginTop: 10 }}>{summary ? `${summary.paid.count} paid donations` : ''}</p>
              </div>
              <Stat label="Donors" value={summary ? String(summary.payers) : '...'} sub={summary && summary.payers ? `${inr(summary.paid.amount / summary.payers)} on average each` : ''} />
              <Stat label="Average donation" value={summary ? inr(summary.average) : '...'} sub="of the paid donations" />
              <Stat label="Funds supported" value={summary ? String(summary.fundTable.filter((t) => t.paid > 0).length) : '...'} sub="different funds with a paid donation" />
            </div>
            <div className="pdx-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))' }}>
              {(summary?.categories || []).map((c) => <Stat key={c.category} label={catLabel(c.category)} value={inr(c.paid.amount)} sub={`${c.paid.count} paid`} color={cc(c.category)} />)}
              <Stat label="Pending" value={summary ? inr(summary.pending.amount) : '...'} sub={summary ? `${summary.pending.count} not completed` : ''} color={STATUS_COLOR.PENDING} />
              <Stat label="Failed" value={summary ? String(summary.failed.count) : '...'} sub={summary ? `${inr(summary.failed.amount)} not received` : ''} color={STATUS_COLOR.FAILED} />
            </div>

            <Group title="Collections" />
            <div className="pdx-grid pdx-g-main">
              <section className="pdx-card" aria-label="Revenue flow">
                <div className="pdx-head">
                  <div><h3>Revenue flow</h3><p className="pdx-sub">Money collected by category</p></div>
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
                {mode === 'bars' ? <div className="pdx-key">{SERIES.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div> : <div className="pdx-key">The line shows all categories together. Hover a point for the split.</div>}
              </section>
              <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                <section className="pdx-card" aria-label="Categories">
                  <h3>Categories</h3>
                  <p className="pdx-sub" style={{ marginBottom: 10 }}>Share of the money collected</p>
                  <Donut parts={catParts} centerTop="Total" centerBottom={summary ? short(summary.paid.amount) : '...'} label="Money collected by category" />
                </section>
                <section className="pdx-card" aria-label="Payment health">
                  <h3>Payment health</h3>
                  <p className="pdx-sub" style={{ marginBottom: 10 }}>How many attempts ended well</p>
                  <Donut parts={healthParts} centerTop="Success" centerBottom={summary ? `${summary.successRate}%` : '...'} label="Share of paid, pending and failed bookings" />
                  {summary && <p className="pdx-sub" style={{ marginTop: 10 }}>{repeatPct}% of donors gave more than once ({summary.repeatDonors} of {summary.payers}).</p>}
                </section>
              </div>
            </div>
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="Running total">
                <h3>Running total</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>How the money adds up through the period</p>
                <LineChart label="Running total collected" points={running} />
              </section>
              <section className="pdx-card" aria-label="Donation sizes">
                <h3>Donation sizes</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Paid donations by amount</p>
                <Columns label="Paid donations by amount range" items={(summary?.ranges || []).map((r) => ({ label: r.label.replace(' to ', ' to '), value: r.count, note: `${r.count} donation${r.count === 1 ? '' : 's'}, ${inr(r.amount)}` }))} />
              </section>
            </div>

            <Group title="Funds and donors" />
            <section className="pdx-card" aria-label="Fund-wise report" style={{ marginBottom: 14 }}>
              <div className="pdx-head">
                <div><h3>Fund-wise report</h3><p className="pdx-sub">Every fund with its donations and money. Press View to see its payments.</p></div>
                <button type="button" className="pdx-btn" disabled={!summary || summary.fundTable.length === 0} onClick={() => {
                  if (!summary) return;
                  const head = ['Fund', 'Category', 'Attempts', 'Paid', 'Collected (INR)', 'Failed', 'Pending', 'Success rate %'];
                  const lines = [head.map(csvCell).join(',')].concat(summary.fundTable.map((t) => [t.fund, catLabel(t.category), t.bookings, t.paid, t.amount, t.failed, t.pending, t.bookings ? Math.round((t.paid / t.bookings) * 100) : 0].map(csvCell).join(',')));
                  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
                  const a = document.createElement('a'); a.href = url; a.download = `fund-wise-report-${ymd(new Date())}.csv`; document.body.appendChild(a); a.click(); a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 2000);
                }}>Download report</button>
              </div>
              <div className="pdx-tablewrap">
                <table style={{ minWidth: 760 }}>
                  <thead><tr>{['Fund', 'Category', 'Attempts', 'Paid', 'Collected', 'Failed', 'Success', ''].map((h, i) => <th key={i} scope="col" style={{ textAlign: i >= 2 && i <= 5 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(!summary || summary.fundTable.length === 0) && <tr><td colSpan={8} className="pdx-empty">No donations in this period.</td></tr>}
                    {summary?.fundTable.map((t) => {
                      const rate = t.bookings ? Math.round((t.paid / t.bookings) * 100) : 0;
                      return (
                        <tr key={`${t.category}-${t.fund}`}>
                          <td style={{ fontWeight: 700, maxWidth: 260 }}>{t.fund}</td>
                          <td><span className="pdx-pill"><i style={{ background: cc(t.category) }} />{catLabel(t.category)}</span></td>
                          <td style={{ textAlign: 'right' }}>{t.bookings}</td>
                          <td style={{ textAlign: 'right' }}>{t.paid}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{inr(t.amount)}</td>
                          <td style={{ textAlign: 'right', color: t.failed ? STATUS_COLOR.FAILED : undefined }}>{t.failed}</td>
                          <td style={{ minWidth: 110 }}>
                            <div className="pdx-bar" role="img" aria-label={`${rate}% of attempts were paid`}><div style={{ width: `${rate}%`, background: rate >= 70 ? STATUS_COLOR.PAID : rate >= 40 ? STATUS_COLOR.PENDING : STATUS_COLOR.FAILED }} /></div>
                            <p className="pdx-sub">{rate}%</p>
                          </td>
                          <td><button type="button" className="pdx-link" onClick={() => {
                            setFund(t.fund); setCategory(t.category); setPage(1);
                            setTimeout(() => tableRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 50);
                          }}>View</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="pdx-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))' }}>
              <section className="pdx-card" aria-label="Top funds">
                <h3>Top funds</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>What brought in the most</p>
                <HBars items={(summary?.top || []).map((t) => ({ key: `${t.category}-${t.fund}`, label: t.fund, value: t.amount, color: cc(t.category), sub: `${catLabel(t.category)} · ${t.count} donation${t.count === 1 ? '' : 's'}` }))} />
              </section>
              <section className="pdx-card" aria-label="Top donors">
                <h3>Top donors</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Press a name to see all of that donor&apos;s payments</p>
                {!summary || summary.donors.length === 0 ? <p className="pdx-empty">Nothing yet.</p> : summary.donors.map((d) => (
                  <div className="pdx-donor" key={d.devotee_id}>
                    <span className="pdx-ava" aria-hidden="true">{(d.name || '?').trim().charAt(0).toUpperCase()}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <button type="button" className="pdx-link" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 700, padding: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}
                        onClick={() => { setQ(d.devotee_id); setQNow(d.devotee_id); setPage(1); }}>{d.name || d.devotee_id}</button>
                      <p className="pdx-sub">{d.count} donation{d.count === 1 ? '' : 's'}{d.phone ? ` · ${d.phone}` : ''}</p>
                    </div>
                    <b>{inr(d.amount)}</b>
                  </div>
                ))}
              </section>
              <section className="pdx-card" aria-label="Donors by state">
                <h3>Donors by state</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>Money collected by where the donor lives</p>
                <HBars items={(summary?.states || []).map((t) => ({ key: t.state, label: t.state, value: t.amount, color: '#e0a526', sub: `${t.count} donation${t.count === 1 ? '' : 's'}` }))} />
              </section>
              <section className="pdx-card" aria-label="Donors by city">
                <h3>Donors by city</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>Money collected by city</p>
                <HBars items={(summary?.cities || []).map((t) => ({ key: t.city, label: t.city, value: t.amount, color: '#7c3aed', sub: `${t.count} donation${t.count === 1 ? '' : 's'}` }))} />
              </section>
              <section className="pdx-card" aria-label="When people pay">
                <h3>When people pay</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Paid donations by weekday and time of day (server clock)</p>
                {summary && summary.activity.length > 0 ? <ActivityDots data={summary.activity} /> : <p className="pdx-empty">Nothing yet.</p>}
              </section>
            </div>

            <Group title="Needs attention" note="Things the temple office may want to act on." />
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="Follow up">
                <h3>Follow up</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Latest pending and failed donations. A call can turn them into paid ones.</p>
                {!summary || summary.followUps.length === 0 ? <p className="pdx-empty">Nothing to follow up. </p> : summary.followUps.map((f) => (
                  <div className="pdx-donor" key={f.id}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || 'Unknown donor'} <span className="pdx-pill" style={{ marginLeft: 6 }}><i style={{ background: STATUS_COLOR[f.status] }} />{STATUS_LABEL[f.status]}</span></p>
                      <p className="pdx-sub">{f.fund} · {ago(f.paid_at)}{f.phone ? ' · ' : ''}{f.phone && (telHref(f.phone) ? <a className="pdx-link" style={{ padding: 0 }} href={telHref(f.phone)}>{f.phone}</a> : f.phone)}</p>
                    </div>
                    <b>{inr(f.amount)}</b>
                  </div>
                ))}
              </section>
              <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                <section className="pdx-card" aria-label="Health checks">
                  <h3>Health checks</h3>
                  <p className="pdx-sub" style={{ marginBottom: 8 }}>Records that may need a look</p>
                  {summary && ([
                    ['Paid donations without a receipt number', summary.health.paidNoReceipt],
                    ['Paid donations without a Razorpay payment id', summary.health.paidNoPaymentId],
                    ['Paid donations without a PAN (needed for 80G)', summary.health.paidNoPan],
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

            {/* The payments */}
            <Group title="All payments" />
            <section ref={tableRef} className="pdx-card" aria-label="Donation payments" style={{ marginBottom: 4, scrollMarginTop: 12 }}>
              <div className="pdx-head">
                <h3>Payments</h3>
                <span className="pdx-sub">{loading ? 'Loading...' : `${total} found`}</span>
              </div>
              <div className="pdx-tablewrap">
                <table style={{ minWidth: 1000 }}>
                  <thead>
                    <tr>{['Payment date', 'Donor', 'Fund', 'Category', 'Amount', 'Status', 'Transaction id (Razorpay payment)', ''].map((h, i) => <th key={i} scope="col" style={{ textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {!loading && rows.length === 0 && (
                      <tr><td colSpan={8} className="pdx-empty">{filtered || preset !== 'all' ? 'No donation payments match these filters.' : 'No donation payments yet.'}</td></tr>
                    )}
                    {rows.map((r) => {
                      const isOpen = open === r.id;
                      return (
                        <React.Fragment key={r.id}>
                          <tr className={isOpen ? 'open' : ''}>
                            <td style={{ whiteSpace: 'nowrap' }}>{when(r.paid_at)}</td>
                            <td style={{ minWidth: 150 }}>
                              <p style={{ fontWeight: 700 }}>{r.name || <span className="pdx-mut">Unknown donor</span>}</p>
                              <p className="pdx-sub">{r.phone || r.email || ''}</p>
                            </td>
                            <td style={{ maxWidth: 220 }}>
                              <p>{r.fund}</p>
                              {r.donation_date && <p className="pdx-sub">Donation date {dateLabel(r.donation_date)}</p>}
                            </td>
                            <td><span className="pdx-pill"><i style={{ background: cc(r.category) }} />{catLabel(r.category)}</span></td>
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
                                  <div><dt>Donor (devotee) id</dt><dd>{r.devotee_id}</dd></div>
                                  <div><dt>Email</dt><dd>{r.email || '-'}</dd></div>
                                  <div><dt>Phone</dt><dd>{r.phone || '-'}</dd></div>
                                  <div><dt>City and state</dt><dd>{[r.city, r.state].filter(Boolean).join(', ') || '-'}</dd></div>
                                  <div><dt>Donation date</dt><dd>{dateLabel(r.donation_date)}</dd></div>
                                  <div><dt>PAN given</dt><dd>{r.has_pan ? 'Yes' : 'No'}</dd></div>
                                </dl>
                                <p style={{ fontWeight: 700, margin: '14px 0 6px' }}>Names written with this donation</p>
                                {r.members.length === 0 ? <p className="pdx-sub">No names were saved with this donation.</p> : (
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
                                  <button type="button" className="pdx-btn" onClick={() => { setQ(r.devotee_id); setQNow(r.devotee_id); setPage(1); setOpen(null); }}>Show all payments of this donor</button>
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