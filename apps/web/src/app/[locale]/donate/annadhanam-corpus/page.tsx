import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DonationList from '@/components/DonationList';
import type { DonationFund } from '@/type/donation';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

// Published Donation List and Corpus funds from the public donation API
async function getFunds(): Promise<{ funds: DonationFund[]; failed: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/donate/funds?category=donation,corpus`, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`Failed to fetch donation funds. Status: ${res.status}`);
      return { funds: [], failed: true };
    }
    const data = await res.json();
    const list: DonationFund[] = Array.isArray(data.funds) ? data.funds : [];
    return { funds: list.filter((f) => f.category === 'donation' || f.category === 'corpus'), failed: false };
  } catch (err) {
    console.error('Error connecting to the donation API:', err);
    return { funds: [], failed: true };
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: `${locale === 'ta' ? 'நன்கொடைகள் & மூலதன நிதி' : 'Donations & Corpus Funds'} | ${t.site.name}`,
    description:
      locale === 'ta'
        ? 'ஸ்ரீ தட்சிணாமூர்த்தி சேவா சமிதி நன்கொடை மற்றும் மூலதன நிதி திருப்பணிகள்.'
        : 'Donation and corpus funds supporting Sri Dakshinamurti Seva Samiti.',
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

export default async function DonationsPage({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const isTa = locale === 'ta';
  const href = (p: string) => `/${locale}${p}`;

  const { funds, failed } = await getFunds();

  return (
    <main>
      {/* 1. Hero */}
      <section aria-labelledby="donations-title" className="relative isolate overflow-hidden bg-charcoal text-white">
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-cover bg-no-repeat lg:hidden" style={{ backgroundImage: "url('/images/hero-bg.jpg')", backgroundPosition: BG_POSITION_MOBILE }} />
        <div aria-hidden="true" className="absolute inset-y-0 left-1/3 right-0 -z-20 hidden bg-cover bg-no-repeat lg:block" style={{ backgroundImage: "url('/images/hero-bg.jpg')", backgroundPosition: BG_POSITION }} />

        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-charcoal/65 lg:hidden" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-charcoal from-33% via-charcoal/60 via-50% to-charcoal/0 to-75% lg:block" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal/50 via-transparent to-charcoal/30" />

        <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl px-4 pt-6 text-sm text-white/80 lg:px-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href={href('')} className="underline-offset-4 hover:text-white hover:underline">{dict.nav.home}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-white">{isTa ? 'நன்கொடைகள்' : 'Donations'}</li>
          </ol>
        </nav>

        <div className="mx-auto flex max-w-7xl items-center px-4 pb-24 pt-10 sm:pb-28 lg:min-h-[520px] lg:px-8 lg:pb-32">
          <div className="mx-auto w-full min-w-0 max-w-2xl text-center lg:mx-0 lg:max-w-[40rem] lg:text-left">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-saffron/70 bg-charcoal/50 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm sm:text-base">
              <Flame className="text-saffron" />
              <span>{isTa ? 'ஸ்ரீ தட்சிணாமூர்த்தி சேவா சமிதி' : 'Sri Dakshinamurti Seva Samiti'}</span>
            </p>
            <h1 id="donations-title" className="animate-fade-up mt-5 font-display text-5xl font-semibold leading-[1.1] !text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)] motion-reduce:animate-none sm:text-6xl lg:text-7xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-4xl [html[lang='ta']_&]:sm:text-5xl [html[lang='ta']_&]:lg:text-6xl">
              {isTa ? 'நன்கொடைகள் & மூலதன நிதி' : 'Donations & Corpus Funds'}
            </h1>
            <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3 lg:justify-start">
              <span className="h-px w-14 bg-saffron" />
              <span className="h-2 w-2 rotate-45 bg-saffron" />
              <span className="h-px w-14 bg-saffron" />
            </div>
            <p className="mt-5 font-serif text-lg leading-relaxed text-white/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)] sm:text-xl">
              {isTa
                ? 'ஆசிரமத்தின் திருப்பணிகள் மற்றும் எதிர்கால தலைமுறைகளுக்கான நிரந்தர மூலதன நிதிகளுக்கு உங்கள் பங்களிப்பை அளிக்கலாம்.'
                : 'Contribute to the ashram’s activities and to permanent corpus funds that serve future generations.'}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <a href="#donation-list" className="group inline-flex items-center gap-2 rounded-full bg-saffron px-6 py-2.5 font-semibold text-charcoal transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {isTa ? 'நிதிகள் பட்டியல்' : 'View Funds'}
                <Arrow />
              </a>
              <Link href={href('/cart')} className="inline-flex items-center rounded-full border-2 border-white/70 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-white hover:text-maroon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {dict.shop.cartTitle}
              </Link>
            </div>
          </div>
        </div>

        <svg aria-hidden="true" viewBox="0 0 1440 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-8 w-full text-white sm:h-10">
          <path d="M0 40V18C240 -2 480 -2 720 14S1200 34 1440 12V40Z" fill="currentColor" />
        </svg>
      </section>

      {/* 2. Donation funds (live from the database) */}
      <section id="donation-list" aria-label={isTa ? 'நிதிகள் பட்டியல்' : 'Donation funds'} className="bg-white pb-16 pt-6 sm:pb-20 scroll-mt-10">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          {failed ? (
            <div className="rounded-md border border-sand bg-white py-16 text-center">
              <p className="font-serif text-lg text-charcoal/70">
                {isTa
                  ? 'நிதிகளை தற்போது ஏற்ற இயலவில்லை. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.'
                  : 'We could not load the donation funds right now. Please try again in a moment.'}
              </p>
            </div>
          ) : (
            <DonationList locale={locale} initialFunds={funds} detailBase="/donate" />
          )}
        </div>
      </section>

      {/* 3. Help */}
      <section aria-labelledby="help-title" className="bg-saffron py-10 text-charcoal sm:py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center lg:flex-row lg:justify-between lg:px-8 lg:text-left">
          <div className="max-w-2xl">
            <h2 id="help-title" className="font-display text-3xl font-semibold leading-tight !text-charcoal sm:text-4xl">
              {isTa ? 'உதவி தேவையா?' : 'Need help with your donation?'}
            </h2>
            <p className="mt-2 text-lg">
              {isTa
                ? 'ரசீதுகள் மற்றும் வங்கிப் பரிவர்த்தனை தகவல்களுக்கு ஆசிரம அலுவலகத்தைத் தொடர்பு கொள்ளவும்.'
                : 'For receipts or bank transfer details, please contact the ashram office.'}
            </p>
          </div>
          <Link
            href={href('/contact')}
            className="group inline-flex items-center gap-2 rounded-md bg-charcoal px-7 py-3 font-semibold text-white transition-colors hover:bg-maroon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal"
          >
            {isTa ? 'ஆசிரமத்தை தொடர்பு கொள்ளவும்' : 'Contact Ashram'}
            <Arrow />
          </Link>
        </div>
      </section>
    </main>
  );
}