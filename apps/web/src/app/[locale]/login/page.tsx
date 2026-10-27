'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { COUNTRY_CODES } from '@/data/countryCodes';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
// Must match the path where devoteeAuth.ts is mounted in apps/api/src/index.ts
const AUTH = `${API_BASE}/devotee-auth`;
const TOKEN_KEY = 'devotee_token';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

const RASI = ['Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)', 'Karka (Cancer)', 'Simha (Leo)', 'Kanya (Virgo)', 'Tula (Libra)', 'Vrischika (Scorpio)', 'Dhanu (Sagittarius)', 'Makara (Capricorn)', 'Kumbha (Aquarius)', 'Meena (Pisces)'];
const NAKSHATRAM = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
const PASSWORD_RULES: [string, (p: string) => boolean][] = [
  ['8 or more characters', (p) => p.length >= 8], ['An upper case letter', (p) => /[A-Z]/.test(p)], ['A lower case letter', (p) => /[a-z]/.test(p)],
  ['A number', (p) => /\d/.test(p)], ['A symbol, like @ # $ !', (p) => /[^A-Za-z0-9]/.test(p)],
];

// Swamiji's raised hands inside the arch, as % of the arch (0,0 = top-left).
const HANDS = [{ x: 31, y: 52 }, { x: 67, y: 52 }];
const SPARKLES = [
  { dx: 0, dy: -9, size: 20, delay: 0 }, { dx: -7, dy: -2, size: 13, delay: 0.7 }, { dx: 7, dy: -4, size: 15, delay: 1.4 },
  { dx: -4, dy: 8, size: 11, delay: 2.0 }, { dx: 6, dy: 7, size: 17, delay: 0.4 }, { dx: 0, dy: 0, size: 12, delay: 1.1 },
];
const CSS = `
@keyframes sparkle-twinkle { 0%,100% { opacity: .15; transform: scale(.5) rotate(0deg); } 50% { opacity: 1; transform: scale(1.15) rotate(45deg); } }
.sparkle { animation: sparkle-twinkle 2.6s ease-in-out infinite; filter: drop-shadow(0 0 6px rgba(255,214,140,.95)); }
@keyframes halo-breathe { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
.halo { animation: halo-breathe 4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .sparkle { animation: none; opacity: .85; } .halo { animation: none; } }
`;

const input = 'w-full rounded-md border border-charcoal/30 bg-white px-3.5 py-2.5 text-base text-charcoal placeholder:text-charcoal/40 focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/40';
const primary = 'inline-flex w-full items-center justify-center rounded-md bg-maroon px-5 py-3 text-base font-bold text-white shadow-md transition hover:bg-maroon/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const ghost = 'inline-flex items-center justify-center rounded-md border-2 border-maroon px-5 py-3 text-base font-bold text-maroon transition hover:bg-maroon hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2';

// ---------- Allowed characters (the API checks the same rules again) ----------
const cleanName = (v: string) => v.replace(/[^\p{L}\p{M} .'-]/gu, '').replace(/\s{2,}/g, ' ').slice(0, 60);
const cleanText = (v: string) => v.replace(/[^\p{L}\p{M}\p{N} ().'-]/gu, '').replace(/\s{2,}/g, ' ').slice(0, 80);
const cleanEmail = (v: string) => v.replace(/[^A-Za-z0-9._+\-@]/g, '').slice(0, 100);
const cleanWho = (v: string) => v.replace(/[^A-Za-z0-9@._+\-\s]/g, '').slice(0, 100);
const emailOk = (v: string) => /^[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(v);
const nameOk = (v: string) => /^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,59}$/u.test(v.trim());
const mobileOk = (code: string, digits: string) => (code === '+91' ? /^[6-9]\d{9}$/.test(digits) : /^\d{6,15}$/.test(digits));

// Aadhaar checksum (Verhoeff)
const VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
function aadhaarOk(a: string): boolean {
  if (!/^[2-9][0-9]{11}$/.test(a)) return false;
  let c = 0;
  const d = a.split('').reverse().map(Number);
  for (let i = 0; i < d.length; i++) c = VD[c][VP[i % 8][d[i]]];
  return c === 0;
}

// Only allow a redirect to a page on this same site
function safeRedirect(raw: string | null, fallback: string): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') && !/^\/[a-z]+:/i.test(raw)) return raw;
  return fallback;
}

async function readJson(res: Response): Promise<any> {
  try { return await res.json(); } catch { return {}; }
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold text-charcoal">{label}</label>
      {children}
      {error ? <p role="alert" className="mt-1 text-sm font-semibold text-maroon">{error}</p> : hint ? <p className="mt-1 text-xs text-charcoal/65">{hint}</p> : null}
    </div>
  );
}

function FormError({ text }: { text?: string }) {
  if (!text) return null;
  return <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700">{text}</p>;
}

function Eye({ on }: { on: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={on ? 'M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-3.2 3.7M6.6 7.7A15 15 0 0 0 3 12s4 6 9 6a9 9 0 0 0 3.4-.7' : 'M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'} />
    </svg>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} maxLength={72} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className={`${input} pr-12`} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-2 text-charcoal/60 hover:text-maroon focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron"><Eye on={show} /></button>
    </div>
  );
}

function Captcha({ a, b, value, onChange, error }: { a: number; b: number; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field id="captcha" label={`I am not a robot: what is ${a} + ${b}?`} error={error}>
      <input id="captcha" inputMode="numeric" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 3))} className={`${input} max-w-[8rem]`} />
    </Field>
  );
}

const newSum = () => ({ a: 2 + Math.floor(Math.random() * 7), b: 2 + Math.floor(Math.random() * 7) });

// ---------- Google button (hidden until NEXT_PUBLIC_GOOGLE_CLIENT_ID is set) ----------
function GoogleSignIn({ onToken }: { onToken: (token: string) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  const handler = useRef<(credential: string) => void>(() => {});

  handler.current = async (credential: string) => {
    setErr('');
    try {
      const res = await fetch(`${AUTH}/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
      const data = await readJson(res);
      if (res.ok && data.token) { onToken(data.token); return; }
      setErr(data.message || 'Google sign-in failed. Please try again.');
    } catch {
      setErr('Network error. Please check your connection and try again.');
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    const draw = () => {
      const g = (window as any).google?.accounts?.id;
      if (!g || cancelled || !holder.current) return;
      g.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r: any) => r?.credential && handler.current(r.credential) });
      holder.current.innerHTML = '';
      g.renderButton(holder.current, { theme: 'outline', size: 'large', shape: 'rectangular', text: 'continue_with', width: Math.min(400, holder.current.offsetWidth || 320) });
    };

    if ((window as any).google?.accounts?.id) {
      draw();
    } else {
      let s = document.getElementById('google-gsi') as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement('script');
        s.id = 'google-gsi';
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener('load', draw);
    }
    return () => { cancelled = true; };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-charcoal/50" aria-hidden="true"><span className="h-px flex-1 bg-charcoal/20" />or<span className="h-px flex-1 bg-charcoal/20" /></div>
      <div ref={holder} className="flex min-h-[44px] w-full justify-center" />
      <FormError text={err} />
    </div>
  );
}

type Ids = { pan: string; aadhaar: string };
type OtpTarget = { email: string; ids?: Ids; sendOnOpen?: boolean };

/* ---------------- Sign in: step 1 = who are you, step 2 = password ---------------- */
function SignIn({ notice, onRegister, onForgot, onNeedOtp, onToken }: { notice?: string; onRegister: () => void; onForgot: (email: string) => void; onNeedOtp: (email: string) => void; onToken: (token: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [who, setWho] = useState('');
  const [pw, setPw] = useState('');
  const [sum] = useState(newSum);
  const [cap, setCap] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});

  function next(e: React.FormEvent) {
    e.preventDefault();
    const v = who.trim();
    const digits = v.replace(/\D/g, '');
    const isMobile = !v.includes('@') && digits.length >= 10 && digits.length <= 15;
    if (!emailOk(v) && !isMobile) { setErr({ who: 'Enter your email or mobile number (at least 10 digits)' }); return; }
    setErr({}); setStep(2);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const x: Record<string, string> = {};
    if (!pw) x.pw = 'Enter your password';
    if (cap !== String(sum.a + sum.b)) x.cap = 'That answer is not right';
    setErr(x);
    if (Object.keys(x).length) return;

    const v = who.trim();
    const identifier = emailOk(v) ? v.toLowerCase() : v.replace(/\D/g, '').slice(-10);
    setBusy(true);
    try {
      const res = await fetch(`${AUTH}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: pw, terms_accepted: true }),
      });
      const data = await readJson(res);
      if (res.ok && data.token) { onToken(data.token); return; }
      if (res.status === 403 && data.requiresOtp && data.email) { onNeedOtp(data.email); return; }
      setErr({ form: data.message || 'Sign in failed. Please try again.' });
    } catch {
      setErr({ form: 'Network error. Please check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight text-maroon">Devotee sign in</h1>
      <p className="mt-1 text-sm text-charcoal/70">Sign in to see your sevas, donations and receipts.</p>

      {notice && <p role="status" className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-800">{notice}</p>}

      {step === 1 ? (
        <form onSubmit={next} noValidate className="mt-6 space-y-4">
          <Field id="who" label="Email or mobile number" error={err.who} hint="For a mobile number, type it without the country code">
            <input id="who" autoFocus autoComplete="username" value={who} onChange={(e) => { setWho(cleanWho(e.target.value)); setErr({}); }} placeholder="you@example.com or 98765 43210" className={input} />
          </Field>
          <button type="submit" className={primary}>Next</button>
          <GoogleSignIn onToken={onToken} />
        </form>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-md bg-rose px-3.5 py-2.5 text-sm">
            <span className="truncate font-semibold text-charcoal">{who}</span>
            <button type="button" onClick={() => { setStep(1); setPw(''); setErr({}); }} className="shrink-0 font-bold text-maroon underline underline-offset-4">Change</button>
          </div>
          <FormError text={err.form} />
          <Field id="pw" label="Password" error={err.pw}><PasswordInput id="pw" value={pw} onChange={(v) => { setPw(v); setErr({}); }} autoComplete="current-password" /></Field>
          <Captcha a={sum.a} b={sum.b} value={cap} onChange={setCap} error={err.cap} />
          <div className="text-right text-sm">
            <button type="button" onClick={() => onForgot(emailOk(who.trim()) ? who.trim().toLowerCase() : '')} className="font-bold text-maroon underline underline-offset-4">Forgot password?</button>
          </div>
          <button type="submit" disabled={busy} className={primary}>{busy ? 'Signing in...' : 'Sign in'}</button>
          <p className="text-center text-xs text-charcoal/65">By signing in you agree to the Terms and Privacy Policy. Your session lasts 24 hours.</p>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-charcoal/80">New devotee? <button type="button" onClick={onRegister} className="font-bold text-maroon underline underline-offset-4">Create an account</button></p>
    </div>
  );
}

/* ---------------- Forgot password: step 1 = email, step 2 = code + new password ---------------- */
function Forgot({ initialEmail, onBack, onDone }: { initialEmail: string; onBack: () => void; onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [info, setInfo] = useState('');
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    const v = email.trim().toLowerCase();
    if (!emailOk(v)) { setErr({ email: 'Enter the email you registered with' }); return; }
    setBusy(true); setErr({}); setInfo('');
    try {
      const res = await fetch(`${AUTH}/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: v }) });
      const data = await readJson(res);
      if (res.ok) {
        setStep(2); setWait(60);
        setInfo('If this email is registered, a 6 digit code has been sent. Check your spam folder too.');
      } else {
        setErr({ form: data.message || 'Could not send the code. Please try again.' });
      }
    } catch {
      setErr({ form: 'Network error. Please check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const x: Record<string, string> = {};
    if (!/^\d{6}$/.test(otp)) x.otp = 'Enter the 6 digit code';
    if (!PASSWORD_RULES.every(([, ok]) => ok(pw))) x.pw = 'Password does not meet all the rules';
    if (pw !== pw2) x.pw2 = 'The two passwords are not the same';
    setErr(x);
    if (Object.keys(x).length) return;

    setBusy(true); setInfo('');
    try {
      const res = await fetch(`${AUTH}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp, new_password: pw }),
      });
      const data = await readJson(res);
      if (res.ok) { onDone(); return; }
      setErr({ form: data.message || 'Could not change the password. Please try again.' });
    } catch {
      setErr({ form: 'Network error. Please check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight text-maroon">Reset password</h1>
      <p className="mt-1 text-sm text-charcoal/70">
        {step === 1 ? 'Enter your email and we will send you a 6 digit code.' : <>Enter the code sent to <strong className="text-charcoal">{email.trim().toLowerCase()}</strong> and choose a new password.</>}
      </p>

      {step === 1 ? (
        <form onSubmit={sendCode} noValidate className="mt-6 space-y-4">
          <FormError text={err.form} />
          <Field id="f-email" label="Email" error={err.email}>
            <input id="f-email" type="email" autoFocus autoComplete="email" value={email} onChange={(e) => { setEmail(cleanEmail(e.target.value)); setErr({}); }} className={input} />
          </Field>
          <button type="submit" disabled={busy} className={primary}>{busy ? 'Sending...' : 'Send code'}</button>
          <button type="button" onClick={onBack} className="block w-full text-center text-sm font-bold text-maroon underline underline-offset-4">Back to sign in</button>
        </form>
      ) : (
        <form onSubmit={reset} noValidate className="mt-6 space-y-4">
          <FormError text={err.form} />
          {info && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-800">{info}</p>}
          <Field id="f-otp" label="Verification code" error={err.otp}>
            <input id="f-otp" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr({}); }} placeholder="123456" className={`${input} text-center text-xl font-bold tracking-[0.4em]`} />
          </Field>
          <Field id="f-pw" label="New password" error={err.pw}><PasswordInput id="f-pw" value={pw} onChange={(v) => { setPw(v); setErr({}); }} autoComplete="new-password" /></Field>
          <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2" aria-label="Password rules">
            {PASSWORD_RULES.map(([label, ok]) => (
              <li key={label} className={ok(pw) ? 'font-semibold text-charcoal' : 'text-charcoal/55'}><span aria-hidden="true" className={`mr-1.5 ${ok(pw) ? 'text-saffron' : ''}`}>{ok(pw) ? '✓' : '○'}</span>{label}</li>
            ))}
          </ul>
          <Field id="f-pw2" label="Type the new password again" error={err.pw2}><PasswordInput id="f-pw2" value={pw2} onChange={(v) => { setPw2(v); setErr({}); }} autoComplete="new-password" /></Field>
          <button type="submit" disabled={busy} className={primary}>{busy ? 'Saving...' : 'Change password'}</button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={onBack} className="font-bold text-maroon underline underline-offset-4">Back to sign in</button>
            <button type="button" onClick={() => sendCode()} disabled={wait > 0 || busy} className="font-bold text-maroon underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50">{wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---------------- Create account: 3 short steps ---------------- */
function Register({ onSignIn, onNeedOtp, onToken }: { onSignIn: () => void; onNeedOtp: (t: OtpTarget) => void; onToken: (token: string) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [f, setF] = useState({ first: '', last: '', email: '', cc: '+91', phone: '', aadhaar: '', pan: '', rasi: '', nakshatram: '', gotram: '', pw: '', pw2: '', agree: false });
  const [photo, setPhoto] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [sum] = useState(newSum);
  const [cap, setCap] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f, v: string | boolean) => { setF((x) => ({ ...x, [k]: v })); setErr((x) => ({ ...x, [k]: '', form: '' })); };

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const x: Record<string, string> = {};
    if (step === 1) {
      if (!nameOk(f.first)) x.first = 'Enter your first name (letters only)';
      if (!nameOk(f.last)) x.last = 'Enter your last name (letters only)';
      if (!emailOk(f.email.trim())) x.email = 'Enter a valid email';
      if (!mobileOk(f.cc, f.phone.replace(/\D/g, ''))) x.phone = f.cc === '+91' ? 'Enter a 10 digit mobile number' : 'Enter a valid mobile number (6 to 15 digits)';
    }
    if (step === 2) {
      const aad = f.aadhaar.replace(/\s/g, '');
      if (aad && !aadhaarOk(aad)) x.aadhaar = 'Enter a valid 12 digit Aadhaar number';
      if (f.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(f.pan)) x.pan = 'PAN looks like ABCPE1234F';
      if (!x.aadhaar && !x.pan && (aad ? !f.pan : !!f.pan)) x.pan = 'Enter both PAN and Aadhaar, or leave both blank';
    }
    if (step === 3) {
      if (!PASSWORD_RULES.every(([, ok]) => ok(f.pw))) x.pw = 'Password does not meet all the rules';
      if (f.pw !== f.pw2) x.pw2 = 'The two passwords are not the same';
      if (cap !== String(sum.a + sum.b)) x.cap = 'That answer is not right';
      if (!f.agree) x.agree = 'Please accept the terms to continue';
    }
    setErr(x);
    if (Object.keys(x).length) return;
    if (step < 3) { setStep((step + 1) as 2 | 3); return; }

    const body = new FormData();
    body.append('first_name', f.first.trim());
    body.append('last_name', f.last.trim());
    body.append('email', f.email.trim().toLowerCase());
    body.append('phone', f.phone.replace(/\D/g, ''));
    body.append('country_code', f.cc);
    body.append('password', f.pw);
    body.append('confirm_password', f.pw2);
    body.append('rasi', f.rasi);
    body.append('nakshathiram', f.nakshatram);
    body.append('gothram', f.gotram.trim());
    body.append('terms_accepted', 'true');
    if (photoFile) body.append('photo', photoFile);

    setBusy(true);
    try {
      const res = await fetch(`${AUTH}/register`, { method: 'POST', body });
      const data = await readJson(res);
      if (res.ok) {
        const aad = f.aadhaar.replace(/\s/g, '');
        onNeedOtp({
          email: String(data.email || f.email.trim().toLowerCase()),
          ids: aad && f.pan ? { pan: f.pan, aadhaar: aad } : undefined,
        });
        return;
      }
      const msg: string = data.message || 'Could not create the account. Please try again.';
      setErr({ form: msg });
      if (/name|email|mobile|country/i.test(msg)) setStep(1);
    } catch {
      setErr({ form: 'Network error. Please check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  function pickPhoto(file?: File) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setErr((x) => ({ ...x, photo: 'Choose a JPG, PNG or WebP picture' })); return; }
    if (file.size > 4 * 1024 * 1024) { setErr((x) => ({ ...x, photo: 'The picture must be under 4MB' })); return; }
    setErr((x) => ({ ...x, photo: '' }));
    setPhotoFile(file);
    setPhoto(URL.createObjectURL(file));
  }

  const titles = ['About you', 'Details for sevas and receipts', 'Set a password'];
  const step2Empty = !f.aadhaar && !f.pan && !f.rasi && !f.nakshatram && !f.gotram && !photoFile;
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight text-maroon">Create account</h1>
      <ol className="mt-3 flex items-center gap-2" aria-label="Progress">
        {[1, 2, 3].map((n) => (
          <li key={n} className="flex items-center gap-2" aria-current={step === n ? 'step' : undefined}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${step > n ? 'bg-saffron text-white' : step === n ? 'bg-maroon text-white' : 'bg-rose text-charcoal/60'}`}>{step > n ? '✓' : n}</span>
            {n < 3 && <span aria-hidden="true" className={`h-0.5 w-8 ${step > n ? 'bg-saffron' : 'bg-rose'}`} />}
          </li>
        ))}
        <li className="ml-2 text-sm font-semibold text-charcoal/80">{titles[step - 1]}</li>
      </ol>

      <form onSubmit={go} noValidate className="mt-5 space-y-4">
        <FormError text={err.form} />

        {step === 1 && (<>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="r-first" label="First name" error={err.first}><input id="r-first" autoFocus autoComplete="given-name" value={f.first} onChange={(e) => set('first', cleanName(e.target.value))} className={input} /></Field>
            <Field id="r-last" label="Last name" error={err.last}><input id="r-last" autoComplete="family-name" value={f.last} onChange={(e) => set('last', cleanName(e.target.value))} className={input} /></Field>
          </div>
          <Field id="r-email" label="Email" error={err.email} hint="We send a verification code to this email"><input id="r-email" type="email" autoComplete="email" value={f.email} onChange={(e) => set('email', cleanEmail(e.target.value))} className={input} /></Field>
          <Field id="r-phone" label="Mobile number" error={err.phone}>
            <div className="flex gap-2">
              <select aria-label="Country code" value={f.cc} onChange={(e) => set('cc', e.target.value)} className={`${input} w-36 shrink-0 sm:w-44`}>
                {COUNTRY_CODES.map((c) => (
                  <option key={`${c.code}-${c.country}`} value={c.code}>{c.label || `${c.country} (${c.code})`}</option>
                ))}
              </select>
              <input id="r-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={f.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, f.cc === '+91' ? 10 : 15))} placeholder={f.cc === '+91' ? '9876543210' : ''} className={input} />
            </div>
          </Field>
          <GoogleSignIn onToken={onToken} />
        </>)}

        {step === 2 && (<>
          <p className="text-sm text-charcoal/70">All of these are optional. You can add them later from your profile.</p>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose ring-2 ring-saffron/60">
              {photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo} alt="Your picture" className="h-full w-full object-cover" /> : <span aria-hidden="true" className="text-sm font-bold text-maroon/70">Photo</span>}
            </div>
            <div>
              <label className="cursor-pointer text-sm font-bold text-maroon underline underline-offset-4">{photo ? 'Change picture' : 'Add a picture'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} /></label>
              {photo && <button type="button" onClick={() => { setPhoto(''); setPhotoFile(null); }} className="ml-3 text-sm font-bold text-charcoal/70 underline underline-offset-4">Remove</button>}
              {err.photo && <p role="alert" className="mt-1 text-sm font-semibold text-maroon">{err.photo}</p>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="r-rasi" label="Rasi (moon sign)"><select id="r-rasi" value={f.rasi} onChange={(e) => set('rasi', e.target.value)} className={input}><option value="">Select</option>{RASI.map((r) => <option key={r}>{r}</option>)}</select></Field>
            <Field id="r-nak" label="Nakshatram (birth star)"><select id="r-nak" value={f.nakshatram} onChange={(e) => set('nakshatram', e.target.value)} className={input}><option value="">Select</option>{NAKSHATRAM.map((r) => <option key={r}>{r}</option>)}</select></Field>
          </div>
          <Field id="r-gotram" label="Gotram"><input id="r-gotram" value={f.gotram} onChange={(e) => set('gotram', cleanText(e.target.value))} placeholder="For example Atri" className={input} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="r-aadhaar" label="Aadhaar number" error={err.aadhaar} hint="Stored encrypted. Only the last 4 digits are ever shown"><input id="r-aadhaar" inputMode="numeric" autoComplete="off" value={f.aadhaar} onChange={(e) => set('aadhaar', e.target.value.replace(/[^\d\s]/g, '').slice(0, 14))} className={input} /></Field>
            <Field id="r-pan" label="PAN" error={err.pan} hint="For donation receipts"><input id="r-pan" autoComplete="off" value={f.pan} onChange={(e) => set('pan', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="ABCPE1234F" className={input} /></Field>
          </div>
        </>)}

        {step === 3 && (<>
          <Field id="r-pw" label="Password" error={err.pw}><PasswordInput id="r-pw" value={f.pw} onChange={(v) => set('pw', v)} autoComplete="new-password" /></Field>
          <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2" aria-label="Password rules">
            {PASSWORD_RULES.map(([label, ok]) => (
              <li key={label} className={ok(f.pw) ? 'font-semibold text-charcoal' : 'text-charcoal/55'}><span aria-hidden="true" className={`mr-1.5 ${ok(f.pw) ? 'text-saffron' : ''}`}>{ok(f.pw) ? '✓' : '○'}</span>{label}</li>
            ))}
          </ul>
          <Field id="r-pw2" label="Type the password again" error={err.pw2}><PasswordInput id="r-pw2" value={f.pw2} onChange={(v) => set('pw2', v)} autoComplete="new-password" /></Field>
          <Captcha a={sum.a} b={sum.b} value={cap} onChange={setCap} error={err.cap} />
          <div>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm"><input type="checkbox" checked={f.agree} onChange={(e) => set('agree', e.target.checked)} className="mt-0.5 h-4 w-4 accent-maroon" /><span>I agree to the <strong className="text-maroon">Terms</strong> and <strong className="text-maroon">Privacy Policy</strong>.</span></label>
            {err.agree && <p role="alert" className="mt-1 text-sm font-semibold text-maroon">{err.agree}</p>}
          </div>
        </>)}

        <div className="flex gap-3 pt-1">
          {step > 1 && <button type="button" onClick={() => setStep((step - 1) as 1 | 2)} className={ghost}>Back</button>}
          <button type="submit" disabled={busy} className={primary}>{busy ? 'Creating...' : step === 3 ? 'Create account' : step === 2 && step2Empty ? 'Skip for now' : 'Next'}</button>
        </div>
      </form>

      <p className="mt-5 text-center text-sm text-charcoal/80">Already have an account? <button type="button" onClick={onSignIn} className="font-bold text-maroon underline underline-offset-4">Sign in</button></p>
    </div>
  );
}

/* ---------------- Email verification code ---------------- */
function OtpStep({ target, onBack, onToken }: { target: OtpTarget; onBack: () => void; onToken: (token: string) => void }) {
  const { email, sendOnOpen } = target;
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  // The API allows one new code per minute
  const [wait, setWait] = useState(60);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendCode() {
    setErr(''); setInfo('');
    try {
      const res = await fetch(`${AUTH}/resend-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await readJson(res);
      if (res.ok) {
        setInfo('A new code has been sent. Please check your inbox and spam folder.');
        setWait(60);
      } else {
        setErr(data.message || 'Could not send a new code.');
      }
    } catch {
      setErr('Network error. Please try again.');
    }
  }

  // Signing in with an account that is not verified yet: no code was sent, so send one now
  useEffect(() => {
    if (sendOnOpen) sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(otp)) { setErr('Enter the 6 digit code'); return; }
    setBusy(true); setErr(''); setInfo('');
    try {
      const res = await fetch(`${AUTH}/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp }) });
      const data = await readJson(res);
      if (res.ok && data.token) { onToken(data.token); return; }
      setErr(data.message || 'The code is not correct.');
    } catch {
      setErr('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold leading-tight text-maroon">Verify your email</h1>
      <p className="mt-1 text-sm text-charcoal/70">We sent a 6 digit code to <strong className="text-charcoal">{email}</strong>. It is valid for 10 minutes. Check your spam folder too.</p>
      <form onSubmit={verify} noValidate className="mt-6 space-y-4">
        <FormError text={err} />
        {info && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-800">{info}</p>}
        <Field id="otp" label="Verification code">
          <input id="otp" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }} placeholder="123456" className={`${input} text-center text-xl font-bold tracking-[0.4em]`} />
        </Field>
        <button type="submit" disabled={busy} className={primary}>{busy ? 'Verifying...' : 'Verify and continue'}</button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={onBack} className="font-bold text-maroon underline underline-offset-4">Back</button>
          <button type="button" onClick={sendCode} disabled={wait > 0} className="font-bold text-maroon underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50">{wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- The page ---------------- */
function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useParams<{ locale: string }>();
  const home = `/${locale ?? 'en'}`;
  const redirectTo = safeRedirect(searchParams.get('redirect'), `${home}/profile`);
  const expired = searchParams.get('expired') === '1';

  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [otpFor, setOtpFor] = useState<OtpTarget | null>(null);
  const [checking, setChecking] = useState(true);

  // If a valid session already exists, go straight on. An invalid one is cleared. No redirect loop is possible.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setChecking(false); return; }
    fetch(`${API_BASE}/devotee/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.ok) { router.replace(redirectTo); return; }
        localStorage.removeItem(TOKEN_KEY);
        window.dispatchEvent(new Event('devotee-auth-change'));
        setChecking(false);
      })
      .catch(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish(token: string, ids?: Ids) {
    localStorage.setItem(TOKEN_KEY, token);
    // Save PAN and Aadhaar (encrypted on the server) if they were entered at sign-up
    if (ids) {
      try {
        await fetch(`${API_BASE}/donation-profile/ids`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ panNumber: ids.pan, aadhaarNumber: ids.aadhaar }),
        });
      } catch {
        // They can be added later from the profile page
      }
    }
    window.dispatchEvent(new Event('devotee-auth-change'));
    router.replace(redirectTo);
  }

  if (checking) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-white px-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/60">Checking your session...</p>
      </main>
    );
  }

  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-4 py-4">
      <style>{CSS}</style>
      <svg aria-hidden="true" viewBox="0 0 400 400" className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[60rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 text-saffron/20">
        {[190, 150, 110, 70].map((r) => <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={r % 3 ? '2 8' : undefined} />)}
        {Array.from({ length: 16 }).map((_, i) => <ellipse key={i} cx="200" cy="70" rx="14" ry="40" fill="none" stroke="currentColor" strokeWidth="1.5" transform={`rotate(${i * 22.5} 200 200)`} />)}
      </svg>
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 -z-10 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose/60 blur-3xl" />

      <div className="grid w-full max-w-[34rem] border-t-4 border-saffron bg-white shadow-[0_20px_60px_rgba(35,26,24,0.22)] ring-1 ring-rose lg:max-w-[58rem] lg:grid-cols-[34rem_minmax(0,1fr)]">
        <section className="px-6 py-6 sm:px-9 sm:py-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <Link href={home} className="inline-flex items-center gap-1.5 text-sm font-bold text-maroon hover:text-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron"><span aria-hidden="true">←</span> Back</Link>
            <div className="flex items-center gap-2.5">
              <Image src="/images/ashram-seal.png" alt="" width={36} height={36} className="h-9 w-9 rounded-full ring-2 ring-saffron/60" />
              <div className="text-right leading-tight"><p className="font-display text-lg font-bold text-maroon">Vedaneri</p><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-saffron">Vedapuri Ashramam</p></div>
            </div>
          </div>

          {expired && !otpFor && tab === 'login' && (
            <p role="status" className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm font-semibold text-amber-900">Your session ended. Please sign in again.</p>
          )}

          {otpFor ? (
            <OtpStep key={otpFor.email} target={otpFor} onBack={() => setOtpFor(null)} onToken={(t) => finish(t, otpFor.ids)} />
          ) : tab === 'forgot' ? (
            <Forgot initialEmail={forgotEmail} onBack={() => setTab('login')} onDone={() => { setNotice('Your password was changed. Please sign in with the new password.'); setTab('login'); }} />
          ) : tab === 'login' ? (
            <SignIn
              notice={notice}
              onRegister={() => { setNotice(''); setTab('register'); }}
              onForgot={(email) => { setForgotEmail(email); setNotice(''); setTab('forgot'); }}
              onNeedOtp={(email) => setOtpFor({ email, sendOnOpen: true })}
              onToken={(t) => finish(t)}
            />
          ) : (
            <Register onSignIn={() => setTab('login')} onNeedOtp={(t) => setOtpFor(t)} onToken={(t) => finish(t)} />
          )}
        </section>

        <aside aria-label="Swamiji's blessing" className="relative isolate hidden flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-maroon via-[#6a1717] to-charcoal px-6 py-6 text-center text-white lg:flex">
          <div aria-hidden="true" className="absolute left-1/2 top-[38%] -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-saffron/30 blur-3xl" />
          <div className="relative aspect-[4/5] h-[min(22rem,calc(100vh-17rem))]">
            <div aria-hidden="true" className="absolute -inset-2.5 rounded-t-full border border-saffron/50" />
            <div aria-hidden="true" className="absolute inset-0 rounded-t-full shadow-[0_0_50px_rgba(217,119,6,0.55)]" />
            <div className="relative h-full w-full overflow-hidden rounded-t-full border-[3px] border-saffron bg-charcoal">
              <Image src="/images/swamiji-cutout.png" alt="" fill priority sizes="20rem" className="object-cover" style={{ objectPosition: '50% 30%' }} />
              {HANDS.map((h, hi) => (
                <div key={hi} aria-hidden="true">
                  <div className="halo absolute h-16 w-16 rounded-full bg-[radial-gradient(circle,rgba(255,226,160,0.75),transparent_70%)]" style={{ left: `${h.x}%`, top: `${h.y}%`, marginLeft: -32, marginTop: -32 }} />
                  {SPARKLES.map((s, i) => (
                    <svg key={i} viewBox="0 0 24 24" className="sparkle absolute text-white"
                      style={{ left: `calc(${h.x}% + ${s.dx}%)`, top: `calc(${h.y}% + ${s.dy}%)`, width: s.size * 0.85, height: s.size * 0.85, marginLeft: -s.size * 0.425, marginTop: -s.size * 0.425, animationDelay: `${s.delay + hi * 0.5}s` }}>
                      <path d="M12 0c.8 6.2 5.8 11.2 12 12-6.2.8-11.2 5.8-12 12-.8-6.2-5.8-11.2-12-12C6.2 11.2 11.2 6.2 12 0z" fill="currentColor" />
                    </svg>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <h2 className="mt-6 font-display text-2xl font-semibold !text-white">Dharma Rakshati Rakshitah</h2>
          <p className="mt-1 max-w-[16rem] font-serif text-sm leading-relaxed text-white/85">Sign in to receive Swamiji&apos;s blessings through your sevas.</p>
        </aside>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[70vh] items-center justify-center bg-white" />}>
      <LoginInner />
    </Suspense>
  );
}