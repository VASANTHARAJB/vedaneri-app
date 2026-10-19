'use client';

import Link from 'next/link';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { formatDate, rupees } from '@/lib/format';
import { itemInfo, type Stream } from '@/lib/cartItem';
import { GOTRAMS, NAKSHATRAMS, RASIS, RELATIONS, labelFor } from '@/data/sankalpam';
import { useCart } from './CartProvider';

// One cart, two sections. Sevas and donations are paid separately (each has its own payment gateway).
export default function CartView({ t, locale }: { t: Dictionary['shop']; locale: Locale }) {
  const { ready, lines, linesOf, totalOf, setQty, remove } = useCart();
  const href = (p: string) => `/${locale}${p}`;

  if (!ready) return <p role="status" className="py-16 text-center text-charcoal/70">{t.loading}</p>;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-rose/50 px-6 py-14 text-center">
        <p className="font-display text-3xl font-semibold text-maroon">{t.cartEmpty}</p>
        <p className="mt-2 font-serif text-lg text-charcoal/90">{t.cartEmptyText}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={href('/sevas')} className="rounded-md bg-maroon px-7 py-3 font-semibold text-white hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">{t.browse}</Link>
          <Link href={href('/donate')} className="rounded-md border-2 border-maroon px-7 py-3 font-semibold text-maroon hover:bg-rose focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">{t.browseDonations}</Link>
        </div>
      </div>
    );
  }

  const sections: { stream: Stream; title: string; checkout: string; more: string; moreHref: string }[] = [
    { stream: 'seva', title: t.sectionSeva, checkout: t.checkoutSeva, more: t.continueShopping, moreHref: href('/sevas') },
    { stream: 'donation', title: t.sectionDonation, checkout: t.checkoutDonation, more: t.continueDonations, moreHref: href('/donate') },
  ];

  return (
    <div className="space-y-12">
      {sections.map(({ stream, title, checkout, more, moreHref }) => {
        const items = linesOf(stream);
        if (items.length === 0) return null;
        const count = items.reduce((s, l) => s + l.qty, 0);
        const total = totalOf(stream);
        return (
          <section key={stream} aria-labelledby={`cart-${stream}`}>
            <h2 id={`cart-${stream}`} className="font-display text-3xl font-semibold text-maroon [html[lang='ta']_&]:!leading-[1.35] [html[lang='ta']_&]:text-2xl">
              {title} <span className="text-xl text-charcoal/60">({count})</span>
            </h2>
            <div aria-hidden="true" className="mb-5 mt-2 flex items-center gap-3"><span className="h-px w-12 bg-saffron" /><span className="h-2 w-2 rotate-45 bg-saffron" /><span className="h-px w-12 bg-saffron" /></div>

            <div className="flex flex-col items-start gap-8 lg:flex-row">
              <ul className="w-full min-w-0 flex-1 space-y-4">
                {items.map((l) => {
                  const info = itemInfo(stream, l.slug, locale);
                  return (
                    <li key={l.id} className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-md ring-1 ring-rose sm:flex-row sm:p-5">
                      {stream === 'seva' && (
                        <div role="img" aria-label={info.name} className="h-32 w-full shrink-0 rounded-xl bg-maroon bg-cover bg-center sm:h-28 sm:w-36" style={{ backgroundImage: info.photo }} />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <h3 className="font-display text-2xl font-semibold leading-tight text-maroon [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-xl">
                          <Link href={info.href} className="hover:underline">{info.name}</Link>
                        </h3>
                        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                          {l.date && <div className="flex gap-2"><dt className="font-bold text-charcoal/70">{t.dateLabel}:</dt><dd>{formatDate(l.date, locale)}</dd></div>}
                          <div className="flex gap-2"><dt className="font-bold text-charcoal/70">{info.party === 'subscriber' ? t.subscriberLabel : info.party === 'donor' ? t.donorLabel : t.devoteeLabel}:</dt><dd>{l.devotee}</dd></div>
                          {l.ship && <div className="flex gap-2 sm:col-span-2"><dt className="font-bold text-charcoal/70">{t.shipLabel}:</dt><dd>{l.ship.address}, {l.ship.district} - {l.ship.pin} · {l.ship.phone} · {t.renewLabel}: {l.ship.renew ? t.yes : t.no}</dd></div>}
                          {l.gotram && <div className="flex gap-2"><dt className="font-bold text-charcoal/70">{t.gotramLabel}:</dt><dd>{labelFor(GOTRAMS, l.gotram, locale)}</dd></div>}
                          {l.rasi && <div className="flex gap-2"><dt className="font-bold text-charcoal/70">{t.rasiLabel}:</dt><dd>{labelFor(RASIS, l.rasi, locale)}</dd></div>}
                          {l.nakshatram && <div className="flex gap-2"><dt className="font-bold text-charcoal/70">{t.nakshatramLabel}:</dt><dd>{labelFor(NAKSHATRAMS, l.nakshatram, locale)}</dd></div>}
                          {l.family && l.family.length > 0 && (
                            <div className="flex gap-2 sm:col-span-2"><dt className="font-bold text-charcoal/70">{t.familyLabel}:</dt><dd>{l.family.map((m) => (m.relation ? `${m.name} (${labelFor(RELATIONS, m.relation, locale)})` : m.name)).join(', ')}</dd></div>
                          )}
                        </dl>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          {info.fixedPrice && info.maxQty <= 1 ? (
                            <span className="text-sm text-charcoal/70">{t.qtyLabel}: 1</span>
                          ) : info.fixedPrice ? (
                            <div className="inline-flex items-center rounded-md border-2 border-rose" role="group" aria-label={t.qtyLabel}>
                              <button type="button" aria-label={t.decrease} disabled={l.qty <= 1} onClick={() => setQty(l.id, l.qty - 1)} className="h-10 w-10 text-xl font-bold text-maroon hover:bg-rose disabled:opacity-40">−</button>
                              <span aria-live="polite" className="w-10 text-center font-bold">{l.qty}</span>
                              <button type="button" aria-label={t.increase} disabled={l.qty >= info.maxQty} onClick={() => setQty(l.id, l.qty + 1)} className="h-10 w-10 text-xl font-bold text-maroon hover:bg-rose disabled:opacity-40">+</button>
                            </div>
                          ) : (
                            <span className="text-sm text-charcoal/70">{t.yourAmount}</span>
                          )}
                          <p className="font-display text-3xl font-semibold text-charcoal">{rupees(l.qty * l.unit)}</p>
                        </div>
                        <button type="button" onClick={() => remove(l.id)} className="mt-3 self-start text-sm font-semibold text-maroon underline underline-offset-4 hover:text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron">{t.remove}</button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <aside aria-label={`${t.summaryTitle}: ${title}`} className="w-full rounded-2xl bg-white p-6 shadow-lg ring-2 ring-rose lg:sticky lg:top-24 lg:w-80 lg:shrink-0">
                <h3 className="font-display text-2xl font-semibold text-maroon [html[lang='ta']_&]:!leading-[1.4]">{t.summaryTitle}</h3>
                <dl className="mt-4 space-y-2">
                  <div className="flex justify-between"><dt className="text-charcoal/80">{title}</dt><dd className="font-semibold">{count}</dd></div>
                  <div className="flex items-baseline justify-between border-t-2 border-rose pt-4">
                    <dt className="font-bold">{t.total}</dt>
                    <dd className="font-display text-3xl font-semibold text-maroon">{rupees(total)}</dd>
                  </div>
                </dl>
                <Link href={href(`/checkout?stream=${stream}`)} className="mt-6 block rounded-md bg-maroon px-5 py-3 text-center font-semibold text-white transition-colors hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">{checkout}</Link>
                <Link href={moreHref} className="mt-3 block text-center text-sm font-semibold text-maroon underline underline-offset-4">{more}</Link>
                <p className="mt-4 text-center text-xs text-charcoal/70">{t.receiptNote}</p>
              </aside>
            </div>
          </section>
        );
      })}
      {linesOf('seva').length > 0 && linesOf('donation').length > 0 && (
        <p className="rounded-xl bg-saffron/15 px-4 py-3 text-center text-sm font-semibold text-charcoal">{t.twoPaymentsNote}</p>
      )}
    </div>
  );
}
