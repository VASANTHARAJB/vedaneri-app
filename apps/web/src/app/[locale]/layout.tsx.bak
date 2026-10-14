import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale, locales } from '@/lib/i18n';
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
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
