import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale, locales } from '@/lib/i18n';
import { getDictionary } from '@/lib/dictionary';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import CartProvider from '@/components/cart/CartProvider';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/lora/600.css';
import '@fontsource/lora/700.css';
import '@fontsource/noto-serif-tamil/600.css';
import '@fontsource/noto-serif-tamil/700.css';
import '@fontsource/mukta-malar/400.css';
import '@fontsource/mukta-malar/500.css';
import '@fontsource/mukta-malar/600.css';
import '@fontsource/mukta-malar/700.css';
import '../globals.css';

export const generateStaticParams = () => locales.map((locale) => ({ locale }));

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return (
    <html lang={locale}>
      <body>
        <CartProvider>
          <Header locale={locale} siteName={t.site.name} tagline={t.site.tagline} labels={t.nav} a11y={t.a11y} cartLabel={t.shop.cartLabel} />
          {children}
          <Footer locale={locale} t={t.footer} />
        </CartProvider>
      </body>
    </html>
  );
}
