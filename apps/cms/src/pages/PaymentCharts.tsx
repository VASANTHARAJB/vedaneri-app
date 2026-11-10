import { useEffect, useRef, useState } from 'react';

// Shared by the Payments overview and the Seva payments view: money formats, date ranges, charts and the page style.
export type Money = { count: number; amount: number };
export type Series = { key: string; label: string; color: string };
export type DailyRow = { day: string; source: string; count: number; amount: number };

export const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const short = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${+(n / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `₹${+(n / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `₹${+(n / 1e3).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};
export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const dnum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
export const dlabel = (n: number, month = false) =>
  new Date(n * 86_400_000).toLocaleDateString('en-IN', month ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });

export type Preset = 'month' | '30' | 'year' | 'all' | 'custom';
export function rangeOf(p: Preset): { from: string; to: string } {
  const now = new Date();
  if (p === 'month') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
  if (p === '30') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: ymd(now) };
  if (p === 'year') return { from: ymd(new Date(now.getFullYear(), 0, 1)), to: ymd(now) };
  return { from: '', to: '' };
}

// ---------- Chart helpers ----------
export type Gran = 'day' | 'week' | 'month';
export type Bucket = { key: string; label: string; total: number; count: number; by: Record<string, number> };

// Money per day, week or month, with the empty days filled in so the time axis is honest
export function makeBuckets(daily: DailyRow[], gran: Gran, from: string, to: string): Bucket[] {
  if (daily.length === 0) return [];
  const first = from ? dnum(from) : dnum(daily[0].day);
  const last = to ? dnum(to) : dnum(daily[daily.length - 1].day);
  const keyOf = (n: number) => {
    if (gran === 'day') return n;
    if (gran === 'week') return n - ((new Date(n * 86_400_000).getUTCDay() + 6) % 7); // the Monday of that week
    const d = new Date(n * 86_400_000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 86_400_000;
  };
  const map = new Map<number, Bucket>();
  const order: number[] = [];
  for (let n = first; n <= last && order.length < 4000; n++) {
    const k = keyOf(n);
    if (!map.has(k)) { map.set(k, { key: String(k), label: dlabel(k, gran === 'month'), total: 0, count: 0, by: {} }); order.push(k); }
  }
  for (const r of daily) {
    const b = map.get(keyOf(dnum(r.day)));
    if (!b) continue;
    b.total += r.amount; b.count += r.count; b.by[r.source] = (b.by[r.source] || 0) + r.amount;
  }
  const out = order.map((k) => map.get(k) as Bucket);
  return out.slice(-(gran === 'day' ? 62 : gran === 'week' ? 52 : 36));
}
export function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { max: 1, step: 0.25 };
  const raw = max / ticks, mag = 10 ** Math.floor(Math.log10(raw)), n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  return { step, max: step * Math.ceil(max / step) };
}
// The width the chart can use, so it is drawn sharp at any screen size
export function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(Math.max(260, Math.floor(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(260, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

// ---------- Charts ----------
export function Axis({ w, h, m, scale, n, labels, yfmt = short }: { w: number; h: number; m: { l: number; r: number; t: number; b: number }; scale: { max: number; step: number }; n: number; labels: string[]; yfmt?: (n: number) => string }) {
  const lines = [];
  for (let v = 0; v <= scale.max + 0.0001; v += scale.step) {
    const y = m.t + (h - m.t - m.b) * (1 - v / scale.max);
    lines.push(<g key={v}><line x1={m.l} x2={w - m.r} y1={y} y2={y} stroke="#eaecf0" /><text x={m.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{yfmt(v)}</text></g>);
  }
  const slot = (w - m.l - m.r) / Math.max(1, n), every = Math.max(1, Math.ceil(64 / slot));
  const xs = labels.map((t, i) => i % every === 0 ? <text key={i} x={m.l + slot * (i + 0.5)} y={h - 8} textAnchor="middle" fontSize="11" fill="#64748b">{t}</text> : null);
  return <>{lines}{xs}</>;
}

export function Tip({ b, x, w, series }: { b: Bucket; x: number; w: number; series: Series[] }) {
  const left = Math.min(Math.max(x, 90), w - 90);
  return (
    <div className="pdx-tip" style={{ left }} role="status">
      <strong>{b.label}</strong>
      <div className="pdx-tip-total">{inr(b.total)}</div>
      <div className="pdx-mut">{b.count} payment{b.count === 1 ? '' : 's'}</div>
      {series.filter((s) => b.by[s.key]).map((s) => <div key={s.key}><i style={{ background: s.color }} />{s.label} {inr(b.by[s.key])}</div>)}
    </div>
  );
}

export function RevenueChart({ data, mode, series }: { data: Bucket[]; mode: 'bars' | 'area'; series: Series[] }) {
  const [ref, w] = useWidth();
  const [hi, setHi] = useState<number | null>(null);
  const H = 330, m = { l: 52, r: 10, t: 12, b: 30 };
  const scale = niceScale(Math.max(0, ...data.map((d) => d.total)));
  const pw = w - m.l - m.r, ph = H - m.t - m.b, slot = pw / Math.max(1, data.length);
  const yOf = (v: number) => m.t + ph * (1 - v / scale.max);
  const cx = (i: number) => m.l + slot * (i + 0.5);
  const pts = data.map((d, i) => `${cx(i)},${yOf(d.total)}`);
  const hover = (clientX: number, el: SVGSVGElement) => {
    const i = Math.floor((clientX - el.getBoundingClientRect().left - m.l) / slot);
    setHi(i >= 0 && i < data.length ? i : null);
  };
  return (
    <div ref={ref} className="pdx-chart" onMouseLeave={() => setHi(null)}>
      {data.length === 0 ? <p className="pdx-empty">No paid payments in this period.</p> : <>
      <svg width={w} height={H} role="group" aria-label="Money collected over time" onMouseMove={(e) => hover(e.clientX, e.currentTarget)}>
        <defs>
          <linearGradient id="pdxArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7a1c1c" stopOpacity=".35" /><stop offset="100%" stopColor="#7a1c1c" stopOpacity="0" /></linearGradient>
        </defs>
        <Axis w={w} h={H} m={m} scale={scale} n={data.length} labels={data.map((d) => d.label)} />
        {mode === 'bars' && data.map((d, i) => {
          const bw = Math.min(42, slot * 0.68);
          let acc = 0;
          return (
            <g key={d.key} tabIndex={0} role="img" aria-label={`${d.label}: ${inr(d.total)}, ${d.count} payments`} onFocus={() => setHi(i)} onBlur={() => setHi(null)} opacity={hi === null || hi === i ? 1 : 0.45}>
              {series.map((s) => {
                const v = d.by[s.key] || 0;
                if (!v) return null;
                const y1 = yOf(acc + v), y0 = yOf(acc);
                acc += v;
                return <rect key={s.key} x={cx(i) - bw / 2} y={y1} width={bw} height={Math.max(1, y0 - y1)} fill={s.color} rx={2} />;
              })}
            </g>
          );
        })}
        {mode === 'area' && (
          <>
            <polygon points={`${cx(0)},${yOf(0)} ${pts.join(' ')} ${cx(data.length - 1)},${yOf(0)}`} fill="url(#pdxArea)" />
            <polyline points={pts.join(' ')} fill="none" stroke="#7a1c1c" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {data.map((d, i) => (data.length <= 40 || i === hi) && <circle key={d.key} cx={cx(i)} cy={yOf(d.total)} r={i === hi ? 5 : 3} fill="#fff" stroke="#7a1c1c" strokeWidth="2" tabIndex={0} role="img" aria-label={`${d.label}: ${inr(d.total)}`} onFocus={() => setHi(i)} onBlur={() => setHi(null)} />)}
          </>
        )}
        {hi !== null && <line x1={cx(hi)} x2={cx(hi)} y1={m.t} y2={H - m.b} stroke="#c9ccd3" strokeDasharray="3 4" />}
      </svg>
      {hi !== null && data[hi] && <Tip b={data[hi]} x={cx(hi)} w={w} series={series} />}
      </>}
    </div>
  );
}

// A ring split into parts. Used for the type split and for the payment health.
export function Donut({ parts, centerTop, centerBottom, label }: { parts: { key: string; label: string; value: number; color: string }[]; centerTop: string; centerBottom: string; label: string }) {
  const [on, setOn] = useState<string | null>(null);
  const R = 62, C = 2 * Math.PI * R, total = parts.reduce((s, p) => s + p.value, 0);
  let acc = 0;
  return (
    <div className="pdx-donut">
      <svg viewBox="0 0 170 170" width="170" height="170" role="img" aria-label={label}>
        <circle cx="85" cy="85" r={R} fill="none" stroke="#f1f2f6" strokeWidth="20" />
        {total > 0 && parts.filter((p) => p.value > 0).map((p) => {
          const len = (p.value / total) * C, gap = Math.min(3, len / 3);
          const el = (
            <circle key={p.key} cx="85" cy="85" r={R} fill="none" stroke={p.color} strokeWidth={on === p.key ? 24 : 20} strokeDasharray={`${Math.max(0, len - gap)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 85 85)" strokeLinecap="butt" style={{ transition: 'stroke-width .15s' }} onMouseEnter={() => setOn(p.key)} onMouseLeave={() => setOn(null)} />
          );
          acc += len;
          return el;
        })}
        <text x="85" y="82" textAnchor="middle" fontSize="12" fill="#64748b">{centerTop}</text>
        <text x="85" y="104" textAnchor="middle" fontSize="20" fontWeight="800" fill="#3b0d0d">{centerBottom}</text>
      </svg>
      <ul className="pdx-legend">
        {parts.map((p) => (
          <li key={p.key} onMouseEnter={() => setOn(p.key)} onMouseLeave={() => setOn(null)} style={{ opacity: on && on !== p.key ? 0.5 : 1 }}>
            <i style={{ background: p.color }} /><span>{p.label}</span>
            <b>{total ? Math.round((p.value / total) * 100) : 0}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// When people pay: weekday by time of day. A bigger dot means more payments.
export const BLOCKS = ['12-4am', '4-8am', '8am-12', '12-4pm', '4-8pm', '8-12pm'];
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function ActivityDots({ data }: { data: { weekday: number; block: number; count: number }[] }) {
  const grid = new Map(data.map((a) => [`${a.weekday}-${a.block}`, a.count]));
  const max = Math.max(1, ...data.map((a) => a.count));
  const CW = 46, RH = 30, L = 34, T = 8;
  return (
    <svg viewBox={`0 0 ${L + CW * 6} ${T + RH * 7 + 24}`} width="100%" role="img" aria-label="When payments are made, by weekday and time of day">
      {DAYS.map((d, r) => (
        <g key={d}>
          <text x={L - 8} y={T + RH * r + RH / 2 + 4} textAnchor="end" fontSize="11" fill="#64748b">{d}</text>
          {BLOCKS.map((_b, c) => {
            const n = grid.get(`${r}-${c}`) || 0;
            const rad = n ? 3 + (n / max) * 9 : 2;
            return <circle key={c} cx={L + CW * c + CW / 2} cy={T + RH * r + RH / 2} r={rad} fill={n ? '#ea580c' : '#e5e7eb'} opacity={n ? 0.35 + 0.65 * (n / max) : 1}><title>{`${d} ${BLOCKS[c]}: ${n} payment${n === 1 ? '' : 's'}`}</title></circle>;
          })}
        </g>
      ))}
      {BLOCKS.map((b, c) => <text key={b} x={L + CW * c + CW / 2} y={T + RH * 7 + 16} textAnchor="middle" fontSize="9.5" fill="#64748b">{b}</text>)}
    </svg>
  );
}


// A line of values over time, for example the running total. Hover or tab to a point to read it.
export function LineChart({ points, color = '#7a1c1c', format = inr, label }: { points: { label: string; value: number; note?: string }[]; color?: string; format?: (n: number) => string; label: string }) {
  const [ref, w] = useWidth();
  const [hi, setHi] = useState<number | null>(null);
  const H = 230, m = { l: 52, r: 10, t: 12, b: 30 };
  const scale = niceScale(Math.max(0, ...points.map((p) => p.value)));
  const pw = w - m.l - m.r, ph = H - m.t - m.b, slot = pw / Math.max(1, points.length);
  const yOf = (v: number) => m.t + ph * (1 - v / scale.max);
  const cx = (i: number) => m.l + slot * (i + 0.5);
  const pts = points.map((p, i) => `${cx(i)},${yOf(p.value)}`);
  const gid = `pdxLine${label.replace(/\W/g, '')}`;
  return (
    <div ref={ref} className="pdx-chart" onMouseLeave={() => setHi(null)}>
      {points.length === 0 ? <p className="pdx-empty">Nothing to show in this period.</p> : (
        <>
          <svg width={w} height={H} role="group" aria-label={label}
            onMouseMove={(e) => { const i = Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left - m.l) / slot); setHi(i >= 0 && i < points.length ? i : null); }}>
            <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
            <Axis w={w} h={H} m={m} scale={scale} n={points.length} labels={points.map((p) => p.label)} yfmt={format === inr ? short : format} />
            <polygon points={`${cx(0)},${yOf(0)} ${pts.join(' ')} ${cx(points.length - 1)},${yOf(0)}`} fill={`url(#${gid})`} />
            <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (points.length <= 40 || i === hi) && <circle key={i} cx={cx(i)} cy={yOf(p.value)} r={i === hi ? 5 : 3} fill="#fff" stroke={color} strokeWidth="2" tabIndex={0} role="img" aria-label={`${p.label}: ${format(p.value)}`} onFocus={() => setHi(i)} onBlur={() => setHi(null)} />)}
            {hi !== null && <line x1={cx(hi)} x2={cx(hi)} y1={m.t} y2={H - m.b} stroke="#c9ccd3" strokeDasharray="3 4" />}
          </svg>
          {hi !== null && points[hi] && (
            <div className="pdx-tip" style={{ left: Math.min(Math.max(cx(hi), 90), w - 90) }} role="status">
              <strong>{points[hi].label}</strong>
              <div className="pdx-tip-total">{format(points[hi].value)}</div>
              {points[hi].note && <div className="pdx-mut">{points[hi].note}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Plain columns, one per group, for example how many bookings fall in each amount range
export function Columns({ items, color = '#ea580c', format = (n: number) => String(n), label }: { items: { label: string; value: number; note?: string }[]; color?: string; format?: (n: number) => string; label: string }) {
  const [ref, w] = useWidth();
  const [hi, setHi] = useState<number | null>(null);
  const H = 220, m = { l: 40, r: 8, t: 14, b: 44 };
  const scale = niceScale(Math.max(0, ...items.map((p) => p.value)), 4);
  const pw = w - m.l - m.r, ph = H - m.t - m.b, slot = pw / Math.max(1, items.length);
  const yOf = (v: number) => m.t + ph * (1 - v / scale.max);
  const bw = Math.min(54, slot * 0.6);
  const ticks: number[] = [];
  for (let v = 0; v <= scale.max + 0.0001; v += scale.step) ticks.push(v);
  return (
    <div ref={ref} className="pdx-chart" onMouseLeave={() => setHi(null)}>
      <svg width={w} height={H} role="group" aria-label={label}>
        {ticks.map((v) => <g key={v}><line x1={m.l} x2={w - m.r} y1={yOf(v)} y2={yOf(v)} stroke="#eaecf0" /><text x={m.l - 8} y={yOf(v) + 4} textAnchor="end" fontSize="11" fill="#64748b">{format(v)}</text></g>)}
        {items.map((p, i) => {
          const x = m.l + slot * i + slot / 2;
          const words = p.label.split(' ');
          const half = Math.ceil(words.length / 2);
          return (
            <g key={p.label} tabIndex={0} role="img" aria-label={`${p.label}: ${format(p.value)}`} onMouseEnter={() => setHi(i)} onFocus={() => setHi(i)} onBlur={() => setHi(null)} opacity={hi === null || hi === i ? 1 : 0.5}>
              <rect x={x - bw / 2} y={yOf(p.value)} width={bw} height={Math.max(p.value > 0 ? 2 : 0, yOf(0) - yOf(p.value))} rx={4} fill={color} />
              <text x={x} y={yOf(p.value) - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#3b0d0d">{p.value ? format(p.value) : ''}</text>
              <text x={x} y={H - 24} textAnchor="middle" fontSize="10.5" fill="#64748b">{words.slice(0, half).join(' ')}</text>
              <text x={x} y={H - 11} textAnchor="middle" fontSize="10.5" fill="#64748b">{words.slice(half).join(' ')}</text>
            </g>
          );
        })}
      </svg>
      {hi !== null && items[hi]?.note && <div className="pdx-tip" style={{ left: Math.min(Math.max(m.l + slot * hi + slot / 2, 90), w - 90) }} role="status"><strong>{items[hi].label}</strong><div className="pdx-mut">{items[hi].note}</div></div>}
    </div>
  );
}

// A list of labelled horizontal bars (states, sevas). Each can carry a small second line.
export function HBars({ items, format = inr }: { items: { key: string; label: string; value: number; color: string; sub?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="pdx-empty">Nothing yet.</p>;
  return (
    <ul className="pdx-seg">
      {items.map((t) => (
        <li key={t.key}>
          <div className="r"><span className="n" title={t.label}>{t.label}</span><b>{format(t.value)}</b></div>
          <div className="pdx-bar" role="img" aria-label={`${t.label}: ${format(t.value)}`}><div style={{ width: `${(t.value / max) * 100}%`, background: t.color }} /></div>
          {t.sub && <p className="pdx-sub">{t.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

export function Delta({ now, before }: { now: number; before: Money | null }) {
  if (!before) return null;
  if (before.amount <= 0) return <span className="pdx-delta flat">{now > 0 ? 'New' : 'No change'}<small> vs previous period</small></span>;
  const pct = ((now - before.amount) / before.amount) * 100;
  return <span className={`pdx-delta ${pct >= 0 ? 'up' : 'down'}`}>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%<small> vs previous period</small></span>;
}


// ---------- Date range picker: a button that opens a small calendar. Click a start day, then an end day. ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const parseDay = (v: string) => (v ? new Date(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10)) : null);
const showDay = (v: string) => { const d = parseDay(v); return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; };

export function DateRangePicker({ from, to, onChange, label = 'Dates' }: { from: string; to: string; onChange: (from: string, to: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => { const d = parseDay(to) || parseDay(from) || new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [start, setStart] = useState('');   // the first click, while the second is still to come
  const [hover, setHover] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setStart(''); } };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setStart(''); } };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array.from({ length: first.getDay() }, () => null), ...Array.from({ length: days }, (_, i) => ymd(new Date(view.getFullYear(), view.getMonth(), i + 1)))];
  const today = ymd(new Date());

  // while choosing, the range runs from the first click to the day under the pointer
  const a = start || from, b = start ? (hover || start) : to;
  const lo = a && b ? (a < b ? a : b) : a, hi = a && b ? (a < b ? b : a) : '';

  function pick(day: string) {
    if (!start) { setStart(day); setHover(''); return; }
    const x = start < day ? start : day, y = start < day ? day : start;
    setStart(''); setHover(''); setOpen(false); onChange(x, y);
  }
  const text = from || to ? `${from ? showDay(from) : 'Start'}  to  ${to ? showDay(to) : 'Today'}` : 'All dates';

  return (
    <div className="pdx-range" ref={box}>
      <button type="button" className="pdx-rangebtn" aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${text}. Change dates`} onClick={() => setOpen((o) => !o)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
        <span>{text}</span>
      </button>
      {open && (
        <div className="pdx-pop" role="dialog" aria-label="Choose dates">
          <div className="pdx-pop-head">
            <button type="button" className="pdx-nav" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>&#8249;</button>
            <b>{MONTHS[view.getMonth()]} {view.getFullYear()}</b>
            <button type="button" className="pdx-nav" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>&#8250;</button>
          </div>
          <div className="pdx-cal" role="grid" aria-label={`${MONTHS[view.getMonth()]} ${view.getFullYear()}`}>
            {WEEK.map((w) => <span key={w} className="pdx-wd" aria-hidden="true">{w}</span>)}
            {cells.map((c, i) => {
              if (!c) return <span key={`e${i}`} />;
              const edge = c === lo || c === hi;
              const inside = !!lo && !!hi && c > lo && c < hi;
              return (
                <button key={c} type="button" role="gridcell" aria-selected={edge} aria-label={showDay(c)}
                  className={`pdx-day${edge ? ' edge' : ''}${inside ? ' in' : ''}${c === today ? ' today' : ''}`}
                  onClick={() => pick(c)} onMouseEnter={() => start && setHover(c)}>{+c.slice(8)}</button>
              );
            })}
          </div>
          <p className="pdx-pop-hint" aria-live="polite">{start ? `From ${showDay(start)}. Now choose the last day.` : 'Choose the first day, then the last day.'}</p>
          <div className="pdx-pop-foot">
            <button type="button" className="pdx-link" onClick={() => { setStart(''); setOpen(false); onChange('', ''); }}>All dates</button>
            <button type="button" className="pdx-link" onClick={() => { const t = ymd(new Date()); setStart(''); setOpen(false); onChange(t, t); }}>Today only</button>
          </div>
        </div>
      )}
    </div>
  );
}

export const PDX_CSS = `
.pdx{color:#3b0d0d;margin-bottom:24px}
.pdx *{box-sizing:border-box}
.pdx h1,.pdx h2,.pdx h3,.pdx p{margin:0}
.pdx-mut{color:#64748b}
.pdx-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;margin-bottom:16px}
.pdx-title{font-size:26px;font-weight:800;letter-spacing:-.01em;color:#3b0d0d}
.pdx-card{background:#fff;border:1px solid #eaecf0;border-radius:16px;padding:18px;min-width:0;box-shadow:0 1px 2px rgba(59,13,13,.04)}
.pdx-card h3{font-size:16px;font-weight:700;color:#3b0d0d}
.pdx-sub{font-size:12px;color:#64748b;margin-top:2px}
.pdx-grid{display:grid;gap:14px;margin-bottom:14px}
.pdx-g-kpi{grid-template-columns:minmax(0,1fr)}
@media(min-width:560px){.pdx-g-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:960px){.pdx-g-kpi{grid-template-columns:minmax(0,1.5fr) repeat(3,minmax(0,1fr))}}
@media(max-width:560px){.pdx-card{padding:14px}}
.pdx-g-2{grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))}
.pdx-g-main{grid-template-columns:minmax(0,2fr) minmax(280px,1fr)}
@media(max-width:900px){.pdx-g-main{grid-template-columns:minmax(0,1fr)}}
.pdx-hero{background:linear-gradient(135deg,#7a1c1c 0%,#5a1212 55%,#3b0d0d 100%);color:#fff8ec;border:0;position:relative;overflow:hidden}
.pdx-hero::after{content:"";position:absolute;right:-40px;top:-40px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(253,230,138,.35),transparent 70%)}
.pdx-hero .pdx-sub{color:#fde68a}
.pdx-big{font-size:clamp(30px,4vw,42px);font-weight:800;letter-spacing:-.02em;margin:6px 0 2px;color:#fff}
.pdx-kpi-n{font-size:28px;font-weight:800;margin-top:6px}
.pdx-kpi-l{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:700}
.pdx-delta{display:inline-flex;align-items:baseline;gap:6px;font-weight:800;font-size:13px;border-radius:999px;padding:3px 10px}
.pdx-delta small{font-weight:600;font-size:11px;opacity:.85}
.pdx-delta.up{background:#bbf7d0;color:#14532d}.pdx-delta.down{background:#fecaca;color:#7f1d1d}.pdx-delta.flat{background:rgba(255,255,255,.2);color:inherit}
.pdx-btn{font:inherit;font-size:13px;font-weight:700;border-radius:999px;border:1px solid #e5e7eb;background:#fff;color:#3b0d0d;padding:7px 14px;cursor:pointer}
.pdx-btn:hover:not(:disabled){background:#fff8ec;border-color:#fde68a}
.pdx-btn:disabled{opacity:.5;cursor:default}
.pdx-btn.on{background:#7a1c1c;border-color:#7a1c1c;color:#fff}
.pdx button:focus-visible,.pdx input:focus-visible,.pdx select:focus-visible,.pdx [tabindex]:focus-visible{outline:2px solid #ea580c;outline-offset:2px}
.pdx-row{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}
.pdx-lbl{display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:4px}
.pdx-inp{font:inherit;font-size:14px;color:#3b0d0d;background:#fff;border:1px solid #d1d5db;border-radius:12px;padding:8px 12px;min-width:0}
.pdx-inp::placeholder{color:#94a3b8}
.pdx-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.pdx-chart{position:relative;width:100%}
.pdx-chart svg{display:block;max-width:100%}
.pdx-tip{position:absolute;top:6px;transform:translateX(-50%);background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:8px 12px;font-size:12px;pointer-events:none;z-index:2;min-width:130px;box-shadow:0 8px 24px rgba(59,13,13,.15);color:#3b0d0d}
.pdx-tip-total{font-size:16px;font-weight:800}
.pdx-tip i,.pdx-legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px}
.pdx-key{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#475569;margin-top:6px}
.pdx-key i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px}
.pdx-donut{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center}
.pdx-legend{list-style:none;margin:0;padding:0;display:grid;gap:8px;font-size:13px;flex:1;min-width:140px}
.pdx-legend li{display:flex;align-items:center;transition:opacity .15s}
.pdx-legend span{flex:1}
.pdx-empty{color:#64748b;font-size:14px;padding:24px 0;text-align:center}
.pdx-seg{margin:0;padding:0;list-style:none;display:grid;gap:12px}
.pdx-seg li{font-size:13px}
.pdx-seg .r{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px}
.pdx-seg .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.pdx-bar{height:8px;border-radius:6px;background:#f1f2f6;overflow:hidden}
.pdx-bar>div{height:100%;border-radius:6px}
.pdx-ava{width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#7a1c1c;background:#fde68a;flex:none}
.pdx-donor{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #eaecf0}
.pdx-donor:first-child{border-top:0}
.pdx-tablewrap{overflow-x:auto;margin:0 -18px}
.pdx table{width:100%;border-collapse:collapse;font-size:14px;min-width:780px}
.pdx th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;text-align:left;padding:10px 16px;font-weight:700;background:#f8f9fc}
.pdx td{padding:11px 16px;border-top:1px solid #eaecf0;vertical-align:middle}
.pdx tr.open td{background:#fff8ec}
.pdx-pill{white-space:nowrap;display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 11px;font-size:12px;font-weight:700;background:#f4f5f9}
.pdx-pill i{width:7px;height:7px;border-radius:50%}
.pdx-link{background:none;border:0;color:#ea580c;font:inherit;font-weight:700;cursor:pointer;padding:2px 4px;text-decoration:underline}
.pdx dl{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px 18px;margin:0;font-size:13px}
.pdx dt{color:#64748b;font-weight:700}.pdx dd{margin:0;word-break:break-all}
.pdx-err{background:#fef2f2;border:1px solid #fecaca;color:#7f1d1d;border-radius:14px;padding:12px 16px;font-size:14px}
.pdx-busy{opacity:.55;transition:opacity .2s}
.pdx-tools{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.pdx-presets{display:inline-flex;flex-wrap:wrap;gap:2px;background:#fdf6e9;border:1px solid #f3e3bd;border-radius:14px;padding:4px}
.pdx-presets button{font:inherit;font-size:13px;font-weight:700;border:0;background:transparent;color:#7a1c1c;padding:8px 15px;border-radius:10px;cursor:pointer;white-space:nowrap}
.pdx-presets button:hover{background:#fdebc4}
.pdx-presets button[aria-pressed=true]{background:#7a1c1c;color:#fff;box-shadow:0 1px 3px rgba(122,28,28,.3)}
.pdx-presets button:focus-visible,.pdx-rangebtn:focus-visible,.pdx-day:focus-visible,.pdx-nav:focus-visible{outline:2px solid #ea580c;outline-offset:2px}
.pdx-range{position:relative}
.pdx-rangebtn{display:inline-flex;align-items:center;gap:10px;font:inherit;font-size:14px;font-weight:700;color:#3b0d0d;background:#fff;border:1px solid #eaecf0;border-radius:14px;padding:9px 16px;cursor:pointer;box-shadow:0 1px 2px rgba(59,13,13,.05);white-space:pre}
.pdx-rangebtn svg{color:#ea580c;flex:none}
.pdx-rangebtn:hover,.pdx-rangebtn[aria-expanded=true]{border-color:#e0a526;background:#fffaf0}
.pdx-pop{position:absolute;right:0;top:calc(100% + 8px);z-index:40;width:312px;max-width:calc(100vw - 32px);background:#fff;border:1px solid #eaecf0;border-radius:18px;box-shadow:0 18px 40px rgba(59,13,13,.18);padding:16px}
.pdx-pop-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;color:#3b0d0d}
.pdx-nav{font:inherit;font-size:20px;line-height:1;width:34px;height:34px;border-radius:10px;border:1px solid #eaecf0;background:#fff;color:#7a1c1c;cursor:pointer}
.pdx-nav:hover{background:#fff8ec;border-color:#fde68a}
.pdx-cal{display:grid;grid-template-columns:repeat(7,1fr);row-gap:2px}
.pdx-wd{text-align:center;font-size:11px;font-weight:800;color:#64748b;padding:4px 0 6px;letter-spacing:.04em}
.pdx-day{font:inherit;font-size:13px;font-weight:600;height:36px;border:0;background:transparent;color:#3b0d0d;cursor:pointer;border-radius:0;position:relative}
.pdx-day:hover{background:#fdf0cf;border-radius:10px}
.pdx-day.in{background:#fdf0cf}
.pdx-day.edge{background:#7a1c1c;color:#fff;border-radius:10px;font-weight:800}
.pdx-day.today:not(.edge)::after{content:"";position:absolute;left:50%;bottom:5px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:#ea580c}
.pdx-pop-hint{font-size:12px;color:#64748b;margin-top:10px}
.pdx-pop-foot{display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid #f1f2f4}
@media (max-width:560px){.pdx-tools{align-items:stretch}.pdx-presets{width:100%}.pdx-presets button{flex:1 1 auto;padding:8px 10px}.pdx-range,.pdx-rangebtn{width:100%}.pdx-rangebtn{justify-content:center}.pdx-pop{left:0;right:0;width:auto;max-width:none}}
`;