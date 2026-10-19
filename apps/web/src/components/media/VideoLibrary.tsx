'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { formatDate } from '@/lib/format';
import { txt } from '@/data/sevas';
import { SERIES, VIDEOS, YOUTUBE_URL, clock, seriesName, type SeriesKey, type VideoItem } from '@/data/media';

type T = Dictionary['video'];
const PAGE = 6;

function PlayBadge({ big = false }: { big?: boolean }) {
  return (
    <span aria-hidden="true" className={`flex items-center justify-center rounded-full bg-saffron text-charcoal shadow-lg transition-transform group-hover:scale-110 ${big ? 'h-20 w-20' : 'h-14 w-14'}`}>
      <svg width={big ? 34 : 24} height={big ? 34 : 24} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
    </span>
  );
}

// Video lectures: a featured lecture, series chips and search, a grid of lectures, and a pop-up player.
export default function VideoLibrary({ t, locale }: { t: T; locale: Locale }) {
  const [series, setSeries] = useState<'all' | SeriesKey>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<VideoItem | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const featured = VIDEOS.find((v) => v.featured) ?? VIDEOS[0];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return VIDEOS.filter((v) => (series === 'all' || v.series === series) && (!q || txt(v.title, locale).toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date));
  }, [series, query, locale]);

  useEffect(() => setLimit(PAGE), [series, query]);

  // The native dialog gives us Esc to close, a focus trap and a dimmed page
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function show(v: VideoItem, e: React.MouseEvent<HTMLElement>) {
    opener.current = e.currentTarget;
    setOpen(v);
  }
  function close() {
    setOpen(null);
    opener.current?.focus();
  }

  const chips = [{ key: 'all' as const, label: t.all }, ...SERIES.map((s) => ({ key: s.key, label: s.name[locale] }))];

  return (
    <div>
      {/* Featured */}
      <section aria-labelledby="featured-title">
        <h2 id="featured-title" className="font-display text-3xl font-semibold text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-2xl [html[lang='ta']_&]:sm:text-3xl">{t.featuredTitle}</h2>
        <button type="button" onClick={(e) => show(featured, e)} aria-label={`${t.watch}: ${txt(featured.title, locale)}`} className="group relative mt-5 block w-full overflow-hidden rounded-2xl bg-charcoal text-left shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-saffron">
          <div className="aspect-[16/9] w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105 sm:aspect-[21/9]" style={{ backgroundImage: `url('${featured.thumb}'), linear-gradient(135deg, #7A1C1C, #231A18)` }} />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/40 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center"><PlayBadge big /></div>
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
            <span className="rounded-full bg-saffron px-3 py-1 text-xs font-bold text-charcoal">{seriesName(featured.series, locale)}</span>
            <p className="mt-3 max-w-3xl font-display text-2xl font-semibold leading-tight text-white sm:text-4xl [html[lang='ta']_&]:!leading-[1.35] [html[lang='ta']_&]:text-xl [html[lang='ta']_&]:sm:text-3xl">{txt(featured.title, locale)}</p>
            <p className="mt-2 hidden max-w-2xl text-white/85 sm:block">{txt(featured.desc, locale)}</p>
            <p className="mt-2 text-sm font-semibold text-white/80">{clock(featured.duration)} · {formatDate(featured.date, locale)}</p>
          </div>
        </button>
      </section>

      {/* Library */}
      <section aria-labelledby="library-title" className="mt-14">
        <h2 id="library-title" className="font-display text-3xl font-semibold text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-2xl [html[lang='ta']_&]:sm:text-3xl">{t.libraryTitle}</h2>

        <div role="group" aria-label={t.filtersLabel} className="mt-5 flex flex-wrap gap-2">
          {chips.map((c) => {
            const on = series === c.key;
            return (
              <button key={c.key} type="button" aria-pressed={on} onClick={() => setSeries(c.key)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${on ? 'bg-saffron text-charcoal ring-saffron' : 'bg-white text-maroon ring-saffron/60 hover:bg-rose'}`}>{c.label}</button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="block sm:w-96">
            <span className="sr-only">{t.searchLabel}</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="w-full rounded-md border border-rose bg-white px-4 py-2.5 text-charcoal placeholder:text-charcoal/50 focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40" />
          </label>
          <p role="status" className="text-sm font-semibold text-charcoal/70">{t.countLabel.replace('{n}', String(shown.length))}</p>
        </div>

        {shown.length > 0 ? (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.slice(0, limit).map((v) => (
              <li key={v.id}>
                <button type="button" onClick={(e) => show(v, e)} aria-label={`${t.watch}: ${txt(v.title, locale)}`} className="group flex h-full w-full flex-col overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 ring-rose transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">
                  <span className="relative block aspect-video w-full overflow-hidden bg-maroon">
                    <span className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: `url('${v.thumb}'), linear-gradient(135deg, #7A1C1C, #231A18)` }} />
                    <span aria-hidden="true" className="absolute inset-0 bg-charcoal/20 transition-colors group-hover:bg-charcoal/40" />
                    <span className="absolute inset-0 flex items-center justify-center"><PlayBadge /></span>
                    <span className="absolute bottom-2 right-2 rounded bg-charcoal/85 px-2 py-0.5 text-xs font-bold tabular-nums text-white">{clock(v.duration)}</span>
                  </span>
                  <span className="flex flex-1 flex-col p-4">
                    <span className="self-start rounded-full bg-rose px-2.5 py-0.5 text-xs font-bold text-maroon">{seriesName(v.series, locale)}</span>
                    <span className="mt-2 font-display text-xl font-semibold leading-snug text-charcoal [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-lg">{txt(v.title, locale)}</span>
                    <span className="mt-1 text-sm text-charcoal/75">{txt(v.desc, locale)}</span>
                    <span className="mt-auto pt-3 text-xs font-semibold text-charcoal/60">{formatDate(v.date, locale)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 rounded-2xl bg-rose/50 px-6 py-12 text-center">
            <p className="font-serif text-lg text-charcoal">{t.noResults}</p>
            <button type="button" onClick={() => { setSeries('all'); setQuery(''); }} className="mt-4 rounded-md bg-maroon px-5 py-2.5 font-semibold text-white hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">{t.clearFilters}</button>
          </div>
        )}

        {shown.length > limit && (
          <p className="mt-8 text-center">
            <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="rounded-md border-2 border-maroon px-7 py-3 font-semibold text-maroon hover:bg-rose focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">{t.loadMore}</button>
          </p>
        )}
      </section>

      {/* YouTube band */}
      <section className="mt-14 rounded-2xl bg-saffron px-6 py-8 text-center text-charcoal sm:px-10 lg:flex lg:items-center lg:justify-between lg:text-left">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold !text-charcoal">{t.youtubeTitle}</h2>
          <p className="mt-2 text-lg">{t.youtubeText}</p>
        </div>
        <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block rounded-md bg-charcoal px-7 py-3 font-semibold text-white transition-colors hover:bg-maroon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal lg:mt-0">
          {t.youtubeCta}<span className="sr-only"> ({t.newTab})</span>
        </a>
      </section>

      {/* Pop-up player */}
      <dialog ref={dialogRef} onClose={() => setOpen(null)} onClick={(e) => { if (e.target === dialogRef.current) close(); }} aria-label={open ? txt(open.title, locale) : t.watch} className="m-auto w-[min(60rem,94vw)] rounded-2xl bg-charcoal p-0 text-white backdrop:bg-charcoal/80">
        {open && (
          <div>
            <div className="relative aspect-video w-full bg-black">
              {open.youtubeId ? (
                <iframe src={`https://www.youtube-nocookie.com/embed/${open.youtubeId}?autoplay=1&rel=0`} title={txt(open.title, locale)} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-cover bg-center p-6 text-center" style={{ backgroundImage: `linear-gradient(rgba(35,26,24,.8), rgba(35,26,24,.8)), url('${open.thumb}')` }}>
                  <p className="font-display text-3xl font-semibold text-white">{t.comingSoon}</p>
                  <p className="mt-2 max-w-md text-white/80">{t.comingSoonText}</p>
                </div>
              )}
            </div>
            <div className="flex items-start justify-between gap-4 p-5">
              <div>
                <p className="font-display text-2xl font-semibold leading-snug text-white [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-xl">{txt(open.title, locale)}</p>
                <p className="mt-1 text-sm text-white/75">{seriesName(open.series, locale)} · {clock(open.duration)} · {formatDate(open.date, locale)}</p>
              </div>
              <button type="button" onClick={close} className="shrink-0 rounded-md border border-white/40 px-4 py-2 text-sm font-semibold hover:bg-white hover:text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">{t.close}</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
