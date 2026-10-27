'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NAV, type NavItem } from '@/lib/nav';
import { locales, type Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';
import AccountLink from '@/components/account/AccountLink';
import CartLink from '@/components/cart/CartLink';

type Props = {
  locale: Locale;
  siteName: string;
  tagline: string;
  labels: Dictionary['nav'];
  a11y: Dictionary['a11y'];
  cartLabel: string;
};

const LANG_LABEL: Record<Locale, string> = { en: 'EN', ta: 'தமிழ்' };

// Built-in localization fallback for new navigation keys
const NAV_FALLBACK_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    home: 'Home',
    about: 'About',
    discourses: 'Discourses',
    seva: 'Seva',
    donations: 'Donations',
    annadhanamCorpus: 'Annadhanam & Corpus',
    ashramDonation: 'Ashram Donation',
    magazine: 'Magazine',
    camps: 'Camps',
    contact: 'Contact',
    contactUs: 'Contact Us',
    accommodation: 'Accommodation',
  },
  ta: {
    home: 'முகப்பு',
    about: 'ஆசிரமம்',
    discourses: 'உரைகள்',
    seva: 'சேவை',
    donations: 'நன்கொடைகள்',
    annadhanamCorpus: 'அன்னதானம் & மூலதன நிதி',
    ashramDonation: 'ஆசிரம நன்கொடை',
    magazine: 'பத்திரிகை',
    camps: 'முகாம்கள்',
    contact: 'தொடர்புக்கு',
    contactUs: 'தொடர்பு கொள்ள',
    accommodation: 'தங்குமிடம்',
  },
};

const stripLocale = (p: string) => p.replace(/^\/(en|ta)(?=\/|$)/, '') || '/';

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function Header({ locale, siteName, tagline, labels, a11y, cartLabel }: Props) {
  const pathname = usePathname();
  const path = stripLocale(pathname);
  const isTa = locale === 'ta';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileSub, setMobileSub] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const href = (h: string) => `/${locale}${h}`;
  const isActive = (h: string) => (h === '' ? path === '/' : path === h || path.startsWith(`${h}/`));

  const getLabel = (key: string): string => {
    return (labels as Record<string, string>)?.[key] || NAV_FALLBACK_LABELS[locale]?.[key] || key;
  };

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
    setMobileSub(null);
  }, [pathname]);

  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  // Dynamic padding and text size to accommodate longer Tamil scripts on 1280px-1440px displays
  const linkBase = `inline-flex items-center whitespace-nowrap border-b-2 py-2 transition-colors ${
    isTa
      ? 'px-1 xl:px-1.5 2xl:px-2.5 text-[12.5px] xl:text-[13px] 2xl:text-[14.5px]'
      : 'px-1.5 xl:px-2 2xl:px-3 text-[13px] xl:text-[13.5px] 2xl:text-[15px]'
  } font-medium`;

  const linkClass = (active: boolean) =>
    `${linkBase} ${
      active
        ? 'border-saffron text-maroon font-bold'
        : 'border-transparent text-charcoal hover:text-maroon'
    }`;

  const languageSwitch = (
    <div
      role="group"
      aria-label={a11y.language}
      className="inline-flex shrink-0 rounded-full border border-rose bg-white p-0.5 text-xs font-semibold 2xl:text-sm"
    >
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}${path === '/' ? '' : path}`}
          lang={l}
          hrefLang={l}
          aria-current={l === locale ? 'true' : undefined}
          className={`rounded-full px-2 py-0.5 sm:px-2.5 2xl:px-3 2xl:py-1 ${
            l === locale ? 'bg-maroon text-white' : 'text-charcoal hover:bg-rose'
          }`}
        >
          {LANG_LABEL[l]}
        </Link>
      ))}
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-rose bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 2xl:px-8">
        {/* Brand */}
        <Link
          href={href('')}
          className="flex min-w-0 shrink-0 items-center gap-2 leading-tight sm:gap-2.5"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-maroon text-saffron sm:h-10 sm:w-10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2c.6 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4.4.4 1.2 1 1.8 1.7 2C11.3 7.7 11.6 5 12 2z" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="brand-name font-serif text-[1.2rem] font-bold leading-none text-maroon sm:text-[1.35rem] 2xl:text-[1.65rem]">
              {siteName}
            </span>
            <span className="hidden truncate text-[11px] text-charcoal/70 2xl:block">{tagline}</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav ref={navRef} aria-label={a11y.mainNavigation} className="hidden shrink xl:block">
          <ul className="flex items-center gap-0.5 2xl:gap-1">
            {NAV.map((item: NavItem) =>
              'children' in item ? (
                <li
                  key={item.key}
                  className="relative"
                  onMouseEnter={() => setOpenMenu(item.key)}
                  onMouseLeave={() => setOpenMenu((k) => (k === item.key ? null : k))}
                >
                  <button
                    type="button"
                    suppressHydrationWarning
                    aria-haspopup="true"
                    aria-expanded={openMenu === item.key}
                    onClick={() => setOpenMenu((k) => (k === item.key ? null : item.key))}
                    className={`${linkClass(item.children.some((c) => isActive(c.href)))} inline-flex items-center gap-1 cursor-pointer`}
                  >
                    <span>{getLabel(item.key)}</span>
                    <Chevron open={openMenu === item.key} />
                  </button>

                  {openMenu === item.key && (
                    <ul className="absolute left-0 top-full z-50 min-w-[13.5rem] rounded-xl border border-rose bg-white py-1.5 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
                      {item.children.map((c) => (
                        <li key={c.key}>
                          <Link
                            href={href(c.href)}
                            aria-current={isActive(c.href) ? 'page' : undefined}
                            className={`block px-4 py-2.5 text-xs font-semibold hover:bg-rose hover:text-maroon transition-colors ${
                              isActive(c.href) ? 'font-bold text-maroon bg-rose/60' : 'text-charcoal'
                            }`}
                          >
                            {getLabel(c.key)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ) : (
                <li key={item.key}>
                  <Link
                    href={href(item.href)}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={linkClass(isActive(item.href))}
                  >
                    {getLabel(item.key)}
                  </Link>
                </li>
              )
            )}
          </ul>
        </nav>

        {/* Right side utilities: Language Switch, Cart, Devotee Account, Mobile Toggle */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 2xl:gap-3">
          {languageSwitch}
          <CartLink href={href('/cart')} label={cartLabel} />
          <AccountLink
            loginHref={href('/login')}
            profileHref={href('/profile')}
            loginLabel={labels.login}
            accountLabel={labels.account}
            className="hidden rounded-md border-2 border-maroon px-2.5 py-1 text-xs font-bold text-maroon transition-colors hover:bg-maroon hover:text-white xl:inline-flex 2xl:px-4 2xl:py-1.5 2xl:text-[14px]"
          />
          <button
            type="button"
            suppressHydrationWarning
            className="rounded-md p-1.5 text-maroon sm:p-2 xl:hidden cursor-pointer"
            aria-label={mobileOpen ? a11y.closeMenu : a11y.openMenu}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      <nav
        id="mobile-menu"
        aria-label={a11y.mainNavigation}
        className={`border-t border-rose bg-white xl:hidden ${mobileOpen ? 'block' : 'hidden'}`}
      >
        <ul className="mx-auto max-w-7xl px-4 py-2 space-y-0.5">
          {NAV.map((item: NavItem) =>
            'children' in item ? (
              <li key={item.key}>
                <button
                  type="button"
                  suppressHydrationWarning
                  aria-expanded={mobileSub === item.key}
                  onClick={() => setMobileSub((k) => (k === item.key ? null : item.key))}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-semibold text-charcoal hover:bg-rose cursor-pointer"
                >
                  <span>{getLabel(item.key)}</span>
                  <Chevron open={mobileSub === item.key} />
                </button>
                {mobileSub === item.key && (
                  <ul className="my-1 ml-3 border-l-2 border-saffron pl-2 space-y-1">
                    {item.children.map((c) => (
                      <li key={c.key}>
                        <Link
                          href={href(c.href)}
                          className={`block rounded-md px-3 py-2 text-xs font-semibold hover:bg-rose ${
                            isActive(c.href) ? 'bg-rose text-maroon font-bold' : 'text-charcoal'
                          }`}
                        >
                          {getLabel(c.key)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ) : (
              <li key={item.key}>
                <Link
                  href={href(item.href)}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={`block rounded-md px-3 py-2.5 text-sm font-semibold hover:bg-rose ${
                    isActive(item.href) ? 'bg-rose text-maroon font-bold' : 'text-charcoal'
                  }`}
                >
                  {getLabel(item.key)}
                </Link>
              </li>
            )
          )}
          <li className="pt-3 pb-2">
            <AccountLink
              loginHref={href('/login')}
              profileHref={href('/profile')}
              loginLabel={labels.login}
              accountLabel={labels.account}
              className="block w-full rounded-md border-2 border-maroon py-2 text-center text-xs font-bold text-maroon hover:bg-maroon hover:text-white transition-colors"
            />
          </li>
        </ul>
      </nav>
    </header>
  );
}