import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API, CSS, Notice, authHeader, failText, readJson, useFlash } from './DiscoverKit';
import { ActivityDots, Columns, Delta, Donut, HBars, LineChart, PDX_CSS, RevenueChart, inr, makeBuckets, rangeOf, short, when, ymd } from './PaymentCharts';
import type { DailyRow, Gran, Money, Preset } from './PaymentCharts';

// API points at .../api/v1/discover. The Magazine payments API is .../api/v1/payments/admin/magazine
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const MAG = `${API_BASE}/payments/admin/magazine`;

type Cat = { category: string; paid: Money; pending: Money; failed: Money };
type Summary = {
  paid: Money; pending: Money; failed: Money; average: number; successRate: number; payers: number; repeatSubscribers: number; previous: Money | null;
  subscriptions: { active: number; expired: number; endingSoon: number; toPost: number };
  categories: Cat[]; daily: DailyRow[];
  top: { plan: string; category: string; count: number; amount: number }[];
  planTable: { plan: string; category: string; bookings: number; paid: number; amount: number; failed: number; pending: number }[];
  states: { state: string; count: number; amount: number }[];
  cities: { city: string; count: number; amount: number }[];
  durations: { months: number; count: number; amount: number }[];
  modes: { mode: string; count: number; amount: number }[];
  expiring: { id: number; devotee_id: string; name: string; phone: string | null; email: string | null; plan: string; end_date: string | null; amount: number }[];
  activity: { weekday: number; block: number; count: number }[];
  followUps: { id: number; devotee_id: string; name: string; phone: string | null; plan: string; category: string; amount: number; status: 'PENDING' | 'FAILED'; paid_at: string }[];
  health: { paidNoReceipt: number; paidNoPaymentId: number; printNoAddress: number; lapsed: number; stuckPending: number };
  subscribers: { devotee_id: string; name: string; phone: string; count: number; amount: number; last: string }[];
  plans: string[];
};
type Row = {
  id: number; devotee_id: string; name: string; email: string | null; phone: string | null; city: string | null; state: string | null;
  address: string | null; pincode: string | null; plan: string; category: string; months: number; amount: number; pay_account: string;
  status: 'PAID' | 'PENDING' | 'FAILED'; membership: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'FAILED'; start_date: string | null; end_date: string | null;
  receipt_no: string | null; order_id: string | null; payment_id: string | null; mode: string; reminder_30: boolean; reminder_7: boolean; paid_at: string;
};

// The delivery type is the category: a printed copy by post, a digital copy, or both.
const DELIVERIES = ['print', 'digital', 'both'];
const KNOWN_LABEL: Record<string, string> = { print: 'Print', digital: 'Digital', both: 'Print + digital' };
const KNOWN_COLOR: Record<string, string> = { print: '#7a1c1c', digital: '#ea580c', both: '#e0a526' };
const catLabel = (c: string) => KNOWN_LABEL[c] || c;
const colorOf = (c: string) => KNOWN_COLOR[c] || '#7c3aed';
const MEMBER_LABEL: Record<string, string> = { ACTIVE: 'Active', EXPIRED: 'Expired', PENDING: 'Not started', FAILED: 'Not started' };
const MEMBER_COLOR: Record<string, string> = { ACTIVE: '#15803d', EXPIRED: '#64748b', PENDING: '#b45309', FAILED: '#b91c1c' };
const STATUS_LABEL: Record<string, string> = { PAID: 'Paid', PENDING: 'Pending', FAILED: 'Failed' };
const STATUS_COLOR: Record<string, string> = { PAID: '#15803d', PENDING: '#b45309', FAILED: '#b91c1c' };
const SORTS: [string, string][] = [['date', 'Newest first'], ['oldest', 'Oldest first'], ['amount_desc', 'Highest amount'], ['amount_asc', 'Lowest amount'], ['name', 'Subscriber name A-Z'], ['ending', 'Ending soonest']];

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

export default function MagazinePayments() {
  const { notice, flash, clear } = useFlash();
  const [preset, setPreset] = useState<Preset>('30');
  const [from, setFrom] = useState(rangeOf('30').from);
  const [to, setTo] = useState(rangeOf('30').to);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [membership, setMembership] = useState('');
  const [payHow, setPayHow] = useState('');
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
    if (plan) p.set('plan', plan);
    if (membership) p.set('membership', membership);
    if (payHow) p.set('mode', payHow);
    if (withText && qNow) p.set('q', qNow);
    return p;
  }, [from, to, category, status, plan, membership, payHow, qNow]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setErr('');
    try {
      const sp = qs(true); // the figures and charts follow the dates, the filters and the search words
      const lp = qs(true); lp.set('page', String(page)); lp.set('limit', String(LIMIT)); lp.set('sort', sort);
      const [a, b] = await Promise.all([
        fetch(`${MAG}/summary?${sp}`, { headers: authHeader(), cache: 'no-store' }),
        fetch(`${MAG}/list?${lp}`, { headers: authHeader(), cache: 'no-store' }),
      ]);
      const [da, db] = await Promise.all([readJson(a), readJson(b)]);
      if (!a.ok) throw new Error(failText(da, `Could not load the summary (${a.status}).`));
      if (!b.ok) throw new Error(failText(db, `Could not load the payments (${b.status}).`));
      if (mine !== seq.current) return; // a newer request has started
      setSummary(da); setRows((db.items || []).map((r: any) => ({ ...r, category: r.delivery }))); setTotal(db.total || 0);
    } catch (e: any) {
      if (mine === seq.current) setErr(`${e?.message || 'Could not load the magazine payments.'} [${MAG}]`);
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
      const res = await fetch(`${MAG}/export?${p}`, { headers: authHeader() });
      if (!res.ok) { flash('err', failText(await readJson(res), 'Could not make the file.')); return; }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `magazine-payments-${ymd(new Date())}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy(false); }
  }

  const periodText = from || to ? `${from ? dateLabel(from) : 'the start'} to ${to ? dateLabel(to) : 'today'}` : 'all dates';
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const filtered = !!(category || status || plan || membership || payHow || qNow);
  const buckets = summary ? makeBuckets(summary.daily, gran, from, to) : [];
  const catList = DELIVERIES;
  const SERIES = catList.map((c) => ({ key: c, label: catLabel(c), color: colorOf(c) }));
  const cc = colorOf;
  const catParts = SERIES.map((s) => ({ key: s.key, label: s.label, value: summary?.categories.find((x) => x.category === s.key)?.paid.amount || 0, color: s.color }));
  const healthParts = summary ? [
    { key: 'PAID', label: `Paid (${summary.paid.count})`, value: summary.paid.count, color: STATUS_COLOR.PAID },
    { key: 'PENDING', label: `Pending (${summary.pending.count})`, value: summary.pending.count, color: STATUS_COLOR.PENDING },
    { key: 'FAILED', label: `Failed (${summary.failed.count})`, value: summary.failed.count, color: STATUS_COLOR.FAILED },
  ] : [];
  let acc = 0;
  const running = buckets.map((b) => { acc += b.total; return { label: b.label, value: Math.round(acc * 100) / 100, note: `${inr(b.total)} added this ${gran}` }; });
  const repeatPct = summary && summary.payers ? Math.round((summary.repeatSubscribers / summary.payers) * 100) : 0;

  return (
    <div className="dc">
      <style>{CSS}</style>
      <style>{PDX_CSS}</style>
      <Notice notice={notice} onClear={clear} />
      <div className="pdx">
        <div className="pdx-top">
          <div>
            <h1 className="pdx-title">Magazine payments</h1>
            <p className="pdx-sub" style={{ fontSize: 14 }}>Every magazine subscription with the subscriber, plan, delivery address, dates and Razorpay ids. Money is counted only when a payment is paid.</p>
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
              <label className="pdx-lbl" htmlFor="sc">Delivery</label>
              <select id="sc" className="pdx-inp" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
                <option value="">Print and digital</option>
                {catList.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="ss">Payment</label>
              <select id="ss" className="pdx-inp" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">All payments</option>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="sm">Subscription</label>
              <select id="sm" className="pdx-inp" value={membership} onChange={(e) => { setMembership(e.target.value); setPage(1); }}>
                <option value="">Active and expired</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="sd">Paid how</label>
              <select id="sd" className="pdx-inp" value={payHow} onChange={(e) => { setPayHow(e.target.value); setPage(1); }}>
                <option value="">Online and offline</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <div style={{ minWidth: 0, maxWidth: 260 }}>
              <label className="pdx-lbl" htmlFor="sv">Plan</label>
              <select id="sv" className="pdx-inp" style={{ width: '100%' }} value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }}>
                <option value="">All plans</option>
                {(summary?.plans || []).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="so">Sort by</label>
              <select id="so" className="pdx-inp" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label className="pdx-lbl" htmlFor="sq">Search subscribers and payments</label>
              <input id="sq" className="pdx-inp" style={{ width: '100%' }} value={q} maxLength={80} placeholder="Name, phone, email, city, pincode, receipt, Razorpay id or plan" onChange={(e) => setQ(e.target.value)} />
            </div>
            {filtered && <button type="button" className="pdx-btn" onClick={() => { setCategory(''); setStatus(''); setPlan(''); setMembership(''); setPayHow(''); setQ(''); setQNow(''); setPage(1); }}>Clear filters</button>}
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
                <p className="pdx-sub" style={{ marginTop: 10 }}>{summary ? `${summary.paid.count} paid subscriptions` : ''}</p>
              </div>
              <Stat label="Subscribers" value={summary ? String(summary.payers) : '...'} sub={summary && summary.payers ? `${inr(summary.paid.amount / summary.payers)} on average each` : ''} />
              <Stat label="Average subscription" value={summary ? inr(summary.average) : '...'} sub="of the paid subscriptions" />
              <Stat label="Active subscriptions" value={summary ? String(summary.subscriptions.active) : '...'} sub={summary ? `${summary.subscriptions.toPost} to post, ${summary.subscriptions.endingSoon} ending in 30 days` : ''} color="#15803d" />
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
                  {summary && <p className="pdx-sub" style={{ marginTop: 10 }}>{repeatPct}% of subscribers paid more than once ({summary.repeatSubscribers} of {summary.payers}).</p>}
                </section>
              </div>
            </div>
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="Running total">
                <h3>Running total</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>How the money adds up through the period</p>
                <LineChart label="Running total collected" points={running} />
              </section>
              <section className="pdx-card" aria-label="Plan length">
                <h3>Plan length</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Paid subscriptions by number of months</p>
                <Columns label="Paid subscriptions by plan length" items={(summary?.durations || []).map((r) => ({ label: `${r.months} month${r.months === 1 ? '' : 's'}`, value: r.count, note: `${r.count} subscription${r.count === 1 ? '' : 's'}, ${inr(r.amount)}` }))} />
              </section>
            </div>

            <Group title="Plans and subscribers" />
            <section className="pdx-card" aria-label="Plan-wise report" style={{ marginBottom: 14 }}>
              <div className="pdx-head">
                <div><h3>Plan-wise report</h3><p className="pdx-sub">Every plan with its subscriptions and money. Press View to see its payments.</p></div>
                <button type="button" className="pdx-btn" disabled={!summary || summary.planTable.length === 0} onClick={() => {
                  if (!summary) return;
                  const head = ['Plan', 'Delivery', 'Attempts', 'Paid', 'Collected (INR)', 'Failed', 'Pending', 'Success rate %'];
                  const lines = [head.map(csvCell).join(',')].concat(summary.planTable.map((t) => [t.plan, catLabel(t.category), t.bookings, t.paid, t.amount, t.failed, t.pending, t.bookings ? Math.round((t.paid / t.bookings) * 100) : 0].map(csvCell).join(',')));
                  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
                  const a = document.createElement('a'); a.href = url; a.download = `plan-wise-report-${ymd(new Date())}.csv`; document.body.appendChild(a); a.click(); a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 2000);
                }}>Download report</button>
              </div>
              <div className="pdx-tablewrap">
                <table style={{ minWidth: 760 }}>
                  <thead><tr>{['Plan', 'Delivery', 'Attempts', 'Paid', 'Collected', 'Failed', 'Success', ''].map((h, i) => <th key={i} scope="col" style={{ textAlign: i >= 2 && i <= 5 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(!summary || summary.planTable.length === 0) && <tr><td colSpan={9} className="pdx-empty">No subscriptions in this period.</td></tr>}
                    {summary?.planTable.map((t) => {
                      const rate = t.bookings ? Math.round((t.paid / t.bookings) * 100) : 0;
                      return (
                        <tr key={`${t.category}-${t.plan}`}>
                          <td style={{ fontWeight: 700, maxWidth: 260 }}>{t.plan}</td>
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
                            setPlan(t.plan); setCategory(t.category); setPage(1);
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
              <section className="pdx-card" aria-label="Top plans">
                <h3>Top plans</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>What brought in the most</p>
                <HBars items={(summary?.top || []).map((t) => ({ key: `${t.category}-${t.plan}`, label: t.plan, value: t.amount, color: cc(t.category), sub: `${catLabel(t.category)} · ${t.count} subscription${t.count === 1 ? '' : 's'}` }))} />
              </section>
              <section className="pdx-card" aria-label="Top subscribers">
                <h3>Top subscribers</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Press a name to see all of that subscriber&apos;s payments</p>
                {!summary || summary.subscribers.length === 0 ? <p className="pdx-empty">Nothing yet.</p> : summary.subscribers.map((d) => (
                  <div className="pdx-donor" key={d.devotee_id}>
                    <span className="pdx-ava" aria-hidden="true">{(d.name || '?').trim().charAt(0).toUpperCase()}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <button type="button" className="pdx-link" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 700, padding: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}
                        onClick={() => { setQ(d.devotee_id); setQNow(d.devotee_id); setPage(1); }}>{d.name || d.devotee_id}</button>
                      <p className="pdx-sub">{d.count} subscription{d.count === 1 ? '' : 's'}{d.phone ? ` · ${d.phone}` : ''}</p>
                    </div>
                    <b>{inr(d.amount)}</b>
                  </div>
                ))}
              </section>
              <section className="pdx-card" aria-label="Subscribers by state">
                <h3>Subscribers by state</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>Money collected by where the subscriber lives</p>
                <HBars items={(summary?.states || []).map((t) => ({ key: t.state, label: t.state, value: t.amount, color: '#e0a526', sub: `${t.count} subscription${t.count === 1 ? '' : 's'}` }))} />
              </section>
              <section className="pdx-card" aria-label="Subscribers by city">
                <h3>Subscribers by city</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>Money collected by city</p>
                <HBars items={(summary?.cities || []).map((t) => ({ key: t.city, label: t.city, value: t.amount, color: '#7c3aed', sub: `${t.count} subscription${t.count === 1 ? '' : 's'}` }))} />
              </section>
              <section className="pdx-card" aria-label="When people pay">
                <h3>When people pay</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Paid subscriptions by weekday and time of day (server clock)</p>
                {summary && summary.activity.length > 0 ? <ActivityDots data={summary.activity} /> : <p className="pdx-empty">Nothing yet.</p>}
              </section>
              <section className="pdx-card" aria-label="Online and offline">
                <h3>Online and offline</h3>
                <p className="pdx-sub" style={{ marginBottom: 10 }}>How the paid subscriptions were paid</p>
                <Donut parts={(summary?.modes || []).map((m, i) => ({ key: m.mode, label: `${m.mode === 'online' ? 'Online' : m.mode === 'offline' ? 'Offline' : m.mode} (${m.count})`, value: m.amount, color: ['#7a1c1c', '#e0a526', '#7c3aed'][i % 3] }))} centerTop="Total" centerBottom={summary ? short(summary.paid.amount) : '...'} label="Money collected online and offline" />
              </section>
            </div>

            <Group title="Needs attention" note="Things the temple office may want to act on." />
            <section className="pdx-card" aria-label="Renewals due" style={{ marginBottom: 14 }}>
              <div className="pdx-head">
                <div><h3>Renewals due</h3><p className="pdx-sub">Active subscriptions that end in the next 30 days. A call or message now keeps the subscriber.</p></div>
                {summary && <span className="pdx-sub">{summary.subscriptions.active} active · {summary.subscriptions.expired} expired</span>}
              </div>
              {!summary || summary.expiring.length === 0 ? <p className="pdx-empty">No subscription ends in the next 30 days.</p> : summary.expiring.map((x) => {
                const days = x.end_date ? Math.max(0, Math.round((new Date(`${x.end_date}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000)) : null;
                return (
                  <div className="pdx-donor" key={x.id}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name || 'Unknown subscriber'} <span className="pdx-pill" style={{ marginLeft: 6 }}><i style={{ background: days !== null && days <= 7 ? STATUS_COLOR.FAILED : STATUS_COLOR.PENDING }} />{days === null ? '' : days === 0 ? 'Ends today' : `${days} day${days === 1 ? '' : 's'} left`}</span></p>
                      <p className="pdx-sub">{x.plan} · ends {dateLabel(x.end_date)}{x.phone ? ' · ' : ''}{x.phone && (telHref(x.phone) ? <a className="pdx-link" style={{ padding: 0 }} href={telHref(x.phone)}>{x.phone}</a> : x.phone)}</p>
                    </div>
                    <b>{inr(x.amount)}</b>
                  </div>
                );
              })}
            </section>
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="Follow up">
                <h3>Follow up</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Latest pending and failed subscriptions. A call can turn them into paid ones.</p>
                {!summary || summary.followUps.length === 0 ? <p className="pdx-empty">Nothing to follow up. </p> : summary.followUps.map((f) => (
                  <div className="pdx-donor" key={f.id}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || 'Unknown subscriber'} <span className="pdx-pill" style={{ marginLeft: 6 }}><i style={{ background: STATUS_COLOR[f.status] }} />{STATUS_LABEL[f.status]}</span></p>
                      <p className="pdx-sub">{f.plan} · {ago(f.paid_at)}{f.phone ? ' · ' : ''}{f.phone && (telHref(f.phone) ? <a className="pdx-link" style={{ padding: 0 }} href={telHref(f.phone)}>{f.phone}</a> : f.phone)}</p>
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
                    ['Paid subscriptions without a receipt number', summary.health.paidNoReceipt],
                    ['Paid online without a Razorpay payment id', summary.health.paidNoPaymentId],
                    ['Print copies without an address or pincode', summary.health.printNoAddress],
                    ['Marked active but already past the end date', summary.health.lapsed],
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
            <section ref={tableRef} className="pdx-card" aria-label="Magazine payments" style={{ marginBottom: 4, scrollMarginTop: 12 }}>
              <div className="pdx-head">
                <h3>Payments</h3>
                <span className="pdx-sub">{loading ? 'Loading...' : `${total} found`}</span>
              </div>
              <div className="pdx-tablewrap">
                <table style={{ minWidth: 1000 }}>
                  <thead>
                    <tr>{['Payment date', 'Subscriber', 'Plan', 'Delivery', 'Amount', 'Payment', 'Subscription', 'Transaction id (Razorpay payment)', ''].map((h, i) => <th key={i} scope="col" style={{ textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {!loading && rows.length === 0 && (
                      <tr><td colSpan={9} className="pdx-empty">{filtered || preset !== 'all' ? 'No magazine payments match these filters.' : 'No magazine payments yet.'}</td></tr>
                    )}
                    {rows.map((r) => {
                      const isOpen = open === r.id;
                      return (
                        <React.Fragment key={r.id}>
                          <tr className={isOpen ? 'open' : ''}>
                            <td style={{ whiteSpace: 'nowrap' }}>{when(r.paid_at)}</td>
                            <td style={{ minWidth: 150 }}>
                              <p style={{ fontWeight: 700 }}>{r.name || <span className="pdx-mut">Unknown subscriber</span>}</p>
                              <p className="pdx-sub">{r.phone || r.email || ''}</p>
                            </td>
                            <td style={{ maxWidth: 220 }}>
                              <p>{r.plan}</p>
                              <p className="pdx-sub">{r.months} month{r.months === 1 ? '' : 's'}</p>
                            </td>
                            <td><span className="pdx-pill"><i style={{ background: cc(r.category) }} />{catLabel(r.category)}</span></td>
                            <td style={{ textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{inr(r.amount)}</td>
                            <td><span className="pdx-pill"><i style={{ background: STATUS_COLOR[r.status] }} />{STATUS_LABEL[r.status]}</span></td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <span className="pdx-pill"><i style={{ background: MEMBER_COLOR[r.membership] }} />{MEMBER_LABEL[r.membership]}</span>
                              {r.end_date && r.status === 'PAID' && <p className="pdx-sub">until {dateLabel(r.end_date)}</p>}
                            </td>
                            <td style={{ fontSize: 13, maxWidth: 230 }}><Copyable value={r.payment_id} label="transaction id" /></td>
                            <td><button type="button" className="pdx-link" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>{isOpen ? 'Hide' : 'Details'}</button></td>
                          </tr>
                          {isOpen && (
                            <tr className="open">
                              <td colSpan={9} style={{ paddingTop: 4 }}>
                                <dl>
                                  <div><dt>Transaction id (Razorpay payment)</dt><dd><Copyable value={r.payment_id} label="transaction id" /></dd></div>
                                  <div><dt>Razorpay order id</dt><dd><Copyable value={r.order_id} label="order id" /></dd></div>
                                  <div><dt>Receipt no</dt><dd>{r.receipt_no || '-'}</dd></div>
                                  <div><dt>Subscriber (devotee) id</dt><dd>{r.devotee_id}</dd></div>
                                  <div><dt>Email</dt><dd>{r.email || '-'}</dd></div>
                                  <div><dt>Phone</dt><dd>{r.phone || '-'}</dd></div>
                                  <div><dt>Postal address</dt><dd>{[r.address, r.city, r.state, r.pincode].filter(Boolean).join(', ') || '-'}</dd></div>
                                  <div><dt>Plan</dt><dd>{r.plan} ({r.months} months)</dd></div>
                                  <div><dt>Delivery</dt><dd>{catLabel(r.category)}</dd></div>
                                  <div><dt>Starts</dt><dd>{dateLabel(r.start_date)}</dd></div>
                                  <div><dt>Ends</dt><dd>{dateLabel(r.end_date)}</dd></div>
                                  <div><dt>Paid how</dt><dd>{r.mode === 'online' ? 'Online' : r.mode === 'offline' ? 'Offline' : r.mode}</dd></div>
                                  <div><dt>Money goes to</dt><dd>{r.pay_account === 'donation' ? 'Donation account' : 'Seva account'}</dd></div>
                                  <div><dt>Renewal reminders sent</dt><dd>{[r.reminder_30 ? '30 days' : '', r.reminder_7 ? '7 days' : ''].filter(Boolean).join(' and ') || 'None yet'}</dd></div>
                                </dl>
                                <div style={{ marginTop: 12 }}>
                                  <button type="button" className="pdx-btn" onClick={() => { setQ(r.devotee_id); setQNow(r.devotee_id); setPage(1); setOpen(null); }}>Show all payments of this subscriber</button>
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