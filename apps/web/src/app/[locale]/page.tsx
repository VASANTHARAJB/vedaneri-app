import { notFound } from 'next/navigation';
import AudioBar from '@/components/AudioBar';
import CalendarSupport from '@/components/CalendarSupport';
import Festival from '@/components/Festival';
import Guides from '@/components/Guides';
import Hero from '@/components/Hero';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';
import Founder from '@/components/Founder';
import QuickAccess from '@/components/QuickAccess';
import Quotes from '@/components/Quotes';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return (
    <main>
      <Hero locale={locale} t={t.hero} />
      <Founder locale={locale} t={t.founder} />
      <Guides locale={locale} t={t.guides} />
      <Festival locale={locale} t={t.festival} />
      <CalendarSupport locale={locale} calendar={t.calendar} support={t.support} />
      <QuickAccess locale={locale} t={t.quick} />
      <Quotes t={t.quotes} />
      <AudioBar t={t.audioBar} />
    </main>
  );
}
