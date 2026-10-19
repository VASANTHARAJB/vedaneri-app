'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { rupees } from '@/lib/format';
import { txt } from '@/data/sevas';
import type { Donation } from '@/data/donations';
import { useCart } from '@/components/cart/CartProvider';

type T = Dictionary['donate'];

const STORE = 'vedaneri.donor.v1';
const readName = () => {
  try {
    return window.localStorage.getItem(STORE) ?? '';
  } catch {
    return '';
  }
};
const writeName = (v: string) => {
  try {
    window.localStorage.setItem(STORE, v);
  } catch {
    /* ignore: storage can be blocked */
  }
};

const inputClass = 'w-full rounded-md border-2 border-rose bg-white px-4 py-2.5 text-charcoal placeholder:text-charcoal/50 focus:border-saffron focus:outline-none';
const btnPrimary = 'rounded-md bg-maroon px-5 py-3 text-center font-semibold text-white transition-colors hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron';
const btnGhost = 'rounded-md border-2 border-rose bg-white px-5 py-3 text-center font-semibold text-charcoal transition-colors hover:bg-rose focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron';

// Donation panel: donor name, amount (or quantity), then add to the cart.
// On the list page the donation comes from the card the visitor picked; on a detail page it is fixed.
export default function DonationPanel({
  item,
  locale,
  t,
  fixed = false,
  onChange,
}: {
  item: Donation | null;
  locale: Locale;
  t: T;
  fixed?: boolean;
  onChange?: () => void;
}) {
  const router = useRouter();
  const { add, contact } = useCart();
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const [donor, setDonor] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [qty, setQty] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<string | null>(null);

  // Start from the name used last time, or the name given at checkout
  useEffect(() => {
    setDonor((d) => d || readName() || contact.name);
  }, [contact.name]);

  // A different donation was picked: clean amount and quantity
  useEffect(() => {
    setAmountStr('');
    setQty(1);
    setErrors({});
    if (item) setAdded(null);
  }, [item]);

  // Move focus to the heading when the panel changes, so screen-reader users hear it (not on first load)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [item, added]);

  const choose = !!item && item.amount === 0;
  const unit = item ? (choose ? Number(amountStr) || 0 : item.amount) : 0;
  const total = unit * (choose ? 1 : qty);

  function submit(goToCart: boolean) {
    if (!item || item.status !== 'open') return;
    const e: Record<string, string> = {};
    if (!donor.trim()) e.donor = t.errName;
    if (choose && !(Number(amountStr) >= item.minAmount)) e.amount = t.errAmount.replace('{min}', rupees(item.minAmount));
    setErrors(e);
    if (Object.keys(e).length) return;

    add({ stream: 'donation', slug: item.slug, qty: choose ? 1 : qty, unit, date: '', devotee: donor.trim(), gotram: '', nakshatram: '' });
    writeName(donor.trim());
    if (goToCart) {
      router.push(`/${locale}/cart`);
      return;
    }
    setAdded(txt(item.name, locale));
    onChange?.(); // on the list page this clears the picked donation so the panel returns to its first state
  }

  const title = item ? t.panelTitleForm : t.panelTitle;
  const text = item ? t.panelTextForm : t.panelText;

  return (
    <section aria-labelledby={headingId} className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-rose">
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold leading-tight text-maroon break-words focus:outline-none [html[lang='ta']_&]:!leading-[1.35] [html[lang='ta']_&]:text-xl">
        {title}
      </h2>
      <p className="mt-1 text-sm text-charcoal/70">{text}</p>

      {added !== null && (
        <div role="status" className="mt-6 rounded-xl bg-saffron/15 p-5 text-center">
          <p className="font-display text-2xl font-semibold text-maroon">✓ {t.added}</p>
          <p className="mt-1 text-charcoal">{added}</p>
          <div className="mt-4 flex flex-col gap-3">
            <Link href={`/${locale}/cart`} className={btnPrimary}>{t.viewCart}</Link>
            {fixed ? (
              <Link href={`/${locale}/donate`} className={btnGhost}>{t.keepBrowsing}</Link>
            ) : (
              <button type="button" onClick={() => setAdded(null)} className={btnGhost}>{t.chooseAnother}</button>
            )}
          </div>
        </div>
      )}

      {added === null && !item && <p className="mt-6 rounded-xl bg-rose/50 p-5 text-center font-serif text-charcoal/85">{t.panelEmpty}</p>}

      {added === null && item && (
        <form noValidate onSubmit={(ev) => { ev.preventDefault(); submit(false); }} className="mt-5">
          <div className="flex items-start justify-between gap-3 rounded-lg bg-rose/50 p-3">
            <div className="min-w-0">
              <p className="font-semibold leading-snug text-charcoal">{txt(item.name, locale)}</p>
              <p className="text-sm text-charcoal/75">{item.amount > 0 ? rupees(item.amount) : t.abilityLabel}</p>
            </div>
            {!fixed && (
              <button type="button" onClick={onChange} className="shrink-0 text-sm font-semibold text-maroon underline underline-offset-4 hover:text-charcoal">{t.change}</button>
            )}
          </div>

          <div className="mt-5">
            <label htmlFor="donor" className="block text-sm font-bold text-charcoal">{t.donorName} <span aria-hidden="true" className="text-maroon">*</span></label>
            <input id="donor" value={donor} onChange={(e) => { setDonor(e.target.value); if (errors.donor) setErrors((x) => ({ ...x, donor: '' })); }} autoComplete="name" aria-invalid={!!errors.donor} aria-describedby={errors.donor ? 'donor-error' : 'donor-hint'} className={`mt-1 ${inputClass}`} />
            {errors.donor ? <p id="donor-error" role="alert" className="mt-1 text-sm font-semibold text-maroon">{errors.donor}</p> : <p id="donor-hint" className="mt-1 text-sm text-charcoal/70">{t.donorHelp}</p>}
          </div>

          {choose ? (
            <div className="mt-5">
              <label htmlFor="d-amount" className="block text-sm font-bold text-charcoal">{t.amountInput} <span aria-hidden="true" className="text-maroon">*</span></label>
              <div className="relative mt-1">
                <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-charcoal/70">₹</span>
                <input id="d-amount" type="number" inputMode="numeric" min={item.minAmount} step={1} value={amountStr} onChange={(e) => { setAmountStr(e.target.value); if (errors.amount) setErrors((x) => ({ ...x, amount: '' })); }} aria-invalid={!!errors.amount} aria-describedby={errors.amount ? 'd-amount-error' : 'd-amount-hint'} className={`${inputClass} pl-9`} />
              </div>
              {errors.amount ? <p id="d-amount-error" role="alert" className="mt-1 text-sm font-semibold text-maroon">{errors.amount}</p> : <p id="d-amount-hint" className="mt-1 text-sm text-charcoal/70">{t.amountHelp}</p>}
            </div>
          ) : (
            <div className="mt-5">
              <p className="text-sm font-bold text-charcoal">{t.qtyLabel}</p>
              <div className="mt-1 inline-flex items-center rounded-md border-2 border-rose" role="group" aria-label={t.qtyLabel}>
                <button type="button" aria-label={t.decrease} disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-11 text-xl font-bold text-maroon hover:bg-rose disabled:opacity-40">−</button>
                <span aria-live="polite" className="w-12 text-center text-lg font-bold">{qty}</span>
                <button type="button" aria-label={t.increase} disabled={qty >= item.maxQty} onClick={() => setQty((q) => Math.min(item.maxQty, q + 1))} className="h-11 w-11 text-xl font-bold text-maroon hover:bg-rose disabled:opacity-40">+</button>
              </div>
            </div>
          )}

          <p className="mt-5 flex items-baseline justify-between border-t-2 border-rose pt-4">
            <span className="font-bold text-charcoal">{t.totalLabel}</span>
            <span className="font-display text-3xl font-semibold text-maroon">{rupees(total)}</span>
          </p>

          <div className="mt-5 flex flex-col gap-3">
            <button type="submit" className={btnPrimary}>{t.addToDonationCart}</button>
            <button type="button" onClick={() => submit(true)} className={btnGhost}>{t.addAndGo}</button>
          </div>
        </form>
      )}
    </section>
  );
}
