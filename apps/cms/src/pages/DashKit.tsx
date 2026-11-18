import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../lib/api';
import { useAuth } from '../lib/auth';

// Shared parts of the GM, Admin and Developer dashboards: loading with a refresh button, stat tiles, a bar chart and the styles.

export const inr = (v: number) => `₹${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;
export const num = (v: number) => (Number(v) || 0).toLocaleString('en-IN');

export const KIND_LABEL: Record<string, string> = { seva: 'Seva', donation: 'Donation', magazine: 'Magazine', camp: 'Camp' };
// Four fixed colours; every one is also named in the legend and in the figures beside it
export const KIND_COLOR: Record<string, string> = { seva: '#7a1c1c', donation: '#c2710c', magazine: '#0f766e', camp: '#4f46e5' };

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDay = (iso: string) => { const [, m, d] = iso.split('-'); return `${Number(d)} ${MON[Number(m) - 1] || ''}`; };
export const clock = (iso: string) => { try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
export const dayTime = (iso: string) => { try { return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
export const span = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

// Loads one dashboard; asks again every 60 seconds while the page is open and the tab is visible
export function useDash<T>(path: string) {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);

  const load = useCallback(async (fresh = false) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/dashboards/${path}${fresh ? '?fresh=1' : ''}`, { headers: { Authorization: `Bearer ${token || ''}` }, cache: 'no-store' });
      let d: any = {};
      try { d = await res.json(); } catch { /* no body */ }
      if (!res.ok) throw new Error(d.message || `The server returned an error (${res.status}).`);
      setData(d as T); setErr('');
    } catch (e: any) {
      setErr(e?.message || 'Could not load the dashboard.');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [path, token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60_000);
    return () => clearInterval(t);
  }, [load]);
  return { data, err, loading, reload: () => load(true) };
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'warn' | 'bad' | 'good' }) {
  return (
    <div className={`dk-stat${tone ? ` ${tone}` : ''}`}>
      <span className="dk-lbl">{label}</span>
      <strong className="dk-val">{value}</strong>
      {sub != null && <span className="dk-sub">{sub}</span>}
    </div>
  );
}

// A bar chart drawn as SVG. Each bar may be stacked from several parts (for example the four registers).
export type BarRow = { label: string; parts: { key: string; value: number }[] };
export function Bars({ rows, colors, labels, fmt = inr, height = 190 }: { rows: BarRow[]; colors: Record<string, string>; labels: Record<string, string>; fmt?: (n: number) => string; height?: number }) {
  const W = 700, padL = 8, padB = 24, padT = 10;
  const totals = rows.map((r) => r.parts.reduce((a, p) => a + p.value, 0));
  const max = Math.max(1, ...totals);
  const bw = (W - padL * 2) / Math.max(1, rows.length);
  const keys = Array.from(new Set(rows.flatMap((r) => r.parts.map((p) => p.key))));
  const h = height - padB - padT;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Daily totals for the last 14 days" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1={padL} x2={W - padL} y1={padT + h} y2={padT + h} stroke="#d1d5db" />
        {rows.map((r, i) => {
          let y = padT + h;
          const x = padL + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const total = totals[i];
          return (
            <g key={r.label}>
              <title>{`${r.label}: ${fmt(total)}`}</title>
              {r.parts.map((p) => {
                const bh = (p.value / max) * h;
                y -= bh;
                return bh > 0 ? <rect key={p.key} x={x} y={y} width={w} height={bh} fill={colors[p.key] || '#7a1c1c'} rx={2} /> : null;
              })}
              {total > 0 && <text x={x + w / 2} y={y - 3} textAnchor="middle" fontSize="9.5" fill="#374151">{total >= 100000 ? `${(total / 100000).toFixed(1)}L` : total >= 1000 ? `${(total / 1000).toFixed(total >= 10000 ? 0 : 1)}k` : Math.round(total)}</text>}
              {(i % 2 === 1 || rows.length <= 7) && <text x={x + w / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="#6b7280">{shortDay(r.label)}</text>}
            </g>
          );
        })}
      </svg>
      <div className="dk-legend">
        {keys.map((k) => <span key={k}><i style={{ background: colors[k] || '#7a1c1c' }} />{labels[k] || k}</span>)}
      </div>
    </div>
  );
}

export function DashShell({ title, sub, at, loading, onReload, error, children }: { title: string; sub: string; at?: string; loading: boolean; onReload: () => void; error: string; children: React.ReactNode }) {
  return (
    <div className="dk">
      <style>{DASH_CSS}</style>
      <div className="dk-head">
        <div>
          <h1 className="dk-title">{title}</h1>
          <p className="dk-mut">{sub}</p>
        </div>
        <div className="dk-act">
          {at && <span className="dk-mut" style={{ fontSize: 12 }}>Updated {clock(at)}</span>}
          <button type="button" className="dk-btn" onClick={onReload} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
        </div>
      </div>
      {error && (
        <div role="alert" className="dk-alert">
          <span>{error}</span>
          <button type="button" className="dk-btn sm" onClick={onReload}>Try again</button>
        </div>
      )}
      {children}
    </div>
  );
}

export const Skeleton = () => (
  <div className="dk-grid g4" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="dk-skel" />)}</div>
);

export const DASH_CSS = `
.dk{--p:#7a1c1c;--ink:#1f2937;--mut:#6b7280;--line:#e5e7eb;font-size:13px;color:var(--ink);}
.dk *{box-sizing:border-box;}
.dk p,.dk h1,.dk h2,.dk h3,.dk td,.dk th,.dk span,.dk strong,.dk small,.dk li{color:inherit;}
.dk .dk-mut{color:var(--mut);}
.dk-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;}
.dk-title{font-size:22px;font-weight:800;line-height:1.2;margin:0;}
.dk-head p{margin:2px 0 0;}
.dk-act{display:flex;align-items:center;gap:10px;}
.dk-btn{display:inline-flex;align-items:center;gap:6px;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #cfd4dc;background:#fff;color:var(--ink);}
.dk-btn:hover{background:#f3f4f6;}
.dk-btn:disabled{opacity:.6;cursor:wait;}
.dk-btn.sm{padding:5px 10px;font-size:12px;border-radius:6px;}
.dk-btn.pri{background:var(--p);border-color:var(--p);color:#fff;}
.dk-btn.pri:hover{background:#5e1414;}
.dk-alert{display:flex;justify-content:space-between;align-items:center;gap:12px;border-radius:8px;padding:10px 14px;margin-bottom:14px;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;font-weight:600;}
.dk-grid{display:grid;gap:12px;margin-bottom:12px;}
.dk-grid.g4{grid-template-columns:repeat(4,minmax(0,1fr));}
.dk-grid.g3{grid-template-columns:repeat(3,minmax(0,1fr));}
.dk-grid.g2{grid-template-columns:repeat(2,minmax(0,1fr));}
@media (max-width:1000px){.dk-grid.g4{grid-template-columns:repeat(2,minmax(0,1fr));}.dk-grid.g3{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media (max-width:620px){.dk-grid.g4,.dk-grid.g3,.dk-grid.g2{grid-template-columns:1fr;}}
.dk-card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 16px;min-width:0;}
.dk-card h2{font-size:14px;font-weight:800;margin:0 0 10px;}
.dk-card h3{font-size:12px;font-weight:700;margin:12px 0 6px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;}
.dk-stat{display:flex;flex-direction:column;gap:3px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 16px;min-width:0;border-left:4px solid var(--p);}
.dk-stat.warn{border-left-color:#d97706;}
.dk-stat.bad{border-left-color:#dc2626;}
.dk-stat.good{border-left-color:#16a34a;}
.dk-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);}
.dk-val{font-size:24px;font-weight:800;line-height:1.15;}
.dk-sub{font-size:12px;color:var(--mut);}
.dk-skel{height:92px;border-radius:10px;background:linear-gradient(90deg,#f1f2f4 25%,#e7e9ec 37%,#f1f2f4 63%);background-size:400% 100%;animation:dksk 1.2s ease infinite;}
@keyframes dksk{0%{background-position:100% 50%}100%{background-position:0 50%}}
.dk-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:6px;font-size:12px;color:var(--mut);}
.dk-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px;}
.dk-tbl{width:100%;border-collapse:collapse;}
.dk-tbl th{padding:8px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--mut);background:#f9fafb;border-bottom:1px solid var(--line);white-space:nowrap;}
.dk-tbl td{padding:9px 10px;border-bottom:1px solid #f0f1f3;vertical-align:middle;}
.dk-tbl td.r,.dk-tbl th.r{text-align:right;}
.dk-wrap{overflow-x:auto;}
.dk-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:700;border:1px solid transparent;}
.dk-pill.ok{background:#dcfce7;color:#166534;border-color:#86efac;}
.dk-pill.warn{background:#fef3c7;color:#92400e;border-color:#fcd34d;}
.dk-pill.bad{background:#fee2e2;color:#991b1b;border-color:#fca5a5;}
.dk-pill.off{background:#f1f5f9;color:#64748b;border-color:#e2e8f0;}
.dk-pill.info{background:#e0f2fe;color:#075985;border-color:#bae6fd;}
.dk-rows{list-style:none;margin:0;padding:0;}
.dk-rows li{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #f0f1f3;}
.dk-rows li:last-child{border-bottom:none;}
.dk-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:0;}
.dk-kv dt{color:var(--mut);}
.dk-kv dd{margin:0;font-weight:600;text-align:right;word-break:break-word;}
.dk-empty{padding:18px 0;text-align:center;color:var(--mut);}
.dk-log{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;}
.dk-log td{vertical-align:top;}
.dk-link{border:none;background:none;padding:0;color:var(--p);font-weight:700;cursor:pointer;font-size:13px;}
.dk-link:hover{text-decoration:underline;}
`;