import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';
import GlowLayer from './GlowLayer';
import Reveal from './Reveal';

// Portrait: apps/web/public/images/swamiji-cutout.png  (any JPG or PNG photo works, about 800x1000, portrait)
const FOUNDER_PHOTO = '/images/swamiji-cutout.png';
const PHOTO_FALLBACK = 'linear-gradient(180deg, #F3E4E1 0%, #7A1C1C 100%)'; // rose to maroon, shows until the photo exists

// Where the light shines, as a position on the PHOTO (0 = left/top edge, 1 = right/bottom edge).
// Find the numbers: open the site with ?pick=founder (http://localhost:3000/en?pick=founder),
// click the centre of each palm, then copy the numbers from the white box into this list.
const PALM_POINTS = [
  { x: 0.32, y: 0.51 },
  { x: 0.66, y: 0.53 },
];

function Mandala() {
  const petals = Array.from({ length: 16 }, (_, i) => i * 22.5);
  return (
    <svg viewBox="0 0 800 800" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
      className="pointer-events-none absolute -right-40 top-1/2 h-[720px] w-[720px] -translate-y-1/2 animate-[spin_180s_linear_infinite] text-saffron opacity-[0.14] motion-reduce:animate-none sm:h-[880px] sm:w-[880px] lg:-right-24">
      {[380, 330, 250, 170, 90].map((r) => <circle key={r} cx="400" cy="400" r={r} />)}
      {petals.map((a) => (
        <g key={a} transform={`rotate(${a} 400 400)`}>
          <path d="M400 20 C 430 90, 430 150, 400 210 C 370 150, 370 90, 400 20 Z" />
          <path d="M400 250 C 418 290, 418 320, 400 350 C 382 320, 382 290, 400 250 Z" />
          <circle cx="400" cy="232" r="6" />
        </g>
      ))}
    </svg>
  );
}

export default function Founder({ locale, t }: { locale: Locale; t: Dictionary['founder'] }) {
  return (
    <section aria-labelledby="founder-title" className="relative isolate overflow-hidden bg-white">
      <Mandala />

      <div className="relative mx-auto grid max-w-7xl items-center gap-x-12 px-4 py-14 sm:py-16 lg:grid-cols-[380px_1fr] lg:px-8 lg:py-20">
        {/* Portrait in an arch frame, with light on the raised palms */}
        <div className="relative order-2 mx-auto mt-4 w-full max-w-[320px] lg:order-1 lg:mt-0 lg:max-w-none">
          <div aria-hidden="true" className="absolute -inset-3 rounded-b-[2rem] rounded-t-[9999px] border border-saffron/50" />
          <div role="img" aria-label={t.photoAlt}
            className="relative aspect-[4/5] overflow-hidden rounded-b-[1.5rem] rounded-t-[9999px] border-[3px] border-saffron bg-cover bg-top shadow-[0_18px_50px_-12px_rgba(217,119,6,0.55)]"
            style={{ backgroundImage: `url('${FOUNDER_PHOTO}'), ${PHOTO_FALLBACK}`, backgroundPosition: '50% 0%' }}>
            <GlowLayer src={FOUNDER_PHOTO} points={PALM_POINTS} position="50% 0%" size={0.2} pickKey="founder" />
          </div>
        </div>

        {/* Words */}
        <Reveal className="order-1 text-center lg:order-2 lg:text-left">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-charcoal/70">{t.eyebrow}</p>
          <h2 id="founder-title" className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">{t.name}</h2>
          <p className="mt-3 font-serif text-lg font-bold text-charcoal sm:text-xl">{t.role}</p>

          <div aria-hidden="true" className="mt-5 flex items-center justify-center gap-3 lg:justify-start">
            <span className="h-px w-12 bg-saffron" />
            <span className="h-2 w-2 rotate-45 bg-saffron" />
            <span className="h-px w-12 bg-saffron" />
          </div>

          <p className="mx-auto mt-5 max-w-2xl text-base text-charcoal/90 sm:text-lg lg:mx-0">{t.bio}</p>

          <ul className="mt-6 flex flex-wrap justify-center gap-2.5 lg:justify-start">
            {t.facts.map((f) => (
              <li key={f} className="inline-flex items-center gap-2 rounded-full border border-rose bg-white/80 px-4 py-1.5 text-sm font-semibold text-maroon backdrop-blur-sm">
                <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-saffron" />
                {f}
              </li>
            ))}
          </ul>

          <Link href={`/${locale}/about`}
            className="group mt-7 inline-flex items-center gap-2 rounded-md bg-maroon px-6 py-3 font-semibold text-white shadow transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            {t.cta}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-1"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </Reveal>
      </div>

      {/* Quote band */}
      <figure className="relative bg-maroon">
        <div aria-hidden="true" className="h-1 bg-saffron" />
        <blockquote className="mx-auto flex max-w-7xl items-start gap-4 px-4 py-7 sm:items-center sm:py-8 lg:px-8">
          <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="currentColor" className="mt-1 shrink-0 text-saffron sm:mt-0">
            <path d="M7 7h4v4c0 3-1.5 5-4 6v-2c1-.6 1.5-1.6 1.5-3H7V7zm8 0h4v4c0 3-1.5 5-4 6v-2c1-.6 1.5-1.6 1.5-3H15V7z" />
          </svg>
          <p className="font-display text-xl font-semibold leading-snug text-white sm:text-2xl lg:text-[1.65rem]">{t.quote}</p>
        </blockquote>
      </figure>
    </section>
  );
}