import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CampList from '@/components/CampList';
import { getDictionary } from '@/lib/dictionary';
import { CAMP_GOOGLE_FORM } from '@/data/camps';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: `${t.camps.meta.title} | ${t.site.name}`,
    description: t.camps.meta.description,
  };
}

// Hero photo: apps/web/public/images/hero-bg.jpg
// On desktop the photo fills the right two thirds of the banner, so Swamiji stays on the right and the text sits on the dark left side.
// BG_POSITION decides which part of the photo is visible: first number = left/right (0% left edge, 100% right edge),
// second number = up/down (0% top, 100% bottom). Raise the second number to show more of the lower part (Swamiji).
const BG_POSITION = '50% 70%';
// On phones the photo fills the whole banner; this keeps Swamiji in the middle.
const BG_POSITION_MOBILE = '46% 65%';

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

export default async function CampsPage({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.camps;
  const href = (p: string) => `/${locale}${p}`;

  return (
    <main>
      {/* 1. Hero: the hero-bg.jpg photo as the background, with the title and buttons on the dark left side */}
      <section aria-labelledby="camps-title" className="relative isolate overflow-hidden bg-charcoal text-white">
        {/* Photo: whole banner on phones, right two thirds on desktop (the left side stays plain dark for the text) */}
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-cover bg-no-repeat lg:hidden" style={{ backgroundImage: "url('/images/hero-bg.jpg')", backgroundPosition: BG_POSITION_MOBILE }} />
        <div aria-hidden="true" className="absolute inset-y-0 left-1/3 right-0 -z-20 hidden bg-cover bg-no-repeat lg:block" style={{ backgroundImage: "url('/images/hero-bg.jpg')", backgroundPosition: BG_POSITION }} />

        {/* Readability layers. Phones: the whole photo is darkened. Desktop: the photo fades into the dark left side. */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-charcoal/65 lg:hidden" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-charcoal from-33% via-charcoal/60 via-50% to-charcoal/0 to-75% lg:block" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal/50 via-transparent to-charcoal/30" />

        <nav aria-label={t.crumbLabel} className="mx-auto max-w-7xl px-4 pt-6 text-sm text-white/80 lg:px-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href={href('')} className="underline-offset-4 hover:text-white hover:underline">{dict.nav.home}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-white">{dict.nav.camps}</li>
          </ol>
        </nav>

        <div className="mx-auto flex max-w-7xl items-center px-4 pb-24 pt-10 sm:pb-28 lg:min-h-[520px] lg:px-8 lg:pb-32">
          <div className="mx-auto w-full min-w-0 max-w-2xl text-center lg:mx-0 lg:max-w-[40rem] lg:text-left">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-saffron/70 bg-charcoal/50 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm sm:text-base">
              <Flame className="text-saffron" />
              <span>{t.eyebrow}</span>
            </p>
            <h1 id="camps-title" className="animate-fade-up mt-5 font-display text-5xl font-semibold leading-[1.1] !text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)] motion-reduce:animate-none sm:text-6xl lg:text-7xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-4xl [html[lang='ta']_&]:sm:text-5xl [html[lang='ta']_&]:lg:text-6xl">{t.title}</h1>
            <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3 lg:justify-start">
              <span className="h-px w-14 bg-saffron" />
              <span className="h-2 w-2 rotate-45 bg-saffron" />
              <span className="h-px w-14 bg-saffron" />
            </div>
            <p className="mt-5 font-serif text-lg leading-relaxed text-white/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)] sm:text-xl">{t.intro}</p>

            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <a href="#camp-list" className="group inline-flex items-center gap-2 rounded-full bg-saffron px-6 py-2.5 font-semibold text-charcoal transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {t.listLabel}
                <Arrow />
              </a>
              <a href={CAMP_GOOGLE_FORM} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border-2 border-white/70 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-white hover:text-maroon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {t.googleCta}<span className="sr-only"> ({t.newTab})</span>
              </a>
            </div>
          </div>
        </div>

        {/* Soft wave into the white section below */}
        <svg aria-hidden="true" viewBox="0 0 1440 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-8 w-full text-white sm:h-10">
          <path d="M0 40V18C240 -2 480 -2 720 14S1200 34 1440 12V40Z" fill="currentColor" />
        </svg>
      </section>

      {/* 2. Camp list: kind chips, cards and the registration panel */}
      <section aria-label={t.listLabel} className="bg-white pb-16 pt-6 sm:pb-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <CampList t={t} locale={locale} />
        </div>
      </section>

      {/* 3. Help */}
      <section aria-labelledby="help-title" className="bg-saffron py-10 text-charcoal sm:py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center lg:flex-row lg:justify-between lg:px-8 lg:text-left">
          <div className="max-w-2xl">
            <h2 id="help-title" className="font-display text-3xl font-semibold leading-tight !text-charcoal sm:text-4xl">{t.helpTitle}</h2>
            <p className="mt-2 text-lg">{t.helpText}</p>
          </div>
          <Link
            href={href('/contact')}
            className="group inline-flex items-center gap-2 rounded-md bg-charcoal px-7 py-3 font-semibold text-white transition-colors hover:bg-maroon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
          >
            {t.helpCta}
            <Arrow />
          </Link>
        </div>
      </section>
    </main>
  );
}
