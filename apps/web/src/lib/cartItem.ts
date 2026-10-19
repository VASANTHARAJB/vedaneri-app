import type { Locale } from './i18n';
import { getSeva, txt } from '@/data/sevas';
import { getDonation } from '@/data/donations';
import { getPlan } from '@/data/magazine';

// The cart holds two kinds of lines: sevas and donations. Each has its own payment gateway later.
export type Stream = 'seva' | 'donation';
export const STREAMS: Stream[] = ['seva', 'donation'];
export const parseStream = (v: string | string[] | undefined): Stream => (v === 'donation' ? 'donation' : 'seva');

// Lines saved before donations existed have no stream, so they are sevas
export const streamOf = (l: { stream?: Stream }): Stream => l.stream ?? 'seva';

export type ItemInfo = {
  name: string;
  href: string;          // detail page
  photo: string;         // CSS background-image
  fixedPrice: boolean;   // false = the buyer chose the amount
  maxQty: number;
  party: 'devotee' | 'donor' | 'subscriber';   // what the name on the line is called
};

const FALLBACK = 'linear-gradient(135deg, #7A1C1C 0%, #D97706 140%)';

export function itemInfo(stream: Stream, slug: string, locale: Locale): ItemInfo {
  if (stream === 'donation') {
    // Magazine subscriptions are paid like donations (the old site calls them "Subscription Donation")
    const plan = getPlan(slug);
    if (plan) return { name: txt(plan.name, locale), href: `/${locale}/magazine`, photo: FALLBACK, fixedPrice: true, maxQty: 1, party: 'subscriber' };
    const d = getDonation(slug);
    return {
      name: d ? txt(d.name, locale) : slug,
      href: `/${locale}/donate/${slug}`,
      photo: FALLBACK,
      fixedPrice: d ? d.amount > 0 : false,
      maxQty: d?.maxQty ?? 10,
      party: 'donor',
    };
  }
  const s = getSeva(slug);
  return {
    name: s ? txt(s.name, locale) : slug,
    href: `/${locale}/sevas/${slug}`,
    photo: `url('/images/sevas/${slug}.jpg'), ${FALLBACK}`,
    fixedPrice: s ? s.amount > 0 : false,
    maxQty: s?.maxQty ?? 10,
    party: 'devotee',
  };
}
