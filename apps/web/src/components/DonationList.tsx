'use client';

import { useMemo, useRef, useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { txt } from '@/data/sevas';
import { DONATIONS, type Donation } from '@/data/donations';
import DonationCard from './donations/DonationCard';
import DonationPanel from './donations/DonationPanel';

type T = Dictionary['donate'];
type Tab = 'all' | 'donation' | 'corpus';

// The donation catalogue: tabs (All / Donation List / Corpus Fund), search and sort, the cards,
// and the donation panel on the right that opens when a card is picked.
export default function DonationList({ t, locale }: { t: T; locale: Locale }) {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [selected, setSelected] = useState<Donation | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const counts: Record<Tab, number> = {
    all: DONATIONS.length,
    donation: DONATIONS.filter((d) => d.kind === 'donation').length,
    corpus: DONATIONS.filter((d) => d.kind === 'corpus').length,
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = DONATIONS.filter((d) => (tab === 'all' || d.kind === tab) && (!q || txt(d.name, locale).toLowerCase().includes(q)));
    if (sort === 'low') return [...list].sort((a, b) => (a.amount || Infinity) - (b.amount || Infinity));
    if (sort === 'high') return [...list].sort((a, b) => b.amount - a.amount);
    return list;
  }, [tab, query, sort, locale]);

  function pick(d: Donation) {
    setSelected(d);
    // On a phone the panel sits below the cards, so bring it into view
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const reset = () => {
    setTab('all');
    setQuery('');
    setSort('default');
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: t.tabAll },
    { key: 'donation', label: t.tabDonation },
    { key: 'corpus', label: t.tabCorpus },
  ];

  return (
    <div id="donation-list" className="scroll-mt-24">
      <div role="group" aria-label={t.tabsLabel} className="flex flex-wrap gap-3">
        {tabs.map((x) => {
          const on = tab === x.key;
          return (
            <button
              key={x.key}
              type="button"
              aria-pressed={on}
              onClick={() => setTab(x.key)}
              className={`rounded-md border px-5 py-2 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${on ? 'border-maroon bg-maroon text-white' : 'border-maroon/30 bg-white text-maroon hover:bg-rose'}`}
            >
              {x.label} <span className={on ? 'text-rose' : 'text-charcoal/60'}>({counts[x.key]})</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-3xl font-semibold text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-2xl [html[lang='ta']_&]:sm:text-3xl">
            {tab === 'corpus' ? t.catalogTitleCorpus : t.catalogTitle}
          </h2>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label className="block sm:flex-1">
              <span className="sr-only">{t.searchLabel}</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="w-full rounded-md border border-rose bg-white px-4 py-2.5 text-charcoal placeholder:text-charcoal/50 focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40" />
            </label>
            <label className="block sm:w-52">
              <span className="sr-only">{t.sortLabel}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full rounded-md border border-rose bg-white px-3 py-2.5 text-charcoal focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40">
                {t.sortOptions.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          <p role="status" className="mt-4 text-sm font-semibold text-charcoal/70">{t.countLabel.replace('{n}', String(shown.length))}</p>

          {shown.length > 0 ? (
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {shown.map((d) => (
                <li key={d.slug} className="h-full">
                  <DonationCard item={d} locale={locale} t={t} selected={selected?.slug === d.slug} onSelect={() => pick(d)} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 rounded-2xl bg-rose/50 px-6 py-12 text-center">
              <p className="font-serif text-lg text-charcoal">{t.noResults}</p>
              <button type="button" onClick={reset} className="mt-4 rounded-md bg-maroon px-5 py-2.5 font-semibold text-white hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">{t.clearFilters}</button>
            </div>
          )}
        </div>

        <div ref={panelRef} className="scroll-mt-24 p-1 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:w-96 lg:shrink-0 lg:overflow-y-auto">
          <DonationPanel item={selected} locale={locale} t={t} onChange={() => setSelected(null)} />
        </div>
      </div>
    </div>
  );
}
