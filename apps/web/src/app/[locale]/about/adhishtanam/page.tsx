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
    title: `${t.adhishtanam.meta.title} | ${t.site.name}`,
    description: t.adhishtanam.meta.description,
  };
}

// Photos (put them in apps/web/public/images/):
//   adhishtanam-hero.jpg  the Adhishtanam, square-ish, about 1000x1000
//   adhishtanam.jpg       the Dhyana Mandapam / Adhishtanam, about 1200x900
// Until they exist, a gradient shows.
const FALLBACK = 'linear-gradient(135deg, #F3E4E1 0%, #7A1C1C 100%)';
const HERO = `url('/images/adhishtanam-hero.jpg'), ${FALLBACK}`;
const MANDAPAM = `url('/images/adhishtanam.jpg'), ${FALLBACK}`;

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

// Simple line icons for the three practices: walking around, japa beads, meditation lotus
function PracticeIcon({ kind }: { kind: number }) {
  const common = { width: 34, height: 34, viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (kind === 0) {
    return (
      <svg {...common}>
        <circle cx="24" cy="24" r="16" strokeDasharray="4 5" />
        <path d="M36 12l2 7-7-1" />
        <circle cx="24" cy="24" r="4" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === 1) {
    return (
      <svg {...common}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i / 8) * Math.PI * 2;
          return <circle key={i} cx={24 + 15 * Math.cos(a)} cy={22 + 15 * Math.sin(a)} r="2.6" fill="currentColor" stroke="none" />;
        })}
        <path d="M24 37v8" />
        <circle cx="24" cy="39" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M24 8c4 5 4 14 0 22-4-8-4-17 0-22z" />
      <path d="M10 18c7 1 12 6 14 12-7 0-12-4-14-12z" />
      <path d="M38 18c-7 1-12 6-14 12 7 0 12-4 14-12z" />
      <path d="M8 36h32" />
    </svg>
  );
}

const sectionPad = 'py-14 sm:py-16';

export default async function AdhishtanamPage({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.adhishtanam;
  const href = (p: string) => `/${locale}${p}`;
  const more = [
    { label: dict.nav.omkarananda, href: '/about/omkarananda' },
    { label: dict.nav.ashramam, href: '/about/ashramam' },
    { label: dict.nav.vidyapitham, href: '/about/vidyapitham' },
  ];

  return (
    <main>
      {/* 1. Hero: round photo on the left, text on the right */}
      <section aria-labelledby="adhishtanam-title" className="relative isolate overflow-hidden bg-gradient-to-b from-rose/80 via-white to-white">
        <Mandala className="absolute -right-40 -top-40 -z-10 h-[36rem] w-[36rem] text-maroon/[0.06]" />

        <nav aria-label={t.crumbLabel} className="mx-auto max-w-6xl px-4 pt-6 text-sm text-charcoal/80 lg:px-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href={href('')} className="underline-offset-4 hover:text-maroon hover:underline">{dict.nav.home}</Link></li>
            <li aria-hidden="true">/</li>
            <li>{dict.nav.about}</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-maroon">{dict.nav.adhishtanam}</li>
          </ol>
        </nav>

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-8 lg:grid-cols-[380px_1fr] lg:gap-16 lg:px-8 lg:pb-24">
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
              id="adhishtanam-title"
              className="animate-fade-up mt-5 font-display text-[2.1rem] font-semibold leading-[1.1] text-maroon motion-reduce:animate-none sm:text-5xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-[1.8rem] [html[lang='ta']_&]:sm:text-4xl"
            >
              {t.title}
            </h1>
            <p className="mt-3 font-display text-xl font-medium text-saffron sm:text-2xl [html[lang='ta']_&]:!leading-[1.4]">{t.tagline}</p>
            <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3 lg:justify-start">
              <span className="h-px w-14 bg-saffron" />
              <span className="h-2 w-2 rotate-45 bg-saffron" />
              <span className="h-px w-14 bg-saffron" />
            </div>
            <p className="mx-auto mt-5 max-w-xl font-serif text-base leading-relaxed text-charcoal/85 sm:text-lg lg:mx-0">{t.intro}</p>
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

      {/* 3. About: photo of the mandapam and text */}
      <section aria-labelledby="about-title" className={`bg-white ${sectionPad}`}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <Reveal>
            <div className="relative pb-4 pr-4">
              <div aria-hidden="true" className="absolute inset-0 translate-x-4 translate-y-4 rounded-2xl bg-maroon" />
              <div
                role="img"
                aria-label={t.photoAlt}
                className="relative aspect-[4/3] w-full rounded-2xl bg-rose bg-cover bg-center shadow-xl ring-4 ring-white"
                style={{ backgroundImage: MANDAPAM }}
              />
            </div>
          </Reveal>
          <Reveal delay={150}>
            <h2 id="about-title" className="font-display text-4xl font-semibold leading-tight text-maroon sm:text-5xl [html[lang='ta']_&]:!leading-[1.3]">{t.aboutTitle}</h2>
            <div aria-hidden="true" className="mt-4 flex items-center gap-3">
              <span className="h-px w-12 bg-saffron" />
              <Flame className="text-saffron" />
              <span className="h-px w-12 bg-saffron" />
            </div>
            <p className="mt-6 font-serif text-lg leading-relaxed text-charcoal">{t.aboutText1}</p>
            <p className="mt-4 font-serif text-lg leading-relaxed text-charcoal/90">{t.aboutText2}</p>
          </Reveal>
        </div>
      </section>

      {/* 4. Guru verse: dark band */}
      <section aria-label={t.verse.source} className={`relative isolate overflow-hidden bg-charcoal text-white ${sectionPad}`}>
        <Mandala className="absolute left-1/2 top-1/2 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 text-saffron/[0.12]" />
        <figure className="mx-auto max-w-3xl px-4 text-center lg:px-8">
          <blockquote>
            <p lang="sa" className="font-serif text-2xl font-semibold leading-[1.9] text-saffron sm:text-3xl">
              {t.verse.sanskrit.map((line) => (
                <span key={line} className="block">{line}</span>
              ))}
            </p>
            <p className="mx-auto mt-6 max-w-2xl font-serif text-lg italic leading-relaxed text-white/90">{t.verse.translation}</p>
          </blockquote>
          <figcaption className="mt-6 flex items-center justify-center gap-3 text-white/80">
            <span aria-hidden="true" className="h-px w-10 bg-saffron" />
            <span className="font-semibold">{t.verse.source}</span>
            <span aria-hidden="true" className="h-px w-10 bg-saffron" />
          </figcaption>
        </figure>
      </section>

      {/* 5. What devotees do here */}
      <section aria-labelledby="do-title" className={`bg-rose/50 ${sectionPad}`}>
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <SectionTitle id="do-title" title={t.doTitle} subtitle={t.doText} />
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {t.practices.map((p, i) => (
              <li key={p.name}>
                <Reveal delay={i * 120} className="h-full">
                  <article className="flex h-full flex-col items-center rounded-2xl border-t-4 border-saffron bg-white p-7 text-center shadow-md">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-maroon text-white shadow-lg ring-4 ring-rose">
                      <PracticeIcon kind={i} />
                    </span>
                    <h3 className="mt-4 font-display text-2xl font-semibold text-maroon [html[lang='ta']_&]:!leading-[1.4]">{p.name}</h3>
                    <p className="mt-2 font-serif leading-relaxed text-charcoal/85">{p.text}</p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6. Evening parayanam: maroon band */}
      <section aria-labelledby="parayanam-title" className={`relative isolate overflow-hidden bg-maroon text-white ${sectionPad}`}>
        <Mandala className="absolute -right-32 -top-32 -z-10 h-[30rem] w-[30rem] text-white/[0.06]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-[320px_1fr] lg:gap-16 lg:px-8">
          <Reveal className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-saffron px-4 py-1.5 text-sm font-semibold text-rose">
              <Flame className="text-saffron" />
              {t.parayanamLabel}
            </p>
            <p className="mt-4 font-display text-6xl font-semibold leading-none text-saffron sm:text-7xl">{t.parayanamTime}</p>
            <h2 id="parayanam-title" className="mt-3 font-display text-3xl font-semibold leading-tight !text-white [html[lang='ta']_&]:!leading-[1.3]">{t.parayanamTitle}</h2>
            <p className="mt-3 font-serif leading-relaxed text-white/85">{t.parayanamText}</p>
          </Reveal>

          <ul className="grid gap-4 sm:grid-cols-3">
            {t.parayanam.map((x, i) => (
              <li key={x}>
                <Reveal delay={i * 120} className="h-full">
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-saffron/70 bg-white/10 px-5 py-8 text-center">
                    <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-saffron font-display text-xl font-semibold text-charcoal">{i + 1}</span>
                    <p className="mt-4 font-display text-2xl font-semibold leading-tight text-white [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-xl">{x}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 7. Teaching */}
      <section aria-label={t.teaching.source} className={`bg-white ${sectionPad}`}>
        <figure className="mx-auto max-w-4xl px-4 text-center lg:px-8">
          <span aria-hidden="true" className="font-display text-8xl leading-none text-saffron">“</span>
          <blockquote className="-mt-6 font-display text-3xl font-medium leading-snug text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.5] [html[lang='ta']_&]:text-2xl sm:[html[lang='ta']_&]:text-3xl">{t.teaching.text}</blockquote>
          <figcaption className="mt-6 flex items-center justify-center gap-3 text-charcoal/80">
            <span aria-hidden="true" className="h-px w-10 bg-saffron" />
            <span className="font-semibold">{t.teaching.source}</span>
            <span aria-hidden="true" className="h-px w-10 bg-saffron" />
          </figcaption>
        </figure>
      </section>

      {/* 8. Visit */}
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

      {/* 9. Continue exploring */}
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