'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Offering } from '@/type/offering';

interface SevaListProps {
  t: any;
  locale: string;
  initialOfferings?: Offering[];
}

type CategoryFilter = 'all' | 'seva' | 'corpus';

function getImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const backendOrigin = (
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
  ).replace(/\/api\/v1\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${backendOrigin}${cleanPath}`;
}

export default function SevaList({ locale, initialOfferings = [] }: SevaListProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const isTa = locale === 'ta';

  const counts = useMemo(
    () => ({
      all: initialOfferings.length,
      seva: initialOfferings.filter((i) => i.category === 'seva').length,
      corpus: initialOfferings.filter((i) => i.category === 'corpus').length,
    }),
    [initialOfferings]
  );

  const filteredOfferings = initialOfferings.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const tabs: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: isTa ? 'அனைத்தும்' : 'All Offerings' },
    { key: 'seva', label: isTa ? 'சேவை பட்டியல்' : 'Seva List' },
    { key: 'corpus', label: isTa ? 'மூலதன நிதி' : 'Corpus Fund' },
  ];

  return (
    <div className="space-y-10">
      {/* 1. Category tabs */}
      <div
        role="tablist"
        aria-label={isTa ? 'வகை' : 'Category'}
        className="flex flex-wrap items-end justify-center gap-x-8 gap-y-2 border-b border-sand"
      >
        {tabs.map((tab) => {
          const active = selectedCategory === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedCategory(tab.key)}
              className={`-mb-px cursor-pointer border-b-2 px-1 pb-3 text-sm font-semibold tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${
                active
                  ? 'border-maroon text-maroon'
                  : 'border-transparent text-charcoal/60 hover:text-charcoal'
              }`}
            >
              {tab.label}
              <span className={`ml-2 text-xs font-medium ${active ? 'text-maroon/70' : 'text-charcoal/40'}`}>
                {counts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Offerings grid */}
      {filteredOfferings.length === 0 ? (
        <div className="rounded-md border border-sand bg-white py-16 text-center">
          <p className="font-serif text-lg text-charcoal/70">
            {isTa
              ? 'தற்போது சேவைகள் எதுவும் கிடைக்கவில்லை.'
              : 'No offerings currently available in this category.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
          {filteredOfferings.map((item) => {
            const title = isTa ? item.title_ta || item.title_en : item.title_en;
            const desc = isTa ? item.description_ta || item.description_en : item.description_en;
            const fullImg = getImageUrl(item.image_url);
            const detailHref = `/${locale}/sevas/${item.slug || item.id}`;
            const isCorpus = item.category === 'corpus';
            const categoryLabel = isCorpus ? (isTa ? 'மூலதன நிதி' : 'Corpus Fund') : isTa ? 'சேவை' : 'Seva';
            const isCustom = item.price_type === 'custom';

            // Non-fixed label: Seva List -> Yathashakti, Corpus -> Part Payment
            const customLabel = isCorpus
              ? isTa
                ? 'பகுதி கட்டணம்'
                : 'Part Payment'
              : isTa
              ? 'யதாசக்தி'
              : 'Yathashakti';

            return (
              <article
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-md border border-sand bg-white transition-shadow duration-300 hover:shadow-lg"
              >
                {/* Category accent line */}
                <div aria-hidden="true" className={`h-1 w-full ${isCorpus ? 'bg-maroon' : 'bg-saffron'}`} />

                {/* Image */}
                <Link
                  href={detailHref}
                  className="relative block aspect-[4/3] w-full overflow-hidden bg-sand/20"
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  {fullImg ? (
                    <img
                      src={fullImg}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cream to-sand/50">
                      <span className="font-display text-lg font-semibold uppercase tracking-[0.25em] text-charcoal/30">
                        {categoryLabel}
                      </span>
                    </div>
                  )}
                </Link>

                {/* Body */}
                <div className="flex flex-1 flex-col p-6">
                  <p
                    className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
                      isCorpus ? 'text-maroon' : 'text-charcoal/60'
                    }`}
                  >
                    {categoryLabel}
                  </p>

                  <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-charcoal transition-colors group-hover:text-maroon [html[lang='ta']_&]:leading-[1.4]">
                    <Link href={detailHref} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">
                      {title}
                    </Link>
                  </h3>

                  {desc && (
                    <p className="mt-3 line-clamp-3 font-serif text-sm leading-relaxed text-charcoal/75">
                      {desc}
                    </p>
                  )}
                </div>

                {/* Price and action */}
                <div className="border-t border-sand bg-[#fffdfa] px-6 py-5">
                  <div className="mb-4 flex items-end justify-between gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal/60">
                      {isCustom ? (isTa ? 'காணிக்கை' : 'Offering') : isTa ? 'சேவை கட்டணம்' : 'Fixed Offering'}
                    </span>
                    <span className="text-right text-xl font-bold leading-none text-maroon">
                      {isCustom ? customLabel : `₹ ${Number(item.amount).toLocaleString('en-IN')}`}
                    </span>
                  </div>

                  <Link
                    href={detailHref}
                    className="flex w-full items-center justify-center rounded-md bg-saffron px-4 py-3 text-center text-sm font-bold text-charcoal transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
                  >
                    {isTa ? 'முன்பதிவு & காணிக்கை செலுத்த' : 'Book & Pay Seva'}
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