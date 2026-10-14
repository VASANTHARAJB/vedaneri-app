import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';
import FestivalCountdown from './FestivalCountdown';
import Reveal from './Reveal';

// Photo: apps/web/public/images/festival.jpg (about 1200x900).
const FALLBACK = 'linear-gradient(135deg, #7A1C1C 0%, #231A18 100%)';

export default function Festival({ locale, t }: { locale: Locale; t: Dictionary['festival'] }) {
  const tag = locale === 'ta' ? 'ta-IN' : 'en-IN';
  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { timeZone: 'UTC', ...o }).format(new Date(iso));
  const range = `${f(t.start, { day: 'numeric' })} – ${f(t.end, { day: 'numeric' })} ${f(t.end, { month: 'long' })} ${f(t.end, { year: 'numeric' })}`;

  return (
    <section aria-labelledby="festival-title" className="border-t border-rose bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <Reveal>
          <div className="grid items-center gap-8 rounded-2xl bg-rose/70 p-5 sm:p-8 lg:grid-cols-2 lg:gap-12 lg:p-10">
            <div role="img" aria-label={t.photoAlt}
              className="aspect-[4/3] w-full rounded-xl bg-cover bg-center shadow-xl lg:aspect-[5/4]"
              style={{ backgroundImage: `url('/images/festival.jpg'), ${FALLBACK}` }} />

            <div>
              {/* Dark text on saffron: 5.4:1 contrast */}
              <p className="inline-block rounded bg-saffron px-3 py-1 text-xs font-bold uppercase tracking-wider text-charcoal">{range}</p>
              <h2 id="festival-title" className="mt-4 font-display text-4xl font-semibold sm:text-5xl">{t.title}</h2>
              <p className="mt-4 text-charcoal/90">{t.text}</p>

              <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.97rem]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-saffron">
                  <path d="M12 3c.5 2.2 3 3.6 3 6.2a3 3 0 0 1-6 0c0-1.4.6-2.2 1.2-3 .3.8.7 1.2 1.2 1.4C11.6 6.2 11.8 4.6 12 3zM5 15h14l-2 5H7l-2-5z" /></svg>
                <span className="font-semibold">{t.dailyLabel}</span>
                <span className="font-bold text-maroon">{t.dailyTime}</span>
              </p>

              <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <FestivalCountdown t={t} />
                <Link href={`/${locale}/sevas`}
                  className="inline-flex shrink-0 items-center justify-center rounded-md bg-saffron px-6 py-3 font-bold text-charcoal shadow transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                  {t.register}
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
