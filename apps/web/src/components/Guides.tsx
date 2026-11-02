'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';
import Reveal from './Reveal';
import SectionTitle from './SectionTitle';

const FALLBACK = 'linear-gradient(180deg, #F3E4E1 0%, #7A1C1C 100%)';
const FACE = '50% 12%';

const tags = (spec: string) => (spec ? spec.split(/\s*&\s*/).filter(Boolean) : []);

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

function Tags({ spec, label, center = false }: { spec: string; label: string; center?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-charcoal/70 [html[lang='ta']_&]:tracking-normal">{label}</p>
      <ul className={`mt-2 flex flex-wrap gap-2 ${center ? 'justify-center' : ''}`}>
        {tags(spec).map((s) => (
          <li key={s} className="rounded-full border border-saffron/60 bg-rose/60 px-3 py-1 text-sm font-semibold text-maroon">{s}</li>
        ))}
      </ul>
    </div>
  );
}

export default function Guides({ t }: { locale?: Locale; t: Dictionary['guides'] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock scroll and handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Read translated dynamic data directly from t
  const chiefAcharya = t.lead;
  const teachers = t.teachers || [];

  return (
    <section aria-labelledby="guides-title" className="relative isolate overflow-hidden bg-gradient-to-b from-white to-rose/60 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        <SectionTitle id="guides-title" title={t.title} subtitle={t.subtitle} />

        {/* 1. Upper: Two Cards Side by Side */}
        <ul className="mt-10 grid gap-6 md:grid-cols-2">
          {teachers.map((a, idx) => (
            <li key={a.name} className="flex">
              <Reveal delay={idx * 120} className="flex w-full">
                <article className="group/card flex w-full flex-col overflow-hidden rounded-2xl bg-white text-center shadow-lg ring-1 ring-rose">
                  <div className="relative isolate h-24 overflow-hidden bg-maroon">
                    <Mandala className="absolute -right-10 -top-16 -z-10 h-56 w-56 text-white/[0.1]" />
                    <Mandala className="absolute -left-16 top-2 -z-10 h-40 w-40 text-saffron/[0.2]" />
                  </div>

                  <div className="relative z-10 -mt-16 mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-rose shadow-lg ring-2 ring-saffron">
                    <div
                      role="img"
                      aria-label={a.name}
                      className="h-full w-full bg-cover transition-transform duration-700 ease-out group-hover/card:scale-110 motion-reduce:transition-none"
                      style={{ backgroundImage: `url('${a.image}'), ${FALLBACK}`, backgroundPosition: FACE }}
                    />
                  </div>

                  <div className="flex flex-1 flex-col px-6 pb-8 pt-4">
                    <span className="mx-auto inline-block rounded-full bg-saffron px-3 py-1 text-xs font-bold uppercase tracking-wider text-charcoal [html[lang='ta']_&]:tracking-normal">
                      {a.role}
                    </span>
                    <h3 className="mt-3 font-display text-2xl font-semibold leading-snug text-maroon">{a.name}</h3>
                    <p className="mt-3 text-justify font-serif text-[0.95rem] leading-relaxed text-charcoal/85 hyphens-auto">{a.text}</p>
                    <div className="mt-auto pt-6">
                      <Tags spec={a.spec} label={t.specLabel || 'FOCUS'} center />
                    </div>
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>

        {/* 2. Below: Single Wide Lead Card */}
        {chiefAcharya && (
          <Reveal delay={240} className="mt-10">
            <article className="group/lead grid overflow-hidden rounded-[2rem] bg-white shadow-xl ring-1 ring-rose lg:grid-cols-[300px_1fr]">
              <div className="relative isolate flex items-center justify-center overflow-hidden bg-maroon px-6 py-8">
                <Mandala className="absolute -left-20 -top-20 -z-10 h-72 w-72 text-white/[0.08]" />
                <div aria-hidden="true" className="absolute -bottom-10 left-1/2 -z-10 h-60 w-60 -translate-x-1/2 rounded-full bg-saffron/40 blur-3xl" />

                <div className="flex w-full max-w-[220px] flex-col rounded-t-[9999px] border-2 border-b-0 border-saffron/40 p-2 pb-0">
                  <div className="flex flex-1 flex-col rounded-t-[9999px] border-2 border-b-0 border-saffron/80 p-2 pb-0">
                    <div className="h-64 overflow-hidden rounded-t-[9999px] bg-rose">
                      <div
                        role="img"
                        aria-label={chiefAcharya.name}
                        className="h-full w-full bg-cover transition-transform duration-700 ease-out group-hover/lead:scale-105 motion-reduce:transition-none"
                        style={{ backgroundImage: `url('/images/acharya-1.jpg'), ${FALLBACK}`, backgroundPosition: FACE }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center p-6 text-left sm:p-8">
                <div>
                  <span className="inline-block rounded-full border border-maroon px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-maroon [html[lang='ta']_&]:tracking-normal">
                    {chiefAcharya.role}
                  </span>
                </div>

                <p className="mt-3 text-xs font-bold uppercase tracking-widest text-charcoal/70 [html[lang='ta']_&]:tracking-normal">
                  {chiefAcharya.subTitle}
                </p>

                <h3 className="mt-1 font-display text-3xl font-semibold leading-tight text-maroon sm:text-4xl">
                  {chiefAcharya.name}
                </h3>

                <div aria-hidden="true" className="mt-3 flex items-center gap-3">
                  <span className="h-px w-10 bg-saffron" />
                  <span className="h-1.5 w-1.5 rotate-45 bg-saffron" />
                  <span className="h-px w-10 bg-saffron" />
                </div>

                <p className="mt-4 text-justify font-serif text-base leading-relaxed text-charcoal/90 hyphens-auto sm:text-lg">
                  {chiefAcharya.shortBio}
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-maroon px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-maroon/90 focus:outline-none focus:ring-2 focus:ring-saffron"
                  >
                    {t.readMore || 'Read Full Bio'}
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>

                  <div className="w-full sm:w-auto">
                    <Tags spec={chiefAcharya.spec} label={t.specLabel || 'FOCUS'} />
                  </div>
                </div>
              </div>
            </article>
          </Reveal>
        )}
      </div>

      {/* 3. Global Modal Portal */}
      {mounted && isOpen && chiefAcharya && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
            <div className="flex items-center justify-between border-b border-rose/60 bg-gradient-to-r from-maroon to-[#8B2323] px-6 py-4 text-white">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-saffron">
                  {chiefAcharya.role}
                </span>
                <h4 className="font-display text-xl font-semibold sm:text-2xl">
                  {chiefAcharya.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t.close || 'Close'}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition focus:outline-none"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <div className="space-y-4 font-serif text-base leading-relaxed text-charcoal/90">
                {chiefAcharya.paragraphs?.map((para, i) => (
                  <p key={i} className="text-justify hyphens-auto">
                    {para}
                  </p>
                ))}
              </div>

              <div className="mt-8 border-t border-rose/40 pt-4">
                <Tags spec={chiefAcharya.spec} label={t.specLabel || 'FOCUS'} />
              </div>
            </div>

            <div className="border-t border-rose/60 bg-rose/20 px-6 py-3 text-right">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-maroon bg-white px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-maroon hover:bg-rose/40 transition"
              >
                {t.close || 'Close'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}