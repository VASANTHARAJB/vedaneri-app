// =============================================================================
//  VedaNeri home page revamp  -  one-time installer (run once, safe to re-run)
//
//  Usage (from the vedaneri-app folder, the one that contains "apps"):
//      node vedaneri-home-revamp.mjs
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
 "src/app/globals.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n@layer base {\n  html { scroll-behavior: smooth; }\n  body { @apply bg-white font-sans text-[1.0625rem] leading-relaxed text-charcoal antialiased; }\n  html[lang='ta'] body { line-height: 1.8; } /* Tamil needs a little more line height */\n  h1, h2, h3, h4 { @apply font-serif font-bold leading-tight text-maroon; }\n  /* Tamil capitals are visually larger than Latin, so the Tamil brand name is set smaller */\n  html[lang='ta'] .brand-name { font-size: 1.4rem; }\n  /* Tamil has no capital letters and must not be letter-spaced: keep the hero title natural */\n  html[lang='ta'] .hero-title { letter-spacing: 0; text-transform: none; font-size: clamp(2rem, 4.4vw, 3.75rem); line-height: 1.2; }\n  :focus-visible { outline: 2px solid theme('colors.saffron'); outline-offset: 2px; }\n  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }\n}\n",
 "src/app/[locale]/page.tsx": "import { notFound } from 'next/navigation';\nimport Acharyas from '@/components/Acharyas';\nimport Events from '@/components/Events';\nimport Hero from '@/components/Hero';\nimport Pillars from '@/components/Pillars';\nimport QuoteSlider from '@/components/QuoteSlider';\nimport { getDictionary } from '@/lib/dictionary';\nimport { isLocale } from '@/lib/i18n';\n\nexport default async function Home({ params }: { params: Promise<{ locale: string }> }) {\n  const { locale } = await params;\n  if (!isLocale(locale)) notFound();\n  const t = getDictionary(locale);\n  return (\n    <main>\n      <Hero locale={locale} t={t.hero} />\n      <Pillars locale={locale} t={t.pillars} />\n      <Events locale={locale} t={t.events} />\n      <QuoteSlider t={t.quotes} />\n      <Acharyas t={t.acharyas} />\n    </main>\n  );\n}\n",
 "src/lib/site.ts": "// Contact details used in the footer. Fill these in; an empty value is simply not shown.\nexport const SITE = {\n  phones: [] as string[],               // e.g. ['+91 98765 43210', '+91 98765 43211']\n  email: '',                            // e.g. 'info@vedaneri.org'\n  youtube: '',                          // full URL of the YouTube channel\n  whatsapp: '',                         // full URL, e.g. 'https://wa.me/919876543210'\n};\n",
 "src/components/Hero.tsx": "import Link from 'next/link';\nimport type { Locale } from '@/lib/i18n';\nimport type { Dictionary } from '@/lib/dictionary';\n\ntype Props = { locale: Locale; t: Dictionary['hero'] };\n\n// Photos go in apps/web/public/images/ . Until they exist, these palette gradients show instead.\nconst BG_FALLBACK = 'linear-gradient(135deg, #231A18 0%, #7A1C1C 100%)'; // charcoal to maroon\nconst PHOTO_FALLBACK = 'linear-gradient(180deg, #F3E4E1 0%, #7A1C1C 100%)'; // rose to maroon\n\nfunction Flame() {\n  return (\n    <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\" className=\"shrink-0 text-saffron\">\n      <path d=\"M12 2c.6 3.2 4.5 5.4 4.5 10a4.5 4.5 0 0 1-9 0c0-2 .9-3.2 1.8-4.4.4 1.2 1 1.8 1.7 2C11.3 7.7 11.6 5 12 2z\" />\n    </svg>\n  );\n}\n\nfunction Arrow() {\n  return (\n    <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.5\"\n      strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"\n      className=\"transition-transform duration-300 group-hover:translate-x-1\">\n      <path d=\"M5 12h14M13 6l6 6-6 6\" />\n    </svg>\n  );\n}\n\nexport default function Hero({ locale, t }: Props) {\n  const href = (p: string) => `/${locale}${p}`;\n\n  return (\n    <section aria-labelledby=\"hero-title\" className=\"relative isolate overflow-hidden bg-charcoal text-white\">\n      {/* 1. Background photo with a very slow zoom */}\n      <div aria-hidden=\"true\"\n        className=\"absolute inset-0 -z-20 animate-kenburns bg-cover bg-center motion-reduce:animate-none\"\n        style={{ backgroundImage: `url('/images/hero-bg.jpg'), ${BG_FALLBACK}` }} />\n      {/* 2. Overlays keep the text readable: dark on the left, photo opens up on the right */}\n      <div aria-hidden=\"true\" className=\"absolute inset-0 -z-10 bg-gradient-to-r from-charcoal/90 via-charcoal/60 to-charcoal/20\" />\n      <div aria-hidden=\"true\" className=\"absolute inset-0 -z-10 bg-gradient-to-t from-charcoal/70 via-transparent to-charcoal/30\" />\n\n      <div className=\"mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-12 sm:pb-24 sm:pt-16 lg:min-h-[640px] lg:grid-cols-[340px_1fr] lg:gap-16 lg:px-8 lg:pb-32 lg:pt-20\">\n        {/* Arch portrait */}\n        <div className=\"animate-fade-up mx-auto w-56 motion-reduce:animate-none sm:w-64 lg:w-[340px]\" style={{ animationDelay: '100ms' }}>\n          <div className=\"relative animate-float motion-reduce:animate-none\">\n            <div aria-hidden=\"true\" className=\"absolute -inset-3 rounded-t-[9999px] rounded-b-[2rem] border border-saffron/50\" />\n            <div role=\"img\" aria-label={t.photoAlt}\n              className=\"relative aspect-[5/7] overflow-hidden rounded-b-[1.5rem] rounded-t-[9999px] border-[3px] border-saffron bg-cover bg-top shadow-[0_0_60px_rgba(217,119,6,0.35)]\"\n              style={{ backgroundImage: `url('/images/swamiji.jpg'), ${PHOTO_FALLBACK}` }} />\n          </div>\n        </div>\n\n        {/* Words */}\n        <div className=\"text-center lg:text-left\">\n          <p className=\"animate-fade-up inline-flex max-w-full items-center gap-2 rounded-full border border-saffron/70 bg-charcoal/40 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm motion-reduce:animate-none sm:text-base\"\n            style={{ animationDelay: '200ms' }}>\n            <Flame />\n            <span>{t.pill}</span>\n          </p>\n\n          <h1 id=\"hero-title\"\n            className=\"hero-title animate-fade-up mt-6 font-display text-[2.5rem] font-semibold uppercase leading-[1.05] tracking-wide text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)] motion-reduce:animate-none sm:text-5xl lg:text-6xl xl:text-7xl\"\n            style={{ animationDelay: '320ms' }}>\n            {t.title.map((line) => (\n              <span key={line} className=\"block\">{line}</span>\n            ))}\n          </h1>\n\n          {/* Ornament */}\n          <div aria-hidden=\"true\" className=\"animate-fade-up mt-6 flex items-center justify-center gap-3 motion-reduce:animate-none lg:justify-start\"\n            style={{ animationDelay: '440ms' }}>\n            <span className=\"h-px w-14 bg-saffron\" />\n            <span className=\"h-2 w-2 rotate-45 bg-saffron\" />\n            <span className=\"h-px w-14 bg-saffron\" />\n          </div>\n\n          <p className=\"animate-fade-up mx-auto mt-6 max-w-xl text-base text-white/90 motion-reduce:animate-none sm:text-lg lg:mx-0\"\n            style={{ animationDelay: '520ms' }}>\n            {t.text}\n          </p>\n\n          <div className=\"animate-fade-up mt-8 flex flex-col items-stretch gap-4 motion-reduce:animate-none sm:flex-row sm:justify-center lg:justify-start\"\n            style={{ animationDelay: '640ms' }}>\n            {/* Dark text on saffron: 5.4:1 contrast. White on saffron is only 3.2:1 and fails the readable-text standard. */}\n            <Link href={href('/sevas')}\n              className=\"group inline-flex items-center justify-center gap-2 rounded-md bg-saffron px-7 py-3.5 text-base font-bold text-charcoal shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl\">\n              {t.primary}\n              <Arrow />\n            </Link>\n            <Link href={href('/audio')}\n              className=\"inline-flex items-center justify-center rounded-md border-2 border-white/90 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-maroon\">\n              {t.secondary}\n            </Link>\n          </div>\n        </div>\n      </div>\n\n      {/* Scroll cue */}\n      <div aria-hidden=\"true\" className=\"absolute bottom-16 left-1/2 hidden -translate-x-1/2 lg:block\">\n        <div className=\"flex h-9 w-6 justify-center rounded-full border-2 border-white/70 pt-1.5\">\n          <span className=\"h-2 w-1 animate-scroll-dot rounded-full bg-white motion-reduce:animate-none\" />\n        </div>\n      </div>\n    </section>\n  );\n}\n",
 "src/components/Reveal.tsx": "'use client';\n\nimport { useEffect, useRef, useState, type ReactNode } from 'react';\n\n// Fades content up when it scrolls into view. Content is visible without JavaScript\n// and for visitors who prefer reduced motion.\nexport default function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {\n  const ref = useRef<HTMLDivElement>(null);\n  const [state, setState] = useState<'shown' | 'hidden'>('shown');\n\n  useEffect(() => {\n    const el = ref.current;\n    if (!el || typeof IntersectionObserver === 'undefined') return;\n    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;\n    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen\n    setState('hidden');\n    const io = new IntersectionObserver(\n      ([entry]) => {\n        if (entry.isIntersecting) {\n          setState('shown');\n          io.disconnect();\n        }\n      },\n      { threshold: 0.12 },\n    );\n    io.observe(el);\n    return () => io.disconnect();\n  }, []);\n\n  return (\n    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}\n      className={`transition duration-700 ease-out ${state === 'hidden' ? 'translate-y-8 opacity-0' : 'translate-y-0 opacity-100'} ${className}`}>\n      {children}\n    </div>\n  );\n}\n",
 "src/components/SectionTitle.tsx": "type Props = { title: string; subtitle?: string; light?: boolean; id?: string };\n\n// Section heading with the golden ornament used across the site.\nexport default function SectionTitle({ title, subtitle, light = false, id }: Props) {\n  return (\n    <div className=\"mx-auto max-w-2xl text-center\">\n      <h2 id={id} className={`text-3xl sm:text-4xl ${light ? 'text-white' : 'text-maroon'}`}>{title}</h2>\n      <div aria-hidden=\"true\" className=\"mt-4 flex items-center justify-center gap-3\">\n        <span className=\"h-px w-12 bg-saffron\" />\n        <span className=\"h-2 w-2 rotate-45 bg-saffron\" />\n        <span className=\"h-px w-12 bg-saffron\" />\n      </div>\n      {subtitle && <p className={`mt-4 ${light ? 'text-white/85' : 'text-charcoal/80'}`}>{subtitle}</p>}\n    </div>\n  );\n}\n",
 "src/components/Pillars.tsx": "import Link from 'next/link';\nimport type { Locale } from '@/lib/i18n';\nimport type { Dictionary } from '@/lib/dictionary';\nimport type { ReactElement } from 'react';\nimport Reveal from './Reveal';\n\ntype Props = { locale: Locale; t: Dictionary['pillars'] };\n\nconst ICONS: Record<string, ReactElement> = {\n  // temple\n  ashram: <path d=\"M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6M12 4V2\" />,\n  // lamp\n  sevas: <path d=\"M12 3c.5 2.2 3 3.6 3 6.2a3 3 0 0 1-6 0c0-1.4.6-2.2 1.2-3 .3.8.7 1.2 1.2 1.4C11.6 6.2 11.8 4.6 12 3zM5 15h14l-2 5H7l-2-5z\" />,\n  // hands holding heart\n  donation: <path d=\"M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z\" />,\n  // open book\n  resources: <path d=\"M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14\" />,\n};\n\nexport default function Pillars({ locale, t }: Props) {\n  return (\n    <section aria-label={t.title} className=\"relative z-10 -mt-12 pb-6 lg:-mt-16\">\n      <div className=\"mx-auto grid max-w-7xl gap-5 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:px-8\">\n        {t.items.map((item, i) => (\n          <Reveal key={item.key} delay={i * 90} className=\"h-full\">\n            <Link href={`/${locale}${item.href}`}\n              className=\"group relative flex h-full flex-col overflow-hidden rounded-xl border border-rose bg-white p-6 shadow-[0_12px_32px_-12px_rgba(35,26,24,0.35)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-12px_rgba(122,28,28,0.45)]\">\n              <span aria-hidden=\"true\" className=\"absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-saffron transition-transform duration-500 group-hover:scale-x-100\" />\n              <span className=\"flex h-14 w-14 items-center justify-center rounded-full bg-rose text-maroon transition-colors duration-300 group-hover:bg-maroon group-hover:text-white\">\n                <svg width=\"26\" height=\"26\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\">\n                  {ICONS[item.key]}\n                </svg>\n              </span>\n              <h3 className=\"mt-5 text-xl\">{item.title}</h3>\n              <p className=\"mt-2 flex-1 text-[0.97rem] text-charcoal/85\">{item.text}</p>\n              <span className=\"mt-5 inline-flex items-center gap-1 text-sm font-semibold text-maroon underline decoration-saffron decoration-2 underline-offset-4\">\n                {t.readMore}\n                <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.5\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"\n                  className=\"transition-transform duration-300 group-hover:translate-x-1\">\n                  <path d=\"M5 12h14M13 6l6 6-6 6\" />\n                </svg>\n              </span>\n            </Link>\n          </Reveal>\n        ))}\n      </div>\n    </section>\n  );\n}\n",
 "src/components/Events.tsx": "import type { Locale } from '@/lib/i18n';\nimport type { Dictionary } from '@/lib/dictionary';\nimport Reveal from './Reveal';\nimport SectionTitle from './SectionTitle';\n\ntype Props = { locale: Locale; t: Dictionary['events'] };\n\nexport default function Events({ locale, t }: Props) {\n  const tag = locale === 'ta' ? 'ta-IN' : 'en-IN';\n  const part = (iso: string, o: Intl.DateTimeFormatOptions) =>\n    new Intl.DateTimeFormat(tag, { timeZone: 'UTC', ...o }).format(new Date(iso));\n  const full = (iso: string) => part(iso, { day: 'numeric', month: 'long', year: 'numeric' });\n\n  return (\n    <section aria-labelledby=\"events-title\" className=\"bg-rose/60 py-16 sm:py-20\">\n      <div className=\"mx-auto max-w-7xl px-4 lg:px-8\">\n        <SectionTitle id=\"events-title\" title={t.title} />\n\n        <div className=\"mt-12 grid gap-6 lg:grid-cols-5 lg:gap-8\">\n          {/* Featured festival */}\n          <Reveal className=\"lg:col-span-2\">\n            <article className=\"relative flex h-full flex-col overflow-hidden rounded-2xl bg-maroon p-7 text-white shadow-xl sm:p-9\">\n              <div aria-hidden=\"true\" className=\"absolute -right-16 -top-16 h-56 w-56 rounded-full border border-saffron/40\" />\n              <div aria-hidden=\"true\" className=\"absolute -right-8 -top-8 h-40 w-40 rounded-full border border-saffron/30\" />\n              <p className=\"inline-flex items-center gap-2 self-start rounded-full border border-rose/50 px-3 py-1 text-sm font-semibold text-rose\">\n                <span className=\"h-2 w-2 rounded-full bg-saffron motion-safe:animate-pulse\" aria-hidden=\"true\" />\n                {t.featuredLabel}\n              </p>\n              <h3 className=\"relative mt-5 text-3xl text-white sm:text-4xl\">{t.featuredTitle}</h3>\n              <dl className=\"relative mt-6 space-y-3 text-white/90\">\n                <div className=\"flex items-start gap-3\">\n                  <svg className=\"mt-1 shrink-0\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\" /><path d=\"M16 3v4M8 3v4M3 11h18\" /></svg>\n                  <dd><time dateTime={t.featuredStart}>{full(t.featuredStart)}</time> – <time dateTime={t.featuredEnd}>{full(t.featuredEnd)}</time></dd>\n                </div>\n                <div className=\"flex items-start gap-3\">\n                  <svg className=\"mt-1 shrink-0\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\" /><path d=\"M12 7v5l3 2\" /></svg>\n                  <dd>{t.featuredTime}</dd>\n                </div>\n              </dl>\n              <p aria-hidden=\"true\" className=\"relative mt-auto pt-8 font-display text-7xl font-semibold leading-none text-white/15 sm:text-8xl\">\n                {part(t.featuredStart, { day: 'numeric' })}–{part(t.featuredEnd, { day: 'numeric' })}\n                <span className=\"mt-2 block text-3xl uppercase tracking-widest text-saffron sm:text-4xl\">{part(t.featuredEnd, { month: 'long' })}</span>\n              </p>\n            </article>\n          </Reveal>\n\n          {/* Yearly programs */}\n          <Reveal delay={120} className=\"lg:col-span-3\">\n            <div className=\"h-full rounded-2xl border border-rose bg-white p-6 shadow-lg sm:p-8\">\n              <h3 className=\"text-2xl\">{t.yearlyTitle}</h3>\n              <ul className=\"mt-5 divide-y divide-rose\">\n                {t.yearly.map((e) => (\n                  <li key={e.date} className=\"flex items-center gap-4 py-3.5\">\n                    <time dateTime={e.date}\n                      className=\"flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-rose text-maroon\">\n                      <span className=\"text-xl font-bold leading-none\">{part(e.date, { day: 'numeric' })}</span>\n                      <span className=\"mt-0.5 text-xs font-semibold uppercase leading-none\">{part(e.date, { month: 'short' })}</span>\n                    </time>\n                    <div className=\"min-w-0\">\n                      <p className=\"font-semibold text-charcoal\">{e.name}</p>\n                      <p className=\"text-sm text-charcoal/70\">{part(e.date, { year: 'numeric' })}</p>\n                    </div>\n                  </li>\n                ))}\n              </ul>\n            </div>\n          </Reveal>\n        </div>\n      </div>\n    </section>\n  );\n}\n",
 "src/components/QuoteSlider.tsx": "'use client';\n\nimport { useEffect, useState } from 'react';\nimport type { Dictionary } from '@/lib/dictionary';\n\nexport default function QuoteSlider({ t }: { t: Dictionary['quotes'] }) {\n  const [i, setI] = useState(0);\n  const [paused, setPaused] = useState(false);\n  const count = t.items.length;\n  const go = (n: number) => setI((n + count) % count);\n\n  useEffect(() => {\n    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;\n    const id = setInterval(() => setI((c) => (c + 1) % count), 7000);\n    return () => clearInterval(id);\n  }, [paused, count]);\n\n  return (\n    <section aria-label={t.label} className=\"relative overflow-hidden bg-maroon py-16 text-white sm:py-24\"\n      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}\n      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>\n      <div aria-hidden=\"true\" className=\"pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-saffron/20\" />\n      <div aria-hidden=\"true\" className=\"pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-saffron/20\" />\n\n      <div className=\"relative mx-auto max-w-4xl px-4 text-center\">\n        <svg aria-hidden=\"true\" width=\"44\" height=\"44\" viewBox=\"0 0 24 24\" fill=\"currentColor\" className=\"mx-auto text-saffron\">\n          <path d=\"M7 7h4v4c0 3-1.5 5-4 6v-2c1-.6 1.5-1.6 1.5-3H7V7zm8 0h4v4c0 3-1.5 5-4 6v-2c1-.6 1.5-1.6 1.5-3H15V7z\" />\n        </svg>\n        <p className=\"mt-2 text-sm font-semibold uppercase tracking-widest text-rose\">{t.label}</p>\n\n        <div aria-live={paused ? 'polite' : 'off'} className=\"mt-6 min-h-[9rem] sm:min-h-[8rem]\">\n          <blockquote key={i} className=\"animate-fade-up font-display text-3xl font-semibold leading-snug text-white motion-reduce:animate-none sm:text-5xl\">\n            “{t.items[i]}”\n          </blockquote>\n        </div>\n\n        <div className=\"mt-8 flex items-center justify-center gap-4\">\n          <button type=\"button\" onClick={() => go(i - 1)} aria-label={t.prev}\n            className=\"flex h-11 w-11 items-center justify-center rounded-full border border-white/60 transition-colors hover:bg-white hover:text-maroon\">\n            <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.5\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"><path d=\"M15 6l-6 6 6 6\" /></svg>\n          </button>\n          <div className=\"flex gap-2\">\n            {t.items.map((_, n) => (\n              <button key={n} type=\"button\" onClick={() => setI(n)} aria-label={`${t.goTo} ${n + 1}`} aria-current={n === i ? 'true' : undefined}\n                className={`h-2.5 rounded-full transition-all duration-300 ${n === i ? 'w-8 bg-saffron' : 'w-2.5 bg-white/60 hover:bg-white'}`} />\n            ))}\n          </div>\n          <button type=\"button\" onClick={() => go(i + 1)} aria-label={t.next}\n            className=\"flex h-11 w-11 items-center justify-center rounded-full border border-white/60 transition-colors hover:bg-white hover:text-maroon\">\n            <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.5\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 6l6 6-6 6\" /></svg>\n          </button>\n        </div>\n      </div>\n    </section>\n  );\n}\n",
 "src/components/Acharyas.tsx": "import type { Dictionary } from '@/lib/dictionary';\nimport Reveal from './Reveal';\nimport SectionTitle from './SectionTitle';\n\n// Photos: apps/web/public/images/acharya-1.jpg, acharya-2.jpg, acharya-3.jpg (portrait, about 600x750).\n// Until they exist, a palette gradient shows instead.\nconst FALLBACK = 'linear-gradient(180deg, #F3E4E1 0%, #7A1C1C 100%)';\n\nexport default function Acharyas({ t }: { t: Dictionary['acharyas'] }) {\n  return (\n    <section aria-labelledby=\"acharyas-title\" className=\"bg-white py-16 sm:py-24\">\n      <div className=\"mx-auto max-w-7xl px-4 lg:px-8\">\n        <SectionTitle id=\"acharyas-title\" title={t.title} subtitle={t.subtitle} />\n        <div className=\"mt-14 grid gap-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8\">\n          {t.items.map((a, n) => (\n            <Reveal key={a.name} delay={n * 120} className=\"sm:last:col-span-2 sm:last:mx-auto sm:last:max-w-sm lg:last:col-span-1 lg:last:max-w-none\">\n              <article className=\"group text-center\">\n                <div className=\"relative mx-auto w-44 sm:w-52\">\n                  <div aria-hidden=\"true\" className=\"absolute -inset-2.5 rounded-t-[9999px] rounded-b-2xl border border-saffron/60 transition-all duration-500 group-hover:-inset-3.5 group-hover:border-saffron\" />\n                  <div role=\"img\" aria-label={a.name}\n                    className=\"relative aspect-[4/5] rounded-b-xl rounded-t-[9999px] border-[3px] border-saffron bg-cover bg-top shadow-lg\"\n                    style={{ backgroundImage: `url('/images/acharya-${n + 1}.jpg'), ${FALLBACK}` }} />\n                </div>\n                <h3 className=\"mt-8 text-2xl\">{a.name}</h3>\n                <p className=\"mt-1 text-sm font-semibold uppercase tracking-wide text-charcoal/70\">{a.role}</p>\n                <p className=\"mx-auto mt-3 max-w-xs text-charcoal/85\">{a.text}</p>\n              </article>\n            </Reveal>\n          ))}\n        </div>\n      </div>\n    </section>\n  );\n}\n",
 "src/components/Footer.tsx": "import Link from 'next/link';\nimport type { Locale } from '@/lib/i18n';\nimport type { Dictionary } from '@/lib/dictionary';\nimport { SITE } from '@/lib/site';\n\ntype Props = { locale: Locale; siteName: string; fullName: string; t: Dictionary['footer'] };\n\nconst linkClass = 'text-white/85 underline-offset-4 transition-colors hover:text-white hover:underline hover:decoration-saffron hover:decoration-2';\n\nexport default function Footer({ locale, siteName, fullName, t }: Props) {\n  const year = new Date().getFullYear();\n  return (\n    <footer className=\"bg-charcoal text-white\">\n      <div aria-hidden=\"true\" className=\"h-1 bg-saffron\" />\n      <div className=\"mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8\">\n        <div>\n          <p className=\"brand-name font-serif text-3xl font-bold text-white\">{siteName}</p>\n          <p className=\"mt-1 text-white/85\">{fullName}</p>\n          <p className=\"mt-4 font-display text-xl italic text-rose\">{t.tagline}</p>\n        </div>\n\n        <nav aria-label={t.linksTitle}>\n          <h2 className=\"font-serif text-lg font-bold text-white\">{t.linksTitle}</h2>\n          <ul className=\"mt-4 space-y-2.5 text-[0.97rem]\">\n            {t.links.map((l) => (\n              <li key={l.href}><Link href={`/${locale}${l.href}`} className={linkClass}>{l.label}</Link></li>\n            ))}\n          </ul>\n        </nav>\n\n        <div>\n          <h2 className=\"font-serif text-lg font-bold text-white\">{t.trustsTitle}</h2>\n          <ul className=\"mt-4 space-y-4 text-[0.97rem]\">\n            {t.trusts.map((x) => (\n              <li key={x.name}>\n                <p className=\"font-semibold uppercase tracking-wide text-white\">{x.name}</p>\n                <p className=\"text-sm text-white/75\">{x.reg}</p>\n              </li>\n            ))}\n          </ul>\n        </div>\n\n        <div>\n          <h2 className=\"font-serif text-lg font-bold text-white\">{t.contactTitle}</h2>\n          <p className=\"mt-4 text-[0.97rem] text-white/85\">{t.address}</p>\n          <ul className=\"mt-3 space-y-2.5 text-[0.97rem]\">\n            {SITE.phones.map((p) => (\n              <li key={p}><a href={`tel:${p.replace(/\\s/g, '')}`} className={linkClass}>{p}</a></li>\n            ))}\n            {SITE.email && <li><a href={`mailto:${SITE.email}`} className={linkClass}>{SITE.email}</a></li>}\n          </ul>\n          <div className=\"mt-5 flex gap-3\">\n            {SITE.youtube && (\n              <a href={SITE.youtube} aria-label={t.youtube} target=\"_blank\" rel=\"noopener noreferrer\"\n                className=\"flex h-10 w-10 items-center justify-center rounded-full border border-white/50 transition-colors hover:border-saffron hover:bg-saffron hover:text-charcoal\">\n                <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5 3-5 3z\" /></svg>\n              </a>\n            )}\n            {SITE.whatsapp && (\n              <a href={SITE.whatsapp} aria-label={t.whatsapp} target=\"_blank\" rel=\"noopener noreferrer\"\n                className=\"flex h-10 w-10 items-center justify-center rounded-full border border-white/50 transition-colors hover:border-saffron hover:bg-saffron hover:text-charcoal\">\n                <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.5L3 21z\" /><path d=\"M9 10c0 3 2 5 5 5l1-1.5-2-1-.8.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.8-1-2L9 10z\" /></svg>\n              </a>\n            )}\n          </div>\n        </div>\n      </div>\n      <div className=\"border-t border-white/15\">\n        <p className=\"mx-auto max-w-7xl px-4 py-5 text-center text-sm text-white/75 lg:px-8\">© {year} {t.rights}</p>\n      </div>\n    </footer>\n  );\n}\n"
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
  "pillars": {
   "title": "Begin your journey",
   "readMore": "Read more",
   "items": [
    {
     "key": "ashram",
     "title": "Ashram",
     "text": "A serene centre for Vedic learning, self-realisation and service.",
     "href": "/about"
    },
    {
     "key": "sevas",
     "title": "Sevas",
     "text": "Offer Go Puja, Archana, Annadhanam and other sacred services.",
     "href": "/sevas"
    },
    {
     "key": "donation",
     "title": "Donation",
     "text": "Support Annadhanam, Veda preservation, cow care and general needs.",
     "href": "/donate"
    },
    {
     "key": "resources",
     "title": "Resources",
     "text": "Listen, watch and read: audios, videos, books and photos.",
     "href": "/audio"
    }
   ]
  },
  "events": {
   "title": "Upcoming Events",
   "featuredLabel": "Now celebrating",
   "featuredTitle": "Sri Saradha Navaratri Peruvila",
   "featuredStart": "2026-10-11",
   "featuredEnd": "2026-10-21",
   "featuredTime": "5:00 PM to 8:30 PM daily",
   "yearlyTitle": "Yearly Programs",
   "yearly": [
    {
     "date": "2026-04-19",
     "name": "Sri Akshaya Tritiya"
    },
    {
     "date": "2026-04-21",
     "name": "Sri Shankara Jayanthi"
    },
    {
     "date": "2026-07-29",
     "name": "Sri Guru Purnima (Sri Vedavyasa Puja), Chathurmasyam begins"
    },
    {
     "date": "2026-11-08",
     "name": "Deepavali Festival"
    },
    {
     "date": "2027-04-15",
     "name": "Sri Rama Navami"
    }
   ]
  },
  "quotes": {
   "label": "Words to reflect on",
   "prev": "Previous quote",
   "next": "Next quote",
   "goTo": "Show quote",
   "items": [
    "Human body is very precious and not easy to get.",
    "One who works for purity of mind never loses."
   ]
  },
  "acharyas": {
   "title": "Acharyas",
   "subtitle": "Guiding seekers on the path of Vedanta",
   "items": [
    {
     "name": "Samananda Saraswati",
     "role": "Named successor",
     "text": "Has taught many Vedantic texts, with a special interest in the songs of Thayumanavar."
    },
    {
     "name": "Purnananda Saraswati",
     "role": "Teacher and editor",
     "text": "Teaches Vedanta, runs classes, organises children's camps and edits the ashram magazine, Vedaneri."
    },
    {
     "name": "Jnanasivananda Saraswati",
     "role": "Longtime associate",
     "text": "Teaches classes in Theni, Dindigul and nearby places."
    }
   ]
  },
  "footer": {
   "tagline": "Peaceful Happiness For All",
   "address": "Chatrapatti Road, Vedapuri, Theni, Tamil Nadu, India 625 531",
   "linksTitle": "Quick links",
   "trustsTitle": "Our trusts",
   "contactTitle": "Contact",
   "trusts": [
    {
     "name": "Vedanta Sasthra Prachara Trust",
     "reg": "Reg. No. 226/1992"
    },
    {
     "name": "Sri Dakshinamurti Seva Samiti",
     "reg": "Reg. No. 500/2002"
    }
   ],
   "links": [
    {
     "label": "Contact Us",
     "href": "/contact"
    },
    {
     "label": "Terms & Conditions",
     "href": "/terms"
    },
    {
     "label": "Privacy Policy",
     "href": "/privacy"
    },
    {
     "label": "Refund & Cancellation Policy",
     "href": "/refund"
    }
   ],
   "rights": "Sri Swami Chidbhavananda Ashramam. All rights reserved.",
   "youtube": "YouTube",
   "whatsapp": "WhatsApp"
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
  "pillars": {
   "title": "உங்கள் பயணத்தைத் தொடங்குங்கள்",
   "readMore": "மேலும் படிக்க",
   "items": [
    {
     "key": "ashram",
     "title": "ஆசிரமம்",
     "text": "வேதக் கல்வி, ஆத்ம ஞானம், சேவை ஆகியவற்றுக்கான அமைதியான மையம்.",
     "href": "/about"
    },
    {
     "key": "sevas",
     "title": "சேவைகள்",
     "text": "கோபூஜை, அர்ச்சனை, அன்னதானம் போன்ற புனித சேவைகளில் பங்கேற்கலாம்.",
     "href": "/sevas"
    },
    {
     "key": "donation",
     "title": "நன்கொடை",
     "text": "அன்னதானம், வேதப் பாதுகாப்பு, பசு பராமரிப்பு மற்றும் பொதுத் தேவைகளுக்கு உதவுங்கள்.",
     "href": "/donate"
    },
    {
     "key": "resources",
     "title": "வளங்கள்",
     "text": "கேளுங்கள், பாருங்கள், படியுங்கள்: ஒலிப்பதிவுகள், காணொளிகள், நூல்கள், படங்கள்.",
     "href": "/audio"
    }
   ]
  },
  "events": {
   "title": "வரவிருக்கும் நிகழ்வுகள்",
   "featuredLabel": "இப்போது நடைபெறுகிறது",
   "featuredTitle": "ஸ்ரீ சாரதா நவராத்திரி பெருவிழா",
   "featuredStart": "2026-10-11",
   "featuredEnd": "2026-10-21",
   "featuredTime": "தினமும் மாலை 5:00 முதல் 8:30 வரை",
   "yearlyTitle": "ஆண்டு நிகழ்ச்சிகள்",
   "yearly": [
    {
     "date": "2026-04-19",
     "name": "ஸ்ரீ அட்சய திருதியை"
    },
    {
     "date": "2026-04-21",
     "name": "ஸ்ரீ சங்கர ஜெயந்தி"
    },
    {
     "date": "2026-07-29",
     "name": "ஸ்ரீ குரு பூர்ணிமா (ஸ்ரீ வேதவியாச பூஜை), சாதுர்மாஸ்யம் தொடக்கம்"
    },
    {
     "date": "2026-11-08",
     "name": "தீபாவளிப் பண்டிகை"
    },
    {
     "date": "2027-04-15",
     "name": "ஸ்ரீ ராம நவமி"
    }
   ]
  },
  "quotes": {
   "label": "சிந்திக்க சில வார்த்தைகள்",
   "prev": "முந்தைய வாசகம்",
   "next": "அடுத்த வாசகம்",
   "goTo": "வாசகத்தைக் காட்டு",
   "items": [
    "மனித உடல் மிகவும் உயர்ந்தது; எளிதில் கிடைக்காதது.",
    "மனத் தூய்மைக்காக உழைப்பவன் ஒருபோதும் இழப்பதில்லை."
   ]
  },
  "acharyas": {
   "title": "ஆசாரியர்கள்",
   "subtitle": "வேதாந்த வழியில் சாதகர்களை வழிநடத்துபவர்கள்",
   "items": [
    {
     "name": "சமானந்த சரஸ்வதி",
     "role": "நியமிக்கப்பட்ட வாரிசு",
     "text": "பல வேதாந்த நூல்களைப் போதித்தவர்; தாயுமானவர் பாடல்களில் தனி ஈடுபாடு கொண்டவர்."
    },
    {
     "name": "பூர்ணானந்த சரஸ்வதி",
     "role": "ஆசிரியர், இதழ் ஆசிரியர்",
     "text": "வேதாந்தம் கற்பிக்கிறார், வகுப்புகள் நடத்துகிறார், குழந்தைகள் முகாம்களை ஒருங்கிணைக்கிறார், ஆசிரம இதழ் வேதநெறியின் ஆசிரியர்."
    },
    {
     "name": "ஞானசிவானந்த சரஸ்வதி",
     "role": "நீண்டகாலத் துணைவர்",
     "text": "தேனி, திண்டுக்கல் மற்றும் அருகிலுள்ள ஊர்களில் வகுப்புகள் நடத்துகிறார்."
    }
   ]
  },
  "footer": {
   "tagline": "அனைவருக்கும் அமைதியான மகிழ்ச்சி",
   "address": "சத்திரப்பட்டி சாலை, வேதபுரி, தேனி, தமிழ்நாடு, இந்தியா 625 531",
   "linksTitle": "விரைவு இணைப்புகள்",
   "trustsTitle": "எங்கள் அறக்கட்டளைகள்",
   "contactTitle": "தொடர்புக்கு",
   "trusts": [
    {
     "name": "வேதாந்த சாஸ்த்ர பிரசார அறக்கட்டளை",
     "reg": "பதிவு எண் 226/1992"
    },
    {
     "name": "ஸ்ரீ தட்சிணாமூர்த்தி சேவா சமிதி",
     "reg": "பதிவு எண் 500/2002"
    }
   ],
   "links": [
    {
     "label": "தொடர்பு கொள்ள",
     "href": "/contact"
    },
    {
     "label": "விதிமுறைகள் மற்றும் நிபந்தனைகள்",
     "href": "/terms"
    },
    {
     "label": "தனியுரிமைக் கொள்கை",
     "href": "/privacy"
    },
    {
     "label": "பணத்திருப்பம் மற்றும் ரத்து கொள்கை",
     "href": "/refund"
    }
   ],
   "rights": "ஸ்ரீ சுவாமி சித்பவானந்த ஆசிரமம். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.",
   "youtube": "யூடியூப்",
   "whatsapp": "வாட்ஸ்அப்"
  }
 }
};

const written = [];
for (const [rel, content] of Object.entries(FILES)) {
  const target = path.join(web, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const old = fs.readFileSync(target, 'utf8');
    if (old === content) { continue; }
    if (!fs.existsSync(target + '.bak')) fs.writeFileSync(target + '.bak', old);
  }
  fs.writeFileSync(target, content);
  written.push(rel);
}
console.log(`Files written: ${written.length}`);
written.forEach((f) => console.log('  + apps/web/' + f));

// Dictionaries: keep everything that exists, add / replace the new keys.
for (const lang of ['en', 'ta']) {
  const file = path.join(web, 'src', 'dictionaries', `${lang}.json`);
  const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  Object.assign(data, DICT[lang]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`Dictionary updated: ${lang}.json`);
}

// Layout: add imports and the Footer once.
const layoutFile = path.join(web, 'src', 'app', '[locale]', 'layout.tsx');
if (fs.existsSync(layoutFile)) {
  let s = fs.readFileSync(layoutFile, 'utf8');
  const before = s;
  const addImport = (line, after) => {
    if (!s.includes(line)) s = s.replace(after, after + '\n' + line);
  };
  addImport("import Footer from '@/components/Footer';", "import Header from '@/components/Header';");
  addImport("import '@fontsource/cormorant-garamond/600.css';", "import Header from '@/components/Header';");
  addImport("import '@fontsource/cormorant-garamond/700.css';", "import '@fontsource/cormorant-garamond/600.css';");
  if (!s.includes('<Footer')) {
    s = s.replace(
      /(\n\s*)\{children\}/,
      "$1{children}$1<Footer locale={locale} siteName={t.site.name} fullName={t.site.tagline} t={t.footer} />",
    );
  }
  if (s !== before) {
    if (!fs.existsSync(layoutFile + '.bak')) fs.writeFileSync(layoutFile + '.bak', before);
    fs.writeFileSync(layoutFile, s);
    console.log('Layout updated: Footer + font imports added');
  }
  if (!s.includes('<Footer')) {
    console.warn('Could not find {children} in layout.tsx. Add this line after it yourself:');
    console.warn("  <Footer locale={locale} siteName={t.site.name} fullName={t.site.tagline} t={t.footer} />");
  }
} else {
  console.warn('layout.tsx not found: add the Footer and the two cormorant-garamond imports yourself.');
}

// Folder for the photos
fs.mkdirSync(path.join(web, 'public', 'images'), { recursive: true });

// Font package
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
       acharya-1.jpg, acharya-2.jpg, acharya-3.jpg (about 600x750)
  2. Fill phone / email / YouTube / WhatsApp in apps/web/src/lib/site.ts
  3. Restart the dev server (Ctrl+C, then: npm run dev -w @vedaneri/web) and hard refresh (Ctrl+Shift+R)
`);
