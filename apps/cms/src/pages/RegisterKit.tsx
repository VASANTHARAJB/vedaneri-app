import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API, CSS, Notice, authHeader, failText, readJson, useFlash } from './DiscoverKit';
import { DateRangePicker, PDX_CSS, inr, ymd } from './PaymentCharts';
import ManualEntryForm, { PAY_LABEL, formFromEntry } from './ManualEntryForm';
import type { ManualEntry } from './ManualEntryForm';
import { printForms, printHtml } from './sankalpaForm';
import type { FormData } from './sankalpaForm';

// The Seva, Donation, Magazine and Camp registers share this page. API points at .../api/v1/discover,
// and the registers API is .../api/v1/registers/admin/seva and .../api/v1/registers/admin/donation
const API_BASE = String(API).replace(/\/discover\/?$/, '');

type Kind = 'seva' | 'donation' | 'magazine' | 'camp';
type Basis = 'event' | 'paid' | 'end';
type Member = {
  title: string; name: string; relation: string; place?: string; gothram: string; nakshathiram: string; rasi: string; dob: string;
  extra: { label: string; value: string }[]; from_profile: boolean;
};
type Entry = {
  id: number; devotee_id: string; name: string; email: string | null; phone: string | null; city: string | null; state: string | null;
  item: string; category: string; amount: number; currency: string; status: 'PAID' | 'PENDING' | 'FAILED' | 'FREE' | 'CANCELLED';
  source?: 'online' | 'manual'; entry_date?: string | null;
  event_date: string | null; end_date: string | null; receipt_no: string | null; paid_at: string | null; members: Member[]; details: { label: string; value: string }[];
  address: string | null; pincode: string | null; months: number | null; membership: string | null; mode: string | null; adults: number | null; children: number | null;
};
type Summary = { entries: number; paidEntries: number; paidAmount: number; pendingEntries: number; failedEntries: number; freeEntries: number; cancelledEntries?: number; people: number; complete: number; withDob: number; capped: boolean; extra: Record<string, number> };
type ListResponse = { total: number; page: number; limit: number; summary: Summary; items: Entry[]; warning?: string; manualReady?: boolean };
type Options = { items: string[]; categories: string[]; dobKept: { family: boolean; devotee: boolean }; hasEventDate: boolean; hasEndDate: boolean; peopleList: boolean };
type RPreset = 'today' | 'next7' | 'next30' | 'month' | 'last30' | 'year' | 'all' | 'custom';

type Cfg = {
  title: string; itemLabel: string; categoryLabel: string; file: string; sub: string; search: string;
  presets: [RPreset, string][]; defaultPreset: RPreset; sorts: [string, string][]; defaultSort: string;
  categories: [string, string][]; basis: [Basis, string][]; defaultBasis: Basis; statuses: [string, string][]; defaultStatus: string; people: boolean;
};
const PAID_STATUSES: [string, string][] = [['PAID', 'Paid'], ['', 'All'], ['PENDING', 'Pending'], ['FAILED', 'Failed']];
// Seva and donation also hold on-site entries, which can be cancelled
const SD_STATUSES: [string, string][] = [...PAID_STATUSES, ['CANCELLED', 'Cancelled']];
const CONFIG: Record<Kind, Cfg> = {
  seva: {
    title: 'Seva register', itemLabel: 'Seva', categoryLabel: 'Category', file: 'seva-register', search: 'Name, phone, receipt, gothram, nakshatram...',
    sub: 'Every seva booking with the devotee, the receipt and everyone the sankalpam is made for: name, gothram, nakshatram, rasi and date of birth.',
    presets: [['today', 'Today'], ['next7', 'Next 7 days'], ['next30', 'Next 30 days'], ['month', 'This month'], ['last30', 'Last 30 days'], ['year', 'This year'], ['all', 'All time']], defaultPreset: 'month',
    sorts: [['event', 'Seva date, soonest first'], ['event_desc', 'Seva date, latest first'], ['date', 'Paid, newest first'], ['oldest', 'Paid, oldest first'], ['amount_desc', 'Highest amount'], ['name', 'Devotee name A-Z']], defaultSort: 'event',
    categories: [['seva', 'Seva'], ['corpus', 'Corpus']], basis: [['event', 'Seva date'], ['paid', 'Payment date']], defaultBasis: 'event', statuses: SD_STATUSES, defaultStatus: 'PAID', people: true,
  },
  donation: {
    title: 'Donation register', itemLabel: 'Fund', categoryLabel: 'Category', file: 'donation-register', search: 'Name, phone, receipt, gothram, nakshatram...',
    sub: 'Every donation and corpus gift with the donor, the receipt and everyone the sankalpam is made for: name, gothram, nakshatram, rasi and date of birth.',
    presets: [['today', 'Today'], ['month', 'This month'], ['last30', 'Last 30 days'], ['year', 'This year'], ['all', 'All time']], defaultPreset: 'month',
    sorts: [['date', 'Newest first'], ['oldest', 'Oldest first'], ['amount_desc', 'Highest amount'], ['name', 'Donor name A-Z']], defaultSort: 'date',
    categories: [], basis: [['paid', 'Payment date']], defaultBasis: 'paid', statuses: SD_STATUSES, defaultStatus: 'PAID', people: true,
  },
  magazine: {
    title: 'Magazine register', itemLabel: 'Plan', categoryLabel: 'Delivery', file: 'magazine-register', search: 'Name, phone, receipt, address, pincode...',
    sub: 'Every magazine subscription with the subscriber, the postal address, the plan, how it is delivered and the dates it runs.',
    presets: [['next30', 'Next 30 days'], ['month', 'This month'], ['last30', 'Last 30 days'], ['year', 'This year'], ['all', 'All time']], defaultPreset: 'all',
    sorts: [['date', 'Newest first'], ['ending', 'Ending soonest'], ['start', 'Latest start'], ['oldest', 'Oldest first'], ['amount_desc', 'Highest amount'], ['name', 'Subscriber name A-Z']], defaultSort: 'date',
    categories: [['print', 'Print'], ['digital', 'Digital'], ['both', 'Print and digital']], basis: [['paid', 'Payment date'], ['event', 'Starts on'], ['end', 'Ends on']], defaultBasis: 'paid', statuses: PAID_STATUSES, defaultStatus: 'PAID', people: false,
  },
  camp: {
    title: 'Camp register', itemLabel: 'Camp', categoryLabel: 'Registration', file: 'camp-register', search: 'Name, phone, email, camp, attendee name...',
    sub: 'Every camp registration with the registrant, the number of adults and children, the payment and the people named for the camp.',
    presets: [['next30', 'Next 30 days'], ['month', 'This month'], ['year', 'This year'], ['all', 'All time']], defaultPreset: 'all',
    sorts: [['date', 'Newest first'], ['event', 'Camp date, soonest first'], ['oldest', 'Oldest first'], ['amount_desc', 'Highest amount'], ['name', 'Name A-Z']], defaultSort: 'date',
    categories: [], basis: [['paid', 'Registration date'], ['event', 'Camp starts'], ['end', 'Camp ends']], defaultBasis: 'paid',
    statuses: [['', 'All'], ['PAID', 'Paid'], ['FREE', 'No fee'], ['PENDING', 'Pending'], ['FAILED', 'Failed']], defaultStatus: '', people: true,
  },
};

const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
function rangeFor(id: RPreset): { from: string; to: string } {
  const now = new Date();
  switch (id) {
    case 'today': return { from: ymd(now), to: ymd(now) };
    case 'next7': return { from: ymd(now), to: ymd(addDays(7)) };
    case 'next30': return { from: ymd(now), to: ymd(addDays(30)) };
    case 'month': return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case 'last30': return { from: ymd(addDays(-29)), to: ymd(now) };
    case 'year': return { from: ymd(new Date(now.getFullYear(), 0, 1)), to: ymd(new Date(now.getFullYear(), 11, 31)) };
    default: return { from: '', to: '' };
  }
}

const STATUS_LABEL: Record<string, string> = { PAID: 'Paid', PENDING: 'Pending', FAILED: 'Failed', FREE: 'No fee', CANCELLED: 'Cancelled' };
const STATUS_COLOR: Record<string, string> = { PAID: '#15803d', PENDING: '#b45309', FAILED: '#b91c1c', FREE: '#64748b', CANCELLED: '#64748b' };
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const fmtDay = (d: string | null) => (d && ISO_DAY.test(d.slice(0, 10)) ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const fmtStamp = (iso: string | null) => (iso && !Number.isNaN(new Date(iso).getTime()) ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const titleCase = (c: string) => c.replace(/[-_]+/g, ' ').toLowerCase().replace(/^./, (x) => x.toUpperCase());

// A date of birth is shown as "09 Mar 1982 (age 44)"; text that is not a date is shown as it was written
function ageOf(iso: string): number | null {
  const [y, m, d] = iso.split('-').map(Number);
  const n = new Date();
  let a = n.getFullYear() - y;
  if (n.getMonth() + 1 < m || (n.getMonth() + 1 === m && n.getDate() < d)) a--;
  return a >= 0 && a <= 120 ? a : null;
}
function dobText(v: string): string {
  if (!v) return '';
  if (!ISO_DAY.test(v)) return v;
  const age = ageOf(v);
  return `${fmtDay(v)}${age == null ? '' : ` (age ${age})`}`;
}
const personName = (m: Member) => [m.title, m.name].filter(Boolean).join(' ') || 'Name not given';
const place = (e: Entry) => [e.city, e.state].filter(Boolean).join(', ');
const range = (a: string | null, b: string | null) => [fmtDay(a), fmtDay(b)].filter(Boolean).join(' to ');
// The facts that matter for the magazine and camp registers, shown on the screen and on paper
function factsOf(kind: Kind, e: Entry): [string, string][] {
  const out: [string, string][] = [];
  if (kind === 'magazine') {
    out.push(['Delivery', titleCase(e.category)]);
    if (e.months) out.push(['Plan length', `${e.months} month${e.months === 1 ? '' : 's'}`]);
    out.push(['Valid', range(e.event_date, e.end_date)]);
    out.push(['Payment', titleCase(e.mode || '')]);
    out.push(['Postal address', [e.address, e.city, e.state, e.pincode].filter(Boolean).join(', ')]);
  } else if (kind === 'camp') {
    out.push(['Camp dates', range(e.event_date, e.end_date)]);
    if (e.adults != null) out.push(['Adults', String(e.adults)]);
    if (e.children != null) out.push(['Children', String(e.children)]);
    out.push(['Registration', titleCase(e.category)]);
  } else if (e.source === 'manual') {
    out.push(['Entered', 'On-site at the ashram']);
    out.push(['Receipt date', fmtDay(e.entry_date || null)]);
    out.push(['Paid by', e.mode ? PAY_LABEL[e.mode] || titleCase(e.mode) : '']);
    out.push(['Address', [e.address, e.city, e.state, e.pincode].filter(Boolean).join(', ')]);
    if (e.email) out.push(['Email', e.email]);
  }
  return out.filter(([, v]) => v);
}
// The printed Sankalpa form of any seva or donation entry
function formOfEntry(e: Entry): FormData {
  return {
    name: e.name || '', address: [e.address, e.city, e.state, e.pincode].filter(Boolean).join(', '), phone: e.phone || '',
    amount: e.status === 'FREE' ? null : e.amount, receiptNo: e.receipt_no || '',
    date: e.entry_date || (e.paid_at ? e.paid_at.slice(0, 10) : ''), poojaDate: e.event_date || '', poojaDetails: e.item || '',
    people: e.members.map((m) => ({ name: m.name, place: m.place, gothram: m.gothram, nakshathiram: m.nakshathiram, rasi: m.rasi })),
  };
}
const amountText = (e: Entry) => (e.status === 'FREE' ? 'No fee' : inr(e.amount));
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const RG_CSS = `
.rg-stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));margin-bottom:14px}
.rg-stat{background:#fff;border:1px solid #eaecf0;border-radius:16px;padding:14px 16px;min-width:0}
.rg-stat b{display:block;font-size:26px;font-weight:800;letter-spacing:-.01em;margin-top:4px}
.rg-stat span{display:block;font-size:12px;color:#64748b;margin-top:2px}
.rg-lbl{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:700}
.rg-filters{display:grid;gap:12px}
.rg-grid{display:grid;gap:10px 12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))}
.rg-grid .pdx-inp{width:100%}
.rg-search{grid-column:span 2}
@media(max-width:560px){.rg-search{grid-column:auto}}
.rg-list{display:grid;gap:14px}
.rg-entry{background:#fff;border:1px solid #eaecf0;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(59,13,13,.04)}
.rg-head{display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:#fff8ec;border-bottom:1px solid #f3e3bd}
.rg-no{flex:none;min-width:34px;height:34px;border-radius:10px;background:#7a1c1c;color:#fff;font-weight:800;font-size:13px;display:inline-flex;align-items:center;justify-content:center;padding:0 6px}
.rg-main{flex:1;min-width:0}
.rg-t{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:16px;font-weight:800;color:#3b0d0d}
.rg-who{font-size:13px;color:#475569;margin-top:3px;word-break:break-word}
.rg-who a{color:#7a1c1c;font-weight:700;text-decoration:none}
.rg-side{text-align:right;flex:none;font-size:12px;color:#64748b}
.rg-amt{font-size:18px;font-weight:800;color:#3b0d0d}
.rg-body{padding:14px 16px}
.rg-notes{font-size:13px;color:#475569;margin:0 0 12px;display:flex;gap:6px 16px;flex-wrap:wrap}
.rg-notes b{color:#3b0d0d}
.rg-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:10px 18px;margin:0 0 4px}
.rg-facts dt{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:700}
.rg-facts dd{margin:2px 0 0;font-size:14px;color:#3b0d0d;word-break:break-word}
.rg-facts+.rg-people,.rg-notes+.rg-people{margin-top:12px}
.rg-people{list-style:none;margin:0;padding:0;display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr))}
.rg-p{border:1px solid #eaecf0;border-radius:14px;padding:12px 14px;background:#fff;min-width:0}
.rg-pn{font-weight:800;font-size:14.5px;color:#3b0d0d;word-break:break-word}
.rg-pr{display:inline-block;margin-left:6px;font-size:11px;font-weight:700;color:#7a1c1c;background:#fde68a;border-radius:999px;padding:1px 8px;vertical-align:1px}
.rg-p dl{display:grid;grid-template-columns:auto 1fr;gap:5px 10px;margin:10px 0 0;font-size:13px}
.rg-p dt{color:#64748b;font-weight:700}
.rg-p dd{margin:0;word-break:break-word;color:#3b0d0d}
.rg-miss{color:#b45309;font-style:italic}
.rg-src{margin-top:8px;font-size:11px;color:#64748b}
.rg-none{font-size:13px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px 12px}
.rg-info{background:#fffbeb;border:1px solid #fde68a;color:#78350f;border-radius:14px;padding:12px 16px;font-size:13.5px;margin-bottom:14px}
.rg-tabs{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));margin-bottom:14px}
.rg-tab{display:grid;gap:2px;text-align:left;background:#fff;border:1.5px solid #eaecf0;border-radius:14px;padding:12px 16px;cursor:pointer;font:inherit;color:#3b0d0d}
.rg-tab b{font-size:15px}.rg-tab span{font-size:12px;color:#64748b}
.rg-tab:hover{border-color:#d9b48a}
.rg-tab.on{background:#7a1c1c;border-color:#7a1c1c;color:#fff}.rg-tab.on span{color:#fde7c4}
.rg-tab.off.on{background:#1d4ed8;border-color:#1d4ed8}.rg-tab.off.on span{color:#dbeafe}
.rg-entry.off{border-color:#bfdbfe}
.rg-entry.off .rg-head{background:#eff6ff;border-bottom-color:#bfdbfe}
.rg-entry.off .rg-no{background:#1d4ed8}
.rg-offpill{background:#dbeafe;color:#1e3a8a}
.rg-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px dashed #eaecf0}
.rg-cancel{margin-top:12px;display:grid;gap:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px 14px}
.rg-pager{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:14px}
@media(max-width:560px){.rg-head{flex-wrap:wrap}.rg-side{text-align:left;width:100%}}
`;

export default function RegisterPage({ kind }: { kind: Kind }) {
  const cfg = CONFIG[kind];
  const BASE = `${API_BASE}/registers/admin/${kind}`;
  const { notice, flash, clear } = useFlash();
  const first = cfg.defaultPreset;
  const [preset, setPreset] = useState<RPreset>(first);
  const [from, setFrom] = useState(rangeFor(first).from);
  const [to, setTo] = useState(rangeFor(first).to);
  const [basis, setBasis] = useState<Basis>(cfg.defaultBasis);
  const [status, setStatus] = useState(cfg.defaultStatus);
  const [membership, setMembership] = useState('');
  const [item, setItem] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState(cfg.defaultSort);
  const [q, setQ] = useState('');
  const [qNow, setQNow] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [data, setData] = useState<ListResponse | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<'' | 'csv' | 'print'>('');
  const [source, setSource] = useState('');
  const [form, setForm] = useState<{ id: number | null } | null>(null);
  const [cancelFor, setCancelFor] = useState<{ id: number; reason: string; busy: boolean } | null>(null);
  const seq = useRef(0);
  const onsite = kind === 'seva' || kind === 'donation';

  // The search box waits a moment after typing before it asks the server
  useEffect(() => {
    const t = setTimeout(() => { setQNow(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  // Seva and fund names, and whether a date of birth is saved anywhere, are asked for once
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(`${BASE}/options`, { headers: authHeader(), cache: 'no-store' });
        const j = await readJson(res);
        if (live && res.ok) setOptions(j as Options);
      } catch { /* the filters simply stay empty */ }
    })();
    return () => { live = false; };
  }, [BASE]);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (cfg.basis.length > 1) p.set('basis', basis);
    if (membership) p.set('membership', membership);
    if (status) p.set('status', status);
    if (item) p.set('item', item);
    if (category) p.set('category', category);
    if (source && onsite) p.set('source', source);
    if (qNow) p.set('q', qNow);
    p.set('sort', sort);
    return p;
  }, [from, to, basis, membership, status, item, category, source, onsite, qNow, sort, cfg]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setErr('');
    try {
      const p = qs(); p.set('page', String(page)); p.set('limit', String(limit));
      const res = await fetch(`${BASE}/list?${p}`, { headers: authHeader(), cache: 'no-store' });
      const j = await readJson(res);
      if (mine !== seq.current) return;
      if (!res.ok) throw new Error(failText(j, `Could not load the register (${res.status}).`));
      setData(j as ListResponse);
    } catch (e: any) {
      if (mine === seq.current) { setErr(e?.message || 'Could not load the register.'); setData(null); }
    } finally { if (mine === seq.current) setLoading(false); }
  }, [qs, page, limit, BASE]);
  useEffect(() => { load(); }, [load]);

  const choose = (id: RPreset) => { const r = rangeFor(id); setPreset(id); setFrom(r.from); setTo(r.to); setPage(1); };
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  // A saved on-site entry was returned by the form: refresh the list, and print the Sankalpa form when asked
  async function saved(r: { id: number; receipt_no: string; edited: boolean; print: boolean }) {
    setForm(null);
    flash('ok', `${r.edited ? 'Changes saved' : 'Entry saved'}. Receipt ${r.receipt_no}.`);
    if (r.print) {
      try {
        const res = await fetch(`${BASE}/manual/${r.id}`, { headers: authHeader(), cache: 'no-store' });
        const j = await readJson(res);
        if (!res.ok) flash('err', failText(j, 'Saved, but the form could not be prepared for printing.'));
        else if (!(await printForms([formFromEntry(j as ManualEntry)]))) flash('err', 'Saved, but the form could not be prepared for printing. Use "Print sankalpa form" on the entry.');
      } catch { flash('err', 'Saved, but the form could not be prepared for printing.'); }
    }
    load();
  }

  async function printForm(e: Entry) {
    if (!(await printForms([formOfEntry(e)]))) flash('err', 'The form could not be prepared for printing. Please try again.');
  }

  async function cancelEntry() {
    if (!cancelFor) return;
    setCancelFor({ ...cancelFor, busy: true });
    try {
      const res = await fetch(`${BASE}/manual/${cancelFor.id}/cancel`, {
        method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: cancelFor.reason }),
      });
      const j = await readJson(res);
      if (!res.ok) { flash('err', failText(j, 'Could not cancel the entry.')); setCancelFor({ ...cancelFor, busy: false }); return; }
      setCancelFor(null);
      flash('ok', 'The entry is cancelled. Its receipt number stays on the register.');
      load();
    } catch { flash('err', 'Network error. Please try again.'); setCancelFor({ ...cancelFor, busy: false }); }
  }

  async function download() {
    setBusy('csv');
    try {
      const res = await fetch(`${BASE}/export?${qs()}`, { headers: authHeader() });
      if (!res.ok) { flash('err', failText(await readJson(res), 'Could not make the file.')); return; }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `${cfg.file}-${ymd(new Date())}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy(''); }
  }

  // A clean paper copy: up to 500 entries of the current filters, one block per booking with a table of the people
  async function printRegister() {
    setBusy('print');
    try {
      const p = qs(); p.set('page', '1'); p.set('limit', '500');
      const res = await fetch(`${BASE}/list?${p}`, { headers: authHeader(), cache: 'no-store' });
      const j = await readJson(res);
      if (!res.ok) { flash('err', failText(j, 'Could not prepare the register.')); return; }
      const d = j as ListResponse;
      const blocks = d.items.map((e, i) => {
        const people = !cfg.people ? ''
          : e.members.length
            ? `<table class="p"><thead><tr><th>#</th><th>Name</th><th>Relation</th><th>Place</th><th>Gothram</th><th>Nakshatram</th><th>Rasi</th><th>Date of birth</th></tr></thead><tbody>${e.members.map((m, k) =>
              `<tr><td>${k + 1}</td><td>${esc(personName(m))}</td><td>${esc(m.relation)}</td><td>${esc(m.place)}</td><td>${esc(m.gothram)}</td><td>${esc(m.nakshathiram)}</td><td>${esc(m.rasi)}</td><td>${esc(dobText(m.dob))}</td></tr>`).join('')}</tbody></table>`
            : kind === 'seva' || kind === 'donation' ? '<p class="n">No sankalpam names were saved with this booking.</p>' : '';
        const when = [kind === 'seva' && e.event_date ? `Seva date: ${fmtDay(e.event_date)}` : '', e.paid_at ? `${kind === 'camp' ? 'Registered' : 'Paid'}: ${fmtStamp(e.paid_at)}` : ''].filter(Boolean).join(' | ');
        const facts = factsOf(kind, e).map(([k, v]) => `${k}: ${v}`).join(' | ');
        return `<section><h2>${i + 1}. ${esc(e.item)} <small>${esc(STATUS_LABEL[e.status])}${kind === 'magazine' && e.membership ? ` | ${esc(titleCase(e.membership))}` : ''}</small></h2>
          <p class="m">${esc(e.name || 'Devotee')}${e.phone ? ` | ${esc(e.phone)}` : ''}${place(e) ? ` | ${esc(place(e))}` : ''}<br>${kind === 'camp' ? '' : `Receipt ${esc(e.receipt_no || '-')} | `}${e.status === 'FREE' ? 'No fee' : `Rs ${esc(e.amount)}`}${when ? ` | ${esc(when)}` : ''}</p>${facts ? `<p class="m">${esc(facts)}</p>` : ''}${people}</section>`;
      }).join('');
      const basisName = (cfg.basis.find(([v]) => v === basis) || cfg.basis[0])[1].toLowerCase();
      const filt = [from || to ? `${fmtDay(from) || 'start'} to ${fmtDay(to) || 'today'} (${basisName})` : 'All dates', status ? STATUS_LABEL[status] : 'All statuses', membership ? titleCase(membership) : '', source === 'manual' ? 'Offline (on-site) only' : source === 'online' ? 'Online only' : '', item || '', qNow ? `Search: ${qNow}` : ''].filter(Boolean).join(' | ');
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(cfg.title)}</title><style>
        body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:24px;font-size:12px}h1{font-size:20px;margin:0 0 4px}.f{color:#555;margin:0 0 16px}
        section{break-inside:avoid;border:1px solid #bbb;border-radius:6px;padding:10px 12px;margin:0 0 12px}h2{font-size:14px;margin:0}h2 small{font-weight:400;color:#555;margin-left:8px}
        .m{margin:4px 0 8px;color:#333}.n{color:#a15c00;margin:6px 0 0}.p{width:100%;border-collapse:collapse}.p th,.p td{border:1px solid #ccc;padding:4px 6px;text-align:left}.p th{background:#f3f3f3}
        @media print{body{margin:10mm}}</style></head><body>
        <h1>Vedaneri - ${esc(cfg.title)}</h1><p class="f">${esc(filt)}<br>${d.items.length} of ${d.total} entries${d.total > d.items.length ? ' (the first 500 are printed; narrow the dates to print the rest)' : ''} | Printed ${esc(new Date().toLocaleString('en-IN'))}</p>
        ${blocks || '<p>No entries for these filters.</p>'}</body></html>`;
      if (!printHtml(html)) flash('err', 'The register could not be prepared for printing. Please try again.');
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy(''); }
  }

  const s = data?.summary;
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / limit));
  const offset = ((data?.page || page) - 1) * limit;
  const periodText = from || to ? `${fmtDay(from) || 'the start'} to ${fmtDay(to) || 'today'}` : 'all dates';
  const categories = cfg.categories.length ? cfg.categories : (options?.categories || []).map((c) => [c, titleCase(c)] as [string, string]);
  const noDob = (kind === 'seva' || kind === 'donation') && !!options && !options.dobKept.family && !options.dobKept.devotee && !!s && s.withDob === 0 && s.people > 0;
  const basisChoices = cfg.basis.filter(([v]) => (v !== 'event' || options?.hasEventDate !== false) && (v !== 'end' || options?.hasEndDate !== false));
  const showPeople = cfg.people && (kind !== 'camp' || options?.peopleList !== false);
  const cards: { label: string; value: string; sub: string }[] = !s ? [] : kind === 'magazine' ? [
    { label: 'Subscriptions', value: String(s.entries), sub: periodText },
    { label: 'Collected', value: inr(s.paidAmount), sub: `${s.paidEntries} paid${s.pendingEntries || s.failedEntries ? `, ${s.pendingEntries} pending, ${s.failedEntries} failed` : ''}` },
    { label: 'Active', value: String(s.extra.active || 0), sub: `${s.extra.expired || 0} expired` },
    { label: 'Ending in 30 days', value: String(s.extra.soon || 0), sub: 'active, due for renewal' },
    { label: 'Copies to post', value: String(s.extra.post || 0), sub: 'active print subscribers' },
  ] : kind === 'camp' ? [
    { label: 'Registrations', value: String(s.entries), sub: periodText },
    { label: 'Collected', value: inr(s.paidAmount), sub: `${s.paidEntries} paid${s.freeEntries ? `, ${s.freeEntries} with no fee` : ''}${s.pendingEntries || s.failedEntries ? `, ${s.pendingEntries} pending, ${s.failedEntries} failed` : ''}` },
    { label: 'Adults', value: String(s.extra.adults || 0), sub: 'in these registrations' },
    { label: 'Children', value: String(s.extra.children || 0), sub: 'in these registrations' },
    ...(showPeople ? [{ label: 'People named', value: String(s.people), sub: 'with a name on the list' }] : []),
  ] : [
    { label: 'Entries', value: String(s.entries), sub: periodText },
    { label: 'Collected', value: inr(s.paidAmount), sub: `${s.paidEntries} paid${s.pendingEntries || s.failedEntries ? `, ${s.pendingEntries} pending, ${s.failedEntries} failed` : ''}` },
    { label: 'People in sankalpam', value: String(s.people), sub: 'named in these bookings' },
    { label: 'Gothram, nakshatram, rasi', value: s.people ? `${s.complete}/${s.people}` : '-', sub: 'people with all three' },
    { label: 'Date of birth', value: s.people ? `${s.withDob}/${s.people}` : '-', sub: 'people with a date of birth' },
  ];

  return (
    <div className="dc">
      <style>{CSS}</style>
      <style>{PDX_CSS}</style>
      <style>{RG_CSS}</style>
      <Notice notice={notice} onClear={clear} />
      <div className="pdx">
        <div className="pdx-top">
          <div>
            <h1 className="pdx-title">{cfg.title}</h1>
            <p className="pdx-sub" style={{ fontSize: 14, maxWidth: 760 }}>{cfg.sub}</p>
          </div>
          <div className="pdx-row">
            {onsite && source === 'manual' && <button type="button" className="pdx-btn" style={{ background: '#1d4ed8', color: '#fff', borderColor: '#1d4ed8' }} onClick={() => setForm({ id: null })}>+ Add on-site entry</button>}
            <button type="button" className="pdx-btn" onClick={printRegister} disabled={!!busy || loading || total === 0}>{busy === 'print' ? 'Preparing...' : 'Print register'}</button>
            <button type="button" className="pdx-btn" onClick={download} disabled={!!busy || loading || total === 0}>{busy === 'csv' ? 'Preparing...' : 'Download CSV'}</button>
          </div>
        </div>

        {/* Filters */}
        {onsite && (
          <div className="rg-tabs" role="tablist" aria-label="Online or offline registrations">
            {([['', 'All registrations', 'Online and offline together'], ['online', 'Online', 'Booked on the website'], ['manual', 'Offline (on-site)', 'Written in at the ashram']] as [string, string, string][]).map(([v, l, d]) => (
              <button key={v || 'all'} type="button" role="tab" aria-selected={source === v} className={`rg-tab${source === v ? ' on' : ''}${v === 'manual' ? ' off' : ''}`} onClick={() => change(setSource)(v)}>
                <b>{l}</b><span>{d}</span>
              </button>
            ))}
          </div>
        )}
        <div className="pdx-card rg-filters" style={{ marginBottom: 14 }}>
          <div className="pdx-tools">
            <div className="pdx-presets" role="group" aria-label="Period">
              {cfg.presets.map(([id, label]) => <button key={id} type="button" aria-pressed={preset === id} onClick={() => choose(id)}>{label}</button>)}
            </div>
            <DateRangePicker from={from} to={to} label="Dates" onChange={(f, t) => { setFrom(f); setTo(t); setPreset(f || t ? 'custom' : 'all'); setPage(1); }} />
          </div>
          <div className="rg-grid">
            {basisChoices.length > 1 && (
              <div>
                <label className="pdx-lbl" htmlFor="rg-basis">Dates mean</label>
                <select id="rg-basis" className="pdx-inp" value={basis} onChange={(e) => change(setBasis)(e.target.value as Basis)}>
                  {basisChoices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="pdx-lbl" htmlFor="rg-status">Payment</label>
              <select id="rg-status" className="pdx-inp" value={status} onChange={(e) => change(setStatus)(e.target.value)}>
                {cfg.statuses.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {kind === 'magazine' && (
              <div>
                <label className="pdx-lbl" htmlFor="rg-mem">Membership</label>
                <select id="rg-mem" className="pdx-inp" value={membership} onChange={(e) => change(setMembership)(e.target.value)}>
                  <option value="">All</option><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option>
                </select>
              </div>
            )}
            <div>
              <label className="pdx-lbl" htmlFor="rg-item">{cfg.itemLabel}</label>
              <select id="rg-item" className="pdx-inp" value={item} onChange={(e) => change(setItem)(e.target.value)}>
                <option value="">All {cfg.itemLabel.toLowerCase()}s</option>
                {(options?.items || []).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            {categories.length > 1 && (
              <div>
                <label className="pdx-lbl" htmlFor="rg-cat">{cfg.categoryLabel}</label>
                <select id="rg-cat" className="pdx-inp" value={category} onChange={(e) => change(setCategory)(e.target.value)}>
                  <option value="">All</option>
                  {categories.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="pdx-lbl" htmlFor="rg-sort">Order</label>
              <select id="rg-sort" className="pdx-inp" value={sort} onChange={(e) => change(setSort)(e.target.value)}>
                {cfg.sorts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="rg-search">
              <label className="pdx-lbl" htmlFor="rg-q">Search</label>
              <input id="rg-q" className="pdx-inp" type="search" placeholder={cfg.search} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        </div>

        {err && <div className="pdx-err" role="alert" style={{ marginBottom: 14 }}>{err} <button type="button" className="pdx-link" onClick={load}>Try again</button></div>}

        {data?.warning && <div className="rg-info" role="note">{data.warning}</div>}
        {s && (
          <div className="rg-stats" aria-label="Summary">
            {cards.map((c) => <div key={c.label} className="rg-stat"><span className="rg-lbl">{c.label}</span><b>{c.value}</b><span>{c.sub}</span></div>)}
          </div>
        )}
        {s?.capped && showPeople && <p className="pdx-sub" style={{ marginBottom: 12 }}>The people counts above cover the first 5,000 bookings of this filter.</p>}
        {noDob && (
          <div className="rg-info" role="note">
            No date of birth is saved for these people yet. The register shows it as soon as the booking form or the devotee's family list keeps one, so the column stays "Not given" until then.
          </div>
        )}

        {/* The register */}
        <div className={loading ? 'pdx-busy' : undefined} aria-busy={loading}>
          {!loading && !err && total === 0 && <div className="pdx-card"><p className="pdx-empty">{source === 'manual' ? 'No offline entries for these filters. Use "+ Add on-site entry" to write one in, or try "All time".' : 'No entries for these filters. Try "All time" or set the payment to "All".'}</p></div>}
          <div className="rg-list">
            {(data?.items || []).map((e, i) => (
              <article key={`${e.source || 'online'}-${e.id}`} className={`rg-entry${e.source === 'manual' ? ' off' : ''}`} aria-label={`Entry ${offset + i + 1}: ${e.item}`}>
                <div className="rg-head">
                  <span className="rg-no" aria-hidden="true">{offset + i + 1}</span>
                  <div className="rg-main">
                    <div className="rg-t">
                      <span>{e.item || cfg.itemLabel}</span>
                      {e.category && <span className="pdx-pill">{titleCase(e.category)}</span>}
                      <span className="pdx-pill"><i style={{ background: STATUS_COLOR[e.status] }} />{STATUS_LABEL[e.status]}</span>
                      {e.source === 'manual' ? <span className="pdx-pill rg-offpill"><i style={{ background: '#1d4ed8' }} />Offline (on-site)</span> : onsite && <span className="pdx-pill"><i style={{ background: '#15803d' }} />Online</span>}
                      {kind === 'magazine' && (e.membership === 'ACTIVE' || e.membership === 'EXPIRED') && <span className="pdx-pill"><i style={{ background: e.membership === 'ACTIVE' ? '#15803d' : '#b45309' }} />{titleCase(e.membership)}</span>}
                    </div>
                    <p className="rg-who">
                      <b>{e.name || 'Devotee'}</b>
                      {e.phone && <> &middot; <a href={/^\+?[\d\s-]{6,20}$/.test(e.phone) ? `tel:${e.phone.replace(/[\s-]/g, '')}` : undefined}>{e.phone}</a></>}
                      {place(e) && <> &middot; {place(e)}</>}
                      {e.devotee_id && <> &middot; <span className="pdx-mut">{e.devotee_id}</span></>}
                    </p>
                  </div>
                  <div className="rg-side">
                    <div className="rg-amt" style={e.status === 'CANCELLED' ? { textDecoration: 'line-through', color: '#64748b' } : undefined}>{amountText(e)}</div>
                    {kind !== 'camp' && <div>Receipt {e.receipt_no || '-'}</div>}
                    {kind === 'seva' && e.event_date && <div>Seva date <b style={{ color: '#3b0d0d' }}>{fmtDay(e.event_date)}</b></div>}
                    {e.paid_at && <div>{kind === 'camp' ? 'Registered' : 'Paid'} {fmtStamp(e.paid_at)}</div>}
                  </div>
                </div>
                <div className="rg-body">
                  {factsOf(kind, e).length > 0 && (
                    <dl className="rg-facts">{factsOf(kind, e).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                  )}
                  {e.details.length > 0 && (
                    <p className="rg-notes" style={{ marginTop: factsOf(kind, e).length ? 12 : 0 }}>{e.details.map((d) => <span key={d.label}><b>{d.label}:</b> {d.value}</span>)}</p>
                  )}
                  {showPeople && e.members.length === 0 && e.status !== 'CANCELLED' && (kind === 'seva' || kind === 'donation') && <p className="rg-none">No sankalpam names were saved with this booking.</p>}
                  {showPeople && e.members.length > 0 && (
                    <ul className="rg-people" aria-label="People named">
                      {e.members.map((m, k) => (
                        <li key={k} className="rg-p">
                          <div className="rg-pn">{personName(m)}{m.relation && <span className="rg-pr">{m.relation}</span>}</div>
                          <dl>
                            {([['Gothram', m.gothram], ['Nakshatram', m.nakshathiram], ['Rasi', m.rasi], ['Date of birth', m.dob ? dobText(m.dob) : '']] as [string, string][])
                              // Camp forms rarely ask for these, so a camp card lists only what was given; sankalpam registers flag what is missing
                              .filter(([, v]) => kind !== 'camp' || v)
                              .map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v || <span className="rg-miss">Not given</span>}</dd></React.Fragment>)}
                            {m.extra.map((x) => <React.Fragment key={x.label}><dt>{x.label}</dt><dd>{x.value}</dd></React.Fragment>)}
                          </dl>
                          {m.from_profile && <p className="rg-src">Some details are from the devotee's saved profile.</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {onsite && e.status !== 'CANCELLED' && (
                    <div className="rg-act">
                      <button type="button" className="pdx-btn" onClick={() => printForm(e)}>Print sankalpa form</button>
                      {e.source === 'manual' && <button type="button" className="pdx-btn" onClick={() => setForm({ id: e.id })}>Correct</button>}
                      {e.source === 'manual' && <button type="button" className="pdx-btn" onClick={() => setCancelFor({ id: e.id, reason: '', busy: false })}>Cancel entry</button>}
                    </div>
                  )}
                  {cancelFor?.id === e.id && e.source === 'manual' && (
                    <div className="rg-cancel" role="group" aria-label="Cancel this entry">
                      <label className="pdx-lbl" htmlFor={`rg-why-${e.id}`}>Why is {e.receipt_no} cancelled?</label>
                      <input id={`rg-why-${e.id}`} className="pdx-inp" value={cancelFor.reason} maxLength={255} autoFocus onChange={(ev) => setCancelFor({ ...cancelFor, reason: ev.target.value })} placeholder="For example: entered twice" />
                      <div className="pdx-row">
                        <button type="button" className="pdx-btn" onClick={() => setCancelFor(null)} disabled={cancelFor.busy}>Keep entry</button>
                        <button type="button" className="pdx-btn" style={{ background: '#b91c1c', color: '#fff', borderColor: '#b91c1c' }} onClick={cancelEntry} disabled={cancelFor.busy}>{cancelFor.busy ? 'Cancelling...' : 'Cancel this entry'}</button>
                      </div>
                      <p className="pdx-sub" style={{ margin: 0 }}>The receipt number is kept on the register as cancelled and is not counted in the totals.</p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        {total > 0 && (
          <div className="rg-pager">
            <span className="pdx-sub">Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}</span>
            <div className="pdx-row" style={{ alignItems: 'center' }}>
              <label className="pdx-sub" htmlFor="rg-size">Per page</label>
              <select id="rg-size" className="pdx-inp" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button type="button" className="pdx-btn" disabled={page <= 1 || loading} onClick={() => setPage((x) => Math.max(1, x - 1))}>Previous</button>
              <span className="pdx-sub">Page {page} of {pages}</span>
              <button type="button" className="pdx-btn" disabled={page >= pages || loading} onClick={() => setPage((x) => x + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
      {form && onsite && <ManualEntryForm kind={kind} apiBase={API_BASE} editId={form.id} items={options?.items || []} onClose={() => setForm(null)} onSaved={saved} />}
    </div>
  );
}