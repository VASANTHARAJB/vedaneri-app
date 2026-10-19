'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { todayISO } from '@/lib/format';
import { CAMPS, type Camp, type CampKind } from '@/data/camps';
import CampCard from './camps/CampCard';
import CampForm from './camps/CampForm';

type T = Dictionary['camps'];
const KINDS: CampKind[] = ['dharma', 'yogam', 'vedanta'];

// The camp catalogue: kind chips, the camp cards, and the registration panel on the right.
export default function CampList({ t, locale }: { t: T; locale: Locale }) {
  const [kind, setKind] = useState<'all' | CampKind>('all');
  const [selected, setSelected] = useState<Camp | null>(null);
  const [today, setToday] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setToday(todayISO()), []);

  const shown = useMemo(() => CAMPS.filter((c) => kind === 'all' || c.kind === kind), [kind]);
  const isPast = (c: Camp) => !!today && c.to < today;
  const isClosed = (c: Camp) => c.status !== 'open' || isPast(c);

  function pick(c: Camp) {
    setSelected(c);
    // On a phone the panel sits below the cards, so bring it into view
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const chips = [{ key: 'all' as const, label: t.all }, ...KINDS.map((k) => ({ key: k, label: t.kinds[k] }))];

  return (
    <div id="camp-list" className="scroll-mt-24">
      <div className="text-center">
        <h2 className="font-display text-3xl font-semibold text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-2xl [html[lang='ta']_&]:sm:text-3xl">{t.catalogTitle}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-charcoal/80">{t.catalogText}</p>
        <div role="group" aria-label={t.filtersLabel} className="mt-5 flex flex-wrap justify-center gap-2">
          {chips.map((c) => {
            const on = kind === c.key;
            return (
              <button key={c.key} type="button" aria-pressed={on} onClick={() => setKind(c.key)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${on ? 'bg-saffron text-charcoal ring-saffron' : 'bg-white text-maroon ring-saffron/60 hover:bg-rose'}`}>{c.label}</button>
            );
          })}
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <p role="status" className="mb-4 text-sm font-semibold text-charcoal/70">{t.countLabel.replace('{n}', String(shown.length))}</p>
          {shown.length > 0 ? (
            <ul className="space-y-5">
              {shown.map((c) => (
                <li key={c.slug}>
                  <CampCard camp={c} locale={locale} t={t} selected={selected?.slug === c.slug} closed={isClosed(c)} past={isPast(c)} onSelect={() => pick(c)} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl bg-rose/50 px-6 py-12 text-center">
              <p className="font-serif text-lg text-charcoal">{t.noResults}</p>
              <button type="button" onClick={() => setKind('all')} className="mt-4 rounded-md bg-maroon px-5 py-2.5 font-semibold text-white hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">{t.clearFilters}</button>
            </div>
          )}
        </div>

        <div ref={panelRef} className="scroll-mt-24 p-1 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:w-[26rem] lg:shrink-0 lg:overflow-y-auto">
          <CampForm camp={selected} locale={locale} t={t} onChange={() => setSelected(null)} />
        </div>
      </div>
    </div>
  );
}
