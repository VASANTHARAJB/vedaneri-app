'use client';

import { useEffect, useRef, useState } from 'react';
import ChoiceField from '@/components/sevas/ChoiceField';
import { GOTRAMS, NAKSHATRAMS, RASIS } from '@/data/sankalpam';
import { PASSWORD_RULES, findAccount, hashPassword, isAadhaar, isEmail, isPan, isPhone, newSalt, normPhone, passwordScore, resizeImage, saveAccount, startSession, type Account, type RuleKey } from '@/lib/authDemo';
import type { Locale } from '@/lib/i18n';
import { Captcha, Field, GoogleButton, Honeypot, PasswordInput, TermsCheck, btnPrimary, describe, inputClass, newCaptcha, type T } from './shared';

type Form = { first: string; last: string; email: string; phone: string; rasi: string; nakshatram: string; gotram: string; aadhaar: string; pan: string; pw: string; pw2: string };
const EMPTY: Form = { first: '', last: '', email: '', phone: '', rasi: '', nakshatram: '', gotram: '', aadhaar: '', pan: '', pw: '', pw2: '' };
const RULE_LABEL: Record<RuleKey, keyof T> = { len: 'ruleLen', upper: 'ruleUpper', lower: 'ruleLower', digit: 'ruleDigit', special: 'ruleSpecial' };

const fmtAadhaar = (v: string) => v.replace(/\D/g, '').slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ');

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="sr-only">{title}</legend>
      {children}
    </fieldset>
  );
}

export default function RegisterForm({ t, locale, onDone, onSwitch }: { t: T; locale: Locale; onDone: (a: Account) => void; onSwitch: () => void }) {
  const [f, setF] = useState<Form>(EMPTY);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [photoData, setPhotoData] = useState<string | undefined>();
  const [terms, setTerms] = useState(false);
  const [q, setQ] = useState(newCaptcha);
  const [ans, setAns] = useState('');
  const [trap, setTrap] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const stepRef = useRef<HTMLParagraphElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const shownAt = useRef(0);
  useEffect(() => { shownAt.current = Date.now(); }, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const set = (k: keyof Form) => (v: string) => { setF((x) => ({ ...x, [k]: v })); setErrors((x) => ({ ...x, [k]: '' })); };
  const ev = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => set(k)(e.target.value);

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setErrors((x) => ({ ...x, photo: t.errPhotoType })); return; }
    if (file.size > 2 * 1024 * 1024) { setErrors((x) => ({ ...x, photo: t.errPhotoSize })); return; }
    setErrors((x) => ({ ...x, photo: '' }));
    setPhoto({ url: URL.createObjectURL(file), name: file.name });
    resizeImage(file).then(setPhotoData).catch(() => setPhotoData(undefined));
  }

  const score = passwordScore(f.pw);
  const strength = score <= 2 ? 'weak' : score <= 4 ? 'fair' : 'strong';
  const allRules = (Object.keys(PASSWORD_RULES) as RuleKey[]).every((k) => PASSWORD_RULES[k](f.pw));
  const match = f.pw2 !== '' && f.pw === f.pw2;

  function validateStep(n: number) {
    const er: Record<string, string> = {};
    if (n === 1) {
      if (!f.first.trim()) er.first = t.errFirst;
      if (!f.last.trim()) er.last = t.errLast;
      if (!isEmail(f.email)) er.email = t.errEmail;
      if (!isPhone(f.phone)) er.phone = t.errPhone;
    }
    if (n === 2) {
      if (f.aadhaar && !isAadhaar(f.aadhaar)) er.aadhaar = t.errAadhaar;
      if (f.pan && !isPan(f.pan)) er.pan = t.errPan;
    }
    setErrors((x) => ({ ...x, ...er }));
    return Object.keys(er).length === 0;
  }
  const go = (n: number) => { setStep(n); setErrors((x) => ({ ...x, form: '' })); requestAnimationFrame(() => stepRef.current?.focus()); };
  const next = () => { if (validateStep(step)) go(step + 1); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const er: Record<string, string> = {};
    if (!f.first.trim()) er.first = t.errFirst;
    if (!f.last.trim()) er.last = t.errLast;
    if (!isEmail(f.email)) er.email = t.errEmail;
    if (!isPhone(f.phone)) er.phone = t.errPhone;
    if (f.aadhaar && !isAadhaar(f.aadhaar)) er.aadhaar = t.errAadhaar;
    if (f.pan && !isPan(f.pan)) er.pan = t.errPan;
    if (!allRules) er.pw = t.errPwd;
    if (f.pw !== f.pw2) er.pw2 = t.errConfirm;
    if (Number(ans) !== q.a + q.b) er.captcha = t.errCaptcha;
    if (!terms) er.terms = t.errTerms;
    if (trap || Date.now() - shownAt.current < 2500) er.form = t.errBot;
    setErrors(er);
    if (er.captcha) { setQ(newCaptcha()); setAns(''); }
    if (Object.keys(er).length) {
      const s1 = ['first', 'last', 'email', 'phone'].some((k) => er[k]);
      const s2 = ['aadhaar', 'pan'].some((k) => er[k]);
      if (s1) go(1); else if (s2) go(2);
      return;
    }
    if (findAccount(f.email) || findAccount(f.phone)) { setErrors({ form: t.errExists }); return; }

    setBusy(true);
    const salt = newSalt();
    const acc: Account = {
      id: crypto.randomUUID(), first: f.first.trim(), last: f.last.trim(), email: f.email.trim().toLowerCase(), phone: normPhone(f.phone),
      rasi: f.rasi, nakshatram: f.nakshatram, gotram: f.gotram,
      aadhaarLast4: f.aadhaar.replace(/\s/g, '').slice(-4), panMasked: f.pan ? `${f.pan.toUpperCase().slice(0, 2)}XXXXXX${f.pan.slice(-2).toUpperCase()}` : '',
      hasPhoto: !!photo, photo: photoData, salt, hash: await hashPassword(f.pw, salt), createdAt: new Date().toISOString(),
    };
    saveAccount(acc);
    startSession(acc, true);
    setBusy(false);
    onDone(acc);
  }

  const choice = { locale, placeholder: t.select, otherLabel: t.other, typeLabel: t.typeHere } as const;
  const initials = `${f.first[0] ?? ''}${f.last[0] ?? ''}`.toUpperCase();

  return (
    <form noValidate onSubmit={(e) => { if (step < 3) { e.preventDefault(); next(); } else submit(e); }} className="relative mt-5 space-y-5">
      <Honeypot value={trap} onChange={setTrap} />
      {errors.form && <p role="alert" className="rounded-sm bg-maroon/10 px-4 py-3 text-sm font-semibold text-maroon">{errors.form}</p>}

      <ol aria-label={t.tabs} className="flex items-center gap-2">
        {[t.stepAccount, t.stepDetails, t.stepSecurity].map((label, i) => {
          const n = i + 1;
          return (
            <li key={label} aria-current={step === n ? 'step' : undefined} className="flex flex-1 items-center gap-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step > n ? 'bg-saffron text-charcoal' : step === n ? 'bg-maroon text-white' : 'bg-rose text-charcoal/60'}`}>{step > n ? '✓' : n}</span>
              <span className={`truncate text-sm font-semibold ${step === n ? 'text-maroon' : 'text-charcoal/60'}`}>{label}</span>
              {n < 3 && <span aria-hidden="true" className={`h-px flex-1 ${step > n ? 'bg-saffron' : 'bg-rose'}`} />}
            </li>
          );
        })}
      </ol>
      <p ref={stepRef} tabIndex={-1} className="sr-only focus:outline-none">{t.stepOf.replace('{n}', String(step)).replace('{total}', '3')}: {[t.stepAccount, t.stepDetails, t.stepSecurity][step - 1]}</p>

      {step === 1 && <><GoogleButton label={t.googleSignup} t={t} />
      <div className="flex items-center gap-3 text-sm text-charcoal/60" aria-hidden="true"><span className="h-px flex-1 bg-rose" />{t.or}<span className="h-px flex-1 bg-rose" /></div></>}

      {step === 1 && <Section title={t.secPersonal}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="r-first" label={t.first} required error={errors.first}>
            <input id="r-first" value={f.first} onChange={ev('first')} autoComplete="given-name" aria-invalid={!!errors.first} aria-describedby={describe('r-first', errors.first)} className={inputClass} />
          </Field>
          <Field id="r-last" label={t.last} required error={errors.last}>
            <input id="r-last" value={f.last} onChange={ev('last')} autoComplete="family-name" aria-invalid={!!errors.last} aria-describedby={describe('r-last', errors.last)} className={inputClass} />
          </Field>
          <Field id="r-email" label={t.email} required error={errors.email}>
            <input id="r-email" type="email" value={f.email} onChange={ev('email')} autoComplete="email" aria-invalid={!!errors.email} aria-describedby={describe('r-email', errors.email)} className={inputClass} />
          </Field>
          <Field id="r-phone" label={t.phone} required error={errors.phone}>
            <input id="r-phone" type="tel" inputMode="tel" value={f.phone} onChange={ev('phone')} autoComplete="tel" aria-invalid={!!errors.phone} aria-describedby={describe('r-phone', errors.phone)} className={inputClass} />
          </Field>
        </div>

      </Section>}

      {step === 2 && <><div>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose ring-4 ring-white shadow">
            {photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo.url} alt={t.photo} className="h-full w-full object-cover" /> : <span aria-hidden="true" className="font-display text-2xl font-semibold text-maroon">{initials || '🙏'}</span>}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-charcoal" id="photo-label">{t.photo}</p>
            <div className="mt-1 flex flex-wrap gap-3">
              <button type="button" onClick={() => fileRef.current?.click()} aria-describedby="photo-label" className="rounded-sm border-2 border-maroon px-4 py-1.5 text-sm font-semibold text-maroon hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron">{photo ? t.photoChange : t.photoChoose}</button>
              {photo && <button type="button" onClick={() => { setPhoto(null); setPhotoData(undefined); }} className="text-sm font-semibold text-maroon underline underline-offset-4">{t.photoRemove}</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" onChange={pickPhoto} className="sr-only" tabIndex={-1} aria-label={t.photo} />
            {errors.photo ? <p role="alert" className="mt-1 text-sm font-semibold text-maroon">{errors.photo}</p> : <p className="mt-1 text-xs text-charcoal/70">{t.photoHelp}</p>}
          </div>
        </div>
      </div>

      <Section title={t.secSpiritual}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField id="r-rasi" label={t.rasi} value={f.rasi} onChange={set('rasi')} options={RASIS} {...choice} />
          <ChoiceField id="r-nak" label={t.nakshatram} value={f.nakshatram} onChange={set('nakshatram')} options={NAKSHATRAMS} {...choice} />
          <div className="sm:col-span-2"><ChoiceField id="r-gotram" label={t.gotram} value={f.gotram} onChange={set('gotram')} options={GOTRAMS} {...choice} /></div>
        </div>
      </Section>

      <Section title={t.secId}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="r-aadhaar" label={t.aadhaar} error={errors.aadhaar} hint={t.aadhaarHelp}>
            <input id="r-aadhaar" inputMode="numeric" autoComplete="off" placeholder="0000 0000 0000" value={f.aadhaar} onChange={(e) => set('aadhaar')(fmtAadhaar(e.target.value))} aria-invalid={!!errors.aadhaar} aria-describedby={describe('r-aadhaar', errors.aadhaar, t.aadhaarHelp)} className={`${inputClass} tracking-widest`} />
          </Field>
          <Field id="r-pan" label={t.pan} error={errors.pan} hint={t.panHelp}>
            <input id="r-pan" autoComplete="off" maxLength={10} placeholder="ABCPE1234F" value={f.pan} onChange={(e) => set('pan')(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-invalid={!!errors.pan} aria-describedby={describe('r-pan', errors.pan, t.panHelp)} className={`${inputClass} uppercase tracking-widest`} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-charcoal/70">{t.idNote}</p>
      </Section></>}

      {step === 3 && <section aria-label={t.secPassword}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="r-pw" label={t.password} required error={errors.pw}>
            <PasswordInput id="r-pw" value={f.pw} onChange={set('pw')} t={t} autoComplete="new-password" invalid={!!errors.pw} describedBy="pw-rules" />
          </Field>
          <Field id="r-pw2" label={t.confirm} required error={errors.pw2}>
            <PasswordInput id="r-pw2" value={f.pw2} onChange={set('pw2')} t={t} autoComplete="new-password" invalid={!!errors.pw2} describedBy={describe('r-pw2', errors.pw2)} />
          </Field>
        </div>

        <div id="pw-rules" className="mt-3 rounded-sm bg-rose/50 p-3">
          <p className="text-sm font-bold text-charcoal">{t.rulesTitle}</p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {(Object.keys(PASSWORD_RULES) as RuleKey[]).map((k) => {
              const ok = PASSWORD_RULES[k](f.pw);
              return <li key={k} className={ok ? 'font-semibold text-green-800' : 'text-charcoal/80'}><span aria-hidden="true">{ok ? '✓' : '○'}</span> {t[RULE_LABEL[k]] as string}<span className="sr-only">{ok ? ' ✓' : ''}</span></li>;
            })}
            <li className={match ? 'font-semibold text-green-800' : 'text-charcoal/80'}><span aria-hidden="true">{match ? '✓' : '○'}</span> {t.ruleMatch}</li>
          </ul>
          {f.pw && (
            <div className="mt-3 flex items-center gap-3" aria-live="polite">
              <span className="text-sm font-bold text-charcoal">{t.strength}:</span>
              <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-white" aria-hidden="true">
                <span className={`h-full transition-all ${strength === 'weak' ? 'w-1/3 bg-maroon' : strength === 'fair' ? 'w-2/3 bg-saffron' : 'w-full bg-green-700'}`} />
              </span>
              <span className="text-sm font-semibold text-charcoal">{t[strength]}</span>
            </div>
          )}
        </div>
      </section>}

      {step === 3 && <div className="space-y-4">
        <Captcha t={t} q={q} value={ans} onChange={(v) => { setAns(v); setErrors((x) => ({ ...x, captcha: '' })); }} onRefresh={() => { setQ(newCaptcha()); setAns(''); }} error={errors.captcha} />
        <TermsCheck t={t} locale={locale} checked={terms} onChange={(v) => { setTerms(v); setErrors((x) => ({ ...x, terms: '' })); }} error={errors.terms} />
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? t.working : t.createBtn}</button>
      </div>}

      {step < 3 && <button type="submit" className={btnPrimary}>{step === 2 && !f.aadhaar && !f.pan && !f.rasi && !f.nakshatram && !f.gotram ? t.skip : t.next} →</button>}
      {step > 1 && <button type="button" onClick={() => go(step - 1)} className="block w-full text-center text-sm font-semibold text-maroon underline underline-offset-4 hover:text-charcoal">← {t.back}</button>}

    </form>
  );
}
