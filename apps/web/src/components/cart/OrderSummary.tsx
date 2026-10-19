import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { formatDate, rupees } from '@/lib/format';
import { itemInfo, type Stream } from '@/lib/cartItem';
import type { CartLine } from './CartProvider';

// Compact list of the items being paid for (one section of the cart), with the total. Used beside checkout and payment.
export default function OrderSummary({ stream, lines, total, locale, t }: { stream: Stream; lines: CartLine[]; total: number; locale: Locale; t: Dictionary['shop'] }) {
  return (
    <aside aria-label={t.summaryTitle} className="rounded-2xl bg-white p-6 shadow-lg ring-2 ring-rose">
      <h2 className="font-display text-2xl font-semibold text-maroon [html[lang='ta']_&]:!leading-[1.4]">{t.summaryTitle}</h2>
      <p className="mt-1 text-sm font-semibold text-charcoal/70">{stream === 'donation' ? t.streamDonation : t.streamSeva}</p>
      <ul className="mt-4 divide-y divide-rose">
        {lines.map((l) => {
          const info = itemInfo(stream, l.slug, locale);
          return (
            <li key={l.id} className="flex gap-3 py-3">
              {stream === 'seva' && <div role="img" aria-label="" className="h-14 w-14 shrink-0 rounded-lg bg-maroon bg-cover bg-center" style={{ backgroundImage: info.photo }} />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug text-charcoal">{info.name}</p>
                <p className="text-sm text-charcoal/70">{l.date ? `${formatDate(l.date, locale)} · ` : ''}{l.devotee}</p>
                <p className="text-sm text-charcoal/70">{l.qty} × {rupees(l.unit)}</p>
              </div>
              <p className="shrink-0 font-bold text-charcoal">{rupees(l.qty * l.unit)}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex items-baseline justify-between border-t-2 border-rose pt-4">
        <span className="font-bold text-charcoal">{t.total}</span>
        <span className="font-display text-3xl font-semibold text-maroon">{rupees(total)}</span>
      </p>
    </aside>
  );
}
