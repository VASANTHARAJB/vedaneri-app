import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SevaCard from '@/components/sevas/SevaCard';
import SankalpamWizard from '@/components/sevas/SankalpamWizard';
import SectionTitle from '@/components/SectionTitle';
import { SEVAS, getSeva, txt } from '@/data/sevas';
import { getDictionary } from '@/lib/dictionary';
import { rupees, sevaPhoto } from '@/lib/format';
import { isLocale, locales } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => locales.flatMap((locale) => SEVAS.map((s) => ({ locale, slug: s.slug })));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const seva = getSeva(slug);
  if (!isLocale(locale) || !seva) return {};
  const t = getDictionary(locale);
  return { title: `${txt(seva.name, locale)} | ${t.site.name}` };
}

// Where Swamiji's blessing hand is inside the photo, as % of the picture (0,0 = top-left). Adjust these two numbers to match the image.
const HAND = { x: 24, y: 46 };

// Sparkles around the hand: offset from the hand in %, size in px, animation delay in seconds
const SPARKLES = [
  { dx: 0, dy: -6, size: 22, delay: 0 },
  { dx: -7, dy: 0, size: 14, delay: 0.6 },
  { dx: 6, dy: -2, size: 16, delay: 1.2 },
  { dx: -4, dy: 7, size: 12, delay: 1.8 },
  { dx: 5, dy: 6, size: 18, delay: 0.3 },
  { dx: -10, dy: -8, size: 10, delay: 1.5 },
  { dx: 10, dy: 3, size: 10, delay: 0.9 },
  { dx: 1, dy: 11, size: 12, delay: 2.1 },
];

const SPARKLE_CSS = `
@keyframes sparkle-twinkle { 0%,100% { opacity: .15; transform: scale(.5) rotate(0deg); } 50% { opacity: 1; transform: scale(1.15) rotate(45deg); } }
.sparkle { animation: sparkle-twinkle 2.6s ease-in-out infinite; filter: drop-shadow(0 0 6px rgba(217,119,6,.9)); }
@media (prefers-reduced-motion: reduce) { .sparkle { animation: none; opacity: .8; } }
`;

function Calendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export default async function SevaDetailPage({ params }: Params) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const seva = getSeva(slug);
  if (!seva) notFound();

  const dict = getDictionary(locale);
  const t = dict.sevas;
  const name = txt(seva.name, locale);
  const kindLabel = seva.kind === 'corpus' ? t.tabCorpus : t.filters.find((f) => f.key === seva.kind)?.label ?? '';
  const paragraphs = seva.description[locale];
  const related = SEVAS.filter((s) => s.kind === seva.kind && s.slug !== seva.slug).slice(0, 3);
  const href = (p: string) => `/${locale}${p}`;

  return (
    <main>
      <section className="bg-gradient-to-b from-rose/80 to-white">
        <nav aria-label={t.crumbLabel} className="mx-auto max-w-6xl px-4 pb-2 pt-6 text-sm text-charcoal/80 lg:px-8">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href={href('')} className="underline-offset-4 hover:text-maroon hover:underline">{dict.nav.home}</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={href('/sevas')} className="underline-offset-4 hover:text-maroon hover:underline">{dict.nav.seva}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-maroon">{name}</li>
          </ol>
        </nav>
      </section>

      {/* Photo on the left, details and booking form on the right */}
      <section className="bg-white pb-12 pt-4 sm:pb-16">
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 lg:grid-cols-2 lg:gap-14 lg:px-8">
          <div className="lg:sticky lg:top-24">
            <div className="relative pb-4 pr-4">
              <div aria-hidden="true" className="absolute inset-0 translate-x-4 translate-y-4 rounded-2xl bg-maroon" />
              <div role="img" aria-label={name} className="relative aspect-[4/3] w-full rounded-2xl bg-maroon bg-cover bg-center shadow-xl ring-4 ring-white" style={{ backgroundImage: sevaPhoto(seva.slug) }} />
            </div>
          </div>

          <div>
            <p className="inline-block rounded-full bg-maroon px-4 py-1 text-xs font-bold uppercase tracking-wider text-white [html[lang='ta']_&]:tracking-normal">{kindLabel}</p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-maroon sm:text-5xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-3xl [html[lang='ta']_&]:sm:text-4xl">{name}</h1>

            {seva.benefit && <p className="mt-3 font-serif text-lg text-charcoal/90"><span className="font-semibold">{t.benefitsLabel}</span> {txt(seva.benefit, locale)}</p>}

            <dl className="mt-5 grid gap-4 rounded-xl bg-rose/50 p-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-maroon [html[lang='ta']_&]:tracking-normal">{t.amountLabel}</dt>
                <dd className="mt-1 font-display text-3xl font-semibold text-charcoal">
                  {seva.amount > 0 ? rupees(seva.amount) : <span className="text-2xl text-saffron [html[lang='ta']_&]:text-xl">{t.abilityLabel}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wider text-maroon [html[lang='ta']_&]:tracking-normal">{t.whenLabel}</dt>
                <dd className="mt-1 flex items-center gap-2 text-lg font-semibold text-charcoal"><Calendar />{txt(seva.when, locale)}</dd>
              </div>
            </dl>

            <div className="mt-6">
              <SankalpamWizard seva={seva} locale={locale} t={t} fixed />
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section aria-labelledby="about-title" className="bg-rose/50 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 lg:px-8">
          <h2 id="about-title" className="font-display text-3xl font-semibold text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.3]">{t.aboutTitle}</h2>
          <div aria-hidden="true" className="mt-3 flex items-center gap-3"><span className="h-px w-12 bg-saffron" /><span className="h-2 w-2 rotate-45 bg-saffron" /><span className="h-px w-12 bg-saffron" /></div>
          {paragraphs.length > 0 ? (
            paragraphs.map((p) => <p key={p} className="mt-5 font-serif text-lg leading-relaxed text-charcoal">{p}</p>)
          ) : (
            <p className="mt-5 font-serif text-lg leading-relaxed text-charcoal/80">{t.descriptionEmpty}</p>
          )}

          {seva.includes.length > 0 && (
            <div className="mt-10">
              <h3 className="font-display text-2xl font-semibold text-maroon">{t.includesTitle}</h3>
              <ul className="mt-4 divide-y divide-rose overflow-hidden rounded-xl bg-white ring-1 ring-rose">
                {seva.includes.map((i) => (
                  <li key={i.label.en} className="flex items-start justify-between gap-4 px-5 py-3">
                    <span className="text-charcoal">{txt(i.label, locale)}</span>
                    <span className="shrink-0 font-bold text-charcoal">{rupees(i.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Swamiji's blessing: cut-out photo with sparkles at the raised hand, and the help message */}
      <section aria-labelledby="blessing-title" className="relative isolate overflow-hidden bg-gradient-to-br from-maroon to-charcoal text-white">
        <style>{SPARKLE_CSS}</style>
        <div aria-hidden="true" className="absolute -left-24 top-1/2 -z-10 h-96 w-96 -translate-y-1/2 rounded-full bg-saffron/20 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-end gap-8 px-4 pt-12 sm:pt-16 lg:grid-cols-2 lg:gap-12 lg:px-8">
          <div className="pb-12 text-center sm:pb-16 lg:text-left">
            <h2 id="blessing-title" className="font-display text-3xl font-semibold leading-tight !text-white sm:text-4xl [html[lang='ta']_&]:!leading-[1.35]">{t.helpTitle}</h2>
            <div aria-hidden="true" className="mt-3 flex items-center justify-center gap-3 lg:justify-start"><span className="h-px w-12 bg-saffron" /><span className="h-2 w-2 rotate-45 bg-saffron" /><span className="h-px w-12 bg-saffron" /></div>
            <p className="mx-auto mt-5 max-w-xl font-serif text-lg leading-relaxed text-white/90 lg:mx-0">{t.helpText}</p>
            <Link href={href('/contact')} className="mt-7 inline-flex items-center rounded-full bg-saffron px-7 py-3 font-semibold text-charcoal transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              {t.helpCta}
            </Link>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div className="relative aspect-[3/4] w-full">
              <Image src="/images/swamiji-cutout.png" alt="" fill sizes="(min-width: 1024px) 28rem, 24rem" className="object-contain object-bottom drop-shadow-2xl" />
              {SPARKLES.map((s, i) => (
                <svg
                  key={i}
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="sparkle absolute text-saffron"
                  style={{ left: `calc(${HAND.x}% + ${s.dx}%)`, top: `calc(${HAND.y}% + ${s.dy}%)`, width: s.size, height: s.size, marginLeft: -s.size / 2, marginTop: -s.size / 2, animationDelay: `${s.delay}s` }}
                >
                  <path d="M12 0c.8 6.2 5.8 11.2 12 12-6.2.8-11.2 5.8-12 12-.8-6.2-5.8-11.2-12-12C6.2 11.2 11.2 6.2 12 0z" fill="currentColor" />
                </svg>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Related sevas */}
      {related.length > 0 && (
        <section aria-labelledby="related-title" className="bg-rose/50 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <SectionTitle id="related-title" title={t.relatedTitle} />
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((s) => (
                <li key={s.slug} className="h-full"><SevaCard seva={s} locale={locale} t={t} /></li>
              ))}
            </ul>
            <p className="mt-8 text-center">
              <Link href={href('/sevas')} className="font-bold text-maroon underline underline-offset-4">{t.backLabel}</Link>
            </p>
          </div>
        </section>
      )}
    </main>
  );
}