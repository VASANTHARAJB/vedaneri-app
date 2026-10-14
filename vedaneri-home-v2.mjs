// =============================================================================
//  VedaNeri home page revamp  -  one-time installer (run once, safe to re-run)
//
//  Usage (from the vedaneri-app folder, the one that contains "apps"):
//      node vedaneri-home-v2.mjs
//
//  What it does:
//   1. Writes the new home page files into apps/web (a .bak copy is kept of any
//      file it replaces, only the first time).
//   2. Merges the new text (English + Tamil) into src/dictionaries/en.json and ta.json.
//   3. Adds the Footer and the display-font imports to src/app/[locale]/layout.tsx.
//   4. Installs the one extra font package (@fontsource/cormorant-garamond).
// =============================================================================
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const web = path.join(root, 'apps', 'web');
if (!fs.existsSync(path.join(web, 'src', 'app'))) {
  console.error('Run this from the vedaneri-app folder (the one that contains "apps").');
  process.exit(1);
}

const FILES = {
 "tailwind.config.ts": "import type { Config } from 'tailwindcss';\n\n// ONLY these colours exist in the website. They are sampled from the Figma colour slide.\n// Because `theme.colors` is replaced (not extended), a class like bg-blue-500 or text-gray-600\n// does not exist, so nobody can add an off-palette colour by accident.\nconst config: Config = {\n  content: ['./src/**/*.{ts,tsx}'],\n  theme: {\n    colors: {\n      transparent: 'transparent',\n      current: 'currentColor',\n      white: '#FFFFFF',\n      maroon: '#7A1C1C',   // headings, key buttons\n      saffron: '#D97706',  // primary action, accents (not for small text: 3.2:1 contrast)\n      charcoal: '#231A18', // body text, footer\n      rose: '#F3E4E1',     // panels, highlights, borders\n    },\n    extend: {\n      fontFamily: {\n        // Headings: Lora for English, Noto Serif Tamil for Tamil (the browser picks per letter).\n        serif: ['Lora', '\"Noto Serif Tamil\"', 'Georgia', 'serif'],\n        // Big display headings (hero): Cormorant Garamond, with Tamil falling back to Noto Serif Tamil.\n        display: ['\"Cormorant Garamond\"', '\"Noto Serif Tamil\"', 'Georgia', 'serif'],\n        // Body and menu: Mukta Malar covers English and Tamil in one matching family.\n        sans: ['\"Mukta Malar\"', 'system-ui', 'sans-serif'],\n      },\n      keyframes: {\n        'fade-up': {\n          '0%': { opacity: '0', transform: 'translateY(24px)' },\n          '100%': { opacity: '1', transform: 'none' },\n        },\n        kenburns: {\n          '0%': { transform: 'scale(1)' },\n          '100%': { transform: 'scale(1.1)' },\n        },\n        float: {\n          '0%, 100%': { transform: 'translateY(0)' },\n          '50%': { transform: 'translateY(-8px)' },\n        },\n        'scroll-dot': {\n          '0%': { opacity: '0', transform: 'translateY(0)' },\n          '40%': { opacity: '1' },\n          '100%': { opacity: '0', transform: 'translateY(10px)' },\n        },\n      },\n      animation: {\n        'fade-up': 'fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) both',\n        kenburns: 'kenburns 30s ease-in-out infinite alternate',\n        float: 'float 7s ease-in-out infinite',\n        'scroll-dot': 'scroll-dot 1.8s ease-in-out infinite',\n      },\n    },\n  },\n  plugins: [],\n};\nexport default config;\n",
 "src/app/globals.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n@layer base {\n  html { scroll-behavior: smooth; }\n  body { @apply bg-white font-sans text-[1.0625rem] leading-relaxed text-charcoal antialiased; }\n  html[lang='ta'] body { line-height: 1.8; } /* Tamil needs a little more line height */\n  h1, h2, h3, h4 { @apply font-serif font-bold leading-tight text-maroon; }\n  /* Tamil capitals are visually larger than Latin, so the Tamil brand name is set smaller */\n  html[lang='ta'] .brand-name { font-size: 1.4rem; }\n  /* Tamil has no capital letters and must not be letter-spaced: keep the hero title natural */\n  html[lang='ta'] .hero-title { letter-spacing: 0; text-transform: none; font-size: clamp(2rem, 4.4vw, 3.75rem); line-height: 1.2; }\n  /* Tamil letters are taller: keep section headings a little smaller so they stay on fewer lines */\n  html[lang='ta'] h2.font-display { font-size: clamp(1.75rem, 3.2vw, 2.5rem); line-height: 1.25; }\n  :focus-visible { outline: 2px solid theme('colors.saffron'); outline-offset: 2px; }\n  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }\n}\n",
 "src/app/[locale]/page.tsx": "import { notFound } from 'next/navigation';\nimport AudioBar from '@/components/AudioBar';\nimport CalendarSupport from '@/components/CalendarSupport';\nimport Festival from '@/components/Festival';\nimport Guides from '@/components/Guides';\nimport Hero from '@/components/Hero';\nimport { getDictionary } from '@/lib/dictionary';\nimport { isLocale } from '@/lib/i18n';\n\nexport default async function Home({ params }: { params: Promise<{ locale: string }> }) {\n  const { locale } = await params;\n  if (!isLocale(locale)) notFound();\n  const t = getDictionary(locale);\n  return (\n    <main>\n      <Hero locale={locale} t={t.hero} />\n      <Guides locale={locale} t={t.guides} />\n      <Festival locale={locale} t={t.festival} />\n      <CalendarSupport locale={locale} calendar={t.calendar} support={t.support} />\n      <AudioBar t={t.audioBar} />\n    </main>\n  );\n}\n",
 "src/lib/site.ts": "// Contact details used in the footer and the audio bar. An empty value is simply not shown.\nexport const SITE = {\n  phones: ['+91 4546 252255'] as string[],\n  email: 'contact@vedaneri.org',\n  youtube: '',    // full URL of the YouTube channel\n  whatsapp: '',   // full URL, e.g. 'https://wa.me/919876543210'\n};\n\n// The featured discourse in the audio bar. Put the file in apps/web/public/audio/ and set the path,\n// for example '/audio/upanishad-sara-4.mp3'. Left empty, the player shows \"Audio coming soon\".\nexport const FEATURED_AUDIO = { src: '' };\n",
 "src/components/Hero.tsx": "import Link from 'next/link';\nimport type { Locale } from '@/lib/i18n';\nimport type { Dictionary } from '@/lib/dictionary';\n\ntype Props = { locale: Locale; t: Dictionary['hero'] };\n\n// Photos go in apps/web/public/images/ . Until they exist, these palette gradients show instead.\nconst BG_FALLBACK = 'linear-gradient(135deg, #231A18 0%, #7A1C1C 100%)'; // charcoal to maroon\nconst PHOTO_FALLBACK = 'linear-gradient(180deg, #F3E4E1 0%, #7A1C1C 100%)'; // rose to maroon\n\nfunction Flame() {\n  return (\n    <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\" className=\"shrink-0 text-saffron\">\n      <path d=\"M12 2c.6 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4.4.4 1.2 1 1.8 1.7 2C11.3 7.7 11.6 5 12 2z\" />\n    </svg>\n  );\n}\n\nfunction Arrow() {\n  return (\n    <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.5\"\n      strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"\n      className=\"transition-transform duration-300 group-hover:translate-x-1\">\n      <path d=\"M5 12h14M13 6l6 6-6 6\" />\n    </svg>\n  );\n}\n\nexport default function Hero({ locale, t }: Props) {\n  const href = (p: string) => `/${locale}${p}`;\n\n  return (\n    <section aria-labelledby=\"hero-title\" className=\"relative isolate overflow-hidden bg-charcoal text-white\">\n      {/* 1. Background photo with a very slow zoom */}\n      <div aria-hidden=\"true\"\n        className=\"absolute inset-0 -z-20 animate-kenburns bg-cover bg-center motion-reduce:animate-none\"\n        style={{ backgroundImage: `url('/images/hero-bg.jpg'), ${BG_FALLBACK}` }} />\n      {/* 2. Overlays keep the text readable: dark on the left, photo opens up on the right */}\n      <div aria-hidden=\"true\" className=\"absolute inset-0 -z-10 bg-gradient-to-r from-charcoal/90 via-charcoal/60 to-charcoal/20\" />\n      <div aria-hidden=\"true\" className=\"absolute inset-0 -z-10 bg-gradient-to-t from-charcoal/70 via-transparent to-charcoal/30\" />\n\n      <div className=\"mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:py-16 lg:min-h-[640px] lg:grid-cols-[340px_1fr] lg:gap-16 lg:px-8 lg:py-20\">\n        {/* Arch portrait */}\n        <div className=\"animate-fade-up mx-auto w-56 motion-reduce:animate-none sm:w-64 lg:w-[340px]\" style={{ animationDelay: '100ms' }}>\n          <div className=\"relative animate-float motion-reduce:animate-none\">\n            <div aria-hidden=\"true\" className=\"absolute -inset-3 rounded-t-[9999px] rounded-b-[2rem] border border-saffron/50\" />\n            <div role=\"img\" aria-label={t.photoAlt}\n              className=\"relative aspect-[5/7] overflow-hidden rounded-b-[1.5rem] rounded-t-[9999px] border-[3px] border-saffron bg-cover bg-top shadow-[0_0_60px_rgba(217,119,6,0.35)]\"\n              style={{ backgroundImage: `url('/images/swamiji.jpg'), ${PHOTO_FALLBACK}` }} />\n          </div>\n        </div>\n\n        {/* Words */}\n        <div className=\"text-center lg:text-left\">\n          <p className=\"animate-fade-up inline-flex max-w-full items-center gap-2 rounded-full border border-saffron/70 bg-charcoal/40 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm motion-reduce:animate-none sm:text-base\"\n            style={{ animationDelay: '200ms' }}>\n            <Flame />\n            <span>{t.pill}</span>\n          </p>\n\n          <h1 id=\"hero-title\"\n            className=\"hero-title animate-fade-up mt-6 font-display text-[2.5rem] font-semibold uppercase leading-[1.05] tracking-wide text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)] motion-reduce:animate-none sm:text-5xl lg:text-6xl xl:text-7xl\"\n            style={{ animationDelay: '320ms' }}>\n            {t.title.map((line) => (\n              <span key={line} className=\"block\">{line}</span>\n            ))}\n          </h1>\n\n          {/* Ornament */}\n          <div aria-hidden=\"true\" className=\"animate-fade-up mt-6 flex items-center justify-center gap-3 motion-reduce:animate-none lg:justify-start\"\n            style={{ animationDelay: '440ms' }}>\n            <span className=\"h-px w-14 bg-saffron\" />\n            <span className=\"h-2 w-2 rotate-45 bg-saffron\" />\n            <span className=\"h-px w-14 bg-saffron\" />\n          </div>\n\n          <p className=\"animate-fade-up mx-auto mt-6 max-w-xl text-base text-white/90 motion-reduce:animate-none sm:text-lg lg:mx-0\"\n            style={{ animationDelay: '520ms' }}>\n            {t.text}\n          </p>\n\n          <div className=\"animate-fade-up mt-8 flex flex-col items-stretch gap-4 motion-reduce:animate-none sm:flex-row sm:justify-center lg:justify-start\"\n            style={{ animationDelay: '640ms' }}>\n            {/* Dark text on saffron: 5.4:1 contrast. White on saffron is only 3.2:1 and fails the readable-text standard. */}\n            <Link href={href('/sevas')}\n              className=\"group inline-flex items-center justify-center gap-2 rounded-md bg-saffron px-7 py-3.5 text-base font-bold text-charcoal shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl\">\n              {t.primary}\n              <Arrow />\n            </Link>\n            <Link href={href('/audio')}\n              className=\"inline-flex items-center justify-center rounded-md border-2 border-white/90 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-maroon\">\n              {t.secondary}\n            </Link>\n          </div>\n        </div>\n      </div>\n\n      {/* Scroll cue */}\n      <div aria-hidden=\"true\" className=\"absolute bottom-5 left-1/2 hidden -translate-x-1/2 lg:block\">\n        <div className=\"flex h-9 w-6 justify-center rounded-full border-2 border-white/70 pt-1.5\">\n          <span className=\"h-2 w-1 animate-scroll-dot rounded-full bg-white motion-reduce:animate-none\" />\n        </div>\n      </div>\n    </section>\n  );\n}\n",
 "src/components/Header.tsx": "'use client';\n\nimport Link from 'next/link';\nimport { usePathname } from 'next/navigation';\nimport { useEffect, useRef, useState } from 'react';\nimport { NAV } from '@/lib/nav';\nimport { locales, type Locale } from '@/lib/i18n';\nimport type { Dictionary } from '@/lib/dictionary';\n\ntype Props = {\n  locale: Locale;\n  siteName: string;\n  tagline: string;\n  labels: Dictionary['nav'];\n  a11y: Dictionary['a11y'];\n};\n\nconst LANG_LABEL: Record<Locale, string> = { en: 'EN', ta: 'தமிழ்' };\n\n// \"/ta/audio\" -> \"/audio\", \"/en\" -> \"/\"\nconst stripLocale = (p: string) => p.replace(/^\\/(en|ta)(?=\\/|$)/, '') || '/';\n\nfunction Chevron({ open }: { open: boolean }) {\n  return (\n    <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.5\"\n      strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"\n      className={`transition-transform ${open ? 'rotate-180' : ''}`}>\n      <path d=\"M6 9l6 6 6-6\" />\n    </svg>\n  );\n}\n\nexport default function Header({ locale, siteName, tagline, labels, a11y }: Props) {\n  const pathname = usePathname();\n  const path = stripLocale(pathname);\n\n  const [mobileOpen, setMobileOpen] = useState(false); // hamburger panel\n  const [dropdown, setDropdown] = useState(false);     // desktop \"Discourses\" menu\n  const [mobileSub, setMobileSub] = useState(false);   // mobile \"Discourses\" accordion\n  const dropdownRef = useRef<HTMLLIElement>(null);\n\n  const href = (h: string) => `/${locale}${h}`;\n  const isActive = (h: string) => (h === '' ? path === '/' : path === h || path.startsWith(`${h}/`));\n\n  // Close every menu after navigating to another page\n  useEffect(() => {\n    setMobileOpen(false);\n    setDropdown(false);\n    setMobileSub(false);\n  }, [pathname]);\n\n  // Desktop dropdown: close on outside click or Escape\n  useEffect(() => {\n    if (!dropdown) return;\n    const onDown = (e: MouseEvent) => {\n      if (!dropdownRef.current?.contains(e.target as Node)) setDropdown(false);\n    };\n    const onKey = (e: KeyboardEvent) => {\n      if (e.key === 'Escape') setDropdown(false);\n    };\n    document.addEventListener('mousedown', onDown);\n    document.addEventListener('keydown', onKey);\n    return () => {\n      document.removeEventListener('mousedown', onDown);\n      document.removeEventListener('keydown', onKey);\n    };\n  }, [dropdown]);\n\n  const linkBase = 'inline-flex items-center whitespace-nowrap border-b-2 px-3 py-2 text-[15px] font-medium transition-colors';\n  const linkClass = (active: boolean) =>\n    `${linkBase} ${active ? 'border-saffron text-maroon' : 'border-transparent text-charcoal hover:text-maroon'}`;\n\n  // EN | தமிழ் switch: same page, other language\n  const languageSwitch = (\n    <div role=\"group\" aria-label={a11y.language}\n      className=\"inline-flex rounded-full border border-rose bg-white p-0.5 text-sm font-semibold\">\n      {locales.map((l) => (\n        <Link key={l} href={`/${l}${path === '/' ? '' : path}`} lang={l} hrefLang={l}\n          aria-current={l === locale ? 'true' : undefined}\n          className={`rounded-full px-3 py-1 ${l === locale ? 'bg-maroon text-white' : 'text-charcoal hover:bg-rose'}`}>\n          {LANG_LABEL[l]}\n        </Link>\n      ))}\n    </div>\n  );\n\n  return (\n    <header className=\"sticky top-0 z-50 border-b border-rose bg-white\">\n      <div className=\"mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8\">\n        {/* Brand: replace with the ashram logo image when supplied */}\n        <Link href={href('')} className=\"flex shrink-0 items-center gap-3 leading-tight\">\n          <span aria-hidden=\"true\" className=\"flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maroon text-saffron\">\n            <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 2c.6 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4.4.4 1.2 1 1.8 1.7 2C11.3 7.7 11.6 5 12 2z\" /></svg>\n          </span>\n          <span className=\"flex flex-col\">\n            <span className=\"brand-name font-serif text-[1.75rem] font-bold leading-none text-maroon\">{siteName}</span>\n            <span className=\"hidden truncate text-xs text-charcoal/70 2xl:block\">{tagline}</span>\n          </span>\n        </Link>\n\n        {/* Desktop menu */}\n        <nav aria-label={a11y.mainNavigation} className=\"hidden min-w-0 xl:block\">\n          <ul className=\"flex items-center gap-1\">\n            {NAV.map((item) =>\n              'children' in item ? (\n                <li key={item.key} ref={dropdownRef} className=\"relative\"\n                  onMouseEnter={() => setDropdown(true)} onMouseLeave={() => setDropdown(false)}>\n                  <button type=\"button\" aria-haspopup=\"true\" aria-expanded={dropdown}\n                    onClick={() => setDropdown((o) => !o)}\n                    className={`${linkClass(item.children.some((c) => isActive(c.href)))} inline-flex items-center gap-1`}>\n                    {labels[item.key]}\n                    <Chevron open={dropdown} />\n                  </button>\n                  {dropdown && (\n                    <ul className=\"absolute left-0 top-full z-50 w-48 rounded-lg border border-rose bg-white py-1 shadow-lg\">\n                      {item.children.map((c) => (\n                        <li key={c.key}>\n                          <Link href={href(c.href)} aria-current={isActive(c.href) ? 'page' : undefined}\n                            className={`block px-4 py-2 text-[15px] hover:bg-rose hover:text-maroon ${isActive(c.href) ? 'font-semibold text-maroon' : 'text-charcoal'}`}>\n                            {labels[c.key]}\n                          </Link>\n                        </li>\n                      ))}\n                    </ul>\n                  )}\n                </li>\n              ) : (\n                <li key={item.key}>\n                  <Link href={href(item.href)} aria-current={isActive(item.href) ? 'page' : undefined}\n                    className={linkClass(isActive(item.href))}>\n                    {labels[item.key]}\n                  </Link>\n                </li>\n              ),\n            )}\n          </ul>\n        </nav>\n\n        {/* Right side: language switch, login, hamburger */}\n        <div className=\"flex items-center gap-2 sm:gap-3\">\n          {languageSwitch}\n          <Link href={href('/login')}\n            className=\"hidden rounded-md border-2 border-maroon px-4 py-1.5 text-[15px] font-semibold text-maroon transition-colors hover:bg-maroon hover:text-white xl:inline-flex\">\n            {labels.login}\n          </Link>\n          <button type=\"button\" className=\"rounded-md p-2 text-maroon xl:hidden\"\n            aria-label={mobileOpen ? a11y.closeMenu : a11y.openMenu}\n            aria-expanded={mobileOpen} aria-controls=\"mobile-menu\"\n            onClick={() => setMobileOpen((o) => !o)}>\n            <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"\n              strokeLinecap=\"round\" aria-hidden=\"true\">\n              {mobileOpen ? <path d=\"M6 6l12 12M18 6L6 18\" /> : <path d=\"M4 7h16M4 12h16M4 17h16\" />}\n            </svg>\n          </button>\n        </div>\n      </div>\n\n      {/* Mobile menu */}\n      <nav id=\"mobile-menu\" aria-label={a11y.mainNavigation}\n        className={`border-t border-rose bg-white xl:hidden ${mobileOpen ? '' : 'hidden'}`}>\n        <ul className=\"mx-auto max-w-7xl px-4 py-2\">\n          {NAV.map((item) =>\n            'children' in item ? (\n              <li key={item.key}>\n                <button type=\"button\" aria-expanded={mobileSub} onClick={() => setMobileSub((o) => !o)}\n                  className=\"flex w-full items-center justify-between rounded-md px-3 py-3 text-left font-medium text-charcoal hover:bg-rose\">\n                  {labels[item.key]}\n                  <Chevron open={mobileSub} />\n                </button>\n                {mobileSub && (\n                  <ul className=\"mb-1 ml-3 border-l-2 border-saffron\">\n                    {item.children.map((c) => (\n                      <li key={c.key}>\n                        <Link href={href(c.href)}\n                          className={`block px-4 py-2.5 hover:bg-rose ${isActive(c.href) ? 'font-semibold text-maroon' : 'text-charcoal'}`}>\n                          {labels[c.key]}\n                        </Link>\n                      </li>\n                    ))}\n                  </ul>\n                )}\n              </li>\n            ) : (\n              <li key={item.key}>\n                <Link href={href(item.href)} aria-current={isActive(item.href) ? 'page' : undefined}\n                  className={`block rounded-md px-3 py-3 font-medium hover:bg-rose ${isActive(item.href) ? 'bg-rose text-maroon' : 'text-charcoal'}`}>\n                  {labels[item.key]}\n                </Link>\n              </li>\n            ),\n          )}\n          <li className=\"px-3 pb-3 pt-2\">\n            <Link href={href('/login')}\n              className=\"block rounded-md border-2 border-maroon py-2.5 text-center font-semibold text-maroon hover:bg-maroon hover:text-white\">\n              {labels.login}\n            </Link>\n          </li>\n        </ul>\n      </nav>\n    </header>\n  );\n}\n",
 "src/components/Reveal.tsx": "'use client';\n\nimport { useEffect, useRef, useState, type ReactNode } from 'react';\n\n// Fades content up when it scrolls into view. Content is visible without JavaScript\n// and for visitors who prefer reduced motion.\nexport default function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {\n  const ref = useRef<HTMLDivElement>(null);\n  const [state, setState] = useState<'shown' | 'hidden'>('shown');\n\n  useEffect(() => {\n    const el = ref.current;\n    if (!el || typeof IntersectionObserver === 'undefined') return;\n    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;\n    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen\n    setState('hidden');\n    const io = new IntersectionObserver(\n      ([entry]) => {\n        if (entry.isIntersecting) {\n          setState('shown');\n          io.disconnect();\n        }\n      },\n      { threshold: 0.12 },\n    );\n    io.observe(el);\n    return () => io.disconnect();\n  }, []);\n\n  return (\n    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}\n      className={`transition duration-700 ease-out ${state === 'hidden' ? 'translate-y-8 opacity-0' : 'translate-y-0 opacity-100'} ${className}`}>\n      {children}\n    </div>\n  );\n}\n",
 "src/components/SectionTitle.tsx": "type Props = { title: string; subtitle?: string; id?: string; align?: 'center' | 'left' };\n\nfunction Lamp() {\n  return (\n    <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\" className=\"shrink-0 text-saffron\">\n      <path d=\"M12 2c.6 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4.4.4 1.2 1 1.8 1.7 2C11.3 7.7 11.6 5 12 2z\" />\n    </svg>\n  );\n}\n\n// Section heading with a small golden lamp ornament.\nexport default function SectionTitle({ title, subtitle, id, align = 'center' }: Props) {\n  const center = align === 'center';\n  return (\n    <div className={center ? 'mx-auto max-w-2xl text-center' : ''}>\n      <h2 id={id} className=\"font-display text-4xl font-semibold sm:text-5xl\">{title}</h2>\n      <div aria-hidden=\"true\" className={`mt-4 flex items-center gap-3 ${center ? 'justify-center' : ''}`}>\n        <span className=\"h-px w-10 bg-saffron\" />\n        <Lamp />\n        <span className=\"h-px w-10 bg-saffron\" />\n      </div>\n      {subtitle && <p className=\"mt-4 text-charcoal/85\">{subtitle}</p>}\n    </div>\n  );\n}\n",
 "src/components/Guides.tsx": "import Link from 'next/link';\nimport type { Locale } from '@/lib/i18n';\nimport type { Dictionary } from '@/lib/dictionary';\nimport Reveal from './Reveal';\nimport SectionTitle from './SectionTitle';\n\n// Photos: apps/web/public/images/acharya-1.jpg, acharya-2.jpg, acharya-3.jpg (portrait/square, about 800x800).\nconst FALLBACK = 'linear-gradient(180deg, #F3E4E1 0%, #7A1C1C 100%)';\n\nexport default function Guides({ locale, t }: { locale: Locale; t: Dictionary['guides'] }) {\n  return (\n    <section aria-labelledby=\"guides-title\" className=\"bg-white py-16 sm:py-24\">\n      <div className=\"mx-auto max-w-7xl px-4 lg:px-8\">\n        <SectionTitle id=\"guides-title\" title={t.title} subtitle={t.subtitle} />\n        <div className=\"mt-12 grid gap-6 md:grid-cols-3 lg:gap-8\">\n          {t.items.map((a, n) => (\n            <Reveal key={a.name} delay={n * 110} className=\"h-full\">\n              <article className=\"group flex h-full flex-col overflow-hidden rounded-xl border border-rose bg-white shadow-[0_8px_24px_-14px_rgba(35,26,24,0.45)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_-16px_rgba(122,28,28,0.5)]\">\n                <div className=\"relative aspect-[16/10] overflow-hidden bg-rose\">\n                  <div role=\"img\" aria-label={a.name}\n                    className=\"h-full w-full bg-cover bg-top transition-transform duration-700 group-hover:scale-105\"\n                    style={{ backgroundImage: `url('/images/acharya-${n + 1}.jpg'), ${FALLBACK}` }} />\n                  <span aria-hidden=\"true\" className=\"absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-saffron transition-transform duration-500 group-hover:scale-x-100\" />\n                </div>\n                <div className=\"flex flex-1 flex-col p-6\">\n                  <h3 className=\"font-display text-2xl font-semibold\">{a.name}</h3>\n                  <p className=\"mt-2 inline-flex self-start rounded bg-rose px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-maroon\">{a.role}</p>\n                  <p className=\"mt-4 text-[0.97rem] text-charcoal/85\">{a.text}</p>\n                  <div className=\"mt-auto border-t border-rose pt-4\">\n                    <p className=\"mt-2 text-[0.7rem] font-semibold uppercase tracking-wider text-charcoal/70\">{t.specLabel}</p>\n                    <p className=\"mt-1 font-semibold text-charcoal\">{a.spec}</p>\n                    <Link href={`/${locale}/video`}\n                      className=\"mt-3 inline-flex items-center gap-1 text-sm font-bold text-maroon underline decoration-saffron decoration-2 underline-offset-4\">\n                      {t.viewClasses}\n                      <svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.5\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"\n                        className=\"transition-transform duration-300 group-hover:translate-x-1\"><path d=\"M5 12h14M13 6l6 6-6 6\" /></svg>\n                    </Link>\n                  </div>\n                </div>\n              </article>\n            </Reveal>\n          ))}\n        </div>\n      </div>\n    </section>\n  );\n}\n",
 "src/components/Festival.tsx": "import Link from 'next/link';\nimport type { Locale } from '@/lib/i18n';\nimport type { Dictionary } from '@/lib/dictionary';\nimport FestivalCountdown from './FestivalCountdown';\nimport Reveal from './Reveal';\n\n// Photo: apps/web/public/images/festival.jpg (about 1200x900).\nconst FALLBACK = 'linear-gradient(135deg, #7A1C1C 0%, #231A18 100%)';\n\nexport default function Festival({ locale, t }: { locale: Locale; t: Dictionary['festival'] }) {\n  const tag = locale === 'ta' ? 'ta-IN' : 'en-IN';\n  const f = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { timeZone: 'UTC', ...o }).format(new Date(iso));\n  const range = `${f(t.start, { day: 'numeric' })} – ${f(t.end, { day: 'numeric' })} ${f(t.end, { month: 'long' })} ${f(t.end, { year: 'numeric' })}`;\n\n  return (\n    <section aria-labelledby=\"festival-title\" className=\"border-t border-rose bg-white py-14 sm:py-20\">\n      <div className=\"mx-auto max-w-7xl px-4 lg:px-8\">\n        <Reveal>\n          <div className=\"grid items-center gap-8 rounded-2xl bg-rose/70 p-5 sm:p-8 lg:grid-cols-2 lg:gap-12 lg:p-10\">\n            <div role=\"img\" aria-label={t.photoAlt}\n              className=\"aspect-[4/3] w-full rounded-xl bg-cover bg-center shadow-xl lg:aspect-[5/4]\"\n              style={{ backgroundImage: `url('/images/festival.jpg'), ${FALLBACK}` }} />\n\n            <div>\n              {/* Dark text on saffron: 5.4:1 contrast */}\n              <p className=\"inline-block rounded bg-saffron px-3 py-1 text-xs font-bold uppercase tracking-wider text-charcoal\">{range}</p>\n              <h2 id=\"festival-title\" className=\"mt-4 font-display text-4xl font-semibold sm:text-5xl\">{t.title}</h2>\n              <p className=\"mt-4 text-charcoal/90\">{t.text}</p>\n\n              <p className=\"mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.97rem]\">\n                <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\" className=\"text-saffron\">\n                  <path d=\"M12 3c.5 2.2 3 3.6 3 6.2a3 3 0 0 1-6 0c0-1.4.6-2.2 1.2-3 .3.8.7 1.2 1.2 1.4C11.6 6.2 11.8 4.6 12 3zM5 15h14l-2 5H7l-2-5z\" /></svg>\n                <span className=\"font-semibold\">{t.dailyLabel}</span>\n                <span className=\"font-bold text-maroon\">{t.dailyTime}</span>\n              </p>\n\n              <div className=\"mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between\">\n                <FestivalCountdown t={t} />\n                <Link href={`/${locale}/sevas`}\n                  className=\"inline-flex shrink-0 items-center justify-center rounded-md bg-saffron px-6 py-3 font-bold text-charcoal shadow transition duration-300 hover:-translate-y-0.5 hover:shadow-lg\">\n                  {t.register}\n                </Link>\n              </div>\n            </div>\n          </div>\n        </Reveal>\n      </div>\n    </section>\n  );\n}\n",
 "src/components/FestivalCountdown.tsx": "'use client';\n\nimport { useEffect, useState } from 'react';\nimport type { Dictionary } from '@/lib/dictionary';\n\ntype Props = { t: Dictionary['festival'] };\n\nconst DAY = 86_400_000;\n// Festival times are in Indian Standard Time. Evening puja starts 5:00 PM on the first day, ends 8:30 PM on the last.\nconst at = (iso: string, time: string) => Date.parse(`${iso}T${time}+05:30`);\n\nexport default function FestivalCountdown({ t }: Props) {\n  const [now, setNow] = useState<number | null>(null);\n  useEffect(() => {\n    setNow(Date.now());\n    const id = setInterval(() => setNow(Date.now()), 30_000);\n    return () => clearInterval(id);\n  }, []);\n\n  const start = at(t.start, '17:00:00');\n  const end = at(t.end, '20:30:00');\n  const total = Math.round((at(t.end, '00:00:00') - at(t.start, '00:00:00')) / DAY) + 1;\n\n  // Before the client has measured the time, reserve the space so nothing jumps.\n  if (now === null) return <div className=\"h-[4.5rem]\" aria-hidden=\"true\" />;\n\n  if (now > end) return <p className=\"font-display text-xl font-semibold text-maroon\">{t.ended}</p>;\n\n  if (now >= start) {\n    const n = Math.min(total, Math.floor((now - at(t.start, '00:00:00')) / DAY) + 1);\n    return (\n      <div>\n        <p className=\"inline-flex items-center gap-2 text-sm font-semibold text-charcoal/80\">\n          <span className=\"h-2 w-2 rounded-full bg-saffron motion-safe:animate-pulse\" aria-hidden=\"true\" />\n          {t.inProgress}\n        </p>\n        <p className=\"mt-1 font-display text-3xl font-semibold text-maroon\">{t.dayOf.replace('{n}', String(n)).replace('{total}', String(total))}</p>\n      </div>\n    );\n  }\n\n  const left = start - now;\n  const d = Math.floor(left / DAY);\n  const h = Math.floor((left % DAY) / 3_600_000);\n  const m = Math.floor((left % 3_600_000) / 60_000);\n  const pad = (v: number) => String(v).padStart(2, '0');\n  return (\n    <div>\n      <p className=\"text-sm text-charcoal/75\">{t.countdownLabel}</p>\n      <p className=\"mt-1 font-display text-3xl font-semibold text-maroon\" role=\"timer\">\n        {pad(d)} {t.days} : {pad(h)} {t.hours} : {pad(m)} {t.mins}\n      </p>\n    </div>\n  );\n}\n",
 "src/components/CalendarSupport.tsx": "import Link from 'next/link';\nimport type { ReactElement } from 'react';\nimport type { Locale } from '@/lib/i18n';\nimport type { Dictionary } from '@/lib/dictionary';\nimport Reveal from './Reveal';\nimport SectionTitle from './SectionTitle';\n\ntype Props = { locale: Locale; calendar: Dictionary['calendar']; support: Dictionary['support'] };\n\nconst ICONS: Record<string, ReactElement> = {\n  annadhanam: <path d=\"M4 11h16a8 8 0 0 1-16 0zM8 7c0-1.2 1-1.6 1-3M12 7c0-1.2 1-1.6 1-3M16 7c0-1.2 1-1.6 1-3\" />,\n  go: <path d=\"M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z\" />,\n  veda: <path d=\"M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14\" />,\n};\n\nconst Arrow = () => (\n  <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.5\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"\n    className=\"transition-transform duration-300 group-hover:translate-x-1\"><path d=\"M5 12h14M13 6l6 6-6 6\" /></svg>\n);\n\nexport default function CalendarSupport({ locale, calendar, support }: Props) {\n  const tag = locale === 'ta' ? 'ta-IN' : 'en-IN';\n  const fmt = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });\n  const today = new Date().toISOString().slice(0, 10);\n  // Only upcoming days are shown. The CMS will supply this list later.\n  const upcoming = calendar.items.filter((e) => e.date >= today).slice(0, 4);\n\n  return (\n    <section className=\"border-t border-rose bg-white py-16 sm:py-24\">\n      <div className=\"mx-auto grid max-w-7xl gap-14 px-4 lg:grid-cols-2 lg:gap-16 lg:px-8\">\n        {/* Sacred calendar */}\n        <div aria-labelledby=\"calendar-title\" role=\"region\" className=\"min-w-0\">\n          <SectionTitle id=\"calendar-title\" title={calendar.title} subtitle={calendar.subtitle} align=\"left\" />\n          <ul className=\"mt-8 space-y-3\">\n            {upcoming.map((e, n) => (\n              <li key={e.date}>\n                <Reveal delay={n * 80}>\n                  <Link href={`/${locale}/events`}\n                    className=\"group flex items-center justify-between gap-4 rounded-lg border border-rose bg-white px-5 py-3.5 transition duration-300 hover:border-saffron hover:shadow-md\">\n                    <span className=\"min-w-0\">\n                      <time dateTime={e.date} className=\"block text-xs font-bold uppercase tracking-wide text-maroon\">{fmt.format(new Date(e.date))}</time>\n                      <span className=\"mt-0.5 block font-display text-xl font-semibold text-charcoal\">{e.name}</span>\n                    </span>\n                    <span className=\"inline-flex shrink-0 items-center gap-1 text-sm font-bold text-maroon\">{calendar.details}<Arrow /></span>\n                  </Link>\n                </Reveal>\n              </li>\n            ))}\n          </ul>\n          <Link href={`/${locale}/events`} className=\"group mt-6 inline-flex items-center gap-1 text-sm font-bold text-maroon underline decoration-saffron decoration-2 underline-offset-4\">\n            {calendar.viewAll}<Arrow />\n          </Link>\n        </div>\n\n        {/* Direct support */}\n        <div role=\"region\" aria-labelledby=\"support-title\" className=\"min-w-0\">\n          <SectionTitle id=\"support-title\" title={support.title} subtitle={support.subtitle} align=\"left\" />\n          <ul className=\"mt-8 space-y-3\">\n            {support.items.map((s, n) => (\n              <li key={s.key}>\n                <Reveal delay={n * 80}>\n                  <div className=\"flex items-center gap-4 rounded-lg border border-rose bg-white px-5 py-4 transition duration-300 hover:border-saffron hover:shadow-md\">\n                    <span className=\"flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose text-maroon\">\n                      <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\">{ICONS[s.key]}</svg>\n                    </span>\n                    <div className=\"min-w-0 flex-1\">\n                      <h3 className=\"font-display text-xl font-semibold\">{s.title}</h3>\n                      <p className=\"mt-0.5 text-sm text-charcoal/85\">{s.text}</p>\n                    </div>\n                    <Link href={`/${locale}/donate`}\n                      className=\"shrink-0 rounded-md bg-saffron px-4 py-2 text-sm font-bold text-charcoal transition duration-300 hover:-translate-y-0.5 hover:shadow-md\">\n                      {support.sponsor}\n                    </Link>\n                  </div>\n                </Reveal>\n              </li>\n            ))}\n          </ul>\n        </div>\n      </div>\n    </section>\n  );\n}\n",
 "src/components/AudioBar.tsx": "'use client';\n\nimport { useRef, useState } from 'react';\nimport type { Dictionary } from '@/lib/dictionary';\nimport { FEATURED_AUDIO } from '@/lib/site';\n\nconst SPEEDS = [1, 1.25, 1.5, 2];\nconst mmss = (s: number) => {\n  if (!Number.isFinite(s) || s < 0) return '0:00';\n  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;\n};\n\nexport default function AudioBar({ t }: { t: Dictionary['audioBar'] }) {\n  const ref = useRef<HTMLAudioElement>(null);\n  const [playing, setPlaying] = useState(false);\n  const [time, setTime] = useState(0);\n  const [dur, setDur] = useState(0);\n  const [speed, setSpeed] = useState(1);\n  const [muted, setMuted] = useState(false);\n  const ready = FEATURED_AUDIO.src !== '';\n\n  const toggle = () => {\n    const a = ref.current;\n    if (!a) return;\n    if (a.paused) void a.play(); else a.pause();\n  };\n  const cycleSpeed = () => {\n    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];\n    setSpeed(next);\n    if (ref.current) ref.current.playbackRate = next;\n  };\n\n  return (\n    <section aria-label={t.label} className=\"border-t border-white/10 bg-charcoal text-white\">\n      {ready && (\n        <audio ref={ref} src={FEATURED_AUDIO.src} preload=\"metadata\"\n          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}\n          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}\n          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)} />\n      )}\n      <div className=\"mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:gap-8 lg:px-8\">\n        <div className=\"flex min-w-0 items-center gap-4 lg:w-[26rem]\">\n          <button type=\"button\" onClick={toggle} disabled={!ready} aria-label={playing ? t.pause : t.play}\n            className=\"flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-saffron text-charcoal transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70\">\n            {playing ? (\n              <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M7 5h4v14H7zM13 5h4v14h-4z\" /></svg>\n            ) : (\n              <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M8 5v14l11-7z\" /></svg>\n            )}\n          </button>\n          <div className=\"min-w-0\">\n            <p className=\"truncate font-display text-lg font-semibold\">{t.title}</p>\n            <p className=\"flex flex-wrap items-center gap-2 text-sm text-white/80\">\n              <span className=\"rounded bg-maroon px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-white\">{t.tag}</span>\n              <span className=\"truncate\">{ready ? t.by : t.soon}</span>\n            </p>\n          </div>\n        </div>\n\n        <div className=\"flex flex-1 items-center gap-3 text-xs text-white/80\">\n          <span className=\"w-10 text-right tabular-nums\">{mmss(time)}</span>\n          <input type=\"range\" min={0} max={dur || 1} step={1} value={time} disabled={!ready} aria-label={t.seek}\n            onChange={(e) => { const v = Number(e.target.value); setTime(v); if (ref.current) ref.current.currentTime = v; }}\n            className=\"h-1.5 w-full cursor-pointer accent-[#D97706] disabled:cursor-not-allowed\" />\n          <span className=\"w-10 tabular-nums\">{mmss(dur)}</span>\n        </div>\n\n        <div className=\"flex items-center gap-4 text-sm\">\n          <button type=\"button\" onClick={cycleSpeed} disabled={!ready} aria-label={`${t.speed}: ${speed}x`}\n            className=\"min-w-[3.5rem] rounded border border-white/40 px-2 py-1 font-semibold hover:bg-white hover:text-charcoal disabled:opacity-60\">{speed}x</button>\n          <button type=\"button\" disabled={!ready} aria-label={muted ? t.unmute : t.mute} aria-pressed={muted}\n            onClick={() => { setMuted((m) => !m); if (ref.current) ref.current.muted = !muted; }}\n            className=\"rounded p-1.5 hover:bg-white/15 disabled:opacity-60\">\n            <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\">\n              <path d=\"M11 5L6 9H3v6h3l5 4V5z\" />{muted ? <path d=\"M17 9l5 6M22 9l-5 6\" /> : <path d=\"M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13\" />}\n            </svg>\n          </button>\n          {ready ? (\n            <a href={FEATURED_AUDIO.src} download aria-label={t.download} className=\"rounded p-1.5 hover:bg-white/15\">\n              <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 4v11M7 11l5 5 5-5M5 20h14\" /></svg>\n            </a>\n          ) : null}\n        </div>\n      </div>\n    </section>\n  );\n}\n",
 "src/components/Footer.tsx": "import Link from 'next/link';\nimport type { Locale } from '@/lib/i18n';\nimport type { Dictionary } from '@/lib/dictionary';\nimport { SITE } from '@/lib/site';\n\ntype Props = { locale: Locale; t: Dictionary['footer'] };\n\nconst linkClass = 'text-white/85 underline-offset-4 transition-colors hover:text-white hover:underline hover:decoration-saffron hover:decoration-2';\nconst social = 'flex h-10 w-10 items-center justify-center rounded-full border border-white/50 transition-colors hover:border-saffron hover:bg-saffron hover:text-charcoal';\n\nexport default function Footer({ locale, t }: Props) {\n  const year = new Date().getFullYear();\n  return (\n    <footer className=\"bg-charcoal text-white\">\n      <div className=\"mx-auto grid max-w-7xl gap-12 px-4 py-14 lg:grid-cols-12 lg:px-8\">\n        <div className=\"lg:col-span-5\">\n          <div className=\"flex items-center gap-3\">\n            <span className=\"flex h-10 w-10 items-center justify-center rounded-full bg-saffron text-charcoal\" aria-hidden=\"true\">\n              <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 2c.6 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4.4.4 1.2 1 1.8 1.7 2C11.3 7.7 11.6 5 12 2z\" /></svg>\n            </span>\n            <p className=\"font-display text-2xl font-semibold text-white\">{t.name}</p>\n          </div>\n          <p className=\"mt-5 max-w-md text-white/85\">{t.address}</p>\n          <ul className=\"mt-4 space-y-1.5\">\n            {SITE.phones.map((p) => (\n              <li key={p}><span className=\"text-white/70\">{t.phone}: </span><a href={`tel:${p.replace(/\\s/g, '')}`} className=\"font-semibold text-white underline decoration-saffron decoration-2 underline-offset-4\">{p}</a></li>\n            ))}\n            {SITE.email && (\n              <li><span className=\"text-white/70\">{t.email}: </span><a href={`mailto:${SITE.email}`} className=\"font-semibold text-white underline decoration-saffron decoration-2 underline-offset-4\">{SITE.email}</a></li>\n            )}\n          </ul>\n        </div>\n\n        <nav aria-label={t.linksTitle} className=\"lg:col-span-3\">\n          <h2 className=\"font-display text-xl font-semibold text-rose\">{t.linksTitle}</h2>\n          <ul className=\"mt-4 space-y-2.5\">\n            {t.links.map((l) => (\n              <li key={l.label}><Link href={`/${locale}${l.href}`} className={linkClass}>{l.label}</Link></li>\n            ))}\n          </ul>\n        </nav>\n\n        <div className=\"lg:col-span-4\">\n          <h2 className=\"font-display text-xl font-semibold text-rose\">{t.taxTitle}</h2>\n          <p className=\"mt-4 text-white/85\">{t.tax}</p>\n          <p className=\"mt-3 text-sm text-white/70\">{t.trusts}</p>\n          <div className=\"mt-5 flex gap-3\">\n            {SITE.youtube && (\n              <a href={SITE.youtube} aria-label={t.youtube} target=\"_blank\" rel=\"noopener noreferrer\" className={social}>\n                <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5 3-5 3z\" /></svg>\n              </a>\n            )}\n            {SITE.whatsapp && (\n              <a href={SITE.whatsapp} aria-label={t.whatsapp} target=\"_blank\" rel=\"noopener noreferrer\" className={social}>\n                <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.5L3 21z\" /><path d=\"M9 10c0 3 2 5 5 5l1-1.5-2-1-.8.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.8-1-2L9 10z\" /></svg>\n              </a>\n            )}\n          </div>\n        </div>\n      </div>\n\n      <div className=\"border-t border-white/15\">\n        <div className=\"mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-sm sm:flex-row lg:px-8\">\n          <p className=\"text-center text-white/75 sm:text-left\">© {year} {t.copyright}</p>\n          <p className=\"font-semibold uppercase tracking-widest text-rose\">{t.motto}</p>\n        </div>\n      </div>\n    </footer>\n  );\n}\n"
};
const DICT = {
 "en": {
  "hero": {
   "pill": "Pujyasri Swami Omkarananda Mahaswamigal's",
   "title": [
    "Sri Swami",
    "Chidbhavananda",
    "Ashramam"
   ],
   "text": "Immerse yourself in the traditional wisdom of Upanishads, Bhagavad Gita, and classical Tamil scriptures preserved under the grace of Pujyasri Swami Omkarananda Mahaswamigal.",
   "primary": "Book Seva / Donate",
   "secondary": "Explore Discourses",
   "photoAlt": "A swami standing before a decorated deity idol"
  },
  "footer": {
   "name": "Vedapuri Ashramam",
   "address": "Sri Swami Chidbhavananda Ashramam, Vedapuri, Chatrapatti Road, Theni - 625 531, Tamil Nadu, India.",
   "linksTitle": "Quick Links",
   "links": [
    {
     "label": "Home",
     "href": ""
    },
    {
     "label": "About Lineage",
     "href": "/about"
    },
    {
     "label": "Video Discourses",
     "href": "/video"
    },
    {
     "label": "Seva Sankalpam",
     "href": "/sevas"
    },
    {
     "label": "Corpus Donations",
     "href": "/donate"
    }
   ],
   "taxTitle": "Tax Exemption & Trust",
   "tax": "All donations to the ashram are exempt under Section 80G of the Income Tax Act, 1961. Receipts will be sent instantly via email.",
   "trusts": "Vedanta Sasthra Prachara Trust (Reg. 226/1992) · Sri Dakshinamurti Seva Samiti (Reg. 500/2002)",
   "copyright": "Sri Swami Chidbhavananda Ashramam Trust. Designed for Vedaneri Preservation.",
   "motto": "Dharma Rakshati Rakshitah",
   "phone": "Phone",
   "email": "Email",
   "youtube": "YouTube",
   "whatsapp": "WhatsApp"
  },
  "guides": {
   "title": "Our Spiritual Guides",
   "subtitle": "Meet the resident Acharyas sustaining the sacred traditional lineage of Vedapuri.",
   "specLabel": "Primary specialization",
   "viewClasses": "View Classes",
   "items": [
    {
     "name": "Swami Samananda Saraswati",
     "role": "Designated successor",
     "text": "Deeply dedicated to Thayumanavar Padalgal and classical Tamil Vedanta, bridging language with ultimate truth.",
     "spec": "Sanskrit Grammar & Thayumanavar Padalgal"
    },
    {
     "name": "Swami Jnanasivananda Saraswati",
     "role": "Senior resident teacher",
     "text": "A veteran disciple with 40 years of core Vedanta teaching across South India. Specializes in Prakarana Granthas.",
     "spec": "Upanishad Bhashya & Bhagavad Gita"
    },
    {
     "name": "Swami Purnananda Saraswati",
     "role": "Editor, Vedaneri magazine",
     "text": "Resident teacher leading the monthly publication and spiritual youth camps. Directs the Sanskrit pathasala.",
     "spec": "Vedic Chanting & Youth Vedanta"
    }
   ]
  },
  "festival": {
   "start": "2026-10-12",
   "end": "2026-10-21",
   "title": "Sri Saradha Navaratri Peruvila",
   "text": "Join us for the most auspicious 10 days of celestial worship at Vedapuri. Experience daily evening Chandi Homam, Lalitha Sahasranama Kumkumarchana, and special musical offerings.",
   "dailyLabel": "Daily evening Puja:",
   "dailyTime": "5:00 PM to 8:30 PM IST",
   "countdownLabel": "Countdown to Festival",
   "days": "Days",
   "hours": "Hours",
   "mins": "Mins",
   "inProgress": "Festival in progress",
   "dayOf": "Day {n} of {total}",
   "ended": "This festival has concluded. May its blessings stay with you.",
   "register": "Register Sankalpam",
   "photoAlt": "Priests performing the evening aarti before the decorated Devi"
  },
  "calendar": {
   "title": "Sacred Calendar",
   "subtitle": "Important upcoming mahotsavam and Jayanti days.",
   "details": "Details",
   "viewAll": "View Complete Calendar",
   "items": [
    {
     "date": "2026-11-08",
     "name": "Deepavali Festival"
    },
    {
     "date": "2027-04-14",
     "name": "Tamil New Year & Special Abhishekam"
    },
    {
     "date": "2027-04-15",
     "name": "Sri Rama Navami"
    },
    {
     "date": "2027-09-15",
     "name": "Swami Chidbhavananda Jayanti Aaradhana"
    }
   ]
  },
  "support": {
   "title": "Direct Support",
   "subtitle": "Directly sustain traditional activities of the Ashram.",
   "sponsor": "Sponsor",
   "items": [
    {
     "key": "annadhanam",
     "title": "Nitya Annadhanam",
     "text": "Providing wholesome pure vegetarian food daily to sadhus, spiritual seekers and visitors."
    },
    {
     "key": "go",
     "title": "Go Samrakshanam",
     "text": "Protecting and nurturing local breeds of cows in our traditional ashram Goshala."
    },
    {
     "key": "veda",
     "title": "Veda Patashala Preservation",
     "text": "Supporting resident young students learning traditional Yajur Veda chanting and rituals."
    }
   ]
  },
  "audioBar": {
   "label": "Featured discourse",
   "title": "Upanishad Sara Sangraham - Lecture 4",
   "tag": "Mandukya",
   "by": "by Pujyasri Swami Omkarananda",
   "play": "Play",
   "pause": "Pause",
   "speed": "Playback speed",
   "mute": "Mute",
   "unmute": "Unmute",
   "download": "Download audio",
   "seek": "Seek",
   "soon": "Audio coming soon"
  }
 },
 "ta": {
  "hero": {
   "pill": "பூஜ்யஸ்ரீ சுவாமி ஓங்காரானந்த மகாசுவாமிகளின்",
   "title": [
    "ஸ்ரீ சுவாமி",
    "சித்பவானந்த",
    "ஆசிரமம்"
   ],
   "text": "உபநிடதங்கள், பகவத் கீதை மற்றும் செம்மொழித் தமிழ் நூல்களின் பாரம்பரிய ஞானத்தில் மூழ்குங்கள். பூஜ்யஸ்ரீ சுவாமி ஓங்காரானந்த மகாசுவாமிகளின் அருளால் பாதுகாக்கப்பட்டவை.",
   "primary": "சேவை முன்பதிவு / நன்கொடை",
   "secondary": "சொற்பொழிவுகளை ஆராய்க",
   "photoAlt": "அலங்கரிக்கப்பட்ட தெய்வ உருவத்தின் முன் நிற்கும் சுவாமி"
  },
  "footer": {
   "name": "வேதபுரி ஆசிரமம்",
   "address": "ஸ்ரீ சுவாமி சித்பவானந்த ஆசிரமம், வேதபுரி, சத்திரப்பட்டி சாலை, தேனி - 625 531, தமிழ்நாடு, இந்தியா.",
   "linksTitle": "விரைவு இணைப்புகள்",
   "links": [
    {
     "label": "முகப்பு",
     "href": ""
    },
    {
     "label": "பரம்பரை பற்றி",
     "href": "/about"
    },
    {
     "label": "காணொளிச் சொற்பொழிவுகள்",
     "href": "/video"
    },
    {
     "label": "சேவை சங்கல்பம்",
     "href": "/sevas"
    },
    {
     "label": "நிரந்தர நன்கொடை",
     "href": "/donate"
    }
   ],
   "taxTitle": "வரி விலக்கு & அறக்கட்டளை",
   "tax": "ஆசிரமத்திற்கான அனைத்து நன்கொடைகளும் வருமான வரிச் சட்டம் 1961, பிரிவு 80G இன் கீழ் விலக்கு பெற்றவை. ரசீதுகள் உடனடியாக மின்னஞ்சலில் அனுப்பப்படும்.",
   "trusts": "வேதாந்த சாஸ்த்ர பிரசார அறக்கட்டளை (பதிவு 226/1992) · ஸ்ரீ தட்சிணாமூர்த்தி சேவா சமிதி (பதிவு 500/2002)",
   "copyright": "ஸ்ரீ சுவாமி சித்பவானந்த ஆசிரம அறக்கட்டளை. வேதநெறி பாதுகாப்புக்காக வடிவமைக்கப்பட்டது.",
   "motto": "தர்மோ ரக்ஷதி ரக்ஷித:",
   "phone": "தொலைபேசி",
   "email": "மின்னஞ்சல்",
   "youtube": "யூடியூப்",
   "whatsapp": "வாட்ஸ்அப்"
  },
  "guides": {
   "title": "எங்கள் ஆன்மிக வழிகாட்டிகள்",
   "subtitle": "வேதபுரியின் புனித பாரம்பரியத்தைத் தாங்கி நிற்கும் ஆசாரியர்களைச் சந்தியுங்கள்.",
   "specLabel": "முதன்மைத் துறை",
   "viewClasses": "வகுப்புகளைக் காண்க",
   "items": [
    {
     "name": "சுவாமி சமானந்த சரஸ்வதி",
     "role": "நியமிக்கப்பட்ட வாரிசு",
     "text": "தாயுமானவர் பாடல்கள் மற்றும் செம்மொழித் தமிழ் வேதாந்தத்தில் ஆழ்ந்த ஈடுபாடு கொண்டவர்; மொழியை உயர்ந்த உண்மையுடன் இணைப்பவர்.",
     "spec": "சமஸ்கிருத இலக்கணம் & தாயுமானவர் பாடல்கள்"
    },
    {
     "name": "சுவாமி ஞானசிவானந்த சரஸ்வதி",
     "role": "மூத்த குடியுறை ஆசிரியர்",
     "text": "தென்னிந்தியா முழுவதும் 40 ஆண்டுகள் வேதாந்தம் கற்பித்த அனுபவமிக்க சீடர். பிரகரண கிரந்தங்களில் தேர்ச்சி பெற்றவர்.",
     "spec": "உபநிடத பாஷ்யம் & பகவத் கீதை"
    },
    {
     "name": "சுவாமி பூர்ணானந்த சரஸ்வதி",
     "role": "ஆசிரியர், வேதநெறி இதழ்",
     "text": "மாத இதழையும் ஆன்மிக இளைஞர் முகாம்களையும் வழிநடத்தும் குடியுறை ஆசிரியர். சமஸ்கிருத பாடசாலையை நெறிப்படுத்துகிறார்.",
     "spec": "வேத மந்திர ஓதல் & இளைஞர் வேதாந்தம்"
    }
   ]
  },
  "festival": {
   "start": "2026-10-12",
   "end": "2026-10-21",
   "title": "ஸ்ரீ சாரதா நவராத்திரி பெருவிழா",
   "text": "வேதபுரியில் நடைபெறும் மிகவும் புனிதமான 10 நாள் தெய்வ வழிபாட்டில் இணையுங்கள். தினமும் மாலை சண்டி ஹோமம், லலிதா சகஸ்ரநாம குங்குமார்ச்சனை மற்றும் சிறப்பு இசை நிகழ்ச்சிகள்.",
   "dailyLabel": "தினசரி மாலை பூஜை:",
   "dailyTime": "மாலை 5:00 முதல் 8:30 வரை (IST)",
   "countdownLabel": "விழாவுக்கான நேரம்",
   "days": "நாள்",
   "hours": "மணி",
   "mins": "நிமிடம்",
   "inProgress": "விழா நடைபெறுகிறது",
   "dayOf": "{total} நாட்களில் {n}ஆம் நாள்",
   "ended": "இந்த விழா நிறைவடைந்தது. அதன் அருள் உங்களுடன் இருக்கட்டும்.",
   "register": "சங்கல்பம் பதிவு",
   "photoAlt": "அலங்கரிக்கப்பட்ட தேவிக்கு முன் மாலை ஆரத்தி செய்யும் அர்ச்சகர்கள்"
  },
  "calendar": {
   "title": "புனித நாட்காட்டி",
   "subtitle": "வரவிருக்கும் முக்கிய மகோற்சவ மற்றும் ஜெயந்தி நாட்கள்.",
   "details": "விவரங்கள்",
   "viewAll": "முழு நாட்காட்டியைக் காண்க",
   "items": [
    {
     "date": "2026-11-08",
     "name": "தீபாவளிப் பண்டிகை"
    },
    {
     "date": "2027-04-14",
     "name": "தமிழ்ப் புத்தாண்டு & சிறப்பு அபிஷேகம்"
    },
    {
     "date": "2027-04-15",
     "name": "ஸ்ரீ ராம நவமி"
    },
    {
     "date": "2027-09-15",
     "name": "சுவாமி சித்பவானந்த ஜெயந்தி ஆராதனை"
    }
   ]
  },
  "support": {
   "title": "நேரடி ஆதரவு",
   "subtitle": "ஆசிரமத்தின் பாரம்பரிய பணிகளை நேரடியாகத் தாங்குங்கள்.",
   "sponsor": "ஆதரியுங்கள்",
   "items": [
    {
     "key": "annadhanam",
     "title": "நித்ய அன்னதானம்",
     "text": "சாதுக்கள், ஆன்மிக நாடுவோர், வருகையாளர்களுக்கு தினமும் தூய சைவ உணவு வழங்குதல்."
    },
    {
     "key": "go",
     "title": "கோ சம்ரக்ஷணம்",
     "text": "ஆசிரம கோசாலையில் நாட்டுப் பசு இனங்களைப் பேணிப் பாதுகாத்தல்."
    },
    {
     "key": "veda",
     "title": "வேத பாடசாலை பாதுகாப்பு",
     "text": "யஜுர் வேத ஓதலையும் சடங்குகளையும் கற்கும் இளம் மாணவர்களுக்கு உதவுதல்."
    }
   ]
  },
  "audioBar": {
   "label": "சிறப்புச் சொற்பொழிவு",
   "title": "உபநிடத சார சங்கிரகம் - சொற்பொழிவு 4",
   "tag": "மாண்டூக்யம்",
   "by": "பூஜ்யஸ்ரீ சுவாமி ஓங்காரானந்தர் வழங்கியது",
   "play": "இயக்கு",
   "pause": "நிறுத்து",
   "speed": "இயக்க வேகம்",
   "mute": "ஒலியை நிறுத்து",
   "unmute": "ஒலியை இயக்கு",
   "download": "ஒலிப்பதிவைப் பதிவிறக்கு",
   "seek": "நேரத்தைத் தேர்ந்தெடு",
   "soon": "ஒலிப்பதிவு விரைவில்"
  }
 }
};
const OBSOLETE = ['Pillars', 'Events', 'QuoteSlider', 'Acharyas'].map((n) => `src/components/${n}.tsx`);
const OLD_KEYS = ['pillars', 'events', 'quotes', 'acharyas'];

const written = [];
for (const [rel, content] of Object.entries(FILES)) {
  const target = path.join(web, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const old = fs.readFileSync(target, 'utf8');
    if (old === content) continue;
    if (!fs.existsSync(target + '.bak')) fs.writeFileSync(target + '.bak', old);
  }
  fs.writeFileSync(target, content);
  written.push(rel);
}
console.log(`Files written: ${written.length}`);
written.forEach((f) => console.log('  + apps/web/' + f));

// Components of the first home page version are no longer used: rename so TypeScript ignores them.
for (const rel of OBSOLETE) {
  const target = path.join(web, rel);
  if (fs.existsSync(target)) {
    fs.renameSync(target, target + '.bak');
    console.log('  - apps/web/' + rel + '  (kept as .bak)');
  }
}

// Dictionaries: keep everything else, add / replace the new keys, drop the old home keys.
for (const lang of ['en', 'ta']) {
  const file = path.join(web, 'src', 'dictionaries', `${lang}.json`);
  const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const k of OLD_KEYS) delete data[k];
  Object.assign(data, DICT[lang]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`Dictionary updated: ${lang}.json`);
}

// Layout: font imports and the Footer (new props).
const layoutFile = path.join(web, 'src', 'app', '[locale]', 'layout.tsx');
const FOOTER = '<Footer locale={locale} t={t.footer} />';
if (fs.existsSync(layoutFile)) {
  let s = fs.readFileSync(layoutFile, 'utf8');
  const before = s;
  const addImport = (line, after) => {
    if (!s.includes(line)) s = s.replace(after, after + '\n' + line);
  };
  addImport("import Footer from '@/components/Footer';", "import Header from '@/components/Header';");
  addImport("import '@fontsource/cormorant-garamond/600.css';", "import Header from '@/components/Header';");
  addImport("import '@fontsource/cormorant-garamond/700.css';", "import '@fontsource/cormorant-garamond/600.css';");
  if (/<Footer[^>]*\/>/.test(s)) s = s.replace(/<Footer[^>]*\/>/, FOOTER);
  else s = s.replace(/(\n\s*)\{children\}/, `$1{children}$1${FOOTER}`);
  if (s !== before) {
    if (!fs.existsSync(layoutFile + '.bak')) fs.writeFileSync(layoutFile + '.bak', before);
    fs.writeFileSync(layoutFile, s);
    console.log('Layout updated');
  }
  if (!s.includes(FOOTER)) console.warn(`Could not place the Footer. Add this after {children} in layout.tsx:\n  ${FOOTER}`);
} else {
  console.warn('layout.tsx not found: add the Footer and the two cormorant-garamond imports yourself.');
}

fs.mkdirSync(path.join(web, 'public', 'images'), { recursive: true });
fs.mkdirSync(path.join(web, 'public', 'audio'), { recursive: true });

if (process.env.SKIP_INSTALL !== '1') {
  try {
    console.log('Installing @fontsource/cormorant-garamond ...');
    execSync('npm install -w @vedaneri/web @fontsource/cormorant-garamond', { cwd: root, stdio: 'inherit' });
  } catch {
    console.warn('Install failed. Run this yourself: npm install -w @vedaneri/web @fontsource/cormorant-garamond');
  }
}

console.log(`
Done. Next:
  1. Put photos in apps/web/public/images/ :
       hero-bg.jpg (about 2400x1350), swamiji.jpg (about 800x1000),
       acharya-1.jpg, acharya-2.jpg, acharya-3.jpg (about 800x800, face near the top),
       festival.jpg (about 1200x900)
  2. Fill YouTube / WhatsApp links, and the featured audio file, in apps/web/src/lib/site.ts
  3. Restart the dev server (Ctrl+C, then: npm run dev -w @vedaneri/web) and hard refresh (Ctrl+Shift+R)
`);
