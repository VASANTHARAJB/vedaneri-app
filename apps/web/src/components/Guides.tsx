import type { Locale } from '@/lib/i18n';
import type { Dictionary } from '@/lib/dictionary';
import Reveal from './Reveal';
import SectionTitle from './SectionTitle';

// Photos: apps/web/public/images/acharya-1.jpg (lead), acharya-2.jpg, acharya-3.jpg
// Portrait photos, about 800x1000, face in the upper middle. Until they exist, a gradient shows.
const FALLBACK = 'linear-gradient(180deg, #F3E4E1 0%, #7A1C1C 100%)';
const FACE = '50% 12%'; // which part of the photo stays visible

// "Sanskrit Grammar & Thayumanavar Padalgal" -> two tags
const tags = (spec: string) => spec.split(/\s*&\s*/).filter(Boolean);

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
  const [lead, ...others] = t.items;

  return (
    <section aria-labelledby="guides-title" className="relative isolate overflow-hidden bg-gradient-to-b from-white to-rose/60 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        <SectionTitle id="guides-title" title={t.title} subtitle={t.subtitle} />

        {/* 1. Lead acharya: split card with a temple-niche portrait */}
        {lead && (
          <Reveal className="mt-10">
            <article className="group/lead grid overflow-hidden rounded-[2rem] bg-white shadow-xl ring-1 ring-rose lg:grid-cols-[320px_1fr]">
              {/* Maroon niche panel: the photo fills its full height */}
              <div className="relative isolate flex justify-center overflow-hidden bg-maroon px-6 pt-8">
                <Mandala className="absolute -left-24 -top-24 -z-10 h-80 w-80 text-white/[0.08]" />
                <div aria-hidden="true" className="absolute -bottom-10 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-saffron/40 blur-3xl" />
                <div className="flex w-full max-w-[250px] flex-col rounded-t-[9999px] border-2 border-b-0 border-saffron/40 p-2.5 pb-0">
                  <div className="flex flex-1 flex-col rounded-t-[9999px] border-2 border-b-0 border-saffron/80 p-2.5 pb-0">
                    <div className="min-h-[17rem] flex-1 overflow-hidden rounded-t-[9999px] bg-rose">
                      <div
                        role="img"
                        aria-label={lead.name}
                        className="h-full w-full bg-cover transition-transform duration-700 ease-out group-hover/lead:scale-105 motion-reduce:transition-none"
                        style={{ backgroundImage: `url('/images/acharya-1.jpg'), ${FALLBACK}`, backgroundPosition: FACE }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="flex flex-col justify-center p-6 text-center sm:p-8 lg:text-left">
                <span className="inline-block self-center rounded-full border-2 border-maroon px-4 py-1 text-xs font-bold uppercase tracking-wider text-maroon lg:self-start [html[lang='ta']_&]:tracking-normal">
                  {lead.role}
                </span>
                <h3 className="mt-3 font-display text-4xl font-semibold leading-tight text-maroon">{lead.name}</h3>
                <div aria-hidden="true" className="mt-3 flex items-center justify-center gap-3 lg:justify-start">
                  <span className="h-px w-12 bg-saffron" />
                  <span className="h-2 w-2 rotate-45 bg-saffron" />
                  <span className="h-px w-12 bg-saffron" />
                </div>
                <p className="mt-4 text-justify font-serif text-base leading-relaxed text-charcoal/90 hyphens-auto sm:text-lg">{lead.text}</p>
                <div className="mt-6 text-left lg:max-w-lg">
                  <Tags spec={lead.spec} label={t.specLabel} />
                </div>
              </div>
            </article>
          </Reveal>
        )}

        {/* 2. The other two, side by side in one row */}
        <ul className="mt-10 grid gap-6 md:grid-cols-2">
          {others.map((a, idx) => (
            <li key={a.name} className="flex">
              <Reveal delay={(idx + 1) * 120} className="flex w-full">
                <article className="group/card flex w-full flex-col overflow-hidden rounded-2xl bg-white text-center shadow-lg ring-1 ring-rose">
                  {/* Maroon banner with a round medallion portrait */}
                  <div className="relative isolate h-24 overflow-hidden bg-maroon">
                    <Mandala className="absolute -right-10 -top-16 -z-10 h-56 w-56 text-white/[0.1]" />
                    <Mandala className="absolute -left-16 top-2 -z-10 h-40 w-40 text-saffron/[0.2]" />
                  </div>
                  <div className="relative z-10 -mt-16 mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-rose shadow-lg ring-2 ring-saffron">
                    <div
                      role="img"
                      aria-label={a.name}
                      className="h-full w-full bg-cover transition-transform duration-700 ease-out group-hover/card:scale-110 motion-reduce:transition-none"
                      style={{ backgroundImage: `url('/images/acharya-${idx + 2}.jpg'), ${FALLBACK}`, backgroundPosition: FACE }}
                    />
                  </div>

                  <div className="flex flex-1 flex-col px-6 pb-8 pt-4">
                    <span className="mx-auto inline-block rounded-full bg-saffron px-3 py-1 text-xs font-bold uppercase tracking-wider text-charcoal [html[lang='ta']_&]:tracking-normal">
                      {a.role}
                    </span>
                    <h3 className="mt-3 font-display text-2xl font-semibold leading-snug text-maroon">{a.name}</h3>
                    <p className="mt-3 text-justify font-serif text-[0.95rem] leading-relaxed text-charcoal/85 hyphens-auto">{a.text}</p>
                    <div className="mt-auto pt-4">
                      <Tags spec={a.spec} label={t.specLabel} center />
                    </div>
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}