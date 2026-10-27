'use client';

import Link from 'next/link';
import type { Account } from '@/lib/authDemo';
import type { Order } from '@/components/cart/CartProvider';
import { donationEntries, isUpcoming, orderKind, sevaEntries, subscriptionEntries, subscriptionPeriod, type CampReg } from '@/lib/accountData';
import { itemInfo } from '@/lib/cartItem';
import { rupees, formatDate } from '@/lib/format';
import type { Locale } from '@/lib/i18n';
import { card, Heading, when, type T } from './ui';

export type SectionKey = 'overview' | 'details' | 'family' | 'sevas' | 'donations' | 'magazine' | 'camps' | 'history' | 'security';

export default function Overview({ t, locale, acc, orders, camps, go }: { t: T; locale: Locale; acc: Account; orders: Order[]; camps: CampReg[]; go: (s: SectionKey) => void }) {
  const sevas = sevaEntries(orders);
  const upcoming = sevas.filter((e) => isUpcoming(e.line.date)).sort((a, b) => a.line.date.localeCompare(b.line.date));
  const given = donationEntries(orders).reduce((s, e) => s + e.line.unit * e.line.qty, 0);
  const subs = subscriptionEntries(orders).map(subscriptionPeriod);
  const activeSub = subs.find((s) => s.active);
  const family = acc.family ?? [];

  const checks: { done: boolean; label: string; to: SectionKey }[] = [
    { done: !!acc.photo, label: t.todoPhoto, to: 'details' },
    { done: !!(acc.rasi && acc.nakshatram && acc.gotram), label: t.todoSpiritual, to: 'details' },
    { done: family.length > 0, label: t.todoFamily, to: 'family' },
    { done: !!acc.panMasked, label: t.todoPan, to: 'details' },
  ];
  const pct = Math.round(((checks.filter((c) => c.done).length + 2) / (checks.length + 2)) * 100);   // name and contact are always filled

  const tiles = [
    { label: t.tileSevas, value: String(sevas.reduce((s, e) => s + e.line.qty, 0)), to: 'sevas' as const },
    { label: t.tileGiven, value: rupees(given), to: 'donations' as const },
    { label: t.tileMagazine, value: activeSub ? t.active : t.none, to: 'magazine' as const },
    { label: t.tileFamily, value: String(family.length), to: 'family' as const },
  ];

  return (
    <div>
      <Heading id="sec-title" title={t.overviewTitle} text={t.overviewText} />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((x) => (
          <li key={x.label}>
            <button type="button" onClick={() => go(x.to)} className="h-full w-full rounded-2xl bg-white p-4 text-left shadow ring-1 ring-rose transition hover:ring-saffron focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron">
              <span className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 [html[lang='ta']_&]:tracking-normal">{x.label}</span>
              <span className="mt-1 block font-display text-3xl [font-variant-numeric:lining-nums] font-semibold text-maroon">{x.value}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="ov-next" className={card}>
          <h3 id="ov-next" className="font-display text-2xl font-semibold text-maroon">{t.nextSeva}</h3>
          {upcoming.length === 0 ? (
            <>
              <p className="mt-2 text-charcoal/75">{t.nextSevaNone}</p>
              <Link href={`/${locale}/sevas`} className="mt-3 inline-block font-bold text-maroon underline underline-offset-4">{t.bookSeva}</Link>
            </>
          ) : (
            <ul className="mt-3 space-y-3">
              {upcoming.slice(0, 3).map((e) => (
                <li key={e.line.id} className="flex items-start justify-between gap-3 rounded-md bg-rose/50 p-3">
                  <span><span className="block font-semibold text-charcoal">{itemInfo('seva', e.line.slug, locale).name}</span><span className="text-sm text-charcoal/70">{e.line.devotee}</span></span>
                  <span className="shrink-0 text-right text-sm font-bold text-maroon">{formatDate(e.line.date, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="ov-done" className={card}>
          <h3 id="ov-done" className="font-display text-2xl font-semibold text-maroon">{t.completeTitle}</h3>
          <div className="mt-3 flex items-center gap-3">
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-rose" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t.completeTitle}><span className="block h-full bg-saffron" style={{ width: `${pct}%` }} /></span>
            <span className="font-bold text-maroon">{pct}%</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-3 text-sm">
                <span className={c.done ? 'text-charcoal/60 line-through' : 'text-charcoal'}><span aria-hidden="true">{c.done ? '✓' : '○'}</span> {c.label}</span>
                {!c.done && <button type="button" onClick={() => go(c.to)} className="font-semibold text-maroon underline underline-offset-4">{t.add}</button>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="ov-recent" className={`${card} mt-6`}>
        <div className="flex items-center justify-between gap-3">
          <h3 id="ov-recent" className="font-display text-2xl font-semibold text-maroon">{t.recentTitle}</h3>
          {orders.length > 0 && <button type="button" onClick={() => go('history')} className="text-sm font-bold text-maroon underline underline-offset-4">{t.viewAll}</button>}
        </div>
        {orders.length === 0 && camps.length === 0 ? (
          <p className="mt-2 text-charcoal/75">{t.recentNone}</p>
        ) : (
          <ul className="mt-3 divide-y divide-rose">
            {orders.slice(0, 4).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><span className="font-semibold text-charcoal">{t.kinds[orderKind(o)]}</span> <span className="text-sm text-charcoal/60">· {o.id}</span><span className="block text-sm text-charcoal/70">{when(o.placedAt, locale)}</span></span>
                <span className="font-bold text-maroon">{rupees(o.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
