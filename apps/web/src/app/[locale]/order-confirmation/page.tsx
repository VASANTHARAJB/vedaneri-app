import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ConfirmationView from '@/components/cart/ConfirmationView';
import ShopHero from '@/components/cart/ShopHero';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: `${t.shop.confirmPageTitle} | ${t.site.name}`, robots: { index: false } };
}

export default async function Page({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.shop;
  return (
    <main>
      <ShopHero
        title={t.confirmPageTitle}
        crumbLabel={t.crumbLabel}
        crumbs={[{ label: dict.nav.home, href: `/${locale}` }, { label: t.cartTitle, href: `/${locale}/cart` }, { label: t.confirmPageTitle }]}
        steps={t.steps}
        current={3}
      />
      <section className="bg-white pb-16 pt-4 sm:pb-20">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <ConfirmationView t={t} locale={locale} />
        </div>
      </section>
    </main>
  );
}
