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
    title: `${t.vidyapitham.meta.title} | ${t.site.name}`,
    description: t.vidyapitham.meta.description,
  };
}

// Photos (put them in apps/web/public/images/):
//   vidyapitham-hero.jpg  the temple or the Moolavar, square-ish, about 1000x1000
//   vidyapitham.jpg       the temple with the vimanam, about 1200x900
// Until they exist, a gradient shows.
const FALLBACK = 'linear-gradient(135deg, #F3E4E1 0%, #7A1C1C 100%)';
const HERO = `url('/images/vidyapitham-hero.jpg'), ${FALLBACK}`;
const TEMPLE = `url('/images/vidyapitham.jpg'), ${FALLBACK}`;

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

type Slot = { time: string; label: string; kind: string };

// One column of the daily schedule
function ScheduleCard({ title, rows }: { title: string; rows: Slot[] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-rose">
      <h3 className="bg-maroon px-6 py-4 font-display text-2xl font-semibold !text-white [html[lang='ta']_&]:!leading-[1.4]">{title}</h3>
      <ol className="divide-y divide-rose">
        {rows.map((r) => {
          const gate = r.kind === 'gate';
          return (
            <li key={`${r.time}-${r.label}`} className={`flex items-start gap-4 px-5 py-3.5 ${gate ? 'bg-saffron/15' : ''}`}>
              <span className={`w-28 shrink-0 rounded-full px-3 py-1 text-center text-sm font-bold ${gate ? 'bg-charcoal text-white' : 'bg-rose text-maroon'} [html[lang='ta']_&]:text-xs`}>{r.time}</span>
              <span className={`pt-0.5 leading-snug ${gate ? 'font-bold text-charcoal' : 'font-medium text-charcoal/90'}`}>{r.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default async function VidyapithamPage({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.vidyapitham;
  const href = (p: string) => `/${locale}${p}`;
  const more = [
    { label: dict.nav.omkarananda, href: '/about/omkarananda' },
    { label: dict.nav.ashramam, href: '/about/ashramam' },
    { label: dict.nav.adhishtanam, href: '/about/adhishtanam' },
  ];

  return (
    <main>
      {/* 1. Hero: round photo on the left, text on the right */}
      <section aria-labelledby="vidya-title" className="relative isolate overflow-hidden bg-gradient-to-b from-rose/80 via-white to-white">
        <Mandala className="absolute -right-40 -top-40 -z-10 h-[36rem] w-[36rem] text-maroon/[0.06]" />

        <nav aria-label={t.crumbLabel} className="mx-auto max-w-6xl px-4 pt-6 text-sm text-charcoal/80 lg:px-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href={href('')} className="underline-offset-4 hover:text-maroon hover:underline">{dict.nav.home}</Link></li>
            <li aria-hidden="true">/</li>
            <li>{dict.nav.about}</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-maroon">{dict.nav.vidyapitham}</li>
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
              id="vidya-title"
              className="animate-fade-up mt-5 font-display text-[2rem] font-semibold leading-[1.1] text-maroon motion-reduce:animate-none sm:text-5xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-[1.7rem] [html[lang='ta']_&]:sm:text-4xl"
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

      {/* 3. About: text and photo */}
      <section aria-labelledby="about-title" className={`bg-white ${sectionPad}`}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <Reveal>
            <h2 id="about-title" className="font-display text-4xl font-semibold leading-tight text-maroon sm:text-5xl [html[lang='ta']_&]:!leading-[1.3]">{t.aboutTitle}</h2>
            <div aria-hidden="true" className="mt-4 flex items-center gap-3">
              <span className="h-px w-12 bg-saffron" />
              <Flame className="text-saffron" />
              <span className="h-px w-12 bg-saffron" />
            </div>
            <p className="mt-6 font-serif text-lg leading-relaxed text-charcoal">{t.aboutText1}</p>
            <p className="mt-4 font-serif text-lg leading-relaxed text-charcoal/90">{t.aboutText2}</p>
          </Reveal>
          <Reveal delay={150}>
            <div className="relative pb-4 pl-4">
              <div aria-hidden="true" className="absolute inset-0 -translate-x-4 translate-y-4 rounded-2xl bg-maroon" />
              <div
                role="img"
                aria-label={t.photoAlt}
                className="relative aspect-[4/3] w-full rounded-2xl bg-rose bg-cover bg-center shadow-xl ring-4 ring-white"
                style={{ backgroundImage: TEMPLE }}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* 4. The six Shanmatha Murtis */}
      <section aria-labelledby="murtis-title" className={`bg-rose/50 ${sectionPad}`}>
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <SectionTitle id="murtis-title" title={t.murtisTitle} subtitle={t.murtisText} />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.murtis.map((m, i) => (
              <li key={m}>
                <Reveal delay={(i % 3) * 120} className="h-full">
                  <div className="flex h-full items-center gap-4 rounded-2xl border-l-4 border-saffron bg-white p-5 shadow-md">
                    <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-maroon font-display text-xl font-semibold text-white ring-4 ring-rose">{i + 1}</span>
                    <div>
                      <p className="font-display text-xl font-semibold leading-tight text-maroon [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-lg">{m}</p>
                      <p className="mt-0.5 text-sm text-charcoal/75">{t.murtiTag}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5. Features of an ideal kshetra: maroon band */}
      <section aria-labelledby="kshetra-title" className={`relative isolate overflow-hidden bg-maroon text-white ${sectionPad}`}>
        <Mandala className="absolute -right-32 -top-32 -z-10 h-[30rem] w-[30rem] text-white/[0.06]" />
        <Mandala className="absolute -bottom-40 -left-32 -z-10 h-[28rem] w-[28rem] text-saffron/[0.12]" />
        <div className="mx-auto max-w-6xl px-4 text-center lg:px-8">
          <h2 id="kshetra-title" className="font-display text-4xl font-semibold leading-tight !text-white sm:text-5xl [html[lang='ta']_&]:!leading-[1.3]">{t.kshetraTitle}</h2>
          <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-saffron" />
            <Flame className="text-saffron" />
            <span className="h-px w-12 bg-saffron" />
          </div>
          <p className="mx-auto mt-5 max-w-2xl font-serif text-lg text-white/90">{t.kshetraText}</p>
          <dl className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {t.kshetra.map((k, i) => (
              <Reveal key={k.label} delay={i * 100}>
                <div className="h-full rounded-2xl border-2 border-saffron/70 bg-white/10 px-5 py-7">
                  <dt className="text-sm font-bold uppercase tracking-wider text-saffron [html[lang='ta']_&]:tracking-normal">{k.label}</dt>
                  <dd className="mt-2 font-display text-2xl font-semibold leading-tight text-white [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-xl">{k.value}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* 6. History */}
      <section aria-labelledby="history-title" className={`bg-white ${sectionPad}`}>
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <SectionTitle id="history-title" title={t.historyTitle} />
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {t.history.map((h, i) => (
              <li key={h.when}>
                <Reveal delay={i * 120} className="h-full">
                  <article className="relative h-full rounded-2xl bg-rose/50 p-7 pt-10 ring-1 ring-rose">
                    <p className="absolute -top-5 left-6 rounded-full bg-saffron px-5 py-2 font-display text-xl font-semibold text-charcoal shadow-md [html[lang='ta']_&]:text-lg">{h.when}</p>
                    <h3 className="font-display text-2xl font-semibold leading-tight text-maroon [html[lang='ta']_&]:!leading-[1.4]">{h.title}</h3>
                    <p className="mt-2 font-serif leading-relaxed text-charcoal/85">{h.text}</p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ol>
          <Reveal>
            <p className="mx-auto mt-10 max-w-3xl rounded-2xl border-2 border-saffron/60 bg-white p-6 text-center font-serif text-lg leading-relaxed text-charcoal">{t.worshipText}</p>
          </Reveal>
        </div>
      </section>

      {/* 7. Temple features */}
      <section aria-labelledby="features-title" className={`bg-rose/50 ${sectionPad}`}>
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <SectionTitle id="features-title" title={t.featuresTitle} />
          <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((f, i) => (
              <Reveal key={f.label} delay={(i % 3) * 100} className="h-full">
                <div className="h-full rounded-xl bg-white p-5 shadow-sm ring-1 ring-rose">
                  <dt className="text-xs font-bold uppercase tracking-wider text-maroon [html[lang='ta']_&]:tracking-normal">{f.label}</dt>
                  <dd className="mt-1 font-semibold leading-snug text-charcoal">{f.value}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
          <p className="mx-auto mt-8 max-w-3xl text-center font-serif text-lg text-charcoal/85">{t.featuresNote}</p>
        </div>
      </section>

      {/* 8. Daily schedule */}
      <section aria-labelledby="schedule-title" className={`bg-white ${sectionPad}`}>
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <SectionTitle id="schedule-title" title={t.scheduleTitle} subtitle={t.scheduleText} />
          <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
            <Reveal>
              <ScheduleCard title={t.morningLabel} rows={t.morning} />
            </Reveal>
            <Reveal delay={150}>
              <ScheduleCard title={t.eveningLabel} rows={t.evening} />
            </Reveal>
          </div>
          <p className="mt-6 text-center text-sm text-charcoal/75">{t.scheduleNote}</p>
        </div>
      </section>

      {/* 9. Pooja corpus */}
      <section aria-labelledby="corpus-title" className={`relative isolate overflow-hidden bg-charcoal text-white ${sectionPad}`}>
        <Mandala className="absolute left-1/2 top-1/2 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 text-saffron/[0.12]" />
        <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
          <h2 id="corpus-title" className="font-display text-4xl font-semibold leading-tight !text-white sm:text-5xl [html[lang='ta']_&]:!leading-[1.3]">{t.corpusTitle}</h2>
          <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-saffron" />
            <Flame className="text-saffron" />
            <span className="h-px w-12 bg-saffron" />
          </div>
          <p className="mx-auto mt-5 max-w-2xl font-serif text-lg leading-relaxed text-white/90">{t.corpusText}</p>
          <ul className="mx-auto mt-8 grid max-w-2xl gap-5 sm:grid-cols-2">
            {t.corpusOptions.map((o) => (
              <li key={o.label} className="rounded-2xl border-2 border-saffron bg-white/10 px-6 py-7">
                <p className="text-sm font-bold uppercase tracking-wider text-saffron [html[lang='ta']_&]:tracking-normal">{o.label}</p>
                <p className="mt-2 font-display text-5xl font-semibold leading-none text-white">{o.value}</p>
              </li>
            ))}
          </ul>
          <Link
            href={href('/sevas')}
            className="group mt-8 inline-flex items-center gap-2 rounded-md bg-saffron px-7 py-3 font-semibold text-charcoal transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
          >
            {t.corpusCta}
            <Arrow />
          </Link>
        </div>
      </section>

      {/* 10. Seva Samiti */}
      <section aria-labelledby="trust-title" className={`bg-white ${sectionPad}`}>
        <div className="mx-auto max-w-3xl px-4 text-center lg:px-8">
          <h2 id="trust-title" className="font-display text-3xl font-semibold leading-tight text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.3]">{t.trustTitle}</h2>
          <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-saffron" />
            <Flame className="text-saffron" />
            <span className="h-px w-12 bg-saffron" />
          </div>
          <p className="mt-6 font-serif text-lg leading-relaxed text-charcoal">{t.trustText}</p>
          <p className="mt-4 inline-block rounded-full bg-rose px-4 py-2 text-sm font-bold text-maroon">{t.trustReg}</p>
        </div>
      </section>

      {/* 11. Visit */}
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

      {/* 12. Continue exploring */}
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