import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import DonationCalendarCard from '@/components/donations/DonationCalendarCard';
import type { DonationFund } from '@/type/donation';
import { getDictionary } from '@/lib/dictionary';
import { rupees } from '@/lib/format';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = true;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

// Back link target per category (your real list routes)
const LIST_PATH: Record<string, string> = {
  donation: '/donate/annadhanam-corpus',
  corpus: '/donate/annadhanam-corpus',
  ashram: '/donate/ashram-donation',
};

function getImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const origin = API_BASE.replace(/\/api\/v1\/?$/, '');
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

function formatDisplayDate(d?: string | null): string {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

// One shared request. Tries the single-fund route, then falls back to the list.
const getFund = cache(async (slug: string): Promise<DonationFund | null> => {
  const key = decodeURIComponent(slug);

  try {
    const res = await fetch(`${API_BASE}/donate/funds/${encodeURIComponent(key)}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.fund) return data.fund as DonationFund;
    }
  } catch (err) {
    console.error('Single donation fund request failed:', err);
  }

  try {
    const res = await fetch(`${API_BASE}/donate/funds`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const list: DonationFund[] = Array.isArray(data?.funds) ? data.funds : [];
    return list.find((f) => f.slug === key || String(f.id) === key) || null;
  } catch (err) {
    console.error('Donation fund list fallback failed:', err);
    return null;
  }
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const fund = await getFund(slug);
  if (!fund) return {};
  const t = getDictionary(locale);
  const title = locale === 'ta' ? fund.title_ta || fund.title_en : fund.title_en;
  return { title: `${title} | ${t.site.name}` };
}

export default async function DonationDetailPage({ params }: Params) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const fund = await getFund(slug);
  if (!fund) notFound();

  const dict = getDictionary(locale);
  const isTa = locale === 'ta';
  const tr = (en: string, ta: string) => (isTa ? ta : en);
  const href = (p: string) => `/${locale}${p}`;

  const isCorpus = fund.category === 'corpus';
  const isAshram = fund.category === 'ashram';
  const name = isTa ? fund.title_ta || fund.title_en : fund.title_en;
  const desc = isTa ? fund.description_ta || fund.description_en : fund.description_en;
  const img = getImageUrl(fund.image_url);
  const listHref = href(LIST_PATH[fund.category] || '/donate/annadhanam-corpus');
  const listLabel = isAshram ? tr('Ashram Donations', 'ஆசிரம நன்கொடைகள்') : tr('Donations', 'நன்கொடைகள்');

  const kindLabel = isCorpus
    ? tr('Corpus Fund', 'மூலதன நிதி')
    : isAshram
    ? tr('Ashram', 'ஆசிரமம்')
    : tr('Donation List', 'நன்கொடை பட்டியல்');

  const isOpen = fund.price_type === 'custom' || !(Number(fund.amount) > 0);
  const openLabel = isCorpus ? tr('Part Payment', 'பகுதி கட்டணம்') : tr('Yathashakti', 'யதாசக்தி');
  const priceText = isOpen ? openLabel : rupees(fund.amount);

  let whenText = tr('Open throughout the year', 'ஆண்டு முழுவதும்');
  if (fund.recurrence_type === 'annual') {
    whenText = fund.event_date
      ? `${tr('Annual Occasion', 'விசேஷ நாள்')}: ${formatDisplayDate(fund.event_date)}`
      : tr('Annual Occasion (date to be announced)', 'வருடாந்திர விசேஷ நாள் (தேதி விரைவில்)');
  } else if (fund.recurrence_type === 'monthly_tithi') {
    whenText = `${tr('Monthly', 'மாதாந்திர')} ${fund.tithi_trigger || ''}`.trim();
    if (fund.event_date) whenText += ` • ${tr('Next', 'அடுத்த நாள்')}: ${formatDisplayDate(fund.event_date)}`;
  }

  const paragraphs = desc ? desc.split('\n').filter((p) => p.trim().length > 0) : [];
  const [lead, ...rest] = paragraphs;

  return (
    <main className="bg-white pb-24 text-charcoal lg:pb-16">
      {/* 1. Header */}
      <section className="border-b border-sand bg-cream/50">
        <div className="mx-auto max-w-7xl px-4 pb-8 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          <nav aria-label="breadcrumb" className="text-xs font-semibold text-charcoal/60">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href={href('')} className="hover:text-maroon hover:underline">{dict.nav.home}</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={listHref} className="hover:text-maroon hover:underline">{listLabel}</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-bold text-maroon">{name}</li>
            </ol>
          </nav>

          <div className="mt-6 min-w-0">
            <span className="inline-block rounded-sm border border-maroon px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-maroon">
              {kindLabel}
            </span>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight text-maroon sm:text-4xl lg:text-5xl [html[lang='ta']_&]:leading-[1.3]">
              {name}
            </h1>

            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4 border-t border-sand pt-5">
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal/55">
                  {tr('Donation Amount', 'நன்கொடைத் தொகை')}
                </dt>
                <dd className="mt-1 font-display text-xl font-semibold text-charcoal">{priceText}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal/55">
                  {tr('When', 'எப்போது')}
                </dt>
                <dd className="mt-1 font-display text-lg font-semibold text-charcoal">{whenText}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* 2. Image, full description and calendar */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="space-y-8 lg:col-span-7">
            {img ? (
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-sand bg-cream">
                <img src={img} alt={name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex aspect-[16/10] w-full items-center justify-center rounded-md border border-sand bg-gradient-to-br from-cream to-sand/50">
                <span className="font-display text-2xl font-semibold uppercase tracking-[0.25em] text-charcoal/30">
                  {kindLabel}
                </span>
              </div>
            )}

            <div>
              <h2 className="border-l-4 border-saffron pl-4 font-display text-2xl font-semibold text-maroon sm:text-3xl">
                {tr('About this fund', 'இந்த நிதியைப் பற்றி')}
              </h2>

              <div className="mt-6 space-y-4 font-serif text-base leading-relaxed text-charcoal/85">
                {lead ? (
                  <>
                    <p className="text-lg font-medium text-charcoal">{lead}</p>
                    {rest.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </>
                ) : (
                  <p className="italic text-charcoal/60">
                    {tr('Details will be updated soon.', 'விவரங்கள் விரைவில் புதுப்பிக்கப்படும்.')}
                  </p>
                )}
              </div>
            </div>
          </div>

          <aside id="donate" className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <DonationCalendarCard fund={fund} locale={locale} />
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}