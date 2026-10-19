'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { formatDate } from '@/lib/format';
import { txt } from '@/data/sevas';
import { AUDIO, SERIES, clock, seriesName, type AudioTrack, type SeriesKey } from '@/data/media';

type T = Dictionary['audio'];
const SPEEDS = [1, 1.25, 1.5, 2];

const EQ_CSS = `
@keyframes eq-bar { 0%,100% { transform: scaleY(.3); } 50% { transform: scaleY(1); } }
@keyframes disc-turn { to { transform: rotate(360deg); } }
.eq-bar { transform-origin: bottom; animation: eq-bar 900ms ease-in-out infinite; }
.disc-turn { animation: disc-turn 14s linear infinite; }
@media (prefers-reduced-motion: reduce) { .eq-bar, .disc-turn { animation: none; } }
`;

const Icon = ({ d, size = 20, fill = false }: { d: string; size?: number; fill?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const PLAY = 'M8 5v14l11-7z';
const PAUSE = 'M7 5h4v14H7zM13 5h4v14h-4z';
const DOWNLOAD = 'M12 4v11M7 11l5 5 5-5M5 20h14';
const SHARE = 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4';
const PREV = 'M6 5v14M20 5L9 12l11 7z';
const NEXT = 'M18 5v14M4 5l11 7-11 7z';

// Audio archive: series chips, search and sort, the list of discourses, and a "Now playing" panel on the right.
// Playback uses the real file when `src` is set. Without a file it runs in preview mode (a timer) so the design can be reviewed.
export default function AudioLibrary({ t, locale }: { t: T; locale: Locale }) {
  const [series, setSeries] = useState<'all' | SeriesKey>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('new');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [curId, setCurId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [note, setNote] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const cur: AudioTrack | null = AUDIO.find((a) => a.id === curId) ?? null;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = AUDIO.filter((a) => (series === 'all' || a.series === series) && (!q || txt(a.title, locale).toLowerCase().includes(q)));
    if (sort === 'old') return [...list].sort((a, b) => a.date.localeCompare(b.date));
    if (sort === 'long') return [...list].sort((a, b) => b.duration - a.duration);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [series, query, sort, locale]);


  // Open a shared link (#track-id) on the right track
  useEffect(() => {
    const open = () => {
      const id = window.location.hash.slice(1);
      if (id && AUDIO.some((a) => a.id === id)) {
        setCurId(id);
        setTime(0);
        setPlaying(false);
        document.getElementById(`row-${id}`)?.scrollIntoView({ block: 'center' });
      }
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);

  // Say something for a few seconds (copied, nothing to download...)
  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(''), 4500);
    return () => window.clearTimeout(id);
  }, [note]);

  // Preview mode: no file yet, so a timer stands in for the sound
  useEffect(() => {
    if (!playing || !cur || cur.src) return;
    const id = window.setInterval(() => setTime((x) => x + 0.25 * speed), 250);
    return () => window.clearInterval(id);
  }, [playing, cur, speed]);

  // Real file: play and pause with the state
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !cur?.src) return;
    if (playing) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [playing, cur]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, curId]);

  // Reached the end: go to the next discourse in the list
  useEffect(() => {
    if (cur && playing && time >= cur.duration) step(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  function start(id: string) {
    if (id === curId) {
      setPlaying((p) => !p);
      return;
    }
    setCurId(id);
    setTime(0);
    setPlaying(true);
  }

  function step(dir: 1 | -1) {
    if (shown.length === 0) return;
    const i = shown.findIndex((a) => a.id === curId);
    const next = i < 0 ? shown[0] : shown[i + dir];
    if (!next) {
      setPlaying(false);
      setTime(0);
      return;
    }
    setCurId(next.id);
    setTime(0);
    setPlaying(true);
  }

  function seek(v: number) {
    setTime(v);
    if (audioRef.current && cur?.src) audioRef.current.currentTime = v;
  }

  const jump = (d: number) => cur && seek(Math.min(cur.duration, Math.max(0, time + d)));

  async function share(a: AudioTrack) {
    const url = `${window.location.origin}${window.location.pathname}#${a.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setNote(t.linkCopied);
    } catch {
      setNote(url);
    }
  }

  function togglePick(id: string) {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const allShownPicked = shown.length > 0 && shown.every((a) => picked.has(a.id));
  const toggleAll = () =>
    setPicked((s) => {
      const n = new Set(s);
      if (allShownPicked) shown.forEach((a) => n.delete(a.id));
      else shown.forEach((a) => n.add(a.id));
      return n;
    });

  // Browsers allow several downloads in a row; a real zip file needs the server (later)
  function batchDownload() {
    const files = AUDIO.filter((a) => picked.has(a.id) && a.src);
    if (files.length === 0) {
      setNote(t.noFiles);
      return;
    }
    files.forEach((a, i) =>
      window.setTimeout(() => {
        const el = document.createElement('a');
        el.href = a.src;
        el.download = '';
        document.body.appendChild(el);
        el.click();
        el.remove();
      }, i * 600),
    );
  }

  const iconBtn = 'inline-flex h-9 w-9 items-center justify-center rounded-full text-saffron transition-colors hover:bg-saffron/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron';
  const pct = cur ? Math.min(100, (time / cur.duration) * 100) : 0;

  return (
    <div className="relative">
      <style>{EQ_CSS}</style>
      {cur?.src && (
        <audio
          ref={audioRef}
          src={cur.src}
          preload="metadata"
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onEnded={() => step(1)}
        />
      )}

      {/* Series chips */}
      <div role="group" aria-label={t.filtersLabel} className="flex flex-wrap gap-2">
        {[{ key: 'all' as const, label: t.all }, ...SERIES.filter((s) => s.key !== 'events').map((s) => ({ key: s.key, label: s.name[locale] }))].map((c) => {
          const on = series === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => setSeries(c.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${on ? 'bg-saffron text-charcoal ring-saffron' : 'bg-white text-maroon ring-saffron/60 hover:bg-rose'}`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Archive */}
        <div className="min-w-0 flex-1 pb-28 lg:pb-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-3xl font-semibold text-maroon sm:text-4xl [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-2xl [html[lang='ta']_&]:sm:text-3xl">{t.archiveTitle}</h2>
            <button
              type="button"
              onClick={batchDownload}
              disabled={picked.size === 0}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-maroon transition-colors hover:bg-rose focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <Icon d={DOWNLOAD} size={18} /> {t.batchDownload}{picked.size > 0 ? ` (${picked.size})` : ''}
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label className="block sm:flex-1">
              <span className="sr-only">{t.searchLabel}</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="w-full rounded-md border border-rose bg-white px-4 py-2.5 text-charcoal placeholder:text-charcoal/50 focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40" />
            </label>
            <label className="block sm:w-52">
              <span className="sr-only">{t.sortLabel}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full rounded-md border border-rose bg-white px-3 py-2.5 text-charcoal focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40">
                {t.sortOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-charcoal/70">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={allShownPicked} onChange={toggleAll} disabled={shown.length === 0} className="h-4 w-4 accent-maroon" />
              {t.selectAll}
            </label>
            <p role="status">{t.countLabel.replace('{n}', String(shown.length))}</p>
          </div>
          <p role="status" className="min-h-[1.5rem] pt-1 text-sm font-semibold text-maroon">{note}</p>

          {shown.length > 0 ? (
            <ul className="mt-1 space-y-3">
              {shown.map((a) => {
                const on = a.id === curId;
                const title = txt(a.title, locale);
                return (
                  <li key={a.id} id={`row-${a.id}`} className={`scroll-mt-28 rounded-2xl p-3 transition-shadow sm:p-4 ${on ? 'bg-white shadow-md ring-2 ring-saffron' : 'bg-rose/40 ring-1 ring-rose hover:bg-white hover:shadow-sm'}`}>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <input type="checkbox" checked={picked.has(a.id)} onChange={() => togglePick(a.id)} aria-label={t.select.replace('{title}', title)} className="h-4 w-4 shrink-0 accent-maroon" />

                      <button type="button" onClick={() => start(a.id)} aria-label={`${on && playing ? t.pause : t.play}: ${title}`} aria-pressed={on && playing} className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-maroon text-white transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">
                        {on && (
                          <svg aria-hidden="true" viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
                            <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="2.5" />
                            <circle cx="24" cy="24" r="22" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={138.2} strokeDashoffset={138.2 - (138.2 * pct) / 100} />
                          </svg>
                        )}
                        <Icon d={on && playing ? PAUSE : PLAY} fill />
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-semibold leading-snug text-charcoal sm:text-xl [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-base">{title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-charcoal/70">
                          <span className="rounded-full bg-maroon/10 px-2.5 py-0.5 text-xs font-bold text-maroon">{seriesName(a.series, locale)}</span>
                          <span className="tabular-nums">{clock(a.duration)}</span>
                          <span>{formatDate(a.date, locale)}</span>
                          {on && playing && (
                            <span aria-hidden="true" className="flex h-4 items-end gap-0.5">
                              {[0, 150, 300, 450].map((d) => <span key={d} className="eq-bar block h-full w-1 rounded-sm bg-saffron" style={{ animationDelay: `${d}ms` }} />)}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center">
                        {a.src ? (
                          <a href={a.src} download aria-label={`${t.download}: ${title}`} className={iconBtn}><Icon d={DOWNLOAD} /></a>
                        ) : (
                          <button type="button" onClick={() => setNote(t.noFiles)} aria-label={`${t.download}: ${title}`} className={`${iconBtn} opacity-60`}><Icon d={DOWNLOAD} /></button>
                        )}
                        <button type="button" onClick={() => share(a)} aria-label={`${t.share}: ${title}`} className={iconBtn}><Icon d={SHARE} /></button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-4 rounded-2xl bg-rose/50 px-6 py-12 text-center">
              <p className="font-serif text-lg text-charcoal">{t.noResults}</p>
              <button type="button" onClick={() => { setSeries('all'); setQuery(''); }} className="mt-4 rounded-md bg-maroon px-5 py-2.5 font-semibold text-white hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">{t.clearFilters}</button>
            </div>
          )}
        </div>

        {/* Now playing: a card on the right on desktop, a bar at the bottom of the screen on phones */}
        <aside aria-label={t.nowPlaying} className={`${cur ? 'fixed inset-x-0 bottom-0 z-40' : 'hidden'} lg:static lg:z-auto lg:block lg:w-96 lg:shrink-0`}>
          <div className="lg:sticky lg:top-24">
            <div className="border-t-2 border-saffron bg-charcoal p-4 text-white shadow-2xl lg:rounded-2xl lg:border-t-0 lg:p-6">
              <p className="hidden text-xs font-bold uppercase tracking-[0.2em] text-saffron lg:block [html[lang='ta']_&]:tracking-normal">{t.nowPlaying}</p>

              {/* Disc */}
              <div aria-hidden="true" className="relative mx-auto mt-5 hidden h-52 w-52 items-center justify-center lg:flex">
                <div className={`absolute inset-0 rounded-full ${playing ? 'disc-turn' : ''}`} style={{ background: 'conic-gradient(from 0deg, #7A1C1C, #231A18, #7A1C1C, #231A18, #7A1C1C)', boxShadow: '0 0 50px rgba(217,119,6,0.35)' }}>
                  <div className="absolute inset-3 rounded-full border border-white/10" />
                  <div className="absolute inset-8 rounded-full border border-white/10" />
                  <div className="absolute inset-14 rounded-full border border-saffron/30" />
                </div>
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-saffron text-charcoal">
                  <svg width="40" height="40" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="6">
                    {[0, 60, 120].map((d) => <ellipse key={d} cx="100" cy="100" rx="22" ry="80" transform={`rotate(${d} 100 100)`} />)}
                  </svg>
                </div>
              </div>

              <div className="flex items-center gap-3 lg:mt-5 lg:block">
                <div className="min-w-0 flex-1 lg:text-center">
                  <p className="truncate font-display text-lg font-semibold lg:whitespace-normal lg:text-2xl lg:leading-tight [html[lang='ta']_&]:!leading-[1.4] [html[lang='ta']_&]:text-base">{cur ? txt(cur.title, locale) : t.pickOne}</p>
                  <p className="truncate text-sm text-white/70 lg:mt-1">{cur ? seriesName(cur.series, locale) : t.pickText}</p>
                </div>
                <button type="button" onClick={() => cur && setPlaying((p) => !p)} disabled={!cur} aria-label={playing ? t.pause : t.play} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-saffron text-charcoal transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 lg:hidden">
                  <Icon d={playing ? PAUSE : PLAY} fill />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs text-white/80 lg:mt-5">
                <span className="w-11 text-right tabular-nums">{clock(time)}</span>
                <input type="range" min={0} max={cur?.duration ?? 1} step={1} value={Math.min(time, cur?.duration ?? 1)} disabled={!cur} aria-label={t.seek} onChange={(e) => seek(Number(e.target.value))} className="h-1.5 w-full cursor-pointer accent-[#D97706] disabled:cursor-not-allowed" />
                <span className="w-11 tabular-nums">{clock(cur?.duration ?? 0)}</span>
              </div>

              <div className="mt-3 hidden items-center justify-center gap-1 lg:flex">
                <button type="button" disabled={!cur} onClick={() => step(-1)} aria-label={t.prev} className={iconBtn}><Icon d={PREV} /></button>
                <button type="button" disabled={!cur} onClick={() => jump(-15)} aria-label={t.back15} className={`${iconBtn} text-xs font-bold`}>−15</button>
                <button type="button" disabled={!cur} onClick={() => setPlaying((p) => !p)} aria-label={playing ? t.pause : t.play} className="mx-2 flex h-14 w-14 items-center justify-center rounded-full bg-saffron text-charcoal transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50">
                  <Icon d={playing ? PAUSE : PLAY} size={24} fill />
                </button>
                <button type="button" disabled={!cur} onClick={() => jump(15)} aria-label={t.fwd15} className={`${iconBtn} text-xs font-bold`}>+15</button>
                <button type="button" disabled={!cur} onClick={() => step(1)} aria-label={t.next} className={iconBtn}><Icon d={NEXT} /></button>
              </div>

              <div className="mt-3 hidden items-center justify-between lg:flex">
                <button type="button" disabled={!cur} onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} aria-label={`${t.speed}: ${speed}x`} className="min-w-[3.5rem] rounded border border-white/40 px-2 py-1 text-sm font-semibold hover:bg-white hover:text-charcoal disabled:opacity-50">{speed}x</button>
                {cur && !cur.src && <p className="ml-3 text-xs leading-snug text-white/60">{t.demoNote}</p>}
              </div>
            </div>
          </div>
        </aside>
      </div>

    </div>
  );
}
