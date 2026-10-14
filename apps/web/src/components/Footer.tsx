import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';
import { SITE } from '@/lib/site';
import LogoBadge from './LogoBadge';

type TrustItem = {
  name: string;
  short: string;
  reg: string;
};

// Extends Dictionary['footer'] with optional keys so TypeScript compiles cleanly
type Props = {
  locale: Locale;
  t: Dictionary['footer'] & {
    trustItems?: TrustItem[];
    contactTitle?: string;
  };
};

const LOGOS = ['/images/logo-vspt.png', '/images/logo-sdss.png'];

const DEFAULT_TRUSTS: [TrustItem, TrustItem] = [
  {
    name: 'Vedaneri Sri Panpattu Trust',
    short: 'VSPT',
    reg: 'Reg. Trust',
  },
  {
    name: 'Sri Dakshinamurthy Seva Samithi',
    short: 'SDSS',
    reg: 'Reg. Society',
  },
];

const linkClass =
  'text-white/85 underline-offset-4 transition-colors hover:text-white hover:underline hover:decoration-saffron hover:decoration-2';
const social =
  'flex h-10 w-10 items-center justify-center rounded-full border border-white/50 transition-colors hover:border-saffron hover:bg-saffron hover:text-charcoal';

export default function Footer({ locale, t }: Props) {
  const year = new Date().getFullYear();

  // Fallback to DEFAULT_TRUSTS if trustItems is missing in the dictionary
  const left = t.trustItems?.[0] ?? DEFAULT_TRUSTS[0];
  const right = t.trustItems?.[1] ?? DEFAULT_TRUSTS[1];
  const contactTitle = t.contactTitle ?? (locale === 'ta' ? 'தொடர்புக்கு' : 'Contact Us');

  return (
    <footer className="bg-charcoal text-white">
      <div aria-hidden="true" className="h-1 bg-gradient-to-r from-maroon via-saffron to-maroon" />

      {/* Crest: trust logo, ashram name, trust logo */}
      <div className="border-b border-white/15">
        <div className="mx-auto grid max-w-7xl grid-cols-2 items-center gap-x-6 gap-y-8 px-4 py-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-x-10 lg:px-8">
          <div className="col-span-2 order-first text-center lg:order-none lg:col-span-1">
            <span
              aria-hidden="true"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-saffron text-charcoal"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2c.6 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4.4.4 1.2 1 1.8 1.7 2C11.3 7.7 11.6 5 12 2z" />
              </svg>
            </span>
            <p className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">{t.name}</p>
            <div aria-hidden="true" className="mt-3 flex items-center justify-center gap-3">
              <span className="h-px w-10 bg-saffron" />
              <span className="h-2 w-2 rotate-45 bg-saffron" />
              <span className="h-px w-10 bg-saffron" />
            </div>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.25em] text-rose [html[lang='ta']_&]:tracking-normal">
              {t.motto}
            </p>
          </div>

          {/* Left logo */}
          <div className="order-none flex flex-col items-center gap-4 text-center lg:order-first lg:flex-row lg:text-left">
            <LogoBadge src={LOGOS[0]} alt={left.name} initials={left.short} />
            <div>
              <p className="font-semibold uppercase tracking-wide text-white">{left.name}</p>
              <p className="mt-1 text-sm text-white/70">{left.reg}</p>
            </div>
          </div>

          {/* Right logo */}
          <div className="flex flex-col items-center gap-4 text-center lg:flex-row-reverse lg:text-right">
            <LogoBadge src={LOGOS[1]} alt={right.name} initials={right.short} />
            <div>
              <p className="font-semibold uppercase tracking-wide text-white">{right.name}</p>
              <p className="mt-1 text-sm text-white/70">{right.reg}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-5">
          <h2 className="font-display !text-xl !leading-snug font-semibold text-rose">{contactTitle}</h2>
          <p className="mt-4 max-w-md text-white/85">{t.address}</p>
          <ul className="mt-4 space-y-1.5">
            {SITE.phones.map((p) => (
              <li key={p}>
                <span className="text-white/70">{t.phone}: </span>
                <a
                  href={`tel:${p.replace(/\s/g, '')}`}
                  className="font-semibold text-white underline decoration-saffron decoration-2 underline-offset-4"
                >
                  {p}
                </a>
              </li>
            ))}
            {SITE.email && (
              <li>
                <span className="text-white/70">{t.email}: </span>
                <a
                  href={`mailto:${SITE.email}`}
                  className="font-semibold text-white underline decoration-saffron decoration-2 underline-offset-4"
                >
                  {SITE.email}
                </a>
              </li>
            )}
          </ul>
          <div className="mt-5 flex gap-3">
            {SITE.youtube && (
              <a
                href={SITE.youtube}
                aria-label={t.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className={social}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5 3-5 3z" />
                </svg>
              </a>
            )}
            {SITE.whatsapp && (
              <a
                href={SITE.whatsapp}
                aria-label={t.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={social}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.5L3 21z" />
                  <path d="M9 10c0 3 2 5 5 5l1-1.5-2-1-.8.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.8-1-2L9 10z" />
                </svg>
              </a>
            )}
          </div>
        </div>

        <nav aria-label={t.linksTitle} className="lg:col-span-3">
          <h2 className="font-display !text-xl !leading-snug font-semibold text-rose">{t.linksTitle}</h2>
          <ul className="mt-4 space-y-2.5">
            {t.links.map((l) => (
              <li key={l.label}>
                <Link href={`/${locale}${l.href}`} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-4">
          <div className="rounded-xl border border-white/20 bg-white/5 p-5">
            <div className="flex items-center gap-3">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0 text-saffron"
              >
                <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <h2 className="font-display !text-xl !leading-snug font-semibold text-rose">{t.taxTitle}</h2>
            </div>
            <p className="mt-3 text-white/85">{t.tax}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/15">
        <p className="mx-auto max-w-7xl px-4 py-5 text-center text-sm text-white/75 lg:px-8">
          © {year} {t.copyright}
        </p>
      </div>
    </footer>
  );
}