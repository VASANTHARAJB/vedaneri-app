'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NAV } from '@/lib/nav';
import { locales, type Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';

type Props = {
  locale: Locale;
  siteName: string;
  tagline: string;
  labels: Dictionary['nav'];
  a11y: Dictionary['a11y'];
};

const LANG_LABEL: Record<Locale, string> = { en: 'EN', ta: 'தமிழ்' };

// "/ta/audio" -> "/audio", "/en" -> "/"
const stripLocale = (p: string) => p.replace(/^\/(en|ta)(?=\/|$)/, '') || '/';

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function Header({ locale, siteName, tagline, labels, a11y }: Props) {
  const pathname = usePathname();
  const path = stripLocale(pathname);

  const [mobileOpen, setMobileOpen] = useState(false);              // hamburger panel
  const [open, setOpen] = useState<string | null>(null);             // desktop: key of the open dropdown
  const [mobileSub, setMobileSub] = useState<string | null>(null);   // mobile: key of the open accordion
  const navRef = useRef<HTMLElement>(null);

  const href = (h: string) => `/${locale}${h}`;
  const isActive = (h: string) => (h === '' ? path === '/' : path === h || path.startsWith(`${h}/`));

  // Typed label lookup: TypeScript errors if a nav key is missing from en.json.
  // The "?? key" only protects the page at runtime (for example a key missing from ta.json).
  const getLabel = (key: keyof Dictionary['nav']): string => labels[key] ?? key;

  // Close every menu after navigating to another page
  useEffect(() => {
    setMobileOpen(false);
    setOpen(null);
    setMobileSub(null);
  }, [pathname]);

  // Desktop dropdowns: close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const linkBase =
    'inline-flex items-center whitespace-nowrap border-b-2 px-3 py-2 text-[15px] font-medium transition-colors';
  const linkClass = (active: boolean) =>
    `${linkBase} ${active ? 'border-saffron text-maroon' : 'border-transparent text-charcoal hover:text-maroon'}`;

  // EN | தமிழ் switch: same page, other language
  const languageSwitch = (
    <div
      role="group"
      aria-label={a11y.language}
      className="inline-flex rounded-full border border-rose bg-white p-0.5 text-sm font-semibold"
    >
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}${path === '/' ? '' : path}`}
          lang={l}
          hrefLang={l}
          aria-current={l === locale ? 'true' : undefined}
          className={`rounded-full px-3 py-1 ${l === locale ? 'bg-maroon text-white' : 'text-charcoal hover:bg-rose'}`}
        >
          {LANG_LABEL[l]}
        </Link>
      ))}
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-rose bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
        {/* Brand: replace with the ashram logo image when supplied */}
        <Link href={href('')} className="flex shrink-0 items-center gap-3 leading-tight">
          <span className="flex flex-col">
            <span className="brand-name font-serif text-[1.75rem] font-bold leading-none text-maroon">
              {siteName}
            </span>
            <span className="hidden truncate text-xs text-charcoal/70 2xl:block">{tagline}</span>
          </span>
        </Link>

        {/* Desktop menu */}
        <nav ref={navRef} aria-label={a11y.mainNavigation} className="hidden min-w-0 xl:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) =>
              'children' in item ? (
                <li
                  key={item.key}
                  className="relative"
                  onMouseEnter={() => setOpen(item.key)}
                  onMouseLeave={() => setOpen(null)}
                >
                  <button
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={open === item.key}
                    onClick={() => setOpen(item.key)}
                    className={`${linkClass(item.children.some((c) => isActive(c.href)))} inline-flex items-center gap-1`}
                  >
                    {getLabel(item.key)}
                    <Chevron open={open === item.key} />
                  </button>
                  {open === item.key && (
                    <ul className="absolute left-0 top-full z-50 w-max min-w-[14rem] max-w-xs rounded-lg border border-rose bg-white py-1 shadow-lg">
                      {item.children.map((c) => (
                        <li key={c.key}>
                          <Link
                            href={href(c.href)}
                            aria-current={isActive(c.href) ? 'page' : undefined}
                            className={`block px-4 py-2 text-[15px] hover:bg-rose hover:text-maroon ${
                              isActive(c.href) ? 'font-semibold text-maroon' : 'text-charcoal'
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
              ),
            )}
          </ul>
        </nav>

        {/* Right side: language switch, login, hamburger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {languageSwitch}
          <Link
            href={href('/login')}
            className="hidden rounded-md border-2 border-maroon px-4 py-1.5 text-[15px] font-semibold text-maroon transition-colors hover:bg-maroon hover:text-white xl:inline-flex"
          >
            {getLabel('login')}
          </Link>
          <button
            type="button"
            className="rounded-md p-2 text-maroon xl:hidden"
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

      {/* Mobile menu */}
      <nav
        id="mobile-menu"
        aria-label={a11y.mainNavigation}
        className={`border-t border-rose bg-white xl:hidden ${mobileOpen ? '' : 'hidden'}`}
      >
        <ul className="mx-auto max-w-7xl px-4 py-2">
          {NAV.map((item) =>
            'children' in item ? (
              <li key={item.key}>
                <button
                  type="button"
                  aria-expanded={mobileSub === item.key}
                  onClick={() => setMobileSub((k) => (k === item.key ? null : item.key))}
                  className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left font-medium text-charcoal hover:bg-rose"
                >
                  {getLabel(item.key)}
                  <Chevron open={mobileSub === item.key} />
                </button>
                {mobileSub === item.key && (
                  <ul className="mb-1 ml-3 border-l-2 border-saffron">
                    {item.children.map((c) => (
                      <li key={c.key}>
                        <Link
                          href={href(c.href)}
                          className={`block px-4 py-2.5 hover:bg-rose ${
                            isActive(c.href) ? 'font-semibold text-maroon' : 'text-charcoal'
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
                  className={`block rounded-md px-3 py-3 font-medium hover:bg-rose ${
                    isActive(item.href) ? 'bg-rose text-maroon' : 'text-charcoal'
                  }`}
                >
                  {getLabel(item.key)}
                </Link>
              </li>
            ),
          )}
          <li className="px-3 pb-3 pt-2">
            <Link
              href={href('/login')}
              className="block rounded-md border-2 border-maroon py-2.5 text-center font-semibold text-maroon hover:bg-maroon hover:text-white"
            >
              {getLabel('login')}
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}