import type React from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';

// A button link already worked out by the page: a page of this site, or another website
export type HeroLink = { href: string; external: boolean };

type Props = {
  locale: Locale;
  t: Dictionary['hero'];
  // All optional. The CMS (Home Page) can replace the two photos and the two button links.
  bgImage?: string;
  photo?: string;
  primary?: HeroLink;
  secondary?: HeroLink;
};

// Photos go in apps/web/public/images/. A photo uploaded in the CMS shows first; until a photo exists, these palette gradients show instead.
const BG_FALLBACK = 'linear-gradient(135deg, #231A18 0%, #7A1C1C 100%)'; // charcoal to maroon
const PHOTO_FALLBACK = 'linear-gradient(180deg, #F3E4E1 0%, #7A1C1C 100%)'; // rose to maroon

function Flame() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0 text-saffron"
    >
      <path d="M12 2c.6 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4.4.4 1.2 1 1.8 1.7 2C11.3 7.7 11.6 5 12 2z" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="transition-transform duration-300 group-hover:translate-x-1"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const btnPrimary = 'group inline-flex items-center justify-center gap-2 rounded-md bg-saffron px-7 py-3.5 text-base font-bold text-charcoal shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl';
const btnSecondary = 'inline-flex items-center justify-center rounded-md border-2 border-white/90 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-maroon';

// A page of this site uses Link; another website opens in a new tab
function Go({ to, className, children }: { to: HeroLink; className: string; children: React.ReactNode }) {
  if (!to.external) return <Link href={to.href} className={className}>{children}</Link>;
  const web = /^https?:/i.test(to.href);
  return <a href={to.href} className={className} {...(web ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>;
}

export default function Hero({ locale, t, bgImage, photo, primary, secondary }: Props) {
  const href = (path: string) => `/${locale}${path}`;
  const toPrimary: HeroLink = primary ?? { href: href('/sevas'), external: false };
  const toSecondary: HeroLink = secondary ?? { href: href('/audio'), external: false };

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-charcoal text-white">
      {/* 1. Background photo with a very slow zoom */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 animate-kenburns bg-cover bg-center motion-reduce:animate-none"
        style={{ backgroundImage: `${bgImage ? `url('${bgImage}'), ` : ''}url('/images/hero-bg.jpg'), ${BG_FALLBACK}` }}
      />

      {/* 2. Overlays: dark on the left for text contrast, open on the right for visuals */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-charcoal/90 via-charcoal/60 to-charcoal/20"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal/70 via-transparent to-charcoal/30"
      />

      {/* 3. Main Hero Content Grid */}
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:py-16 lg:min-h-[640px] lg:grid-cols-[1fr_340px] lg:gap-16 lg:px-8 lg:py-20">
        {/* Words / Left Column */}
        <div className="text-center lg:text-left">
          <p
            className="animate-fade-up inline-flex max-w-full items-center gap-2 rounded-full border border-saffron/70 bg-charcoal/40 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm motion-reduce:animate-none sm:text-base"
            style={{ animationDelay: '200ms' }}
          >
            <Flame />
            <span>{t.pill}</span>
          </p>

          <h1
            id="hero-title"
            className="hero-title animate-fade-up mt-6 font-display text-[2.5rem] font-semibold uppercase leading-[1.05] tracking-wide text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)] motion-reduce:animate-none sm:text-5xl lg:text-6xl xl:text-7xl"
            style={{ animationDelay: '320ms' }}
          >
            {t.title.map((line, index) => (
              <span key={`${line}-${index}`} className="block">
                {line}
              </span>
            ))}
          </h1>

          {/* Ornament */}
          <div
            aria-hidden="true"
            className="animate-fade-up mt-6 flex items-center justify-center gap-3 motion-reduce:animate-none lg:justify-start"
            style={{ animationDelay: '440ms' }}
          >
            <span className="h-px w-14 bg-saffron" />
            <span className="h-2 w-2 rotate-45 bg-saffron" />
            <span className="h-px w-14 bg-saffron" />
          </div>

          <p
            className="animate-fade-up mx-auto mt-6 max-w-xl text-base text-white/90 motion-reduce:animate-none sm:text-lg lg:mx-0"
            style={{ animationDelay: '520ms' }}
          >
            {t.text}
          </p>

          {/* CTAs */}
          <div
            className="animate-fade-up mt-8 flex flex-col items-stretch gap-4 motion-reduce:animate-none sm:flex-row sm:justify-center lg:justify-start"
            style={{ animationDelay: '640ms' }}
          >
            <Go to={toPrimary} className={btnPrimary}>
              {t.primary}
              <Arrow />
            </Go>
            <Go to={toSecondary} className={btnSecondary}>
              {t.secondary}
            </Go>
          </div>
        </div>

        {/* Arch Portrait / Right Column */}
        <div
          className="animate-fade-up mx-auto w-56 motion-reduce:animate-none sm:w-64 lg:w-[340px]"
          style={{ animationDelay: '100ms' }}
        >
          <div className="relative animate-float motion-reduce:animate-none">
            <div
              aria-hidden="true"
              className="absolute -inset-3 rounded-b-[2rem] rounded-t-[9999px] border border-saffron/50"
            />
            <div
              role="img"
              aria-label={t.photoAlt}
              className="relative aspect-[5/7] overflow-hidden rounded-b-[1.5rem] rounded-t-[9999px] border-[3px] border-saffron bg-cover bg-top shadow-[0_0_60px_rgba(217,119,6,0.35)]"
              style={{ backgroundImage: `${photo ? `url('${photo}'), ` : ''}url('/images/swamiji.jpg'), ${PHOTO_FALLBACK}` }}
            />
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div aria-hidden="true" className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 lg:block">
        <div className="flex h-9 w-6 justify-center rounded-full border-2 border-white/70 pt-1.5">
          <span className="h-2 w-1 animate-scroll-dot rounded-full bg-white motion-reduce:animate-none" />
        </div>
      </div>
    </section>
  );
}