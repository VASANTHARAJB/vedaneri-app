'use client';

// Contact form: sends the message to the API, which saves it and emails a copy to the sender.
// Protection: hidden trap field, a signed time token, a consent box, a limit on the server,
// and (when the keys are set) Cloudflare Turnstile.

import { useCallback, useEffect, useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const TS_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const TS_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

declare global {
  interface Window { turnstile?: any }
}

export type FormText = {
  title: string; intro: string; name: string; phone: string; country: string; email: string; topic: string; topics: string[]; message: string; messageHint: string;
  optional: string; send: string; errName: string; errContact: string; errTopic: string; errMessage: string;
  thanksTitle: string; thanksText: string; another: string; privacy: string;
  consent: string; errConsent: string; sending: string; errServer: string; errWait: string; errMany: string; errBot: string; thanksCopy: string; thanksNoCopy: string;
};

// ---- What each field accepts. The same rules run again on the server. ----
// Country codes (ISO code, dial code). India first.
export const DIALS: [string, string][] = [
  ['IN', '91'], ['LK', '94'], ['SG', '65'], ['MY', '60'], ['AE', '971'], ['SA', '966'], ['QA', '974'], ['KW', '965'], ['OM', '968'], ['BH', '973'],
  ['US', '1'], ['CA', '1'], ['GB', '44'], ['AU', '61'], ['NZ', '64'], ['DE', '49'], ['FR', '33'], ['CH', '41'], ['ZA', '27'], ['JP', '81'], ['HK', '852'],
  ['MU', '230'], ['NP', '977'], ['BD', '880'], ['PK', '92'],
];
// Name: letters of any language (Tamil included), spaces, dot, apostrophe, hyphen
const cleanName = (v: string) => v.replace(/[^\p{L}\p{M}\s.'’-]/gu, '').replace(/\s+/g, ' ').replace(/^\s/, '');
// Email: only the characters an address can use
const cleanEmail = (v: string) => v.replace(/[^A-Za-z0-9._%+\-@]/g, '');
// Phone: digits only
const cleanPhone = (v: string) => v.replace(/\D/g, '').slice(0, 14);
// Message: letters, numbers and plain punctuation. Brackets like < > { } [ ], \ | ^ ~ ` $ * and emoji are removed.
const cleanMsg = (v: string) => v.replace(/\r\n?|[\u2028\u2029]/g, '\n').replace(/[^\p{L}\p{M}\p{N}\s.,;:!?'"‘’“”()\-–—/&@#%+=_₹]/gu, '').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n');
const phoneValid = (dial: string, n: string) => (dial === '91' ? /^[6-9]\d{9}$/.test(n) : /^\d{6,14}$/.test(n) && dial.length + n.length <= 15);

const input = 'w-full rounded-md border border-charcoal/30 bg-white px-3.5 py-2.5 text-base text-charcoal placeholder:text-charcoal/40 focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/40';
const MAX = 800;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold text-charcoal">{label}</label>
      {children}
      {error ? <p role="alert" className="mt-1 text-sm font-semibold text-maroon">{error}</p> : hint ? <p className="mt-1 text-xs text-charcoal/65">{hint}</p> : null}
    </div>
  );
}

const EMPTY = { name: '', dial: '91', phone: '', email: '', topic: '', message: '', trap: '', consent: false };

export default function ContactForm({ t, locale }: { t: FormText; locale: string }) {
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<null | { email: string; copied: boolean }>(null);
  const [sending, setSending] = useState(false);
  const [token, setToken] = useState('');
  const [tsTok, setTsTok] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const tsId = useRef<any>(null);
  const set = (k: keyof typeof EMPTY, v: string | boolean) => { setF((x) => ({ ...x, [k]: v })); setErr((x) => ({ ...x, [k]: '', form: '' })); };

  // A signed time token from the server, asked for when the form opens
  const getToken = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/contact/token`, { cache: 'no-store' });
      const d = await r.json();
      setToken(d?.token || '');
    } catch { setToken(''); }
  }, []);
  useEffect(() => { getToken(); }, [getToken]);

  // Cloudflare Turnstile, only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set
  useEffect(() => {
    if (!TS_KEY || sent) return;
    let gone = false;
    const mount = () => {
      if (gone || !boxRef.current || !window.turnstile || tsId.current !== null) return;
      tsId.current = window.turnstile.render(boxRef.current, {
        sitekey: TS_KEY,
        language: locale === 'ta' ? 'ta' : 'en',
        callback: (tok: string) => { setTsTok(tok); setErr((x) => ({ ...x, bot: '' })); },
        'expired-callback': () => setTsTok(''),
        'error-callback': () => setTsTok(''),
      });
    };
    if (window.turnstile) mount();
    else {
      let s = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
      if (!s) { s = document.createElement('script'); s.src = TS_SRC; s.async = true; s.defer = true; s.dataset.turnstile = '1'; document.head.appendChild(s); }
      s.addEventListener('load', mount);
    }
    return () => {
      gone = true;
      if (tsId.current !== null && window.turnstile) { try { window.turnstile.remove(tsId.current); } catch { /* already gone */ } }
      tsId.current = null;
    };
  }, [sent, locale]);

  const resetTs = () => {
    setTsTok('');
    if (tsId.current !== null && window.turnstile) { try { window.turnstile.reset(tsId.current); } catch { /* ignore */ } }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending || f.trap) return; // a bot filled the hidden field
    const x: Record<string, string> = {};
    let phone = f.phone.replace(/^0+/, '');
    if (f.dial === '91' && phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
    const emailOk = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(f.email);
    const phoneOk = phoneValid(f.dial, phone);
    if (f.name.trim().length < 2) x.name = t.errName;
    if ((!phoneOk && !emailOk) || (f.phone && !phoneOk) || (f.email && !emailOk)) x.email = t.errContact;
    if (!f.topic) x.topic = t.errTopic;
    if (f.message.trim().length < 10) x.message = t.errMessage;
    if (!f.consent) x.consent = t.errConsent;
    if (TS_KEY && !tsTok) x.bot = t.errBot;
    setErr(x);
    if (Object.keys(x).length) return;

    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name.trim(), dial: f.dial, phone: phoneOk ? phone : '', email: emailOk ? f.email : '', topic: f.topic, message: f.message.trim(),
          consent: true, website: f.trap, token, turnstile: tsTok, locale,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setSent({ email: emailOk ? f.email : '', copied: !!d.ack }); return; }
      const code = d?.code;
      if (code === 'TOO_FAST') setErr({ form: t.errWait });
      else if (code === 'TOKEN') { setErr({ form: t.errWait }); getToken(); }
      else if (code === 'RATE') setErr({ form: t.errMany });
      else if (code === 'BOT') setErr({ bot: t.errBot });
      else if (code === 'name') setErr({ name: t.errName });
      else if (code === 'contact') setErr({ email: t.errContact });
      else if (code === 'topic') setErr({ topic: t.errTopic });
      else if (code === 'message') setErr({ message: t.errMessage });
      else if (code === 'consent') setErr({ consent: t.errConsent });
      else if (code === 'SPAM') setErr({ form: d?.message || t.errServer });
      else setErr({ form: t.errServer });
      if (TS_KEY) resetTs();
    } catch {
      setErr({ form: t.errServer });
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="py-8 text-center">
        <p aria-hidden="true" className="text-5xl">🙏</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-maroon">{t.thanksTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-charcoal/80">{t.thanksText}</p>
        {sent.email && (
          <p className="mx-auto mt-3 max-w-md text-sm font-semibold text-charcoal/80">
            {sent.copied ? t.thanksCopy.replace('{email}', sent.email) : t.thanksNoCopy}
          </p>
        )}
        <button type="button" onClick={() => { setF(EMPTY); setErr({}); setSent(null); getToken(); }}
          className="mt-6 inline-flex items-center justify-center rounded-md border-2 border-maroon px-5 py-2.5 font-bold text-maroon transition hover:bg-maroon hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2">{t.another}</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <h2 className="font-display text-3xl font-semibold text-maroon [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-2xl">{t.title}</h2>
        <p className="mt-1 text-sm text-charcoal/75">{t.intro}</p>
      </div>

      {/* Hidden trap field for bots. Real visitors never see or fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Leave this empty<input name="hp_leave_empty" tabIndex={-1} autoComplete="off" value={f.trap} onChange={(e) => set('trap', e.target.value)} /></label>
      </div>

      {err.form && <p role="alert" className="rounded-md border border-maroon/30 bg-rose px-4 py-3 text-sm font-semibold text-maroon">{err.form}</p>}

      <Field id="c-name" label={t.name} error={err.name}>
        <input id="c-name" autoComplete="name" maxLength={80} value={f.name} onChange={(e) => set('name', cleanName(e.target.value))} aria-invalid={!!err.name} className={input} />
      </Field>
      <p className="-mb-2 text-xs text-charcoal/65">{t.optional}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="c-phone" label={t.phone}>
          <div className="flex gap-2">
            <select aria-label={t.country} value={f.dial} onChange={(e) => set('dial', e.target.value)} className={`${input} !w-[7.5rem] shrink-0`}>
              {DIALS.map(([iso, d]) => <option key={iso} value={d}>{iso} +{d}</option>)}
            </select>
            <input id="c-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} value={f.phone} onChange={(e) => set('phone', cleanPhone(e.target.value))} className={input} />
          </div>
        </Field>
        <Field id="c-email" label={t.email} error={err.email}>
          <input id="c-email" type="email" autoComplete="email" maxLength={120} spellCheck={false} autoCapitalize="none" value={f.email} onChange={(e) => set('email', cleanEmail(e.target.value))} aria-invalid={!!err.email} className={input} />
        </Field>
      </div>
      <Field id="c-topic" label={t.topic} error={err.topic}>
        <select id="c-topic" value={f.topic} onChange={(e) => set('topic', e.target.value)} aria-invalid={!!err.topic} className={input}>
          <option value="">—</option>
          {t.topics.map((x) => <option key={x}>{x}</option>)}
        </select>
      </Field>
      <Field id="c-message" label={t.message} error={err.message} hint={`${f.message.length}/${MAX} · ${t.messageHint}`}>
        <textarea id="c-message" rows={5} maxLength={MAX} value={f.message} onChange={(e) => set('message', cleanMsg(e.target.value))} aria-invalid={!!err.message} className={`${input} resize-y`} />
      </Field>

      {/* Consent */}
      <div>
        <label htmlFor="c-consent" className="flex cursor-pointer items-start gap-3 text-sm text-charcoal/85">
          <input id="c-consent" type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} aria-invalid={!!err.consent} className="mt-0.5 h-5 w-5 shrink-0 rounded border-charcoal/40 accent-maroon focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron" />
          <span>{t.consent}</span>
        </label>
        {err.consent && <p role="alert" className="mt-1 text-sm font-semibold text-maroon">{err.consent}</p>}
      </div>

      {/* Security check (Cloudflare Turnstile), shown only when its keys are set */}
      {TS_KEY && (
        <div>
          <div ref={boxRef} />
          {err.bot && <p role="alert" className="mt-1 text-sm font-semibold text-maroon">{err.bot}</p>}
        </div>
      )}

      <button type="submit" disabled={sending} className="inline-flex w-full items-center justify-center rounded-md bg-maroon px-5 py-3 text-base font-bold text-white shadow-md transition hover:bg-maroon/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[12rem]">{sending ? t.sending : t.send}</button>
      <p className="text-xs text-charcoal/65">{t.privacy}</p>
    </form>
  );
}