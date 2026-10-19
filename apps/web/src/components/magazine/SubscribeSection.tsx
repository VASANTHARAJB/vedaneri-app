'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/cart/CartProvider';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { rupees } from '@/lib/format';
import { txt } from '@/data/sevas';
import { ISSUES_PER_YEAR, PLANS, getPlan } from '@/data/magazine';

type T = Dictionary['magazine'];
type Form = { name: string; phone: string; address: string; district: string; pin: string; renew: boolean };
const EMPTY: Form = { name: '', phone: '', address: '', district: '', pin: '', renew: false };

const inputClass = 'w-full rounded-md border-2 border-rose bg-white px-3 py-2.5 text-charcoal placeholder:text-charcoal/50 focus:border-saffron focus:outline-none';
const btnPrimary = 'inline-flex w-full items-center justify-center rounded-md bg-maroon px-6 py-3 font-semibold text-white transition-colors hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon';
const btnGhost = 'inline-flex w-full items-center justify-center rounded-md border-2 border-maroon px-6 py-3 font-semibold text-maroon transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon';

// Plan cards, the shipping form and "add to cart". DEMO: the cart is stored in this browser; the backend will take over later.
export default function SubscribeSection({ locale, t }: { locale: Locale; t: T }) {
  const router = useRouter();
  const { add, contact } = useCart();
  const [slug, setSlug] = useState('magazine-5-year');
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setF((x) => ({ ...x, name: x.name || contact.name, phone: x.phone || contact.phone }));
  }, [contact.name, contact.phone]);

  useEffect(() => {
    if (added) doneRef.current?.focus();
  }, [added]);

  const plan = getPlan(slug);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: '' }));
  };

  function submit(go: boolean) {
    const er: Record<string, string> = {};
    if (!plan) er.plan = t.errPlan;
    if (!f.name.trim()) er.name = t.errName;
    if (!/^\d{10}$/.test(f.phone.replace(/[\s-]/g, '').replace(/^(\+91|0)/, ''))) er.phone = t.errPhone;
    if (!f.address.trim()) er.address = t.errAddress;
    if (!f.district.trim()) er.district = t.errDistrict;
    if (!/^\d{6}$/.test(f.pin.trim())) er.pin = t.errPin;
    setErrors(er);
    if (Object.keys(er).length || !plan) return;
    add({
      stream: 'donation', slug: plan.slug, qty: 1, unit: plan.price, date: '', devotee: f.name.trim(), gotram: '', nakshatram: '',
      ship: { phone: f.phone.trim(), address: f.address.trim(), district: f.district.trim(), pin: f.pin.trim(), renew: f.renew },
    });
    if (go) {
      router.push(`/${locale}/cart?stream=donation`);
      return;
    }
    setAdded(true);
  }

  return (
    <div>
      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.3]">{t.plansTitle}</h2>
        <div aria-hidden="true" className="mt-3 flex items-center justify-center gap-3"><span className="h-px w-12 bg-saffron" /><span className="h-2 w-2 rotate-45 bg-saffron" /><span className="h-px w-12 bg-saffron" /></div>
        <p className="mt-3 text-charcoal/80">{t.plansText}</p>
      </div>

      <div role="radiogroup" aria-label={t.plansTitle} className="mt-8 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => {
          const on = p.slug === slug;
          const issues = p.years * ISSUES_PER_YEAR;
          return (
            <button
              key={p.slug}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => { setSlug(p.slug); setAdded(false); if (errors.plan) setErrors((x) => ({ ...x, plan: '' })); }}
              className={`relative flex flex-col rounded-2xl p-6 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${on ? 'bg-maroon text-white shadow-xl ring-4 ring-saffron' : 'bg-white text-charcoal shadow ring-1 ring-rose hover:shadow-lg'}`}
            >
              {p.featured && <span className="absolute -top-3 right-5 rounded-full bg-saffron px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-charcoal [html[lang='ta']_&]:tracking-normal">{t.bestValue}</span>}
              <span className={`font-display text-2xl font-semibold ${on ? 'text-white' : 'text-maroon'}`}>{txt(p.name, locale)}</span>
              <span className="mt-3 font-display text-5xl font-semibold">{rupees(p.price)}</span>
              <span className={`mt-1 text-sm ${on ? 'text-white/80' : 'text-charcoal/70'}`}>{t.perPlan}</span>
              <span className={`mt-4 border-t pt-3 text-sm ${on ? 'border-white/30' : 'border-rose'}`}>
                <strong>{issues}</strong> {t.issues} · {t.perIssue.replace('{n}', rupees(Math.round(p.price / issues)))}
              </span>
              <span className={`mt-4 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold ${on ? 'bg-saffron text-charcoal' : 'border-2 border-maroon text-maroon'}`}>{on ? `✓ ${t.selected}` : t.choose}</span>
            </button>
          );
        })}
      </div>
      {errors.plan && <p role="alert" className="mt-3 text-center text-sm font-semibold text-maroon">{errors.plan}</p>}
      <p className="mt-4 text-center text-sm text-charcoal/70">{t.planNote}</p>

      <section id="subscribe-form" aria-labelledby="ship-title" className="mx-auto mt-10 max-w-3xl rounded-2xl bg-white p-6 shadow-lg ring-1 ring-rose sm:p-8">
        <h3 id="ship-title" className="font-display text-3xl font-semibold text-maroon [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-2xl">{t.formTitle}</h3>
        <p className="mt-1 text-sm text-charcoal/70">{t.formText}</p>

        {added ? (
          <div ref={doneRef} tabIndex={-1} role="status" className="mt-6 rounded-xl bg-saffron/15 p-6 text-center focus:outline-none">
            <p className="font-display text-2xl font-semibold text-maroon">✓ {t.added}</p>
            {plan && <p className="mt-1 text-charcoal">{txt(plan.name, locale)} · {rupees(plan.price)}</p>}
            <div className="mx-auto mt-5 flex max-w-xs flex-col gap-3">
              <Link href={`/${locale}/cart?stream=donation`} className={btnPrimary}>{t.viewCart}</Link>
              <button type="button" onClick={() => { setAdded(false); setF((x) => ({ ...EMPTY, name: '', phone: x.phone })); }} className={btnGhost}>{t.another}</button>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={(e) => { e.preventDefault(); submit(false); }} className="mt-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="m-name" label={t.name} error={errors.name}>
                <input id="m-name" value={f.name} onChange={set('name')} autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'm-name-e' : undefined} className={inputClass} />
              </Field>
              <Field id="m-phone" label={t.phone} error={errors.phone}>
                <input id="m-phone" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'm-phone-e' : undefined} className={inputClass} />
              </Field>
              <div className="sm:col-span-2">
                <Field id="m-address" label={t.address} error={errors.address}>
                  <textarea id="m-address" rows={3} value={f.address} onChange={set('address')} autoComplete="street-address" aria-invalid={!!errors.address} aria-describedby={errors.address ? 'm-address-e' : undefined} className={inputClass} />
                </Field>
              </div>
              <Field id="m-district" label={t.district} error={errors.district}>
                <input id="m-district" value={f.district} onChange={set('district')} autoComplete="address-level2" aria-invalid={!!errors.district} aria-describedby={errors.district ? 'm-district-e' : undefined} className={inputClass} />
              </Field>
              <Field id="m-pin" label={t.pin} error={errors.pin}>
                <input id="m-pin" inputMode="numeric" maxLength={6} value={f.pin} onChange={set('pin')} autoComplete="postal-code" aria-invalid={!!errors.pin} aria-describedby={errors.pin ? 'm-pin-e' : undefined} className={inputClass} />
              </Field>
            </div>

            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-rose/50 p-4">
              <input type="checkbox" checked={f.renew} onChange={set('renew')} className="mt-1 h-5 w-5 shrink-0 accent-maroon" />
              <span>
                <span className="block font-semibold text-charcoal">{t.renew}</span>
                <span className="block text-sm text-charcoal/70">{t.renewHelp}</span>
              </span>
            </label>

            <p className="mt-6 flex items-baseline justify-between border-t-2 border-rose pt-4">
              <span className="font-bold text-charcoal">{t.totalLabel}</span>
              <span className="font-display text-3xl font-semibold text-maroon">{rupees(plan?.price ?? 0)}</span>
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="submit" className={btnPrimary}>{t.addToCart}</button>
              <button type="button" onClick={() => submit(true)} className={btnGhost}>{t.addAndGo}</button>
            </div>
            <p className="mt-4 text-sm text-charcoal/70">{t.paymentNote}</p>
          </form>
        )}
      </section>
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold text-charcoal">{label} <span aria-hidden="true" className="text-maroon">*</span></label>
      {children}
      {error && <p id={`${id}-e`} role="alert" className="mt-1 text-sm font-semibold text-maroon">{error}</p>}
    </div>
  );
}
