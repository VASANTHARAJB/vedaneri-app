'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import type { Stream } from '@/lib/cartItem';
import { useCart, type Contact } from './CartProvider';
import OrderSummary from './OrderSummary';

const inputClass =
  'w-full rounded-md border-2 border-rose bg-white px-4 py-2.5 text-charcoal placeholder:text-charcoal/50 focus:border-saffron focus:outline-none';

function Field({ id, label, error, className = '', children }: { id: string; label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-bold text-charcoal">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-semibold text-maroon">{error}</p>}
    </div>
  );
}

export default function CheckoutForm({ t, locale, stream }: { t: Dictionary['shop']; locale: Locale; stream: Stream }) {
  const router = useRouter();
  const { ready, linesOf, totalOf, contact, saveContact } = useCart();
  const lines = linesOf(stream);
  const total = totalOf(stream);
  const [form, setForm] = useState<Contact | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Contact, string>>>({});
  const href = (p: string) => `/${locale}${p}`;

  if (!ready) return <p role="status" className="py-16 text-center text-charcoal/70">{t.loading}</p>;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-rose/50 px-6 py-14 text-center">
        <p className="font-display text-3xl font-semibold text-maroon">{t.cartEmpty}</p>
        <Link href={href('/cart')} className="mt-6 inline-block rounded-md bg-maroon px-7 py-3 font-semibold text-white hover:bg-charcoal">{t.backToCart}</Link>
      </div>
    );
  }

  // Start from what was saved the last time, then keep the visitor's edits
  const v = form ?? contact;
  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...v, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Partial<Record<keyof Contact, string>> = {};
    if (!v.name.trim()) er.name = t.errName;
    if (!/^\+?[\d\s-]{7,15}$/.test(v.phone.trim())) er.phone = t.errPhone;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) er.email = t.errEmail;
    if (!v.address.trim()) er.address = t.errAddress;
    if (!v.city.trim()) er.city = t.errCity;
    if (!v.state.trim()) er.state = t.errState;
    if (!v.pin.trim()) er.pin = t.errPin;
    if (!v.country.trim()) er.country = t.errCountry;
    setErrors(er);
    if (Object.keys(er).length) return;
    saveContact({ ...v, name: v.name.trim(), phone: v.phone.trim(), email: v.email.trim() });
    router.push(href(`/payment?stream=${stream}`));
  }

  const f = (k: keyof Contact) => ({ id: k, value: v[k], onChange: set(k), 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `${k}-error` : undefined, className: inputClass });

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
      <form noValidate onSubmit={submit} className="rounded-2xl bg-white p-6 shadow-lg ring-2 ring-rose sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-maroon [html[lang='ta']_&]:!leading-[1.4]">{t.contactTitle}</h2>
        <p className="mt-1 text-sm text-charcoal/70">{t.contactHelp}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field id="name" label={t.fName} error={errors.name} className="sm:col-span-2"><input {...f('name')} autoComplete="name" /></Field>
          <Field id="phone" label={t.fPhone} error={errors.phone}><input {...f('phone')} type="tel" autoComplete="tel" inputMode="tel" /></Field>
          <Field id="email" label={t.fEmail} error={errors.email}><input {...f('email')} type="email" autoComplete="email" /></Field>
          <Field id="address" label={t.fAddress} error={errors.address} className="sm:col-span-2"><input {...f('address')} autoComplete="street-address" /></Field>
          <Field id="city" label={t.fCity} error={errors.city}><input {...f('city')} autoComplete="address-level2" /></Field>
          <Field id="state" label={t.fState} error={errors.state}><input {...f('state')} autoComplete="address-level1" /></Field>
          <Field id="pin" label={t.fPin} error={errors.pin}><input {...f('pin')} autoComplete="postal-code" /></Field>
          <Field id="country" label={t.fCountry} error={errors.country}><input {...f('country')} autoComplete="country-name" /></Field>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Link href={href('/cart')} className="rounded-md border-2 border-maroon px-6 py-3 text-center font-semibold text-maroon hover:bg-rose">{t.backToCart}</Link>
          <button type="submit" className="rounded-md bg-maroon px-8 py-3 font-semibold text-white transition-colors hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">{t.continuePayment}</button>
        </div>
      </form>

      <div className="lg:sticky lg:top-24">
        <OrderSummary stream={stream} lines={lines} total={total} locale={locale} t={t} />
      </div>
    </div>
  );
}
