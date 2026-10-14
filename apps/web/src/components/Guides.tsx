import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';
import Reveal from './Reveal';
import SectionTitle from './SectionTitle';

// Photos: apps/web/public/images/acharya-1.jpg, acharya-2.jpg, acharya-3.jpg (800x800)
const FALLBACK = 'linear-gradient(180deg, #F3E4E1 0%, #7A1C1C 100%)';

export default function Guides({ locale, t }: { locale: Locale; t: Dictionary['guides'] }) {
  const [first, ...rest] = t.items;

  return (
    <section aria-labelledby="guides-title" className="bg-[#FAF7F2] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionTitle id="guides-title" title={t.title} subtitle={t.subtitle} />

        {/* 1st Top Lead Acharya: Prominent Featured Card */}
        {first && (
          <div className="mx-auto mt-14 max-w-4xl">
            <Reveal delay={100}>
              <article className="group relative overflow-hidden rounded-2xl border border-amber-900/10 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-8">
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-saffron to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />

                <div className="grid items-center gap-8 md:grid-cols-[280px_1fr] lg:gap-10">
                  {/* Temple Arch Portrait */}
                  <div className="relative mx-auto w-full max-w-[260px]">
                    <div
                      aria-hidden="true"
                      className="absolute -inset-2 rounded-t-[5.5rem] rounded-b-2xl border border-saffron/30 transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="relative aspect-[4/4.5] overflow-hidden rounded-t-[5rem] rounded-b-xl border-2 border-saffron/60 bg-rose shadow-inner">
                      <div
                        role="img"
                        aria-label={first.name}
                        className="h-full w-full bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                        style={{ backgroundImage: `url('/images/acharya-1.jpg'), ${FALLBACK}` }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-col text-center md:text-left">
                    <div className="inline-flex items-center gap-1.5 self-center rounded-full border border-saffron/40 bg-[#FFF9F0] px-3.5 py-1 text-[0.7rem] font-bold uppercase tracking-widest text-maroon md:self-start">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-saffron" />
                      <span>{first.role}</span>
                    </div>

                    <h3 className="mt-3 font-serif text-2xl font-bold tracking-tight text-maroon sm:text-3xl">
                      {first.name}
                    </h3>

                    <div aria-hidden="true" className="my-3 flex items-center justify-center gap-2 md:justify-start">
                      <span className="h-px w-8 bg-saffron/50" />
                      <span className="h-1.5 w-1.5 rotate-45 bg-saffron" />
                      <span className="h-px w-8 bg-saffron/50" />
                    </div>

                    <p className="text-sm leading-relaxed text-charcoal/80 sm:text-base">
                      {first.text}
                    </p>

                    <div className="mt-6 flex flex-col gap-4 rounded-xl border border-amber-900/10 bg-[#FAF7F2]/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[0.68rem] font-bold uppercase tracking-wider text-charcoal/60">
                          {t.specLabel}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-charcoal">
                          {first.spec}
                        </p>
                      </div>

                      <Link
                        href={`/${locale}/video`}
                        className="group/link inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-maroon/20 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-maroon transition-all duration-300 hover:border-maroon hover:bg-maroon hover:text-white"
                      >
                        <span>{t.viewClasses}</span>
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
                          className="transition-transform duration-300 group-hover/link:translate-x-1"
                        >
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>
          </div>
        )}

        {/* 2nd Row: Remaining 2 Acharyas (2-Column Grid) */}
        <div className="mx-auto mt-10 grid max-w-5xl gap-8 md:grid-cols-2 lg:gap-10">
          {rest.map((a, idx) => {
            const n = idx + 1;
            return (
              <Reveal key={a.name} delay={n * 120} className="h-full">
                <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-amber-900/10 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl sm:p-7">
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-saffron to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />

                  <div className="relative mx-auto w-full max-w-[240px]">
                    <div
                      aria-hidden="true"
                      className="absolute -inset-2 rounded-t-[5.5rem] rounded-b-2xl border border-saffron/30 transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="relative aspect-[4/4.5] overflow-hidden rounded-t-[5rem] rounded-b-xl border-2 border-saffron/60 bg-rose shadow-inner">
                      <div
                        role="img"
                        aria-label={a.name}
                        className="h-full w-full bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                        style={{ backgroundImage: `url('/images/acharya-${n + 1}.jpg'), ${FALLBACK}` }}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-1 flex-col text-center">
                    <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-saffron/40 bg-[#FFF9F0] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-widest text-maroon">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-saffron" />
                      <span>{a.role}</span>
                    </div>

                    <h3 className="mt-3 font-serif text-2xl font-bold tracking-tight text-maroon">
                      {a.name}
                    </h3>

                    <div aria-hidden="true" className="my-3 flex items-center justify-center gap-2">
                      <span className="h-px w-8 bg-saffron/50" />
                      <span className="h-1.5 w-1.5 rotate-45 bg-saffron" />
                      <span className="h-px w-8 bg-saffron/50" />
                    </div>

                    <p className="text-sm leading-relaxed text-charcoal/80">
                      {a.text}
                    </p>

                    <div className="mt-auto pt-6">
                      <div className="rounded-xl border border-amber-900/10 bg-[#FAF7F2]/80 p-3.5 text-left">
                        <p className="text-[0.68rem] font-bold uppercase tracking-wider text-charcoal/60">
                          {t.specLabel}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-charcoal">
                          {a.spec}
                        </p>
                      </div>

                      <Link
                        href={`/${locale}/video`}
                        className="group/link mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-maroon/20 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-maroon transition-all duration-300 hover:border-maroon hover:bg-maroon hover:text-white"
                      >
                        <span>{t.viewClasses}</span>
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
                          className="transition-transform duration-300 group-hover/link:translate-x-1"
                        >
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}