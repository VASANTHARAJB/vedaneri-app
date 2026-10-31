import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AudioLibrary from '@/components/media/AudioLibrary';
import MediaHero from '@/components/media/MediaHero';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: `${t.audio.meta.title} | ${t.site.name}`, description: t.audio.meta.description };
}

// Published audio from the CMS. If the API is down the page still opens, with zero counts.
async function loadCounts() {
  try {
    const res = await fetch(`${API_BASE}/discover/audio`, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const items: { kind: 'single' | 'series'; class_count?: number }[] = (await res.json()).items || [];
    const series = items.filter((i) => i.kind === 'series');
    const singles = items.length - series.length;
    const classes = series.reduce((n, s) => n + (s.class_count || 0), 0);
    return { items: singles + classes, series: series.length };
  } catch {
    return { items: 0, series: 0 };
  }
}

export default async function Page({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.audio;
  const c = await loadCounts();
  // Duration is not stored in the CMS, so the "hours" figure is left out.
  const stats = [
    { value: String(c.items), label: t.statItems },
    { value: String(c.series), label: t.statSeries },
  ];

  return (
    <main>
      <MediaHero
        kind="audio"
        home={dict.nav.home}
        homeHref={`/${locale}`}
        current={dict.nav.audio}
        crumbLabel={t.crumbLabel}
        eyebrow={t.eyebrow}
        title={t.title}
        intro={t.intro}
        stats={stats}
      />
      <section aria-label={t.title} className="bg-white pb-16 pt-6 sm:pb-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <AudioLibrary t={t} locale={locale} />
        </div>
      </section>
    </main>
  );
}