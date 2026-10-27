'use client';

import { useEffect, useRef, useState } from 'react';
import ChoiceField from '@/components/sevas/ChoiceField';
import { GOTRAMS, NAKSHATRAMS, RASIS } from '@/data/sankalpam';
import { accounts, isAadhaar, isEmail, isPan, isPhone, normPhone, resizeImage, updateAccount, type Account } from '@/lib/authDemo';
import type { Locale } from '@/lib/i18n';
import { card, Heading, input, primary, ghost, type A, type T } from './ui';

const fmt = (v: string) => v.replace(/\D/g, '').slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ');

export default function Details({ t, a, locale, acc, onSaved }: { t: T; a: A; locale: Locale; acc: Account; onSaved: () => void }) {
  const [f, setF] = useState({ first: acc.first, last: acc.last, email: acc.email, phone: acc.phone, rasi: acc.rasi, nakshatram: acc.nakshatram, gotram: acc.gotram, aadhaar: '', pan: '' });
  const [photo, setPhoto] = useState<string | undefined>(acc.photo);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (saved) { const x = setTimeout(() => setSaved(false), 4000); return () => clearTimeout(x); } }, [saved]);

  const set = (k: keyof typeof f) => (v: string) => { setF((x) => ({ ...x, [k]: v })); setErrors((x) => ({ ...x, [k]: '' })); setSaved(false); };
  const ev = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => set(k)(e.target.value);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setErrors((x) => ({ ...x, photo: a.errPhotoType })); return; }
    if (file.size > 2 * 1024 * 1024) { setErrors((x) => ({ ...x, photo: a.errPhotoSize })); return; }
    try { setPhoto(await resizeImage(file)); setErrors((x) => ({ ...x, photo: '' })); setSaved(false); } catch { setErrors((x) => ({ ...x, photo: a.errPhotoType })); }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.first.trim()) er.first = a.errFirst;
    if (!f.last.trim()) er.last = a.errLast;
    if (!isEmail(f.email)) er.email = a.errEmail;
    if (!isPhone(f.phone)) er.phone = a.errPhone;
    const others = accounts().filter((x) => x.id !== acc.id);
    if (!er.email && others.some((x) => x.email.toLowerCase() === f.email.trim().toLowerCase())) er.email = a.errExists;
    if (!er.phone && others.some((x) => x.phone === normPhone(f.phone))) er.phone = a.errExists;
    if (f.aadhaar && !isAadhaar(f.aadhaar)) er.aadhaar = a.errAadhaar;
    if (f.pan && !isPan(f.pan)) er.pan = a.errPan;
    setErrors(er);
    if (Object.keys(er).length) return;
    updateAccount({
      ...acc, first: f.first.trim(), last: f.last.trim(), email: f.email.trim().toLowerCase(), phone: normPhone(f.phone),
      rasi: f.rasi, nakshatram: f.nakshatram, gotram: f.gotram, photo,
      aadhaarLast4: f.aadhaar ? f.aadhaar.replace(/\s/g, '').slice(-4) : acc.aadhaarLast4,
      panMasked: f.pan ? `${f.pan.slice(0, 2)}XXXXXX${f.pan.slice(-2)}` : acc.panMasked,
    });
    setF((x) => ({ ...x, aadhaar: '', pan: '' }));
    setSaved(true);
    onSaved();
  }

  const choice = { locale, placeholder: a.select, otherLabel: a.other, typeLabel: a.typeHere } as const;
  const initials = `${f.first[0] ?? ''}${f.last[0] ?? ''}`.toUpperCase();
  const lab = 'mb-1 block text-sm font-bold text-charcoal';
  const err = (k: string) => errors[k] && <p id={`pd-${k}-e`} role="alert" className="mt-1 text-sm font-semibold text-maroon">{errors[k]}</p>;

  return (
    <form noValidate onSubmit={save}>
      <Heading id="sec-title" title={t.detailsTitle} text={t.detailsText} />

      <div className={card}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose shadow ring-4 ring-white">
            {photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo} alt={t.photo} className="h-full w-full object-cover" /> : <span aria-hidden="true" className="font-display text-3xl font-semibold text-maroon">{initials || '🙏'}</span>}
          </div>
          <div>
            <p className="font-bold text-charcoal">{t.photo}</p>
            <div className="mt-1 flex flex-wrap gap-3">
              <button type="button" onClick={() => fileRef.current?.click()} className={ghost + ' !px-4 !py-1.5 text-sm'}>{photo ? a.photoChange : a.photoChoose}</button>
              {photo && <button type="button" onClick={() => { setPhoto(undefined); setSaved(false); }} className="text-sm font-semibold text-maroon underline underline-offset-4">{a.photoRemove}</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" onChange={pick} className="sr-only" tabIndex={-1} aria-label={t.photo} />
            {errors.photo ? <p role="alert" className="mt-1 text-sm font-semibold text-maroon">{errors.photo}</p> : <p className="mt-1 text-xs text-charcoal/70">{a.photoHelp}</p>}
          </div>
        </div>

        <h3 className="mt-6 font-display text-xl font-semibold text-maroon">{a.secPersonal}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="pd-first" className={lab}>{a.first} *</label><input id="pd-first" value={f.first} onChange={ev('first')} autoComplete="given-name" aria-invalid={!!errors.first} className={input} />{err('first')}</div>
          <div><label htmlFor="pd-last" className={lab}>{a.last} *</label><input id="pd-last" value={f.last} onChange={ev('last')} autoComplete="family-name" aria-invalid={!!errors.last} className={input} />{err('last')}</div>
          <div><label htmlFor="pd-email" className={lab}>{a.email} *</label><input id="pd-email" type="email" value={f.email} onChange={ev('email')} autoComplete="email" aria-invalid={!!errors.email} className={input} />{err('email')}</div>
          <div><label htmlFor="pd-phone" className={lab}>{a.phone} *</label><input id="pd-phone" type="tel" inputMode="tel" value={f.phone} onChange={ev('phone')} autoComplete="tel" aria-invalid={!!errors.phone} className={input} />{err('phone')}</div>
        </div>

        <h3 className="mt-6 font-display text-xl font-semibold text-maroon">{a.secSpiritual}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <ChoiceField id="pd-rasi" label={a.rasi} value={f.rasi} onChange={set('rasi')} options={RASIS as unknown as NonNullable<React.ComponentProps<typeof ChoiceField>['options']>} {...choice} />
          <ChoiceField id="pd-nak" label={a.nakshatram} value={f.nakshatram} onChange={set('nakshatram')} options={NAKSHATRAMS as unknown as NonNullable<React.ComponentProps<typeof ChoiceField>['options']>} {...choice} />
          <div className="sm:col-span-2"><ChoiceField id="pd-gotram" label={a.gotram} value={f.gotram} onChange={set('gotram')} options={GOTRAMS as unknown as NonNullable<React.ComponentProps<typeof ChoiceField>['options']>} {...choice} /></div>
        </div>

        <h3 className="mt-6 font-display text-xl font-semibold text-maroon">{a.secId}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pd-aadhaar" className={lab}>{a.aadhaar}</label>
            <input id="pd-aadhaar" inputMode="numeric" autoComplete="off" placeholder={acc.aadhaarLast4 ? `XXXX XXXX ${acc.aadhaarLast4}` : '0000 0000 0000'} value={f.aadhaar} onChange={(e) => set('aadhaar')(fmt(e.target.value))} aria-invalid={!!errors.aadhaar} className={`${input} tracking-widest`} />
            {err('aadhaar') || <p className="mt-1 text-xs text-charcoal/70">{acc.aadhaarLast4 ? t.idSaved : a.aadhaarHelp}</p>}
          </div>
          <div>
            <label htmlFor="pd-pan" className={lab}>{a.pan}</label>
            <input id="pd-pan" autoComplete="off" maxLength={10} placeholder={acc.panMasked || 'ABCPE1234F'} value={f.pan} onChange={(e) => set('pan')(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-invalid={!!errors.pan} className={`${input} uppercase tracking-widest`} />
            {err('pan') || <p className="mt-1 text-xs text-charcoal/70">{acc.panMasked ? t.idSaved : a.panHelp}</p>}
          </div>
        </div>
        <p className="mt-3 text-xs text-charcoal/70">{a.idNote}</p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="submit" className={primary}>{t.save}</button>
          {saved && <p role="status" className="font-semibold text-green-800">✓ {t.saved}</p>}
        </div>
      </div>
    </form>
  );
}
