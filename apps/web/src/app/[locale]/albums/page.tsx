import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AlbumGallery from '@/components/media/AlbumGallery';
import MediaHero from '@/components/media/MediaHero';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: `${t.albums.meta.title} | ${t.site.name}`, description: t.albums.meta.description };
}

// Published albums from the CMS. If the API is down the page still opens, with zero counts.
async function loadCounts() {
  try {
    const res = await fetch(`${API_BASE}/discover/albums`, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const items: { photo_count?: number }[] = (await res.json()).items || [];
    return { albums: items.length, photos: items.reduce((n, a) => n + (a.photo_count || 0), 0) };
  } catch {
    return { albums: 0, photos: 0 };
  }
}

export default async function Page({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.albums;
  const c = await loadCounts();
  const stats = [
    { value: String(c.photos), label: t.statItems },
    { value: String(c.albums), label: t.statAlbums },
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