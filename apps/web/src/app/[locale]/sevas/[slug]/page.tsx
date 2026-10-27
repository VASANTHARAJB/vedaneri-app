import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getDictionary } from '@/lib/dictionary';
import { rupees } from '@/lib/format';
import { isLocale } from '@/lib/i18n';
import SevaCalendarCard from '@/components/sevas/SevaCalendarCard';

type Params = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = true;

export interface LiveOffering {
  id: string | number;
  slug: string;
  title_en: string;
  title_ta: string;
  display_title_en?: string;
  display_title_ta?: string;
  description_en: string;
  description_ta: string;
  amount: number;
  price_type: 'fixed' | 'custom';
  category: 'seva' | 'corpus';
  status: 'published' | 'draft';
  image_url?: string;
  last_updated?: string;
  // Panchangam & Recurrence properties
  is_event_seva?: boolean;
  recurrence_type?: 'none' | 'annual' | 'monthly_tithi';
  event_date?: string | null;
  tithi_trigger?: string;
  panchangam_tag?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

function getImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const backendOrigin = API_BASE.replace(/\/api\/v1\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${backendOrigin}${cleanPath}`;
}

function formatDisplayDate(d?: string | null): string {
  if (!d) return '';
  const clean = String(d).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return d;
}

// cache() makes generateMetadata and the page share ONE API request.
// Only PUBLISHED offerings are returned, so drafts cannot be opened or booked by URL.
const getLiveOfferingBySlug = cache(async (slug: string): Promise<LiveOffering | null> => {
  try {
    const res = await fetch(`${API_BASE}/offerings`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const sevas: LiveOffering[] = data.sevas || data.offerings || [];
    return (
      sevas.find(
        (item) => item.status === 'published' && (item.slug === slug || String(item.id) === slug)
      ) || null
    );
  } catch (err) {
    console.error('Error fetching seva by slug:', err);
    return null;
  }
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const seva = await getLiveOfferingBySlug(slug);
  if (!seva) return {};
  const t = getDictionary(locale);
  const title = locale === 'ta' ? seva.title_ta || seva.title_en : seva.title_en;
  return { title: `${title} | ${t.site.name}` };
}

/* ---------- Icons ---------- */
const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ea580c]';

function CalendarIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#ea580c]">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function RupeeIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#ea580c]">
      <path d="M6 4h12M6 9h12M6 4c6 0 6 10-1 10h-0l8 6" />
    </svg>
  );
}
function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default async function SevaDetailPage({ params }: Params) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const seva = await getLiveOfferingBySlug(slug);
  if (!seva) notFound();

  const dict = getDictionary(locale);
  const t = dict.sevas;
  const isTa = locale === 'ta';
  const isCorpus = seva.category === 'corpus';

  const name = isTa ? seva.title_ta || seva.title_en : seva.title_en;
  const desc = isTa ? seva.description_ta || seva.description_en : seva.description_en;
  const kindLabel = isCorpus ? (isTa ? 'மூலதன நிதி' : 'Corpus Fund') : (isTa ? 'சேவை பட்டியல்' : 'Seva List');
  const fullImageUrl = getImageUrl(seva.image_url);
  const href = (p: string) => `/${locale}${p}`;

  const paragraphs = desc ? desc.split('\n').filter((p) => p.trim().length > 0) : [];
  const [leadParagraph, ...restParagraphs] = paragraphs;

  // Price display (same labels as the offering cards)
  const isOpenAmount = seva.price_type === 'custom' || !(Number(seva.amount) > 0);
  const openAmountLabel = isCorpus
    ? isTa ? 'பகுதி கட்டணம்' : 'Part Payment'
    : isTa ? 'யதாசக்தி' : 'Yathashakti';
  const priceText = isOpenAmount ? openAmountLabel : rupees(seva.amount);

  // "When" text according to recurrence
  let whenText = isTa ? 'தினசரி காலை & மாலை சங்கல்பம்' : 'Daily Morning & Evening Sankalpam';
  if (seva.recurrence_type === 'annual') {
    whenText = seva.event_date
      ? `${isTa ? 'விசேஷ நாள்' : 'Annual Occasion'}: ${formatDisplayDate(seva.event_date)}`
      : isTa
      ? 'வருடாந்திர விசேஷ நாள் (தேதி விரைவில் அறிவிக்கப்படும்)'
      : 'Annual Occasion (date to be announced)';
  } else if (seva.recurrence_type === 'monthly_tithi') {
    whenText = `${isTa ? 'மாதாந்திர' : 'Monthly'} ${seva.tithi_trigger || 'Tithi'}`;
    if (seva.event_date) {
      whenText += ` • ${isTa ? 'அடுத்த நாள்' : 'Next'}: ${formatDisplayDate(seva.event_date)}`;
    }
  }

  return (
    <main className="bg-white pb-24 lg:pb-16 text-slate-900">
      {/* 1. Header: navigation, title, key facts */}
      <section className="border-b border-[#f0e2c8] bg-gradient-to-b from-[#fff8ec] via-white to-white">
        <div className="mx-auto max-w-7xl px-4 pb-8 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          <Link
            href={href('/sevas')}
            className={`inline-flex items-center gap-1.5 rounded-full text-xs font-bold text-[#3b0d0d] hover:underline sm:hidden ${FOCUS}`}
          >
            <ArrowLeftIcon />
            {dict.nav.seva}
          </Link>

          <nav aria-label="breadcrumb" className="hidden text-xs text-[#8a5a44] sm:block">
            <ol className="flex flex-wrap items-center gap-1.5 font-semibold">
              <li>
                <Link href={href('')} className={`hover:text-[#3b0d0d] hover:underline ${FOCUS}`}>
                  {dict.nav.home}
                </Link>
              </li>
              <li aria-hidden="true"><ChevronRightIcon /></li>
              <li>
                <Link href={href('/sevas')} className={`hover:text-[#3b0d0d] hover:underline ${FOCUS}`}>
                  {dict.nav.seva}
                </Link>
              </li>
              <li aria-hidden="true"><ChevronRightIcon /></li>
              <li aria-current="page" className="font-extrabold text-[#3b0d0d]">{name}</li>
            </ol>
          </nav>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
            <div className="min-w-0">
              <span className="inline-block rounded-full bg-[#fff3df] border border-[#fde68a] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#c2410c]">
                {kindLabel}
              </span>
              <h1 className="mt-3 max-w-3xl font-serif text-3xl font-extrabold leading-tight text-[#3b0d0d] sm:text-4xl lg:text-5xl">
                {name}
              </h1>

              <dl className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff3df] border border-[#fde68a]">
                    <RupeeIcon />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-[#8a5a44]">
                      {t.amountLabel}
                    </dt>
                    <dd className="font-serif text-xl font-bold leading-snug text-[#3b0d0d]">
                      {priceText}
                    </dd>
                  </div>
                </div>

                <div aria-hidden="true" className="hidden h-10 w-px bg-[#f0e2c8] sm:block" />

                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff3df] border border-[#fde68a]">
                    <CalendarIcon />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-[#8a5a44]">
                      {t.whenLabel}
                    </dt>
                    <dd className="font-serif text-base font-bold leading-snug text-[#3b0d0d] sm:text-lg">
                      {whenText}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Story (Left) + Calendar card (Right) */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="space-y-8 lg:col-span-7">
            {fullImageUrl ? (
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl bg-[#fff3df] shadow-sm border border-[#f0e2c8]">
                <img
                  src={fullImageUrl}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-[16/10] w-full items-center justify-center rounded-3xl bg-gradient-to-br from-[#fff3df] to-[#fdebec] text-6xl shadow-sm border border-[#f0e2c8]">
                {isCorpus ? '🏛️' : '🪔'}
              </div>
            )}

            <div>
              <h2 className="font-serif text-2xl font-bold text-[#3b0d0d] sm:text-3xl">
                {t.aboutTitle}
              </h2>
              <div className="mt-2 h-1 w-14 rounded-full bg-[#ea580c]" aria-hidden="true" />

              <div className="mt-6 space-y-4 font-sans text-sm sm:text-base leading-relaxed text-[#5b2a1a]">
                {leadParagraph ? (
                  <>
                    <p className="text-base sm:text-lg font-medium leading-relaxed text-[#3b0d0d]">
                      {leadParagraph}
                    </p>
                    {restParagraphs.map((p, i) => (
                      <p key={i} className="text-sm sm:text-base text-[#5b2a1a]/90">
                        {p}
                      </p>
                    ))}
                  </>
                ) : (
                  <p className="italic text-[#8a5a44]">
                    {isTa ? 'விவரங்கள் விரைவில் புதுப்பிக்கப்படும்.' : t.descriptionEmpty}
                  </p>
                )}
              </div>
            </div>
          </div>

          <aside id="date-selector" className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <SevaCalendarCard seva={seva} locale={locale} />
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}