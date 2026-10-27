import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProfileView from '@/components/account/ProfileView';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: `${t.account.meta.title} | ${t.site.name}`,
    robots: { index: false },
  };
}

export default async function ProfilePage({ params }: Params) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const t = dict.account;

  return (
    <main className="min-h-screen bg-[#faf7f2]">
      {/* Maroon Banner Header */}
      <section
        aria-label={t.meta.title}
        className="relative isolate overflow-hidden bg-gradient-to-br from-maroon via-[#6a1717] to-charcoal pb-28 pt-8 text-white"
      >
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-saffron/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute left-1/3 top-1/2 -z-10 h-72 w-72 rounded-full bg-rose/10 blur-3xl"
        />

        <div className="mx-auto max-w-5xl px-4 lg:px-8">
          <nav aria-label={t.crumbLabel} className="text-xs font-semibold text-white/75">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link
                  href={`/${locale}`}
                  className="underline-offset-4 hover:text-white hover:underline"
                >
                  {dict.nav.home}
                </Link>
              </li>
              <li aria-hidden="true" className="opacity-50">/</li>
              <li aria-current="page" className="text-white">
                {t.meta.title}
              </li>
            </ol>
          </nav>

          <h1 className="mt-4 font-display text-3xl font-semibold !text-white sm:text-4xl [html[lang='ta']_&]:text-3xl">
            {t.bannerTitle}
          </h1>
          <p className="mt-1.5 max-w-2xl font-serif text-sm text-white/85 sm:text-base">
            {t.bannerText}
          </p>
        </div>
      </section>

      {/* Overlapping Profile Card View */}
      <ProfileView
        locale={locale}
        t={t}
        a={dict.auth}
        shop={dict.shop}
        homeLabel={dict.nav.home}
        siteName={dict.site.name}
      />
    </main>
  );
}