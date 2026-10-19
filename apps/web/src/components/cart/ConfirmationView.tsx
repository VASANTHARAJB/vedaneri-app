'use client';

import Link from 'next/link';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { formatDate, rupees } from '@/lib/format';
import { itemInfo, streamOf } from '@/lib/cartItem';
import { GOTRAMS, NAKSHATRAMS, RASIS, RELATIONS, labelFor } from '@/data/sankalpam';
import { useCart } from './CartProvider';

export default function ConfirmationView({ t, locale }: { t: Dictionary['shop']; locale: Locale }) {
  const { ready, order } = useCart();
  const href = (p: string) => `/${locale}${p}`;

  if (!ready) return <p role="status" className="py-16 text-center text-charcoal/70">{t.loading}</p>;

  if (!order) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-rose/50 px-6 py-14 text-center">
        <p className="font-serif text-lg text-charcoal">{t.noOrder}</p>
        <Link href={href('/sevas')} className="mt-6 inline-block rounded-md bg-maroon px-7 py-3 font-semibold text-white hover:bg-charcoal">{t.browse}</Link>
      </div>
    );
  }

  const stream = streamOf(order);
  const isDonation = stream === 'donation';
  const method = t.methods.find((m) => m.key === order.method)?.label ?? order.method;
  const placed = order.placedAt.slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl bg-white p-6 shadow-lg ring-2 ring-saffron sm:p-10">
        <div className="text-center">
          <span aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-saffron text-3xl font-bold text-charcoal">✓</span>
          <h2 className="mt-4 font-display text-4xl font-semibold text-maroon [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-3xl">{isDonation ? t.confirmTitleDonation : t.confirmTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl font-serif text-lg text-charcoal/90">{isDonation ? t.confirmTextDonation : t.confirmText}</p>
          <p className="mt-2 text-sm font-semibold text-charcoal/70">{t.receiptSent.replace('{email}', order.contact.email)}</p>
        </div>

        <dl className="mt-8 grid gap-4 rounded-xl bg-rose/50 p-5 sm:grid-cols-3">
          <div><dt className="text-xs font-bold uppercase tracking-wider text-maroon [html[lang='ta']_&]:tracking-normal">{t.orderId}</dt><dd className="mt-1 font-bold text-charcoal">{order.id}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wider text-maroon [html[lang='ta']_&]:tracking-normal">{t.orderDate}</dt><dd className="mt-1 font-bold text-charcoal">{formatDate(placed, locale)}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wider text-maroon [html[lang='ta']_&]:tracking-normal">{t.paidWith}</dt><dd className="mt-1 font-bold text-charcoal">{method}</dd></div>
        </dl>

        <h3 className="mt-8 font-display text-2xl font-semibold text-maroon">{isDonation ? t.yourDonations : t.yourSevas}</h3>
        <ul className="mt-2 divide-y divide-rose">
          {order.lines.map((l) => {
            const info = itemInfo(stream, l.slug, locale);
            return (
              <li key={l.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="font-semibold text-charcoal">{info.name}</p>
                  <p className="text-sm text-charcoal/70">{l.date ? `${formatDate(l.date, locale)} · ` : ''}{l.devotee}{l.gotram ? ` · ${labelFor(GOTRAMS, l.gotram, locale)}` : ''}{l.rasi ? ` · ${labelFor(RASIS, l.rasi, locale)}` : ''}{l.nakshatram ? ` · ${labelFor(NAKSHATRAMS, l.nakshatram, locale)}` : ''}</p>
                  {l.ship && <p className="text-sm text-charcoal/70">{t.shipLabel}: {l.ship.address}, {l.ship.district} - {l.ship.pin} · {l.ship.phone}</p>}
                  {l.family && l.family.length > 0 && (
                    <p className="text-sm text-charcoal/70">{t.familyLabel}: {l.family.map((m) => (m.relation ? `${m.name} (${labelFor(RELATIONS, m.relation, locale)})` : m.name)).join(', ')}</p>
                  )}
                  <p className="text-sm text-charcoal/70">{l.qty} × {rupees(l.unit)}</p>
                </div>
                <p className="shrink-0 font-bold">{rupees(l.qty * l.unit)}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 flex items-baseline justify-between border-t-2 border-rose pt-4">
          <span className="font-bold">{t.total}</span>
          <span className="font-display text-3xl font-semibold text-maroon">{rupees(order.total)}</span>
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={href(isDonation ? '/donate' : '/sevas')} className="rounded-md bg-maroon px-7 py-3 text-center font-semibold text-white hover:bg-charcoal">{isDonation ? t.moreDonations : t.moreSevas}</Link>
          <Link href={href('/cart')} className="rounded-md border-2 border-maroon px-7 py-3 text-center font-semibold text-maroon hover:bg-rose">{t.backToCart}</Link>
          <Link href={href('')} className="rounded-md border-2 border-maroon px-7 py-3 text-center font-semibold text-maroon hover:bg-rose">{t.backHome}</Link>
        </div>
      </div>
    </div>
  );
}
