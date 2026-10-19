import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AlbumGallery from '@/components/media/AlbumGallery';
import MediaHero from '@/components/media/MediaHero';
import { ALBUMS, PHOTOS } from '@/data/media';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: `${t.albums.meta.title} | ${t.site.name}`, description: t.albums.meta.description };
}

export default async function Page({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.albums;
  const stats = [
    { value: String(PHOTOS.length), label: t.statItems },
    { value: String(ALBUMS.length), label: t.statAlbums },
    { value: 'JPG', label: t.statFormat },
  ];

  return (
    <main>
      <MediaHero
        kind="album"
        home={dict.nav.home}
        homeHref={`/${locale}`}
        current={dict.nav.albums}
        crumbLabel={t.crumbLabel}
        eyebrow={t.eyebrow}
        title={t.title}
        intro={t.intro}
        stats={stats}
      />
      <section aria-label={t.title} className="bg-white pb-16 pt-6 sm:pb-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <AlbumGallery t={t} locale={locale} />
        </div>
      </section>
    </main>
  );
}
