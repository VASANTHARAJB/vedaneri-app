'use client';

import Link from 'next/link';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { rupees } from '@/lib/format';
import { txt, type Seva } from '@/data/sevas';

function Calendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

// One offering in the catalogue: name, amount, benefit, and the button that starts the booking panel
export default function SevaOfferCard({
  seva,
  locale,
  t,
  selected,
  closed,
  past,
  onSelect,
}: {
  seva: Seva;
  locale: Locale;
  t: Dictionary['sevas'];
  selected: boolean;
  closed: boolean;
  past: boolean;
  onSelect: () => void;
}) {
  const name = txt(seva.name, locale);
  return (
    <article className={`flex h-full flex-col rounded-xl bg-white p-5 shadow-sm transition-shadow ${selected ? 'ring-2 ring-saffron shadow-md' : 'ring-1 ring-rose hover:shadow-md'}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-semibold leading-tight text-maroon [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-lg">
          <Link href={`/${locale}/sevas/${seva.slug}`} className="underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">
            {name}
          </Link>
        </h3>
        <p className="shrink-0 text-right font-display text-xl font-semibold leading-tight text-saffron [html[lang='ta']_&]:text-base">
          {seva.amount > 0 ? rupees(seva.amount) : t.abilityShort}
        </p>
      </div>

      {seva.benefit && (
        <p className="mt-3 text-sm leading-relaxed text-charcoal/85">
          <span className="font-semibold">{t.benefitsLabel}</span> {txt(seva.benefit, locale)}
        </p>
      )}
      <p className="mt-2 flex items-center gap-2 text-sm text-charcoal/70">
        <Calendar />
        {txt(seva.when, locale)}
      </p>

      <div className="mt-auto pt-4">
        <button
          type="button"
          disabled={closed}
          aria-pressed={selected}
          onClick={onSelect}
          className={`w-full rounded-md border px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${
            closed
              ? 'cursor-not-allowed border-rose bg-rose/60 text-charcoal/60'
              : selected
                ? 'border-saffron bg-saffron text-charcoal'
                : 'border-saffron bg-white text-maroon hover:bg-saffron/15'
          }`}
        >
          {closed ? (past ? t.pastLabel : t.closedLabel) : selected ? `✓ ${t.selected}` : t.addToSevaCart}
        </button>
      </div>
    </article>
  );
}
