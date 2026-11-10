import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Reveal from '@/components/Reveal';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const FILES = API_BASE.replace(/\/api\/v1\/?$/, '');
const ISSUES_URL = `${API_BASE}/magazine-issues`;

type Issue = {
  id: number;
  title_en: string; title_ta: string | null;
  label_en: string | null; label_ta: string | null;
  description_en: string | null; description_ta: string | null;
  issue_date: string;
  cover_url: string | null;
  pdf_url: string;
  pdf_size: number | null;
};

// The text on this page, in both languages
const TEXT = {
  en: {
    title: 'Magazine issues',
    subtitle: 'Read the magazine online, or download a copy.',
    read: 'Read the magazine',
    size: 'PDF',
    empty: 'No issues have been published yet. Please visit again soon.',
    home: 'Home',
    unavailable: 'The issues could not be loaded right now. Please try again in a little while.',
  },
  ta: {
    title: 'இதழ்கள்',
    subtitle: 'இதழை இணையத்தில் படிக்கலாம்; பிரதியைப் பதிவிறக்கமும் செய்யலாம்.',
    read: 'இதழைப் படிக்க',
    size: 'PDF',
    empty: 'இதழ்கள் இன்னும் வெளியிடப்படவில்லை. சிறிது நாள் கழித்து மீண்டும் வருக.',
    home: 'முகப்பு',
    unavailable: 'இதழ்களை இப்போது ஏற்ற இயலவில்லை. சிறிது நேரம் கழித்து முயலவும்.',
  },
} as const;

// The issues published in the CMS. null means the API could not be reached.
async function loadIssues(): Promise<Issue[] | null> {
  try {
    const res = await fetch(ISSUES_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[magazine-issues] fetch failed ${res.status} ${ISSUES_URL}`);
      return null;
    }
    const d = await res.json();
    return Array.isArray(d.issues) ? d.issues : [];
  } catch (e: any) {
    console.error(`[magazine-issues] fetch error ${ISSUES_URL}:`, e?.cause?.code || e?.message || e);
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  const t = TEXT[locale as 'en' | 'ta'];
  return { title: `${t.title} | ${dict.site.name}`, description: t.subtitle };
}

const fmtSize = (n?: number | null) => (n ? (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : '');

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Flame({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M12 2c.6 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4.4.4 1.2 1 1.8 1.7 2C11.3 7.7 11.6 5 12 2z" />
    </svg>
  );
}

export default async function MagazineIssuesPage({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const lang = locale as 'en' | 'ta';
  const t = TEXT[lang];
  const issues = await loadIssues();
  const ta = lang === 'ta';
  const pickText = (en: string | null, tamil: string | null) => (ta && tamil && tamil.trim() ? tamil : en || '');

  return (
    <main>
      <section aria-labelledby="issues-title" className="relative isolate overflow-hidden bg-gradient-to-b from-rose/80 via-white to-white pb-6">
        <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 pt-6 text-sm text-charcoal/80 lg:px-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href={`/${locale}`} className="underline-offset-4 hover:text-maroon hover:underline">{dict.nav.home || t.home}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-maroon">{t.title}</li>
          </ol>
        </nav>
        <div className="mx-auto max-w-3xl px-4 pb-6 pt-8 text-center lg:px-8">
          <h1 id="issues-title" className="font-display text-4xl font-semibold leading-tight text-maroon sm:text-5xl [html[lang='ta']_&]:!leading-[1.3]">{t.title}</h1>
          <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-saffron" />
            <Flame className="text-saffron" />
            <span className="h-px w-12 bg-saffron" />
          </div>
          <p className="mt-5 font-serif text-lg leading-relaxed text-charcoal/85">{t.subtitle}</p>
        </div>
      </section>

      <section aria-label={t.title} className="bg-white py-12 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          {issues === null ? (
            <p role="alert" className="mx-auto max-w-xl rounded-2xl border-2 border-saffron/60 bg-white p-6 text-center font-serif text-lg text-charcoal">{t.unavailable}</p>
          ) : issues.length === 0 ? (
            <p className="mx-auto max-w-xl rounded-2xl border-2 border-saffron/60 bg-white p-6 text-center font-serif text-lg text-charcoal">{t.empty}</p>
          ) : (
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {issues.map((i, n) => {
                const title = pickText(i.title_en, i.title_ta);
                const label = pickText(i.label_en, i.label_ta);
                const desc = pickText(i.description_en, i.description_ta);
                return (
                  <li key={i.id}>
                    <Reveal delay={(n % 3) * 120} className="h-full">
                      <article className="flex h-full flex-col overflow-hidden rounded-2xl border-t-4 border-saffron bg-white shadow-lg ring-1 ring-rose">
                        <a href={`${FILES}${i.pdf_url}`} target="_blank" rel="noopener noreferrer" aria-label={`${t.read}: ${title}`} className="block bg-rose/50 p-6">
                          {i.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`${FILES}${i.cover_url}`} alt={title} loading="lazy" className="mx-auto aspect-[3/4] w-full max-w-[16rem] rounded-lg object-cover shadow-xl ring-4 ring-white" />
                          ) : (
                            <div className="mx-auto flex aspect-[3/4] w-full max-w-[16rem] items-center justify-center rounded-lg bg-maroon p-4 text-center font-display text-2xl font-semibold text-white shadow-xl ring-4 ring-white">{title}</div>
                          )}
                        </a>
                        <div className="flex flex-1 flex-col p-6">
                          {label && <p className="text-sm font-bold uppercase tracking-wider text-saffron [html[lang='ta']_&]:tracking-normal">{label}</p>}
                          <h2 className="mt-1 font-display text-2xl font-semibold leading-tight text-maroon [html[lang='ta']_&]:!leading-[1.4]">{title}</h2>
                          {desc && <p className="mt-2 font-serif leading-relaxed text-charcoal/85">{desc}</p>}
                          <div className="mt-auto pt-5">
                            <a
                              href={`${FILES}${i.pdf_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex items-center gap-2 rounded-md bg-maroon px-6 py-3 font-semibold text-white transition-colors hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
                            >
                              {t.read}
                              <Arrow />
                            </a>
                            {i.pdf_size ? <p className="mt-2 text-xs text-charcoal/70">{t.size} · {fmtSize(i.pdf_size)}</p> : null}
                          </div>
                        </div>
                      </article>
                    </Reveal>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}