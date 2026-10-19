import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import DonationPanel from '@/components/donations/DonationPanel';
import SectionTitle from '@/components/SectionTitle';
import { DONATIONS, getDonation } from '@/data/donations';
import { txt } from '@/data/sevas';
import { getDictionary } from '@/lib/dictionary';
import { rupees } from '@/lib/format';
import { isLocale, locales } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => locales.flatMap((locale) => DONATIONS.map((d) => ({ locale, slug: d.slug })));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = getDonation(slug);
  if (!isLocale(locale) || !item) return {};
  const t = getDictionary(locale);
  return { title: `${txt(item.name, locale)} | ${t.site.name}` };
}

export default async function DonationDetailPage({ params }: Params) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const item = getDonation(slug);
  if (!item) notFound();

  const dict = getDictionary(locale);
  const t = dict.donate;
  const name = txt(item.name, locale);
  const kindLabel = item.kind === 'corpus' ? t.tabCorpus : t.tabDonation;
  const paragraphs = item.description[locale];
  const related = DONATIONS.filter((d) => d.kind === item.kind && d.slug !== item.slug).slice(0, 3);
  const href = (p: string) => `/${locale}${p}`;

  return (
    <main>
      <section className="bg-gradient-to-b from-rose/80 to-white">
        <nav aria-label={t.crumbLabel} className="mx-auto max-w-6xl px-4 pb-2 pt-6 text-sm text-charcoal/80 lg:px-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href={href('')} className="underline-offset-4 hover:text-maroon hover:underline">{dict.nav.home}</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={href('/donate')} className="underline-offset-4 hover:text-maroon hover:underline">{dict.nav.donations}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-maroon">{name}</li>
          </ol>
        </nav>
      </section>

      {/* Details on the left, donation form on the right */}
      <section className="bg-white pb-12 pt-4 sm:pb-16">
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 lg:grid-cols-2 lg:gap-14 lg:px-8">
          <div>
            <p className="inline-block rounded-full bg-maroon px-4 py-1 text-xs font-bold uppercase tracking-wider text-white [html[lang='ta']_&]:tracking-normal">{kindLabel}</p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-maroon sm:text-5xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-3xl [html[lang='ta']_&]:sm:text-4xl">{name}</h1>

            <dl className="mt-5 rounded-xl bg-rose/50 p-5">
              <dt className="text-xs font-bold uppercase tracking-wider text-maroon [html[lang='ta']_&]:tracking-normal">{t.amountLabel}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold text-charcoal">
                {item.amount > 0 ? rupees(item.amount) : <span className="text-2xl text-saffron [html[lang='ta']_&]:text-xl">{t.abilityLabel}</span>}
              </dd>
            </dl>

            <h2 className="mt-8 font-display text-2xl font-semibold text-maroon">{t.aboutTitle}</h2>
            {paragraphs.length > 0 ? (
              paragraphs.map((p) => <p key={p} className="mt-3 font-serif text-lg leading-relaxed text-charcoal">{p}</p>)
            ) : (
              <p className="mt-3 font-serif text-lg leading-relaxed text-charcoal/80">{t.descriptionEmpty}</p>
            )}
          </div>

          <div className="lg:sticky lg:top-24">
            <DonationPanel item={item} locale={locale} t={t} fixed />
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="bg-rose/50 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <SectionTitle id="related-title" title={t.relatedTitle} />
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((d) => (
                <li key={d.slug} className="h-full">
                  <Link href={href(`/donate/${d.slug}`)} className="flex h-full flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-rose transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">
                    <span className="font-display text-xl font-semibold leading-tight text-maroon [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-lg">{txt(d.name, locale)}</span>
                    <span className="mt-auto pt-4 font-display text-xl font-semibold text-saffron">{d.amount > 0 ? rupees(d.amount) : t.abilityShort}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-center">
              <Link href={href('/donate')} className="font-bold text-maroon underline underline-offset-4">{t.backLabel}</Link>
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
