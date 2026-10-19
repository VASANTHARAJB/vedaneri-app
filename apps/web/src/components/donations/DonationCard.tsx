'use client';

import Link from 'next/link';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { rupees } from '@/lib/format';
import { txt } from '@/data/sevas';
import type { Donation } from '@/data/donations';

// One donation in the list: name, amount, and the button that opens the donation panel
export default function DonationCard({
  item,
  locale,
  t,
  selected,
  onSelect,
}: {
  item: Donation;
  locale: Locale;
  t: Dictionary['donate'];
  selected: boolean;
  onSelect: () => void;
}) {
  const closed = item.status !== 'open';
  return (
    <article className={`flex h-full flex-col rounded-xl bg-white p-5 shadow-sm transition-shadow ${selected ? 'shadow-md ring-2 ring-saffron' : 'ring-1 ring-rose hover:shadow-md'}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-semibold leading-tight text-maroon [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-lg">
          <Link href={`/${locale}/donate/${item.slug}`} className="underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">
            {txt(item.name, locale)}
          </Link>
        </h3>
        <p className="shrink-0 text-right font-display text-xl font-semibold leading-tight text-saffron [html[lang='ta']_&]:text-base">
          {item.amount > 0 ? rupees(item.amount) : t.abilityShort}
        </p>
      </div>

      <div className="mt-auto pt-5">
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
          {closed ? t.closedLabel : selected ? `✓ ${t.selected}` : t.addToDonationCart}
        </button>
      </div>
    </article>
  );
}
