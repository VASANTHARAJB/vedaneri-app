'use client';

import { useEffect, useRef, useState } from 'react';
import { findAccount, hashPassword, isEmail, isPhone, startSession, type Account } from '@/lib/authDemo';
import { Captcha, Field, GoogleButton, Honeypot, PasswordInput, TermsCheck, btnPrimary, describe, inputClass, newCaptcha, type T } from './shared';

const MAX_TRIES = 5;     // wrong passwords allowed before a short lock. The real limit must be enforced by the server.
const LOCK_SECONDS = 30;

// Two steps, like a SaaS sign-in: 1) who are you (email or mobile)  2) password, security check and terms
export default function LoginForm({ t, locale, onDone }: { t: T; locale: string; onDone: (a: Account) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [user, setUser] = useState('');
  const [pw, setPw] = useState('');
  const [remember, setRemember] = useState(false);
  const [terms, setTerms] = useState(false);
  const [q, setQ] = useState(newCaptcha);
  const [ans, setAns] = useState('');
  const [trap, setTrap] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [tries, setTries] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [forgot, setForgot] = useState(false);
  const shownAt = useRef(0);
  const userRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  useEffect(() => { shownAt.current = Date.now(); }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const x = setInterval(() => { setNow(Date.now()); if (Date.now() >= lockedUntil) { setLockedUntil(0); setTries(0); setErrors((e) => ({ ...e, form: '' })); } }, 500);
    return () => clearInterval(x);
  }, [lockedUntil]);

  const secsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const locked = secsLeft > 0;

  function next() {
    if (!(isEmail(user) || isPhone(user))) { setErrors({ user: t.errUser }); return; }
    setErrors({});
    setStep(2);
    requestAnimationFrame(() => document.getElementById('l-pw')?.focus());
  }
  function change() {
    setStep(1); setPw(''); setErrors({});
    requestAnimationFrame(() => userRef.current?.focus());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) { next(); return; }
    if (locked || busy) return;
    const er: Record<string, string> = {};
    if (!pw) er.pw = t.errPassword;
    if (Number(ans) !== q.a + q.b) er.captcha = t.errCaptcha;
    if (!terms) er.terms = t.errTerms;
    if (trap || Date.now() - shownAt.current < 1500) er.form = t.errBot;
    setErrors(er);
    if (er.captcha) { setQ(newCaptcha()); setAns(''); }
    if (Object.keys(er).length) return;

    setBusy(true);
    const acc = findAccount(user);
    const ok = acc ? (await hashPassword(pw, acc.salt)) === acc.hash : false;
    setBusy(false);
    if (!acc || !ok) {
      const n = tries + 1;
      setTries(n);
      setQ(newCaptcha()); setAns('');
      if (n >= MAX_TRIES) { setNow(Date.now()); setLockedUntil(Date.now() + LOCK_SECONDS * 1000); setErrors({ form: t.errLocked.replace('{s}', String(LOCK_SECONDS)) }); }
      else setErrors({ form: t.errCreds });
      return;
    }
    startSession(acc, remember);
    onDone(acc);
  }

  const formError = locked ? t.errLocked.replace('{s}', String(secsLeft)) : errors.form;

  return (
    <form noValidate onSubmit={submit} className="relative space-y-3">
      <Honeypot value={trap} onChange={setTrap} />
      {formError && <p role="alert" className="rounded-sm bg-maroon/10 px-4 py-2.5 text-sm font-semibold text-maroon">{formError}</p>}

      {step === 1 ? (
        <>
          <Field id="l-user" label={t.user} required error={errors.user}>
            <input ref={userRef} id="l-user" value={user} onChange={(e) => { setUser(e.target.value); setErrors((x) => ({ ...x, user: '' })); }} autoComplete="username" autoFocus aria-invalid={!!errors.user} aria-describedby={describe('l-user', errors.user)} className={inputClass} />
          </Field>
          <button type="submit" className={btnPrimary}>{t.loginNext} →</button>
          <div className="flex items-center gap-3 text-sm text-charcoal/60" aria-hidden="true"><span className="h-px flex-1 bg-rose" />{t.or}<span className="h-px flex-1 bg-rose" /></div>
          <GoogleButton label={t.googleLogin} t={t} />
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-sm border border-rose bg-rose/30 px-3 py-2">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-maroon text-sm font-bold uppercase text-white">{user.trim()[0]}</span>
            <span className="min-w-0 flex-1"><span className="block text-xs text-charcoal/70">{t.signInAs}</span><span className="block truncate font-semibold text-charcoal">{user.trim()}</span></span>
            <button type="button" onClick={change} className="text-sm font-semibold text-maroon underline underline-offset-4 hover:text-charcoal">{t.changeUser}</button>
          </div>

          <Field id="l-pw" label={t.password} required error={errors.pw}>
            <PasswordInput id="l-pw" value={pw} onChange={(v) => { setPw(v); setErrors((x) => ({ ...x, pw: '' })); }} t={t} autoComplete="current-password" invalid={!!errors.pw} describedBy={describe('l-pw', errors.pw)} />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-maroon" />
              {t.remember}
            </label>
            <button type="button" onClick={() => setForgot((f) => !f)} aria-expanded={forgot} className="text-sm font-semibold text-maroon underline underline-offset-4 hover:text-charcoal">{t.forgot}</button>
          </div>
          {forgot && <p role="status" className="rounded-sm bg-saffron/15 px-3 py-2 text-sm text-charcoal">{t.forgotNote}</p>}

          <Captcha t={t} q={q} value={ans} onChange={(v) => { setAns(v); setErrors((x) => ({ ...x, captcha: '' })); }} onRefresh={() => { setQ(newCaptcha()); setAns(''); }} error={errors.captcha} />
          <TermsCheck t={t} locale={locale} checked={terms} onChange={(v) => { setTerms(v); setErrors((x) => ({ ...x, terms: '' })); }} error={errors.terms} />
          <button type="submit" disabled={busy || locked} className={btnPrimary}>{busy ? t.working : t.signInBtn}</button>
        </>
      )}
    </form>
  );
}
