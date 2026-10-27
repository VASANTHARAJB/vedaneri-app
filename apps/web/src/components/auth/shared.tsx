'use client';

import { useEffect, useId, useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';

export type T = Dictionary['auth'];

export const inputClass = 'w-full rounded-sm border-2 border-rose bg-white px-3 py-1.5 text-charcoal placeholder:text-charcoal/50 focus:border-saffron focus:outline-none';
export const btnPrimary = 'inline-flex w-full items-center justify-center rounded-sm bg-maroon px-6 py-2 font-semibold text-white transition-colors hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron';
export const btnGhost = 'inline-flex w-full items-center justify-center rounded-sm border-2 border-maroon px-6 py-3 font-semibold text-maroon transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron';

export function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-0.5 block text-sm font-bold text-charcoal">{label}{required && <span aria-hidden="true" className="text-maroon"> *</span>}</label>
      {children}
      {error ? <p id={`${id}-e`} role="alert" className="mt-1 text-sm font-semibold text-maroon">{error}</p> : hint ? <p id={`${id}-h`} className="mt-1 text-xs text-charcoal/70">{hint}</p> : null}
    </div>
  );
}

export const describe = (id: string, error?: string, hint?: string) => (error ? `${id}-e` : hint ? `${id}-h` : undefined);

// Password box with a show / hide button
export function PasswordInput({ id, value, onChange, t, autoComplete, invalid, describedBy }: { id: string; value: string; onChange: (v: string) => void; t: T; autoComplete: string; invalid?: boolean; describedBy?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={shown ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-invalid={invalid} aria-describedby={describedBy} className={`${inputClass} pr-12`} />
      <button type="button" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-label={shown ? t.hide : t.show} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded text-charcoal/70 hover:text-maroon focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {shown ? <><path d="M3 3l18 18" /><path d="M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.9M6.6 7.6A17 17 0 0 0 2.5 12S6 18 12 18a9.7 9.7 0 0 0 3.4-.6" /><path d="M9.9 10a3 3 0 0 0 4.1 4.1" /></> : <><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
      </button>
    </div>
  );
}

// Simple local human check (a sum). DEMO: swap for Google reCAPTCHA or Cloudflare Turnstile and verify the token on the server.
export type CaptchaState = { a: number; b: number };
export const newCaptcha = (): CaptchaState => ({ a: 2 + Math.floor(Math.random() * 8), b: 2 + Math.floor(Math.random() * 8) });

export function Captcha({ t, q, value, onChange, onRefresh, error }: { t: T; q: CaptchaState; value: string; onChange: (v: string) => void; onRefresh: () => void; error?: string }) {
  const id = useId();
  return (
    <div className="rounded-sm bg-rose/50 px-3 py-2" role="group" aria-label={t.captchaLabel}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-maroon"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>
        <label htmlFor={id} className="font-display text-xl font-semibold text-maroon">{t.captchaQ.replace('{a}', String(q.a)).replace('{b}', String(q.b))}</label>
        <input id={id} inputMode="numeric" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder={t.captchaAnswer} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} className={`${inputClass} !w-28`} />
        <button type="button" onClick={onRefresh} className="text-sm font-semibold text-maroon underline underline-offset-4 hover:text-charcoal">{t.captchaNew}</button>
      </div>
      {error && <p id={`${id}-e`} role="alert" className="mt-2 text-sm font-semibold text-maroon">{error}</p>}
    </div>
  );
}

export function TermsCheck({ t, locale, checked, onChange, error }: { t: T; locale: string; checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  const id = useId();
  const link = 'font-semibold text-maroon underline underline-offset-4 hover:text-charcoal';
  return (
    <div>
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} className="mt-1 h-5 w-5 shrink-0 accent-maroon" />
        <label htmlFor={id} className="text-sm text-charcoal">
          {t.termsPre} <a href={`/${locale}/terms`} target="_blank" rel="noopener noreferrer" className={link}>{t.termsLink}<span className="sr-only"> ({t.newTab})</span></a> {t.termsAnd} <a href={`/${locale}/privacy`} target="_blank" rel="noopener noreferrer" className={link}>{t.privacyLink}<span className="sr-only"> ({t.newTab})</span></a>
        </label>
      </div>
      {error && <p id={`${id}-e`} role="alert" className="mt-1 text-sm font-semibold text-maroon">{error}</p>}
    </div>
  );
}

// Hidden trap for bots: people never see or fill it. A filled value means the request is dropped.
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>Leave this empty<input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} /></label>
    </div>
  );
}

// Google button. DEMO: shows a note. The real sign-in needs a Google OAuth client and the backend.
export function GoogleButton({ label, t }: { label: string; t: T }) {
  const [note, setNote] = useState(false);
  useEffect(() => {
    if (!note) return;
    const x = setTimeout(() => setNote(false), 6000);
    return () => clearTimeout(x);
  }, [note]);
  return (
    <div>
      <button type="button" onClick={() => setNote(true)} className="inline-flex w-full items-center justify-center gap-3 rounded-sm border-2 border-rose bg-white px-6 py-2 font-semibold text-charcoal transition-colors hover:bg-rose focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" /><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
        {label}
      </button>
      {note && <p role="status" className="mt-2 rounded-sm bg-saffron/15 px-3 py-2 text-sm text-charcoal">{t.googleNote}</p>}
    </div>
  );
}
