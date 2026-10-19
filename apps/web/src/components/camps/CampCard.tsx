'use client';

import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { rupees } from '@/lib/format';
import { txt } from '@/data/sevas';
import type { Camp } from '@/data/camps';

// One camp in the list: photo, name, fee, dates, short description and the button that opens the form
export default function CampCard({
  camp,
  locale,
  t,
  selected,
  closed,
  past,
  onSelect,
}: {
  camp: Camp;
  locale: Locale;
  t: Dictionary['camps'];
  selected: boolean;
  closed: boolean;
  past: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`flex gap-4 rounded-xl bg-white p-4 shadow-sm transition-shadow sm:p-5 ${selected ? 'shadow-md ring-2 ring-saffron' : 'ring-1 ring-rose hover:shadow-md'}`}>
      <div role="img" aria-label={txt(camp.name, locale)} className="h-24 w-24 shrink-0 rounded-lg bg-maroon bg-cover bg-center sm:h-32 sm:w-32" style={{ backgroundImage: `url('${camp.photo}'), linear-gradient(135deg, #7A1C1C, #D97706)` }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl font-semibold leading-tight text-maroon sm:text-2xl [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-lg">{txt(camp.name, locale)}</h3>
          <p className="shrink-0 text-right font-display text-xl font-semibold leading-tight text-saffron">
            {rupees(camp.fee)}
            <span className="block text-xs font-semibold text-charcoal/60 [html[lang='ta']_&]:text-[0.7rem]">{t.perPerson}</span>
          </p>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="rounded bg-saffron/15 px-2 py-0.5 font-bold text-saffron">{txt(camp.when, locale)}</span>
          <span className="text-charcoal/70">{txt(camp.includes, locale)}</span>
        </p>
        <p className="mt-2 text-charcoal/85">{txt(camp.desc, locale)}</p>
        <div className="mt-auto pt-3">
          <button
            type="button"
            disabled={closed}
            aria-pressed={selected}
            onClick={onSelect}
            className={`rounded-md border px-4 py-2 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${
              closed ? 'cursor-not-allowed border-rose bg-rose/60 text-charcoal/60' : selected ? 'border-saffron bg-saffron text-charcoal' : 'border-saffron bg-white text-maroon hover:bg-saffron/15'
            }`}
          >
            {closed ? (past ? t.pastLabel : t.closedLabel) : selected ? `✓ ${t.selected}` : t.registerCta}
          </button>
        </div>
      </div>
    </article>
  );
}
