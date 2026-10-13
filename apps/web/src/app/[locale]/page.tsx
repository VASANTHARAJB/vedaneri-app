import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return (
    <main className="p-8">
      <h1 className="font-serif text-3xl text-maroon">{t.site.name}</h1>
      <p className="mt-2">Home page: built in the first screen step.</p>
    </main>
  );
}
