import { useCallback, useEffect, useRef, useState } from 'react';
import { API, CSS, Notice, authHeader, failText, readJson, useFlash } from './DiscoverKit';
import { ActivityDots, Columns, DateRangePicker, Delta, Donut, HBars, LineChart, PDX_CSS, dnum, inr, makeBuckets, rangeOf, short, when, ymd } from './PaymentCharts';
import type { Gran, Preset } from './PaymentCharts';

// API points at .../api/v1/discover. The devotee records API is .../api/v1/devotees-admin/admin/devotees/report
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const REPORT = `${API_BASE}/devotees-admin/admin/devotees/report`;

type Named = { name: string; count: number; amount?: number };
type Report = {
  totals: { devotees: number; verified: number; nri: number; paying: number; repeat: number; withFamily: number; familyMembers: number; avgFamily: number; lifetime: number };
  period: { joined: number; joinedAndPaid: number; previous: number | null; before: number };
  signups: { day: string; count: number }[];
  residency: { key: string; count: number }[];
  login: { key: string; count: number }[];
  states: Required<Named>[]; cities: Required<Named>[];
  segments: { label: string; count: number; amount: number }[];
  bands: { label: string; count: number; amount: number }[];
  mix: { source: string; count: number; people: number; amount: number }[];
  top: { id: string; name: string; phone: string; count: number; amount: number; last: string }[];
  dormant: { id: string; name: string; phone: string; email: string; city: string; joined_at: string }[];
  familySizes: { label: string; count: number }[];
  gothram: Named[]; nakshatram: Named[]; rasi: Named[];
  activity: { weekday: number; block: number; count: number }[];
  health: { noPhone: number; noAddress: number; noState: number; unverified: number; noFamily: number };
};

const SOURCE_LABEL: Record<string, string> = { donation: 'Donations', seva: 'Sevas', camp: 'Camps', magazine: 'Magazine' };
const SOURCE_COLOR: Record<string, string> = { donation: '#7a1c1c', seva: '#ea580c', camp: '#e0a526', magazine: '#7c3aed' };
const STATUS_COLOR = { good: '#15803d', warn: '#b45309', bad: '#b91c1c' };
const num = (n: number) => String(n);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const dateLabel = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const telHref = (p: string | null) => (p && /^\+?[\d\s-]{6,20}$/.test(p) ? `tel:${p.replace(/[\s-]/g, '')}` : undefined);
const csvCell = (v: unknown) => { let t = v == null ? '' : String(v); if (/^[=@\t\r]|^[+-](?![\d\s])/.test(t)) t = `'${t}`; return `"${t.replace(/"/g, '""')}"`; };

const Group = ({ title, note }: { title: string; note?: string }) => (
  <div style={{ margin: '22px 2px 10px' }}>
    <h2 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.02em', textTransform: 'uppercase', color: '#7a1c1c' }}>{title}</h2>
    {note && <p className="pdx-sub">{note}</p>}
  </div>
);

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="pdx-card">
      <p className="pdx-kpi-l">{label}</p>
      <p className="pdx-kpi-n" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="pdx-sub">{sub}</p>}
    </div>
  );
}

export default function DevoteeRecords() {
  const { notice, flash, clear } = useFlash();
  const [preset, setPreset] = useState<Preset>('30');
  const [from, setFrom] = useState(rangeOf('30').from);
  const [to, setTo] = useState(rangeOf('30').to);
  const [gran, setGran] = useState<Gran>('day');
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setErr('');
    try {
      const p = new URLSearchParams();
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      const res = await fetch(`${REPORT}?${p}`, { headers: authHeader(), cache: 'no-store' });
      const j = await readJson(res);
      if (!res.ok) throw new Error(failText(j, `Could not load the report (${res.status}).`));
      if (mine === seq.current) setData(j);
    } catch (e: any) {
      if (mine === seq.current) setErr(`${e?.message || 'Could not load the devotee records.'} [${REPORT}]`);
    } finally { if (mine === seq.current) setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  function choose(p: Preset) {
    setPreset(p);
    if (p !== 'custom') { const r = rangeOf(p); setFrom(r.from); setTo(r.to); }
    setGran(p === 'year' || p === 'all' ? 'month' : 'day');
  }

  const periodText = from || to ? `${from ? dateLabel(from) : 'the start'} to ${to ? dateLabel(to) : 'today'}` : 'all dates';

  // New devotees per day / week / month, and the running total of all devotees
  const buckets = data ? makeBuckets(data.signups.map((s) => ({ day: s.day, source: 'new', count: s.count, amount: s.count })), gran, from, to) : [];
  let acc = data?.period.before || 0;
  const growth = buckets.map((b) => { acc += b.total; return { label: b.label, value: acc, note: `${b.total} joined this ${gran}` }; });
  const joinedPoints = buckets.map((b) => ({ label: b.label, value: b.total, note: `${b.total} new devotee${b.total === 1 ? '' : 's'}` }));

  const t = data?.totals;
  const p = data?.period;
  const mixTotal = data ? data.mix.reduce((a, m) => a + m.amount, 0) : 0;

  function downloadReport() {
    if (!data) return;
    const lines: unknown[][] = [['Devotee records', periodText], [], ['Key figures'], ['Total devotees', data.totals.devotees], ['Joined in the period', data.period.joined], ['Have paid at least once', data.totals.paying], ['Paid more than once', data.totals.repeat], ['Email verified', data.totals.verified], ['NRI', data.totals.nri], ['Lifetime giving (INR)', data.totals.lifetime], [],
      ['How often devotees pay', 'Devotees', 'Total (INR)'], ...data.segments.map((s) => [s.label, s.count, s.amount]), [],
      ['Lifetime giving', 'Devotees', 'Total (INR)'], ...data.bands.map((s) => [s.label, s.count, s.amount]), [],
      ['Money in the period by type', 'Payments', 'Devotees', 'Total (INR)'], ...data.mix.map((m) => [SOURCE_LABEL[m.source], m.count, m.people, m.amount]), [],
      ['State', 'Devotees', 'Given (INR)'], ...data.states.map((s) => [s.name, s.count, s.amount]), [],
      ['City', 'Devotees', 'Given (INR)'], ...data.cities.map((s) => [s.name, s.count, s.amount]), [],
      ['Gothram', 'Family members'], ...data.gothram.map((s) => [s.name, s.count]), [],
      ['Nakshatram', 'Family members'], ...data.nakshatram.map((s) => [s.name, s.count]), [],
      ['Rasi', 'Family members'], ...data.rasi.map((s) => [s.name, s.count]), [],
      ['Top contributors in the period', 'Phone', 'Payments', 'Total (INR)'], ...data.top.map((s) => [s.name, s.phone, s.count, s.amount])];
    const url = URL.createObjectURL(new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `devotee-records-${ymd(new Date())}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    flash('ok', 'Report downloaded.');
  }

  return (
    <div className="dc">
      <style>{CSS}</style>
      <style>{PDX_CSS}</style>
      <Notice notice={notice} onClear={clear} />
      <div className="pdx">
        <div className="pdx-top">
          <div>
            <h1 className="pdx-title">Devotee records</h1>
            <p className="pdx-sub" style={{ fontSize: 14 }}>How the devotee family is growing, where devotees live, how they give, and who may need a call. Dates choose when devotees joined and when payments were made.</p>
          </div>
          <button type="button" className="pdx-btn" onClick={downloadReport} disabled={!data || loading}>Download report</button>
        </div>

        <div className="pdx-card" style={{ marginBottom: 14 }}>
          <div className="pdx-tools">
            <div className="pdx-presets" role="group" aria-label="Period">
              {([['month', 'This month'], ['30', 'Last 30 days'], ['year', 'This year'], ['all', 'All time']] as [Preset, string][]).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={preset === id} onClick={() => choose(id)}>{label}</button>
              ))}
            </div>
            <DateRangePicker from={from} to={to} label="Period" onChange={(f, t) => { setFrom(f); setTo(t); setPreset(f || t ? 'custom' : 'all'); setGran(f && t && dnum(t) - dnum(f) > 92 ? 'month' : 'day'); }} />
          </div>
        </div>

        {err ? (
          <div role="alert" className="pdx-err">{err} <button type="button" className="pdx-link" onClick={load}>Try again</button></div>
        ) : (
          <div className={loading && data ? 'pdx-busy' : ''} aria-busy={loading}>
            <Group title="Summary" note={`Period: ${periodText}.`} />
            <div className="pdx-grid pdx-g-kpi">
              <div className="pdx-card pdx-hero">
                <p className="pdx-sub">New devotees</p>
                <p className="pdx-big">{p ? p.joined : '...'}</p>
                {p && <Delta now={p.joined} before={p.previous === null ? null : { count: p.previous, amount: p.previous }} />}
                <p className="pdx-sub" style={{ marginTop: 10 }}>{p && p.joined ? `${p.joinedAndPaid} of them have paid (${pct(p.joinedAndPaid, p.joined)}%)` : 'joined in this period'}</p>
              </div>
              <Stat label="All devotees" value={t ? String(t.devotees) : '...'} sub="registered so far" color="#7a1c1c" />
              <Stat label="Have paid" value={t ? String(t.paying) : '...'} sub={t ? `${pct(t.paying, t.devotees)}% of all devotees` : ''} color="#ea580c" />
              <Stat label="Paid more than once" value={t ? String(t.repeat) : '...'} sub={t && t.paying ? `${pct(t.repeat, t.paying)}% of the devotees who paid` : ''} color={STATUS_COLOR.good} />
            </div>
            <div className="pdx-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))' }}>
              <Stat label="Lifetime giving" value={t ? inr(t.lifetime) : '...'} sub={t && t.paying ? `${inr(Math.round(t.lifetime / t.paying))} per paying devotee` : 'paid payments only'} />
              <Stat label="Email verified" value={t ? String(t.verified) : '...'} sub={t ? `${pct(t.verified, t.devotees)}% of all devotees` : ''} color={STATUS_COLOR.good} />
              <Stat label="NRI devotees" value={t ? String(t.nri) : '...'} sub={t ? `${pct(t.nri, t.devotees)}% of all devotees` : ''} />
              <Stat label="Family saved" value={t ? String(t.withFamily) : '...'} sub={t ? `${t.familyMembers} members, ${t.avgFamily} per devotee` : ''} />
            </div>

            <Group title="Growth" />
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="New devotees">
                <div className="pdx-head">
                  <div><h3>New devotees</h3><p className="pdx-sub">Joined in each {gran}</p></div>
                  <div className="pdx-row" role="group" aria-label="Group by">
                    {(['day', 'week', 'month'] as Gran[]).map((g) => <button key={g} type="button" className={`pdx-btn${gran === g ? ' on' : ''}`} aria-pressed={gran === g} onClick={() => setGran(g)}>{g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}</button>)}
                  </div>
                </div>
                <LineChart label="New devotees" points={joinedPoints} format={num} color="#ea580c" />
              </section>
              <section className="pdx-card" aria-label="Total devotees">
                <h3>Total devotees</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>How the family adds up through the period</p>
                <LineChart label="Total devotees" points={growth} format={num} />
              </section>
            </div>
            <div className="pdx-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))' }}>
              <section className="pdx-card" aria-label="Residency">
                <h3>Indian and NRI</h3>
                <p className="pdx-sub" style={{ marginBottom: 10 }}>Devotees who joined in the period</p>
                <Donut parts={[
                  { key: 'indian', label: 'Indian resident', value: data?.residency.find((r) => r.key === 'indian')?.count || 0, color: '#7a1c1c' },
                  { key: 'nri', label: 'NRI', value: data?.residency.find((r) => r.key === 'nri')?.count || 0, color: '#e0a526' },
                ]} centerTop="Joined" centerBottom={p ? String(p.joined) : '...'} label="Indian resident and NRI devotees" />
              </section>
              <section className="pdx-card" aria-label="Sign in">
                <h3>How they sign in</h3>
                <p className="pdx-sub" style={{ marginBottom: 10 }}>Devotees who joined in the period</p>
                <Donut parts={[
                  { key: 'google', label: 'Google', value: data?.login.find((r) => r.key === 'google')?.count || 0, color: '#ea580c' },
                  { key: 'password', label: 'Email and password', value: data?.login.find((r) => r.key === 'password')?.count || 0, color: '#7c3aed' },
                ]} centerTop="Joined" centerBottom={p ? String(p.joined) : '...'} label="Google and password sign in" />
              </section>
              <section className="pdx-card" aria-label="Joined and paid">
                <h3>New devotees who paid</h3>
                <p className="pdx-sub" style={{ marginBottom: 10 }}>Of those who joined in the period</p>
                <Donut parts={[
                  { key: 'paid', label: 'Have paid', value: p?.joinedAndPaid || 0, color: STATUS_COLOR.good },
                  { key: 'not', label: 'Not yet', value: p ? p.joined - p.joinedAndPaid : 0, color: '#e0a526' },
                ]} centerTop="Paid" centerBottom={p ? `${pct(p.joinedAndPaid, p.joined)}%` : '...'} label="New devotees who have paid" />
              </section>
            </div>

            <Group title="Giving" note="Money counts only paid payments: donations, sevas, camps and magazine." />
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="How often devotees pay">
                <h3>How often devotees pay</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Devotees who joined in the period, by number of paid payments</p>
                <Columns label="Devotees by number of payments" items={(data?.segments || []).map((s) => ({ label: s.label, value: s.count, note: `${s.count} devotee${s.count === 1 ? '' : 's'}, ${inr(s.amount)}` }))} />
              </section>
              <section className="pdx-card" aria-label="Lifetime giving">
                <h3>Lifetime giving</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Devotees who joined in the period, by total given</p>
                <Columns label="Devotees by total given" color="#7a1c1c" items={(data?.bands || []).map((s) => ({ label: s.label, value: s.count, note: `${s.count} devotee${s.count === 1 ? '' : 's'}, ${inr(s.amount)}` }))} />
              </section>
            </div>
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="Where the money came from">
                <h3>Where the money came from</h3>
                <p className="pdx-sub" style={{ marginBottom: 10 }}>Paid in the period, by type</p>
                <Donut parts={(data?.mix || []).map((m) => ({ key: m.source, label: `${SOURCE_LABEL[m.source]} (${m.people} devotee${m.people === 1 ? '' : 's'})`, value: m.amount, color: SOURCE_COLOR[m.source] }))} centerTop="Total" centerBottom={data ? short(mixTotal) : '...'} label="Money paid by type" />
              </section>
              <section className="pdx-card" aria-label="Top contributors">
                <h3>Top contributors</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Who gave the most in the period</p>
                {!data || data.top.length === 0 ? <p className="pdx-empty">Nothing yet.</p> : data.top.map((d) => (
                  <div className="pdx-donor" key={d.id}>
                    <span className="pdx-ava" aria-hidden="true">{(d.name || '?').trim().charAt(0).toUpperCase()}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name || d.id}</p>
                      <p className="pdx-sub">{d.count} payment{d.count === 1 ? '' : 's'}{d.phone ? ` · ${d.phone}` : ''} · last {when(d.last)}</p>
                    </div>
                    <b>{inr(d.amount)}</b>
                  </div>
                ))}
              </section>
            </div>

            <Group title="Where devotees live" />
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="By state">
                <h3>By state</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>Devotees who joined in the period</p>
                <HBars format={num} items={(data?.states || []).map((s) => ({ key: s.name, label: s.name, value: s.count, color: '#e0a526', sub: `${inr(s.amount)} given in all` }))} />
              </section>
              <section className="pdx-card" aria-label="By city">
                <h3>By city</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>Devotees who joined in the period</p>
                <HBars format={num} items={(data?.cities || []).map((s) => ({ key: s.name, label: s.name, value: s.count, color: '#7c3aed', sub: `${inr(s.amount)} given in all` }))} />
              </section>
            </div>

            <Group title="Family and sankalpam" note="From the family members devotees have saved. Useful for planning poojas and sankalpam." />
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="Gothram">
                <h3>Gothram</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>Most common among saved family members</p>
                <HBars format={num} items={(data?.gothram || []).map((s) => ({ key: s.name, label: s.name, value: s.count, color: '#7a1c1c' }))} />
              </section>
              <section className="pdx-card" aria-label="Nakshatram">
                <h3>Nakshatram</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>Most common among saved family members</p>
                <HBars format={num} items={(data?.nakshatram || []).map((s) => ({ key: s.name, label: s.name, value: s.count, color: '#ea580c' }))} />
              </section>
              <section className="pdx-card" aria-label="Rasi">
                <h3>Rasi</h3>
                <p className="pdx-sub" style={{ marginBottom: 12 }}>Most common among saved family members</p>
                <HBars format={num} items={(data?.rasi || []).map((s) => ({ key: s.name, label: s.name, value: s.count, color: '#e0a526' }))} />
              </section>
              <section className="pdx-card" aria-label="Family size">
                <h3>Family size</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Devotees by number of family members saved</p>
                <Columns label="Devotees by family size" color="#7c3aed" items={(data?.familySizes || []).map((s) => ({ label: s.label, value: s.count, note: `${s.count} devotee${s.count === 1 ? '' : 's'}` }))} />
              </section>
            </div>

            <Group title="When devotees join" />
            <section className="pdx-card" aria-label="When devotees join" style={{ marginBottom: 14 }}>
              <h3>When devotees join</h3>
              <p className="pdx-sub" style={{ marginBottom: 8 }}>By weekday and time of day (server clock)</p>
              {data && data.activity.length > 0 ? <ActivityDots data={data.activity} /> : <p className="pdx-empty">Nothing yet.</p>}
            </section>

            <Group title="Needs attention" note="Things the temple office may want to act on." />
            <div className="pdx-grid pdx-g-2">
              <section className="pdx-card" aria-label="Invite to give">
                <h3>Joined but never paid</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Joined more than 30 days ago. A friendly call may help.</p>
                {!data || data.dormant.length === 0 ? <p className="pdx-empty">Everyone who joined has paid, or joined recently.</p> : data.dormant.map((d) => (
                  <div className="pdx-donor" key={d.id}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name || 'No name'}</p>
                      <p className="pdx-sub">Joined {dateLabel(d.joined_at)}{d.city ? ` · ${d.city}` : ''}{d.phone ? ' · ' : ''}{d.phone && (telHref(d.phone) ? <a className="pdx-link" style={{ padding: 0 }} href={telHref(d.phone)}>{d.phone}</a> : d.phone)}</p>
                    </div>
                  </div>
                ))}
              </section>
              <section className="pdx-card" aria-label="Profile health">
                <h3>Profile health</h3>
                <p className="pdx-sub" style={{ marginBottom: 8 }}>Devotees in the period with missing details</p>
                {data && ([
                  ['Without a phone number', data.health.noPhone],
                  ['Without a communication address', data.health.noAddress],
                  ['Without a state', data.health.noState],
                  ['Email not verified', data.health.unverified],
                  ['No family members saved', data.health.noFamily],
                ] as [string, number][]).map(([text, n]) => (
                  <div className="pdx-donor" key={text}>
                    <span style={{ flex: 1, fontSize: 14 }}>{text}</span>
                    <span className="pdx-pill"><i style={{ background: n ? STATUS_COLOR.warn : STATUS_COLOR.good }} />{n ? n : 'All good'}</span>
                  </div>
                ))}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}