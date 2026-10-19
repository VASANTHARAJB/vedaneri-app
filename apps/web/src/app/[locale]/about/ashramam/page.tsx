import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Reveal from '@/components/Reveal';
import SectionTitle from '@/components/SectionTitle';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: `${t.ashramam.meta.title} | ${t.site.name}`,
    description: t.ashramam.meta.description,
  };
}

// Photos (put them in apps/web/public/images/):
//   ashram-hero.jpg  wide view of the ashram, about 1800x800
//   ashram-river.jpg portrait photo of the river, about 800x1000
//   ashram-vidyapitham.jpg, ashram-ghosala.jpg, ashram-patashala.jpg,
//   ashram-classroom.jpg, ashram-vilasa.jpg, ashram-dining.jpg   about 1200x900 each
// Until they exist, a gradient shows.
const FALLBACK = 'linear-gradient(135deg, #F3E4E1 0%, #7A1C1C 100%)';
const HERO = `url('/images/ashram-hero.jpg'), ${FALLBACK}`;
const RIVER = `url('/images/ashram-river.jpg'), ${FALLBACK}`;
// One photo per facility, in the same order as the list in the dictionary.
const FACILITY_PHOTOS = ['vidyapitham', 'ghosala', 'patashala', 'classroom', 'vilasa', 'dining'].map(
  (n) => `url('/images/ashram-${n}.jpg'), ${FALLBACK}`,
);

function Flame({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M12 2c.6 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4.4.4 1.2 1 1.8 1.7 2C11.3 7.7 11.6 5 12 2z" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Mandala({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" className={className} fill="none" stroke="currentColor" strokeWidth="1.2">
      {[0, 30, 60, 90, 120, 150].map((d) => (
        <ellipse key={d} cx="100" cy="100" rx="22" ry="80" transform={`rotate(${d} 100 100)`} />
      ))}
      <circle cx="100" cy="100" r="80" />
      <circle cx="100" cy="100" r="30" />
    </svg>
  );
}

const sectionPad = 'py-14 sm:py-16';

export default async function AshramamPage({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.ashramam;
  const href = (p: string) => `/${locale}${p}`;
  const more = [
    { label: dict.nav.omkarananda, href: '/about/omkarananda' },
    { label: dict.nav.adhishtanam, href: '/about/adhishtanam' },
    { label: dict.nav.vidyapitham, href: '/about/vidyapitham' },
  ];

  return (
    <main>
      {/* 1. Hero: round photo on the left, text on the right */}
      <section aria-labelledby="ashram-title" className="relative isolate overflow-hidden bg-gradient-to-b from-rose/80 via-white to-white">
        <Mandala className="absolute -right-40 -top-40 -z-10 h-[36rem] w-[36rem] text-maroon/[0.06]" />

        <nav aria-label={t.crumbLabel} className="mx-auto max-w-6xl px-4 pt-6 text-sm text-charcoal/80 lg:px-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href={href('')} className="underline-offset-4 hover:text-maroon hover:underline">{dict.nav.home}</Link></li>
            <li aria-hidden="true">/</li>
            <li>{dict.nav.about}</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-maroon">{dict.nav.ashramam}</li>
          </ol>
        </nav>

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-8 lg:grid-cols-[380px_1fr] lg:gap-16 lg:px-8 lg:pb-24">
          {/* Photo in a medallion */}
          <div className="mx-auto w-64 sm:w-72 lg:w-full">
            <div className="relative aspect-square">
              <div aria-hidden="true" className="absolute -inset-4 rounded-full border-2 border-dashed border-saffron/60" />
              <div aria-hidden="true" className="absolute -inset-8 -z-10 rounded-full bg-saffron/20 blur-3xl" />
              <div
                role="img"
                aria-label={t.heroAlt}
                className="h-full w-full rounded-full border-[6px] border-white bg-rose bg-cover bg-center shadow-2xl ring-4 ring-saffron"
                style={{ backgroundImage: HERO }}
              />
              <p className="absolute -bottom-3 left-1/2 w-max max-w-[95%] -translate-x-1/2 rounded-full bg-maroon px-4 py-1.5 text-center text-xs font-bold text-white shadow-lg sm:text-sm">
                {t.est}
              </p>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-saffron bg-white px-4 py-1.5 text-sm font-semibold text-maroon sm:text-base">
              <Flame className="text-saffron" />
              <span>{t.eyebrow}</span>
            </p>
            <h1
              id="ashram-title"
              className="animate-fade-up mt-5 font-display text-[2.2rem] font-semibold leading-[1.1] text-maroon motion-reduce:animate-none sm:text-5xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-[1.9rem] [html[lang='ta']_&]:sm:text-4xl"
            >
              {t.title}
            </h1>
            <p className="mt-2 font-display text-2xl font-medium text-saffron sm:text-3xl [html[lang='ta']_&]:!leading-[1.4]">{t.tagline}</p>
            <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3 lg:justify-start">
              <span className="h-px w-14 bg-saffron" />
              <span className="h-2 w-2 rotate-45 bg-saffron" />
              <span className="h-px w-14 bg-saffron" />
            </div>
            <p className="mx-auto mt-5 max-w-xl font-serif text-base leading-relaxed text-charcoal/85 sm:text-lg lg:mx-0">{t.intro}</p>
            <p className="mt-5 inline-block rounded-full bg-rose px-4 py-1.5 text-sm font-semibold text-maroon">{t.trustLabel}</p>
          </div>
        </div>
      </section>

      {/* 2. Three facts, overlapping the hero */}
      <div className="mx-auto max-w-5xl px-4 lg:px-8">
        <dl className="relative z-10 -mt-10 grid gap-px overflow-hidden rounded-2xl bg-rose shadow-xl sm:grid-cols-3">
          {t.stats.map((s) => (
            <div key={s.label} className="bg-white px-6 py-6 text-center">
              <dd className="font-display text-3xl font-semibold leading-tight text-maroon [html[lang='ta']_&]:text-2xl">{s.value}</dd>
              <dt className="mt-1 text-sm font-semibold text-charcoal/80">{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      {/* 3. About: text and the river photo in an arch */}
      <section aria-labelledby="about-title" className={`bg-white ${sectionPad}`}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-[1fr_380px] lg:gap-20 lg:px-8">
          <Reveal>
            <h2 id="about-title" className="font-display text-4xl font-semibold leading-tight text-maroon sm:text-5xl [html[lang='ta']_&]:!leading-[1.3]">{t.aboutTitle}</h2>
            <div aria-hidden="true" className="mt-4 flex items-center gap-3">
              <span className="h-px w-12 bg-saffron" />
              <Flame className="text-saffron" />
              <span className="h-px w-12 bg-saffron" />
            </div>
            <p className="mt-6 font-serif text-lg leading-relaxed text-charcoal">{t.aboutText1}</p>
            <p className="mt-4 font-serif text-lg leading-relaxed text-charcoal/90">{t.aboutText2}</p>
            <p className="mt-6 inline-block rounded-full bg-rose px-4 py-2 text-sm font-bold text-maroon">{t.trustLabel}</p>
          </Reveal>

          <Reveal delay={150} className="mx-auto w-full max-w-xs lg:max-w-none">
            <div className="relative pb-3 pr-3">
              <div aria-hidden="true" className="absolute inset-0 translate-x-3 translate-y-3 rounded-t-[9999px] rounded-b-2xl border-2 border-saffron" />
              <div
                role="img"
                aria-label={t.riverAlt}
                className="relative aspect-[4/5] w-full rounded-t-[9999px] rounded-b-2xl bg-rose bg-cover bg-center shadow-xl"
                style={{ backgroundImage: RIVER }}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 4. Setting: maroon band */}
      <section aria-labelledby="setting-title" className={`relative isolate overflow-hidden bg-maroon text-white ${sectionPad}`}>
        <Mandala className="absolute -right-32 -top-32 -z-10 h-[30rem] w-[30rem] text-white/[0.06]" />
        <Mandala className="absolute -bottom-40 -left-32 -z-10 h-[28rem] w-[28rem] text-saffron/[0.12]" />
        <div className="mx-auto max-w-3xl px-4 text-center lg:px-8">
          <h2 id="setting-title" className="font-display text-4xl font-semibold leading-tight !text-white sm:text-5xl [html[lang='ta']_&]:!leading-[1.3]">{t.settingTitle}</h2>
          <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-saffron" />
            <Flame className="text-saffron" />
            <span className="h-px w-12 bg-saffron" />
          </div>
          <Reveal>
            <p className="mt-8 font-serif text-lg leading-relaxed text-white/90 sm:text-xl">{t.settingText}</p>
            <ul className="mt-8 flex flex-wrap justify-center gap-3">
              {t.settingTags.map((s) => (
                <li key={s} className="rounded-full border-2 border-saffron bg-white/10 px-5 py-2 font-semibold text-white">{s}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 5. Facilities: an index, then one section for each */}
      <section aria-labelledby="facilities-title" className="bg-rose/50 pb-12 pt-14 sm:pt-16">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <SectionTitle id="facilities-title" title={t.facilitiesTitle} subtitle={t.facilitiesText} />
          <nav aria-label={t.facilitiesTitle} className="mt-8">
            <ul className="flex flex-wrap justify-center gap-3">
              {t.facilities.map((f, i) => (
                <li key={`${f}-${i}`}>
                  <a
                    href={`#facility-${i + 1}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-sm font-semibold text-maroon shadow-sm ring-1 ring-saffron/50 transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
                  >
                    <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-saffron text-xs font-bold text-charcoal">{i + 1}</span>
                    {f}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {t.facilities.map((f, i) => {
        const n = i + 1;
        const flip = i % 2 === 1;
        const white = i % 2 === 0;
        return (
          <section key={`${f}-${i}`} id={`facility-${n}`} aria-labelledby={`facility-${n}-title`} className={`scroll-mt-20 py-12 sm:py-16 ${white ? 'bg-white' : 'bg-rose/50'}`}>
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2 lg:gap-16 lg:px-8">
              {/* Photo with an offset maroon block and a number badge */}
              <Reveal className={flip ? 'lg:order-2' : ''}>
                <div className={`relative pb-4 ${flip ? 'pl-4' : 'pr-4'}`}>
                  <div aria-hidden="true" className={`absolute inset-0 translate-y-4 rounded-2xl bg-maroon ${flip ? '-translate-x-4' : 'translate-x-4'}`} />
                  <div
                    role="img"
                    aria-label={f}
                    className="relative aspect-[4/3] w-full rounded-2xl bg-rose bg-cover bg-center shadow-xl ring-4 ring-white"
                    style={{ backgroundImage: FACILITY_PHOTOS[i] }}
                  />
                  <span aria-hidden="true" className={`absolute -top-3 flex h-14 w-14 items-center justify-center rounded-full bg-saffron font-display text-2xl font-semibold text-charcoal shadow-lg ring-4 ring-white ${flip ? '-right-3' : '-left-3'}`}>{n}</span>
                </div>
              </Reveal>

              {/* Content */}
              <Reveal delay={150}>
                <h2 id={`facility-${n}-title`} className="font-display text-3xl font-semibold leading-tight text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.35] [html[lang='ta']_&]:text-2xl sm:[html[lang='ta']_&]:text-3xl">{f}</h2>
                <div aria-hidden="true" className="mt-3 flex items-center gap-3">
                  <span className="h-px w-12 bg-saffron" />
                  <Flame className="text-saffron" />
                  <span className="h-px w-12 bg-saffron" />
                </div>
              </Reveal>
            </div>
          </section>
        );
      })}

      {/* 6. Quote */}
      <section aria-label={t.quote.source} className={`bg-white ${sectionPad}`}>
        <figure className="relative mx-auto max-w-4xl px-4 text-center lg:px-8">
          <span aria-hidden="true" className="font-display text-8xl leading-none text-saffron">“</span>
          <blockquote className="-mt-6 font-display text-3xl font-medium leading-snug text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.5] [html[lang='ta']_&]:text-2xl sm:[html[lang='ta']_&]:text-3xl">{t.quote.text}</blockquote>
          <figcaption className="mt-6 flex items-center justify-center gap-3 text-charcoal/80">
            <span aria-hidden="true" className="h-px w-10 bg-saffron" />
            <span className="font-semibold">{t.quote.source}</span>
            <span aria-hidden="true" className="h-px w-10 bg-saffron" />
          </figcaption>
        </figure>
      </section>

      {/* 7. Visit */}
      <section aria-labelledby="visit-title" className="bg-saffron py-10 text-charcoal sm:py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center lg:flex-row lg:justify-between lg:px-8 lg:text-left">
          <div className="max-w-2xl">
            <h2 id="visit-title" className="font-display text-3xl font-semibold leading-tight !text-charcoal sm:text-4xl">{t.visitTitle}</h2>
            <address className="mt-2 text-lg not-italic">{t.address}</address>
          </div>
          <Link
            href={href('/contact')}
            className="group inline-flex items-center gap-2 rounded-md bg-charcoal px-7 py-3 font-semibold text-white transition-colors hover:bg-maroon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
          >
            {t.visitCta}
            <Arrow />
          </Link>
        </div>
      </section>

      {/* 8. Continue exploring */}
      <section aria-labelledby="more-title" className={`bg-white ${sectionPad}`}>
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <SectionTitle id="more-title" title={t.moreTitle} />
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {more.map((m) => (
              <li key={m.href}>
                <Link
                  href={href(m.href)}
                  className="group flex items-center justify-between gap-3 rounded-xl border-2 border-rose bg-white px-6 py-5 font-display text-xl font-semibold text-maroon transition-colors hover:border-saffron hover:bg-rose/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
                >
                  {m.label}
                  <Arrow />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}