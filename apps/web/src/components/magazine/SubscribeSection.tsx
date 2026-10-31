'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { COUNTRY_CODES } from '@/data/countryCodes';
import { loadRazorpayScript } from '@/lib/razorpay';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const TOKEN_KEY = 'devotee_token';

type Plan = { id: string; name_en: string; name_ta: string | null; description_en: string | null; description_ta: string | null; features_en: string | null; features_ta: string | null; badge_en: string | null; badge_ta: string | null; duration_months: number; delivery: 'print' | 'digital' | 'both'; price: number };
type MySub = { id: number; plan_id: string; plan_name: string; delivery: string; amount: number; start_date: string; end_date: string; status: 'ACTIVE' | 'EXPIRED'; receipt_no: string | null };
type Receipt = { id: number; receipt_no: string; plan_name: string; delivery: string; amount: number; start_date: string; end_date: string; first_name: string; last_name: string; email: string; phone: string; address: string | null; city: string | null; state: string | null; pincode: string | null; razorpay_payment_id: string | null; payment_mode: string; org: string };
type Props = { t?: any; locale: string };

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,59}$/u;
const PLACE_RE = /^[\p{L}\p{M}][\p{L}\p{M} .-]{0,59}$/u;
const EMAIL_RE = /^[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const cleanName = (v: string) => v.replace(/[^\p{L}\p{M} .'-]/gu, '').replace(/\s{2,}/g, ' ').slice(0, 60);
const cleanPlace = (v: string) => v.replace(/[^\p{L}\p{M} .-]/gu, '').replace(/\s{2,}/g, ' ').slice(0, 60);
const cleanEmail = (v: string) => v.replace(/[^A-Za-z0-9._+\-@]/g, '').slice(0, 100);
const cleanAddr = (v: string) => v.replace(/[^\p{L}\p{M}\p{N} ,.\-/#()\n]/gu, '').slice(0, 300);
const rupees = (n: number) => `₹ ${Number(n).toLocaleString('en-IN')}`;
const dmy = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('.') : '');
async function readJson(res: Response) { try { return await res.json(); } catch { return {}; } }
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const daysUntil = (s: string) => Math.round((new Date(`${s}T00:00:00`).getTime() - new Date(`${todayStr()}T00:00:00`).getTime()) / 86400000);
const perYear = (price: number, months: number) => Math.round((price / months) * 12);
// Same rule as the server: starts today, or the day after the current period ends
function validity(startFrom: string, months: number) {
  const s = new Date(`${startFrom}T00:00:00`);
  const e = new Date(s);
  e.setMonth(e.getMonth() + months);
  e.setDate(e.getDate() - 1);
  return { start: ymd(s), end: ymd(e) };
}
const lines = (v: string | null) => (v || '').split('\n').map((x) => x.trim()).filter(Boolean);

type Form = { first: string; last: string; email: string; cc: string; phone: string; address: string; city: string; state: string; pincode: string };
const emptyForm: Form = { first: '', last: '', email: '', cc: '+91', phone: '', address: '', city: '', state: '', pincode: '' };
const inputCls = (bad?: boolean) => `h-12 w-full rounded-md border px-3.5 text-base text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-2 ${bad ? 'border-red-500 bg-red-50 focus:ring-red-300' : 'border-sand bg-white focus:border-maroon focus:ring-saffron/40'}`;

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div data-field={id}>
      <label htmlFor={id} className={`mb-1.5 block text-sm font-bold ${error ? 'text-red-700' : 'text-charcoal'}`}>{label}</label>
      {children}
      {error && <p role="alert" className="mt-1 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}

export default function SubscribeSection({ locale }: Props) {
  const isTa = locale === 'ta';
  const tr = (en: string, ta: string) => (isTa ? ta : en);
  const loginHref = `/${locale}/login?redirect=${encodeURIComponent(`/${locale}/magazine`)}`;
  const token = () => (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mine, setMine] = useState<MySub[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [active, setActive] = useState<Plan | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [f, setF] = useState<Form>({ ...emptyForm });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [done, setDone] = useState<{ plan: string; receiptId: number } | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/magazine/plans`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setPlans((await res.json()).plans || []);
    } catch {
      setError(tr('The plans could not be loaded right now. Please try again.', 'திட்டங்களை இப்போது ஏற்ற இயலவில்லை. மீண்டும் முயற்சிக்கவும்.'));
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const loadMine = useCallback(async () => {
    const tk = token();
    if (!tk) { setMine([]); return; }
    try {
      const res = await fetch(`${API_BASE}/magazine/my`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' });
      if (res.ok) setMine((await res.json()).subscriptions || []);
    } catch { /* optional */ }
  }, []);

  useEffect(() => { loadPlans(); loadMine(); }, [loadPlans, loadMine]);

  const durationText = (m: number) => (m % 12 === 0 ? `${m / 12} ${tr(m / 12 === 1 ? 'year' : 'years', 'ஆண்டு')}` : `${m} ${tr(m === 1 ? 'month' : 'months', 'மாதம்')}`);
  const deliveryText = (d: string) => (d === 'print' ? tr('Printed copy by post', 'அஞ்சலில் அச்சு இதழ்') : d === 'digital' ? tr('Digital issues', 'மின் இதழ்கள்') : tr('Printed copy and digital issues', 'அச்சு மற்றும் மின் இதழ்கள்'));
  const modeText = (m: string) => ({ online: tr('Online', 'இணையவழி'), cash: tr('Cash', 'ரொக்கம்'), upi: 'UPI', cheque: tr('Cheque', 'காசோலை'), bank: tr('Bank transfer', 'வங்கி பரிமாற்றம்') } as Record<string, string>)[m] || m;

  // Where a new period would start for this devotee
  const latestEnd = mine.filter((s) => s.status === 'ACTIVE').map((s) => s.end_date).sort().pop();
  const startFrom = latestEnd && latestEnd >= todayStr() ? ymd(new Date(new Date(`${latestEnd}T00:00:00`).getTime() + 86400000)) : todayStr();
  const pickedPlan = plans.find((p) => p.id === picked) || null;

  async function openForm(p: Plan, renew = false) {
    const tk = token();
    if (!tk) { window.location.href = loginHref; return; }
    setActive(p); setRenewing(renew); setErrs({}); setF({ ...emptyForm }); setPrefilling(true);
    try {
      const res = await fetch(`${API_BASE}/devotee/profile`, { headers: { Authorization: `Bearer ${tk}` } });
      if (res.status === 401) { window.location.href = loginHref; return; }
      if (res.ok) {
        const pr = (await res.json())?.profile;
        if (pr) {
          let cc = '+91', phone = '';
          if (pr.phone) {
            const raw = String(pr.phone).trim();
            const m = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length).find((x) => raw.startsWith(x.code));
            if (m) { cc = m.code; phone = raw.slice(m.code.length).replace(/\D/g, ''); } else phone = raw.replace(/\D/g, '').slice(-10);
          }
          setF((x) => ({ ...x, first: cleanName(pr.first_name || ''), last: cleanName(pr.last_name || ''), email: cleanEmail(pr.email || ''), cc, phone, address: cleanAddr(pr.comm_address || ''), city: cleanPlace(pr.city || ''), state: cleanPlace(pr.state || '') }));
        }
      }
    } catch { /* fill by hand */ } finally { setPrefilling(false); }
  }

  const set = (k: keyof Form, v: string) => { setF((x) => ({ ...x, [k]: v })); setErrs((e) => ({ ...e, [k]: '', form: '' })); };

  function focusFirst(keys: string[]) {
    setTimeout(() => {
      const el = keys.map((k) => formRef.current?.querySelector(`[data-field="${k}"]`)).find(Boolean) as HTMLElement | undefined;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el?.querySelector('input,select,textarea') as HTMLElement | null)?.focus({ preventScroll: true });
    }, 50);
  }

  async function openReceipt(id: number) {
    const tk = token();
    if (!tk) return;
    try {
      const res = await fetch(`${API_BASE}/magazine/receipt/${id}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' });
      const d = await readJson(res);
      if (res.ok) setReceipt(d.receipt);
    } catch { /* ignore */ }
  }

  async function pay(p: any, plan: Plan, tk: string) {
    const ready = await loadRazorpayScript();
    if (!ready) { setErrs({ form: tr('Secure payment could not be loaded. Check your internet connection and try again.', 'பாதுகாப்பான கட்டண சேவையை ஏற்ற இயலவில்லை.') }); setBusy(false); return; }
    let paid = false;
    const instance = new (window as any).Razorpay({
      key: p.keyId, amount: p.amount, currency: p.currency, name: p.orgName, description: isTa ? plan.name_ta || plan.name_en : plan.name_en, order_id: p.orderId,
      prefill: { name: `${f.first} ${f.last}`.trim(), email: f.email.trim(), contact: `${f.cc}${f.phone}` },
      theme: { color: '#3b0d0d' },
      modal: { ondismiss: () => { if (paid) return; setBusy(false); setErrs({ form: tr('The payment was not completed. Press the button again to pay.', 'கட்டணம் நிறைவடையவில்லை. மீண்டும் செலுத்த பொத்தானை அழுத்தவும்.') }); } },
      handler: async (resp: any) => {
        paid = true;
        try {
          const vr = await fetch(`${API_BASE}/magazine/verify`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
            body: JSON.stringify({ razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature, subscriptionId: p.subscriptionId }),
          });
          const vd = await readJson(vr);
          if (vr.ok && vd.subscribed) {
            setDone({ plan: isTa ? plan.name_ta || plan.name_en : plan.name_en, receiptId: vd.subscriptionId });
            setActive(null); setPicked(null); loadMine();
          } else {
            setErrs({ form: `${vd.message || tr('We could not confirm your payment.', 'கட்டணத்தை உறுதிசெய்ய இயலவில்லை.')} ${tr('If money was deducted, it will be confirmed automatically within a few minutes, or contact the ashram with this payment id:', 'பணம் எடுக்கப்பட்டிருந்தால் சில நிமிடங்களில் தானாக உறுதியாகும், அல்லது இந்த கட்டண எண்ணுடன் தொடர்பு கொள்ளவும்:')} ${resp.razorpay_payment_id}` });
          }
        } catch {
          setErrs({ form: `${tr('Network error while confirming. If money was deducted, it will be confirmed automatically, or contact the ashram with this payment id:', 'உறுதிப்படுத்தும்போது இணைய பிழை. பணம் எடுக்கப்பட்டிருந்தால் தானாக உறுதியாகும்:')} ${resp.razorpay_payment_id}` });
        } finally { setBusy(false); }
      },
    });
    instance.on('payment.failed', (r: any) => {
      const why = r?.error?.description;
      setErrs({ form: why ? `${tr('Payment failed', 'கட்டணம் தோல்வியடைந்தது')}: ${why}` : tr('Payment failed. Please try again.', 'கட்டணம் தோல்வியடைந்தது.') });
    });
    instance.open();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!active || busy) return;
    const x: Record<string, string> = {};
    const digits = f.phone.replace(/\D/g, '');
    const needAddr = active.delivery !== 'digital';
    if (!NAME_RE.test(f.first.trim())) x.first = tr('Enter your first name (letters only).', 'முதல் பெயரை உள்ளிடவும்.');
    if (!NAME_RE.test(f.last.trim())) x.last = tr('Enter your last name (letters only).', 'கடைசி பெயரை உள்ளிடவும்.');
    if (!EMAIL_RE.test(f.email.trim())) x.email = tr('Enter a valid email address.', 'சரியான மின்னஞ்சலை உள்ளிடவும்.');
    if (f.cc === '+91' ? !/^[6-9]\d{9}$/.test(digits) : !/^\d{6,15}$/.test(digits)) x.phone = f.cc === '+91' ? tr('Enter a 10 digit mobile number.', '10 இலக்க மொபைல் எண்ணை உள்ளிடவும்.') : tr('Enter a valid mobile number.', 'சரியான மொபைல் எண்ணை உள்ளிடவும்.');
    if (needAddr) {
      if (f.address.trim().length < 5) x.address = tr('Enter your full postal address.', 'முழு அஞ்சல் முகவரியை உள்ளிடவும்.');
      if (!PLACE_RE.test(f.city.trim())) x.city = tr('Enter your city (letters only).', 'நகரத்தை உள்ளிடவும்.');
      if (!PLACE_RE.test(f.state.trim())) x.state = tr('Enter your state (letters only).', 'மாநிலத்தை உள்ளிடவும்.');
      if (!/^\d{6}$/.test(f.pincode.trim())) x.pincode = tr('Enter a 6 digit pincode.', '6 இலக்க அஞ்சல் குறியீட்டை உள்ளிடவும்.');
    }
    setErrs(x);
    const bad = ['first', 'last', 'email', 'phone', 'address', 'city', 'state', 'pincode'].filter((k) => x[k]);
    if (bad.length) { focusFirst(bad.map((k) => `ms-${k}`)); return; }

    const tk = token();
    if (!tk) { window.location.href = loginHref; return; }
    setBusy(true);
    let keepBusy = false;
    try {
      const res = await fetch(`${API_BASE}/magazine/subscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ plan_id: active.id, first_name: f.first.trim(), last_name: f.last.trim(), email: f.email.trim().toLowerCase(), country_code: f.cc, phone: digits, address: f.address.trim(), city: f.city.trim(), state: f.state.trim(), pincode: f.pincode.trim() }),
      });
      const d = await readJson(res);
      if (res.status === 401) { setErrs({ form: tr('Your session has ended. Please sign in again.', 'உங்கள் அமர்வு முடிந்தது. மீண்டும் உள்நுழையவும்.') }); return; }
      if (!res.ok) {
        const key = d.field === 'first_name' ? 'first' : d.field === 'last_name' ? 'last' : d.field;
        setErrs(key ? { [key]: d.message } : { form: d.message || tr('Could not start the subscription.', 'சந்தாவைத் தொடங்க இயலவில்லை.') });
        return;
      }
      keepBusy = true;
      await pay(d.payment, active, tk);
    } catch {
      setErrs({ form: tr('Network error. Please try again.', 'இணைய பிழை. மீண்டும் முயற்சிக்கவும்.') });
    } finally { if (!keepBusy) setBusy(false); }
  }

  const needAddr = !!active && active.delivery !== 'digital';
  const activeValid = active ? validity(startFrom, active.duration_months) : null;

  return (
    <div id="subscribe-form" className="scroll-mt-20 space-y-10">
      <style>{`@media print{body *{visibility:hidden}#mag-receipt,#mag-receipt *{visibility:visible}#mag-receipt{position:absolute;left:0;top:0;width:100%;box-shadow:none!important}.no-print{display:none!important}}`}</style>

      {done && (
        <div role="status" className="flex flex-col gap-3 rounded-lg border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl font-semibold text-emerald-900">{tr('Payment received. You are subscribed.', 'கட்டணம் பெறப்பட்டது. நீங்கள் சந்தாதாரர் ஆகிவிட்டீர்கள்.')}</p>
            <p className="mt-0.5 text-emerald-900/85">{done.plan}. {tr('A receipt has been emailed to you.', 'ரசீது உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்டது.')}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => openReceipt(done.receiptId)} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">{tr('View receipt', 'ரசீதைக் காண்க')}</button>
            <button type="button" onClick={() => setDone(null)} className="rounded-md border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-700 hover:text-white">{tr('Dismiss', 'மூடு')}</button>
          </div>
        </div>
      )}

      {mine.length > 0 && (
        <section aria-label={tr('Your subscriptions', 'உங்கள் சந்தாக்கள்')}>
          <h2 className="font-display text-2xl font-semibold text-maroon">{tr('Your subscriptions', 'உங்கள் சந்தாக்கள்')}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {mine.map((s) => {
              const left = daysUntil(s.end_date);
              const soon = s.status === 'ACTIVE' && left <= 30;
              const plan = plans.find((p) => p.id === s.plan_id);
              return (
                <div key={s.id} className={`rounded-lg border bg-white p-5 ${soon ? 'border-amber-300' : 'border-sand'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-semibold text-maroon">{s.plan_name}</p>
                      <p className="text-sm text-charcoal/70">{deliveryText(s.delivery)}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${s.status === 'ACTIVE' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-slate-50 text-slate-600'}`}>
                      {s.status === 'ACTIVE' ? tr('Active', 'செயலில்') : tr('Expired', 'முடிந்தது')}
                    </span>
                  </div>
                  <p className="mt-3 text-[15px] font-semibold text-charcoal">{dmy(s.start_date)} - {dmy(s.end_date)}</p>
                  {soon && <p className="mt-1 text-sm font-semibold text-amber-800">{left <= 0 ? tr('Ends today.', 'இன்றுடன் முடிகிறது.') : tr(`Ends in ${left} day(s). Renew to continue without a break.`, `${left} நாட்களில் முடிகிறது. தொடர்ந்து பெற புதுப்பிக்கவும்.`)}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => openReceipt(s.id)} className="rounded-md border border-sand px-3.5 py-2 text-sm font-bold text-charcoal hover:border-maroon">{tr('Receipt', 'ரசீது')}</button>
                    {plan && (soon || s.status === 'EXPIRED') && (
                      <button type="button" onClick={() => openForm(plan, true)} className="rounded-md bg-saffron px-4 py-2 text-sm font-bold text-charcoal hover:bg-maroon hover:text-white">{tr('Renew', 'புதுப்பிக்க')}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section aria-label={tr('Plans', 'திட்டங்கள்')}>
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-lg bg-sand/50" />)}</div>
        ) : error ? (
          <div role="alert" className="rounded-md border border-red-200 border-l-4 border-l-red-600 bg-red-50 p-5 text-red-800">
            <p className="font-semibold">{error}</p>
            <button type="button" onClick={loadPlans} className="mt-3 rounded-md border-2 border-red-700 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-700 hover:text-white">{tr('Try again', 'மீண்டும் முயற்சி')}</button>
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-md border border-dashed border-sand bg-cream/40 py-14 text-center font-serif text-lg text-charcoal/75">{tr('Subscription plans will be available soon.', 'சந்தா திட்டங்கள் விரைவில் கிடைக்கும்.')}</div>
        ) : (
          <>
            <div className="text-center">
              <h2 className="font-display text-3xl font-semibold text-maroon sm:text-4xl">{tr('Choose a subscription', 'சந்தாவைத் தேர்ந்தெடுக்கவும்')}</h2>
              <div aria-hidden="true" className="mt-3 flex items-center justify-center gap-3"><span className="h-px w-12 bg-saffron" /><span className="h-2 w-2 rotate-45 bg-saffron" /><span className="h-px w-12 bg-saffron" /></div>
              <p className="mt-3 text-charcoal/75">{tr('Select a plan to see the details and pay.', 'விவரங்களைக் காணவும் செலுத்தவும் ஒரு திட்டத்தைத் தேர்ந்தெடுக்கவும்.')}</p>
            </div>
            <div role="radiogroup" aria-label={tr('Subscription plans', 'சந்தா திட்டங்கள்')} className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => {
                const on = picked === p.id;
                const badge = isTa ? p.badge_ta || p.badge_en : p.badge_en;
                const feats = lines(isTa ? p.features_ta || p.features_en : p.features_en);
                const desc = isTa ? p.description_ta || p.description_en : p.description_en;
                return (
                  <article key={p.id} role="radio" aria-checked={on} tabIndex={0}
                    onClick={() => setPicked(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked(p.id); } }}
                    className={`relative flex cursor-pointer flex-col rounded-lg border-2 bg-white p-6 shadow-sm transition-all hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron ${on ? 'border-maroon ring-2 ring-maroon/20' : 'border-sand'}`}>
                    {badge && <span className="absolute -top-3 right-5 rounded-full bg-saffron px-3 py-1 text-xs font-bold uppercase tracking-wider text-charcoal shadow">{badge}</span>}
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-saffron">{durationText(p.duration_months)}</p>
                      <span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${on ? 'border-maroon bg-maroon' : 'border-sand'}`}>
                        {on && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                    </div>
                    <h3 className="mt-1 font-display text-2xl font-semibold leading-snug text-maroon [html[lang='ta']_&]:leading-[1.4]">{isTa ? p.name_ta || p.name_en : p.name_en}</h3>
                    <p className="mt-4 font-display text-4xl font-bold text-charcoal">{rupees(p.price)}</p>
                    {p.duration_months > 12 && <p className="text-sm font-semibold text-charcoal/60">{tr('About', 'சுமார்')} {rupees(perYear(p.price, p.duration_months))} {tr('per year', 'ஆண்டுக்கு')}</p>}
                    <p className="mt-1 text-sm font-semibold text-charcoal/65">{deliveryText(p.delivery)}</p>
                    {desc && <p className="mt-4 font-serif text-base leading-relaxed text-charcoal/80">{desc}</p>}
                    {feats.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {feats.map((x, i) => (
                          <li key={i} className="flex gap-2.5 text-[15px] text-charcoal/85">
                            <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                            <span>{x}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); setPicked(p.id); }} className={`mt-6 w-full rounded-md px-5 py-3 text-base font-bold transition-colors ${on ? 'bg-maroon text-white' : 'border border-maroon text-maroon hover:bg-maroon hover:text-white'}`}>
                      {on ? tr('Selected', 'தேர்ந்தெடுக்கப்பட்டது') : tr('Select this plan', 'இத்திட்டத்தைத் தேர்ந்தெடு')}
                    </button>
                  </article>
                );
              })}
            </div>

            {/* Selected plan summary and pay */}
            {pickedPlan && (
              <div className="mt-8 rounded-lg border-2 border-saffron bg-white p-5 shadow-md sm:p-6" aria-live="polite">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-maroon">{tr('Your selection', 'உங்கள் தேர்வு')}</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div><p className="text-xs font-bold uppercase tracking-wider text-charcoal/55">{tr('Plan', 'திட்டம்')}</p><p className="mt-0.5 font-bold text-charcoal">{isTa ? pickedPlan.name_ta || pickedPlan.name_en : pickedPlan.name_en}</p></div>
                  <div><p className="text-xs font-bold uppercase tracking-wider text-charcoal/55">{tr('Period', 'காலம்')}</p><p className="mt-0.5 font-bold text-charcoal">{durationText(pickedPlan.duration_months)}</p></div>
                  <div><p className="text-xs font-bold uppercase tracking-wider text-charcoal/55">{tr('Valid', 'செல்லுபடி')}</p><p className="mt-0.5 font-bold text-charcoal">{dmy(validity(startFrom, pickedPlan.duration_months).start)} - {dmy(validity(startFrom, pickedPlan.duration_months).end)}</p></div>
                  <div><p className="text-xs font-bold uppercase tracking-wider text-charcoal/55">{tr('Delivery', 'விநியோகம்')}</p><p className="mt-0.5 font-bold text-charcoal">{deliveryText(pickedPlan.delivery)}</p></div>
                </div>
                <div className="mt-5 flex flex-col gap-3 border-t border-sand pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-charcoal/55">{tr('Amount to pay', 'செலுத்த வேண்டிய தொகை')}</p>
                    <p className="font-display text-4xl font-bold text-maroon">{rupees(pickedPlan.price)}</p>
                  </div>
                  <button type="button" onClick={() => openForm(pickedPlan)} className="rounded-md bg-maroon px-8 py-3.5 text-lg font-bold text-white transition-colors hover:bg-charcoal">
                    {token() ? `${tr('Continue to pay', 'செலுத்த தொடர்க')} ${rupees(pickedPlan.price)}` : tr('Sign in to subscribe', 'சந்தாவிற்கு உள்நுழைக')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Subscribe form */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/60 sm:items-center sm:p-4" onClick={() => !busy && setActive(null)} role="dialog" aria-modal="true">
          <form ref={formRef} onSubmit={submit} noValidate onClick={(e) => e.stopPropagation()} className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl">
            <div className="border-t-4 border-saffron bg-maroon px-6 py-5 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-saffron">{renewing ? tr('Renew subscription', 'சந்தா புதுப்பிப்பு') : tr('Magazine subscription', 'இதழ் சந்தா')}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold !text-white">{isTa ? active.name_ta || active.name_en : active.name_en}</h2>
              <p className="mt-1 text-sm text-white/85">{durationText(active.duration_months)} · {deliveryText(active.delivery)}</p>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              {errs.form && <p role="alert" className="rounded-md border border-red-200 border-l-4 border-l-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{errs.form}</p>}
              {prefilling && <p className="text-sm font-semibold text-charcoal/60">{tr('Loading your details...', 'உங்கள் விவரங்கள் ஏற்றப்படுகின்றன...')}</p>}
              {activeValid && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                  {tr('Valid', 'செல்லுபடி')}: <strong>{dmy(activeValid.start)} - {dmy(activeValid.end)}</strong>
                  {renewing || startFrom !== todayStr() ? ` ${tr('(starts right after your current subscription ends)', '(தற்போதைய சந்தா முடிந்த உடனே தொடங்கும்)')}` : ''}
                </p>
              )}

              <section className="space-y-4">
                <h3 className="border-b border-sand pb-2 text-sm font-bold uppercase tracking-[0.14em] text-maroon">{tr('Your details', 'உங்கள் விவரங்கள்')}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="ms-first" label={tr('First name *', 'முதல் பெயர் *')} error={errs.first}><input id="ms-first" autoComplete="given-name" value={f.first} onChange={(e) => set('first', cleanName(e.target.value))} className={inputCls(!!errs.first)} /></Field>
                  <Field id="ms-last" label={tr('Last name *', 'கடைசி பெயர் *')} error={errs.last}><input id="ms-last" autoComplete="family-name" value={f.last} onChange={(e) => set('last', cleanName(e.target.value))} className={inputCls(!!errs.last)} /></Field>
                </div>
                <Field id="ms-email" label={tr('Email * (the receipt is sent here)', 'மின்னஞ்சல் * (ரசீது இங்கே அனுப்பப்படும்)')} error={errs.email}><input id="ms-email" type="email" autoComplete="email" value={f.email} onChange={(e) => set('email', cleanEmail(e.target.value))} className={inputCls(!!errs.email)} /></Field>
                <Field id="ms-phone" label={tr('Mobile number *', 'மொபைல் எண் *')} error={errs.phone}>
                  <div className="flex gap-2">
                    <select aria-label={tr('Country code', 'நாட்டின் குறியீடு')} value={f.cc} onChange={(e) => set('cc', e.target.value)} className={`${inputCls(false)} w-36 shrink-0 sm:w-48`}>
                      {COUNTRY_CODES.map((c) => <option key={`${c.code}-${c.country}`} value={c.code}>{c.label || `${c.country} (${c.code})`}</option>)}
                    </select>
                    <input id="ms-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={f.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, f.cc === '+91' ? 10 : 15))} className={inputCls(!!errs.phone)} />
                  </div>
                </Field>
              </section>

              {needAddr && (
                <section className="space-y-4">
                  <h3 className="border-b border-sand pb-2 text-sm font-bold uppercase tracking-[0.14em] text-maroon">{tr('Postal address for the printed copy', 'அச்சு இதழுக்கான அஞ்சல் முகவரி')}</h3>
                  <Field id="ms-address" label={tr('Address *', 'முகவரி *')} error={errs.address}>
                    <textarea id="ms-address" rows={3} value={f.address} onChange={(e) => set('address', cleanAddr(e.target.value))} placeholder={tr('Door no, street, area', 'கதவு எண், தெரு, பகுதி')} className={`w-full rounded-md border px-3.5 py-3 text-base text-charcoal focus:outline-none focus:ring-2 ${errs.address ? 'border-red-500 bg-red-50 focus:ring-red-300' : 'border-sand bg-white focus:border-maroon focus:ring-saffron/40'}`} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field id="ms-city" label={tr('City *', 'நகரம் *')} error={errs.city}><input id="ms-city" autoComplete="address-level2" value={f.city} onChange={(e) => set('city', cleanPlace(e.target.value))} className={inputCls(!!errs.city)} /></Field>
                    <Field id="ms-state" label={tr('State *', 'மாநிலம் *')} error={errs.state}><input id="ms-state" autoComplete="address-level1" value={f.state} onChange={(e) => set('state', cleanPlace(e.target.value))} className={inputCls(!!errs.state)} /></Field>
                    <Field id="ms-pincode" label={tr('Pincode *', 'அஞ்சல் குறியீடு *')} error={errs.pincode}><input id="ms-pincode" inputMode="numeric" autoComplete="postal-code" value={f.pincode} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} className={inputCls(!!errs.pincode)} /></Field>
                  </div>
                </section>
              )}

              <section className="flex items-end justify-between rounded-md border border-saffron bg-saffron/10 px-5 py-4">
                <p className="text-sm font-bold uppercase tracking-wider text-charcoal/60">{tr('Amount to pay', 'செலுத்த வேண்டிய தொகை')}</p>
                <p className="font-display text-3xl font-bold text-maroon">{rupees(active.price)}</p>
              </section>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-sand bg-cream/40 px-6 py-4 sm:flex-row sm:justify-end">
              <button type="button" disabled={busy} onClick={() => setActive(null)} className="rounded-md border border-sand bg-white px-6 py-3 text-base font-bold text-charcoal hover:border-maroon disabled:opacity-60">{tr('Cancel', 'ரத்து')}</button>
              <button type="submit" disabled={busy} className="rounded-md bg-maroon px-8 py-3 text-base font-bold text-white transition-colors hover:bg-charcoal disabled:opacity-60">{busy ? tr('Please wait...', 'காத்திருக்கவும்...') : `${tr('Pay', 'செலுத்து')} ${rupees(active.price)}`}</button>
            </div>
          </form>
        </div>
      )}

      {/* Receipt */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-charcoal/60 p-4" onClick={() => setReceipt(null)} role="dialog" aria-modal="true">
          <div id="mag-receipt" onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl sm:p-8">
            <div className="border-b-2 border-maroon pb-4 text-center">
              <h2 className="font-display text-xl font-bold uppercase tracking-wide text-maroon">{receipt.org}</h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-saffron">{tr('Magazine subscription receipt', 'இதழ் சந்தா ரசீது')}</p>
            </div>
            <dl className="mt-5 divide-y divide-sand/70 text-[15px]">
              {([
                [tr('Receipt no', 'ரசீது எண்'), receipt.receipt_no],
                [tr('Subscriber', 'சந்தாதாரர்'), `${receipt.first_name} ${receipt.last_name}`],
                [tr('Plan', 'திட்டம்'), receipt.plan_name],
                [tr('Delivery', 'விநியோகம்'), deliveryText(receipt.delivery)],
                [tr('Valid', 'செல்லுபடி'), `${dmy(receipt.start_date)} - ${dmy(receipt.end_date)}`],
                ...(receipt.address ? [[tr('Posted to', 'அனுப்பும் முகவரி'), `${receipt.address}, ${receipt.city || ''}, ${receipt.state || ''} ${receipt.pincode || ''}`]] : []),
                [tr('Paid by', 'செலுத்திய முறை'), modeText(receipt.payment_mode)],
                [tr('Payment reference', 'கட்டண எண்'), receipt.razorpay_payment_id || '-'],
                [tr('Amount paid', 'செலுத்திய தொகை'), `INR ${Number(receipt.amount).toLocaleString('en-IN')}`],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="font-semibold text-charcoal/60">{k}</dt><dd className="break-words text-right font-bold text-charcoal">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-5 border-t border-dashed border-sand pt-3 text-center text-xs text-charcoal/60">{tr('Thank you. Please keep this receipt for your records.', 'நன்றி. இந்த ரசீதைப் பத்திரமாக வைத்துக் கொள்ளவும்.')}</p>
            <div className="no-print mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setReceipt(null)} className="rounded-md border border-sand px-5 py-2.5 text-sm font-bold text-charcoal hover:border-maroon">{tr('Close', 'மூடு')}</button>
              <button type="button" onClick={() => window.print()} className="rounded-md bg-maroon px-5 py-2.5 text-sm font-bold text-white hover:bg-charcoal">{tr('Print receipt', 'ரசீது அச்சிடுக')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}