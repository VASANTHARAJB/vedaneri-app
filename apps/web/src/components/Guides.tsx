'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';
import Reveal from './Reveal';
import SectionTitle from './SectionTitle';

const FALLBACK = 'linear-gradient(180deg, #F3E4E1 0%, #E9CFCB 100%)';
const FACE = '50% 15%';
const LEAD_FACE = '50% 10%';

// English fallbacks, used only if the dictionary keys are missing
const DEFAULT_GUIDES_TITLE = 'The Spiritual Guide of Pujyasri Swami Omkarananda Mahaswamigal';
const DEFAULT_CHIEF_TITLE = 'Chief Acharya Of Sri Swami Chidbhavananda Ashramam';
const DEFAULT_DAYANANDA_NAME = 'Pujya Sri Swami Dayananda Saraswati';

const DAYANANDA_IMAGE = '/images/acharya-4.jpg';

type Guide = {
  name: string;
  role?: string;
  image: string;
  text: string;
  spec?: string;
};

type ExtraKeys = {
  guidesTitle?: string;
  chiefTitle?: string;
  dayananda?: { name?: string; role?: string; spec?: string; text?: string };
};

// A photo layer, then the soft background. An empty address (a card added in the CMS without a photo) shows only the background.
const bgImg = (u: string) => (u ? `url('${u}'), ${FALLBACK}` : FALLBACK);

const tags = (spec: string) => (spec ? spec.split(/\s*&\s*/).filter(Boolean) : []);

function Divider({ center = true }: { center?: boolean }) {
  return (
    <div aria-hidden="true" className={`flex items-center gap-3 ${center ? 'justify-center' : ''}`}>
      <span className="h-px w-10 bg-saffron" />
      <span className="h-1.5 w-1.5 rotate-45 bg-saffron" />
      <span className="h-px w-10 bg-saffron" />
    </div>
  );
}

function Tags({ spec, label, center = false }: { spec: string; label: string; center?: boolean }) {
  if (!spec) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-charcoal/60 [html[lang='ta']_&]:tracking-normal">{label}</p>
      <ul className={`mt-2 flex flex-wrap gap-2 ${center ? 'justify-center' : ''}`}>
        {tags(spec).map((s) => (
          <li key={s} className="rounded-full border border-saffron/50 px-3 py-1 text-sm font-medium text-maroon">{s}</li>
        ))}
      </ul>
    </div>
  );
}

// leadImage and dayanandaImage are optional: the CMS (Home Page) can replace those two photos.
// The other cards take their photo from the guides list.
export default function Guides({ t, leadImage, dayanandaImage }: { locale?: Locale; t: Dictionary['guides']; leadImage?: string; dayanandaImage?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock scroll and handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsOpen(false); return; }
      // Keep Tab inside the dialog while it is open
      if (e.key === 'Tab' && dialogRef.current) {
        const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'));
        if (items.length === 0) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
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

  // Focus goes into the dialog when it opens, and back to the button when it closes
  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
    else if (wasOpen.current) openerRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen]);

  const extra = t as unknown as ExtraKeys;
  const guidesTitle = extra.guidesTitle || DEFAULT_GUIDES_TITLE;
  const chiefTitle = extra.chiefTitle || DEFAULT_CHIEF_TITLE;

  const chiefAcharya = t.lead;
  const dictTeachers = ((t.teachers || []) as unknown as Guide[]);

  const dayananda: Guide = {
    name: extra.dayananda?.name || DEFAULT_DAYANANDA_NAME,
    role: extra.dayananda?.role || '',
    image: dayanandaImage || DAYANANDA_IMAGE,
    text: extra.dayananda?.text || '',
    spec: extra.dayananda?.spec || '',
  };

  // Order: 1st dictionary card, Dayananda, then the remaining dictionary cards
  const guides: Guide[] =
    dictTeachers.length > 0
      ? [dictTeachers[0], dayananda, ...dictTeachers.slice(1)]
      : [dayananda];

  return (
    <section aria-labelledby="guides-title" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        {/* Row 1 title */}
        <SectionTitle id="guides-title" title={guidesTitle} subtitle={t.subtitle} />

        {/* Row 1: three cards */}
        <ul className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {guides.map((a, idx) => (
            <li key={`${a.name}-${idx}`} className="flex">
              <Reveal delay={idx * 120} className="flex w-full">
                <article className="group/card flex w-full flex-col overflow-hidden rounded-xl border border-saffron/30 bg-white transition-shadow duration-300 hover:shadow-lg">
                  <div className="relative aspect-[4/5] overflow-hidden bg-rose/40">
                    <div
                      role="img"
                      aria-label={a.name}
                      className="absolute inset-0 bg-cover transition-transform duration-700 ease-out group-hover/card:scale-105 motion-reduce:transition-none"
                      style={{ backgroundImage: bgImg(a.image), backgroundPosition: FACE }}
                    />
                  </div>

                  <div className="flex flex-1 flex-col px-6 pb-8 pt-7 text-center">
                    {a.role && (
                      <p className="text-xs font-semibold uppercase tracking-widest text-charcoal/60 [html[lang='ta']_&]:tracking-normal">
                        {a.role}
                      </p>
                    )}
                    <h3 className="mt-2 font-display text-2xl font-semibold leading-snug text-maroon">{a.name}</h3>
                    <div className="mt-4">
                      <Divider />
                    </div>
                    <p className="mt-5 text-justify font-serif text-[0.95rem] leading-relaxed text-charcoal/85 hyphens-auto">{a.text}</p>
                    {a.spec && (
                      <div className="mt-auto pt-6">
                        <Tags spec={a.spec} label={t.specLabel || 'FOCUS'} center />
                      </div>
                    )}
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>

        {/* Row 2: title + single wide card */}
        {chiefAcharya && (
          <>
            <Reveal delay={200} className="mt-20">
              <div className="text-center">
                <h2 id="chief-acharya-title" className="font-display text-3xl font-semibold leading-snug text-maroon sm:text-4xl">
                  {chiefTitle}
                </h2>
                <div className="mt-4">
                  <Divider />
                </div>
              </div>
            </Reveal>

            <Reveal delay={240} className="mt-10">
              <article
                aria-labelledby="chief-acharya-title"
                className="group/lead grid items-center gap-8 rounded-xl border border-saffron/30 bg-white p-6 sm:p-8 lg:grid-cols-[320px_1fr] lg:gap-12 lg:p-10"
              >
                {/* Photo with a thin offset frame */}
                <div className="relative mx-auto w-full max-w-[320px]">
                  <div aria-hidden="true" className="absolute -bottom-3 -right-3 h-full w-full rounded-lg border border-saffron/60" />
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-rose/40">
                    <div
                      role="img"
                      aria-label={chiefAcharya.name}
                      className="absolute inset-0 bg-cover transition-transform duration-700 ease-out group-hover/lead:scale-105 motion-reduce:transition-none"
                      style={{ backgroundImage: bgImg(leadImage || '/images/acharya-1.jpg'), backgroundPosition: LEAD_FACE }}
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-center text-left">
                  <p className="text-xs font-semibold uppercase tracking-widest text-charcoal/60 [html[lang='ta']_&]:tracking-normal">
                    {chiefAcharya.role}
                  </p>

                  <h3 className="mt-2 font-display text-3xl font-semibold leading-tight text-maroon sm:text-4xl">
                    {chiefAcharya.name}
                  </h3>

                  {chiefAcharya.subTitle && (
                    <p className="mt-2 text-sm font-medium text-charcoal/70">{chiefAcharya.subTitle}</p>
                  )}

                  <div className="mt-4">
                    <Divider center={false} />
                  </div>

                  <p className="mt-5 text-justify font-serif text-base leading-relaxed text-charcoal/90 hyphens-auto sm:text-lg">
                    {chiefAcharya.shortBio}
                  </p>

                  <div className="mt-7 flex flex-wrap items-center justify-between gap-5">
                    <button
                      ref={openerRef}
                      type="button"
                      onClick={() => setIsOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-maroon px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-maroon transition hover:bg-maroon hover:text-white focus:outline-none focus:ring-2 focus:ring-saffron"
                    >
                      {t.readMore || 'Read Full Bio'}
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
          </>
        )}
      </div>

      {/* Global Modal Portal */}
      {mounted && isOpen && chiefAcharya && createPortal(
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="chief-modal-title"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10">
            <div className="flex items-start justify-between gap-4 border-b border-saffron/40 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-charcoal/60 [html[lang='ta']_&]:tracking-normal">
                  {chiefAcharya.role}
                </p>
                <h4 id="chief-modal-title" className="mt-1 font-display text-xl font-semibold text-maroon sm:text-2xl">
                  {chiefAcharya.name}
                </h4>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t.close || 'Close'}
                className="rounded-full border border-charcoal/20 p-2 text-charcoal/70 transition hover:bg-rose/40 hover:text-maroon focus:outline-none focus:ring-2 focus:ring-saffron"
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

              <div className="mt-8 border-t border-saffron/30 pt-4">
                <Tags spec={chiefAcharya.spec} label={t.specLabel || 'FOCUS'} />
              </div>
            </div>

            <div className="border-t border-saffron/30 px-6 py-3 text-right">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-maroon px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-maroon transition hover:bg-maroon hover:text-white"
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