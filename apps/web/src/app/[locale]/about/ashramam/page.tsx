import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Reveal from '@/components/Reveal';
import SectionTitle from '@/components/SectionTitle';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const FILES = API_BASE.replace(/\/api\/v1\/?$/, '');
const PAGE_URL = `${API_BASE}/pages/ashramam`;

type Bi = { en?: string; ta?: string };

// Content saved in the CMS. If the API is down the page still shows the dictionary text,
// and the reason is printed in the web terminal.
async function loadContent(): Promise<any> {
  try {
    const res = await fetch(PAGE_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[ashramam] fetch failed ${res.status} ${PAGE_URL}`);
      return {};
    }
    return (await res.json()).content || {};
  } catch (e: any) {
    console.error(`[ashramam] fetch error ${PAGE_URL}:`, e?.cause?.code || e?.message || e);
    return {};
  }
}

const img = (u?: string) => (u ? `${FILES}${u}` : '');

// CMS text when filled in, otherwise the dictionary text
function build(base: any, c: any, locale: 'en' | 'ta') {
  const pick = (b: Bi | undefined, fb: any) => (b && typeof b[locale] === 'string' && b[locale]!.trim() ? b[locale] : fb);
  const list = (arr: any[] | undefined, fb: any[], map: (x: any, f: any) => any) =>
    Array.isArray(arr) && arr.length > 0 ? arr.map((x, i) => map(x, fb?.[i] ?? {})) : fb;
  return {
    ...base,
    meta: { title: pick(c.meta_title, base.meta.title), description: pick(c.meta_description, base.meta.description) },
    eyebrow: pick(c.eyebrow, base.eyebrow),
    title: pick(c.title, base.title),
    tagline: pick(c.tagline, base.tagline),
    heroAlt: pick(c.heroAlt, base.heroAlt),
    est: pick(c.est, base.est),
    intro: pick(c.intro, base.intro),
    aboutTitle: pick(c.aboutTitle, base.aboutTitle),
    aboutText1: pick(c.aboutText1, base.aboutText1),
    aboutText2: pick(c.aboutText2, base.aboutText2),
    trustLabel: pick(c.trustLabel, base.trustLabel),
    riverAlt: pick(c.riverAlt, base.riverAlt),
    settingTitle: pick(c.settingTitle, base.settingTitle),
    settingText: pick(c.settingText, base.settingText),
    facilitiesTitle: pick(c.facilitiesTitle, base.facilitiesTitle),
    facilitiesText: pick(c.facilitiesText, base.facilitiesText),
    visitTitle: pick(c.visitTitle, base.visitTitle),
    address: pick(c.address, base.address),
    visitCta: pick(c.visitCta, base.visitCta),
    moreTitle: pick(c.moreTitle, base.moreTitle),
    crumbLabel: base.crumbLabel,
    quote: { text: pick(c.quoteText, base.quote.text), source: pick(c.quoteSource, base.quote.source) },
    stats: list(c.stats, base.stats, (x, b) => ({ label: pick(x.label, b.label ?? ''), value: pick(x.value, b.value ?? '') })),
    settingTags: list(c.settingTags, base.settingTags, (x, b) => pick(x, typeof b === 'string' ? b : '')),
    // Facilities: the name from the CMS (or dictionary) and the photo uploaded in the CMS
    facilities: (Array.isArray(c.facilities) && c.facilities.length > 0
      ? c.facilities.map((x: any, i: number) => ({ name: pick(x.name, base.facilities?.[i] ?? ''), image: x.image || '' }))
      : (base.facilities || []).map((n: string) => ({ name: n, image: '' }))),
    teachersTitle: pick(c.teachersTitle, ''),
    teachersText: pick(c.teachersText, ''),
    focusLabel: pick(c.focusLabel, locale === 'ta' ? 'கவனம்' : 'Focus'),
    teachers: (Array.isArray(c.teachers) ? c.teachers : []).map((x: any) => ({
      photo: x.photo || '',
      role: pick(x.role, ''),
      name: pick(x.name, ''),
      bio: pick(x.bio, ''),
      focus: (Array.isArray(x.focus) ? x.focus : []).map((f: Bi) => pick(f, '')).filter(Boolean),
    })),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const c = await loadContent();
  const t = build(dict.ashramam, c, locale as 'en' | 'ta');
  return { title: `${t.meta.title} | ${dict.site.name}`, description: t.meta.description };
}

const FALLBACK = 'linear-gradient(135deg, #F3E4E1 0%, #7A1C1C 100%)';
const FACILITY_FILES = ['vidyapitham', 'ghosala', 'patashala', 'classroom', 'vilasa', 'dining'];

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
  const c = await loadContent();
  const t = build(dict.ashramam, c, locale as 'en' | 'ta');
  const href = (p: string) => `/${locale}${p}`;
  const more = [
    { label: dict.nav.omkarananda, href: '/about/omkarananda' },
    { label: dict.nav.adhishtanam, href: '/about/adhishtanam' },
    { label: dict.nav.vidyapitham, href: '/about/vidyapitham' },
  ];

  // A photo uploaded in the CMS first, then the old file in /public/images, then a gradient
  const HERO = `${img(c.heroImage) ? `url('${img(c.heroImage)}'), ` : ''}url('/images/ashram-hero.jpg'), ${FALLBACK}`;
  const RIVER = `${img(c.riverImage) ? `url('${img(c.riverImage)}'), ` : ''}url('/images/ashram-river.jpg'), ${FALLBACK}`;
  const facilityPhoto = (i: number, uploaded: string) =>
    `${img(uploaded) ? `url('${img(uploaded)}'), ` : ''}${FACILITY_FILES[i] ? `url('/images/ashram-${FACILITY_FILES[i]}.jpg'), ` : ''}${FALLBACK}`;

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
          {t.stats.map((s: any, i: number) => (
            <div key={`${s.label}-${i}`} className="bg-white px-6 py-6 text-center">
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

      {/* 4. Teachers (above "In the lap of the Western Ghats") */}
      {t.teachers.length > 0 && (
        <section aria-labelledby="teachers-title" className={`bg-rose/40 ${sectionPad}`}>
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            {t.teachersTitle && <SectionTitle id="teachers-title" title={t.teachersTitle} subtitle={t.teachersText || undefined} />}
            <ul className="mt-10 grid gap-8 md:grid-cols-2">
              {t.teachers.map((m: any, i: number) => (
                <li key={`${m.name}-${i}`}>
                  <Reveal delay={(i % 2) * 120}>
                    <article className="flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-rose">
                      {/* Maroon band with the round photo */}
                      <div className="relative isolate h-[120px] bg-maroon">
                        <Mandala className="absolute -right-10 -top-16 -z-10 h-56 w-56 text-white/[0.14]" />
                        <Mandala className="absolute -bottom-16 -left-10 -z-10 h-40 w-40 text-saffron/25" />
                        <div
                          role="img"
                          aria-label={m.name}
                          className="absolute left-1/2 top-[42px] h-[156px] w-[156px] -translate-x-1/2 rounded-full border-[5px] border-white bg-rose bg-cover bg-top shadow-lg ring-[3px] ring-saffron"
                          style={{ backgroundImage: `${img(m.photo) ? `url('${img(m.photo)}'), ` : ''}${FALLBACK}` }}
                        />
                      </div>

                      <div className="flex flex-1 flex-col px-7 pb-8 pt-24 text-center">
                        {m.role && <p className="mx-auto inline-block rounded-full bg-saffron px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-charcoal [html[lang='ta']_&]:tracking-normal">{m.role}</p>}
                        <h3 className="mt-4 font-display text-3xl font-semibold leading-snug text-maroon [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-2xl">{m.name}</h3>
                        {m.bio && <p className="mt-4 text-justify font-serif text-lg leading-relaxed text-charcoal/90">{m.bio}</p>}
                        {m.focus.length > 0 && (
                          <div className="mt-auto pt-6">
                            <p className="text-xs font-bold uppercase tracking-wider text-charcoal/60 [html[lang='ta']_&]:tracking-normal">{t.focusLabel}</p>
                            <ul className="mt-3 flex flex-wrap justify-center gap-2">
                              {m.focus.map((tag: string, k: number) => (
                                <li key={`${tag}-${k}`} className="rounded-full border border-saffron/70 bg-rose/60 px-4 py-1.5 text-sm font-semibold text-maroon">{tag}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </article>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 5. Setting: maroon band */}
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
              {t.settingTags.map((s: string, i: number) => (
                <li key={`${s}-${i}`} className="rounded-full border-2 border-saffron bg-white/10 px-5 py-2 font-semibold text-white">{s}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* 6. Facilities: an index, then one section for each */}
      <section aria-labelledby="facilities-title" className="bg-rose/50 pb-12 pt-14 sm:pt-16">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <SectionTitle id="facilities-title" title={t.facilitiesTitle} subtitle={t.facilitiesText} />
          <nav aria-label={t.facilitiesTitle} className="mt-8">
            <ul className="flex flex-wrap justify-center gap-3">
              {t.facilities.map((f: any, i: number) => (
                <li key={`${f.name}-${i}`}>
                  <a
                    href={`#facility-${i + 1}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-sm font-semibold text-maroon shadow-sm ring-1 ring-saffron/50 transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
                  >
                    <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-saffron text-xs font-bold text-charcoal">{i + 1}</span>
                    {f.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {t.facilities.map((f: any, i: number) => {
        const n = i + 1;
        const flip = i % 2 === 1;
        const white = i % 2 === 0;
        return (
          <section key={`${f.name}-${i}`} id={`facility-${n}`} aria-labelledby={`facility-${n}-title`} className={`scroll-mt-20 py-12 sm:py-16 ${white ? 'bg-white' : 'bg-rose/50'}`}>
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2 lg:gap-16 lg:px-8">
              {/* Photo with an offset maroon block and a number badge */}
              <Reveal className={flip ? 'lg:order-2' : ''}>
                <div className={`relative pb-4 ${flip ? 'pl-4' : 'pr-4'}`}>
                  <div aria-hidden="true" className={`absolute inset-0 translate-y-4 rounded-2xl bg-maroon ${flip ? '-translate-x-4' : 'translate-x-4'}`} />
                  <div
                    role="img"
                    aria-label={f.name}
                    className="relative aspect-[4/3] w-full rounded-2xl bg-rose bg-cover bg-center shadow-xl ring-4 ring-white"
                    style={{ backgroundImage: facilityPhoto(i, f.image) }}
                  />
                  <span aria-hidden="true" className={`absolute -top-3 flex h-14 w-14 items-center justify-center rounded-full bg-saffron font-display text-2xl font-semibold text-charcoal shadow-lg ring-4 ring-white ${flip ? '-right-3' : '-left-3'}`}>{n}</span>
                </div>
              </Reveal>

              {/* Content */}
              <Reveal delay={150}>
                <h2 id={`facility-${n}-title`} className="font-display text-3xl font-semibold leading-tight text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.35] [html[lang='ta']_&]:text-2xl sm:[html[lang='ta']_&]:text-3xl">{f.name}</h2>
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

      {/* 7. Quote */}
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