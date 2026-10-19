import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AudioLibrary from '@/components/media/AudioLibrary';
import MediaHero from '@/components/media/MediaHero';
import { AUDIO, SERIES } from '@/data/media';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: `${t.audio.meta.title} | ${t.site.name}`, description: t.audio.meta.description };
}

export default async function Page({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.audio;
  const hours = Math.round((AUDIO.reduce((s, a) => s + a.duration, 0) / 3600) * 10) / 10;
  const stats = [
    { value: String(AUDIO.length), label: t.statItems },
    { value: String(hours), label: t.statHours },
    { value: String(SERIES.filter((s) => s.key !== 'events').length), label: t.statSeries },
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
