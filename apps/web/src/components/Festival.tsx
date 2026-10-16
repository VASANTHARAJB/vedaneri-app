import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';
import FestivalCountdown from './FestivalCountdown';
import Reveal from './Reveal';

// Poster: apps/web/public/images/festival.jpg (the festival notice, shown whole, never cropped).

function LampIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3c.5 2.2 3 3.6 3 6.2a3 3 0 0 1-6 0c0-1.4.6-2.2 1.2-3 .3.8.7 1.2 1.2 1.4C11.6 6.2 11.8 4.6 12 3zM5 15h14l-2 5H7l-2-5z" />
    </svg>
  );
}

export default function Festival({ locale, t }: { locale: Locale; t: Dictionary['festival'] }) {
  const tag = locale === 'ta' ? 'ta-IN' : 'en-IN';
  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { timeZone: 'UTC', ...o }).format(new Date(iso));
  const range = `${f(t.start, { day: 'numeric' })} – ${f(t.end, { day: 'numeric' })} ${f(t.end, { month: 'long' })} ${f(t.end, { year: 'numeric' })}`;

  return (
    <section aria-labelledby="festival-title" className="bg-gradient-to-b from-white to-rose/60 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        <Reveal>
          <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] bg-white p-6 shadow-xl ring-1 ring-rose sm:p-10 lg:grid-cols-[6fr_5fr] lg:gap-14">
            {/* Details */}
            <div className="order-2 lg:order-1">
              <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-2xl bg-rose px-4 py-2 text-sm font-bold text-maroon">
                <span className="text-saffron"><LampIcon /></span>
                <span>{t.dailyLabel}</span>
                <span className="font-semibold text-charcoal">{t.dailyTime}</span>
              </p>

              <h2 id="festival-title" className="mt-5 font-display text-4xl font-semibold leading-tight text-maroon sm:text-5xl [html[lang='ta']_&]:!leading-[1.3]">
                {t.title}
              </h2>
              <div aria-hidden="true" className="mt-4 flex items-center gap-3">
                <span className="h-px w-12 bg-saffron" />
                <span className="h-2 w-2 rotate-45 bg-saffron" />
                <span className="h-px w-12 bg-saffron" />
              </div>
              <p className="mt-5 font-serif text-base leading-relaxed text-charcoal/90 sm:text-lg">{t.text}</p>

              {/* Day-by-day tracker */}
              <div className="mt-7 rounded-2xl bg-rose/60 p-4 sm:p-5">
                <FestivalCountdown t={t} />
              </div>

              <Link
                href={`/${locale}/sevas`}
                className="mt-7 inline-flex items-center justify-center rounded-full bg-maroon px-8 py-3 font-bold text-white shadow-lg transition duration-300 hover:-translate-y-0.5 hover:bg-charcoal hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
              >
                {t.register}
              </Link>
            </div>

            {/* Poster with an offset maroon block behind it */}
            <div className="order-1 mx-auto w-full max-w-md pb-4 pr-4 lg:order-2 lg:max-w-none">
              <div className="relative">
                <div aria-hidden="true" className="absolute inset-0 translate-x-4 translate-y-4 rounded-2xl bg-maroon" />
                <div className="relative rounded-2xl bg-white p-2 ring-2 ring-saffron">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/festival.jpg" alt={t.photoAlt} loading="lazy" className="block h-auto w-full rounded-xl bg-rose" />
                </div>
                <p className="absolute -left-3 top-5 rounded-r-full bg-saffron px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-charcoal shadow-md [html[lang='ta']_&]:tracking-normal">
                  {range}
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}