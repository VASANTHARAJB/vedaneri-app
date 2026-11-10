import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API, CSS, Notice, authHeader, failText, fileUrl, readJson, useFlash } from './DiscoverKit';
import { PDX_CSS, inr, rangeOf, when, ymd } from './PaymentCharts';
import type { Preset } from './PaymentCharts';

// API points at .../api/v1/discover. The devotee API is .../api/v1/devotees-admin/admin/devotees
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const DV = `${API_BASE}/devotees-admin/admin/devotees`;
const G80 = `${API_BASE}/devotees-admin/admin/donations-80g/export`;

type Totals = { donation: number; seva: number; camp: number; magazine: number };
type Devotee = {
  id: string; name: string; email: string | null; phone: string | null; residency: 'indian' | 'nri'; city: string | null; state: string | null;
  comm_address: string | null; perm_address: string | null; avatar_url: string | null; verified: boolean; login: 'google' | 'password'; has_pan: boolean;
  joined_at: string; last_active: string; last_paid: string | null; pay_count: number; pay_total: number; family_count: number; totals: Totals;
};
type Family = { id: number; title: string; name: string; gothram: string; nakshathiram: string; rasi: string; relation: string };
type Pay = { source: string; item: string; amount: number; status: 'PAID' | 'PENDING' | 'FAILED'; receipt_no: string | null; payment_id: string | null; paid_at: string };
type Camp = { id: number; title: string; adults: number; children: number; status: string; amount: number; payment_status: string; registered_at: string };
type PanOut = { profile: { pan: string; valid: boolean | null }; donations: { id: number; receipt_no: string | null; fund: string; amount: number; date: string; pan: string; valid: boolean | null; address: string }[] };
type Detail = { devotee: Devotee; family: Family[]; payments: Pay[]; camps: Camp[] };
type ListOut = { total: number; items: Devotee[]; totals: { devotees: number; verified: number; paying: number; paid: number }; states: string[] };

const SOURCE_LABEL: Record<string, string> = { donation: 'Donation', seva: 'Seva', camp: 'Camp', magazine: 'Magazine' };
const SOURCE_COLOR: Record<string, string> = { donation: '#7a1c1c', seva: '#ea580c', camp: '#e0a526', magazine: '#7c3aed' };
const STATUS_LABEL: Record<string, string> = { PAID: 'Paid', PENDING: 'Pending', FAILED: 'Failed' };
const STATUS_COLOR: Record<string, string> = { PAID: '#15803d', PENDING: '#b45309', FAILED: '#b91c1c' };
const SORTS: [string, string][] = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['name', 'Name A-Z'], ['paid', 'Most paid'], ['active', 'Recently active'], ['family', 'Most family members']];

const csvDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const telHref = (p: string | null) => (p && /^\+?[\d\s-]{6,20}$/.test(p) ? `tel:${p.replace(/[\s-]/g, '')}` : undefined);
const dateLabel = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="pdx-card">
      <p className="pdx-kpi-l">{label}</p>
      <p className="pdx-kpi-n" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="pdx-sub">{sub}</p>}
    </div>
  );
}

function Avatar({ d, size = 34 }: { d: { name: string; avatar_url: string | null }; size?: number }) {
  const [bad, setBad] = useState(false);
  const letter = (d.name || '?').trim().charAt(0).toUpperCase();
  if (d.avatar_url && !bad) {
    return <img src={fileUrl(d.avatar_url)} alt="" width={size} height={size} onError={() => setBad(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />;
  }
  return <span className="pdx-ava" aria-hidden="true" style={{ width: size, height: size }}>{letter}</span>;
}


// A short id with a Copy button
function CopyText({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <b style={{ letterSpacing: '.06em' }}>{value}</b>
      <button type="button" className="pdx-link" aria-label="Copy PAN" onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* the browser may block copying */ }
      }}>{done ? 'Copied' : 'Copy'}</button>
    </span>
  );
}

// PAN numbers for 80G receipts. Hidden until an admin asks; the server writes each request to its log.
function PanBox({ id }: { id: string }) {
  const [out, setOut] = useState<PanOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function show() {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`${DV}/${encodeURIComponent(id)}/pan`, { headers: authHeader(), cache: 'no-store' });
      const j = await readJson(res);
      if (!res.ok) throw new Error(failText(j, `Could not load the PAN numbers (${res.status}).`));
      setOut(j);
    } catch (e: any) { setErr(e?.message || 'Could not load the PAN numbers.'); } finally { setBusy(false); }
  }
  const badge = (valid: boolean | null) => (valid === null ? <span className="pdx-pill"><i style={{ background: STATUS_COLOR.FAILED }} />Missing</span> : valid ? <span className="pdx-pill"><i style={{ background: STATUS_COLOR.PAID }} />Format OK</span> : <span className="pdx-pill"><i style={{ background: STATUS_COLOR.PENDING }} />Check format</span>);
  return (
    <div style={{ margin: '14px 0 0' }}>
      <p style={{ fontWeight: 700, margin: '0 0 6px' }}>PAN for 80G receipts</p>
      {!out ? (
        <>
          <p className="pdx-sub" style={{ marginBottom: 8 }}>PAN numbers are private. They show only when you press the button, and the server records who looked.</p>
          <button type="button" className="pdx-btn" onClick={show} disabled={busy}>{busy ? 'Loading...' : 'Show PAN numbers'}</button>
          {err && <p role="alert" className="pdx-err" style={{ marginTop: 8 }}>{err}</p>}
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, marginBottom: 8 }}>PAN saved on the profile: {out.profile.pan ? <><CopyText value={out.profile.pan} /> {badge(out.profile.valid)}</> : <span className="pdx-mut">none</span>}</p>
          {out.donations.length === 0 ? <p className="pdx-sub">No paid donations for this devotee.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 760, fontSize: 13 }}>
                <thead><tr>{['Date', 'Receipt', 'Fund', 'Amount', 'PAN given with the donation', 'Address on the receipt'].map((h) => <th key={h} scope="col" style={{ padding: '6px 10px', textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {out.donations.map((d) => (
                    <tr key={d.id}>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{when(d.date)}</td>
                      <td style={{ padding: '6px 10px' }}>{d.receipt_no || '-'}</td>
                      <td style={{ padding: '6px 10px' }}>{d.fund}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{inr(d.amount)}</td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{d.pan ? <CopyText value={d.pan} /> : <span className="pdx-mut">-</span>} {badge(d.valid)}</td>
                      <td style={{ padding: '6px 10px' }}>{d.address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" className="pdx-link" style={{ marginTop: 6 }} onClick={() => setOut(null)}>Hide PAN numbers</button>
        </>
      )}
    </div>
  );
}

// The panel that opens under a devotee: profile, family and every payment
function Panel({ id, onPick }: { id: string; onPick: (v: string) => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    setData(null); setErr('');
    (async () => {
      try {
        const res = await fetch(`${DV}/${encodeURIComponent(id)}`, { headers: authHeader(), cache: 'no-store' });
        const j = await readJson(res);
        if (!res.ok) throw new Error(failText(j, `Could not load this devotee (${res.status}).`));
        if (live) setData(j);
      } catch (e: any) { if (live) setErr(e?.message || 'Could not load this devotee.'); }
    })();
    return () => { live = false; };
  }, [id]);

  if (err) return <p role="alert" className="pdx-err">{err}</p>;
  if (!data) return <p className="pdx-sub">Loading...</p>;
  const d = data.devotee;
  const mix = (Object.keys(SOURCE_LABEL) as (keyof Totals)[]).filter((k) => d.totals[k] > 0);
  return (
    <div>
      <dl>
        <div><dt>Devotee id</dt><dd>{d.id}</dd></div>
        <div><dt>Email</dt><dd>{d.email || '-'} {d.email && <span className="pdx-pill" style={{ marginLeft: 6 }}><i style={{ background: d.verified ? STATUS_COLOR.PAID : STATUS_COLOR.PENDING }} />{d.verified ? 'Verified' : 'Not verified'}</span>}</dd></div>
        <div><dt>Phone</dt><dd>{d.phone ? (telHref(d.phone) ? <a className="pdx-link" style={{ padding: 0 }} href={telHref(d.phone)}>{d.phone}</a> : d.phone) : '-'}</dd></div>
        <div><dt>Residency</dt><dd>{d.residency === 'nri' ? 'NRI' : 'Indian resident'}</dd></div>
        <div><dt>Communication address</dt><dd>{[d.comm_address, d.city, d.state].filter(Boolean).join(', ') || '-'}</dd></div>
        <div><dt>Permanent address</dt><dd>{d.perm_address || '-'}</dd></div>
        <div><dt>Signs in with</dt><dd>{d.login === 'google' ? 'Google' : 'Email and password'}</dd></div>
        <div><dt>PAN given</dt><dd>{d.has_pan ? 'Yes' : 'No'}</dd></div>
        <div><dt>Joined</dt><dd>{csvDate(d.joined_at)}</dd></div>
        <div><dt>Last paid</dt><dd>{csvDate(d.last_paid)}</dd></div>
      </dl>

      <PanBox id={d.id} />

      <p style={{ fontWeight: 700, margin: '14px 0 6px' }}>Money given: {inr(d.pay_total)} in {d.pay_count} payment{d.pay_count === 1 ? '' : 's'}</p>
      {mix.length === 0 ? <p className="pdx-sub">Nothing paid yet.</p> : (
        <div className="pdx-row">{mix.map((k) => <span key={k} className="pdx-pill"><i style={{ background: SOURCE_COLOR[k] }} />{SOURCE_LABEL[k]} {inr(d.totals[k])}</span>)}</div>
      )}

      <p style={{ fontWeight: 700, margin: '14px 0 6px' }}>Family members saved for sankalpam ({data.family.length})</p>
      {data.family.length === 0 ? <p className="pdx-sub">No family members saved.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 520, fontSize: 13 }}>
            <thead><tr>{['Name', 'Relation', 'Gothram', 'Nakshatram', 'Rasi'].map((h) => <th key={h} scope="col" style={{ padding: '6px 10px' }}>{h}</th>)}</tr></thead>
            <tbody>
              {data.family.map((m) => (
                <tr key={m.id}>
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

      <p style={{ fontWeight: 700, margin: '14px 0 6px' }}>Payments and bookings ({data.payments.length})</p>
      {data.payments.length === 0 ? <p className="pdx-sub">No payments yet.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 640, fontSize: 13 }}>
            <thead><tr>{['Date', 'Type', 'For', 'Amount', 'Status', 'Receipt'].map((h) => <th key={h} scope="col" style={{ padding: '6px 10px', textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
            <tbody>
              {data.payments.map((p, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{when(p.paid_at)}</td>
                  <td style={{ padding: '6px 10px' }}><span className="pdx-pill"><i style={{ background: SOURCE_COLOR[p.source] }} />{SOURCE_LABEL[p.source]}</span></td>
                  <td style={{ padding: '6px 10px' }}>{p.item}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{inr(p.amount)}</td>
                  <td style={{ padding: '6px 10px' }}><span className="pdx-pill"><i style={{ background: STATUS_COLOR[p.status] }} />{STATUS_LABEL[p.status]}</span></td>
                  <td style={{ padding: '6px 10px' }}>{p.receipt_no || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.camps.length > 0 && (
        <>
          <p style={{ fontWeight: 700, margin: '14px 0 6px' }}>Camp registrations ({data.camps.length})</p>
          {data.camps.map((c) => (
            <div className="pdx-donor" key={c.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700 }}>{c.title}</p>
                <p className="pdx-sub">{c.adults} adult{c.adults === 1 ? '' : 's'}{c.children ? `, ${c.children} child${c.children === 1 ? '' : 'ren'}` : ''} · {dateLabel(c.registered_at.slice(0, 10))} · {c.status.toLowerCase()}</p>
              </div>
              <b>{c.amount > 0 ? inr(c.amount) : 'No fee'}</b>
            </div>
          ))}
        </>
      )}
      <div style={{ marginTop: 12 }}>
        <button type="button" className="pdx-btn" onClick={() => onPick(d.id)}>Show only this devotee</button>
      </div>
    </div>
  );
}

export default function DevoteeDetails() {
  const { notice, flash, clear } = useFlash();
  const [preset, setPreset] = useState<Preset>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [residency, setResidency] = useState('');
  const [state, setState] = useState('');
  const [verified, setVerified] = useState('');
  const [paid, setPaid] = useState('');
  const [login, setLogin] = useState('');
  const [sort, setSort] = useState('newest');
  const [q, setQ] = useState('');
  const [qNow, setQNow] = useState('');
  const [page, setPage] = useState(1);
  const [out, setOut] = useState<ListOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const thisFy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // Indian financial year starts in April
  const [fy, setFy] = useState(thisFy);
  const [busy80, setBusy80] = useState(false);
  const LIMIT = 25;
  const seq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => { setQNow(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (residency) p.set('residency', residency);
    if (state) p.set('state', state);
    if (verified) p.set('verified', verified);
    if (paid) p.set('paid', paid);
    if (login) p.set('login', login);
    if (qNow) p.set('q', qNow);
    return p;
  }, [from, to, residency, state, verified, paid, login, qNow]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setErr('');
    try {
      const p = qs(); p.set('page', String(page)); p.set('limit', String(LIMIT)); p.set('sort', sort);
      const res = await fetch(`${DV}/list?${p}`, { headers: authHeader(), cache: 'no-store' });
      const j = await readJson(res);
      if (!res.ok) throw new Error(failText(j, `Could not load the devotees (${res.status}).`));
      if (mine === seq.current) setOut(j);
    } catch (e: any) {
      if (mine === seq.current) setErr(`${e?.message || 'Could not load the devotees.'} [${DV}]`);
    } finally { if (mine === seq.current) setLoading(false); }
  }, [qs, page, sort]);
  useEffect(() => { load(); }, [load]);

  function choose(p: Preset) {
    setPreset(p); setPage(1);
    if (p !== 'custom') { const r = rangeOf(p); setFrom(r.from); setTo(r.to); }
  }

  async function download() {
    setBusy(true);
    try {
      const p = qs(); p.set('sort', sort);
      const res = await fetch(`${DV}/export?${p}`, { headers: authHeader() });
      if (!res.ok) { flash('err', failText(await readJson(res), 'Could not make the file.')); return; }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `devotees-${ymd(new Date())}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy(false); }
  }

  async function download80g() {
    setBusy80(true);
    try {
      const p = new URLSearchParams({ from: `${fy}-04-01`, to: `${fy + 1}-03-31` });
      const res = await fetch(`${G80}?${p}`, { headers: authHeader() });
      if (!res.ok) { flash('err', failText(await readJson(res), 'Could not make the 80G file.')); return; }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `80g-donations-${fy}-${String(fy + 1).slice(2)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy80(false); }
  }

  const rows = out?.items || [];
  const total = out?.total || 0;
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const filtered = !!(residency || state || verified || paid || login || qNow);
  const periodText = from || to ? `${from ? dateLabel(from) : 'the start'} to ${to ? dateLabel(to) : 'today'}` : 'all dates';
  const t = out?.totals;

  return (
    <div className="dc">
      <style>{CSS}</style>
      <style>{PDX_CSS}</style>
      <Notice notice={notice} onClear={clear} />
      <div className="pdx">
        <div className="pdx-top">
          <div>
            <h1 className="pdx-title">Devotee details</h1>
            <p className="pdx-sub" style={{ fontSize: 14 }}>Every devotee with contact details, family members for sankalpam, and everything they have paid. Press Details to open a devotee.</p>
          </div>
          <button type="button" className="pdx-btn" onClick={download} disabled={busy || loading || total === 0}>{busy ? 'Preparing...' : 'Download CSV'}</button>
        </div>

        <div className="pdx-card" style={{ marginBottom: 14 }}>
          <div className="pdx-head" style={{ marginBottom: 0 }}>
            <div><h3>80G donation file</h3><p className="pdx-sub">Every paid donation of a financial year with the donor name, PAN and address, ready for 80G receipts and the yearly return. Admins only; each download is recorded.</p></div>
            <div className="pdx-row">
              <div>
                <label className="pdx-lbl" htmlFor="fy">Financial year</label>
                <select id="fy" className="pdx-inp" value={fy} onChange={(e) => setFy(Number(e.target.value))}>
                  {[0, 1, 2, 3].map((i) => <option key={i} value={thisFy - i}>{`April ${thisFy - i} to March ${thisFy - i + 1}`}</option>)}
                </select>
              </div>
              <button type="button" className="pdx-btn on" onClick={download80g} disabled={busy80}>{busy80 ? 'Preparing...' : 'Download 80G file'}</button>
            </div>
          </div>
        </div>

        <div className="pdx-card" style={{ marginBottom: 14 }}>
          <div className="pdx-row" style={{ marginBottom: 12 }} role="group" aria-label="Joined">
            {([['all', 'All time'], ['month', 'Joined this month'], ['30', 'Last 30 days'], ['year', 'This year'], ['custom', 'Choose dates']] as [Preset, string][]).map(([id, label]) => (
              <button key={id} type="button" className={`pdx-btn${preset === id ? ' on' : ''}`} aria-pressed={preset === id} onClick={() => choose(id)}>{label}</button>
            ))}
          </div>
          <div className="pdx-row">
            <div><label className="pdx-lbl" htmlFor="df">Joined from</label><input id="df" className="pdx-inp" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); setPage(1); }} /></div>
            <div><label className="pdx-lbl" htmlFor="dt">Joined to</label><input id="dt" className="pdx-inp" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPreset('custom'); setPage(1); }} /></div>
            <div>
              <label className="pdx-lbl" htmlFor="dr">Residency</label>
              <select id="dr" className="pdx-inp" value={residency} onChange={(e) => { setResidency(e.target.value); setPage(1); }}>
                <option value="">Indian and NRI</option><option value="indian">Indian resident</option><option value="nri">NRI</option>
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="ds">State</label>
              <select id="ds" className="pdx-inp" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}>
                <option value="">All states</option>
                {(out?.states || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="dv">Email</label>
              <select id="dv" className="pdx-inp" value={verified} onChange={(e) => { setVerified(e.target.value); setPage(1); }}>
                <option value="">Verified or not</option><option value="yes">Verified</option><option value="no">Not verified</option>
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="dp">Payments</label>
              <select id="dp" className="pdx-inp" value={paid} onChange={(e) => { setPaid(e.target.value); setPage(1); }}>
                <option value="">Paid or never paid</option><option value="yes">Has paid</option><option value="no">Never paid</option>
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="dl">Signs in with</label>
              <select id="dl" className="pdx-inp" value={login} onChange={(e) => { setLogin(e.target.value); setPage(1); }}>
                <option value="">Google or password</option><option value="google">Google</option><option value="password">Email and password</option>
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="do">Sort by</label>
              <select id="do" className="pdx-inp" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label className="pdx-lbl" htmlFor="dq">Search devotees</label>
              <input id="dq" className="pdx-inp" style={{ width: '100%' }} value={q} maxLength={80} placeholder="Name, phone, email, city, state or devotee id" onChange={(e) => setQ(e.target.value)} />
            </div>
            {filtered && <button type="button" className="pdx-btn" onClick={() => { setResidency(''); setState(''); setVerified(''); setPaid(''); setLogin(''); setQ(''); setQNow(''); setPage(1); }}>Clear filters</button>}
          </div>
        </div>

        {err ? (
          <div role="alert" className="pdx-err">{err} <button type="button" className="pdx-link" onClick={load}>Try again</button></div>
        ) : (
          <div className={loading && out ? 'pdx-busy' : ''} aria-busy={loading}>
            <p className="pdx-sub" style={{ margin: '0 2px 8px' }}>Joined: {periodText}.</p>
            <div className="pdx-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))' }}>
              <Stat label="Devotees" value={t ? String(t.devotees) : '...'} sub={filtered || from || to ? 'matching the filters' : 'registered in all'} color="#7a1c1c" />
              <Stat label="Email verified" value={t ? String(t.verified) : '...'} sub={t && t.devotees ? `${Math.round((t.verified / t.devotees) * 100)}% of these devotees` : ''} color={STATUS_COLOR.PAID} />
              <Stat label="Have paid" value={t ? String(t.paying) : '...'} sub={t && t.devotees ? `${Math.round((t.paying / t.devotees) * 100)}% paid at least once` : ''} color="#ea580c" />
              <Stat label="Total given" value={t ? inr(t.paid) : '...'} sub={t && t.paying ? `${inr(Math.round(t.paid / t.paying))} on average each` : 'paid payments only'} />
            </div>

            <section className="pdx-card" aria-label="Devotees" style={{ marginTop: 14 }}>
              <div className="pdx-head">
                <h3>Devotees</h3>
                <span className="pdx-sub">{loading ? 'Loading...' : `${total} found`}</span>
              </div>
              <div className="pdx-tablewrap">
                <table style={{ minWidth: 980 }}>
                  <thead>
                    <tr>{['Devotee', 'Contact', 'Place', 'Joined', 'Family', 'Given', 'Last active', ''].map((h, i) => <th key={i} scope="col" style={{ textAlign: h === 'Given' ? 'right' : 'left' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {!loading && rows.length === 0 && <tr><td colSpan={8} className="pdx-empty">{filtered || from || to ? 'No devotees match these filters.' : 'No devotees yet.'}</td></tr>}
                    {rows.map((r) => {
                      const isOpen = open === r.id;
                      return (
                        <React.Fragment key={r.id}>
                          <tr className={isOpen ? 'open' : ''}>
                            <td style={{ minWidth: 190 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Avatar d={r} />
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontWeight: 700 }}>{r.name || <span className="pdx-mut">No name</span>}</p>
                                  <p className="pdx-sub">{r.residency === 'nri' ? 'NRI' : 'Indian resident'} · {r.login === 'google' ? 'Google' : 'Password'}</p>
                                </div>
                              </div>
                            </td>
                            <td style={{ minWidth: 170 }}>
                              <p>{r.phone ? (telHref(r.phone) ? <a className="pdx-link" style={{ padding: 0 }} href={telHref(r.phone)}>{r.phone}</a> : r.phone) : <span className="pdx-mut">No phone</span>}</p>
                              <p className="pdx-sub" style={{ wordBreak: 'break-all' }}>{r.email} <span className="pdx-pill" style={{ marginLeft: 4 }}><i style={{ background: r.verified ? STATUS_COLOR.PAID : STATUS_COLOR.PENDING }} />{r.verified ? 'Verified' : 'Not verified'}</span></p>
                            </td>
                            <td>{[r.city, r.state].filter(Boolean).join(', ') || <span className="pdx-mut">-</span>}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{csvDate(r.joined_at)}</td>
                            <td>{r.family_count || <span className="pdx-mut">0</span>}</td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <b>{r.pay_total > 0 ? inr(r.pay_total) : '-'}</b>
                              {r.pay_count > 0 && <p className="pdx-sub">{r.pay_count} payment{r.pay_count === 1 ? '' : 's'}</p>}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{when(r.last_active)}</td>
                            <td><button type="button" className="pdx-link" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>{isOpen ? 'Hide' : 'Details'}</button></td>
                          </tr>
                          {isOpen && (
                            <tr className="open">
                              <td colSpan={8} style={{ paddingTop: 4 }}>
                                <Panel id={r.id} onPick={(id) => { setQ(id); setQNow(id); setPage(1); setOpen(null); }} />
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