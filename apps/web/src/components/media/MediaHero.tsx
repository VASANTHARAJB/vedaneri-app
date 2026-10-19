import Link from 'next/link';

type Stat = { value: string; label: string };

function Mandala({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" className={className} fill="none" stroke="currentColor" strokeWidth="1.2">
      {[0, 30, 60, 90, 120, 150].map((d) => (
        <ellipse key={d} cx="100" cy="100" rx="22" ry="80" transform={`rotate(${d} 100 100)`} />
      ))}
      <circle cx="100" cy="100" r="80" />
      <circle cx="100" cy="100" r="30" />
    </svg>
  );
}

const ICONS = {
  audio: <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H4zM17 14h3v6h-3z" />,
  video: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" /></>,
  album: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.7" /><path d="M21 16l-5-5-8 8" /></>,
};

// Title band for the Audio, Video and Albums pages: maroon with a mandala, a glowing icon, and a few numbers
export default function MediaHero({
  kind,
  home,
  homeHref,
  current,
  crumbLabel,
  eyebrow,
  title,
  intro,
  stats,
}: {
  kind: keyof typeof ICONS;
  home: string;
  homeHref: string;
  current: string;
  crumbLabel: string;
  eyebrow: string;
  title: string;
  intro: string;
  stats: Stat[];
}) {
  return (
    <section aria-labelledby="media-title" className="relative isolate overflow-hidden bg-gradient-to-br from-maroon via-maroon to-charcoal text-white">
      <Mandala className="absolute -right-28 -top-28 -z-10 h-[34rem] w-[34rem] text-white/10" />
      <Mandala className="absolute -bottom-40 -left-24 -z-10 h-80 w-80 text-saffron/20" />

      <nav aria-label={crumbLabel} className="mx-auto max-w-7xl px-4 pt-6 text-sm text-white/80 lg:px-8">
        <ol className="flex flex-wrap items-center gap-2">
          <li><Link href={homeHref} className="underline-offset-4 hover:text-white hover:underline">{home}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-semibold text-white">{current}</li>
        </ol>
      </nav>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-20 pt-8 sm:pb-24 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-2xl">
          <span aria-hidden="true" className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-saffron/20 text-saffron ring-1 ring-saffron/60" style={{ boxShadow: '0 0 40px rgba(217,119,6,0.45)' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[kind]}</svg>
          </span>
          <p className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-saffron [html[lang='ta']_&]:tracking-normal">{eyebrow}</p>
          <h1 id="media-title" className="animate-fade-up mt-2 font-display text-5xl font-semibold leading-[1.1] !text-white motion-reduce:animate-none sm:text-6xl lg:text-7xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-4xl [html[lang='ta']_&]:sm:text-5xl [html[lang='ta']_&]:lg:text-6xl">{title}</h1>
          <div aria-hidden="true" className="mt-4 flex items-center gap-3"><span className="h-px w-14 bg-saffron" /><span className="h-2 w-2 rotate-45 bg-saffron" /><span className="h-px w-14 bg-saffron" /></div>
          <p className="mt-5 font-serif text-lg leading-relaxed text-white/90 sm:text-xl">{intro}</p>
        </div>

        <dl className="grid grid-cols-3 gap-3 sm:gap-4 lg:w-[26rem]">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/20 bg-white/10 px-3 py-4 text-center backdrop-blur-sm">
              <dd className="font-display text-3xl font-semibold leading-none text-white sm:text-4xl">{s.value}</dd>
              <dt className="mt-2 text-xs font-semibold uppercase tracking-wider text-white/80 [html[lang='ta']_&]:tracking-normal">{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      <svg aria-hidden="true" viewBox="0 0 1440 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-8 w-full text-white sm:h-10">
        <path d="M0 40V18C240 -2 480 -2 720 14S1200 34 1440 12V40Z" fill="currentColor" />
      </svg>
    </section>
  );
}
