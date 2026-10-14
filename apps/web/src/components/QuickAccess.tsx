import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';

type QuickCopy = Dictionary['quick'] & {
  eyebrow?: string;
  heading?: string;
};

type Props = { locale: Locale; t: QuickCopy };

// Photos go in apps/web/public/images/. Until they exist, the gradients show instead.
// Order must match the "items" order in the dictionary: Ashram, Sevas, Donation, Resources.
const CARDS = [
  { img: '/images/quick-ashram.jpg', fallback: 'linear-gradient(135deg, #7A1C1C 0%, #231A18 100%)', span: 'lg:col-span-2 lg:row-span-2', big: true },
  { img: '/images/quick-sevas.jpg', fallback: 'linear-gradient(135deg, #D97706 0%, #7A1C1C 100%)', span: 'lg:col-span-2', big: false },
  { img: '/images/quick-donation.jpg', fallback: 'linear-gradient(135deg, #231A18 0%, #D97706 160%)', span: '', big: false },
  { img: '/images/quick-resources.jpg', fallback: 'linear-gradient(135deg, #7A1C1C 0%, #D97706 160%)', span: '', big: false },
];

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function QuickAccess({ locale, t }: Props) {
  return (
    <section aria-labelledby="quick-title" className="bg-white py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-saffron [html[lang='ta']_&]:tracking-normal">{t.eyebrow}</p>
          <h2 id="quick-title" className="mt-3 font-display !text-3xl !leading-tight font-semibold text-maroon sm:!text-4xl">{t.heading}</h2>
          <div aria-hidden="true" className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-14 bg-saffron" />
            <span className="h-2 w-2 rotate-45 bg-saffron" />
            <span className="h-px w-14 bg-saffron" />
          </div>
        </div>

        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:auto-rows-[14rem] lg:grid-cols-4">
          {t.items.map((item, i) => {
            const c = CARDS[i];
            if (!c) return null;
            return (
              <li key={item.title} className={`flex ${c.span}`}>
                <Link
                  href={`/${locale}${item.href}`}
                  className="group relative isolate flex min-h-[14rem] w-full flex-col justify-end overflow-hidden rounded-2xl text-white shadow-md transition-shadow duration-300 hover:shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-saffron"
                >
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 motion-reduce:transition-none"
                    style={{ backgroundImage: `url('${c.img}'), ${c.fallback}` }}
                  />
                  <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal/95 via-charcoal/55 to-charcoal/10" />
                  <span aria-hidden="true" className="absolute right-5 top-3 font-display text-5xl font-semibold text-white/25">{`0${i + 1}`}</span>

                  <div className="p-6">
                    <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded bg-saffron transition-all duration-300 group-hover:w-20 motion-reduce:transition-none" />
                    <h3 className={`font-display font-semibold !text-white ${c.big ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>{item.title}</h3>
                    <p className={`mt-2 text-white/90 ${c.big ? 'max-w-md text-base sm:text-lg' : 'text-sm lg:line-clamp-3'}`}>{item.text}</p>
                    <span className="mt-4 inline-flex items-center gap-2 font-semibold text-saffron">
                      {t.cta}
                      <Arrow />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}