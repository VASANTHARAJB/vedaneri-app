import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import VideoLibrary from '@/components/media/VideoLibrary';
import MediaHero from '@/components/media/MediaHero';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: `${t.video.meta.title} | ${t.site.name}`, description: t.video.meta.description };
}

// Published videos from the CMS. If the API is down the page still opens, with zero counts.
async function loadCounts() {
  try {
    const res = await fetch(`${API_BASE}/discover/video`, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const items: { kind: 'single' | 'series'; class_count?: number }[] = (await res.json()).items || [];
    const series = items.filter((i) => i.kind === 'series');
    const singles = items.length - series.length;
    const classes = series.reduce((n, s) => n + (s.class_count || 0), 0);
    return { videos: singles + classes, series: series.length };
  } catch {
    return { videos: 0, series: 0 };
  }
}

export default async function Page({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.video;
  const c = await loadCounts();
  // Duration is not stored in the CMS, so the "hours" figure is left out.
  const stats = [
    { value: String(c.videos), label: t.statItems },
    { value: String(c.series), label: t.statSeries },
  ];

  return (
    <main>
      <MediaHero
        kind="video"
        home={dict.nav.home}
        homeHref={`/${locale}`}
        current={dict.nav.video}
        crumbLabel={t.crumbLabel}
        eyebrow={t.eyebrow}
        title={t.title}
        intro={t.intro}
        stats={stats}
      />
      <section aria-label={t.title} className="bg-white pb-16 pt-6 sm:pb-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <VideoLibrary t={t} locale={locale} />
        </div>
      </section>
    </main>
  );
}