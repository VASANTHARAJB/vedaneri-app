import React, { useEffect, useRef } from 'react';
import { API, CSS, Notice, authHeader, failText, readJson } from './DiscoverKit';
import { DateRangePicker, PDX_CSS, inr, ymd } from './PaymentCharts';
import { printHtml } from './sankalpaForm';

// Shared by the nine Point of Sale pages: the server calls, the types, the page shell, the date bar, the bill print and the styles.
// The server side is .../api/v1/pos (apps/api/src/routes/pos.ts).
export const POS_BASE = `${String(API).replace(/\/discover\/?$/, '')}/pos`;

export async function posApi<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${POS_BASE}${path}`, {
    method: opts.method || 'GET', cache: 'no-store',
    headers: opts.body !== undefined ? { ...authHeader(), 'Content-Type': 'application/json' } : authHeader(),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const j = await readJson(res);
  if (!res.ok) throw new Error(failText(j, `The server said no (${res.status}).`));
  return j as T;
}
export async function posDownload(path: string, file: string): Promise<void> {
  const res = await fetch(`${POS_BASE}${path}`, { headers: authHeader() });
  if (!res.ok) throw new Error(failText(await readJson(res), 'Could not make the file.'));
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a'); a.href = url; a.download = file; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export type Item = { id: number; sku: string; barcode: string; name: string; category: string; unit: string; price: number; cost: number; gst_percent: number; track_stock: boolean; reorder_level: number; active: boolean; stock: number };
export type SaleRow = { id: number; bill_no: string; sale_date: string; customer_name: string; phone: string; subtotal: number; discount: number; gst_total: number; total: number; pay_mode: string; pay_ref: string; notes: string; status: 'ACTIVE' | 'CANCELLED'; cancel_reason: string; by: string; lines: number };
export type SaleLine = { item_id: number; name: string; unit: string; qty: number; price: number; gst_percent: number; amount: number };
export type SaleDetail = SaleRow & { items: SaleLine[] };

export const MODE_LABEL: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', other: 'Other' };
export const qtyText = (n: number) => String(Math.round(n * 1000) / 1000);
const pad = (n: number) => String(n).padStart(2, '0');
export const dmy = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d || '');
// The server sends times as 2026-11-06T13:50:35, already in Indian time, so they are read as they are written
export const timeText = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? `${dmy(s)} ${s.slice(11, 16)}` : dmy(s));
export const shortDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

export type Preset = 'today' | 'week' | 'month' | 'last30' | 'year' | 'all' | 'custom';
export function rangeFor(id: Preset): { from: string; to: string } {
  const now = new Date();
  switch (id) {
    case 'today': return { from: ymd(now), to: ymd(now) };
    case 'week': return { from: ymd(addDays(-6)), to: ymd(now) };
    case 'month': return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case 'last30': return { from: ymd(addDays(-29)), to: ymd(now) };
    case 'year': { const a = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; return { from: `${a}-04-01`, to: `${a + 1}-03-31` }; }
    default: return { from: '', to: '' };
  }
}
const PRESETS: [Preset, string][] = [['today', 'Today'], ['week', 'Last 7 days'], ['month', 'This month'], ['last30', 'Last 30 days'], ['year', 'This financial year'], ['all', 'All time']];
export function RangeBar({ from, to, preset, onChange }: { from: string; to: string; preset: Preset; onChange: (from: string, to: string, preset: Preset) => void }) {
  return (
    <div className="pdx-tools">
      <div className="pdx-presets" role="group" aria-label="Period">
        {PRESETS.map(([id, l]) => <button key={id} type="button" aria-pressed={preset === id} onClick={() => { const r = rangeFor(id); onChange(r.from, r.to, id); }}>{l}</button>)}
      </div>
      <DateRangePicker from={from} to={to} label="Dates" onChange={(f, t) => onChange(f, t, f || t ? 'custom' : 'all')} />
    </div>
  );
}

export function PosShell(p: { title: string; sub?: string; actions?: React.ReactNode; notice: any; clear: () => void; children: React.ReactNode }) {
  return (
    <div className="dc">
      <style>{CSS}</style>
      <style>{PDX_CSS}</style>
      <style>{POS_CSS}</style>
      <Notice notice={p.notice} onClear={p.clear} />
      <div className="pdx">
        <div className="pdx-top">
          <div>
            <h1 className="pdx-title">{p.title}</h1>
            {p.sub && <p className="pdx-sub" style={{ fontSize: 14, maxWidth: 760 }}>{p.sub}</p>}
          </div>
          {p.actions && <div className="pdx-row">{p.actions}</div>}
        </div>
        {p.children}
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide, foot }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; foot?: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  // onClose is a new function on every render of the page; it is kept in a ref so the window is set up once, and focus is not pulled back while the person types
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', key);
    if (box.current && !box.current.contains(document.activeElement)) box.current.focus();
    return () => document.removeEventListener('keydown', key);
  }, []);
  return (
    <div className="ps-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`ps-modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={box} tabIndex={-1}>
        <div className="ps-mh"><b>{title}</b><button type="button" className="ps-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="ps-mb">{children}</div>
        {foot && <div className="ps-mf">{foot}</div>}
      </div>
    </div>
  );
}
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="ps-f"><span className="pdx-lbl">{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export const Card = ({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: 'warn' | 'good' }) => (
  <div className={`ps-card${tone ? ` ${tone}` : ''}`}><span>{label}</span><b>{value}</b>{sub && <small>{sub}</small>}</div>
);
export function Bars({ data, height = 150 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="ps-empty">No sales in this period.</p>;
  const w = Math.max(280, data.length * 34);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg role="img" aria-label="Sales by day" width={w} height={height + 28} viewBox={`0 0 ${w} ${height + 28}`}>
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * (height - 18)); const x = i * 34 + 6;
          return (
            <g key={d.label + i}>
              <title>{`${d.label}: ${inr(d.value)}`}</title>
              <rect x={x} y={height - h} width={22} height={h} rx={4} fill="#7a1c1c" opacity={0.85} />
              <text x={x + 11} y={height - h - 4} fontSize="9" textAnchor="middle" fill="#6b7280">{d.value >= 1000 ? `${Math.round(d.value / 100) / 10}k` : Math.round(d.value)}</text>
              <text x={x + 11} y={height + 14} fontSize="9" textAnchor="middle" fill="#6b7280">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------- the printed bill ----------------
export type BillHead = { name: string; line: string; footer: string };
const HEAD_KEY = 'vedaneri.pos.bill.v1';
export const DEFAULT_HEAD: BillHead = { name: 'Vedaneri Ashram Shop', line: 'Vedapuri, Theni', footer: 'Thank you. Om Namah Shivaya' };
export function loadHead(): BillHead {
  try { return { ...DEFAULT_HEAD, ...JSON.parse(localStorage.getItem(HEAD_KEY) || '{}') }; } catch { return DEFAULT_HEAD; }
}
export function saveHead(h: BillHead) { try { localStorage.setItem(HEAD_KEY, JSON.stringify(h)); } catch { /* storage not available */ } }

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// size "80" is for a receipt printer on an 80 mm roll (the paper size comes from the printer, the bill is 74 mm wide); "a5" is a full page bill
export function billHtml(s: SaleDetail, size: '80' | 'a5', head: BillHead): string {
  const rows = s.items.map((l) => `<tr><td class="n">${esc(l.name)}${l.gst_percent ? `<small> (GST ${l.gst_percent}%)</small>` : ''}</td><td class="r">${qtyText(l.qty)} ${esc(l.unit)}</td><td class="r">${money(l.price)}</td><td class="r">${money(l.amount)}</td></tr>`).join('');
  const page = size === '80' ? '@page{margin:3mm}body{width:74mm;font-size:11px}' : '@page{size:A5 portrait;margin:12mm}body{font-size:13px}';
  return `<!doctype html><html lang="ta"><head><meta charset="utf-8"><title>${esc(s.bill_no)}</title><style>
  ${page}
  *{box-sizing:border-box}body{margin:0;font-family:"Noto Sans Tamil","Latha","Nirmala UI",Arial,sans-serif;color:#000}
  .c{text-align:center}h1{font-size:${size === '80' ? 15 : 20}px;margin:0}.sub{font-size:${size === '80' ? 10 : 12}px;margin-bottom:6px}
  table{width:100%;border-collapse:collapse}th{border-top:1px dashed #000;border-bottom:1px dashed #000;padding:3px 0;text-align:left;font-size:${size === '80' ? 10 : 12}px}
  td{padding:2px 0;vertical-align:top}.r{text-align:right;white-space:nowrap;padding-left:8px}.n small{color:#444}
  .t td{border-top:1px dashed #000;padding-top:4px}.big td{font-weight:700;font-size:${size === '80' ? 13 : 16}px}
  .meta{display:flex;justify-content:space-between;gap:6px;margin:4px 0;font-size:${size === '80' ? 10 : 12}px}.cx{margin-top:8px;font-weight:700;text-align:center;border:1px solid #000;padding:2px}
  </style></head><body>
  <div class="c"><h1>${esc(head.name)}</h1><div class="sub">${esc(head.line)}</div></div>
  <div class="meta"><span>Bill: <b>${esc(s.bill_no)}</b></span><span>${esc(timeText(s.sale_date))}</span></div>
  ${s.customer_name || s.phone ? `<div class="meta"><span>${esc(s.customer_name)}</span><span>${esc(s.phone)}</span></div>` : ''}
  <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody>
  <tfoot>
    <tr class="t"><td colspan="3">Sub total</td><td class="r">${money(s.subtotal)}</td></tr>
    ${s.discount ? `<tr><td colspan="3">Discount</td><td class="r">-${money(s.discount)}</td></tr>` : ''}
    <tr class="big"><td colspan="3">TOTAL</td><td class="r">${esc(inr(s.total))}</td></tr>
    ${s.gst_total ? `<tr><td colspan="3"><small>GST included</small></td><td class="r"><small>${money(s.gst_total)}</small></td></tr>` : ''}
    <tr><td colspan="3"><small>Paid by ${esc(MODE_LABEL[s.pay_mode] || s.pay_mode)}${s.pay_ref ? ` (${esc(s.pay_ref)})` : ''}</small></td><td></td></tr>
  </tfoot></table>
  ${s.status === 'CANCELLED' ? '<div class="cx">CANCELLED</div>' : ''}
  <div class="c" style="margin-top:8px">${esc(head.footer)}</div>
  </body></html>`;
}
export const printBill = (s: SaleDetail, size: '80' | 'a5') => printHtml(billHtml(s, size, loadHead()));

export const POS_CSS = `
.ps-table-wrap{overflow:auto;border:1px solid #eee;border-radius:14px;background:#fff}
.pdx .ps-table{width:100%;min-width:0;border-collapse:collapse;font-size:13.5px;color:#3b0d0d}
.ps-table th{position:sticky;top:0;background:#faf5f0;text-align:left;font-size:12px;padding:9px 10px;border-bottom:1px solid #eee;white-space:nowrap;z-index:1}
.ps-table td{padding:9px 10px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
.ps-table tr.off td{opacity:.5}.ps-table tr.click{cursor:pointer}.ps-table tr.click:hover td{background:#fff8f3}
.ps-table .r{text-align:right;white-space:nowrap}.ps-table small{display:block;color:#6b7280;font-size:11.5px}
.ps-empty{padding:26px;text-align:center;color:#6b7280;font-size:14px;margin:0}
.ps-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:0 0 14px}
.ps-card{background:#fff;border:1px solid #eee;border-radius:14px;padding:12px 14px}
.ps-card span{display:block;font-size:12px;color:#6b7280;font-weight:600}.ps-card b{display:block;font-size:22px;margin-top:2px;color:#3b0d0d}.ps-card small{color:#6b7280;font-size:12px}
.ps-card.warn{border-color:#fecaca;background:#fff5f5}.ps-card.warn b{color:#b91c1c}.ps-card.good b{color:#15803d}
.ps-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:12px}
.ps-grid .pdx-inp,.ps-f .pdx-inp{width:100%}
.ps-f{display:block}.ps-f small{display:block;margin-top:3px;color:#6b7280;font-size:11.5px}
.ps-two{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:14px;align-items:start}
@media(max-width:980px){.ps-two{grid-template-columns:1fr}}
.ps-back{position:fixed;inset:0;background:rgba(30,10,10,.45);z-index:80;display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}
.ps-modal{background:#fff;border-radius:18px;width:100%;max-width:560px;box-shadow:0 20px 60px rgba(0,0,0,.3);outline:none}
.ps-modal.wide{max-width:860px}
.ps-mh{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #eee;font-size:16px;color:#3b0d0d}
.ps-x{border:0;background:none;font-size:26px;line-height:1;cursor:pointer;color:#6b7280}
.ps-mb{padding:16px 18px}.ps-mf{padding:12px 18px;border-top:1px solid #eee;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.ps-pill{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;background:#e5e7eb;color:#374151}
.ps-pill.ok{background:#dcfce7;color:#15803d}.ps-pill.low{background:#fef3c7;color:#b45309}.ps-pill.out{background:#fee2e2;color:#b91c1c}.ps-pill.x{background:#e5e7eb;color:#6b7280}
.ps-link{border:0;background:none;color:#7a1c1c;font:inherit;font-weight:700;cursor:pointer;padding:0;text-decoration:underline}
.ps-err{border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:12px;padding:10px 12px;font-size:13px;margin-bottom:12px}
.ps-line{display:grid;grid-template-columns:minmax(0,2.4fr) 90px 100px 36px;gap:8px;align-items:center;margin-bottom:8px}
@media(max-width:600px){.ps-line{grid-template-columns:minmax(0,1fr) 70px 80px 32px}}
.ps-btn-main{background:#7a1c1c!important;border-color:#7a1c1c!important;color:#fff!important}
.ps-pos{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px;align-items:start}
@media(max-width:980px){.ps-pos{grid-template-columns:1fr}}
.ps-picks{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;max-height:520px;overflow:auto;margin-top:10px}
.ps-pick{text-align:left;font:inherit;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:9px 10px;cursor:pointer;color:#3b0d0d}
.ps-pick:hover:not(:disabled){border-color:#7a1c1c;background:#fff8f3}.ps-pick:disabled{opacity:.45;cursor:not-allowed}
.ps-pick b{display:block;font-size:13px;line-height:1.25}.ps-pick span{display:block;font-size:12px;color:#6b7280;margin-top:2px}
.ps-cart{position:sticky;top:8px}
.ps-qty{display:flex;align-items:center;gap:4px}.ps-qty button{width:26px;height:26px;border-radius:8px;border:1px solid #d1d5db;background:#fff;cursor:pointer;font-size:15px;line-height:1}
.ps-qty input{width:54px;text-align:center}
.ps-total{display:flex;justify-content:space-between;align-items:baseline;font-size:15px;margin:4px 0}.ps-total.big{font-size:24px;font-weight:800;color:#7a1c1c;border-top:1px dashed #d1d5db;padding-top:8px;margin-top:8px}
.ps-seg{display:flex;gap:6px;flex-wrap:wrap}.ps-seg button{font:inherit;font-size:13px;font-weight:700;border:1px solid #d1d5db;background:#fff;border-radius:999px;padding:6px 14px;cursor:pointer;color:#3b0d0d}.ps-seg button.on{background:#7a1c1c;border-color:#7a1c1c;color:#fff}
.ps-links{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.ps-links a{font-size:13px;font-weight:700;text-decoration:none;color:#7a1c1c;border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:7px 14px}
.ps-links a:hover{background:#fff8f3;border-color:#fde68a}
.ps-bar{height:8px;border-radius:99px;background:#f1e7df;overflow:hidden;min-width:60px}.ps-bar i{display:block;height:100%;background:#7a1c1c}
`;