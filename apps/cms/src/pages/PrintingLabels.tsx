import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API, CSS, Notice, authHeader, failText, readJson, useFlash } from './DiscoverKit';
import { DateRangePicker, PDX_CSS, inr, ymd } from './PaymentCharts';
import { printHtml } from './sankalpaForm';

// Printing Labels: corpus labels and subscription labels (75 x 38 mm stickers) and the A5 renewal notice.
// Each can be printed one to a page (label printer / A5 sheet) or 12 to an A4 sticker sheet (2 across, 6 down).
// The people come from the registers API: .../api/v1/registers/admin/labels/corpus and .../labels/subscription.
const API_BASE = String(API).replace(/\/discover\/?$/, '');

type Mode = 'corpus' | 'subscription' | 'renewal';
type Layout = 'single' | 'sheet';
type Row = {
  key: string; source: 'online' | 'manual'; devotee_id: string; name: string; phone: string; email: string; address: string[];
  item: string; category: string; amount: number; receipt_no: string; date: string; valid_from: string; valid_to: string; months: number | null; membership: string;
};
type Result = { total: number; capped: boolean; limit: number; warning?: string; items: Row[] };
type Sheet = { left: number; top: number; gapX: number; gapY: number; skip: number };
type Notice5 = { heading: string; title: string; body: string; footer: string };

const LABEL_W = 75, LABEL_H = 38, COLS = 2, ROWS = 6, PER_SHEET = COLS * ROWS;
// A 2 x 6 block of 75 x 38 labels on A4 (210 x 297): centred, no gaps. Real sticker sheets differ a little, so every value can be changed and is remembered.
const SHEET_DEFAULT: Sheet = { left: 30, top: 34.5, gapX: 0, gapY: 0, skip: 0 };
const NOTICE_DEFAULT: Notice5 = {
  heading: 'Adhi Guru Sri Pragna Dakshinamurthy Vidyapeetham',
  title: 'Subscription renewal',
  body: 'Dear {name},\n\nNamaskaram. Your subscription ({membership}) {validity}.\n\nWe request you to renew it so that you continue to receive the magazine without a break. You can renew on our website or at the ashram office, quoting your devotee ID {id}.\n\nWith blessings,',
  footer: 'Office, Vedaneri Ashram',
};
const SAVE_KEY = 'vedaneri.labels.v1';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const dmy = (d: string) => (/^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d);
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const num = (v: string, fallback: number, min: number, max: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };

function rangeFor(id: string): { from: string; to: string } {
  const now = new Date();
  switch (id) {
    case 'today': return { from: ymd(now), to: ymd(now) };
    case 'next30': return { from: ymd(now), to: ymd(addDays(30)) };
    case 'month': return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case 'last30': return { from: ymd(addDays(-29)), to: ymd(now) };
    case 'year': return { from: ymd(new Date(now.getFullYear(), 0, 1)), to: ymd(new Date(now.getFullYear(), 11, 31)) };
    default: return { from: '', to: '' };
  }
}

function validity(r: Row): string {
  if (!r.valid_to) return 'is due for renewal';
  const end = new Date(`${r.valid_to.slice(0, 10)}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return end < today ? `ended on ${dmy(r.valid_to)}` : `ends on ${dmy(r.valid_to)}`;
}
const fill = (t: string, r: Row) => t
  .replace(/\{name\}/g, r.name || 'Devotee').replace(/\{id\}/g, r.devotee_id).replace(/\{membership\}/g, r.membership ? r.membership.toLowerCase() : 'magazine')
  .replace(/\{from\}/g, dmy(r.valid_from)).replace(/\{to\}/g, dmy(r.valid_to)).replace(/\{validity\}/g, validity(r)).replace(/\{amount\}/g, r.amount ? inr(r.amount) : '');

// ---- label faces ----
const addressBlock = (r: Row) => r.address.length ? r.address.map((l) => esc(l)).join('<br>') : '<i class="none">Address not on record</i>';
function corpusFace(r: Row): string {
  const what = [r.item, r.amount ? inr(r.amount) : ''].filter(Boolean).join(' - ');
  return `<div class="top"><b class="id">${esc(r.devotee_id)}</b><span class="rc">${esc(r.receipt_no)}${r.date ? ` | ${esc(dmy(r.date))}` : ''}</span></div>
<div class="nm">${esc(r.name)}</div><div class="ad">${addressBlock(r)}</div>
<div class="ct">${esc(r.phone)}${r.phone && r.email ? ' | ' : ''}${esc(r.email)}</div>
<div class="cp">${esc(what)}</div>`;
}
function subscriptionFace(r: Row): string {
  const span = r.valid_from || r.valid_to ? `${dmy(r.valid_from) || '...'} to ${dmy(r.valid_to) || '...'}` : '';
  const what = [r.membership ? r.membership.charAt(0) + r.membership.slice(1).toLowerCase() : '', span].filter(Boolean).join(' | ');
  return `<div class="top"><b class="id">${esc(r.devotee_id)}</b><span class="rc">${esc(r.receipt_no)}</span></div>
<div class="nm">${esc(r.name)}</div><div class="ad">${addressBlock(r)}</div>
<div class="ct">${esc(r.phone)}${r.phone && r.email ? ' | ' : ''}${esc(r.email)}</div>
<div class="cp">${esc(what)}</div>`;
}
// The address label that goes on the envelope with an A5 notice
function envelopeFace(r: Row): string {
  return `<div class="top"><b class="id">${esc(r.devotee_id)}</b></div><div class="nm big">${esc(r.name)}</div><div class="ad big">${addressBlock(r)}</div><div class="ct">${esc(r.phone)}</div>`;
}
function noticePage(r: Row, n: Notice5): string {
  const paras = fill(n.body, r).split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<section class="a5"><div class="hd">${esc(n.heading)}</div><div class="tt">${esc(n.title)}</div>
<div class="to"><b>${esc(r.name)}</b><br>${addressBlock(r)}${r.phone ? `<br>${esc(r.phone)}` : ''}</div>
<div class="meta">Devotee ID: <b>${esc(r.devotee_id)}</b>${r.valid_to ? ` &nbsp;|&nbsp; Valid till: <b>${esc(dmy(r.valid_to))}</b>` : ''}${r.receipt_no ? ` &nbsp;|&nbsp; Last receipt: ${esc(r.receipt_no)}` : ''}</div>
<div class="bd">${paras}</div><div class="ft">${esc(n.footer)}</div></section>`;
}

const FONT = '"Noto Sans Tamil","Latha","Nirmala UI","Tamil Sangam MN",Arial,sans-serif';
const LABEL_CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:${FONT};color:#111;background:#fff}
.lb{width:${LABEL_W}mm;height:${LABEL_H}mm;padding:2.2mm 3mm;overflow:hidden;font-size:7.6pt;line-height:1.22;position:relative}
.lb .top{display:flex;justify-content:space-between;align-items:baseline;gap:2mm;border-bottom:.2mm solid #999;padding-bottom:.4mm;margin-bottom:.6mm}
.lb .id{font-size:8pt;white-space:nowrap}.lb .rc{font-size:6.2pt;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lb .nm{font-weight:700;font-size:9pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lb .ad{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;font-size:7.6pt}
.lb .ct{font-size:7pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.4mm}
.lb .cp{position:absolute;left:3mm;right:3mm;bottom:1.6mm;font-size:6.6pt;font-weight:700;border-top:.2mm solid #999;padding-top:.3mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lb .big.nm{font-size:10pt}.lb .big.ad{font-size:8.6pt;-webkit-line-clamp:5}
.none{color:#888}
.a5{width:148mm;height:210mm;padding:14mm 14mm 12mm;font-size:11.5pt;line-height:1.45;position:relative;overflow:hidden;page-break-after:always;break-after:page}
.a5 .hd{text-align:center;font-weight:700;font-size:15pt;color:#7a1c1c;border-bottom:.5mm solid #e2552b;padding-bottom:3mm}
.a5 .tt{text-align:center;font-weight:700;font-size:13pt;margin:4mm 0 6mm;letter-spacing:.3mm}
.a5 .to{margin-bottom:4mm;font-size:11.5pt}.a5 .meta{font-size:10pt;color:#333;border:.3mm solid #bbb;padding:2mm 3mm;margin-bottom:5mm}
.a5 .bd p{margin:0 0 3.5mm}.a5 .ft{position:absolute;left:14mm;right:14mm;bottom:12mm;font-weight:700}
`;

function sheetHtml(mode: Mode, layout: Layout, rows: Row[], sheet: Sheet, notice: Notice5, screen: boolean): string {
  const face = mode === 'corpus' ? corpusFace : mode === 'subscription' ? subscriptionFace : envelopeFace;
  const cell = (r: Row | null) => `<div class="lb">${r ? face(r) : ''}</div>`;
  let body = '', page = '@page{margin:0;size:75mm 38mm}';
  if (mode === 'renewal' && layout === 'single') {
    page = '@page{margin:0;size:A5 portrait}';
    body = rows.map((r) => noticePage(r, notice)).join('');
  } else if (layout === 'single') {
    body = rows.map((r) => `<div class="one">${cell(r)}</div>`).join('');
  } else {
    // Labels already used on a part-used sheet are skipped by leaving their places empty
    const slots: (Row | null)[] = [...Array(Math.max(0, Math.min(PER_SHEET - 1, sheet.skip))).fill(null), ...rows];
    const pages: string[] = [];
    for (let i = 0; i < slots.length; i += PER_SHEET) {
      const cells = Array.from({ length: PER_SHEET }, (_, k) => cell(slots[i + k] ?? null)).join('');
      pages.push(`<section class="pg"><div class="gr">${cells}</div></section>`);
    }
    page = '@page{margin:0;size:A4 portrait}';
    body = pages.join('');
  }
  const layoutCss = `
.one{width:${LABEL_W}mm;height:${LABEL_H}mm;page-break-after:always;break-after:page;overflow:hidden}.one:last-child{page-break-after:auto;break-after:auto}
.pg{width:210mm;height:297mm;position:relative;page-break-after:always;break-after:page;overflow:hidden}.pg:last-child{page-break-after:auto;break-after:auto}
.gr{position:absolute;left:${sheet.left}mm;top:${sheet.top}mm;display:grid;grid-template-columns:repeat(${COLS},${LABEL_W}mm);grid-auto-rows:${LABEL_H}mm;column-gap:${sheet.gapX}mm;row-gap:${sheet.gapY}mm}`;
  const screenCss = screen ? `
body{background:#e5e7eb;padding:10px;zoom:.62}
.one,.pg,.a5{background:#fff;margin:0 auto 12px;box-shadow:0 1px 4px rgba(0,0,0,.25);page-break-after:auto;break-after:auto}
.lb{outline:.2mm dashed #cbd5e1}` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>${page}${LABEL_CSS}${layoutCss}${screenCss}</style></head><body>${body}</body></html>`;
}

const LABEL_CSS_UI = `
.pl-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
.pl-tab{font:inherit;text-align:left;cursor:pointer;border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:10px 16px;min-width:210px;color:#3b0d0d}
.pl-tab b{display:block;font-size:14px}.pl-tab span{display:block;font-size:12px;color:#6b7280;margin-top:2px}
.pl-tab.on{border-color:#7a1c1c;background:#fff5f2;box-shadow:inset 0 0 0 1px #7a1c1c}
.pl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:12px}
.pl-grid .pdx-inp{width:100%}
.pl-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}
@media(max-width:1000px){.pl-two{grid-template-columns:1fr}}
.pl-choice{display:flex;gap:8px;flex-wrap:wrap}
.pl-opt{font:inherit;cursor:pointer;border:1px solid #d1d5db;background:#fff;border-radius:12px;padding:8px 12px;text-align:left;color:#3b0d0d}
.pl-opt b{display:block;font-size:13px}.pl-opt span{font-size:11.5px;color:#6b7280}
.pl-opt.on{border-color:#7a1c1c;background:#fff5f2}
.pl-list{max-height:430px;overflow:auto;border:1px solid #eee;border-radius:12px}
.pl-list table{width:100%;border-collapse:collapse;font-size:13px}
.pl-list th{position:sticky;top:0;background:#faf5f0;text-align:left;font-size:11.5px;padding:7px 8px;border-bottom:1px solid #eee;z-index:1}
.pl-list td{padding:6px 8px;border-bottom:1px solid #f3f4f6;vertical-align:top}
.pl-list tr.off td{opacity:.45}
.pl-pill{font-size:10.5px;font-weight:700;border-radius:999px;padding:1px 7px;background:#dbeafe;color:#1d4ed8;margin-left:6px}
.pl-prev{width:100%;height:470px;border:1px solid #e5e7eb;border-radius:12px;background:#e5e7eb}
.pl-small{font-size:12px;color:#6b7280}
.pl-ta{width:100%;font:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:10px;padding:8px 10px;min-height:150px;resize:vertical}
`;

export default function PrintingLabels() {
  const { notice, flash, clear } = useFlash();
  const saved = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); } catch { return {}; }
  }, []);
  const [mode, setMode] = useState<Mode>('corpus');
  const [layout, setLayout] = useState<Layout>(saved.layout === 'single' ? 'single' : 'sheet');
  const [sheet, setSheet] = useState<Sheet>({ ...SHEET_DEFAULT, ...(saved.sheet || {}), skip: 0 });
  const [notice5, setNotice5] = useState<Notice5>({ ...NOTICE_DEFAULT, ...(saved.notice || {}) });
  const first = rangeFor('month');
  const [from, setFrom] = useState(first.from);
  const [to, setTo] = useState(first.to);
  const [preset, setPreset] = useState('month');
  const [basis, setBasis] = useState<'paid' | 'end'>('paid');
  const [membership, setMembership] = useState('');
  const [status, setStatus] = useState('PAID');
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ layout, sheet: { ...sheet, skip: 0 }, notice: notice5 })); } catch { /* storage not available */ }
  }, [layout, sheet, notice5]);

  // Renewal notices are for subscriptions that end soon; labels are for what was registered in the period
  const pick = (m: Mode) => {
    setMode(m); setData(null); setOff(new Set());
    if (m === 'renewal') { const r = rangeFor('next30'); setBasis('end'); setFrom(r.from); setTo(r.to); setPreset('next30'); setMembership('ACTIVE'); }
    else { const r = rangeFor('month'); setBasis('paid'); setFrom(r.from); setTo(r.to); setPreset('month'); setMembership(''); }
  };
  const choose = (id: string) => { const r = rangeFor(id); setPreset(id); setFrom(r.from); setTo(r.to); };

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setErr('');
    try {
      const p = new URLSearchParams();
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      if (status) p.set('status', status);
      if (q.trim()) p.set('q', q.trim());
      if (mode === 'corpus' && source) p.set('source', source);
      if (mode !== 'corpus') { p.set('basis', basis); if (membership) p.set('membership', membership); }
      const res = await fetch(`${API_BASE}/registers/admin/labels/${mode === 'corpus' ? 'corpus' : 'subscription'}?${p}`, { headers: authHeader(), cache: 'no-store' });
      const j = await readJson(res);
      if (mine !== seq.current) return;
      if (!res.ok) throw new Error(failText(j, `Could not load the people (${res.status}).`));
      setData(j as Result); setOff(new Set());
    } catch (e: any) {
      if (mine === seq.current) { setErr(e?.message || 'Could not load the people.'); setData(null); }
    } finally { if (mine === seq.current) setLoading(false); }
  }, [mode, from, to, status, q, source, basis, membership]);

  useEffect(() => { const t = setTimeout(load, q ? 350 : 0); return () => clearTimeout(t); }, [load, q]);

  const items = data?.items || [];
  const chosen = useMemo(() => items.filter((r) => !off.has(r.key)), [items, off]);
  const pages = layout === 'sheet' ? Math.ceil((chosen.length + Math.min(PER_SHEET - 1, sheet.skip)) / PER_SHEET) : chosen.length;
  const noAddress = chosen.filter((r) => !r.address.length).length;
  const toggle = (k: string) => setOff((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const previewHtml = useMemo(() => sheetHtml(mode, layout, chosen.slice(0, layout === 'sheet' ? PER_SHEET : 3), sheet, notice5, true), [mode, layout, chosen, sheet, notice5]);
  const print = () => {
    if (!chosen.length) return;
    if (!printHtml(sheetHtml(mode, layout, chosen, sheet, notice5, false))) flash('err', 'The page could not be prepared for printing.');
  };

  const modes: [Mode, string, string][] = [
    ['corpus', 'Corpus labels', '75 x 38 mm sticker'],
    ['subscription', 'Subscription labels', '75 x 38 mm sticker'],
    ['renewal', 'Renewal notice', 'A5 page, or the 12-up address labels'],
  ];
  const presets: [string, string][] = mode === 'renewal'
    ? [['today', 'Today'], ['next30', 'Next 30 days'], ['month', 'This month'], ['year', 'This year'], ['all', 'All time']]
    : [['today', 'Today'], ['month', 'This month'], ['last30', 'Last 30 days'], ['year', 'This year'], ['all', 'All time']];
  const single = mode === 'renewal' ? ['One A5 notice per page', 'Each person gets one A5 notice'] : ['One label per sticker', 'For a label printer or a roll: 75 x 38 mm pages'];
  const multi = mode === 'renewal' ? ['12 address labels per A4 sheet', 'The envelope labels for the notices'] : ['12 labels per A4 sheet', '2 across x 6 down'];
  const setS = (k: keyof Sheet, v: string, min: number, max: number) => setSheet((s) => ({ ...s, [k]: num(v, s[k], min, max) }));

  return (
    <div className="dc">
      <style>{CSS}</style>
      <style>{PDX_CSS}</style>
      <style>{LABEL_CSS_UI}</style>
      <Notice notice={notice} onClear={clear} />
      <div className="pdx">
        <div className="pdx-top">
          <div>
            <h1 className="pdx-title">Printing Labels</h1>
            <p className="pdx-sub" style={{ fontSize: 14, maxWidth: 760 }}>Choose the dates, tick the people, and print. Corpus and subscription labels are 75 x 38 mm; the renewal notice is A5.</p>
          </div>
          <div className="pdx-row">
            <button type="button" className="pdx-btn on" onClick={print} disabled={loading || !chosen.length}>Print {chosen.length ? `${chosen.length} ${mode === 'renewal' && layout === 'single' ? 'notice' : 'label'}${chosen.length === 1 ? '' : 's'}` : ''}</button>
          </div>
        </div>

        <div className="pl-tabs" role="tablist" aria-label="What to print">
          {modes.map(([m, l, d]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className={`pl-tab${mode === m ? ' on' : ''}`} onClick={() => pick(m)}><b>{l}</b><span>{d}</span></button>
          ))}
        </div>

        <div className="pdx-card" style={{ marginBottom: 14 }}>
          <div className="pdx-tools">
            <div className="pdx-presets" role="group" aria-label="Period">
              {presets.map(([id, l]) => <button key={id} type="button" aria-pressed={preset === id} onClick={() => choose(id)}>{l}</button>)}
            </div>
            <DateRangePicker from={from} to={to} label="Dates" onChange={(f, t) => { setFrom(f); setTo(t); setPreset(f || t ? 'custom' : 'all'); }} />
          </div>
          <div className="pl-grid">
            {mode !== 'corpus' && (
              <div>
                <label className="pdx-lbl" htmlFor="pl-basis">Dates mean</label>
                <select id="pl-basis" className="pdx-inp" value={basis} onChange={(e) => setBasis(e.target.value as 'paid' | 'end')}>
                  <option value="paid">Registered / paid on</option><option value="end">Subscription ends on</option>
                </select>
              </div>
            )}
            {mode !== 'corpus' && (
              <div>
                <label className="pdx-lbl" htmlFor="pl-mem">Membership</label>
                <select id="pl-mem" className="pdx-inp" value={membership} onChange={(e) => setMembership(e.target.value)}>
                  <option value="">All</option><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option>
                </select>
              </div>
            )}
            {mode === 'corpus' && (
              <div>
                <label className="pdx-lbl" htmlFor="pl-src">Entry type</label>
                <select id="pl-src" className="pdx-inp" value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="">Online and offline</option><option value="online">Online</option><option value="manual">Offline (on-site)</option>
                </select>
              </div>
            )}
            <div>
              <label className="pdx-lbl" htmlFor="pl-st">Payment</label>
              <select id="pl-st" className="pdx-inp" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="PAID">Paid</option><option value="">All</option><option value="PENDING">Pending</option>
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="pl-q">Search</label>
              <input id="pl-q" className="pdx-inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, mobile, ID, city" autoComplete="off" />
            </div>
          </div>
        </div>

        {err && <div className="pdx-card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b', marginBottom: 14 }}>{err} <button type="button" className="pdx-btn" onClick={load}>Try again</button></div>}
        {data?.warning && <div className="pdx-card" style={{ background: '#fffbeb', borderColor: '#fde68a', marginBottom: 14, fontSize: 13 }}>{data.warning}</div>}
        {data?.capped && <div className="pdx-card" style={{ background: '#fffbeb', borderColor: '#fde68a', marginBottom: 14, fontSize: 13 }}>Only the first {data.limit} people are shown. Narrow the dates to print the rest.</div>}

        <div className="pl-two">
          <div className="pdx-card">
            <div className="pdx-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <b style={{ fontSize: 14 }}>{loading ? 'Loading...' : `${chosen.length} of ${items.length} selected`}</b>
              <span className="pdx-row">
                <button type="button" className="pdx-btn" onClick={() => setOff(new Set())} disabled={!items.length}>Select all</button>
                <button type="button" className="pdx-btn" onClick={() => setOff(new Set(items.map((r) => r.key)))} disabled={!items.length}>Clear</button>
              </span>
            </div>
            {noAddress > 0 && <p className="pl-small" style={{ margin: '0 0 8px', color: '#b45309' }}>{noAddress} selected {noAddress === 1 ? 'person has' : 'people have'} no address on record; the label will say so.</p>}
            <div className="pl-list">
              <table>
                <thead><tr><th style={{ width: 28 }} /><th>ID</th><th>Name</th><th>{mode === 'corpus' ? 'Corpus' : 'Subscription'}</th><th>Address</th></tr></thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.key} className={off.has(r.key) ? 'off' : ''}>
                      <td><input type="checkbox" checked={!off.has(r.key)} onChange={() => toggle(r.key)} aria-label={`Print for ${r.name}`} /></td>
                      <td>{r.devotee_id}</td>
                      <td>{r.name}{r.source === 'manual' && <span className="pl-pill">On-site</span>}<div className="pl-small">{r.phone}</div></td>
                      <td>{mode === 'corpus' ? <>{r.item}<div className="pl-small">{r.amount ? inr(r.amount) : ''} {r.date && `| ${dmy(r.date)}`}</div></> : <>{r.membership}<div className="pl-small">{dmy(r.valid_from)} to {dmy(r.valid_to)}</div></>}</td>
                      <td className="pl-small">{r.address.join(', ') || '-'}</td>
                    </tr>
                  ))}
                  {!loading && !items.length && !err && <tr><td colSpan={5} style={{ padding: 22, textAlign: 'center', color: '#6b7280' }}>No one found for these dates. Try a wider period or set Payment to All.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pdx-card">
            <b style={{ fontSize: 14 }}>How to print</b>
            <div className="pl-choice" style={{ margin: '8px 0 12px' }} role="group" aria-label="Print type">
              <button type="button" className={`pl-opt${layout === 'single' ? ' on' : ''}`} aria-pressed={layout === 'single'} onClick={() => setLayout('single')}><b>{single[0]}</b><span>{single[1]}</span></button>
              <button type="button" className={`pl-opt${layout === 'sheet' ? ' on' : ''}`} aria-pressed={layout === 'sheet'} onClick={() => setLayout('sheet')}><b>{multi[0]}</b><span>{multi[1]}</span></button>
            </div>
            {layout === 'sheet' && (
              <details style={{ marginBottom: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Sheet position (mm) - {pages} sheet{pages === 1 ? '' : 's'}</summary>
                <div className="pl-grid">
                  <div><label className="pdx-lbl" htmlFor="pl-l">Left margin</label><input id="pl-l" className="pdx-inp" type="number" step="0.5" value={sheet.left} onChange={(e) => setS('left', e.target.value, 0, 100)} /></div>
                  <div><label className="pdx-lbl" htmlFor="pl-t">Top margin</label><input id="pl-t" className="pdx-inp" type="number" step="0.5" value={sheet.top} onChange={(e) => setS('top', e.target.value, 0, 150)} /></div>
                  <div><label className="pdx-lbl" htmlFor="pl-gx">Gap across</label><input id="pl-gx" className="pdx-inp" type="number" step="0.5" value={sheet.gapX} onChange={(e) => setS('gapX', e.target.value, 0, 20)} /></div>
                  <div><label className="pdx-lbl" htmlFor="pl-gy">Gap down</label><input id="pl-gy" className="pdx-inp" type="number" step="0.5" value={sheet.gapY} onChange={(e) => setS('gapY', e.target.value, 0, 20)} /></div>
                  <div><label className="pdx-lbl" htmlFor="pl-sk">Labels already used</label><input id="pl-sk" className="pdx-inp" type="number" min={0} max={PER_SHEET - 1} value={sheet.skip} onChange={(e) => setS('skip', e.target.value, 0, PER_SHEET - 1)} /></div>
                </div>
                <p className="pl-small" style={{ margin: '8px 0 0' }}>Print one test sheet on plain paper and hold it against a sticker sheet. If it is off, change the margins here; they are remembered. Print at 100% / Actual size, with margins set to None.</p>
              </details>
            )}
            {mode === 'renewal' && layout === 'single' && (
              <details style={{ marginBottom: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Notice wording</summary>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  <input className="pdx-inp" aria-label="Heading" value={notice5.heading} onChange={(e) => setNotice5({ ...notice5, heading: e.target.value })} />
                  <input className="pdx-inp" aria-label="Title" value={notice5.title} onChange={(e) => setNotice5({ ...notice5, title: e.target.value })} />
                  <textarea className="pl-ta" aria-label="Message" value={notice5.body} onChange={(e) => setNotice5({ ...notice5, body: e.target.value })} />
                  <input className="pdx-inp" aria-label="Signed by" value={notice5.footer} onChange={(e) => setNotice5({ ...notice5, footer: e.target.value })} />
                  <span className="pl-small">In the message you can use {'{name} {id} {membership} {from} {to} {validity} {amount}'}; they are filled in for each person. A blank line starts a new paragraph.</span>
                  <button type="button" className="pdx-btn" onClick={() => setNotice5(NOTICE_DEFAULT)}>Restore the standard wording</button>
                </div>
              </details>
            )}
            <b style={{ fontSize: 14 }}>Preview</b>
            <span className="pl-small"> {layout === 'sheet' ? '(first sheet)' : '(first few)'}</span>
            <iframe title="Label preview" className="pl-prev" srcDoc={previewHtml} style={{ marginTop: 8 }} />
          </div>
        </div>
      </div>
    </div>
  );
}