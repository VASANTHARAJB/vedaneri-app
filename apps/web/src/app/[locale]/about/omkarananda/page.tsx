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

const sectionPad = 'py-14 sm:py-16';

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
      {/* 1. Hero: round portrait on the left, text on the right */}
      <section aria-labelledby="swamiji-title" className="relative isolate overflow-hidden bg-gradient-to-b from-rose/80 via-white to-white">
        <Mandala className="absolute -right-40 -top-40 -z-10 h-[36rem] w-[36rem] text-maroon/[0.06]" />

        <nav aria-label={t.crumbLabel} className="mx-auto max-w-6xl px-4 pt-6 text-sm text-charcoal/80 lg:px-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href={href('')} className="underline-offset-4 hover:text-maroon hover:underline">{dict.nav.home}</Link></li>
            <li aria-hidden="true">/</li>
            <li>{dict.nav.about}</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-maroon">{t.name}</li>
          </ol>
        </nav>

        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-8 lg:grid-cols-[380px_1fr] lg:gap-16 lg:px-8 lg:pb-24">
          {/* Portrait in a medallion */}
          <div className="mx-auto w-64 sm:w-72 lg:w-full">
            <div className="relative aspect-square">
              <div aria-hidden="true" className="absolute -inset-4 rounded-full border-2 border-dashed border-saffron/60" />
              <div aria-hidden="true" className="absolute -inset-8 -z-10 rounded-full bg-saffron/20 blur-3xl" />
              <div
                role="img"
                aria-label={t.photoAlt}
                className="h-full w-full rounded-full border-[6px] border-white bg-rose bg-cover bg-top shadow-2xl ring-4 ring-saffron"
                style={{ backgroundImage: PORTRAIT }}
              />
              <p className="absolute -bottom-3 left-1/2 w-max max-w-[95%] -translate-x-1/2 rounded-full bg-maroon px-4 py-1.5 text-center text-xs font-bold text-white shadow-lg sm:text-sm">
                {t.samadhi}
              </p>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-saffron bg-white px-4 py-1.5 text-sm font-semibold text-maroon sm:text-base">
              <Flame className="text-saffron" />
              <span>{t.eyebrow}</span>
            </p>
            <h1
              id="swamiji-title"
              className="animate-fade-up mt-5 font-display text-[2.4rem] font-semibold leading-[1.1] text-maroon motion-reduce:animate-none sm:text-5xl lg:text-6xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-[2rem] [html[lang='ta']_&]:sm:text-4xl [html[lang='ta']_&]:lg:text-5xl"
            >
              {t.name}
            </h1>
            <p className="mt-2 font-display text-2xl font-medium text-saffron sm:text-3xl [html[lang='ta']_&]:!leading-[1.4]">{t.profile}</p>
            <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3 lg:justify-start">
              <span className="h-px w-14 bg-saffron" />
              <span className="h-2 w-2 rotate-45 bg-saffron" />
              <span className="h-px w-14 bg-saffron" />
            </div>
            <p className="mx-auto mt-5 max-w-xl text-lg font-semibold text-charcoal lg:mx-0">{t.role}</p>
            <p className="mx-auto mt-3 max-w-xl font-serif text-base leading-relaxed text-charcoal/85 sm:text-lg lg:mx-0">{t.intro}</p>
            <p className="mt-5 inline-block rounded-full bg-rose px-4 py-1.5 text-sm font-semibold text-maroon">{t.tagline}</p>
          </div>
        </div>
      </section>

      {/* 2. Four dates, overlapping the hero */}
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        <dl className="relative z-10 -mt-10 grid gap-px overflow-hidden rounded-2xl bg-rose shadow-xl sm:grid-cols-2 lg:grid-cols-4">
          {t.facts.map((f) => (
            <div key={f.label} className="bg-white px-6 py-5 text-center">
              <dd className="font-display text-2xl font-semibold leading-snug text-maroon">{f.value}</dd>
              <dt className="mt-1 text-xs font-bold uppercase tracking-wider text-charcoal/70 [html[lang='ta']_&]:tracking-normal">{f.label}</dt>
            </div>
          ))}
        </dl>
      </div>

            {/* 3. Life journey: a road with numbered stops */}
      <section aria-labelledby="life-title" className={`overflow-hidden bg-white ${sectionPad}`}>
        <div className="mx-auto max-w-5xl px-4 lg:px-8">
          <SectionTitle id="life-title" title={t.lifeTitle} />

          <div className="relative mt-16 pb-8 pt-4">
            {/* The road: dark tarmac with a dashed saffron centre line */}
            <div aria-hidden="true" className="absolute inset-y-0 left-5 w-9 -translate-x-1/2 rounded-full bg-charcoal md:left-1/2">
              <span className="absolute inset-y-8 left-1/2 w-0.5 -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,#D97706_0_12px,transparent_12px_26px)]" />
            </div>

            {/* Start of the journey */}
            <span aria-hidden="true" className="absolute -top-5 left-5 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-maroon text-saffron ring-4 ring-white md:left-1/2">
              <Flame />
            </span>
            {/* Destination flag */}
            <span aria-hidden="true" className="absolute -bottom-2 left-5 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-saffron text-charcoal ring-4 ring-white md:left-1/2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h2v18H5zM8 4h11l-3 4 3 4H8z" /></svg>
            </span>

            <ol className="relative">
              {t.timeline.map((e, i) => {
                const right = i % 2 === 1;
                return (
                  <li key={e.title} className="relative pb-12 pl-14 pt-4 last:pb-6 md:grid md:grid-cols-2 md:pl-0">
                    {/* Numbered stop on the road */}
                    <span aria-hidden="true" className="absolute left-5 top-9 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-saffron font-bold text-charcoal shadow-lg ring-4 ring-white md:left-1/2">
                      {i + 1}
                    </span>

                    <Reveal className={`relative ${right ? 'md:col-start-2 md:pl-14' : 'md:col-start-1 md:pr-14'}`}>
                      {/* Branch from the road to the card */}
                      <span aria-hidden="true" className={`absolute top-[2.9rem] h-0.5 w-5 bg-saffron -left-5 ${right ? 'md:left-0 md:w-14' : 'md:left-auto md:right-0 md:w-14'}`} />
                      <article className="group rounded-2xl border-2 border-rose bg-white p-5 shadow-md transition-colors duration-300 hover:border-saffron sm:p-6">
                        <p className="inline-block rounded-md bg-maroon px-3 py-1 text-xs font-bold text-white">{e.when}</p>
                        <h3 className="mt-3 font-display text-2xl font-semibold leading-snug text-maroon">{e.title}</h3>
                        <p className="mt-2 text-charcoal/90">{e.text}</p>
                      </article>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* 4. Teacher, Acharya and guide */}
      <section aria-labelledby="today-title" className={`bg-rose/50 ${sectionPad}`}>
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <SectionTitle id="today-title" title={t.todayTitle} />

          <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_3fr]">
            {/* Lead statement */}
            <Reveal className="flex">
              <div className="relative isolate flex w-full flex-col justify-center overflow-hidden rounded-3xl bg-maroon p-8 text-white shadow-xl sm:p-10">
                <Mandala className="absolute -bottom-20 -right-20 -z-10 h-72 w-72 text-white/[0.08]" />
                <span aria-hidden="true" className="font-display text-7xl leading-none text-saffron">“</span>
                <p className="font-display text-2xl font-medium leading-snug sm:text-[1.7rem] [html[lang='ta']_&]:!leading-[1.5] [html[lang='ta']_&]:text-xl sm:[html[lang='ta']_&]:text-2xl">{t.todayIntro}</p>
              </div>
            </Reveal>

            {/* Three roles */}
            <ul className="grid gap-4">
              {t.roles.map((r, i) => (
                <li key={r.title}>
                  <Reveal delay={i * 100}>
                    <article className="relative overflow-hidden rounded-2xl bg-white p-6 pl-8 shadow-md">
                      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-2 bg-saffron" />
                      <h3 className="font-display text-2xl font-semibold leading-snug text-maroon">{r.title}</h3>
                      <p className="mt-2 text-charcoal/90">{r.text}</p>
                    </article>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>

          {/* Around the world */}
          <Reveal className="mt-8">
            <div className="rounded-3xl border border-saffron/50 bg-white p-6 text-center shadow-md sm:p-8">
              <h3 className="font-display text-2xl font-semibold text-maroon sm:text-3xl">{t.abroadTitle}</h3>
              <p className="mt-2 text-charcoal/85">{t.abroadText}</p>
              <ul className="mt-5 flex flex-wrap justify-center gap-3">
                {t.abroad.map((c) => (
                  <li key={c} className="inline-flex items-center gap-2 rounded-full border-2 border-saffron/60 bg-rose/50 px-5 py-2 font-semibold text-maroon">
                    <Flame className="text-saffron" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 5. Listen */}
      <section aria-labelledby="listen-title" className="bg-saffron py-10 text-charcoal sm:py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center lg:flex-row lg:justify-between lg:px-8 lg:text-left">
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

      {/* 6. Continue exploring */}
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