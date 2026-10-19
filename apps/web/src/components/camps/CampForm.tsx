'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { rupees } from '@/lib/format';
import { txt } from '@/data/sevas';
import { CAMP_GOOGLE_FORM, DRESS_CODE, type Camp } from '@/data/camps';

type T = Dictionary['camps'];
type Form = { name: string; age: string; gender: string; phone: string; email: string; study: string; emergency: string; accom: string; agree: boolean };
const EMPTY: Form = { name: '', age: '', gender: '', phone: '', email: '', study: '', emergency: '', accom: 'yes', agree: false };

const STORE = 'vedaneri.campreg.v1'; // DEMO: registrations stay in this browser until the backend exists
const inputClass = 'w-full rounded-md border-2 border-rose bg-white px-3 py-2.5 text-charcoal placeholder:text-charcoal/50 focus:border-saffron focus:outline-none';
const label = 'block text-sm font-bold text-charcoal';

function saveRegistration(camp: Camp, f: Form, ref: string) {
  try {
    const list = JSON.parse(window.localStorage.getItem(STORE) ?? '[]') as unknown[];
    list.push({ ref, camp: camp.slug, at: new Date().toISOString(), ...f });
    window.localStorage.setItem(STORE, JSON.stringify(list));
  } catch {
    /* ignore: storage can be blocked */
  }
}

// Registration panel for the picked camp: indicative schedule, the form, the dress code, and a demo confirmation.
export default function CampForm({ camp, locale, t, onChange }: { camp: Camp | null; locale: Locale; t: T; onChange: () => void }) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ ref: string; camp: string } | null>(null);

  // A different camp was picked: forget errors and any old confirmation (keep what was typed)
  useEffect(() => {
    setErrors({});
    if (camp) setDone(null);
  }, [camp]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [camp, done]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: '' }));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!camp) return;
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = t.errName;
    const age = Number(f.age);
    if (!Number.isInteger(age) || age < 1 || age > 120) er.age = t.errAge;
    if (!f.gender) er.gender = t.errGender;
    if (!/^\+?[\d\s-]{7,15}$/.test(f.phone.trim())) er.phone = t.errPhone;
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) er.email = t.errEmail;
    if (f.emergency.trim().length < 5) er.emergency = t.errEmergency;
    if (!f.agree) er.agree = t.errAgree;
    setErrors(er);
    if (Object.keys(er).length) return;

    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const ref = `CR-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
    saveRegistration(camp, f, ref);
    setDone({ ref, camp: txt(camp.name, locale) });
    setF((x) => ({ ...EMPTY, accom: x.accom }));
    onChange(); // on the list page this clears the picked camp
  }

  const err = (k: string) => (errors[k] ? <p id={`c-${k}-error`} role="alert" className="mt-1 text-sm font-semibold text-maroon">{errors[k]}</p> : null);
  const aria = (k: string) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `c-${k}-error` : undefined });

  return (
    <section aria-labelledby={headingId} className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-rose">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron [html[lang='ta']_&]:tracking-normal">{t.panelEyebrow}</p>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="mt-1 break-words font-display text-3xl font-semibold leading-tight text-maroon focus:outline-none [html[lang='ta']_&]:!leading-[1.35] [html[lang='ta']_&]:text-xl">
        {camp ? t.formTitle : t.panelTitle}
      </h2>
      <p className="mt-1 text-sm font-semibold text-charcoal/70">{t.demoNote}</p>

      {done && (
        <div role="status" className="mt-5 rounded-xl bg-saffron/15 p-5 text-center">
          <p className="font-display text-2xl font-semibold text-maroon">✓ {t.doneTitle}</p>
          <p className="mt-1 font-semibold text-charcoal">{done.camp}</p>
          <p className="mt-2 text-sm text-charcoal/85">{t.doneText}</p>
          <p className="mt-3 text-sm font-bold text-charcoal">{t.refLabel}: <span className="tabular-nums">{done.ref}</span></p>
          <p className="mt-4 text-sm"><a href={CAMP_GOOGLE_FORM} target="_blank" rel="noopener noreferrer" className="font-bold text-maroon underline underline-offset-4">{t.googleCta}<span className="sr-only"> ({t.newTab})</span></a></p>
        </div>
      )}

      {!done && !camp && <p className="mt-5 rounded-xl bg-rose/50 p-5 text-center font-serif text-charcoal/85">{t.panelEmpty}</p>}

      {!done && camp && (
        <form noValidate onSubmit={submit} className="mt-5">
          <div className="flex items-start justify-between gap-3 rounded-lg bg-rose/50 p-3">
            <div className="min-w-0">
              <p className="font-semibold leading-snug text-charcoal">{txt(camp.name, locale)}</p>
              <p className="text-sm text-charcoal/75">{txt(camp.when, locale)} · {rupees(camp.fee)} {t.perPerson}</p>
            </div>
            <button type="button" onClick={onChange} className="shrink-0 text-sm font-semibold text-maroon underline underline-offset-4 hover:text-charcoal">{t.change}</button>
          </div>

          {camp.schedule.length > 0 && (
            <div className="mt-5 border-t-2 border-rose pt-4">
              <h3 className="font-display text-lg font-semibold text-charcoal">{t.scheduleTitle.replace('{camp}', txt(camp.name, locale))}</h3>
              <dl className="mt-2 space-y-1.5 text-sm">
                {camp.schedule.map((s) => (
                  <div key={s.time} className="flex gap-3"><dt className="w-40 shrink-0 font-bold tabular-nums text-saffron">{s.time}</dt><dd className="text-charcoal/85">{txt(s.text, locale)}</dd></div>
                ))}
              </dl>
            </div>
          )}

          <div className="mt-5 space-y-4 border-t-2 border-rose pt-4">
            <div>
              <label htmlFor="c-name" className={label}>{t.fName} <span aria-hidden="true" className="text-maroon">*</span></label>
              <input id="c-name" value={f.name} onChange={set('name')} placeholder={t.fNamePh} autoComplete="name" {...aria('name')} className={`mt-1 ${inputClass}`} />
              {err('name')}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="c-age" className={label}>{t.fAge} <span aria-hidden="true" className="text-maroon">*</span></label>
                <input id="c-age" type="number" inputMode="numeric" min={1} max={120} value={f.age} onChange={set('age')} {...aria('age')} className={`mt-1 ${inputClass}`} />
                {err('age')}
              </div>
              <div>
                <label htmlFor="c-gender" className={label}>{t.fGender} <span aria-hidden="true" className="text-maroon">*</span></label>
                <select id="c-gender" value={f.gender} onChange={set('gender')} {...aria('gender')} className={`mt-1 ${inputClass}`}>
                  <option value="">{t.choose}</option>
                  <option value="male">{t.male}</option>
                  <option value="female">{t.female}</option>
                </select>
                {err('gender')}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="c-phone" className={label}>{t.fPhone} <span aria-hidden="true" className="text-maroon">*</span></label>
                <input id="c-phone" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" {...aria('phone')} className={`mt-1 ${inputClass}`} />
                {err('phone')}
              </div>
              <div>
                <label htmlFor="c-email" className={label}>{t.fEmail} <span className="font-normal text-charcoal/60">({t.optional})</span></label>
                <input id="c-email" type="email" value={f.email} onChange={set('email')} autoComplete="email" {...aria('email')} className={`mt-1 ${inputClass}`} />
                {err('email')}
              </div>
            </div>
            <div>
              <label htmlFor="c-study" className={label}>{t.fStudy} <span className="font-normal text-charcoal/60">({t.optional})</span></label>
              <input id="c-study" value={f.study} onChange={set('study')} placeholder={t.fStudyPh} className={`mt-1 ${inputClass}`} />
            </div>
            <div>
              <label htmlFor="c-emergency" className={label}>{t.fEmergency} <span aria-hidden="true" className="text-maroon">*</span></label>
              <input id="c-emergency" value={f.emergency} onChange={set('emergency')} placeholder={t.fEmergencyPh} {...aria('emergency')} className={`mt-1 ${inputClass}`} />
              {err('emergency')}
            </div>

            <fieldset>
              <legend className={label}>{t.fAccom}</legend>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:gap-6">
                {(['yes', 'no'] as const).map((v) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 text-charcoal">
                    <input type="radio" name="accom" value={v} checked={f.accom === v} onChange={set('accom')} className="h-4 w-4 accent-maroon" />
                    {v === 'yes' ? t.accomYes : t.accomNo}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="rounded-lg border border-maroon/20 bg-rose/40 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-maroon [html[lang='ta']_&]:tracking-normal">{t.rulesTitle}</p>
              <p className="mt-1 text-sm leading-relaxed text-charcoal/85">{txt(DRESS_CODE, locale)}</p>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-charcoal">
                <input type="checkbox" checked={f.agree} onChange={set('agree')} {...aria('agree')} className="mt-0.5 h-4 w-4 shrink-0 accent-maroon" />
                <span>{t.agree}</span>
              </label>
              {err('agree')}
            </div>
          </div>

          <button type="submit" className="mt-5 w-full rounded-md bg-maroon px-5 py-3 text-center font-semibold text-white transition-colors hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">{t.submit}</button>
        </form>
      )}
    </section>
  );
}
