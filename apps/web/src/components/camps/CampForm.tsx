'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { rupees } from '@/lib/format';
import { txt } from '@/data/sevas';
import { CAMP_GOOGLE_FORM, DRESS_CODE, type Camp } from '@/data/camps';

type T = Dictionary['camps'];
type IdType = '' | 'aadhaar' | 'pan' | 'voter' | 'passport';
type Form = {
  name: string; age: string; gender: string; phone: string; email: string; study: string; emergency: string; accom: string; agree: boolean;
  idType: IdType; idNumber: string;
};
const EMPTY: Form = { name: '', age: '', gender: '', phone: '', email: '', study: '', emergency: '', accom: 'yes', agree: false, idType: '', idNumber: '' };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const MAX_FILE = 5 * 1024 * 1024; // 5 MB, same as the server
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOC_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

const inputClass = 'w-full rounded-md border-2 border-rose bg-white px-3 py-2.5 text-charcoal placeholder:text-charcoal/50 focus:border-saffron focus:outline-none';
const label = 'block text-sm font-bold text-charcoal';

// ---- ID number checks (the server checks the same rules again) ----
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

// Image with a preview, or the file name for a PDF
function FilePreview({ file }: { file: File | null }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setUrl('');
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!file) return null;
  return (
    <div className="mt-2 flex items-center gap-3 rounded-md bg-rose/40 p-2">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-white text-xs font-bold text-maroon">PDF</span>
      )}
      <span className="min-w-0 break-words text-sm text-charcoal/85">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>
    </div>
  );
}

// Registration panel for the picked camp: indicative schedule, the form (one student per registration), the dress code, and the saved confirmation.
export default function CampForm({ camp, locale, t, onChange }: { camp: Camp | null; locale: Locale; t: T; onChange: () => void }) {
  const tr = (en: string, ta: string) => (locale === 'ta' ? ta : en);
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const [f, setF] = useState<Form>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0); // changing this empties the file inputs
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ ref: string; camp: string } | null>(null);

  // A different camp was picked: forget errors and any old confirmation (keep what was typed)
  useEffect(() => {
    setErrors({});
    setFormError('');
    if (camp) setDone(null);
  }, [camp]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [camp, done]);

  const clearErr = (k: string) => setErrors((x) => (x[k] ? { ...x, [k]: '' } : x));

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
    clearErr(k);
  };

  // Check a chosen file right away so the student knows before submitting
  function pickFile(kind: 'photo' | 'idDoc', file: File | null) {
    const allowed = kind === 'photo' ? PHOTO_TYPES : DOC_TYPES;
    clearErr(kind);
    if (!file) return kind === 'photo' ? setPhoto(null) : setIdDoc(null);
    let problem = '';
    if (!allowed.includes(file.type))
      problem =
        kind === 'photo'
          ? tr('The photo must be a JPG, PNG or WebP image.', 'புகைப்படம் JPG, PNG அல்லது WebP ஆக இருக்க வேண்டும்.')
          : tr('The ID proof must be a JPG, PNG image or a PDF.', 'அடையாளச் சான்று JPG, PNG படமாகவோ PDF ஆகவோ இருக்க வேண்டும்.');
    else if (file.size > MAX_FILE) problem = tr('The file must be 5 MB or smaller.', 'கோப்பு 5 MB அல்லது அதற்கும் குறைவாக இருக்க வேண்டும்.');
    if (problem) {
      setErrors((x) => ({ ...x, [kind]: problem }));
      return kind === 'photo' ? setPhoto(null) : setIdDoc(null);
    }
    if (kind === 'photo') setPhoto(file);
    else setIdDoc(file);
  }

  const ID_OPTIONS: { value: Exclude<IdType, ''>; en: string; ta: string; ph: string }[] = [
    { value: 'aadhaar', en: 'Aadhaar Card', ta: 'ஆதார் அட்டை', ph: '12-digit Aadhaar number' },
    { value: 'pan', en: 'PAN Card', ta: 'பான் அட்டை', ph: 'ABCDE1234F' },
    { value: 'voter', en: 'Voter ID (EPIC)', ta: 'வாக்காளர் அடையாள அட்டை', ph: 'ABC1234567' },
    { value: 'passport', en: 'Passport', ta: 'கடவுச்சீட்டு', ph: 'A1234567' },
  ];
  const idOpt = ID_OPTIONS.find((o) => o.value === f.idType);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!camp || sending) return;
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = t.errName;
    const age = Number(f.age);
    if (!Number.isInteger(age) || age < 1 || age > 120) er.age = t.errAge;
    if (!f.gender) er.gender = t.errGender;
    if (!/^\+?[\d\s-]{7,15}$/.test(f.phone.trim())) er.phone = t.errPhone;
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) er.email = t.errEmail;
    if (f.emergency.trim().length < 5) er.emergency = t.errEmergency;

    // ID proof, ID document and profile photo are all mandatory for every student
    if (!f.idType) er.idType = tr('Please choose an ID proof.', 'அடையாளச் சான்றைத் தேர்ந்தெடுக்கவும்.');
    if (!f.idNumber.trim()) er.idNumber = tr('Please enter the ID number.', 'அடையாள எண்ணை உள்ளிடவும்.');
    else if (f.idType && !idValid(f.idType, normalizeId(f.idNumber)))
      er.idNumber = tr(`Please enter a valid ${idOpt?.en || 'ID'} number.`, `சரியான ${idOpt?.ta || 'அடையாள'} எண்ணை உள்ளிடவும்.`);
    if (!idDoc && !errors.idDoc) er.idDoc = tr('Please upload the ID proof document.', 'அடையாளச் சான்று ஆவணத்தைப் பதிவேற்றவும்.');
    if (!photo && !errors.photo) er.photo = tr('Please upload the profile photo.', 'புகைப்படத்தைப் பதிவேற்றவும்.');

    if (!f.agree) er.agree = t.errAgree;
    const merged: Record<string, string> = { ...er };
    if (errors.idDoc) merged.idDoc = errors.idDoc;
    if (errors.photo) merged.photo = errors.photo;
    setErrors(merged);
    setFormError('');
    const firstKey = Object.keys(merged).find((k) => merged[k]);
    if (firstKey) {
      setTimeout(() => document.getElementById(`c-${firstKey}`)?.focus(), 0);
      return;
    }

    const body = new FormData();
    body.append('campSlug', camp.slug);
    body.append('campName', txt(camp.name, 'en'));
    body.append('name', f.name.trim());
    body.append('age', f.age);
    body.append('gender', f.gender);
    body.append('phone', f.phone.trim());
    body.append('email', f.email.trim());
    body.append('study', f.study.trim());
    body.append('emergency', f.emergency.trim());
    body.append('accommodation', f.accom);
    body.append('agree', String(f.agree));
    body.append('idType', f.idType);
    body.append('idNumber', normalizeId(f.idNumber));
    body.append('photo', photo as File);
    body.append('idDoc', idDoc as File);

    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/camp-registrations`, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const fieldMap: Record<string, string> = { file: 'photo' };
        const field = data.field ? fieldMap[data.field] || data.field : '';
        if (field && ['name', 'age', 'gender', 'phone', 'email', 'emergency', 'agree', 'idType', 'idNumber', 'photo', 'idDoc'].includes(field)) {
          setErrors((x) => ({ ...x, [field]: data.message }));
          setTimeout(() => document.getElementById(`c-${field}`)?.focus(), 0);
        } else {
          setFormError(data.message || tr('The registration could not be saved. Please try again.', 'பதிவைச் சேமிக்க இயலவில்லை. மீண்டும் முயற்சிக்கவும்.'));
        }
        return;
      }
      setDone({ ref: data.ref, camp: txt(camp.name, locale) });
      setF((x) => ({ ...EMPTY, accom: x.accom }));
      setPhoto(null);
      setIdDoc(null);
      setFileKey((k) => k + 1);
    } catch {
      setFormError(tr('We could not reach the server. Please check your internet connection and try again.', 'சேவையகத்தை அடைய இயலவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.'));
    } finally {
      setSending(false);
    }
  }

  const err = (k: string) => (errors[k] ? <p id={`c-${k}-error`} role="alert" className="mt-1 text-sm font-semibold text-maroon">{errors[k]}</p> : null);
  const aria = (k: string) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `c-${k}-error` : undefined });

  return (
    <section aria-labelledby={headingId} className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-rose">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron [html[lang='ta']_&]:tracking-normal">{t.panelEyebrow}</p>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="mt-1 break-words font-display text-3xl font-semibold leading-tight text-maroon focus:outline-none [html[lang='ta']_&]:!leading-[1.35] [html[lang='ta']_&]:text-xl">
        {camp ? t.formTitle : t.panelTitle}
      </h2>

      {done && (
        <div role="status" className="mt-5 rounded-xl bg-saffron/15 p-5 text-center">
          <p className="font-display text-2xl font-semibold text-maroon">✓ {t.doneTitle}</p>
          <p className="mt-1 font-semibold text-charcoal">{done.camp}</p>
          <p className="mt-2 text-sm text-charcoal/85">{t.doneText}</p>
          <p className="mt-3 text-sm font-bold text-charcoal">{t.refLabel}: <span className="tabular-nums">{done.ref}</span></p>
          <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
            {camp && (
              <button type="button" onClick={() => setDone(null)} className="rounded-md bg-maroon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-charcoal">
                {tr('Register another student', 'மற்றொரு மாணவரைப் பதிவு செய்க')}
              </button>
            )}
            <button type="button" onClick={onChange} className="rounded-md border-2 border-maroon px-4 py-2 text-sm font-semibold text-maroon transition-colors hover:bg-rose/50">
              {tr('Choose another camp', 'வேறு முகாமைத் தேர்ந்தெடுக்க')}
            </button>
          </div>
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

          <p className="mt-5 rounded-lg bg-rose/40 p-3 text-sm font-semibold text-charcoal/85">
            {tr('This form registers one student. To register more students, fill the form again for each one.', 'இந்தப் படிவம் ஒரு மாணவருக்கானது. கூடுதல் மாணவர்களுக்கு ஒவ்வொருவருக்கும் தனியாக நிரப்பவும்.')}
          </p>

          <div className="mt-4 space-y-4 border-t-2 border-rose pt-4">
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

            {/* Identification: required for every student */}
            <div className="space-y-4 rounded-lg border-2 border-rose p-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-maroon [html[lang='ta']_&]:tracking-normal">
                  {tr('Identification (required)', 'அடையாளச் சான்று (அவசியம்)')}
                </p>
                <p className="mt-1 text-sm text-charcoal/75">
                  {tr(
                    'Your ID number is stored encrypted. The documents are seen only by the ashram office and are never shown publicly.',
                    'உங்கள் அடையாள எண் குறியாக்கம் செய்து சேமிக்கப்படும். ஆவணங்களை ஆசிரம அலுவலகம் மட்டுமே பார்க்கும்; பொதுவில் காட்டப்படாது.'
                  )}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="c-idType" className={label}>{tr('ID proof type', 'அடையாளச் சான்று வகை')} <span aria-hidden="true" className="text-maroon">*</span></label>
                  <select id="c-idType" value={f.idType} onChange={set('idType')} {...aria('idType')} className={`mt-1 ${inputClass}`}>
                    <option value="">{t.choose}</option>
                    {ID_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{tr(o.en, o.ta)}</option>
                    ))}
                  </select>
                  {err('idType')}
                </div>
                <div>
                  <label htmlFor="c-idNumber" className={label}>{tr('ID number', 'அடையாள எண்')} <span aria-hidden="true" className="text-maroon">*</span></label>
                  <input
                    id="c-idNumber"
                    value={f.idNumber}
                    onChange={set('idNumber')}
                    placeholder={idOpt?.ph || ''}
                    autoComplete="off"
                    disabled={!f.idType}
                    {...aria('idNumber')}
                    className={`mt-1 ${inputClass} disabled:cursor-not-allowed disabled:bg-rose/30`}
                  />
                  {err('idNumber')}
                </div>
              </div>

              <div>
                <label htmlFor="c-idDoc" className={label}>
                  {tr('Upload ID proof document', 'அடையாளச் சான்று ஆவணத்தைப் பதிவேற்றவும்')} <span aria-hidden="true" className="text-maroon">*</span>
                </label>
                <input
                  key={`doc-${fileKey}`}
                  id="c-idDoc"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => pickFile('idDoc', e.target.files?.[0] || null)}
                  {...aria('idDoc')}
                  className="mt-1 block w-full text-sm text-charcoal file:mr-3 file:rounded-md file:border-0 file:bg-maroon file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-charcoal"
                />
                <p className="mt-1 text-xs text-charcoal/65">{tr('JPG, PNG or PDF, up to 5 MB. Front side with the number clearly visible.', 'JPG, PNG அல்லது PDF, 5 MB வரை. எண் தெளிவாகத் தெரியும் முன்பக்கம்.')}</p>
                {err('idDoc')}
                <FilePreview file={idDoc} />
              </div>

              <div>
                <label htmlFor="c-photo" className={label}>
                  {tr('Upload profile photo', 'புகைப்படத்தைப் பதிவேற்றவும்')} <span aria-hidden="true" className="text-maroon">*</span>
                </label>
                <input
                  key={`photo-${fileKey}`}
                  id="c-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => pickFile('photo', e.target.files?.[0] || null)}
                  {...aria('photo')}
                  className="mt-1 block w-full text-sm text-charcoal file:mr-3 file:rounded-md file:border-0 file:bg-maroon file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-charcoal"
                />
                <p className="mt-1 text-xs text-charcoal/65">{tr('A clear recent photo of the student (face visible). JPG, PNG or WebP, up to 5 MB.', 'மாணவரின் சமீபத்திய தெளிவான புகைப்படம் (முகம் தெரிய வேண்டும்). JPG, PNG அல்லது WebP, 5 MB வரை.')}</p>
                {err('photo')}
                <FilePreview file={photo} />
              </div>
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
                <input id="c-agree" type="checkbox" checked={f.agree} onChange={set('agree')} {...aria('agree')} className="mt-0.5 h-4 w-4 shrink-0 accent-maroon" />
                <span>{t.agree}</span>
              </label>
              {err('agree')}
            </div>
          </div>

          {formError && (
            <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{formError}</p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="mt-5 w-full rounded-md bg-maroon px-5 py-3 text-center font-semibold text-white transition-colors hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? tr('Uploading and saving...', 'பதிவேற்றி சேமிக்கப்படுகிறது...') : t.submit}
          </button>
        </form>
      )}
    </section>
  );
}