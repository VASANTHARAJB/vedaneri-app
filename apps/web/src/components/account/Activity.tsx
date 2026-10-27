'use client';

import Link from 'next/link';
import type { Order } from '@/components/cart/CartProvider';
import { CAMPS } from '@/data/camps';
import { txt } from '@/data/sevas';
import { donationEntries, isUpcoming, sevaEntries, subscriptionEntries, subscriptionPeriod, type CampReg } from '@/lib/accountData';
import { itemInfo } from '@/lib/cartItem';
import { formatDate, rupees } from '@/lib/format';
import type { Locale } from '@/lib/i18n';
import { Badge, card, Empty, ghost, Heading, primary, Row, when, type T } from './ui';

type Props = { t: T; locale: Locale; orders: Order[]; camps: CampReg[] };

// Sevas booked
export function Sevas({ t, locale, orders }: Props) {
  const list = sevaEntries(orders).sort((a, b) => b.line.date.localeCompare(a.line.date));
  return (
    <div>
      <Heading id="sec-title" title={t.sevasTitle} text={t.sevasText}>
        <Link href={`/${locale}/sevas`} className={primary}>{t.bookSeva}</Link>
      </Heading>
      {list.length === 0 ? (
        <Empty title={t.sevasEmpty} text={t.sevasEmptyText}><Link href={`/${locale}/sevas`} className={primary}>{t.bookSeva}</Link></Empty>
      ) : (
        <ul className="space-y-4">
          {list.map(({ order, line }) => {
            const info = itemInfo('seva', line.slug, locale);
            const up = isUpcoming(line.date);
            return (
              <li key={line.id} className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={info.href} className="font-display text-2xl font-semibold text-maroon underline-offset-4 hover:underline">{info.name}</Link>
                    <p className="mt-0.5 text-sm font-bold text-charcoal">{line.date ? formatDate(line.date, locale) : t.anyDate}</p>
                  </div>
                  <Badge tone={up ? 'green' : 'grey'}>{up ? t.upcoming : t.completed}</Badge>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <Row label={t.devotee}>{line.devotee || '—'}</Row>
                  <Row label={t.amount}>{rupees(line.unit * line.qty)}{line.qty > 1 ? ` (${line.qty} × ${rupees(line.unit)})` : ''}</Row>
                  {line.gotram && <Row label={t.gotram}>{line.gotram}</Row>}
                  {line.nakshatram && <Row label={t.nakshatram}>{line.nakshatram}</Row>}
                  {line.family && line.family.length > 0 && <Row label={t.familyNames}>{line.family.map((m) => m.name).join(', ')}</Row>}
                  <Row label={t.orderId}><span className="tabular-nums">{order.id}</span></Row>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Donations (not magazine plans)
export function Donations({ t, locale, orders }: Props) {
  const list = donationEntries(orders);
  const total = list.reduce((s, e) => s + e.line.unit * e.line.qty, 0);
  return (
    <div>
      <Heading id="sec-title" title={t.donationsTitle} text={t.donationsText}>
        <Link href={`/${locale}/donate`} className={primary}>{t.donateNow}</Link>
      </Heading>
      {list.length === 0 ? (
        <Empty title={t.donationsEmpty} text={t.donationsEmptyText}><Link href={`/${locale}/donate`} className={primary}>{t.donateNow}</Link></Empty>
      ) : (
        <>
          <p className="mb-4 rounded-2xl bg-saffron/15 px-5 py-4 text-lg text-charcoal">{t.totalGiven}: <strong className="font-display text-3xl text-maroon">{rupees(total)}</strong></p>
          <ul className="space-y-3">
            {list.map(({ order, line }) => (
              <li key={line.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
                <div>
                  <Link href={itemInfo('donation', line.slug, locale).href} className="font-display text-2xl font-semibold text-maroon underline-offset-4 hover:underline">{itemInfo('donation', line.slug, locale).name}</Link>
                  <p className="text-sm text-charcoal/75">{when(order.placedAt, locale)} · <span className="tabular-nums">{order.id}</span></p>
                  {line.devotee && <p className="text-sm text-charcoal/75">{t.donor}: {line.devotee}</p>}
                </div>
                <p className="font-display text-3xl font-semibold text-maroon">{rupees(line.unit * line.qty)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Magazine subscriptions
export function Magazine({ t, locale, orders }: Props) {
  const list = subscriptionEntries(orders).map((e) => ({ e, p: subscriptionPeriod(e) })).sort((a, b) => b.p.start.getTime() - a.p.start.getTime());
  const active = list.find((x) => x.p.active);
  return (
    <div>
      <Heading id="sec-title" title={t.magazineTitle} text={t.magazineText}>
        <Link href={`/${locale}/magazine`} className={active ? ghost : primary}>{active ? t.renewPlan : t.subscribeNow}</Link>
      </Heading>
      {list.length === 0 ? (
        <Empty title={t.magazineEmpty} text={t.magazineEmptyText}><Link href={`/${locale}/magazine`} className={primary}>{t.subscribeNow}</Link></Empty>
      ) : (
        <ul className="space-y-4">
          {list.map(({ e, p }) => (
            <li key={e.line.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-display text-2xl font-semibold text-maroon">{txt(p.plan.name, locale)}</p>
                <Badge tone={p.active ? 'green' : 'grey'}>{p.active ? t.active : t.expired}</Badge>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <Row label={t.period}>{when(p.start.toISOString(), locale)} – {when(p.end.toISOString(), locale)}</Row>
                <Row label={t.amount}>{rupees(e.line.unit)}</Row>
                <Row label={t.subscriber}>{e.line.devotee || '—'}</Row>
                <Row label={t.autoRenew}>{e.line.ship ? (e.line.ship.renew ? t.yes : t.no) : '—'}</Row>
                {e.line.ship && <div className="sm:col-span-2"><Row label={t.deliverTo}>{e.line.ship.address}, {e.line.ship.district} - {e.line.ship.pin} · {e.line.ship.phone}</Row></div>}
                <Row label={t.orderId}><span className="tabular-nums">{e.order.id}</span></Row>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Camp registrations
export function Camps({ t, locale, camps }: Props) {
  return (
    <div>
      <Heading id="sec-title" title={t.campsTitle} text={t.campsText}>
        <Link href={`/${locale}/camps`} className={primary}>{t.browseCamps}</Link>
      </Heading>
      {camps.length === 0 ? (
        <Empty title={t.campsEmpty} text={t.campsEmptyText}><Link href={`/${locale}/camps`} className={primary}>{t.browseCamps}</Link></Empty>
      ) : (
        <ul className="space-y-4">
          {camps.map((r) => {
            const c = CAMPS.find((x) => x.slug === r.camp);
            return (
              <li key={r.ref} className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-display text-2xl font-semibold text-maroon">{c ? txt(c.name, locale) : r.camp}</p>
                  <Badge tone={c && isUpcoming(c.to) ? 'green' : 'grey'}>{c && isUpcoming(c.to) ? t.upcoming : t.completed}</Badge>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {c && <Row label={t.dates}>{txt(c.when, locale)}</Row>}
                  {c && <Row label={t.fee}>{rupees(c.fee)}</Row>}
                  <Row label={t.regRef}><span className="tabular-nums">{r.ref}</span></Row>
                  <Row label={t.registeredOn}>{when(r.at, locale)}</Row>
                  <Row label={t.stay}>{r.accom === 'yes' ? t.yes : r.accom ? t.no : '—'}</Row>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
