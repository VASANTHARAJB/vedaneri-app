'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { todayISO } from '@/lib/format';
import { SEVAS, txt, type Seva } from '@/data/sevas';
import SevaOfferCard from './sevas/SevaOfferCard';
import SankalpamWizard from './sevas/SankalpamWizard';

type T = Dictionary['sevas'];
type Tab = 'all' | 'seva' | 'corpus';

// The seva catalogue: tabs (All / Seva List / Corpus List), search and sort, the offering cards,
// and the booking panel on the right that opens when a card is picked.
export default function SevaList({ t, locale }: { t: T; locale: Locale }) {
  const [tab, setTab] = useState<Tab>('all');
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [selected, setSelected] = useState<Seva | null>(null);
  const [today, setToday] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setToday(todayISO()), []);

  const counts: Record<Tab, number> = {
    all: SEVAS.length,
    seva: SEVAS.filter((s) => s.kind !== 'corpus').length,
    corpus: SEVAS.filter((s) => s.kind === 'corpus').length,
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = SEVAS.filter(
      (s) =>
        (tab === 'all' || (tab === 'corpus' ? s.kind === 'corpus' : s.kind !== 'corpus')) &&
        (tab === 'corpus' || kind === 'all' || s.kind === kind) &&
        (!q || txt(s.name, locale).toLowerCase().includes(q)),
    );
    if (sort === 'low') return [...list].sort((a, b) => (a.amount || Infinity) - (b.amount || Infinity));
    if (sort === 'high') return [...list].sort((a, b) => b.amount - a.amount);
    return list;
  }, [tab, kind, query, sort, locale]);

  const isPast = (s: Seva) => !!today && !!s.to && s.to < today;
  const isClosed = (s: Seva) => s.status !== 'open' || isPast(s);

  function pick(s: Seva) {
    setSelected(s);
    // On a phone the panel sits below the cards, so bring it into view
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const reset = () => {
    setTab('all');
    setKind('all');
    setQuery('');
    setSort('default');
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: t.tabAll },
    { key: 'seva', label: t.tabSeva },
    { key: 'corpus', label: t.tabCorpus },
  ];

  return (
    <div id="seva-list" className="scroll-mt-24">
      {/* Tabs */}
      <div role="group" aria-label={t.tabsLabel} className="flex flex-wrap gap-3">
        {tabs.map((x) => {
          const on = tab === x.key;
          return (
            <button
              key={x.key}
              type="button"
              aria-pressed={on}
              onClick={() => setTab(x.key)}
              className={`rounded-md border px-5 py-2 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${
                on ? 'border-maroon bg-maroon text-white' : 'border-maroon/30 bg-white text-maroon hover:bg-rose'
              }`}
            >
              {x.label} <span className={on ? 'text-rose' : 'text-charcoal/60'}>({counts[x.key]})</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Catalogue */}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-3xl font-semibold text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-2xl [html[lang='ta']_&]:sm:text-3xl">
            {tab === 'corpus' ? t.catalogTitleCorpus : t.catalogTitle}
          </h2>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label className="block sm:flex-1">
              <span className="sr-only">{t.searchLabel}</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full rounded-md border border-rose bg-white px-4 py-2.5 text-charcoal placeholder:text-charcoal/50 focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
              />
            </label>
            <label className="block sm:w-52">
              <span className="sr-only">{t.sortLabel}</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full rounded-md border border-rose bg-white px-3 py-2.5 text-charcoal focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
              >
                {t.sortOptions.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Kinds inside the Seva List */}
          {tab !== 'corpus' && (
            <div role="group" aria-label={t.filterLabel} className="mt-4 flex flex-wrap gap-2">
              {t.filters.map((f) => {
                const on = kind === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setKind(f.key)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${
                      on ? 'bg-saffron text-charcoal ring-saffron' : 'bg-white text-maroon ring-saffron/60 hover:bg-rose'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}

          <p role="status" className="mt-4 text-sm font-semibold text-charcoal/70">{t.countLabel.replace('{n}', String(shown.length))}</p>

          {shown.length > 0 ? (
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {shown.map((s) => (
                <li key={s.slug} className="h-full">
                  <SevaOfferCard
                    seva={s}
                    locale={locale}
                    t={t}
                    selected={selected?.slug === s.slug}
                    closed={isClosed(s)}
                    past={isPast(s)}
                    onSelect={() => pick(s)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 rounded-2xl bg-rose/50 px-6 py-12 text-center">
              <p className="font-serif text-lg text-charcoal">{t.noResults}</p>
              <button type="button" onClick={reset} className="mt-4 rounded-md bg-maroon px-5 py-2.5 font-semibold text-white hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">
                {t.clearFilters}
              </button>
            </div>
          )}
        </div>

        {/* Booking panel */}
        <div ref={panelRef} className="scroll-mt-24 p-1 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:w-96 lg:shrink-0 lg:overflow-y-auto">
          <SankalpamWizard seva={selected} locale={locale} t={t} onChangeSeva={() => setSelected(null)} />
        </div>
      </div>
    </div>
  );
}
