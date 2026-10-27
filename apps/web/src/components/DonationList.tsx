'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { DonationFund } from '@/type/donation';
import { rupees } from '@/lib/format';

interface Props {
  locale: string;
  initialFunds?: DonationFund[];
  showTabs?: boolean;
  // Route (without locale) where the fund detail page lives, e.g. "/donate"
  detailBase?: string;
}

type Filter = 'all' | 'donation' | 'corpus';

function getImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const origin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

export default function DonationList({ locale, initialFunds = [], showTabs = true, detailBase = '/donate' }: Props) {
  const isTa = locale === 'ta';
  const [filter, setFilter] = useState<Filter>('all');
  const base = `/${locale}${detailBase.startsWith('/') ? detailBase : `/${detailBase}`}`.replace(/\/+$/, '');

  const counts = useMemo(
    () => ({
      all: initialFunds.length,
      donation: initialFunds.filter((f) => f.category === 'donation').length,
      corpus: initialFunds.filter((f) => f.category === 'corpus').length,
    }),
    [initialFunds]
  );

  const funds = showTabs ? initialFunds.filter((f) => filter === 'all' || f.category === filter) : initialFunds;

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: isTa ? 'அனைத்தும்' : 'All Funds' },
    { key: 'donation', label: isTa ? 'நன்கொடை பட்டியல்' : 'Donation List' },
    { key: 'corpus', label: isTa ? 'மூலதன நிதி' : 'Corpus Fund' },
  ];

  return (
    <div className="space-y-10">
      {showTabs && (
        <div role="tablist" aria-label={isTa ? 'வகை' : 'Category'} className="flex flex-wrap items-end justify-center gap-x-8 gap-y-2 border-b border-sand">
          {tabs.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.key)}
                className={`-mb-px cursor-pointer border-b-2 px-1 pb-3 text-sm font-semibold tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${
                  active ? 'border-maroon text-maroon' : 'border-transparent text-charcoal/60 hover:text-charcoal'
                }`}
              >
                {tab.label}
                <span className={`ml-2 text-xs font-medium ${active ? 'text-maroon/70' : 'text-charcoal/40'}`}>{counts[tab.key]}</span>
              </button>
            );
          })}
        </div>
      )}

      {funds.length === 0 ? (
        <div className="rounded-md border border-sand bg-white py-16 text-center">
          <p className="font-serif text-lg text-charcoal/70">
            {isTa ? 'தற்போது நிதிகள் எதுவும் இல்லை.' : 'No donation funds are available right now.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
          {funds.map((fund) => {
            const isCorpus = fund.category === 'corpus';
            const isAshram = fund.category === 'ashram';
            const title = isTa ? fund.title_ta || fund.title_en : fund.title_en;
            const desc = isTa ? fund.description_ta || fund.description_en : fund.description_en;
            const img = getImageUrl(fund.image_url);
            const isOpen = fund.price_type === 'custom' || !(Number(fund.amount) > 0);
            const detailHref = `${base}/${encodeURIComponent(fund.slug)}`;

            const categoryLabel = isCorpus
              ? isTa ? 'மூலதன நிதி' : 'Corpus Fund'
              : isAshram
              ? isTa ? 'ஆசிரமம்' : 'Ashram'
              : isTa ? 'நன்கொடை' : 'Donation';
            const openLabel = isCorpus
              ? isTa ? 'பகுதி கட்டணம்' : 'Part Payment'
              : isTa ? 'யதாசக்தி' : 'Yathashakti';

            return (
              <article key={fund.id} className="group flex flex-col overflow-hidden rounded-md border border-sand bg-white transition-shadow duration-300 hover:shadow-lg">
                <div aria-hidden="true" className={`h-1 w-full ${isCorpus ? 'bg-maroon' : 'bg-saffron'}`} />

                <Link href={detailHref} tabIndex={-1} aria-hidden="true" className="relative block aspect-[4/3] w-full overflow-hidden bg-sand/20">
                  {img ? (
                    <img src={img} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cream to-sand/50">
                      <span className="font-display text-lg font-semibold uppercase tracking-[0.25em] text-charcoal/30">{categoryLabel}</span>
                    </div>
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-6">
                  <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${isCorpus ? 'text-maroon' : 'text-charcoal/60'}`}>{categoryLabel}</p>
                  <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-charcoal transition-colors group-hover:text-maroon [html[lang='ta']_&]:leading-[1.4]">
                    <Link href={detailHref} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">
                      {title}
                    </Link>
                  </h3>
                  {desc && <p className="mt-3 line-clamp-3 font-serif text-sm leading-relaxed text-charcoal/75">{desc}</p>}
                </div>

                <div className="border-t border-sand bg-[#fffdfa] px-6 py-5">
                  <div className="mb-4 flex items-end justify-between gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal/60">
                      {isOpen ? (isTa ? 'காணிக்கை' : 'Offering') : isTa ? 'நிர்ணயித்த தொகை' : 'Fixed Amount'}
                    </span>
                    <span className="text-right text-xl font-bold leading-none text-maroon">{isOpen ? openLabel : rupees(fund.amount)}</span>
                  </div>
                  <Link
                    href={detailHref}
                    className="flex w-full items-center justify-center rounded-md bg-saffron px-4 py-3 text-center text-sm font-bold text-charcoal transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
                  >
                    {isTa ? 'நன்கொடை அளிக்க' : 'Donate Now'}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}