import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SevaList from '@/components/SevaList';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ view?: string | string[] }>;
};

export interface Offering {
  id: string | number;
  slug: string;
  title_en: string;
  title_ta: string;
  description_en: string;
  description_ta: string;
  amount: number;
  price_type: 'fixed' | 'custom';
  category: 'seva' | 'corpus';
  status: 'published' | 'draft';
  image_url?: string;
}

// Fetch live published items from MariaDB API
async function getLiveOfferings(): Promise<Offering[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  try {
    const res = await fetch(`${apiUrl}/offerings`, {
      cache: 'no-store', // Always fetch fresh database records without stale caching
    });

    if (!res.ok) {
      console.error(`Failed to fetch offerings from database. Status: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const allItems: Offering[] = data.sevas || [];

    // Filter only published live offerings
    return allItems.filter((item) => item.status === 'published');
  } catch (err) {
    console.error('Error connecting to database API for offerings:', err);
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: `${t.sevas.meta.title} | ${t.site.name}`,
    description: t.sevas.meta.description,
  };
}

const BG_POSITION = '50% 70%';
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

export default async function SevasPage({ params, searchParams }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.sevas;
  const href = (p: string) => `/${locale}${p}`;

  // Which list to show: sevas (default) or corpus funds, chosen by the two hero buttons
  const sp = (await searchParams) || {};
  const rawView = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  const sevaLabel = locale === 'ta' ? 'சேவை பட்டியல்' : 'Seva List';
  const corpusLabel = locale === 'ta' ? 'மூலதன நிதி' : 'Corpus Fund';

  // Direct Database Fetch
  const liveOfferings = await getLiveOfferings();

  // The open tab: what the banner button asked for, otherwise Seva List, or Corpus Fund when there are no sevas
  const sevaCount = liveOfferings.filter((o) => o.category !== 'corpus').length;
  const view: 'seva' | 'corpus' =
    rawView === 'corpus' ? 'corpus' : rawView === 'seva' ? 'seva' : sevaCount > 0 ? 'seva' : 'corpus';

  const btnBase =
    'group inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  const btnOn = 'bg-saffron text-charcoal hover:bg-white';
  const btnOff = 'border-2 border-white/70 text-white hover:bg-white hover:text-maroon';

  return (
    <main>
      {/* 1. Hero: the hero-bg.jpg photo as the background */}
      <section aria-labelledby="sevas-title" className="relative isolate overflow-hidden bg-charcoal text-white">
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-cover bg-no-repeat lg:hidden" style={{ backgroundImage: "url('/images/hero-bg.jpg')", backgroundPosition: BG_POSITION_MOBILE }} />
        <div aria-hidden="true" className="absolute inset-y-0 left-1/3 right-0 -z-20 hidden bg-cover bg-no-repeat lg:block" style={{ backgroundImage: "url('/images/hero-bg.jpg')", backgroundPosition: BG_POSITION }} />

        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-charcoal/65 lg:hidden" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-charcoal from-33% via-charcoal/60 via-50% to-charcoal/0 to-75% lg:block" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal/50 via-transparent to-charcoal/30" />

        <nav aria-label={t.crumbLabel} className="mx-auto max-w-7xl px-4 pt-6 text-sm text-white/80 lg:px-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href={href('')} className="underline-offset-4 hover:text-white hover:underline">{dict.nav.home}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-white">{dict.nav.seva}</li>
          </ol>
        </nav>

        <div className="mx-auto flex max-w-7xl items-center px-4 pb-24 pt-10 sm:pb-28 lg:min-h-[520px] lg:px-8 lg:pb-32">
          <div className="mx-auto w-full min-w-0 max-w-2xl text-center lg:mx-0 lg:max-w-[40rem] lg:text-left">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-saffron/70 bg-charcoal/50 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm sm:text-base">
              <Flame className="text-saffron" />
              <span>{t.eyebrow}</span>
            </p>
            <h1 id="sevas-title" className="animate-fade-up mt-5 font-display text-5xl font-semibold leading-[1.1] !text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)] motion-reduce:animate-none sm:text-6xl lg:text-7xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-4xl [html[lang='ta']_&]:sm:text-5xl [html[lang='ta']_&]:lg:text-6xl">
              {t.title}
            </h1>
            <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3 lg:justify-start">
              <span className="h-px w-14 bg-saffron" />
              <span className="h-2 w-2 rotate-45 bg-saffron" />
              <span className="h-px w-14 bg-saffron" />
            </div>
            <p className="mt-5 font-serif text-lg leading-relaxed text-white/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)] sm:text-xl">
              {t.intro}
            </p>

            {/* Two buttons: each one opens its own tab below */}
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start" role="group" aria-label={locale === 'ta' ? 'வகை' : 'Category'}>
              <Link
                href={`${href('/sevas')}#seva-list`}
                scroll
                aria-current={view === 'seva' ? 'true' : undefined}
                className={`${btnBase} ${view === 'seva' ? btnOn : btnOff}`}
              >
                {sevaLabel}
                <Arrow />
              </Link>
              <Link
                href={`${href('/sevas')}?view=corpus#seva-list`}
                scroll
                aria-current={view === 'corpus' ? 'true' : undefined}
                className={`${btnBase} ${view === 'corpus' ? btnOn : btnOff}`}
              >
                {corpusLabel}
                <Arrow />
              </Link>
            </div>
          </div>
        </div>

        <svg aria-hidden="true" viewBox="0 0 1440 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-8 w-full text-white sm:h-10">
          <path d="M0 40V18C240 -2 480 -2 720 14S1200 34 1440 12V40Z" fill="currentColor" />
        </svg>
      </section>

      {/* 2. Seva List / Corpus Fund tabs: Live Database Offerings */}
      <section id="seva-list" aria-label={view === 'corpus' ? corpusLabel : sevaLabel} className="bg-white pb-16 pt-6 sm:pb-20 scroll-mt-10">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <SevaList key={view} t={t} locale={locale} initialOfferings={liveOfferings} initialCategory={view} />
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