import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';
import Reveal from './Reveal';
import SectionTitle from './SectionTitle';
import type { HeroLink } from './Hero';

// An event and a support card, as the CMS (Home Page) can supply them. A link here is already worked out by the page.
export type CalEvent = { date: string; name: string; href?: HeroLink };
export type Sponsor = { key: string; title: string; text: string; href?: HeroLink };

type Props = {
  locale: Locale;
  calendar: Dictionary['calendar'];
  support: Dictionary['support'];
  // All optional. When the CMS has a list, it is used instead of the one in the dictionary.
  events?: CalEvent[];
  sponsors?: Sponsor[];
  eventsLink?: HeroLink; // where an event goes when it has no link of its own, and "View Complete Calendar"
  donateLink?: HeroLink; // where "Sponsor" goes when a card has no link of its own
};

// A link to a page of this site, or to another website
function Go({ to, className, children }: { to: HeroLink; className: string; children: ReactNode }) {
  if (!to.external) return <Link href={to.href} className={className}>{children}</Link>;
  return <a href={to.href} className={className} {...(/^https?:/i.test(to.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>;
}

const ICONS: Record<string, ReactElement> = {
  annadhanam: (
    <path d="M4 11h16a8 8 0 0 1-16 0zM8 7c0-1.2 1-1.6 1-3M12 7c0-1.2 1-1.6 1-3M16 7c0-1.2 1-1.6 1-3" />
  ),
  go: (
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  ),
  veda: (
    <path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14" />
  ),
  // For a support card added in the CMS
  general: (
    <path d="M12 3c.5 2.2 3 3.6 3 6.2a3 3 0 0 1-6 0c0-1.4.6-2.2 1.2-3 .3.8.7 1.2 1.2 1.4C11.6 6.2 11.8 4.6 12 3zM5 15h14l-2 5H7l-2-5z" />
  ),
};

const Arrow = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="transition-transform duration-300 group-hover:translate-x-1"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function CalendarSupport({ locale, calendar, support, events, sponsors, eventsLink, donateLink }: Props) {
  const tag = locale === 'ta' ? 'ta-IN' : 'en-IN';
  const fmt = new Intl.DateTimeFormat(tag, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  // Today's date in India (UTC+5:30), so an event is still shown on its own day
  const today = new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);
  const toEvents: HeroLink = eventsLink ?? { href: `/${locale}/events`, external: false };
  const toDonate: HeroLink = donateLink ?? { href: `/${locale}/donate`, external: false };
  // Only upcoming days are shown, the nearest first
  const all: CalEvent[] = events ?? calendar.items;
  const upcoming = all.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const cards: Sponsor[] = sponsors ?? support.items;

  return (
    <section className="border-t border-rose bg-white pt-16 pb-6 sm:pt-24 sm:pb-10">
      <div className="mx-auto grid max-w-7xl gap-14 px-4 lg:grid-cols-2 lg:gap-16 lg:px-8">
        {/* Sacred calendar */}
        <div aria-labelledby="calendar-title" role="region" className="min-w-0">
          <SectionTitle
            id="calendar-title"
            title={calendar.title}
            subtitle={calendar.subtitle}
            align="left"
          />
          <ul className="mt-8 space-y-3">
            {upcoming.map((e, n) => (
              <li key={`${e.date}-${n}`}>
                <Reveal delay={n * 80}>
                  <Go
                    to={e.href ?? toEvents}
                    className="group flex items-center justify-between gap-4 rounded-lg border border-rose bg-white px-5 py-3.5 transition duration-300 hover:border-saffron hover:shadow-md"
                  >
                    <span className="min-w-0">
                      <time
                        dateTime={e.date}
                        className="block text-xs font-bold uppercase tracking-wide text-maroon"
                      >
                        {fmt.format(new Date(e.date))}
                      </time>
                      <span className="mt-0.5 block font-display text-xl font-semibold text-charcoal">
                        {e.name}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-maroon">
                      {calendar.details}
                      <Arrow />
                    </span>
                  </Go>
                </Reveal>
              </li>
            ))}
          </ul>
          <Go
            to={toEvents}
            className="group mt-6 inline-flex items-center gap-1 text-sm font-bold text-maroon underline decoration-saffron decoration-2 underline-offset-4"
          >
            {calendar.viewAll}
            <Arrow />
          </Go>
        </div>

        {/* Direct support */}
        <div role="region" aria-labelledby="support-title" className="min-w-0">
          <SectionTitle
            id="support-title"
            title={support.title}
            subtitle={support.subtitle}
            align="left"
          />
          <ul className="mt-8 space-y-3">
            {cards.map((s, n) => (
              <li key={`${s.key}-${n}`}>
                <Reveal delay={n * 80}>
                  <div className="flex items-center gap-4 rounded-lg border border-rose bg-white px-5 py-4 transition duration-300 hover:border-saffron hover:shadow-md">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose text-maroon">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {ICONS[s.key] ?? ICONS.general}
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                      <p className="mt-0.5 text-sm text-charcoal/85">{s.text}</p>
                    </div>
                    <Go
                      to={s.href ?? toDonate}
                      className="shrink-0 rounded-md bg-saffron px-4 py-2 text-sm font-bold text-charcoal transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      {support.sponsor}
                    </Go>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}