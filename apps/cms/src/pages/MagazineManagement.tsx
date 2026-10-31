import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api/v1';
const API = `${API_BASE}/magazine`;

function getToken(): string {
  for (const k of ['token', 'admin_token', 'auth_token', 'accessToken', 'cms_token']) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return '';
}
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });
async function readJson(res: Response) { try { return await res.json(); } catch { return {}; } }
const dmy = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('.') : '');
const todayStr = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };
const addDaysStr = (s: string, n: number) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// English letters -> Tamil script (phonetic). Uses Google Input Tools, no API key.
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

type Acct = 'seva' | 'donation';
type Delivery = 'print' | 'digital' | 'both';
type PStatus = 'draft' | 'published';
interface Plan { id: string; name_en: string; name_ta: string | null; description_en: string | null; description_ta: string | null; features_en: string | null; features_ta: string | null; badge_en: string | null; badge_ta: string | null; duration_months: number; delivery: Delivery; price: number; pay_account: Acct; status: PStatus; sort_order: number; active_subs: number }
interface Sub { id: number; plan_name: string; delivery: Delivery; duration_months: number; amount: number; payment_mode: string; first_name: string; last_name: string; email: string; phone: string | null; address: string | null; city: string | null; state: string | null; pincode: string | null; start_date: string | null; end_date: string | null; status: 'PENDING' | 'ACTIVE' | 'EXPIRED'; receipt_no: string | null }

const DELIVERY_LABEL: Record<Delivery, string> = { print: 'Printed copy', digital: 'Digital only', both: 'Print and digital' };
const ACCT_LABEL: Record<Acct, string> = { seva: 'Seva account (SRI DAKSHINAMURTI SEVA SAMITI)', donation: 'Donation account (VEDANTA SASTHRA PRACHARA TRUST)' };
const MODE_LABEL: Record<string, string> = { online: 'Online', cash: 'Cash', upi: 'UPI', cheque: 'Cheque', bank: 'Bank transfer' };
const PERIODS = [12, 24, 36, 60, 120];
const durationText = (m: number) => (m % 12 === 0 ? `${m / 12} year${m / 12 === 1 ? '' : 's'}` : `${m} month${m === 1 ? '' : 's'}`);
const perYear = (price: number, months: number) => Math.round((price / months) * 12);

const emptyPlan = { name_en: '1 year subscription', name_ta: '', description_en: '', description_ta: '', features_en: '', features_ta: '', badge_en: '', badge_ta: '', duration_months: '12', delivery: 'print', price: '', pay_account: 'seva', status: 'draft', sort_order: '0' };
const emptyManual = { plan_id: '', first_name: '', last_name: '', email: '', country_code: '+91', phone: '', address: '', city: '', state: '', pincode: '', payment_mode: 'cash', payment_ref: '' };
const TA_KEYS = ['name_ta', 'badge_ta', 'description_ta', 'features_ta'];

const CSS = `
.mg{--p:#7a1c1c;--pd:#5e1414;--ink:#1f2937;--mut:#6b7280;--line:#e5e7eb;font-size:13px;color:var(--ink);}
.mg *{box-sizing:border-box;}
.mg p,.mg h1,.mg h2,.mg h3,.mg td,.mg th,.mg dt,.mg dd,.mg label,.mg span{color:inherit !important;background:transparent !important;}
.mg .mut{color:var(--mut) !important;}
.mg .head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;}
.mg .title{font-size:22px;font-weight:800;}
.mg .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #cfd4dc !important;background:#fff !important;color:var(--ink) !important;white-space:nowrap;}
.mg .btn:hover{background:#f3f4f6 !important;}
.mg .btn:disabled{opacity:.55;cursor:not-allowed;}
.mg .btn.primary{background:var(--p) !important;border-color:var(--p) !important;color:#fff !important;}
.mg .btn.primary:hover{background:var(--pd) !important;}
.mg .btn.dng{color:#b91c1c !important;border-color:#fca5a5 !important;}
.mg .btn.dfill{background:#dc2626 !important;border-color:#dc2626 !important;color:#fff !important;}
.mg .btn.sm{padding:5px 10px;font-size:12px;border-radius:6px;}
.mg .btn.link{border:none !important;background:transparent !important;padding:0;color:var(--p) !important;font-weight:700;}
.mg .card{background:#fff !important;border:1px solid var(--line);border-radius:10px;}
.mg .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;}
.mg .kpi{padding:14px 16px;border-left:4px solid var(--p);}
.mg .kl{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mut) !important;}
.mg .kv{font-size:26px;font-weight:800;margin-top:2px;}
@media(max-width:1000px){.mg .kpis{grid-template-columns:repeat(2,minmax(0,1fr));}}
.mg .tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);padding:0 14px;}
.mg .tab{padding:12px 16px;font-size:14px;font-weight:700;cursor:pointer;border:none !important;border-bottom:2px solid transparent !important;background:transparent !important;color:var(--mut) !important;}
.mg .tab.on{color:var(--p) !important;border-bottom-color:var(--p) !important;}
.mg .toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);}
.mg .grow{flex:1;}
.mg .chip{border-radius:999px;padding:6px 14px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid #cfd4dc !important;background:#fff !important;color:var(--ink) !important;}
.mg .chip.on{background:var(--p) !important;border-color:var(--p) !important;color:#fff !important;}
.mg .tblwrap{overflow-x:auto;}
.mg .tbl{width:100%;border-collapse:collapse;min-width:820px;}
.mg .tbl th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--mut) !important;background:#f9fafb !important;border-bottom:1px solid var(--line);white-space:nowrap;}
.mg .tbl td{padding:12px 14px;border-bottom:1px solid #f0f1f3;vertical-align:middle;}
.mg .pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;border:1px solid transparent;text-transform:capitalize;}
.mg .pill.published,.mg .pill.ACTIVE{background:#dcfce7 !important;color:#166534 !important;border-color:#86efac;}
.mg .pill.draft{background:#f1f5f9 !important;color:#334155 !important;border-color:#cbd5e1;}
.mg .pill.PENDING,.mg .pill.soon{background:#fef3c7 !important;color:#92400e !important;border-color:#fcd34d;}
.mg .pill.EXPIRED{background:#f1f5f9 !important;color:#64748b !important;border-color:#e2e8f0;}
.mg .pill.badge{background:#ede9fe !important;color:#5b21b6 !important;border-color:#c4b5fd;}
.mg select.pill{cursor:pointer;padding:3px 8px;}
.mg .acts{display:flex;gap:6px;justify-content:flex-end;}
.mg .empty{padding:52px 16px;text-align:center;}
.mg .skel{height:46px;margin:10px 14px;border-radius:8px;background:linear-gradient(90deg,#f1f2f4 25%,#e7e9ec 37%,#f1f2f4 63%);background-size:400% 100%;animation:mgsk 1.2s ease infinite;}
@keyframes mgsk{0%{background-position:100% 50%}100%{background-position:0 50%}}
.mg .ov{position:fixed;inset:0;z-index:70;display:flex;justify-content:flex-end;background:rgba(17,24,39,.45);}
.mg .ov.mid{justify-content:center;align-items:center;padding:16px;}
.mg .drawer{display:flex;flex-direction:column;height:100%;width:100%;max-width:720px;background:#fff !important;box-shadow:-12px 0 40px rgba(0,0,0,.2);}
.mg .dh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 22px;border-bottom:1px solid var(--line);}
.mg .db{flex:1;overflow-y:auto;padding:20px 22px;}
.mg .df{display:flex;justify-content:flex-end;gap:8px;padding:14px 22px;border-top:1px solid var(--line);background:#fafafa !important;}
.mg .modal{width:100%;max-width:420px;background:#fff !important;border-radius:12px;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.25);}
.mg .sech{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--mut) !important;margin:6px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line);}
.mg .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
.mg .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;}
@media(max-width:700px){.mg .g2,.mg .g3{grid-template-columns:1fr;}}
.mg .lblrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
.mg .lbl{display:block;font-size:12px;font-weight:700;margin-bottom:4px;}
.mg .lblrow .lbl{margin-bottom:0;}
.mg .inp{width:100%;border:1px solid #cfd4dc !important;border-radius:8px;padding:9px 11px;font-size:14px;background:#fff !important;color:var(--ink) !important;}
.mg .inp:focus{outline:2px solid #d97777;border-color:var(--p) !important;}
.mg .inp.bad{border-color:#ef4444 !important;background:#fef2f2 !important;}
.mg .toolbar .inp{width:auto;}
.mg .hint{font-size:11.5px;margin-top:4px;}
.mg .err{display:block;font-size:12px;font-weight:600;margin-top:4px;color:#b91c1c !important;}
.mg .alert{border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:14px;}
.mg .alert.ok{background:#dcfce7 !important;color:#166534 !important;border:1px solid #86efac;}
.mg .alert.bad{background:#fee2e2 !important;color:#991b1b !important;border:1px solid #fca5a5;}
.mg .alert.info{background:#eff6ff !important;color:#1e40af !important;border:1px solid #bfdbfe;}
.mg .detail{display:block;font-weight:400;margin-top:4px;word-break:break-word;}
.mg .summary{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border:1px solid #e9c46a;background:#fffbeb !important;border-radius:10px;padding:14px 16px;margin-top:6px;}
.mg .periods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:6px;}
@media(max-width:700px){.mg .periods{grid-template-columns:repeat(2,minmax(0,1fr));}}
.mg .per{border:2px solid #cfd4dc !important;border-radius:10px;padding:12px 10px;text-align:center;cursor:pointer;background:#fff !important;color:var(--ink) !important;font-size:15px;font-weight:800;}
.mg .per small{display:block;font-size:11px;font-weight:600;margin-top:2px;color:var(--mut) !important;}
.mg .per:hover{border-color:var(--p) !important;}
.mg .per.on{border-color:var(--p) !important;background:#f6e7e7 !important;color:var(--p) !important;}
`;

type LoadErr = { message: string; detail?: string } | null;

export default function MagazineManagement() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'plans' | 'subs'>('plans');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<{ plans: LoadErr; subs: LoadErr }>({ plans: null, subs: null });
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [q, setQ] = useState('');
  const [fPlan, setFPlan] = useState<'all' | PStatus>('all');
  const [fSub, setFSub] = useState<'all' | 'ACTIVE' | 'EXPIRED' | 'PENDING' | 'soon'>('all');

  // Plan drawer
  const [pOpen, setPOpen] = useState(false);
  const [pEdit, setPEdit] = useState<Plan | null>(null);
  const [pForm, setPForm] = useState({ ...emptyPlan });
  const [customDur, setCustomDur] = useState(false);

  // Manual subscriber drawer
  const [mOpen, setMOpen] = useState(false);
  const [mForm, setMForm] = useState({ ...emptyManual });

  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [delAsk, setDelAsk] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Tamil auto-fill
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [taFail, setTaFail] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const seq = useRef<Record<string, number>>({});

  const today = todayStr();
  const flash = useCallback((tone: 'ok' | 'err', text: string) => {
    setNotice({ tone, text });
    if (tone === 'ok') setTimeout(() => setNotice(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const get = async (p: string): Promise<any> => {
      const res = await fetch(`${API}${p}`, { headers: authHeader(), cache: 'no-store' });
      const body = await readJson(res);
      if (res.status === 401) throw { message: 'Your admin session has ended. Please sign in again.' };
      if (!res.ok) throw { message: body.message || `The server returned an error (${res.status}).`, detail: body.detail };
      return body;
    };
    const [b, c] = await Promise.allSettled([get('/admin/plans'), get('/admin/subscriptions')]);
    const asErr = (r: PromiseSettledResult<any>): LoadErr => (r.status === 'rejected' ? { message: r.reason?.message || 'Could not load.', detail: r.reason?.detail } : null);
    if (b.status === 'fulfilled') setPlans(b.value.plans || []);
    if (c.status === 'fulfilled') setSubs(c.value.subscriptions || []);
    setLoadErr({ plans: asErr(b), subs: asErr(c) });
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (setter: any, k: string, v: string) => { setter((f: any) => ({ ...f, [k]: v })); setErrs((e) => ({ ...e, [k]: '', form: '' })); };

  // ---------- Tamil auto-fill ----------
  const cancelTa = useCallback((k: string) => {
    clearTimeout(timers.current[k]);
    seq.current[k] = (seq.current[k] || 0) + 1;
    setBusy((b) => (b[k] ? { ...b, [k]: false } : b));
  }, []);
  const runTa = useCallback((ta: string, text: string, delay: number) => {
    cancelTa(ta);
    if (!text.trim()) { setPForm((f: any) => ({ ...f, [ta]: '' })); return; }
    const id = seq.current[ta];
    setBusy((b) => ({ ...b, [ta]: true }));
    timers.current[ta] = setTimeout(async () => {
      const out = await transliterate(text);
      if (seq.current[ta] !== id) return;
      setBusy((b) => ({ ...b, [ta]: false }));
      if (out === null) { setTaFail(true); return; }
      setTaFail(false);
      setPForm((f: any) => ({ ...f, [ta]: out }));
    }, delay);
  }, [cancelTa]);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  const resetTa = useCallback((initial: Record<string, boolean> = {}) => {
    TA_KEYS.forEach(cancelTa);
    setTouched(initial);
    setTaFail(false);
  }, [cancelTa]);

  const onEn = (en: string, ta: string, v: string, long = false) => {
    set(setPForm, en, v);
    if (!touched[ta]) runTa(ta, v, long ? 700 : 450);
  };
  const onTa = (en: string, ta: string, v: string) => {
    cancelTa(ta);
    set(setPForm, ta, v);
    if (v.trim() === '') {
      setTouched((t) => ({ ...t, [ta]: false }));
      const enVal = (pForm as any)[en] as string;
      if (enVal && enVal.trim()) runTa(ta, enVal, 0);
    } else setTouched((t) => ({ ...t, [ta]: true }));
  };
  const forceAuto = (en: string, ta: string) => {
    setTouched((t) => ({ ...t, [ta]: false }));
    runTa(ta, (pForm as any)[en], 0);
  };

  const pair = (en: string, ta: string, label: string, opts: { rows?: number; placeholder?: string; hint?: string; required?: boolean; max?: number; long?: boolean } = {}) => {
    const vals: any = pForm;
    const Tag: any = opts.rows ? 'textarea' : 'input';
    const extra = opts.rows ? { rows: opts.rows } : {};
    return (
      <div className="g2">
        <div>
          <label className="lbl" htmlFor={`f-${en}`}>{label} (English){opts.required ? ' *' : ''}</label>
          <Tag id={`f-${en}`} {...extra} maxLength={opts.max} placeholder={opts.placeholder} value={vals[en]} onChange={(e: any) => onEn(en, ta, e.target.value, opts.long)} className={`inp${errs[en] ? ' bad' : ''}`} />
          {errs[en] && <span role="alert" className="err">{errs[en]}</span>}
          {opts.hint && <p className="hint mut">{opts.hint}</p>}
        </div>
        <div>
          <div className="lblrow">
            <label className="lbl" htmlFor={`f-${ta}`}>{label} (தமிழ்)</label>
            <button type="button" className="btn link" disabled={!String(vals[en] || '').trim() || busy[ta]} onClick={() => forceAuto(en, ta)}>Auto-fill</button>
          </div>
          <Tag id={`f-${ta}`} {...extra} maxLength={opts.max} value={vals[ta]} onChange={(e: any) => onTa(en, ta, e.target.value)} className="inp" />
          <p className="hint mut">{busy[ta] ? 'Converting to Tamil...' : touched[ta] ? 'Edited by you. It will not be overwritten.' : 'Fills in automatically from the English text.'}</p>
        </div>
      </div>
    );
  };
  const anyBusy = Object.values(busy).some(Boolean);

  // ----- open forms -----
  const openNewPlan = useCallback(() => {
    resetTa();
    setPEdit(null); setPForm({ ...emptyPlan }); setCustomDur(false); setErrs({}); setPOpen(true);
    runTa('name_ta', emptyPlan.name_en, 200);
  }, [resetTa, runTa]);
  const openEditPlan = (p: Plan) => {
    resetTa({ name_ta: !!p.name_ta, badge_ta: !!p.badge_ta, description_ta: !!p.description_ta, features_ta: !!p.features_ta });
    setPEdit(p);
    setPForm({
      name_en: p.name_en, name_ta: p.name_ta || '', description_en: p.description_en || '', description_ta: p.description_ta || '',
      features_en: p.features_en || '', features_ta: p.features_ta || '', badge_en: p.badge_en || '', badge_ta: p.badge_ta || '',
      duration_months: String(p.duration_months), delivery: p.delivery, price: String(p.price), pay_account: p.pay_account, status: p.status, sort_order: String(p.sort_order),
    });
    setCustomDur(!PERIODS.includes(p.duration_months));
    setErrs({}); setPOpen(true);
  };
  const openManual = () => { setMForm({ ...emptyManual, plan_id: plans.find((p) => p.status === 'published')?.id || plans[0]?.id || '' }); setErrs({}); setMOpen(true); };

  // The top-bar button opens a new plan through ?new=1
  useEffect(() => {
    if (params.get('new') === '1') {
      setTab('plans');
      openNewPlan();
      const next = new URLSearchParams(params); next.delete('new'); setParams(next, { replace: true });
    }
  }, [params, setParams, openNewPlan]);

  function pickPeriod(m: number | 'custom') {
    setErrs((e) => ({ ...e, duration_months: '', form: '' }));
    if (m === 'custom') { setCustomDur(true); setPForm((f) => ({ ...f, duration_months: '' })); return; }
    setCustomDur(false);
    const prevAuto = `${durationText(Number(pForm.duration_months))} subscription`;
    const auto = pForm.name_en.trim() === '' || pForm.name_en === prevAuto;
    const newName = `${durationText(m)} subscription`;
    setPForm((f) => ({ ...f, duration_months: String(m), name_en: auto ? newName : f.name_en }));
    if (auto && !touched.name_ta) runTa('name_ta', newName, 300);
  }

  const failText = (d: any, fallback: string) => `${d.message || fallback}${d.detail ? ` (${d.detail})` : ''}`;

  // ----- save -----
  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const x: Record<string, string> = {};
    if (!pForm.name_en.trim()) x.name_en = 'Enter the plan name';
    if (!(Number(pForm.duration_months) >= 1)) x.duration_months = 'Choose or enter the subscription period';
    if (!(Number(pForm.price) > 0)) x.price = 'Enter the fixed amount';
    setErrs(x);
    if (Object.keys(x).length) return;
    setSaving(true);
    try {
      const res = await fetch(pEdit ? `${API}/admin/plans/${pEdit.id}` : `${API}/admin/plans`, {
        method: pEdit ? 'PUT' : 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify(pForm),
      });
      const d = await readJson(res);
      if (!res.ok) { setErrs({ form: failText(d, 'Could not save the plan.') }); return; }
      resetTa(); setPOpen(false); flash('ok', pEdit ? 'Plan saved.' : 'Plan added.'); load();
    } catch { setErrs({ form: 'Network error. Please try again.' }); } finally { setSaving(false); }
  }

  const mPlan = plans.find((p) => p.id === mForm.plan_id) || null;
  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const x: Record<string, string> = {};
    if (!mPlan) x.plan_id = 'Choose a plan';
    if (!mForm.first_name.trim()) x.first_name = 'Enter the first name';
    if (!mForm.last_name.trim()) x.last_name = 'Enter the last name';
    if (!/^\S+@\S+\.\S+$/.test(mForm.email.trim())) x.email = 'Enter a valid email';
    if (mForm.phone.replace(/\D/g, '').length < 6) x.phone = 'Enter the mobile number';
    if (mPlan && mPlan.delivery !== 'digital') {
      if (mForm.address.trim().length < 5) x.address = 'Enter the postal address';
      if (!mForm.city.trim()) x.city = 'Enter the city';
      if (!mForm.state.trim()) x.state = 'Enter the state';
      if (!/^\d{6}$/.test(mForm.pincode.trim())) x.pincode = 'Enter a 6 digit pincode';
    }
    setErrs(x);
    if (Object.keys(x).length) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/subscriptions/manual`, { method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify(mForm) });
      const d = await readJson(res);
      if (!res.ok) { setErrs(d.field ? { [d.field]: d.message } : { form: failText(d, 'Could not add the subscriber.') }); return; }
      setMOpen(false); flash('ok', `Subscriber added. Receipt ${d.receiptNo || ''} was created and emailed.`); load();
    } catch { setErrs({ form: 'Network error. Please try again.' }); } finally { setSaving(false); }
  }

  async function setPlanStatus(id: string, status: string) {
    try {
      const res = await fetch(`${API}/admin/plans/${id}/status`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error((await readJson(res)).message);
      setPlans((l) => l.map((x) => (x.id === id ? { ...x, status: status as PStatus } : x)));
    } catch (e: any) { flash('err', e?.message || 'Could not change the status.'); }
  }

  async function doDelete() {
    if (!delAsk) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/admin/plans/${delAsk.id}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) throw new Error((await readJson(res)).message);
      flash('ok', 'Plan deleted.');
      setDelAsk(null); load();
    } catch (e: any) { setDelAsk(null); flash('err', e?.message || 'Could not delete.'); } finally { setDeleting(false); }
  }

  async function download(path: string, name: string) {
    try {
      const res = await fetch(`${API}${path}`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
    } catch { flash('err', 'Download failed.'); }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (delAsk) { if (!deleting) setDelAsk(null); }
      else if (pOpen) { if (!saving) setPOpen(false); }
      else if (mOpen) { if (!saving) setMOpen(false); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [delAsk, deleting, pOpen, mOpen, saving]);

  // ----- derived -----
  const soonEnd = addDaysStr(today, 30);
  const isSoon = (s: Sub) => s.status === 'ACTIVE' && !!s.end_date && s.end_date <= soonEnd;
  const activeSubs = subs.filter((s) => s.status === 'ACTIVE');
  const collected = subs.filter((s) => s.status === 'ACTIVE' || s.status === 'EXPIRED').reduce((t, s) => t + s.amount, 0);
  const nPub = plans.filter((p) => p.status === 'published').length;
  const nDraft = plans.filter((p) => p.status === 'draft').length;

  const t = q.trim().toLowerCase();
  const plansShown = useMemo(() => plans.filter((p) => (fPlan === 'all' || p.status === fPlan) && (!t || `${p.name_en} ${p.name_ta || ''}`.toLowerCase().includes(t))), [plans, fPlan, t]);
  const subsShown = useMemo(() => subs.filter((s) => {
    if (fSub === 'soon' ? !isSoon(s) : fSub !== 'all' && s.status !== fSub) return false;
    return !t || `${s.first_name} ${s.last_name} ${s.email} ${s.phone || ''} ${s.receipt_no || ''} ${s.plan_name}`.toLowerCase().includes(t);
  }), [subs, fSub, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const inp = (k: string) => `inp${errs[k] ? ' bad' : ''}`;
  const currentErr = tab === 'plans' ? loadErr.plans : loadErr.subs;
  const errBox = (e: NonNullable<LoadErr>) => (
    <div role="alert" className="empty">
      <p style={{ fontSize: 15, fontWeight: 800 }}>This list could not be loaded</p>
      <p className="mut" style={{ marginTop: 4 }}>{e.message}</p>
      {e.detail && <p className="detail mut">Reason: {e.detail}</p>}
      <div style={{ marginTop: 16 }}><button type="button" className="btn" onClick={load}>Try again</button></div>
    </div>
  );

  return (
    <div className="mg">
      <style>{CSS}</style>
      <div className="head">
        <div>
          <h1 className="title">Magazine subscriptions</h1>
          <p className="mut" style={{ marginTop: 2 }}>Subscription plans, and everyone who has subscribed.</p>
        </div>
        {tab === 'subs'
          ? <button type="button" className="btn primary" onClick={openManual} disabled={plans.length === 0}>+ Add subscriber</button>
          : <button type="button" className="btn primary" onClick={openNewPlan}>+ New Plan</button>}
      </div>

      {notice && (
        <div role={notice.tone === 'err' ? 'alert' : 'status'} className={`alert ${notice.tone === 'ok' ? 'ok' : 'bad'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>{notice.text}</span><button type="button" className="btn sm" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}

      <div className="kpis">
        <div className="card kpi"><p className="kl">Published plans</p><p className="kv" style={{ color: '#166534' }}>{nPub}</p></div>
        <div className="card kpi"><p className="kl">Draft plans</p><p className="kv" style={{ color: '#475569' }}>{nDraft}</p></div>
        <div className="card kpi"><p className="kl">Active subscribers</p><p className="kv">{activeSubs.length}</p></div>
        <div className="card kpi"><p className="kl">Collected</p><p className="kv" style={{ color: '#6d28d9' }}>₹{collected.toLocaleString('en-IN')}</p></div>
      </div>

      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="tabs">
          <button type="button" className={`tab${tab === 'plans' ? ' on' : ''}`} onClick={() => setTab('plans')}>Subscription plans ({plans.length})</button>
          <button type="button" className={`tab${tab === 'subs' ? ' on' : ''}`} onClick={() => setTab('subs')}>Subscribers ({subs.length})</button>
        </div>

        <div className="toolbar">
          {tab === 'plans' && (
            <>
              {([['all', `All ${plans.length}`], ['published', `Published ${nPub}`], ['draft', `Draft ${nDraft}`]] as const).map(([k, label]) => (
                <button key={k} type="button" className={`chip${fPlan === k ? ' on' : ''}`} onClick={() => setFPlan(k)}>{label}</button>
              ))}
            </>
          )}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search" className="inp" style={{ width: 260, maxWidth: '100%' }} />
          {tab === 'subs' && (
            <select value={fSub} onChange={(e) => setFSub(e.target.value as any)} className="inp" aria-label="Filter">
              <option value="all">All subscribers</option>
              <option value="ACTIVE">Active</option>
              <option value="soon">Expiring within 30 days</option>
              <option value="EXPIRED">Expired</option>
              <option value="PENDING">Waiting for payment</option>
            </select>
          )}
          <span className="grow" />
          {tab === 'subs' && (
            <>
              <button type="button" className="btn" onClick={() => download('/admin/subscriptions/labels', 'magazine-labels.csv')}>Address labels (Excel)</button>
              <button type="button" className="btn" onClick={() => download('/admin/subscriptions/export', 'magazine-subscribers.csv')}>Export subscribers (Excel)</button>
            </>
          )}
        </div>

        {loading ? (
          <div>{[0, 1, 2].map((i) => <div key={i} className="skel" />)}</div>
        ) : currentErr ? errBox(currentErr)
        : tab === 'plans' ? (
          plansShown.length === 0 ? (
            <div className="empty">
              <p style={{ fontSize: 16, fontWeight: 800 }}>{plans.length === 0 ? 'No subscription plans yet' : 'No plan matches this filter'}</p>
              {plans.length === 0 && <div style={{ marginTop: 16 }}><button type="button" className="btn primary" onClick={openNewPlan}>+ Add the first plan</button></div>}
            </div>
          ) : (
            <div className="tblwrap">
              <table className="tbl" style={{ minWidth: 980 }}>
                <thead><tr><th>Plan</th><th>Duration</th><th>Delivery</th><th>Amount</th><th>Per year</th><th>Payment account</th><th>Active</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {plansShown.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.name_en}</strong>{p.badge_en && <span className="pill badge" style={{ marginLeft: 8 }}>{p.badge_en}</span>}{p.name_ta && <span className="mut" style={{ display: 'block' }}>{p.name_ta}</span>}</td>
                      <td>{durationText(p.duration_months)}</td>
                      <td>{DELIVERY_LABEL[p.delivery]}</td>
                      <td style={{ fontWeight: 700 }}>₹{p.price.toLocaleString('en-IN')}</td>
                      <td>₹{perYear(p.price, p.duration_months).toLocaleString('en-IN')}</td>
                      <td>{p.pay_account === 'donation' ? 'Donation account' : 'Seva account'}</td>
                      <td>{p.active_subs}</td>
                      <td>
                        <select value={p.status} onChange={(e) => setPlanStatus(p.id, e.target.value)} aria-label={`Status of ${p.name_en}`} className={`pill ${p.status}`}>
                          <option value="draft">draft</option><option value="published">published</option>
                        </select>
                      </td>
                      <td><div className="acts">
                        <button type="button" className="btn sm" onClick={() => openEditPlan(p)}>Edit</button>
                        <button type="button" className="btn sm dng" onClick={() => setDelAsk({ id: p.id, name: p.name_en })}>Delete</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : subsShown.length === 0 ? (
          <div className="empty">
            <p style={{ fontSize: 16, fontWeight: 800 }}>{subs.length === 0 ? 'No subscribers yet' : 'No subscriber matches these filters'}</p>
            {subs.length === 0 && plans.length > 0 && <div style={{ marginTop: 16 }}><button type="button" className="btn primary" onClick={openManual}>+ Add a subscriber</button></div>}
          </div>
        ) : (
          <div className="tblwrap">
            <table className="tbl" style={{ minWidth: 1080 }}>
              <thead><tr><th>Subscriber</th><th>Plan</th><th>Delivery address</th><th>Valid</th><th>Amount</th><th>Paid by</th><th>Receipt</th><th>Status</th></tr></thead>
              <tbody>
                {subsShown.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.first_name} {s.last_name}</strong><span className="mut" style={{ display: 'block' }}>{s.email}</span><span className="mut" style={{ display: 'block' }}>{s.phone}</span></td>
                    <td>{s.plan_name}<span className="mut" style={{ display: 'block' }}>{DELIVERY_LABEL[s.delivery]}</span></td>
                    <td style={{ maxWidth: 240 }}>{s.address ? <>{s.address}<span className="mut" style={{ display: 'block' }}>{[s.city, s.state, s.pincode].filter(Boolean).join(', ')}</span></> : <span className="mut">Digital only</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{s.start_date ? `${dmy(s.start_date)} - ${dmy(s.end_date)}` : <span className="mut">-</span>}</td>
                    <td style={{ fontWeight: 700 }}>₹{s.amount.toLocaleString('en-IN')}</td>
                    <td>{MODE_LABEL[s.payment_mode] || s.payment_mode}</td>
                    <td>{s.receipt_no || <span className="mut">-</span>}</td>
                    <td><span className={`pill ${s.status}`}>{s.status === 'PENDING' ? 'Waiting for payment' : s.status.toLowerCase()}</span>{isSoon(s) && <span className="pill soon" style={{ marginLeft: 6 }}>Expiring soon</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Plan drawer (new / edit) */}
      {pOpen && (
        <div className="ov" onClick={() => !saving && setPOpen(false)}>
          <form onSubmit={savePlan} noValidate onClick={(e) => e.stopPropagation()} className="drawer">
            <div className="dh">
              <div><h2 style={{ fontSize: 18, fontWeight: 800 }}>{pEdit ? 'Edit subscription plan' : 'New subscription plan'}</h2><p className="mut">Fields marked * are required.</p></div>
              <button type="button" className="btn" onClick={() => setPOpen(false)}>Close</button>
            </div>
            <div className="db">
              {errs.form && <div role="alert" className="alert bad">{errs.form}</div>}
              <div className="alert info">Type in English and the Tamil field fills in by itself. It is a phonetic spelling in Tamil script, not a translation, so please check it before saving.</div>
              {taFail && <div role="alert" className="alert bad">Auto-fill could not reach the Tamil conversion service. Type the Tamil text yourself.</div>}

              <h3 className="sech">Subscription period *</h3>
              <div className="periods" role="radiogroup" aria-label="Subscription period">
                {PERIODS.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={!customDur && Number(pForm.duration_months) === m}
                    className={`per${!customDur && Number(pForm.duration_months) === m ? ' on' : ''}`} onClick={() => pickPeriod(m)}>
                    {durationText(m)}<small>{m} months</small>
                  </button>
                ))}
                <button type="button" role="radio" aria-checked={customDur} className={`per${customDur ? ' on' : ''}`} onClick={() => pickPeriod('custom')}>
                  Other<small>enter months</small>
                </button>
              </div>
              {customDur && (
                <div style={{ marginBottom: 14, maxWidth: 220 }}>
                  <label className="lbl" htmlFor="p-cm">Number of months</label>
                  <input id="p-cm" type="number" min="1" max="240" value={pForm.duration_months} onChange={(e) => set(setPForm, 'duration_months', e.target.value)} className={inp('duration_months')} />
                </div>
              )}
              {errs.duration_months && <span role="alert" className="err" style={{ marginBottom: 10 }}>{errs.duration_months}</span>}

              <h3 className="sech" style={{ marginTop: 18 }}>Plan name</h3>
              {pair('name_en', 'name_ta', 'Name', { required: true })}
              {pair('badge_en', 'badge_ta', 'Badge', { max: 40, placeholder: 'Best value' })}

              <h3 className="sech">Fixed amount and delivery</h3>
              <div className="g3">
                <div>
                  <label className="lbl" htmlFor="p-pr">Fixed amount (₹) *</label>
                  <input id="p-pr" type="number" min="1" value={pForm.price} onChange={(e) => set(setPForm, 'price', e.target.value)} className={inp('price')} />
                  {errs.price && <span role="alert" className="err">{errs.price}</span>}
                </div>
                <div>
                  <label className="lbl">Works out per year</label>
                  <div className="inp">{Number(pForm.price) > 0 && Number(pForm.duration_months) > 0 ? `₹${perYear(Number(pForm.price), Number(pForm.duration_months)).toLocaleString('en-IN')}` : '-'}</div>
                </div>
                <div>
                  <label className="lbl" htmlFor="p-so">Order on the website</label>
                  <input id="p-so" type="number" value={pForm.sort_order} onChange={(e) => set(setPForm, 'sort_order', e.target.value)} className="inp" />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="lbl" htmlFor="p-del">Delivery</label>
                <select id="p-del" value={pForm.delivery} onChange={(e) => set(setPForm, 'delivery', e.target.value)} className="inp">
                  <option value="print">Printed copy by post</option><option value="digital">Digital only</option><option value="both">Print and digital</option>
                </select>
                <p className="hint mut">A postal address is asked only for printed plans.</p>
              </div>

              <h3 className="sech">Description shown to the visitor</h3>
              {pair('description_en', 'description_ta', 'Short description', { rows: 3, long: true })}
              {pair('features_en', 'features_ta', 'What is included', { rows: 5, long: true, placeholder: '12 monthly issues\nPrinted copy by post', hint: 'One point per line. Each line shows as a tick on the website.' })}

              <h3 className="sech">Payment account and visibility</h3>
              <div style={{ marginBottom: 14 }}>
                <label className="lbl" htmlFor="p-acct">Payment account</label>
                <select id="p-acct" value={pForm.pay_account} onChange={(e) => set(setPForm, 'pay_account', e.target.value)} className="inp">
                  <option value="seva">{ACCT_LABEL.seva}</option><option value="donation">{ACCT_LABEL.donation}</option>
                </select>
                <p className="hint mut">Online payments go to this Razorpay account, and its name shows in the payment window and on the receipt.</p>
              </div>
              <div>
                <label className="lbl" htmlFor="p-st">Status</label>
                <select id="p-st" value={pForm.status} onChange={(e) => set(setPForm, 'status', e.target.value)} className="inp">
                  <option value="draft">Draft (hidden on the website)</option><option value="published">Published (open for subscription)</option>
                </select>
              </div>
            </div>
            <div className="df">
              <button type="button" className="btn" disabled={saving} onClick={() => setPOpen(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={saving || anyBusy}>{saving ? 'Saving...' : anyBusy ? 'Converting Tamil...' : pEdit ? 'Save changes' : 'Save plan'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Add subscriber (payment received outside the website) */}
      {mOpen && (
        <div className="ov" onClick={() => !saving && setMOpen(false)}>
          <form onSubmit={saveManual} noValidate onClick={(e) => e.stopPropagation()} className="drawer">
            <div className="dh">
              <div><h2 style={{ fontSize: 18, fontWeight: 800 }}>Add subscriber</h2><p className="mut">For a payment received by cash, UPI, cheque or bank transfer.</p></div>
              <button type="button" className="btn" onClick={() => setMOpen(false)}>Close</button>
            </div>
            <div className="db">
              {errs.form && <div role="alert" className="alert bad">{errs.form}</div>}
              <div className="alert info">The subscription starts now, a receipt number is created, and the receipt is emailed to the subscriber.</div>

              <h3 className="sech">Plan</h3>
              <div style={{ marginBottom: 14 }}>
                <label className="lbl" htmlFor="m-plan">Choose the subscription *</label>
                <select id="m-plan" value={mForm.plan_id} onChange={(e) => set(setMForm, 'plan_id', e.target.value)} className={inp('plan_id')}>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name_en} - {durationText(p.duration_months)} - ₹{p.price.toLocaleString('en-IN')}{p.status === 'draft' ? ' (draft)' : ''}</option>)}
                </select>
                {errs.plan_id && <span role="alert" className="err">{errs.plan_id}</span>}
                {mPlan && (
                  <div className="summary">
                    <div><p className="kl">{durationText(mPlan.duration_months)} · {DELIVERY_LABEL[mPlan.delivery]}</p><p className="mut">Receipt in the name of {mPlan.pay_account === 'donation' ? 'VEDANTA SASTHRA PRACHARA TRUST' : 'SRI DAKSHINAMURTI SEVA SAMITI'}</p></div>
                    <p style={{ fontSize: 24, fontWeight: 800 }}>₹{mPlan.price.toLocaleString('en-IN')}</p>
                  </div>
                )}
              </div>

              <h3 className="sech">Subscriber</h3>
              <div className="g2">
                <div><label className="lbl" htmlFor="m-fn">First name *</label><input id="m-fn" value={mForm.first_name} onChange={(e) => set(setMForm, 'first_name', e.target.value)} className={inp('first_name')} />{errs.first_name && <span role="alert" className="err">{errs.first_name}</span>}</div>
                <div><label className="lbl" htmlFor="m-ln">Last name *</label><input id="m-ln" value={mForm.last_name} onChange={(e) => set(setMForm, 'last_name', e.target.value)} className={inp('last_name')} />{errs.last_name && <span role="alert" className="err">{errs.last_name}</span>}</div>
                <div><label className="lbl" htmlFor="m-em">Email *</label><input id="m-em" type="email" value={mForm.email} onChange={(e) => set(setMForm, 'email', e.target.value)} className={inp('email')} />{errs.email && <span role="alert" className="err">{errs.email}</span>}</div>
                <div>
                  <label className="lbl" htmlFor="m-ph">Mobile *</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input aria-label="Country code" value={mForm.country_code} onChange={(e) => set(setMForm, 'country_code', e.target.value)} className="inp" style={{ width: 80 }} />
                    <input id="m-ph" inputMode="numeric" value={mForm.phone} onChange={(e) => set(setMForm, 'phone', e.target.value.replace(/\D/g, '').slice(0, 15))} className={inp('phone')} />
                  </div>
                  {errs.phone && <span role="alert" className="err">{errs.phone}</span>}
                </div>
              </div>

              {mPlan && mPlan.delivery !== 'digital' && (
                <>
                  <h3 className="sech">Postal address</h3>
                  <div style={{ marginBottom: 14 }}>
                    <label className="lbl" htmlFor="m-ad">Address *</label>
                    <textarea id="m-ad" rows={2} value={mForm.address} onChange={(e) => set(setMForm, 'address', e.target.value)} className={inp('address')} />
                    {errs.address && <span role="alert" className="err">{errs.address}</span>}
                  </div>
                  <div className="g3">
                    <div><label className="lbl" htmlFor="m-ci">City *</label><input id="m-ci" value={mForm.city} onChange={(e) => set(setMForm, 'city', e.target.value)} className={inp('city')} />{errs.city && <span role="alert" className="err">{errs.city}</span>}</div>
                    <div><label className="lbl" htmlFor="m-st">State *</label><input id="m-st" value={mForm.state} onChange={(e) => set(setMForm, 'state', e.target.value)} className={inp('state')} />{errs.state && <span role="alert" className="err">{errs.state}</span>}</div>
                    <div><label className="lbl" htmlFor="m-pc">Pincode *</label><input id="m-pc" inputMode="numeric" value={mForm.pincode} onChange={(e) => set(setMForm, 'pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} className={inp('pincode')} />{errs.pincode && <span role="alert" className="err">{errs.pincode}</span>}</div>
                  </div>
                </>
              )}

              <h3 className="sech">Payment received</h3>
              <div className="g2">
                <div>
                  <label className="lbl" htmlFor="m-mode">Received by *</label>
                  <select id="m-mode" value={mForm.payment_mode} onChange={(e) => set(setMForm, 'payment_mode', e.target.value)} className="inp">
                    <option value="cash">Cash</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="bank">Bank transfer</option>
                  </select>
                </div>
                <div>
                  <label className="lbl" htmlFor="m-ref">Reference (optional)</label>
                  <input id="m-ref" value={mForm.payment_ref} onChange={(e) => set(setMForm, 'payment_ref', e.target.value)} placeholder="UPI id, cheque no or transaction no" className="inp" />
                </div>
              </div>
            </div>
            <div className="df">
              <button type="button" className="btn" disabled={saving} onClick={() => setMOpen(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving...' : mPlan ? `Confirm ₹${mPlan.price.toLocaleString('en-IN')} received` : 'Add subscriber'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      {delAsk && (
        <div className="ov mid" onClick={() => !deleting && setDelAsk(null)}>
          <div className="modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 800 }}>Delete this plan?</h2>
            <p className="mut" style={{ marginTop: 8 }}>{delAsk.name}. People who already subscribed keep their subscription and receipt. This cannot be undone.</p>
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