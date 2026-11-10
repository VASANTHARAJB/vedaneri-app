import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CSS, Notice, useFlash } from './DiscoverKit';
import { inr, ymd } from './PaymentCharts';
import { MODE_LABEL, SaleRow, posApi, qtyText, timeText } from './PosKit';

// POS dashboard: five ring cards, a smooth sales curve for the last 14 days, a stock-health gauge, best sellers, a daily bills chart,
// the latest bills and what needs buying. All numbers come from .../api/v1/pos/dashboard.
type Dash = {
  today: { bills: number; total: number }; month: { bills: number; total: number }; stockValue: number; stockItems: number; lowCount: number;
  days: { d: string; bills: number; total: number }[]; top: { name: string; qty: number; amount: number }[];
  low: { id: number; name: string; unit: string; stock: number; reorder_level: number }[]; recent: SaleRow[];
};
type Day = { d: string; label: string; total: number; bills: number };

const NAVY = '#3a4268';
const compact = (n: number) => (n >= 10_000_000 ? `${Math.round(n / 1e6) / 10}Cr` : n >= 100_000 ? `${Math.round(n / 1e4) / 10}L` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)));
const pct = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : 0);

// A smooth line through the points (Catmull-Rom turned into Bezier curves)
function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const Arrow = ({ down }: { down?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {down ? <path d="M17 7L7 17M7 9v8h8" /> : <path d="M7 17L17 7M9 7h8v8" />}
  </svg>
);
function Ring({ value, color, down }: { value: number | null; color: string; down?: boolean }) {
  const R = 26, C = 2 * Math.PI * R;
  return (
    <div className="pd-ring" style={{ color }}>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeOpacity=".16" strokeWidth="6" />
        <circle cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (value === null ? 1 : value) / 100)} transform="rotate(-90 32 32)" className="pd-arc" />
      </svg>
      <span><Arrow down={down} /></span>
    </div>
  );
}
const Kpi = ({ value, label, sub, color, ring, down }: { value: React.ReactNode; label: string; sub?: string; color: string; ring: number | null; down?: boolean }) => (
  <div className="pd-card pd-kpi">
    <Ring value={ring} color={color} down={down} />
    <div><b>{value}</b><span>{label}</span>{sub && <small>{sub}</small>}</div>
  </div>
);

export default function PosDashboard() {
  const { notice, flash, clear } = useFlash();
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState<number | null>(null);
  const [pickBar, setPickBar] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setD(await posApi<Dash>('/dashboard')); }
    catch (e: any) { flash('err', e?.message || 'Could not load the dashboard.'); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  // The last 14 days, with a zero for the days nothing was sold
  const days: Day[] = useMemo(() => {
    const by = new Map((d?.days || []).map((x) => [x.d, x]));
    return Array.from({ length: 14 }, (_, i) => {
      const dt = new Date(); dt.setDate(dt.getDate() - (13 - i));
      const key = ymd(dt); const r = by.get(key);
      return { d: key, label: `${key.slice(8, 10)}/${key.slice(5, 7)}`, total: r?.total || 0, bills: r?.bills || 0 };
    });
  }, [d]);

  const maxTotal = Math.max(1, ...days.map((x) => x.total));
  const maxBills = Math.max(1, ...days.map((x) => x.bills));
  const healthy = d && d.stockItems > 0 ? pct(d.stockItems - d.lowCount, d.stockItems) : 100;
  const topMax = Math.max(1, ...(d?.top.map((t) => t.amount) || [1]));

  // The sales curve
  const W = 640, H = 230, PX = 34, PT = 24, PB = 30;
  const x = (i: number) => PX + (i * (W - PX * 2)) / 13;
  const yS = (v: number) => PT + (1 - v / maxTotal) * (H - PT - PB);
  const yB = (v: number) => PT + (1 - v / maxBills) * (H - PT - PB);
  const sPts = days.map((v, i) => [x(i), yS(v.total)] as [number, number]);
  const bPts = days.map((v, i) => [x(i), yB(v.bills)] as [number, number]);
  const line = smooth(sPts);
  const area = sPts.length ? `${line} L${x(13)},${H - PB} L${x(0)},${H - PB} Z` : '';
  const sel = pick ?? 13;
  const hover = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setPick(Math.max(0, Math.min(13, Math.round(((px - PX) / (W - PX * 2)) * 13))));
  };
  const selBar = pickBar ?? 13;

  // The stock-health gauge: a half circle
  const ARC = Math.PI * 80;

  return (
    <div className="dc">
      <style>{CSS}</style>
      <style>{PD_CSS}</style>
      <Notice notice={notice} onClear={clear} />
      <div className="pd">
        <div className="pd-top">
          <div>
            <h1>Hello Admin!</h1>
            <p>Measure how the ashram shop is doing, day by day.</p>
          </div>
          <div className="pd-actions">
            <button type="button" className="pd-ghost" onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
            <Link to="/pos-new-sale" className="pd-cta">+ New sale</Link>
          </div>
        </div>

        <h2 className="pd-h">Overview</h2>
        {!d ? <div className="pd-card pd-empty">{loading ? 'Loading...' : 'No data yet.'}</div> : (
          <>
            <div className="pd-kpis">
              <Kpi value={inr(d.today.total)} label="Today's sales" sub={`best day: ${inr(Math.max(0, ...days.map((v) => v.total)))}`} color="#e8795a" ring={pct(d.today.total, maxTotal)} />
              <Kpi value={d.today.bills} label="Bills today" sub={`best day: ${Math.max(0, ...days.map((v) => v.bills))}`} color="#38bdf8" ring={pct(d.today.bills, maxBills)} />
              <Kpi value={inr(d.month.total)} label="This month" sub={`${d.month.bills} bill${d.month.bills === 1 ? '' : 's'}`} color="#f2b233" ring={null} />
              <Kpi value={inr(d.stockValue)} label="Stock at cost" sub={`${d.stockItems} items counted`} color="#34c38f" ring={null} />
              <Kpi value={d.lowCount} label="Low or out of stock" sub={d.lowCount ? 'time to buy' : 'all good'} color={d.lowCount ? '#ef4444' : '#8b5cf6'} ring={healthy} down={d.lowCount > 0} />
            </div>

            <div className="pd-row pd-r1">
              <div className="pd-card">
                <div className="pd-ch"><b>Sales, last 14 days</b>
                  <span className="pd-leg"><i style={{ background: '#f59e0b' }} />Sales <i style={{ background: '#5b6b9a' }} />Bills</span>
                </div>
                <div className="pd-chart">
                  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sales and bills for the last 14 days" onMouseMove={hover} onMouseLeave={() => setPick(null)} onClick={hover}>
                    <defs>
                      <linearGradient id="pdA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f59e0b" stopOpacity=".35" /><stop offset="1" stopColor="#f59e0b" stopOpacity="0" /></linearGradient>
                    </defs>
                    {[0, 0.25, 0.5, 0.75, 1].map((g) => <g key={g}><line x1={PX} x2={W - PX} y1={PT + g * (H - PT - PB)} y2={PT + g * (H - PT - PB)} stroke="#e6e8f2" strokeDasharray="3 5" /><text x={PX - 6} y={PT + g * (H - PT - PB) + 3} fontSize="9.5" textAnchor="end" fill="#9aa1bd">{compact(days.some((v) => v.total) ? maxTotal * (1 - g) : 0)}</text></g>)}
                    <path d={area} fill="url(#pdA)" />
                    <path d={smooth(bPts)} fill="none" stroke="#5b6b9a" strokeWidth="2.4" strokeLinecap="round" opacity=".75" />
                    <path d={line} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" className="pd-draw" />
                    {days.map((v, i) => i % 2 === 1 || i === 13 ? <text key={v.d} x={x(i)} y={H - 8} fontSize="9.5" textAnchor="middle" fill={i === sel ? NAVY : '#9aa1bd'} fontWeight={i === sel ? 700 : 400}>{v.label}</text> : null)}
                    <line x1={x(sel)} x2={x(sel)} y1={PT} y2={H - PB} stroke="#f59e0b" strokeOpacity=".35" />
                    <circle cx={x(sel)} cy={yS(days[sel].total)} r="6" fill="#fff" stroke="#f59e0b" strokeWidth="3" />
                    <circle cx={x(sel)} cy={yB(days[sel].bills)} r="4.5" fill="#fff" stroke="#5b6b9a" strokeWidth="2.5" />
                  </svg>
                  <div className="pd-tip" style={{ left: `${Math.min(86, Math.max(14, (x(sel) / W) * 100))}%`, top: 4 }}>
                    <b>{days[sel].label}</b>
                    <span>Sales: {inr(days[sel].total)}</span>
                    <span>Bills: {days[sel].bills}</span>
                  </div>
                </div>
              </div>

              <div className="pd-card">
                <div className="pd-ch"><b>Stock health</b></div>
                <div className="pd-gauge">
                  <svg viewBox="0 0 200 126" role="img" aria-label={`${healthy} percent of items are above their re-order level`}>
                    <defs><linearGradient id="pdG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ff7a45" /><stop offset="1" stopColor="#fbbf24" /></linearGradient></defs>
                    <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#eef0f7" strokeWidth="22" strokeLinecap="round" />
                    <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#pdG)" strokeWidth="22" strokeLinecap="round" strokeDasharray={ARC} strokeDashoffset={ARC * (1 - healthy / 100)} className="pd-arc" />
                    <text x="20" y="122" fontSize="10" fill="#9aa1bd" textAnchor="middle">0%</text><text x="180" y="122" fontSize="10" fill="#9aa1bd" textAnchor="middle">100%</text>
                  </svg>
                  <div className="pd-gc"><span className="pd-thumb">{healthy >= 70 ? '👍' : '⚠️'}</span><b>{healthy}%</b></div>
                </div>
                <p className="pd-note">{d.stockItems ? `${d.stockItems - d.lowCount} of ${d.stockItems} items are above their re-order level.` : 'Add items that keep stock to see this.'}</p>
              </div>
            </div>

            <div className="pd-row pd-r2">
              <div className="pd-card">
                <div className="pd-ch"><b>Best sellers</b><small>last 30 days</small></div>
                <div className="pd-bars">
                  {d.top.map((t, i) => (
                    <div key={t.name}>
                      <div className="pd-bl"><span>{t.name}</span><b>{inr(t.amount)}</b></div>
                      <div className="pd-track"><i style={{ width: `${Math.max(4, (t.amount / topMax) * 100)}%`, background: ['linear-gradient(90deg,#f97316,#fbbf24)', 'linear-gradient(90deg,#22d3ee,#2563eb)', 'linear-gradient(90deg,#34d399,#84cc16)', 'linear-gradient(90deg,#a78bfa,#ec4899)', 'linear-gradient(90deg,#f59e0b,#ef4444)', 'linear-gradient(90deg,#64748b,#94a3b8)'][i % 6] }} /></div>
                    </div>
                  ))}
                  {!d.top.length && <p className="pd-note">No sales yet. Make the first bill from "+ New sale".</p>}
                </div>
              </div>

              <div className="pd-card">
                <div className="pd-ch"><b>Bills each day</b><small>tap a bar</small></div>
                <div className="pd-chart pd-bc">
                  <svg viewBox={`0 0 ${W} 200`} role="img" aria-label="Bills each day for the last 14 days">
                    {days.map((v, i) => {
                      const bw = 26, cx = PX + 6 + i * ((W - PX * 2 - 12) / 13), h = (v.bills / maxBills) * 130, hs = (v.total / maxTotal) * 130;
                      const on = i === selBar;
                      return (
                        <g key={v.d} onMouseEnter={() => setPickBar(i)} onMouseLeave={() => setPickBar(null)} onClick={() => setPickBar(i)} style={{ cursor: 'pointer' }}>
                          <rect x={cx - bw / 2} y={20} width={bw} height={140} rx="9" fill="#f1f3f9" />
                          <rect x={cx - bw / 2} y={160 - hs} width={bw} height={Math.max(hs, v.total ? 4 : 0)} rx="9" fill={on ? 'url(#pdB)' : '#c9cfe3'} />
                          <rect x={cx - 4} y={160 - h} width={8} height={Math.max(h, v.bills ? 4 : 0)} rx="4" fill={on ? '#fff' : '#fff'} opacity={on ? 0.95 : 0.7} />
                          <text x={cx} y={184} fontSize="9.5" textAnchor="middle" fill={on ? NAVY : '#9aa1bd'} fontWeight={on ? 700 : 400}>{i % 2 === 1 || i === 13 ? v.label : ''}</text>
                        </g>
                      );
                    })}
                    <defs><linearGradient id="pdB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f97316" /><stop offset="1" stopColor="#fbbf24" /></linearGradient></defs>
                  </svg>
                  <div className="pd-tip" style={{ left: `${Math.min(86, Math.max(14, ((PX + 6 + selBar * ((W - PX * 2 - 12) / 13)) / W) * 100))}%`, top: 0 }}>
                    <b>{days[selBar].label}</b><span>Bills: {days[selBar].bills}</span><span>Sales: {inr(days[selBar].total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pd-row pd-r3">
              <div className="pd-card">
                <div className="pd-ch"><b>Latest bills</b><Link to="/pos-sales" className="pd-more">All sales</Link></div>
                <div className="pd-list">
                  {d.recent.map((s) => (
                    <div key={s.id} className={`pd-li${s.status === 'CANCELLED' ? ' off' : ''}`}>
                      <div><b>{s.bill_no}</b><small>{timeText(s.sale_date)}{s.customer_name ? ` | ${s.customer_name}` : ''}</small></div>
                      <span className="pd-chip">{MODE_LABEL[s.pay_mode] || s.pay_mode}</span>
                      <b className="pd-amt">{s.status === 'CANCELLED' ? 'Cancelled' : inr(s.total)}</b>
                    </div>
                  ))}
                  {!d.recent.length && <p className="pd-note">No bills yet.</p>}
                </div>
              </div>
              <div className="pd-card">
                <div className="pd-ch"><b>Needs buying</b><Link to="/pos-purchases" className="pd-more">Stock in</Link></div>
                <div className="pd-list">
                  {d.low.map((i) => (
                    <div key={i.id} className="pd-li">
                      <div><b>{i.name}</b><small>re-order at {qtyText(i.reorder_level)} {i.unit}</small></div>
                      <span className={`pd-chip ${i.stock <= 0 ? 'out' : 'low'}`}>{qtyText(i.stock)} {i.unit}</span>
                    </div>
                  ))}
                  {!d.low.length && <p className="pd-note">Nothing is low. Good.</p>}
                </div>
              </div>
            </div>

            <div className="pd-links">
              <Link to="/pos-items">Items</Link><Link to="/pos-stock">Stock</Link><Link to="/pos-suppliers">Suppliers</Link><Link to="/pos-adjustments">Adjustments</Link><Link to="/pos-reports">Reports</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const PD_CSS = `
.pd{color:${NAVY};padding:22px;border-radius:26px;background:linear-gradient(135deg,#f6f7fc 0%,#fbf4f6 55%,#f3f2fb 100%);margin-bottom:24px}
.pd *{box-sizing:border-box}
.pd h1,.pd h2,.pd p{margin:0}
.pd-top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}
.pd-top h1{font-size:27px;font-weight:800;letter-spacing:-.3px}.pd-top p{font-size:13px;color:#7a82a3;margin-top:4px;max-width:420px}
.pd-actions{display:flex;gap:10px;align-items:center}
.pd-ghost{font:inherit;font-size:13px;font-weight:700;color:${NAVY};background:#fff;border:0;border-radius:12px;padding:9px 16px;cursor:pointer;box-shadow:0 4px 14px rgba(80,90,140,.1)}
.pd-ghost:disabled{opacity:.6}
.pd-cta{font-size:13px;font-weight:800;color:#fff;text-decoration:none;background:linear-gradient(180deg,#fb923c,#f97316);border-radius:10px;padding:10px 18px;box-shadow:0 6px 16px rgba(249,115,22,.35)}
.pd .pd-h{font-size:21px;font-weight:800;margin:26px 0 12px}
.pd-card{background:rgba(255,255,255,.85);border-radius:20px;padding:16px 18px;box-shadow:0 10px 28px rgba(80,90,140,.09),inset 0 1px 0 #fff;min-width:0}
.pd-empty{text-align:center;color:#7a82a3}
.pd-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:14px}
@media(max-width:1180px){.pd-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:700px){.pd-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.pd{padding:14px}}
.pd-kpi{display:flex;align-items:center;gap:12px;padding:14px}
.pd-kpi b{display:block;font-size:22px;font-weight:800;line-height:1.1;overflow-wrap:anywhere}.pd-kpi span{display:block;font-size:13px;font-weight:600;color:#6b7399;margin-top:2px}.pd-kpi small{display:block;font-size:11px;color:#9aa1bd;margin-top:2px}
.pd-ring{position:relative;width:64px;height:64px;flex:0 0 64px}.pd-ring span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.pd-arc{transition:stroke-dashoffset .9s ease}
.pd-row{display:grid;gap:14px;margin-bottom:14px}
.pd-r1{grid-template-columns:minmax(0,1.9fr) minmax(0,1fr)}.pd-r2{grid-template-columns:minmax(0,1fr) minmax(0,1.7fr)}.pd-r3{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)}
@media(max-width:980px){.pd-r1,.pd-r2,.pd-r3{grid-template-columns:1fr}}
.pd-ch{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.pd-ch b{font-size:15px;font-weight:800}.pd-ch small{color:#9aa1bd;font-size:12px}
.pd-leg{font-size:12px;color:#7a82a3;display:flex;align-items:center;gap:6px}.pd-leg i{width:10px;height:10px;border-radius:50%;display:inline-block}
.pd-chart{position:relative}.pd-chart svg{width:100%;height:auto;display:block;touch-action:pan-y}
.pd-tip{position:absolute;transform:translateX(-50%);background:#fff;border-radius:12px;padding:7px 11px;box-shadow:0 8px 22px rgba(80,90,140,.2);font-size:11.5px;pointer-events:none;white-space:nowrap;transition:left .15s}
.pd-tip b{display:block;font-size:12.5px;margin-bottom:2px}.pd-tip span{display:block;color:#6b7399}
.pd-draw{stroke-dasharray:1400;stroke-dashoffset:1400;animation:pdd 1.2s ease forwards}
@keyframes pdd{to{stroke-dashoffset:0}}
@media(prefers-reduced-motion:reduce){.pd-draw{animation:none;stroke-dashoffset:0}.pd-arc{transition:none}}
.pd-gauge{position:relative;max-width:260px;margin:6px auto 0}.pd-gauge svg{width:100%;display:block}
.pd-gc{position:absolute;left:0;right:0;bottom:22px;text-align:center}.pd-gc b{display:block;font-size:24px;font-weight:800}
.pd-thumb{display:inline-flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:50%;background:#fff;box-shadow:0 4px 12px rgba(80,90,140,.18);font-size:16px;margin-bottom:2px}
.pd-note{font-size:12.5px;color:#7a82a3;text-align:center;margin-top:8px}
.pd-bars{display:grid;gap:14px;margin-top:10px}
.pd-bl{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin-bottom:5px}.pd-bl span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pd-track{height:6px;border-radius:99px;background:#eceef6;overflow:hidden}.pd-track i{display:block;height:100%;border-radius:99px;transition:width .8s ease}
.pd-list{display:grid;gap:2px}
.pd-li{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid #eef0f7}.pd-li:last-child{border-bottom:0}
.pd-li>div{flex:1;min-width:0}.pd-li b{font-size:13.5px}.pd-li small{display:block;font-size:11.5px;color:#9aa1bd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pd-li.off{opacity:.5}.pd-amt{white-space:nowrap}
.pd-chip{font-size:11px;font-weight:700;border-radius:99px;padding:3px 10px;background:#eef0f7;color:#5b6b9a;white-space:nowrap}
.pd-chip.low{background:#fef3c7;color:#b45309}.pd-chip.out{background:#fee2e2;color:#b91c1c}
.pd-more{font-size:12px;font-weight:700;color:#f97316;text-decoration:none}
.pd-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}.pd-links a{font-size:13px;font-weight:700;color:${NAVY};text-decoration:none;background:#fff;border-radius:12px;padding:8px 16px;box-shadow:0 4px 14px rgba(80,90,140,.08)}
.pd-links a:hover{color:#f97316}
`;