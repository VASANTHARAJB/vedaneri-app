'use client';

import Link from 'next/link';
import { locales, type Locale } from '@/lib/i18n';

const LANG_LABEL: Record<Locale, string> = { en: 'EN', ta: 'தமிழ்' };

// Slim top bar for the login page (the full site header is hidden there): logo, language switch, back to home.
export default function AuthTopBar({ locale, siteName, backLabel, languageLabel }: { locale: Locale; siteName: string; backLabel: string; languageLabel: string }) {
  return (
    <div className="relative z-20 flex items-center justify-between gap-3 bg-white px-4 py-3 shadow-sm lg:absolute lg:inset-x-0 lg:top-0 lg:bg-transparent lg:px-10 lg:py-5 lg:shadow-none">
      <Link href={`/${locale}`} className="flex min-w-0 items-center gap-3 text-maroon focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron lg:text-white">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maroon text-saffron ring-2 ring-saffron/60 lg:bg-white lg:text-maroon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.6 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4.4.4 1.2 1 1.8 1.7 2C11.3 7.7 11.6 5 12 2z" /></svg>
        </span>
        <span className="truncate font-display text-2xl font-semibold">{siteName}</span>
      </Link>

      <div className="flex items-center gap-3">
        <div role="group" aria-label={languageLabel} className="flex rounded-full bg-rose p-1 text-sm font-semibold">
          {locales.map((l) => (
            <Link key={l} href={`/${l}/login`} lang={l} hrefLang={l} aria-current={l === locale ? 'true' : undefined}
              className={`rounded-full px-3 py-1 ${l === locale ? 'bg-maroon text-white' : 'text-maroon hover:bg-white'}`}>
              {LANG_LABEL[l]}
            </Link>
          ))}
        </div>
        <Link href={`/${locale}`} className="inline-flex items-center gap-1.5 rounded-full border-2 border-maroon px-4 py-1.5 text-sm font-semibold text-maroon transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron lg:bg-white">
          <span aria-hidden="true">←</span><span className="hidden sm:inline">{backLabel}</span><span className="sm:hidden">{backLabel.split(' ').pop()}</span>
        </Link>
      </div>
    </div>
  );
}
