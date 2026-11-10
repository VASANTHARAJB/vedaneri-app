'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COUNTRY_CODES } from '@/data/countryCodes';
import { loadRazorpayScript } from '@/lib/razorpay';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const FILES = API_BASE.replace(/\/api\/v1\/?$/, '');
const TOKEN_KEY = 'devotee_token';

type Camp = {
  id: string; slug: string; title_en: string; title_ta: string | null; description_en: string | null; description_ta: string | null;
  venue_en: string | null; venue_ta: string | null; start_date: string; end_date: string; start_time: string | null; end_time: string | null;
  image_url: string | null; fee_type: 'free' | 'paid'; fee_amount: number; seats: number; status: 'published' | 'closed' | 'draft'; registered: number;
};

type Props = { t?: any; locale: string };

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const fmt = (d: string) => (d ? d.split('-').reverse().join('.') : '');
const imgUrl = (u: string | null) => (u ? (u.startsWith('http') ? u : `${FILES}${u}`) : '');
const dayOf = (d: string) => d.slice(8, 10);
const monthOf = (d: string) => MONTHS[Math.max(0, Number(d.slice(5, 7)) - 1)] || '';
async function readJson(res: Response) { try { return await res.json(); } catch { return {}; } }

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,59}$/u;
const PLACE_RE = /^[\p{L}\p{M}][\p{L}\p{M} .-]{0,59}$/u;
const EMAIL_RE = /^[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const cleanName = (v: string) => v.replace(/[^\p{L}\p{M} .'-]/gu, '').replace(/\s{2,}/g, ' ').slice(0, 60);
const cleanPlace = (v: string) => v.replace(/[^\p{L}\p{M} .-]/gu, '').replace(/\s{2,}/g, ' ').slice(0, 60);
const cleanEmail = (v: string) => v.replace(/[^A-Za-z0-9._+\-@]/g, '').slice(0, 100);
const cleanNote = (v: string) => v.replace(/[^\p{L}\p{M}\p{N} ,.\-/#():;!?'\n]/gu, '').slice(0, 500);
const rupees = (n: number) => `₹ ${Number(n).toLocaleString('en-IN')}`;

type Form = { first: string; last: string; email: string; cc: string; phone: string; adults: string; children: string; city: string; state: string; notes: string };
const emptyForm: Form = { first: '', last: '', email: '', cc: '+91', phone: '', adults: '1', children: '0', city: '', state: '', notes: '' };

// ---- Every attendee gives a name, an ID proof (type + number + document) and a profile photo ----
type IdType = '' | 'aadhaar' | 'pan' | 'voter' | 'passport';
type Att = { name: string; touched: boolean; idType: IdType; idNumber: string; doc: File | null; photo: File | null };
const emptyAtt = (): Att => ({ name: '', touched: false, idType: '', idNumber: '', doc: null, photo: null });
const MAX_FILE = 5 * 1024 * 1024; // 5 MB, the server checks the same
const DOC_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ID_OPTIONS: { value: Exclude<IdType, ''>; en: string; ta: string; ph: string }[] = [
  { value: 'aadhaar', en: 'Aadhaar Card', ta: 'ஆதார் அட்டை', ph: '12-digit Aadhaar number' },
  { value: 'pan', en: 'PAN Card', ta: 'பான் அட்டை', ph: 'ABCDE1234F' },
  { value: 'voter', en: 'Voter ID (EPIC)', ta: 'வாக்காளர் அடையாள அட்டை', ph: 'ABC1234567' },
  { value: 'passport', en: 'Passport', ta: 'கடவுச்சீட்டு', ph: 'A1234567' },
];
const VD = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
  [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0],
];
const VP = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],
  [9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];
function isValidAadhaar(a: string): boolean {
  if (!/^[2-9][0-9]{11}$/.test(a)) return false;
  let c = 0;
  const d = a.split('').reverse().map(Number);
  for (let i = 0; i < d.length; i++) c = VD[c][VP[i % 8][d[i]]];
  return c === 0;
}
const normalizeId = (v: string) => v.replace(/[\s-]/g, '').toUpperCase();
function idValid(type: IdType, n: string): boolean {
  if (type === 'aadhaar') return isValidAadhaar(n);
  if (type === 'pan') return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(n);
  if (type === 'voter') return /^[A-Z]{3}[0-9]{7}$/.test(n);
  if (type === 'passport') return /^[A-Z][0-9]{7}$/.test(n);
  return false;
}

// Small preview of a chosen file (picture, or "PDF")
function FilePreview({ file }: { file: File | null }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setUrl(''); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!file) return null;
  return (
    <div className="mt-2 flex items-center gap-3 rounded-md bg-cream/60 p-2">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-white text-xs font-bold text-maroon">PDF</span>
      )}
      <span className="min-w-0 break-words text-sm text-charcoal/80">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>
    </div>
  );
}

const inputCls = (bad?: boolean) =>
  `h-12 w-full rounded-md border px-3.5 text-base text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-2 ${
    bad ? 'border-red-500 bg-red-50 focus:ring-red-300' : 'border-sand bg-white focus:border-maroon focus:ring-saffron/40'
  }`;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div data-field={id}>
      <label htmlFor={id} className={`mb-1.5 block text-sm font-bold ${error ? 'text-red-700' : 'text-charcoal'}`}>{label}</label>
      {children}
      {error ? <p role="alert" className="mt-1 text-sm font-semibold text-red-700">{error}</p> : hint ? <p className="mt-1 text-xs text-charcoal/60">{hint}</p> : null}
    </div>
  );
}

export default function CampList({ locale }: Props) {
  const isTa = locale === 'ta';
  const tr = (en: string, ta: string) => (isTa ? ta : en);

  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mine, setMine] = useState<Record<string, number>>({});

  const [active, setActive] = useState<Camp | null>(null);
  const [f, setF] = useState<Form>({ ...emptyForm });
  const [att, setAtt] = useState<Att[]>([emptyAtt()]);
  const [fileKey, setFileKey] = useState(0); // changing this empties the file inputs
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [done, setDone] = useState<{ camp: Camp; people: number; paid: boolean } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const loginHref = `/${locale}/login?redirect=${encodeURIComponent(`/${locale}/camps`)}`;
  const token = () => (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/camps/public`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      setCamps(Array.isArray(d.camps) ? d.camps : []);
    } catch {
      setError(tr('The camps could not be loaded right now. Please try again.', 'முகாம்களை இப்போது ஏற்ற இயலவில்லை. மீண்டும் முயற்சிக்கவும்.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const loadMine = useCallback(async () => {
    const tk = token();
    if (!tk) { setMine({}); return; }
    try {
      const res = await fetch(`${API_BASE}/camps/my-registrations`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      const map: Record<string, number> = {};
      (d.registrations || []).forEach((r: any) => { map[r.camp_id] = Number(r.members) || 0; });
      setMine(map);
    } catch { /* optional */ }
  }, []);

  useEffect(() => { load(); loadMine(); }, [load, loadMine]);

  // One attendee card per person: it follows the Adults + Children numbers
  useEffect(() => {
    const n = Math.min(25, Math.max(0, (Math.floor(Number(f.adults)) || 0) + (Math.floor(Number(f.children)) || 0)));
    setAtt((prev) => (prev.length === n ? prev : Array.from({ length: n }, (_, i) => prev[i] || emptyAtt())));
  }, [f.adults, f.children]);

  // The first attendee is the person registering: use their name until they type another
  useEffect(() => {
    const full = `${f.first} ${f.last}`.trim();
    setAtt((prev) => (prev.length && !prev[0].touched && prev[0].name !== full ? [{ ...prev[0], name: full }, ...prev.slice(1)] : prev));
  }, [f.first, f.last]);

  async function openForm(c: Camp) {
    const tk = token();
    if (!tk) { window.location.href = loginHref; return; }
    if (mine[c.id]) return;
    setActive(c); setErrs({}); setF({ ...emptyForm }); setAtt([emptyAtt()]); setFileKey((k) => k + 1); setPrefilling(true);
    try {
      const res = await fetch(`${API_BASE}/devotee/profile`, { headers: { Authorization: `Bearer ${tk}` } });
      if (res.status === 401) { window.location.href = loginHref; return; }
      if (res.ok) {
        const p = (await res.json())?.profile;
        if (p) {
          let cc = '+91';
          let phone = '';
          if (p.phone) {
            const raw = String(p.phone).trim();
            const m = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length).find((x) => raw.startsWith(x.code));
            if (m) { cc = m.code; phone = raw.slice(m.code.length).replace(/\D/g, ''); }
            else phone = raw.replace(/\D/g, '').slice(-10);
          }
          setF((x) => ({
            ...x,
            first: cleanName(p.first_name || ''), last: cleanName(p.last_name || ''), email: cleanEmail(p.email || ''),
            cc, phone, city: cleanPlace(p.city || ''), state: cleanPlace(p.state || ''),
          }));
        }
      }
    } catch { /* the form can be filled in by hand */ } finally {
      setPrefilling(false);
    }
  }

  const set = (k: keyof Form, v: string) => { setF((x) => ({ ...x, [k]: v })); setErrs((e) => ({ ...e, [k]: '', form: '' })); };

  // Change one attendee and clear the red state of the fields that changed
  function setAttField(i: number, patch: Partial<Att>) {
    setAtt((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
    setErrs((e) => {
      const next: Record<string, string> = { ...e, form: '' };
      Object.keys(patch).forEach((k) => { next[`att-${i}-${k}`] = ''; });
      return next;
    });
  }

  // A chosen file is checked straight away, so the devotee knows before pressing the button
  function pickFile(i: number, kind: 'doc' | 'photo', file: File | null) {
    const allowed = kind === 'doc' ? DOC_TYPES : PHOTO_TYPES;
    let problem = '';
    if (file && !allowed.includes(file.type)) {
      problem = kind === 'doc'
        ? tr('The ID proof must be a JPG, PNG image or a PDF.', 'அடையாளச் சான்று JPG, PNG படமாகவோ PDF ஆகவோ இருக்க வேண்டும்.')
        : tr('The photo must be a JPG, PNG or WebP image.', 'புகைப்படம் JPG, PNG அல்லது WebP ஆக இருக்க வேண்டும்.');
    } else if (file && file.size > MAX_FILE) {
      problem = tr('The file must be 5 MB or smaller.', 'கோப்பு 5 MB அல்லது அதற்கும் குறைவாக இருக்க வேண்டும்.');
    }
    setAtt((prev) => prev.map((a, idx) => (idx === i ? { ...a, [kind]: problem ? null : file } : a)));
    setErrs((e) => ({ ...e, [`att-${i}-${kind}`]: problem, form: '' }));
  }

  function focusFirst(keys: string[]) {
    setTimeout(() => {
      const el = keys.map((k) => formRef.current?.querySelector(`[data-field="${k}"]`)).find(Boolean) as HTMLElement | undefined;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el?.querySelector('input,select,textarea') as HTMLElement | null)?.focus({ preventScroll: true });
    }, 50);
  }

  // Opens the payment window, then confirms the payment with the server
  async function startPayment(camp: Camp, p: any, tk: string, people: number) {
    const ready = await loadRazorpayScript();
    if (!ready) {
      setErrs({ form: tr('Secure payment could not be loaded. Check your internet connection and try again.', 'பாதுகாப்பான கட்டண சேவையை ஏற்ற இயலவில்லை. இணைய இணைப்பைச் சரிபார்க்கவும்.') });
      setBusy(false);
      return;
    }
    let paid = false;
    const title = isTa ? camp.title_ta || camp.title_en : camp.title_en;
    const instance = new (window as any).Razorpay({
      key: p.keyId,
      amount: p.amount,
      currency: p.currency,
      name: p.orgName,
      description: title,
      order_id: p.orderId,
      prefill: { name: `${f.first} ${f.last}`.trim(), email: f.email.trim(), contact: `${f.cc}${f.phone}` },
      theme: { color: '#3b0d0d' },
      modal: {
        ondismiss: () => {
          if (paid) return;
          setBusy(false);
          setErrs({ form: tr('The payment was not completed. Your seats are held for 15 minutes. Press the button again to pay.', 'கட்டணம் நிறைவடையவில்லை. உங்கள் இடங்கள் 15 நிமிடங்கள் பிடித்து வைக்கப்படும். மீண்டும் செலுத்த பொத்தானை அழுத்தவும்.') });
        },
      },
      handler: async (resp: any) => {
        paid = true;
        try {
          const vr = await fetch(`${API_BASE}/camps/${camp.id}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
            body: JSON.stringify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              registrationId: p.registrationId,
            }),
          });
          const vd = await readJson(vr);
          if (vr.ok && vd.registered) {
            setDone({ camp, people: vd.members || people, paid: true });
            setActive(null);
            setAtt([emptyAtt()]); setFileKey((k) => k + 1);
            load(); loadMine();
          } else {
            setErrs({ form: `${vd.message || tr('We could not confirm your payment.', 'கட்டணத்தை உறுதிசெய்ய இயலவில்லை.')} ${tr('If money was deducted, it will be confirmed automatically within a few minutes, or contact the ashram with this payment id:', 'பணம் எடுக்கப்பட்டிருந்தால் சில நிமிடங்களில் தானாக உறுதியாகும், அல்லது இந்த கட்டண எண்ணுடன் ஆசிரமத்தைத் தொடர்பு கொள்ளவும்:')} ${resp.razorpay_payment_id}` });
          }
        } catch {
          setErrs({ form: `${tr('Network error while confirming. If money was deducted, it will be confirmed automatically, or contact the ashram with this payment id:', 'உறுதிப்படுத்தும்போது இணைய பிழை. பணம் எடுக்கப்பட்டிருந்தால் தானாக உறுதியாகும், அல்லது இந்த கட்டண எண்ணுடன் தொடர்பு கொள்ளவும்:')} ${resp.razorpay_payment_id}` });
        } finally {
          setBusy(false);
        }
      },
    });
    instance.on('payment.failed', (resp: any) => {
      const why = resp?.error?.description;
      setErrs({ form: why ? `${tr('Payment failed', 'கட்டணம் தோல்வியடைந்தது')}: ${why}` : tr('Payment failed. Please try again.', 'கட்டணம் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.') });
    });
    instance.open();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!active || busy) return;
    const x: Record<string, string> = {};
    const digits = f.phone.replace(/\D/g, '');
    const adults = Math.floor(Number(f.adults));
    const children = Math.floor(Number(f.children) || 0);

    if (!NAME_RE.test(f.first.trim())) x.first = tr('Enter your first name (letters only).', 'முதல் பெயரை உள்ளிடவும்.');
    if (!NAME_RE.test(f.last.trim())) x.last = tr('Enter your last name (letters only).', 'கடைசி பெயரை உள்ளிடவும்.');
    if (!EMAIL_RE.test(f.email.trim())) x.email = tr('Enter a valid email address.', 'சரியான மின்னஞ்சலை உள்ளிடவும்.');
    if (f.cc === '+91' ? !/^[6-9]\d{9}$/.test(digits) : !/^\d{6,15}$/.test(digits)) {
      x.phone = f.cc === '+91' ? tr('Enter a 10 digit mobile number.', '10 இலக்க மொபைல் எண்ணை உள்ளிடவும்.') : tr('Enter a valid mobile number.', 'சரியான மொபைல் எண்ணை உள்ளிடவும்.');
    }
    if (!Number.isFinite(adults) || adults < 1 || adults > 20) x.adults = tr('Adults must be between 1 and 20.', 'பெரியவர்கள் 1 முதல் 20 வரை இருக்க வேண்டும்.');
    if (children < 0 || children > 20) x.children = tr('Children must be between 0 and 20.', 'குழந்தைகள் 0 முதல் 20 வரை இருக்க வேண்டும்.');
    if (!x.adults && !x.children && active.seats > 0) {
      const left = Math.max(0, active.seats - active.registered);
      if (adults + children > left) x.adults = left > 0 ? tr(`Only ${left} seat(s) left.`, `${left} இடங்கள் மட்டுமே உள்ளன.`) : tr('This camp is full.', 'இந்த முகாம் நிரம்பியது.');
    }
    if (!PLACE_RE.test(f.city.trim())) x.city = tr('Enter your city (letters only).', 'நகரத்தை உள்ளிடவும்.');
    if (f.state.trim() && !PLACE_RE.test(f.state.trim())) x.state = tr('State can contain only letters.', 'மாநிலத்தில் எழுத்துக்கள் மட்டும்.');

    // Each attendee: name, ID proof type + number, ID document and photo, all required
    const attKeys: string[] = [];
    const seen = new Set<string>();
    if (!x.adults && !x.children) {
      att.forEach((a, i) => {
        const k = (n: string) => `att-${i}-${n}`;
        const isChild = i >= adults;
        const label = isChild ? tr(`Child ${i - adults + 1}`, `குழந்தை ${i - adults + 1}`) : tr(`Adult ${i + 1}`, `பெரியவர் ${i + 1}`);
        if (!NAME_RE.test(a.name.trim())) x[k('name')] = tr(`${label}: enter the name (letters only).`, `${label}: பெயரை உள்ளிடவும்.`);
        if (!a.idType) x[k('idType')] = tr(`${label}: choose an ID proof.`, `${label}: அடையாளச் சான்றைத் தேர்ந்தெடுக்கவும்.`);
        else if (isChild && a.idType === 'voter') x[k('idType')] = tr(`${label}: choose Aadhaar, PAN or Passport.`, `${label}: ஆதார், பான் அல்லது கடவுச்சீட்டைத் தேர்ந்தெடுக்கவும்.`);
        else if (!a.idNumber.trim()) x[k('idNumber')] = tr(`${label}: enter the ID number.`, `${label}: அடையாள எண்ணை உள்ளிடவும்.`);
        else if (!idValid(a.idType, normalizeId(a.idNumber))) x[k('idNumber')] = tr(`${label}: enter a valid ${ID_OPTIONS.find((o) => o.value === a.idType)?.en} number.`, `${label}: சரியான எண்ணை உள்ளிடவும்.`);
        else {
          const dup = `${a.idType}:${normalizeId(a.idNumber)}`;
          if (seen.has(dup)) x[k('idNumber')] = tr(`${label}: this ID number is already used for another attendee.`, `${label}: இந்த எண் மற்றொருவருக்கு ஏற்கெனவே உள்ளிடப்பட்டுள்ளது.`);
          seen.add(dup);
        }
        if (!a.doc) x[k('doc')] = errs[k('doc')] || tr(`${label}: upload the ID proof document.`, `${label}: அடையாளச் சான்று ஆவணத்தைப் பதிவேற்றவும்.`);
        if (!a.photo) x[k('photo')] = errs[k('photo')] || tr(`${label}: upload the profile photo.`, `${label}: புகைப்படத்தைப் பதிவேற்றவும்.`);
        ['name', 'idType', 'idNumber', 'doc', 'photo'].forEach((n) => { if (x[k(n)]) attKeys.push(k(n)); });
      });
    }

    setErrs(x);
    const order = ['first', 'last', 'email', 'phone', 'adults', 'children'];
    const bad = [...order.filter((k) => x[k]), ...attKeys, ...['city', 'state'].filter((k) => x[k])];
    if (bad.length) { focusFirst(bad.map((k) => `cf-${k}`)); return; }

    const tk = token();
    if (!tk) { window.location.href = loginHref; return; }

    setBusy(true);
    let keepBusy = false;
    try {
      // Sent as a form with files (the browser sets the content type itself)
      const body = new FormData();
      body.append('first_name', f.first.trim());
      body.append('last_name', f.last.trim());
      body.append('email', f.email.trim().toLowerCase());
      body.append('country_code', f.cc);
      body.append('phone', digits);
      body.append('adults', String(adults));
      body.append('children', String(children));
      body.append('city', f.city.trim());
      body.append('state', f.state.trim());
      body.append('notes', f.notes.trim());
      body.append('attendees', JSON.stringify(att.map((a) => ({ name: a.name.trim(), idType: a.idType, idNumber: normalizeId(a.idNumber) }))));
      att.forEach((a, i) => {
        body.append(`photo_${i}`, a.photo as File);
        body.append(`doc_${i}`, a.doc as File);
      });
      const res = await fetch(`${API_BASE}/camps/${active.id}/register`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}` },
        body,
      });
      const d = await readJson(res);
      if (res.status === 401) { setErrs({ form: tr('Your session has ended. Please sign in again.', 'உங்கள் அமர்வு முடிந்தது. மீண்டும் உள்நுழையவும்.') }); return; }
      if (res.status === 409) {
        setErrs({ form: tr('You have already registered for this camp.', 'நீங்கள் ஏற்கெனவே இந்த முகாமிற்குப் பதிவு செய்துள்ளீர்கள்.') });
        loadMine();
        return;
      }
      if (!res.ok) {
        const key = d.field === 'first_name' ? 'first' : d.field === 'last_name' ? 'last' : d.field;
        setErrs(key ? { [key]: d.message } : { form: d.message || tr('Could not register. Please try again.', 'பதிவு செய்ய இயலவில்லை.') });
        if (key) focusFirst([`cf-${key}`]);
        return;
      }
      if (d.payment) {
        keepBusy = true;
        await startPayment(active, d.payment, tk, d.members || adults + children);
        return;
      }
      setDone({ camp: active, people: d.members || adults + children, paid: false });
      setActive(null);
      setAtt([emptyAtt()]); setFileKey((k) => k + 1);
      load(); loadMine();
    } catch {
      setErrs({ form: tr('Network error. Please try again.', 'இணைய பிழை. மீண்டும் முயற்சிக்கவும்.') });
    } finally {
      if (!keepBusy) setBusy(false);
    }
  }

  /* ---------------- list states ---------------- */
  if (loading) {
    return (
      <div id="camp-list" className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-[30rem] animate-pulse rounded-lg bg-sand/50" />)}
      </div>
    );
  }
  if (error) {
    return (
      <div id="camp-list" role="alert" className="rounded-lg border border-red-200 border-l-4 border-l-red-600 bg-red-50 p-6 text-red-800">
        <p className="font-semibold">{error}</p>
        <button type="button" onClick={load} className="mt-3 rounded-md border-2 border-red-700 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-700 hover:text-white">{tr('Try again', 'மீண்டும் முயற்சி')}</button>
      </div>
    );
  }
  if (camps.length === 0) {
    return (
      <div id="camp-list" className="rounded-lg border border-dashed border-sand bg-cream/40 py-20 text-center">
        <p className="font-display text-3xl font-semibold text-maroon">{tr('No upcoming camps right now', 'தற்போது வரவிருக்கும் முகாம்கள் இல்லை')}</p>
        <p className="mt-2 font-serif text-lg text-charcoal/75">{tr('Please check again soon.', 'விரைவில் மீண்டும் பார்க்கவும்.')}</p>
      </div>
    );
  }

  const total = active ? (Math.floor(Number(f.adults)) || 0) + (Math.floor(Number(f.children)) || 0) : 0;
  const activePaid = !!active && active.fee_type === 'paid' && active.fee_amount > 0;
  const amountToPay = activePaid ? active!.fee_amount * total : 0;

  return (
    <>
      {done && (
        <div role="status" className="mb-6 flex flex-col gap-3 rounded-lg border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl font-semibold text-emerald-900">{done.paid ? tr('Payment received. You are registered.', 'கட்டணம் பெறப்பட்டது. நீங்கள் பதிவு செய்யப்பட்டீர்கள்.') : tr('You are registered', 'நீங்கள் பதிவு செய்யப்பட்டீர்கள்')}</p>
            <p className="mt-0.5 text-base text-emerald-900/85">
              {isTa ? done.camp.title_ta || done.camp.title_en : done.camp.title_en} · {done.people} {tr(done.people === 1 ? 'person' : 'people', 'நபர்கள்')}
            </p>
          </div>
          <button type="button" onClick={() => setDone(null)} className="self-start rounded-md border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-700 hover:text-white sm:self-auto">{tr('Dismiss', 'மூடு')}</button>
        </div>
      )}

      <div id="camp-list" className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {camps.map((c) => {
          const title = isTa ? c.title_ta || c.title_en : c.title_en;
          const desc = isTa ? c.description_ta || c.description_en : c.description_en;
          const venue = isTa ? c.venue_ta || c.venue_en : c.venue_en;
          const full = c.seats > 0 && c.registered >= c.seats;
          const closed = c.status === 'closed';
          const pct = c.seats > 0 ? Math.min(100, Math.round((c.registered / c.seats) * 100)) : 0;
          const left = c.seats > 0 ? Math.max(0, c.seats - c.registered) : 0;
          const registered = mine[c.id];
          const paidCamp = c.fee_type === 'paid' && c.fee_amount > 0;

          return (
            <article key={c.id} className="group flex flex-col overflow-hidden rounded-lg border border-sand bg-white shadow-sm transition-shadow hover:shadow-lg">
              <div className="relative h-52 overflow-hidden bg-sand/40">
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgUrl(c.image_url)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-maroon to-charcoal px-6 text-center font-display text-2xl font-semibold text-white">{title}</div>
                )}
                <div className="absolute left-4 top-4 rounded-md bg-white px-3 py-1.5 text-center shadow-md">
                  <span className="block font-display text-2xl font-bold leading-none text-maroon">{dayOf(c.start_date)}</span>
                  <span className="block text-[11px] font-bold tracking-widest text-charcoal/70">{monthOf(c.start_date)}</span>
                </div>
                {(closed || (full && !registered)) && (
                  <span className="absolute right-4 top-4 rounded-sm bg-charcoal px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    {closed ? tr('Registration closed', 'பதிவு முடிந்தது') : tr('Full', 'நிரம்பியது')}
                  </span>
                )}
                {registered ? <span className="absolute bottom-4 left-4 rounded-sm bg-emerald-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">{tr('Registered', 'பதிவு செய்தாகிவிட்டது')} · {registered}</span> : null}
              </div>

              <div className="flex flex-1 flex-col gap-4 p-6">
                <h3 className="font-display text-2xl font-semibold leading-snug text-maroon [html[lang='ta']_&]:leading-[1.4]">{title}</h3>

                <dl className="divide-y divide-sand/70 rounded-md border border-sand/80 bg-cream/40 text-[15px]">
                  <div className="flex justify-between gap-3 px-4 py-2.5"><dt className="font-semibold text-charcoal/60">{tr('Dates', 'தேதி')}</dt><dd className="text-right font-bold text-charcoal">{fmt(c.start_date)}{c.end_date !== c.start_date ? ` - ${fmt(c.end_date)}` : ''}</dd></div>
                  {c.start_time && <div className="flex justify-between gap-3 px-4 py-2.5"><dt className="font-semibold text-charcoal/60">{tr('Time', 'நேரம்')}</dt><dd className="text-right font-bold text-charcoal">{c.start_time}{c.end_time ? ` - ${c.end_time}` : ''}</dd></div>}
                  {venue && <div className="flex justify-between gap-3 px-4 py-2.5"><dt className="font-semibold text-charcoal/60">{tr('Venue', 'இடம்')}</dt><dd className="text-right font-bold text-charcoal">{venue}</dd></div>}
                  <div className="flex justify-between gap-3 px-4 py-2.5"><dt className="font-semibold text-charcoal/60">{tr('Fee', 'கட்டணம்')}</dt><dd className="text-right font-bold text-charcoal">{paidCamp ? `${rupees(c.fee_amount)} ${tr('per person', 'ஒருவருக்கு')}` : tr('Free', 'இலவசம்')}</dd></div>
                </dl>

                {desc && <p className="line-clamp-3 font-serif text-base leading-relaxed text-charcoal/80">{desc}</p>}

                {c.seats > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-sm font-bold text-charcoal/70">
                      <span>{tr('Seats', 'இடங்கள்')}</span>
                      <span>{full ? tr('Full', 'நிரம்பியது') : `${left} ${tr('left', 'மீதம்')}`}</span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sand/60">
                      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-600' : pct >= 80 ? 'bg-amber-500' : 'bg-saffron'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-1">
                  {registered ? (
                    <button type="button" disabled className="w-full cursor-not-allowed rounded-md border border-emerald-300 bg-emerald-50 px-5 py-3.5 text-base font-bold text-emerald-800">
                      {tr('You are registered', 'நீங்கள் பதிவு செய்துள்ளீர்கள்')}
                    </button>
                  ) : closed || full ? (
                    <button type="button" disabled className="w-full cursor-not-allowed rounded-md bg-sand/60 px-5 py-3.5 text-base font-bold text-charcoal/50">
                      {closed ? tr('Registration closed', 'பதிவு முடிந்தது') : tr('Full', 'நிரம்பியது')}
                    </button>
                  ) : (
                    <button type="button" onClick={() => openForm(c)} className="w-full rounded-md bg-maroon px-5 py-3.5 text-base font-bold text-white transition-colors hover:bg-saffron hover:text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon">
                      {!token() ? tr('Sign in to register', 'பதிவு செய்ய உள்நுழைக') : paidCamp ? tr('Register and pay', 'பதிவு செய்து செலுத்து') : tr('Register now', 'இப்போது பதிவு செய்')}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Registration pop-up */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/60 p-0 sm:items-center sm:p-4" onClick={() => !busy && setActive(null)} role="dialog" aria-modal="true" aria-label={tr('Camp registration', 'முகாம் பதிவு')}>
          <form ref={formRef} onSubmit={submit} noValidate onClick={(e) => e.stopPropagation()} className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl">
            <div className="border-t-4 border-saffron bg-maroon px-6 py-5 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-saffron">{tr('Camp registration', 'முகாம் பதிவு')}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold !text-white">{isTa ? active.title_ta || active.title_en : active.title_en}</h2>
              <p className="mt-1 text-sm text-white/85">{fmt(active.start_date)}{active.end_date !== active.start_date ? ` - ${fmt(active.end_date)}` : ''}</p>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              {errs.form && (
                <p role="alert" className="rounded-md border border-red-200 border-l-4 border-l-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  {errs.form}{/sign in|session/i.test(errs.form) && <Link href={loginHref} className="ml-2 underline">{tr('Sign in', 'உள்நுழைக')}</Link>}
                </p>
              )}
              {prefilling && <p className="text-sm font-semibold text-charcoal/60">{tr('Loading your details...', 'உங்கள் விவரங்கள் ஏற்றப்படுகின்றன...')}</p>}
              <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                {tr('A registration cannot be changed after it is confirmed. Please check the details before you continue.', 'பதிவு உறுதியான பின் மாற்ற இயலாது. தொடரும் முன் விவரங்களைச் சரிபார்க்கவும்.')}
              </p>

              <section className="space-y-4">
                <h3 className="border-b border-sand pb-2 text-sm font-bold uppercase tracking-[0.14em] text-maroon">{tr('Your details', 'உங்கள் விவரங்கள்')}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="cf-first" label={tr('First name *', 'முதல் பெயர் *')} error={errs.first}>
                    <input id="cf-first" autoComplete="given-name" value={f.first} onChange={(e) => set('first', cleanName(e.target.value))} className={inputCls(!!errs.first)} />
                  </Field>
                  <Field id="cf-last" label={tr('Last name *', 'கடைசி பெயர் *')} error={errs.last}>
                    <input id="cf-last" autoComplete="family-name" value={f.last} onChange={(e) => set('last', cleanName(e.target.value))} className={inputCls(!!errs.last)} />
                  </Field>
                </div>
                <Field id="cf-email" label={tr('Email *', 'மின்னஞ்சல் *')} error={errs.email}>
                  <input id="cf-email" type="email" autoComplete="email" value={f.email} onChange={(e) => set('email', cleanEmail(e.target.value))} className={inputCls(!!errs.email)} />
                </Field>
                <Field id="cf-phone" label={tr('Mobile number *', 'மொபைல் எண் *')} error={errs.phone}>
                  <div className="flex gap-2">
                    <select aria-label={tr('Country code', 'நாட்டின் குறியீடு')} value={f.cc} onChange={(e) => set('cc', e.target.value)} className={`${inputCls(false)} w-36 shrink-0 sm:w-48`}>
                      {COUNTRY_CODES.map((c) => <option key={`${c.code}-${c.country}`} value={c.code}>{c.label || `${c.country} (${c.code})`}</option>)}
                    </select>
                    <input id="cf-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={f.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, f.cc === '+91' ? 10 : 15))} className={inputCls(!!errs.phone)} />
                  </div>
                </Field>
              </section>

              <section className="space-y-4">
                <h3 className="border-b border-sand pb-2 text-sm font-bold uppercase tracking-[0.14em] text-maroon">{tr('Who is attending', 'யார் வருகிறார்கள்')}</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field id="cf-adults" label={tr('Adults *', 'பெரியவர்கள் *')} error={errs.adults}>
                    <input id="cf-adults" type="number" min={1} max={20} inputMode="numeric" value={f.adults} onChange={(e) => set('adults', e.target.value)} className={inputCls(!!errs.adults)} />
                  </Field>
                  <Field id="cf-children" label={tr('Children', 'குழந்தைகள்')} error={errs.children}>
                    <input id="cf-children" type="number" min={0} max={20} inputMode="numeric" value={f.children} onChange={(e) => set('children', e.target.value)} className={inputCls(!!errs.children)} />
                  </Field>
                  <div className="flex flex-col justify-end">
                    <span className="mb-1.5 block text-sm font-bold text-charcoal">{tr('Total people', 'மொத்த நபர்கள்')}</span>
                    <div className="flex h-12 items-center rounded-md border border-sand bg-cream/60 px-3.5 text-xl font-bold text-maroon">{total}</div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="border-b border-sand pb-2 text-sm font-bold uppercase tracking-[0.14em] text-maroon">{tr('Identification of every attendee', 'ஒவ்வொருவரின் அடையாளச் சான்று')}</h3>
                <p className="text-sm text-charcoal/75">
                  {tr(
                    'Each person attending needs an ID proof (number and document) and a profile photo. ID numbers are stored encrypted, and the documents are seen only by the ashram office. A child can use Aadhaar, PAN or Passport.',
                    'வருகை தரும் ஒவ்வொருவருக்கும் அடையாளச் சான்று (எண் மற்றும் ஆவணம்) மற்றும் புகைப்படம் தேவை. அடையாள எண்கள் குறியாக்கம் செய்து சேமிக்கப்படும்; ஆவணங்களை ஆசிரம அலுவலகம் மட்டுமே பார்க்கும். குழந்தைகள் ஆதார், பான் அல்லது கடவுச்சீட்டைப் பயன்படுத்தலாம்.'
                  )}
                </p>
                {att.map((a, i) => {
                  const adultsN = Math.floor(Number(f.adults)) || 0;
                  const isChild = i >= adultsN;
                  const title = isChild ? tr(`Child ${i - adultsN + 1}`, `குழந்தை ${i - adultsN + 1}`) : i === 0 ? tr('Adult 1 (you)', 'பெரியவர் 1 (நீங்கள்)') : tr(`Adult ${i + 1}`, `பெரியவர் ${i + 1}`);
                  const opts = isChild ? ID_OPTIONS.filter((o) => o.value !== 'voter') : ID_OPTIONS;
                  const idOpt = ID_OPTIONS.find((o) => o.value === a.idType);
                  const e = (n: string) => errs[`att-${i}-${n}`];
                  const fileCls = 'mt-0 block w-full text-sm text-charcoal file:mr-3 file:rounded-md file:border-0 file:bg-maroon file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-charcoal';
                  return (
                    <div key={i} className="space-y-4 rounded-lg border border-sand bg-cream/40 p-4">
                      <p className="text-sm font-bold uppercase tracking-wider text-maroon">{title}</p>
                      <Field id={`cf-att-${i}-name`} label={tr('Full name *', 'முழுப் பெயர் *')} error={e('name')}>
                        <input id={`cf-att-${i}-name`} value={a.name} onChange={(ev) => setAttField(i, { name: cleanName(ev.target.value), touched: true })} className={inputCls(!!e('name'))} />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field id={`cf-att-${i}-idType`} label={tr('ID proof *', 'அடையாளச் சான்று *')} error={e('idType')}>
                          <select id={`cf-att-${i}-idType`} value={a.idType} onChange={(ev) => setAttField(i, { idType: ev.target.value as IdType })} className={inputCls(!!e('idType'))}>
                            <option value="">{tr('-- Choose --', '-- தேர்வு செய்க --')}</option>
                            {opts.map((o) => <option key={o.value} value={o.value}>{tr(o.en, o.ta)}</option>)}
                          </select>
                        </Field>
                        <Field id={`cf-att-${i}-idNumber`} label={tr('ID number *', 'அடையாள எண் *')} error={e('idNumber')}>
                          <input
                            id={`cf-att-${i}-idNumber`}
                            value={a.idNumber}
                            disabled={!a.idType}
                            autoComplete="off"
                            placeholder={idOpt?.ph || ''}
                            onChange={(ev) => setAttField(i, { idNumber: ev.target.value.replace(/[^A-Za-z0-9 -]/g, '').slice(0, 20) })}
                            className={`${inputCls(!!e('idNumber'))} disabled:cursor-not-allowed disabled:bg-sand/30`}
                          />
                        </Field>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field id={`cf-att-${i}-doc`} label={tr('ID proof document *', 'அடையாளச் சான்று ஆவணம் *')} error={e('doc')} hint={tr('JPG, PNG or PDF, up to 5 MB.', 'JPG, PNG அல்லது PDF, 5 MB வரை.')}>
                          <input key={`doc-${fileKey}-${i}`} id={`cf-att-${i}-doc`} type="file" accept="image/jpeg,image/png,application/pdf" onChange={(ev) => pickFile(i, 'doc', ev.target.files?.[0] || null)} className={fileCls} />
                          <FilePreview file={a.doc} />
                        </Field>
                        <Field id={`cf-att-${i}-photo`} label={tr('Profile photo *', 'புகைப்படம் *')} error={e('photo')} hint={tr('A clear recent photo, face visible. JPG, PNG or WebP, up to 5 MB.', 'தெளிவான சமீபத்திய புகைப்படம். JPG, PNG அல்லது WebP, 5 MB வரை.')}>
                          <input key={`photo-${fileKey}-${i}`} id={`cf-att-${i}-photo`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(ev) => pickFile(i, 'photo', ev.target.files?.[0] || null)} className={fileCls} />
                          <FilePreview file={a.photo} />
                        </Field>
                      </div>
                    </div>
                  );
                })}
              </section>

              <section className="space-y-4">
                <h3 className="border-b border-sand pb-2 text-sm font-bold uppercase tracking-[0.14em] text-maroon">{tr('Where you are from', 'நீங்கள் வசிக்கும் இடம்')}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="cf-city" label={tr('City *', 'நகரம் *')} error={errs.city}>
                    <input id="cf-city" autoComplete="address-level2" value={f.city} onChange={(e) => set('city', cleanPlace(e.target.value))} className={inputCls(!!errs.city)} />
                  </Field>
                  <Field id="cf-state" label={tr('State', 'மாநிலம்')} error={errs.state}>
                    <input id="cf-state" autoComplete="address-level1" value={f.state} onChange={(e) => set('state', cleanPlace(e.target.value))} className={inputCls(!!errs.state)} />
                  </Field>
                </div>
                <Field id="cf-notes" label={tr('Note (optional)', 'குறிப்பு (விருப்பம்)')} hint={tr('For example food needs or travel details.', 'எ.கா. உணவு தேவைகள் அல்லது பயண விவரங்கள்.')}>
                  <textarea id="cf-notes" rows={3} maxLength={500} value={f.notes} onChange={(e) => set('notes', cleanNote(e.target.value))} className="w-full rounded-md border border-sand bg-white px-3.5 py-3 text-base text-charcoal focus:border-maroon focus:outline-none focus:ring-2 focus:ring-saffron/40" />
                </Field>
              </section>

              {activePaid && (
                <section className="flex items-end justify-between rounded-md border border-saffron bg-saffron/10 px-5 py-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider text-charcoal/60">{tr('Amount to pay', 'செலுத்த வேண்டிய தொகை')}</p>
                    <p className="text-sm text-charcoal/70">{rupees(active!.fee_amount)} × {total} {tr(total === 1 ? 'person' : 'people', 'நபர்கள்')}</p>
                  </div>
                  <p className="font-display text-3xl font-bold text-maroon">{rupees(amountToPay)}</p>
                </section>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-sand bg-cream/40 px-6 py-4 sm:flex-row sm:justify-end">
              <button type="button" disabled={busy} onClick={() => setActive(null)} className="rounded-md border border-sand bg-white px-6 py-3 text-base font-bold text-charcoal hover:border-maroon disabled:opacity-60">{tr('Cancel', 'ரத்து')}</button>
              <button type="submit" disabled={busy} className="rounded-md bg-maroon px-8 py-3 text-base font-bold text-white transition-colors hover:bg-charcoal disabled:opacity-60">
                {busy ? tr('Please wait...', 'காத்திருக்கவும்...') : activePaid ? `${tr('Pay', 'செலுத்து')} ${rupees(amountToPay)}` : tr('Confirm registration', 'பதிவை உறுதி செய்')}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}