import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SectionTitle from '@/components/SectionTitle';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: `${t.omkarananda.meta.title} | ${t.site.name}`,
    description: t.omkarananda.meta.description,
  };
}

// Portrait: put the photo at apps/web/public/images/omkarananda.jpg.
// Until it exists, swamiji.jpg (the home page photo) is used, then a gradient.
const PORTRAIT = `url('/images/omkarananda.jpg'), url('/images/swamiji.jpg'), linear-gradient(180deg, #F3E4E1 0%, #7A1C1C 100%)`;

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

const sectionPad = 'py-12 sm:py-14';

export default async function OmkaranandaPage({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.omkarananda;
  const href = (p: string) => `/${locale}${p}`;
  const more = [
    { label: dict.nav.ashramam, href: '/about/ashramam' },
    { label: dict.nav.adhishtanam, href: '/about/adhishtanam' },
    { label: dict.nav.vidyapitham, href: '/about/vidyapitham' },
  ];

  return (
    <main>
      {/* 1. Hero */}
      <section aria-labelledby="swamiji-title" className="relative isolate overflow-hidden bg-charcoal text-white">
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-gradient-to-br from-maroon via-charcoal to-charcoal" />
        <Mandala className="absolute -right-32 -top-32 -z-10 h-[34rem] w-[34rem] text-white/[0.06]" />

        <nav aria-label={t.crumbLabel} className="mx-auto max-w-7xl px-4 pt-6 text-sm text-white/80 lg:px-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href={href('')} className="underline-offset-4 hover:text-white hover:underline">{dict.nav.home}</Link></li>
            <li aria-hidden="true">/</li>
            <li>{dict.nav.about}</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-white">{t.name}</li>
          </ol>
        </nav>

        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-8 lg:grid-cols-[1fr_360px] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-10">
          <div className="order-2 text-center lg:order-1 lg:text-left">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-saffron/70 bg-charcoal/40 px-4 py-1.5 text-sm font-semibold sm:text-base">
              <Flame className="text-saffron" />
              <span>{t.eyebrow}</span>
            </p>
            <h1
              id="swamiji-title"
              className="animate-fade-up mt-5 font-display text-[2.1rem] font-semibold leading-[1.1] text-white motion-reduce:animate-none sm:text-5xl lg:text-6xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-[1.9rem] [html[lang='ta']_&]:sm:text-4xl [html[lang='ta']_&]:lg:text-5xl"
            >
              {t.name}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/90 lg:mx-0">{t.role}</p>
            <div aria-hidden="true" className="mt-5 flex items-center justify-center gap-3 lg:justify-start">
              <span className="h-px w-14 bg-saffron" />
              <span className="h-2 w-2 rotate-45 bg-saffron" />
              <span className="h-px w-14 bg-saffron" />
            </div>
            <p className="mx-auto mt-5 max-w-xl text-base text-white/90 sm:text-lg lg:mx-0">{t.intro}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <span className="rounded-full bg-saffron px-4 py-1.5 text-sm font-bold text-charcoal">{t.samadhi}</span>
              <span className="rounded-full border border-white/50 px-4 py-1.5 text-sm font-semibold text-white">{t.tagline}</span>
            </div>
          </div>

          <div className="order-1 mx-auto w-52 sm:w-60 lg:order-2 lg:w-[360px]">
            <div className="relative animate-float motion-reduce:animate-none">
              <div aria-hidden="true" className="absolute -inset-3 rounded-b-[2rem] rounded-t-[9999px] border border-saffron/50" />
              <div
                role="img"
                aria-label={t.photoAlt}
                className="relative aspect-[5/7] overflow-hidden rounded-b-[1.5rem] rounded-t-[9999px] border-[3px] border-saffron bg-cover bg-top shadow-[0_0_60px_rgba(217,119,6,0.35)]"
                style={{ backgroundImage: PORTRAIT }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Key facts, overlapping the hero */}
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <dl className="relative z-10 -mt-10 grid gap-px overflow-hidden rounded-2xl bg-rose shadow-xl sm:grid-cols-2 lg:grid-cols-4">
          {t.facts.map((f) => (
            <div key={f.label} className="bg-white px-6 py-5 text-center sm:text-left">
              <dt className="text-xs font-bold uppercase tracking-wider text-charcoal/70 [html[lang='ta']_&]:tracking-normal">{f.label}</dt>
              <dd className="mt-1 font-display text-xl font-semibold leading-snug text-maroon">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 3. His life */}
      <section aria-labelledby="life-title" className={`bg-white ${sectionPad}`}>
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <SectionTitle id="life-title" title={t.lifeTitle} />
          <ul className="mt-10 grid gap-6 md:grid-cols-2">
            {t.life.map((c) => (
              <li key={c.title}>
                <article className="h-full rounded-xl border border-rose border-t-4 border-t-saffron bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-lg">
                  <h3 className="font-display text-2xl font-semibold text-maroon">{c.title}</h3>
                  <p className="mt-3 text-charcoal/90">{c.text}</p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Gurus and teachers */}
      <section aria-labelledby="gurus-title" className={`bg-rose/50 ${sectionPad}`}>
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <SectionTitle id="gurus-title" title={t.gurusTitle} />
          <ul className="mt-10 grid gap-6 lg:grid-cols-2">
            {t.gurus.map((g) => (
              <li key={g.name}>
                <article className="relative h-full overflow-hidden rounded-xl bg-white p-6 pl-8 shadow-sm">
                  <span aria-hidden="true" className="absolute inset-y-0 left-0 w-2 bg-maroon" />
                  <p className="text-sm font-bold uppercase tracking-wider text-maroon [html[lang='ta']_&]:tracking-normal">{g.role}</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-maroon sm:text-3xl">{g.name}</h3>
                  <p className="mt-3 text-charcoal/90">{g.text}</p>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5. Tamil scriptures */}
      <section aria-labelledby="tamil-title" className={`bg-white ${sectionPad}`}>
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 lg:grid-cols-2 lg:gap-14 lg:px-8">
          <div>
            <h2 id="tamil-title" className="font-display text-3xl font-semibold leading-tight text-maroon sm:text-4xl">{t.tamilTitle}</h2>
            <div aria-hidden="true" className="mt-4 flex items-center gap-3">
              <span className="h-px w-10 bg-saffron" />
              <Flame className="text-saffron" />
              <span className="h-px w-10 bg-saffron" />
            </div>
            <p className="mt-4 text-charcoal/90">{t.tamilText}</p>
          </div>
          <ul className="flex flex-wrap gap-3">
            {t.tamilWorks.map((w) => (
              <li key={w} className="rounded-full border-2 border-saffron/60 bg-rose/40 px-5 py-2 font-semibold text-maroon">{w}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6. Quote */}
      <section aria-label={t.quote.source} className="relative isolate overflow-hidden bg-maroon py-14 text-white sm:py-16">
        <span aria-hidden="true" className="pointer-events-none absolute left-4 top-0 -z-10 font-display text-[14rem] leading-none text-saffron/20 sm:left-16 sm:text-[18rem]">“</span>
        <Mandala className="absolute -bottom-32 -right-24 -z-10 h-[26rem] w-[26rem] text-white/[0.06]" />
        <figure className="mx-auto max-w-4xl px-4 text-center lg:px-8">
          <blockquote className="font-display text-2xl font-medium leading-snug sm:text-3xl lg:text-4xl">{t.quote.text}</blockquote>
          <p className="mx-auto mt-5 max-w-2xl text-white/85">{t.quote.note}</p>
          <figcaption className="mt-6 flex items-center justify-center gap-3 text-white/90">
            <span aria-hidden="true" className="h-px w-10 bg-saffron" />
            <span className="font-semibold">{t.quote.source}</span>
            <span aria-hidden="true" className="h-px w-10 bg-saffron" />
          </figcaption>
        </figure>
      </section>

      {/* 7. Ashram and Adhishtanam */}
      <section aria-label={t.missionTitle} className={`bg-white ${sectionPad}`}>
        <div className="mx-auto grid max-w-7xl gap-6 px-4 lg:grid-cols-2 lg:px-8">
          <article className="flex flex-col rounded-2xl border border-rose bg-rose/50 p-7 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-wider text-maroon [html[lang='ta']_&]:tracking-normal">{t.tagline}</p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-maroon">{t.missionTitle}</h2>
            <p className="mt-4 text-charcoal/90">{t.missionText}</p>
            <address className="mt-4 text-sm not-italic text-charcoal/80">{t.address}</address>
            <Link
              href={href('/about/ashramam')}
              className="group mt-6 inline-flex items-center gap-2 self-start rounded-md bg-maroon px-6 py-3 font-semibold text-white transition-colors hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
            >
              {t.missionCta}
              <Arrow />
            </Link>
          </article>

          <article className="relative flex flex-col overflow-hidden rounded-2xl bg-charcoal p-7 text-white sm:p-8">
            <Mandala className="absolute -right-16 -top-16 h-64 w-64 text-white/[0.07]" />
            <p className="font-display text-5xl font-semibold text-saffron">{t.adhDate}</p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-white">{t.adhTitle}</h2>
            <p className="mt-4 text-white/90">{t.adhText}</p>
            <Link
              href={href('/about/adhishtanam')}
              className="group mt-6 inline-flex items-center gap-2 self-start rounded-md bg-saffron px-6 py-3 font-bold text-charcoal transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {t.adhCta}
              <Arrow />
            </Link>
          </article>
        </div>
      </section>

      {/* 8. Listen */}
      <section aria-labelledby="listen-title" className="bg-saffron py-10 text-charcoal sm:py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 text-center lg:flex-row lg:justify-between lg:px-8 lg:text-left">
          <div className="max-w-2xl">
            <h2 id="listen-title" className="font-display text-3xl font-semibold leading-tight !text-charcoal sm:text-4xl">{t.listenTitle}</h2>
            <p className="mt-2 text-lg">{t.listenText}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={href('/audio')} className="rounded-md bg-charcoal px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-maroon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal">{t.listenAudio}</Link>
            <Link href={href('/video')} className="rounded-md border-2 border-charcoal px-6 py-3 text-center font-semibold transition-colors hover:bg-charcoal hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal">{t.listenVideo}</Link>
          </div>
        </div>
      </section>

      {/* 9. Continue exploring */}
      <section aria-labelledby="more-title" className={`bg-white ${sectionPad}`}>
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
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