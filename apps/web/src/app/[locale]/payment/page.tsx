import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PaymentView from '@/components/cart/PaymentView';
import ShopHero from '@/components/cart/ShopHero';
import { getDictionary } from '@/lib/dictionary';
import { parseStream } from '@/lib/cartItem';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }>; searchParams: Promise<{ stream?: string | string[] }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: `${t.shop.paymentTitle} | ${t.site.name}`, robots: { index: false } };
}

export default async function Page({ params, searchParams }: Params) {
  const { locale } = await params;
  const stream = parseStream((await searchParams).stream);
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.shop;
  return (
    <main>
      <ShopHero
        title={t.paymentTitle}
        crumbLabel={t.crumbLabel}
        crumbs={[{ label: dict.nav.home, href: `/${locale}` }, { label: t.cartTitle, href: `/${locale}/cart` }, { label: t.paymentTitle }]}
        steps={t.steps}
        current={2}
      />
      <section className="bg-white pb-16 pt-4 sm:pb-20">
        <div className="mx-auto max-w-6xl px-4 lg:px-8">
          <PaymentView t={t} locale={locale} stream={stream} />
        </div>
      </section>
    </main>
  );
}
