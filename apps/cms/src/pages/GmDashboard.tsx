import React, { useState } from 'react';
import { API_BASE_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Bars, DashShell, KIND_COLOR, KIND_LABEL, Skeleton, Stat, inr, num, useDash } from './DashKit';

// The organisation's name and address printed at the top of every downloaded sheet
const ORG_NAME = 'SRI DAKSHINAMURTI SEVA SAMITI';
const ORG_ADDRESS = ['Chatrapatti Road, Vedapuri, Theni, Tamilnadu, India - 625 531', 'Phone: 97517 51910, 94430 51910'];

interface Kind {
  kind: string;
  today: { n: number; amount: number; offline_n: number; offline_amount: number };
  month: { n: number; amount: number; offline_n: number; offline_amount: number };
  year: { n: number; amount: number };
  pending: number; failed: number; cancelled: number; next7: number; upcoming: number; expiring: number; active: number; people_month: number;
  top: { item: string; n: number; amount: number }[];
}
interface PosBlock {
  available: boolean;
  today: { bills: number; total: number }; month: { bills: number; total: number; cancelled: number }; year: { bills: number; total: number };
  profit_month: number; purchases_month: number; stock_value: number; low_count: number;
  modes: { mode: string; bills: number; total: number }[]; top: { name: string; qty: number; amount: number }[];
}
interface Data {
  generated_at: string;
  financial_year_start: string;
  totals: { today: { n: number; amount: number; offline_amount: number }; month: { n: number; amount: number; offline_amount: number }; year: { n: number; amount: number } };
  kinds: Kind[];
  days: { d: string; amount: number; n: number; by: Record<string, number> }[];
  devotees: { total: number; month: number; today: number };
  details: { total: number; month: number; today: number; with_phone: number; with_email: number; cities: { name: string; n: number }[]; states: { name: string; n: number }[] };
  payment_modes: { mode: string; n: number; amount: number; by: Record<string, number> }[];
  pos: PosBlock;
}

const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%');
const MODE: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', online: 'Online', cheque: 'Cheque', dd: 'Demand draft', neft: 'Bank transfer', other: 'Other' };
const modeText = (m: string) => MODE[m] || (m ? m.charAt(0).toUpperCase() + m.slice(1) : '-');

// ---------- Reports: dates and what to include ----------
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function presetRange(p: string): { from: string; to: string } {
  const t = new Date();
  const day = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  switch (p) {
    case 'today': return { from: iso(day), to: iso(day) };
    case 'week': { const s = new Date(day); s.setDate(day.getDate() - ((day.getDay() + 6) % 7)); return { from: iso(s), to: iso(day) }; }
    case 'last-month': return { from: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: iso(new Date(t.getFullYear(), t.getMonth(), 0)) };
    case 'fy': { const y = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1; return { from: `${y}-04-01`, to: iso(day) }; }
    case 'all': return { from: '2020-01-01', to: iso(day) };
    default: return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(day) };
  }
}
const PRESETS: [string, string][] = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['last-month', 'Last month'], ['fy', 'Financial year'], ['all', 'All time']];
const PARTS: { id: string; label: string; help: string }[] = [
  { id: 'summary', label: 'Overall summary', help: 'Totals for every register, payment modes, POS and devotees' },
  { id: 'transactions', label: 'Transactions', help: 'Every payment line with receipt, mode and status' },
  { id: 'registrations', label: 'Registrations', help: 'Who registered for what, with dates, people and address' },
  { id: 'pos', label: 'POS sales and purchases', help: 'Shop bills, items sold, profit and stock purchases' },
  { id: 'devotees', label: 'Devotee details', help: 'Devotees who registered in the period' },
];

function Reports() {
  const { token, user } = useAuth() as any;
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(presetRange('month'));
  const [picked, setPicked] = useState<string[]>(['summary']);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const choose = (p: string) => { setPreset(p); setRange(presetRange(p)); };
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const bad = !range.from || !range.to ? 'Choose both dates.' : range.from > range.to ? 'The start date is after the end date.' : '';

  async function download(parts: string[], label: string) {
    if (bad || busy) return;
    setBusy(label); setMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/dashboards/gm/report?from=${range.from}&to=${range.to}&parts=${parts.join(',')}`, { headers: { Authorization: `Bearer ${token || ''}` }, cache: 'no-store' });
      let d: any = {};
      try { d = await res.json(); } catch { /* no body */ }
      if (!res.ok) throw new Error(d.message || `The server returned an error (${res.status}).`);
      const { buildGmReport } = await import('./gmReportXlsx');
      const bytes = await buildGmReport(d, { name: ORG_NAME, address: ORG_ADDRESS }, String(user?.email || user?.full_name || ''));
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${label.replace(/[^A-Za-z0-9]+/g, '-')}_${range.from}_to_${range.to}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setMsg({ ok: true, text: d.truncated?.length ? `Downloaded. Some sheets were cut short (${d.truncated.join('; ')}). Choose a shorter period for every row.` : 'Downloaded.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not make the report.' });
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="dk-card" id="gm-reports" style={{ marginBottom: 12 }}>
      <h2>Download reports (Excel)</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }} role="group" aria-label="Period">
        {PRESETS.map(([id, label]) => (
          <button key={id} type="button" className={`dk-btn sm${preset === id ? ' pri' : ''}`} aria-pressed={preset === id} onClick={() => choose(id)}>{label}</button>
        ))}
        <label className="dk-mut" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>From
          <input type="date" value={range.from} max={range.to || undefined} onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, from: e.target.value })); }} className="dk-date" />
        </label>
        <label className="dk-mut" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>To
          <input type="date" value={range.to} min={range.from || undefined} onChange={(e) => { setPreset('custom'); setRange((r) => ({ ...r, to: e.target.value })); }} className="dk-date" />
        </label>
      </div>
      {bad && <p role="alert" style={{ color: '#b91c1c', margin: '0 0 8px', fontWeight: 600 }}>{bad}</p>}

      <div className="dk-grid g3" style={{ marginBottom: 10 }}>
        {PARTS.map((p) => (
          <div key={p.id} className="dk-pick">
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} style={{ marginTop: 3 }} />
              <span><strong>{p.label}</strong><span className="dk-mut" style={{ display: 'block', fontSize: 12 }}>{p.help}</span></span>
            </label>
            <button type="button" className="dk-link" style={{ marginTop: 6 }} disabled={!!bad || !!busy} onClick={() => download([p.id], p.label)}>
              {busy === p.label ? 'Preparing...' : 'Download only this'}
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <button type="button" className="dk-btn pri" disabled={!!bad || !!busy || picked.length === 0} onClick={() => download(picked, 'GM-report')}>
          {busy === 'GM-report' ? 'Preparing...' : `Download selected (${picked.length})`}
        </button>
        <button type="button" className="dk-btn" disabled={!!bad || !!busy} onClick={() => { setPicked(PARTS.map((p) => p.id)); download(PARTS.map((p) => p.id), 'GM-full-report'); }}>
          {busy === 'GM-full-report' ? 'Preparing...' : 'Download everything'}
        </button>
        <span className="dk-mut" style={{ fontSize: 12 }}>One Excel file, one sheet for each report.</span>
      </div>
      {msg && <p role="status" style={{ margin: '10px 0 0', fontWeight: 600, color: msg.ok ? '#166534' : '#b91c1c' }}>{msg.text}</p>}
    </section>
  );
}

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function GmDashboard() {
  const { user } = useAuth();
  const { data, err, loading, reload } = useDash<Data>('gm');
  const first = (user?.full_name || '').split(' ')[0];
  const fy = data ? new Date(data.financial_year_start).getFullYear() : 0;
  const pos = data?.pos;
  const find = (kind: string) => data?.kinds.find((k) => k.kind === kind);

  return (
    <DashShell title="GM Report Dashboard" sub={`${first ? `Welcome, ${first}. ` : ''}Payments, registrations, point of sale and devotees in one place, with Excel reports.`} at={data?.generated_at} loading={loading} onReload={reload} error={err}>
      <style>{`.dk-date{border:1px solid #cfd4dc;border-radius:6px;padding:5px 8px;font-size:12.5px;background:#fff;color:#1f2937}.dk-pick{border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;background:#fafafa}.dk-nav{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}`}</style>
      {!data ? (loading ? <Skeleton /> : null) : (
        <>
          <div className="dk-grid g3">
            <Stat label="Received today" value={inr(data.totals.today.amount)} sub={`${num(data.totals.today.n)} entries, ${inr(data.totals.today.offline_amount)} at the counter`} tone="good" />
            <Stat label="This month" value={inr(data.totals.month.amount)} sub={`${num(data.totals.month.n)} entries, counter share ${share(data.totals.month.offline_amount, data.totals.month.amount)}`} />
            <Stat label={`Financial year ${fy}-${String(fy + 1).slice(2)}`} value={inr(data.totals.year.amount)} sub={`${num(data.totals.year.n)} entries since 1 April ${fy}`} />
          </div>

          <nav className="dk-nav" aria-label="Sections">
            {[['gm-reports', 'Reports'], ['gm-payments', 'Payments'], ['gm-registrations', 'Registrations'], ['gm-pos', 'Point of sale'], ['gm-devotees', 'Devotee details']].map(([id, label]) => (
              <button key={id} type="button" className="dk-btn sm" onClick={() => jump(id)}>{label}</button>
            ))}
          </nav>

          <Reports />

          <section className="dk-card" style={{ marginBottom: 12 }}>
            <h2>Last 14 days</h2>
            <Bars
              rows={data.days.map((d) => ({ label: d.d, parts: Object.keys(KIND_LABEL).map((k) => ({ key: k, value: d.by[k] || 0 })) }))}
              colors={KIND_COLOR}
              labels={KIND_LABEL}
            />
          </section>

          {/* PAYMENTS */}
          <section className="dk-card" id="gm-payments" style={{ marginBottom: 12 }}>
            <h2>Payments this month</h2>
            {data.payment_modes.length === 0 ? <p className="dk-empty">No payments received this month.</p> : (
              <div className="dk-wrap">
                <table className="dk-tbl">
                  <thead><tr><th>How it was paid</th><th className="r">Entries</th>{data.kinds.map((k) => <th key={k.kind} className="r">{KIND_LABEL[k.kind]}</th>)}<th className="r">Total</th></tr></thead>
                  <tbody>
                    {data.payment_modes.map((m) => (
                      <tr key={m.mode}>
                        <td>{modeText(m.mode)}</td><td className="r">{num(m.n)}</td>
                        {data.kinds.map((k) => <td key={k.kind} className="r">{inr(m.by[k.kind] || 0)}</td>)}
                        <td className="r"><strong>{inr(m.amount)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="dk-grid g4" style={{ margin: '12px 0 0' }}>
              <Stat label="Waiting for payment" value={num(data.kinds.reduce((a, k) => a + k.pending, 0))} sub="last 7 days" tone={data.kinds.some((k) => k.pending) ? 'warn' : 'good'} />
              <Stat label="Failed payments" value={num(data.kinds.reduce((a, k) => a + k.failed, 0))} sub="last 7 days" tone={data.kinds.some((k) => k.failed) ? 'bad' : 'good'} />
              <Stat label="Cancelled entries" value={num(data.kinds.reduce((a, k) => a + k.cancelled, 0))} sub="last 30 days" />
              <Stat label="At the counter this month" value={inr(data.totals.month.offline_amount)} sub={`${share(data.totals.month.offline_amount, data.totals.month.amount)} of this month`} />
            </div>
          </section>

          {/* REGISTRATIONS */}
          <section id="gm-registrations" style={{ marginBottom: 12 }}>
            <div className="dk-grid g4">
              <Stat label="Seva registrations" value={num(find('seva')?.month.n || 0)} sub={`this month, ${num(find('seva')?.next7 || 0)} in the next 7 days`} />
              <Stat label="Donations" value={num(find('donation')?.month.n || 0)} sub={`this month, ${inr(find('donation')?.month.amount || 0)}`} />
              <Stat label="Magazine subscribers" value={num(find('magazine')?.active || 0)} sub={`${num(find('magazine')?.expiring || 0)} end within 30 days`} tone={find('magazine')?.expiring ? 'warn' : undefined} />
              <Stat label="Camp registrations" value={num(find('camp')?.month.n || 0)} sub={`${num(find('camp')?.people_month || 0)} people this month`} />
            </div>
            <div className="dk-grid g2">
              {data.kinds.map((k) => (
                <section className="dk-card" key={k.kind}>
                  <h2><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 8, background: KIND_COLOR[k.kind] }} />{KIND_LABEL[k.kind]}</h2>
                  <div className="dk-wrap">
                    <table className="dk-tbl">
                      <thead><tr><th>Period</th><th className="r">Entries</th><th className="r">Amount</th><th className="r">At the counter</th></tr></thead>
                      <tbody>
                        <tr><td>Today</td><td className="r">{num(k.today.n)}</td><td className="r">{inr(k.today.amount)}</td><td className="r">{inr(k.today.offline_amount)}</td></tr>
                        <tr><td>This month</td><td className="r">{num(k.month.n)}</td><td className="r">{inr(k.month.amount)}</td><td className="r">{inr(k.month.offline_amount)}</td></tr>
                        <tr><td>Financial year</td><td className="r">{num(k.year.n)}</td><td className="r">{inr(k.year.amount)}</td><td className="r dk-mut">-</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {k.pending > 0 && <span className="dk-pill warn">{num(k.pending)} waiting for payment (7 days)</span>}
                    {k.failed > 0 && <span className="dk-pill bad">{num(k.failed)} failed (7 days)</span>}
                    {k.cancelled > 0 && <span className="dk-pill off">{num(k.cancelled)} cancelled (30 days)</span>}
                    {k.kind === 'magazine' && <span className="dk-pill info">{num(k.active)} active {k.active === 1 ? 'subscriber' : 'subscribers'}</span>}
                    {k.kind === 'magazine' && k.expiring > 0 && <span className="dk-pill warn">{num(k.expiring)} end within 30 days</span>}
                    {k.kind !== 'magazine' && k.upcoming > 0 && <span className="dk-pill info">{num(k.upcoming)} coming up</span>}
                    {k.pending + k.failed + k.cancelled === 0 && <span className="dk-pill ok">Nothing waiting</span>}
                  </div>
                  {k.top.length > 0 && (
                    <>
                      <h3>Top this month</h3>
                      <ul className="dk-rows">
                        {k.top.map((t) => <li key={t.item}><span>{t.item}</span><span><strong>{inr(t.amount)}</strong> <span className="dk-mut">({num(t.n)})</span></span></li>)}
                      </ul>
                    </>
                  )}
                </section>
              ))}
            </div>
          </section>

          {/* POINT OF SALE */}
          <section id="gm-pos" className="dk-card" style={{ marginBottom: 12 }}>
            <h2>Point of sale (shop)</h2>
            {!pos || !pos.available ? <p className="dk-empty">No point of sale data yet. It appears after the first bill is made.</p> : (
              <>
                <div className="dk-grid g4" style={{ marginBottom: 0 }}>
                  <Stat label="Sales today" value={inr(pos.today.total)} sub={`${num(pos.today.bills)} bills`} tone="good" />
                  <Stat label="Sales this month" value={inr(pos.month.total)} sub={`${num(pos.month.bills)} bills${pos.month.cancelled ? `, ${num(pos.month.cancelled)} cancelled` : ''}`} />
                  <Stat label="Profit this month" value={inr(pos.profit_month)} sub="sales - GST - cost" tone={pos.profit_month < 0 ? 'bad' : undefined} />
                  <Stat label="Financial year sales" value={inr(pos.year.total)} sub={`${num(pos.year.bills)} bills`} />
                  <Stat label="Purchases this month" value={inr(pos.purchases_month)} sub="stock in" />
                  <Stat label="Stock value" value={inr(pos.stock_value)} sub="at cost price" />
                  <Stat label="Low stock items" value={num(pos.low_count)} sub="at or below reorder level" tone={pos.low_count ? 'warn' : 'good'} />
                </div>
                <div className="dk-grid g2" style={{ marginTop: 12, marginBottom: 0 }}>
                  <div>
                    <h3>Payment mode this month</h3>
                    {pos.modes.length === 0 ? <p className="dk-mut">No bills this month.</p> : (
                      <ul className="dk-rows">{pos.modes.map((m) => <li key={m.mode}><span>{modeText(m.mode)}</span><span><strong>{inr(m.total)}</strong> <span className="dk-mut">({num(m.bills)} {m.bills === 1 ? 'bill' : 'bills'})</span></span></li>)}</ul>
                    )}
                  </div>
                  <div>
                    <h3>Top items this month</h3>
                    {pos.top.length === 0 ? <p className="dk-mut">No sales this month.</p> : (
                      <ul className="dk-rows">{pos.top.map((t) => <li key={t.name}><span>{t.name}</span><span><strong>{inr(t.amount)}</strong> <span className="dk-mut">({num(t.qty)})</span></span></li>)}</ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          {/* DEVOTEE DETAILS */}
          <section id="gm-devotees" className="dk-card" style={{ marginBottom: 12 }}>
            <h2>Devotee details</h2>
            <div className="dk-grid g4" style={{ marginBottom: 0 }}>
              <Stat label="Devotees" value={num(data.details.total)} sub="registered in all" />
              <Stat label="New this month" value={num(data.details.month)} sub={`${num(data.details.today)} today`} />
              <Stat label="With a phone number" value={num(data.details.with_phone)} sub={share(data.details.with_phone, data.details.total)} />
              <Stat label="With an email" value={num(data.details.with_email)} sub={share(data.details.with_email, data.details.total)} />
            </div>
            <div className="dk-grid g2" style={{ marginTop: 12, marginBottom: 0 }}>
              <div>
                <h3>Top cities</h3>
                {data.details.cities.length === 0 ? <p className="dk-mut">No city recorded yet.</p> : <ul className="dk-rows">{data.details.cities.map((c) => <li key={c.name}><span>{c.name}</span><strong>{num(c.n)}</strong></li>)}</ul>}
              </div>
              <div>
                <h3>Top states</h3>
                {data.details.states.length === 0 ? <p className="dk-mut">No state recorded yet.</p> : <ul className="dk-rows">{data.details.states.map((c) => <li key={c.name}><span>{c.name}</span><strong>{num(c.n)}</strong></li>)}</ul>}
              </div>
            </div>
          </section>
        </>
      )}
    </DashShell>
  );
}