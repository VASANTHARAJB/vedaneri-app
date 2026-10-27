import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api/v1';
const API = `${API_BASE}/camps`;
const FILES = API_BASE.replace(/\/api\/v1\/?$/, '');

// The admin login token. Adjust the key names if your CMS stores it differently.
function getToken(): string {
  for (const k of ['token', 'admin_token', 'auth_token', 'accessToken', 'cms_token']) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return '';
}
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

type Status = 'draft' | 'published' | 'closed';
interface Camp {
  id: string; slug: string; title_en: string; title_ta: string | null; description_en: string | null; description_ta: string | null;
  venue_en: string | null; venue_ta: string | null; start_date: string; end_date: string; start_time: string | null; end_time: string | null;
  image_url: string | null; fee_type: 'free' | 'paid'; fee_amount: number; seats: number; status: Status; registered: number;
}
interface Reg { id: number; name: string; phone: string | null; email: string | null; members: number; notes: string | null; status: string; created_at: string }

const emptyForm = {
  title_en: '', title_ta: '', description_en: '', description_ta: '', venue_en: '', venue_ta: '',
  start_date: '', end_date: '', start_time: '', end_time: '', fee_type: 'free', fee_amount: '', seats: '0', status: 'draft' as Status,
};

// English field -> Tamil field that is auto-filled from it
const TA_PAIRS = { title_en: 'title_ta', venue_en: 'venue_ta', description_en: 'description_ta' } as const;
type EnKey = keyof typeof TA_PAIRS;
type TaKey = (typeof TA_PAIRS)[EnKey];
const EN_OF: Record<TaKey, EnKey> = { title_ta: 'title_en', venue_ta: 'venue_en', description_ta: 'description_en' };

type SortKey = 'title_en' | 'start_date' | 'registered' | 'status';
type When = 'upcoming' | 'ongoing' | 'past';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const d10 = (s: string) => (s || '').slice(0, 10);
const fmtD = (s: string) => {
  const d = d10(s);
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${Number(dd)} ${MON[Number(m) - 1] || ''} ${y}`;
};
const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};
const whenOf = (c: Camp, today: string): When => {
  if (d10(c.end_date) < today) return 'past';
  if (d10(c.start_date) > today) return 'upcoming';
  return 'ongoing';
};
const imgUrl = (u: string | null) => (u ? (u.startsWith('http') ? u : `${FILES}${u}`) : '');
async function readJson(res: Response) { try { return await res.json(); } catch { return {}; } }

// English letters -> Tamil script (phonetic). Uses Google Input Tools, no API key.
// Returns null if any request fails, so the caller can show a message.
async function transliterate(text: string): Promise<string | null> {
  const lines = text.split('\n').slice(0, 30);
  try {
    const out = await Promise.all(
      lines.map(async (line) => {
        if (!line.trim()) return '';
        const words = line.trim().split(/\s+/);
        const parts: string[] = [];
        for (let i = 0; i < words.length; i += 15) parts.push(words.slice(i, i + 15).join(' '));
        const done = await Promise.all(
          parts.map(async (p) => {
            const r = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(p)}&itc=ta-t-i0-und&num=1`);
            if (!r.ok) throw new Error('bad status');
            const d = await r.json();
            const v = d?.[0] === 'SUCCESS' ? d?.[1]?.[0]?.[1]?.[0] : null;
            if (!v) throw new Error('no result');
            return String(v);
          })
        );
        return done.join(' ');
      })
    );
    return out.join('\n');
  } catch {
    return null;
  }
}

// Scoped styles with !important so the portal's global CSS cannot hide any control.
// Brand colour: change --p (and --pd for hover) to restyle the whole page.
const CSS = `
.cm{--p:#7a1c1c;--pd:#5e1414;--ink:#1f2937;--mut:#6b7280;--line:#e5e7eb;font-size:13px;color:var(--ink);}
.cm *{box-sizing:border-box;}
.cm p,.cm h1,.cm h2,.cm h3,.cm td,.cm th,.cm dt,.cm dd,.cm label,.cm span,.cm small{color:inherit !important;background:transparent !important;}
.cm .mut{color:var(--mut) !important;}
.cm .head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;}
.cm .title{font-size:22px;font-weight:800;line-height:1.2;}
.cm .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;line-height:1.2;cursor:pointer;border:1px solid #cfd4dc !important;background:#fff !important;color:var(--ink) !important;white-space:nowrap;}
.cm .btn:hover{background:#f3f4f6 !important;}
.cm .btn:disabled{opacity:.55;cursor:not-allowed;}
.cm .btn.primary{background:var(--p) !important;border-color:var(--p) !important;color:#fff !important;}
.cm .btn.primary:hover{background:var(--pd) !important;}
.cm .btn.dng{color:#b91c1c !important;border-color:#fca5a5 !important;}
.cm .btn.dng:hover{background:#fef2f2 !important;}
.cm .btn.dfill{background:#dc2626 !important;border-color:#dc2626 !important;color:#fff !important;}
.cm .btn.sm{padding:5px 10px;font-size:12px;border-radius:6px;}
.cm .btn.link{border:none !important;background:transparent !important;padding:0;color:var(--p) !important;font-weight:700;}
.cm .btn.link:hover{background:transparent !important;text-decoration:underline;}
.cm .seg{display:inline-flex;border:1px solid #cfd4dc;border-radius:8px;overflow:hidden;background:#fff;}
.cm .seg button{padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer;border:none !important;background:#fff !important;color:var(--mut) !important;}
.cm .seg button.on{background:#f6e7e7 !important;color:var(--p) !important;}
.cm .card{background:#fff !important;border:1px solid var(--line);border-radius:10px;}
.cm .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;}
.cm .kpi{padding:14px 16px;border-left:4px solid var(--p);}
.cm .kpi .kl{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mut) !important;}
.cm .kpi .kv{font-size:26px;font-weight:800;margin-top:2px;}
.cm .kpi .kv.ok{color:#166534 !important;}
.cm .kpi .kv.gr{color:#475569 !important;}
.cm .kpi .kv.pu{color:#6d28d9 !important;}
@media(max-width:1000px){.cm .kpis{grid-template-columns:repeat(2,minmax(0,1fr));}}
.cm .panel{overflow:hidden;}
.cm .toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);}
.cm .toolbar .grow{flex:1;min-width:10px;}
.cm .toolbar .inp{width:auto;}
.cm .toolbar .search{width:300px;max-width:100%;}
.cm .bulk{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;background:#fdf2f2;border-bottom:1px solid #f3d0d0;}
.cm input[type=checkbox]{accent-color:var(--p);width:16px;height:16px;cursor:pointer;flex:none;}
.cm .tblwrap{overflow-x:auto;}
.cm .tbl{width:100%;border-collapse:collapse;min-width:900px;}
.cm .tbl.narrow{min-width:540px;}
.cm .tbl th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--mut) !important;background:#f9fafb !important;border-bottom:1px solid var(--line);white-space:nowrap;}
.cm .tbl td{padding:12px 14px;border-bottom:1px solid #f0f1f3;vertical-align:middle;}
.cm .tbl tr:hover td{background:#fafafa !important;}
.cm .tbl tr.sel td{background:#fdf6f6 !important;}
.cm .tbl .c0{width:40px;padding-right:0;}
.cm .thbtn{border:none !important;background:transparent !important;color:inherit !important;font:inherit;cursor:pointer;text-transform:inherit;letter-spacing:inherit;padding:0;}
.cm .nm{display:flex;align-items:center;gap:10px;min-width:230px;}
.cm .thumb{width:44px;height:44px;border-radius:8px;overflow:hidden;background:#f6e7e7;flex:none;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:var(--p);}
.cm .thumb.empty-img{font-size:11px;font-weight:700;color:var(--mut);background:#f3f4f6;}
.cm .thumb img{width:100%;height:100%;object-fit:cover;}
.cm .nm .t{font-weight:700;display:block;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cm .nm .s{display:block;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;}
.cm .pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;border:1px solid transparent;text-transform:capitalize;}
.cm .pill.published{background:#dcfce7 !important;color:#166534 !important;border-color:#86efac;}
.cm .pill.draft{background:#f1f5f9 !important;color:#334155 !important;border-color:#cbd5e1;}
.cm .pill.closed{background:#fef3c7 !important;color:#92400e !important;border-color:#fcd34d;}
.cm .pill.free{background:#e0f2fe !important;color:#075985 !important;border-color:#bae6fd;}
.cm .pill.paid{background:#ede9fe !important;color:#5b21b6 !important;border-color:#c4b5fd;}
.cm .pill.upcoming{background:#eff6ff !important;color:#1d4ed8 !important;border-color:#bfdbfe;}
.cm .pill.ongoing{background:#dcfce7 !important;color:#166534 !important;border-color:#86efac;}
.cm .pill.past{background:#f1f5f9 !important;color:#64748b !important;border-color:#e2e8f0;}
.cm select.pill{cursor:pointer;padding:3px 8px;}
.cm .bar{height:6px;border-radius:99px;background:#eceef1;overflow:hidden;margin-top:5px;width:110px;}
.cm .bar i{display:block;height:100%;background:var(--p);border-radius:99px;}
.cm .bar i.full{background:#dc2626;}
.cm .acts{display:flex;gap:6px;justify-content:flex-end;}
.cm .pager{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-top:1px solid var(--line);}
.cm .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;padding:14px;}
.cm .cardx{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff !important;display:flex;flex-direction:column;}
.cm .cardx .cimg{height:130px;background:#f3f4f6;position:relative;}
.cm .cardx .cimg img{width:100%;height:100%;object-fit:cover;}
.cm .cardx .cimg select{position:absolute;left:10px;top:10px;}
.cm .cardx .cb{padding:14px;display:flex;flex-direction:column;gap:10px;flex:1;}
.cm .empty{padding:56px 16px;text-align:center;}
.cm .skel{height:46px;margin:10px 14px;border-radius:8px;background:linear-gradient(90deg,#f1f2f4 25%,#e7e9ec 37%,#f1f2f4 63%);background-size:400% 100%;animation:cmsk 1.2s ease infinite;}
@keyframes cmsk{0%{background-position:100% 50%}100%{background-position:0 50%}}
.cm .ov{position:fixed;inset:0;z-index:70;display:flex;justify-content:flex-end;background:rgba(17,24,39,.45);}
.cm .ov.mid{justify-content:center;align-items:center;padding:16px;}
.cm .drawer{display:flex;flex-direction:column;height:100%;width:100%;background:#fff !important;box-shadow:-12px 0 40px rgba(0,0,0,.2);}
.cm .dh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 22px;border-bottom:1px solid var(--line);}
.cm .db{flex:1;overflow-y:auto;padding:20px 22px;}
.cm .df{display:flex;justify-content:flex-end;gap:8px;padding:14px 22px;border-top:1px solid var(--line);background:#fafafa !important;}
.cm .modal{width:100%;max-width:420px;background:#fff !important;border-radius:12px;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.25);}
.cm .tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);padding:0 22px;}
.cm .tab{padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer;border:none !important;border-bottom:2px solid transparent !important;background:transparent !important;color:var(--mut) !important;}
.cm .tab.on{color:var(--p) !important;border-bottom-color:var(--p) !important;}
.cm .sec{margin-bottom:24px;}
.cm .sech{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--mut) !important;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--line);}
.cm .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
.cm .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px;}
@media(max-width:700px){.cm .g2,.cm .g3{grid-template-columns:1fr;}}
.cm .lblrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
.cm .lbl{display:block;font-size:12px;font-weight:700;margin-bottom:4px;}
.cm .lblrow .lbl{margin-bottom:0;}
.cm .inp{width:100%;border:1px solid #cfd4dc !important;border-radius:8px;padding:9px 11px;font-size:14px;background:#fff !important;color:var(--ink) !important;}
.cm .inp:focus{outline:2px solid #d97777;outline-offset:0;border-color:var(--p) !important;}
.cm .inp.bad{border-color:#ef4444 !important;background:#fef2f2 !important;}
.cm .inp:disabled{background:#f3f4f6 !important;color:#9ca3af !important;}
.cm .hint{font-size:11.5px;margin-top:4px;}
.cm .err{display:block;font-size:12px;font-weight:600;margin-top:4px;color:#b91c1c !important;}
.cm .alert{border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:14px;}
.cm .alert.ok{background:#dcfce7 !important;color:#166534 !important;border:1px solid #86efac;}
.cm .alert.bad{background:#fee2e2 !important;color:#991b1b !important;border:1px solid #fca5a5;}
.cm .alert.info{background:#eff6ff !important;color:#1e40af !important;border:1px solid #bfdbfe;}
.cm .facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 20px;}
.cm .facts dt{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--mut) !important;}
.cm .facts dd{font-weight:700;margin-top:2px;word-break:break-word;}
.cm .banner{height:150px;border-radius:10px;overflow:hidden;background:#f3f4f6;margin-bottom:16px;}
.cm .banner img{width:100%;height:100%;object-fit:cover;}
`;

export default function CampsManagement() {
  const [params, setParams] = useSearchParams();
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // List controls
  const [q, setQ] = useState('');
  const [view, setView] = useState<'list' | 'cards'>('list');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'start_date', dir: 'desc' });
  const [fStatus, setFStatus] = useState<'all' | Status>('all');
  const [fFee, setFFee] = useState<'all' | 'free' | 'paid'>('all');
  const [fWhen, setFWhen] = useState<'all' | When>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Add / edit drawer
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Camp | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [removeImg, setRemoveImg] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Tamil auto-fill
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [taFail, setTaFail] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const seq = useRef<Record<string, number>>({});

  // Delete confirmation
  const [delAsk, setDelAsk] = useState<{ ids: string[] } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Detail drawer
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'regs'>('overview');
  const [regs, setRegs] = useState<Reg[]>([]);
  const [regsFor, setRegsFor] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [regErr, setRegErr] = useState('');
  const [regQ, setRegQ] = useState('');
  const regReq = useRef(0);

  const today = todayStr();
  const detail = camps.find((c) => c.id === detailId) || null;

  const flash = useCallback((tone: 'ok' | 'err', text: string) => {
    setNotice({ tone, text });
    if (tone === 'ok') setTimeout(() => setNotice(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadErr('');
    try {
      const res = await fetch(`${API}/admin/list`, { headers: authHeader(), cache: 'no-store' });
      if (res.status === 401) throw new Error('Your admin session has ended. Please sign in again.');
      if (!res.ok) throw new Error((await readJson(res)).message || `The server returned an error (${res.status}).`);
      const list: Camp[] = (await res.json()).camps || [];
      setCamps(list);
      setSelected((prev) => new Set([...prev].filter((id) => list.some((c) => c.id === id))));
    } catch (e: any) {
      setLoadErr(e?.message || 'Could not load camps.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---------- Tamil auto-fill ----------
  const cancelTa = useCallback((k: string) => {
    clearTimeout(timers.current[k]);
    seq.current[k] = (seq.current[k] || 0) + 1;
    setBusy((b) => (b[k] ? { ...b, [k]: false } : b));
  }, []);

  const runTa = useCallback((en: EnKey, text: string, delay: number) => {
    const ta = TA_PAIRS[en];
    cancelTa(ta);
    if (!text.trim()) { setForm((f) => ({ ...f, [ta]: '' })); return; }
    const id = seq.current[ta];
    setBusy((b) => ({ ...b, [ta]: true }));
    timers.current[ta] = setTimeout(async () => {
      const out = await transliterate(text);
      if (seq.current[ta] !== id) return; // a newer edit replaced this one
      setBusy((b) => ({ ...b, [ta]: false }));
      if (out === null) { setTaFail(true); return; }
      setTaFail(false);
      setForm((f) => ({ ...f, [ta]: out }));
    }, delay);
  }, [cancelTa]);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  // ---------- Open / close forms ----------
  const resetTa = useCallback(() => {
    (Object.values(TA_PAIRS) as string[]).forEach(cancelTa);
    setTaFail(false);
  }, [cancelTa]);

  const openNew = useCallback(() => {
    resetTa();
    setEditing(null); setForm({ ...emptyForm }); setTouched({}); setFile(null); setPreview(''); setRemoveImg(false); setErrs({}); setOpen(true);
  }, [resetTa]);

  useEffect(() => {
    if (params.get('new') === '1') {
      openNew();
      const next = new URLSearchParams(params); next.delete('new'); setParams(next, { replace: true });
    }
  }, [params, setParams, openNew]);

  const openEdit = (c: Camp) => {
    resetTa();
    setEditing(c);
    setForm({
      title_en: c.title_en, title_ta: c.title_ta || '', description_en: c.description_en || '', description_ta: c.description_ta || '',
      venue_en: c.venue_en || '', venue_ta: c.venue_ta || '', start_date: d10(c.start_date), end_date: d10(c.end_date),
      start_time: c.start_time || '', end_time: c.end_time || '', fee_type: c.fee_type, fee_amount: c.fee_amount ? String(c.fee_amount) : '',
      seats: String(c.seats), status: c.status,
    });
    // Saved Tamil text is never overwritten automatically
    setTouched({ title_ta: !!c.title_ta, venue_ta: !!c.venue_ta, description_ta: !!c.description_ta });
    setFile(null); setPreview(imgUrl(c.image_url)); setRemoveImg(false); setErrs({}); setOpen(true);
  };

  const set = (k: keyof typeof emptyForm, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrs((e) => ({ ...e, [k]: '', form: '' })); };

  const onEnglish = (k: EnKey, v: string) => {
    set(k, v);
    if (!touched[TA_PAIRS[k]]) runTa(k, v, k === 'description_en' ? 700 : 450);
  };
  const onTamil = (k: TaKey, v: string) => {
    cancelTa(k);
    set(k, v);
    if (v.trim() === '') {
      setTouched((t) => ({ ...t, [k]: false }));
      if (form[EN_OF[k]].trim()) runTa(EN_OF[k], form[EN_OF[k]], 0);
    } else {
      setTouched((t) => ({ ...t, [k]: true }));
    }
  };
  const forceAuto = (k: EnKey) => {
    setTouched((t) => ({ ...t, [TA_PAIRS[k]]: false }));
    runTa(k, form[k], 0);
  };

  function pickFile(f?: File) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setErrs((e) => ({ ...e, image: 'Choose a JPG, PNG or WebP image' })); return; }
    if (f.size > 5 * 1024 * 1024) { setErrs((e) => ({ ...e, image: 'The image must be under 5MB' })); return; }
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setErrs((e) => ({ ...e, image: '' })); setFile(f); setPreview(URL.createObjectURL(f)); setRemoveImg(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const x: Record<string, string> = {};
    if (!form.title_en.trim()) x.title_en = 'Enter the title in English';
    if (!form.start_date) x.start_date = 'Choose the start date';
    if (form.end_date && form.start_date && form.end_date < form.start_date) x.end_date = 'End date is before the start date';
    if (form.fee_type === 'paid' && !(Number(form.fee_amount) > 0)) x.fee_amount = 'Enter the fee amount';
    if (!(Number(form.seats) >= 0)) x.seats = 'Seats must be 0 or more';
    setErrs(x);
    if (Object.keys(x).length) return;

    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, String(v)));
    if (!form.end_date) body.set('end_date', form.start_date);
    if (form.fee_type === 'free') body.set('fee_amount', '');
    if (file) body.append('image', file);
    if (removeImg) body.append('remove_image', 'true');

    setSaving(true);
    try {
      const res = await fetch(editing ? `${API}/admin/${editing.id}` : `${API}/admin`, { method: editing ? 'PUT' : 'POST', headers: authHeader(), body });
      const d = await readJson(res);
      if (!res.ok) { setErrs({ form: d.message || 'Could not save the camp.' }); return; }
      resetTa();
      setOpen(false);
      flash('ok', editing ? 'Camp updated.' : 'Camp created.');
      load();
    } catch {
      setErrs({ form: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  // ---------- Status / delete / bulk ----------
  async function changeStatus(c: Camp, status: Status) {
    try {
      const res = await fetch(`${API}/admin/${c.id}/status`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error((await readJson(res)).message);
      setCamps((list) => list.map((x) => (x.id === c.id ? { ...x, status } : x)));
    } catch (e: any) {
      flash('err', e?.message || 'Could not change the status.');
    }
  }

  async function bulkStatus(status: Status) {
    const targets = camps.filter((c) => selected.has(c.id) && c.status !== status);
    if (!targets.length) { flash('ok', 'The selected camps already have that status.'); return; }
    const results = await Promise.allSettled(
      targets.map((c) =>
        fetch(`${API}/admin/${c.id}/status`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
          .then((r) => { if (!r.ok) throw new Error(); return c.id; })
      )
    );
    const okIds = new Set<string>();
    results.forEach((r) => { if (r.status === 'fulfilled') okIds.add(r.value); });
    setCamps((list) => list.map((c) => (okIds.has(c.id) ? { ...c, status } : c)));
    const failed = targets.length - okIds.size;
    flash(failed ? 'err' : 'ok', failed ? `${okIds.size} updated, ${failed} failed.` : `${okIds.size} camp(s) set to ${status}.`);
  }

  async function doDelete() {
    if (!delAsk) return;
    setDeleting(true);
    const ids = delAsk.ids;
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`${API}/admin/${id}`, { method: 'DELETE', headers: authHeader() }).then((r) => { if (!r.ok) throw new Error(); }))
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    setDeleting(false); setDelAsk(null); setSelected(new Set());
    if (detailId && ids.includes(detailId)) setDetailId(null);
    flash(failed ? 'err' : 'ok', failed ? `${ids.length - failed} deleted, ${failed} failed.` : ids.length === 1 ? 'Camp deleted.' : `${ids.length} camps deleted.`);
    load();
  }

  // ---------- Registrations ----------
  const loadRegs = useCallback(async (id: string) => {
    const req = ++regReq.current;
    setRegLoading(true); setRegErr('');
    try {
      const res = await fetch(`${API}/admin/${id}/registrations`, { headers: authHeader(), cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (req !== regReq.current) return;
      setRegs(data.registrations || []);
    } catch {
      if (req !== regReq.current) return;
      setRegs([]); setRegErr('Could not load registrations.');
    } finally {
      if (req === regReq.current) { setRegsFor(id); setRegLoading(false); }
    }
  }, []);

  useEffect(() => {
    if (detailId && tab === 'regs' && regsFor !== detailId) loadRegs(detailId);
  }, [detailId, tab, regsFor, loadRegs]);

  const openDetail = (c: Camp, t: 'overview' | 'regs' = 'overview') => {
    setDetailId(c.id); setTab(t); setRegQ('');
    if (regsFor !== c.id) { setRegs([]); setRegErr(''); }
  };

  async function exportRegs(c: Camp) {
    try {
      const res = await fetch(`${API}/admin/${c.id}/registrations/export`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `${c.slug}-registrations.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      flash('err', 'Export failed.');
    }
  }

  // Escape closes the top-most layer
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (delAsk) { if (!deleting) setDelAsk(null); }
      else if (open) { if (!saving) setOpen(false); }
      else if (detailId) setDetailId(null);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [delAsk, deleting, open, saving, detailId]);

  // ---------- Derived list ----------
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = camps.filter((c) => {
      if (fStatus !== 'all' && c.status !== fStatus) return false;
      if (fFee !== 'all' && c.fee_type !== fFee) return false;
      if (fWhen !== 'all' && whenOf(c, today) !== fWhen) return false;
      if (t && !`${c.title_en} ${c.title_ta || ''} ${c.venue_en || ''} ${c.venue_ta || ''}`.toLowerCase().includes(t)) return false;
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let r = 0;
      if (sort.key === 'registered') r = (a.registered || 0) - (b.registered || 0);
      else if (sort.key === 'start_date') r = d10(a.start_date).localeCompare(d10(b.start_date));
      else r = String(a[sort.key] || '').localeCompare(String(b[sort.key] || ''));
      return r * dir;
    });
    return list;
  }, [camps, q, fStatus, fFee, fWhen, sort, today]);

  useEffect(() => { setPage(1); }, [q, fStatus, fFee, fWhen, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allOnPage = rows.length > 0 && rows.every((c) => selected.has(c.id));

  const toggleOne = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (allOnPage) rows.forEach((c) => n.delete(c.id)); else rows.forEach((c) => n.add(c.id)); return n; });

  const cnt = (f: (c: Camp) => boolean) => camps.filter(f).length;
  const totalPeople = camps.reduce((s, c) => s + (c.registered || 0), 0);
  const filtersOn = fStatus !== 'all' || fFee !== 'all' || fWhen !== 'all' || q.trim() !== '';
  const resetFilters = () => { setFStatus('all'); setFFee('all'); setFWhen('all'); setQ(''); };

  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'start_date' ? 'desc' : 'asc' }));
  const th = (key: SortKey, label: string) => (
    <th>
      <button type="button" className="thbtn" onClick={() => sortBy(key)}>
        {label}{sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );

  const inp = (key: string) => `inp${errs[key] ? ' bad' : ''}`;
  const anyBusy = Object.values(busy).some(Boolean);

  const regsShown = useMemo(() => {
    const t = regQ.trim().toLowerCase();
    return regs.filter((r) => !t || `${r.name} ${r.phone || ''} ${r.email || ''}`.toLowerCase().includes(t));
  }, [regs, regQ]);
  const regPeople = regs.filter((r) => r.status === 'REGISTERED').reduce((s, r) => s + r.members, 0);

  const statusSelect = (c: Camp) => (
    <select value={c.status} onChange={(e) => changeStatus(c, e.target.value as Status)} aria-label={`Status of ${c.title_en}`} className={`pill ${c.status}`}>
      <option value="draft">draft</option>
      <option value="published">published</option>
      <option value="closed">closed</option>
    </select>
  );

  const feeText = (c: Camp) => (c.fee_type === 'paid' ? `₹${c.fee_amount}` : 'Free');
  const initial = (c: Camp) => (c.title_en || '?').trim().charAt(0).toUpperCase();

  // English + Tamil pair with auto-fill
  const renderPair = (en: EnKey, label: string, rows?: number) => {
    const ta = TA_PAIRS[en];
    return (
      <div className="g2">
        <div>
          <label className="lbl" htmlFor={`f-${en}`}>{label} (English){en === 'title_en' ? ' *' : ''}</label>
          {rows
            ? <textarea id={`f-${en}`} rows={rows} value={form[en]} onChange={(e) => onEnglish(en, e.target.value)} className="inp" />
            : <input id={`f-${en}`} value={form[en]} onChange={(e) => onEnglish(en, e.target.value)} className={inp(en)} />}
          {errs[en] && <span role="alert" className="err">{errs[en]}</span>}
        </div>
        <div>
          <div className="lblrow">
            <label className="lbl" htmlFor={`f-${ta}`}>{label} (தமிழ்)</label>
            <button type="button" className="btn link" disabled={!form[en].trim() || busy[ta]} onClick={() => forceAuto(en)}>Auto-fill</button>
          </div>
          {rows
            ? <textarea id={`f-${ta}`} rows={rows} value={form[ta]} onChange={(e) => onTamil(ta, e.target.value)} className="inp" />
            : <input id={`f-${ta}`} value={form[ta]} onChange={(e) => onTamil(ta, e.target.value)} className="inp" />}
          <p className="hint mut">
            {busy[ta] ? 'Converting to Tamil...' : touched[ta] ? 'Edited by you. It will not be overwritten.' : 'Fills in automatically from the English text.'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="cm">
      <style>{CSS}</style>

      {/* Header */}
      <div className="head">
        <div>
          <h1 className="title">Camps</h1>
          <p className="mut" style={{ marginTop: 2 }}>Create camps, open or close registration and see who has registered.</p>
        </div>
        <button type="button" onClick={openNew} className="btn primary">+ New Camp</button>
      </div>

      {notice && (
        <div role={notice.tone === 'err' ? 'alert' : 'status'} className={`alert ${notice.tone === 'ok' ? 'ok' : 'bad'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="btn sm">Dismiss</button>
        </div>
      )}

      {/* KPIs */}
      <div className="kpis">
        <div className="card kpi"><p className="kl">Total camps</p><p className="kv">{camps.length}</p></div>
        <div className="card kpi"><p className="kl">Published</p><p className="kv ok">{cnt((c) => c.status === 'published')}</p></div>
        <div className="card kpi"><p className="kl">Drafts</p><p className="kv gr">{cnt((c) => c.status === 'draft')}</p></div>
        <div className="card kpi"><p className="kl">People registered</p><p className="kv pu">{totalPeople}</p></div>
      </div>

      {/* Main panel */}
      <section className="card panel">
        <div className="toolbar">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or venue (English / தமிழ்)" aria-label="Search camps" className="inp search" />

          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as 'all' | Status)} aria-label="Filter by status" className="inp">
            <option value="all">All statuses</option>
            <option value="published">Published ({cnt((c) => c.status === 'published')})</option>
            <option value="draft">Draft ({cnt((c) => c.status === 'draft')})</option>
            <option value="closed">Closed ({cnt((c) => c.status === 'closed')})</option>
          </select>

          <select value={fWhen} onChange={(e) => setFWhen(e.target.value as 'all' | When)} aria-label="Filter by timeline" className="inp">
            <option value="all">All timelines</option>
            <option value="upcoming">Upcoming ({cnt((c) => whenOf(c, today) === 'upcoming')})</option>
            <option value="ongoing">Ongoing ({cnt((c) => whenOf(c, today) === 'ongoing')})</option>
            <option value="past">Past ({cnt((c) => whenOf(c, today) === 'past')})</option>
          </select>

          <select value={fFee} onChange={(e) => setFFee(e.target.value as 'all' | 'free' | 'paid')} aria-label="Filter by fee" className="inp">
            <option value="all">All fees</option>
            <option value="free">Free ({cnt((c) => c.fee_type === 'free')})</option>
            <option value="paid">Paid ({cnt((c) => c.fee_type === 'paid')})</option>
          </select>

          {filtersOn && <button type="button" className="btn link" onClick={resetFilters}>Clear filters</button>}
          <span className="mut">{filtered.length} camp{filtered.length === 1 ? '' : 's'}</span>
          <span className="grow" />
          <div className="seg" role="group" aria-label="View">
            <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
            <button type="button" className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>Cards</button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="bulk">
            <strong>{selected.size} selected</strong>
            <button type="button" className="btn sm" onClick={() => bulkStatus('published')}>Publish</button>
            <button type="button" className="btn sm" onClick={() => bulkStatus('closed')}>Close registration</button>
            <button type="button" className="btn sm" onClick={() => bulkStatus('draft')}>Move to draft</button>
            <button type="button" className="btn sm dng" onClick={() => setDelAsk({ ids: [...selected] })}>Delete</button>
            <button type="button" className="btn link" onClick={() => setSelected(new Set())}>Clear selection</button>
          </div>
        )}

        {loading ? (
          <div>{[0, 1, 2, 3].map((i) => <div key={i} className="skel" />)}</div>
        ) : loadErr ? (
          <div role="alert" className="empty">
            <p style={{ fontSize: 15, fontWeight: 800 }}>Camps could not be loaded</p>
            <p className="mut" style={{ marginTop: 4 }}>{loadErr}</p>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button type="button" onClick={load} className="btn">Try again</button>
              <button type="button" onClick={openNew} className="btn primary">+ New Camp</button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <p style={{ fontSize: 16, fontWeight: 800 }}>{camps.length === 0 ? 'No camps yet' : 'No camps match these filters'}</p>
            <p className="mut" style={{ marginTop: 4 }}>{camps.length === 0 ? 'Create the first camp to show it on the website.' : 'Try clearing a filter or changing the search.'}</p>
            <div style={{ marginTop: 16 }}>
              {camps.length === 0
                ? <button type="button" onClick={openNew} className="btn primary">+ Create the first camp</button>
                : <button type="button" onClick={resetFilters} className="btn">Clear filters</button>}
            </div>
          </div>
        ) : view === 'list' ? (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="c0"><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all on this page" /></th>
                  {th('title_en', 'Camp')}
                  {th('start_date', 'Dates')}
                  <th>Venue</th>
                  <th>Fee</th>
                  {th('registered', 'Registered')}
                  {th('status', 'Status')}
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const pct = c.seats > 0 ? Math.min(100, Math.round((c.registered / c.seats) * 100)) : 0;
                  const w = whenOf(c, today);
                  return (
                    <tr key={c.id} className={selected.has(c.id) ? 'sel' : ''}>
                      <td className="c0"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} aria-label={`Select ${c.title_en}`} /></td>
                      <td>
                        <div className="nm">
                          <div className="thumb">{c.image_url ? <img src={imgUrl(c.image_url)} alt="" /> : initial(c)}</div>
                          <div style={{ minWidth: 0 }}>
                            <button type="button" className="btn link t" onClick={() => openDetail(c)}>{c.title_en}</button>
                            {c.title_ta && <span className="s mut">{c.title_ta}</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{fmtD(c.start_date)}{d10(c.end_date) !== d10(c.start_date) ? ` – ${fmtD(c.end_date)}` : ''}</div>
                        <span className={`pill ${w}`} style={{ marginTop: 4 }}>{w}</span>
                      </td>
                      <td>{c.venue_en || <span className="mut">Not set</span>}</td>
                      <td><span className={`pill ${c.fee_type}`}>{feeText(c)}</span></td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{c.registered}{c.seats > 0 ? ` / ${c.seats}` : ''}</div>
                        {c.seats > 0
                          ? <div className="bar"><i className={pct >= 100 ? 'full' : ''} style={{ width: `${pct}%` }} /></div>
                          : <span className="mut" style={{ fontSize: 11 }}>No limit</span>}
                      </td>
                      <td>{statusSelect(c)}</td>
                      <td>
                        <div className="acts">
                          <button type="button" className="btn sm" onClick={() => openDetail(c, 'regs')}>Registrations</button>
                          <button type="button" className="btn sm" onClick={() => openEdit(c)}>Edit</button>
                          <button type="button" className="btn sm dng" onClick={() => setDelAsk({ ids: [c.id] })}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cards">
            {rows.map((c) => {
              const pct = c.seats > 0 ? Math.min(100, Math.round((c.registered / c.seats) * 100)) : 0;
              return (
                <article key={c.id} className="cardx">
                  <div className="cimg">
                    {c.image_url ? <img src={imgUrl(c.image_url)} alt="" /> : <div className="empty mut" style={{ padding: '52px 0' }}>No image</div>}
                    {statusSelect(c)}
                  </div>
                  <div className="cb">
                    <div style={{ minWidth: 0 }}>
                      <button type="button" className="btn link t" onClick={() => openDetail(c)} style={{ textAlign: 'left' }}>{c.title_en}</button>
                      {c.title_ta && <span className="s mut" style={{ display: 'block' }}>{c.title_ta}</span>}
                    </div>
                    <div className="mut">
                      {fmtD(c.start_date)}{d10(c.end_date) !== d10(c.start_date) ? ` – ${fmtD(c.end_date)}` : ''}
                      <br />{c.venue_en || 'Venue not set'} · {feeText(c)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 12 }}>
                        <span>Registered</span><span>{c.registered}{c.seats > 0 ? ` / ${c.seats}` : ' (no limit)'}</span>
                      </div>
                      {c.seats > 0 && <div className="bar" style={{ width: '100%' }}><i className={pct >= 100 ? 'full' : ''} style={{ width: `${pct}%` }} /></div>}
                    </div>
                    <div className="acts" style={{ marginTop: 'auto', justifyContent: 'flex-start' }}>
                      <button type="button" className="btn sm" onClick={() => openDetail(c, 'regs')}>Registrations</button>
                      <button type="button" className="btn sm" onClick={() => openEdit(c)}>Edit</button>
                      <button type="button" className="btn sm dng" onClick={() => setDelAsk({ ids: [c.id] })}>Delete</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && !loadErr && filtered.length > 0 && (
          <div className="pager">
            <span className="mut">
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="inp" style={{ width: 'auto' }} aria-label="Rows per page">
                {[10, 25, 50].map((n) => <option key={n} value={n}>{n} per page</option>)}
              </select>
              <button type="button" className="btn sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</button>
              <span>Page {safePage} of {pageCount}</span>
              <button type="button" className="btn sm" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next</button>
            </div>
          </div>
        )}
      </section>

      {/* ===== Detail drawer ===== */}
      {detail && (
        <div className="ov" onClick={() => setDetailId(null)}>
          <div className="drawer" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="dh">
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800 }}>{detail.title_en}</h2>
                {detail.title_ta && <p className="mut">{detail.title_ta}</p>}
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  {statusSelect(detail)}
                  <span className={`pill ${whenOf(detail, today)}`}>{whenOf(detail, today)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn primary" onClick={() => openEdit(detail)}>Edit</button>
                <button type="button" className="btn" onClick={() => setDetailId(null)}>Close</button>
              </div>
            </div>
            <div className="tabs">
              <button type="button" className={`tab${tab === 'overview' ? ' on' : ''}`} onClick={() => setTab('overview')}>Overview</button>
              <button type="button" className={`tab${tab === 'regs' ? ' on' : ''}`} onClick={() => setTab('regs')}>Registrations ({detail.registered})</button>
            </div>

            <div className="db">
              {tab === 'overview' ? (
                <>
                  {detail.image_url && <div className="banner"><img src={imgUrl(detail.image_url)} alt="" /></div>}
                  <dl className="facts">
                    <div><dt>Dates</dt><dd>{fmtD(detail.start_date)}{d10(detail.end_date) !== d10(detail.start_date) ? ` – ${fmtD(detail.end_date)}` : ''}</dd></div>
                    <div><dt>Time</dt><dd>{detail.start_time ? `${detail.start_time}${detail.end_time ? ` – ${detail.end_time}` : ''}` : 'Not set'}</dd></div>
                    <div><dt>Venue (English)</dt><dd>{detail.venue_en || 'Not set'}</dd></div>
                    <div><dt>Venue (தமிழ்)</dt><dd>{detail.venue_ta || 'Not set'}</dd></div>
                    <div><dt>Fee</dt><dd>{detail.fee_type === 'paid' ? `₹${detail.fee_amount} (paid at venue)` : 'Free'}</dd></div>
                    <div><dt>Seats</dt><dd>{detail.seats > 0 ? `${detail.registered} of ${detail.seats} filled` : `${detail.registered} registered (no limit)`}</dd></div>
                  </dl>
                  <div style={{ marginTop: 20 }}>
                    <h3 className="sech">Description (English)</h3>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{detail.description_en || 'None'}</p>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <h3 className="sech">Description (தமிழ்)</h3>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{detail.description_ta || 'None'}</p>
                  </div>
                  <div style={{ marginTop: 24 }}>
                    <button type="button" className="btn dng" onClick={() => setDelAsk({ ids: [detail.id] })}>Delete this camp</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                    <input value={regQ} onChange={(e) => setRegQ(e.target.value)} placeholder="Search name, mobile or email" className="inp" style={{ maxWidth: 280 }} aria-label="Search registrations" />
                    <span className="mut">{regPeople} people in {regs.length} registration{regs.length === 1 ? '' : 's'}</span>
                    <span style={{ flex: 1 }} />
                    <button type="button" className="btn primary" onClick={() => exportRegs(detail)}>Export to Excel</button>
                  </div>
                  {regLoading ? (
                    <div>{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ margin: '8px 0' }} />)}</div>
                  ) : regErr ? (
                    <div role="alert" className="alert bad">
                      {regErr} <button type="button" className="btn link" onClick={() => loadRegs(detail.id)}>Try again</button>
                    </div>
                  ) : regs.length === 0 ? (
                    <p className="empty mut">Nobody has registered yet.</p>
                  ) : regsShown.length === 0 ? (
                    <p className="empty mut">No registration matches that search.</p>
                  ) : (
                    <div className="tblwrap">
                      <table className="tbl narrow">
                        <thead><tr><th>Name</th><th>Mobile</th><th>People</th><th>Notes</th><th>Date</th></tr></thead>
                        <tbody>
                          {regsShown.map((r) => (
                            <tr key={r.id}>
                              <td><strong>{r.name}</strong>{r.email && <span className="mut" style={{ display: 'block', fontSize: 12 }}>{r.email}</span>}</td>
                              <td>{r.phone}</td>
                              <td>{r.members}</td>
                              <td className="mut">{r.notes}</td>
                              <td className="mut" style={{ whiteSpace: 'nowrap' }}>{r.created_at ? fmtD(String(r.created_at).slice(0, 10)) : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Add / edit drawer ===== */}
      {open && (
        <div className="ov" onClick={() => !saving && setOpen(false)}>
          <form onSubmit={save} noValidate onClick={(e) => e.stopPropagation()} className="drawer" style={{ maxWidth: 760 }}>
            <div className="dh">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800 }}>{editing ? 'Edit camp' : 'New camp'}</h2>
                <p className="mut">Fields marked * are required.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn">Close</button>
            </div>

            <div className="db">
              {errs.form && <div role="alert" className="alert bad">{errs.form}</div>}
              <div className="alert info">
                Type in English and the Tamil field fills in by itself. It is a phonetic spelling in Tamil script, not a translation, so please check it before saving.
              </div>
              {taFail && <div role="alert" className="alert bad">Auto-fill could not reach the Tamil conversion service. Type the Tamil text yourself.</div>}

              <section className="sec">
                <h3 className="sech">Basic details</h3>
                {renderPair('title_en', 'Title')}
                {renderPair('description_en', 'Description', 3)}
              </section>

              <section className="sec">
                <h3 className="sech">When and where</h3>
                <div className="g2">
                  <div>
                    <label className="lbl" htmlFor="c-sd">Start date *</label>
                    <input id="c-sd" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} className={inp('start_date')} />
                    {errs.start_date && <span role="alert" className="err">{errs.start_date}</span>}
                  </div>
                  <div>
                    <label className="lbl" htmlFor="c-ed">End date</label>
                    <input id="c-ed" type="date" value={form.end_date} min={form.start_date} onChange={(e) => set('end_date', e.target.value)} className={inp('end_date')} />
                    {errs.end_date && <span role="alert" className="err">{errs.end_date}</span>}
                  </div>
                  <div>
                    <label className="lbl" htmlFor="c-st">Start time</label>
                    <input id="c-st" type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} className="inp" />
                  </div>
                  <div>
                    <label className="lbl" htmlFor="c-et">End time</label>
                    <input id="c-et" type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} className="inp" />
                  </div>
                </div>
                {renderPair('venue_en', 'Venue')}
              </section>

              <section className="sec">
                <h3 className="sech">Registration</h3>
                <div className="g3">
                  <div>
                    <label className="lbl" htmlFor="c-fee">Fee</label>
                    <select id="c-fee" value={form.fee_type} onChange={(e) => set('fee_type', e.target.value)} className="inp">
                      <option value="free">Free</option><option value="paid">Paid at venue</option>
                    </select>
                  </div>
                  <div>
                    <label className="lbl" htmlFor="c-amt">Amount (₹)</label>
                    <input id="c-amt" type="number" min="0" disabled={form.fee_type === 'free'} value={form.fee_amount} onChange={(e) => set('fee_amount', e.target.value)} className={inp('fee_amount')} />
                    {errs.fee_amount && <span role="alert" className="err">{errs.fee_amount}</span>}
                  </div>
                  <div>
                    <label className="lbl" htmlFor="c-seats">Seats (0 = no limit)</label>
                    <input id="c-seats" type="number" min="0" value={form.seats} onChange={(e) => set('seats', e.target.value)} className={inp('seats')} />
                    {errs.seats && <span role="alert" className="err">{errs.seats}</span>}
                  </div>
                </div>
                <div>
                  <label className="lbl" htmlFor="c-status">Status</label>
                  <select id="c-status" value={form.status} onChange={(e) => set('status', e.target.value)} className="inp">
                    <option value="draft">Draft (hidden on the website)</option>
                    <option value="published">Published (registration open)</option>
                    <option value="closed">Closed (visible, registration closed)</option>
                  </select>
                </div>
              </section>

              <section className="sec">
                <h3 className="sech">Image</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className={`thumb${preview && !removeImg ? '' : ' empty-img'}`} style={{ width: 112, height: 80 }}>
                    {preview && !removeImg ? <img src={preview} alt="" /> : 'No image'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <label className="btn" style={{ cursor: 'pointer' }}>
                      {preview && !removeImg ? 'Change image' : 'Add image'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
                    </label>
                    {preview && !removeImg && <button type="button" onClick={() => { setRemoveImg(true); setFile(null); }} className="btn">Remove</button>}
                  </div>
                </div>
                {errs.image && <span role="alert" className="err">{errs.image}</span>}
              </section>
            </div>

            <div className="df">
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="btn">Cancel</button>
              <button type="submit" disabled={saving || anyBusy} className="btn primary">
                {saving ? 'Saving...' : anyBusy ? 'Converting Tamil...' : editing ? 'Save changes' : 'Create camp'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== Delete confirmation ===== */}
      {delAsk && (
        <div className="ov mid" onClick={() => !deleting && setDelAsk(null)}>
          <div className="modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 800 }}>
              Delete {delAsk.ids.length === 1 ? 'this camp' : `${delAsk.ids.length} camps`}?
            </h2>
            <p className="mut" style={{ marginTop: 8 }}>
              This also removes all registrations for {delAsk.ids.length === 1 ? 'it' : 'them'}. This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn" disabled={deleting} onClick={() => setDelAsk(null)}>Cancel</button>
              <button type="button" className="btn dfill" disabled={deleting} onClick={doDelete}>{deleting ? 'Deleting...' : 'Yes, delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}