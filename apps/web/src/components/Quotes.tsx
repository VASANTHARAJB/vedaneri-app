'use client';

import { useEffect, useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';

type Props = {
  t: Dictionary['quotes'] & {
    attribution?: string;
  };
};

const pad = (n: number) => String(n).padStart(2, '0');

export default function Quotes({ t }: Props) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = t.items.length;
  const attribution = t.attribution ?? '';

  useEffect(() => {
    if (n < 2 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setI((v) => (v + 1) % n), 9000);
    return () => clearInterval(id);
  }, [n, paused]);

  const go = (d: number) => setI((v) => (v + d + n) % n);
  const btn =
    'flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/50 text-white transition-colors hover:border-saffron hover:bg-saffron hover:text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron';

  return (
    <section
      aria-labelledby="quotes-title"
      className="relative isolate overflow-hidden bg-maroon py-16 text-white sm:py-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Faint mandala watermark */}
      <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute -right-24 -top-24 -z-10 h-[28rem] w-[28rem] text-white/[0.06]" fill="none" stroke="currentColor" strokeWidth="1.2">
        {[0, 30, 60, 90, 120, 150].map((d) => (
          <ellipse key={d} cx="100" cy="100" rx="22" ry="80" transform={`rotate(${d} 100 100)`} />
        ))}
        <circle cx="100" cy="100" r="80" />
        <circle cx="100" cy="100" r="30" />
      </svg>
      {/* Giant quote mark */}
      <span aria-hidden="true" className="pointer-events-none absolute left-4 top-0 -z-10 font-display text-[14rem] leading-none text-saffron/20 sm:left-16 sm:text-[20rem]">“</span>

      <div className="mx-auto max-w-4xl px-4 text-center lg:px-8">
        <h2 id="quotes-title" className="text-sm font-bold uppercase tracking-[0.2em] text-saffron [html[lang='ta']_&]:tracking-normal">
          {t.title}
        </h2>

        <figure className="mt-8 min-h-[9rem]" aria-live={paused ? 'polite' : 'off'}>
          <blockquote
            key={i}
            className="animate-fade-up font-display text-2xl font-medium leading-snug text-white motion-reduce:animate-none sm:text-3xl lg:text-4xl"
          >
            {t.items[i].text}
          </blockquote>
          <figcaption className="mt-8 flex items-center justify-center gap-3 text-white/90">
            <span aria-hidden="true" className="h-px w-10 bg-saffron" />
            <span className="font-semibold">{t.attribution}</span>
            <span aria-hidden="true" className="h-px w-10 bg-saffron" />
          </figcaption>
        </figure>

        {n > 1 && (
          <div className="mt-10 flex items-center justify-center gap-6">
            <button type="button" onClick={() => go(-1)} aria-label={t.prev} className={btn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <p className="font-display text-lg tabular-nums text-white/80" aria-hidden="true">
              <span className="text-2xl font-semibold text-saffron">{pad(i + 1)}</span> / {pad(n)}
            </p>
            <button type="button" onClick={() => go(1)} aria-label={t.next} className={btn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}