'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const FILES = API_BASE.replace(/\/api\/v1\/?$/, '');

type Cat = { id: string; name_en: string; name_ta: string | null };
type Item = {
  id: string; kind: 'single' | 'series'; category_id: string | null; category_en: string | null; category_ta: string | null;
  title_en: string; title_ta: string | null; audio_url: string | null; item_date: string | null; class_count?: number;
};
type Cls = { id: string; title_en: string; title_ta: string | null; audio_url: string; class_date: string | null; sort_order: number };
type Track = {
  key: string; url: string; title_en: string; title_ta: string | null; date: string | null;
  group_en: string | null; group_ta: string | null; // series title, when the track is a class
};
type Entry = {
  id: string; kind: 'single' | 'series'; cat_id: string | null; cat_en: string | null; cat_ta: string | null;
  title_en: string; title_ta: string | null; date: string | null; tracks: Track[];
};
type Props = { t?: any; locale: string };

const fileUrl = (u?: string | null) => (u ? (u.startsWith('http') ? u : `${FILES}${u}`) : '');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const niceDate = (s?: string | null) => {
  const d = (s || '').slice(0, 10);
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${Number(dd)} ${MON[Number(m) - 1] || ''} ${y}`;
};
const clock = (n: number) => {
  if (!Number.isFinite(n) || n < 0) return '0:00';
  const m = Math.floor(n / 60), s = Math.floor(n % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const I_DOWN = 'M12 3v12m0 0l-4-4m4 4l4-4M5 21h14';
const I_SHARE = 'M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4';
const I_CHEV = 'M6 9l6 6 6-6';
const PLAY = <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
const PAUSE = <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>;

export default function AudioLibrary({ locale }: Props) {
  const isTa = locale === 'ta';
  const tr = (en: string, ta: string) => (isTa ? ta : en);

  const [cats, setCats] = useState<Cat[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'new' | 'old' | 'az'>('new');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  // Player
  const audioRef = useRef<HTMLAudioElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [a, b] = await Promise.all([
        fetch(`${API_BASE}/discover/categories?kind=audio`, { cache: 'no-store' }),
        fetch(`${API_BASE}/discover/audio`, { cache: 'no-store' }),
      ]);
      if (!b.ok) throw new Error();
      const items: Item[] = (await b.json()).items || [];
      setCats(a.ok ? (await a.json()).categories || [] : []);

      const seriesOnes = items.filter((i) => i.kind === 'series' && (i.class_count || 0) > 0);
      const lists = await Promise.all(seriesOnes.map(async (s) => {
        try {
          const r = await fetch(`${API_BASE}/discover/audio/${s.id}/classes`, { cache: 'no-store' });
          return r.ok ? ((await r.json()).classes as Cls[]) || [] : [];
        } catch { return [] as Cls[]; }
      }));
      const byId = new Map<string, Cls[]>();
      seriesOnes.forEach((s, k) => byId.set(s.id, lists[k]));

      const out: Entry[] = [];
      items.forEach((i) => {
        const base = { id: i.id, kind: i.kind, cat_id: i.category_id, cat_en: i.category_en, cat_ta: i.category_ta, title_en: i.title_en, title_ta: i.title_ta, date: i.item_date };
        if (i.kind === 'single') {
          if (!i.audio_url) return;
          out.push({ ...base, tracks: [{ key: `s-${i.id}`, url: fileUrl(i.audio_url), title_en: i.title_en, title_ta: i.title_ta, date: i.item_date, group_en: null, group_ta: null }] });
        } else {
          const cl = byId.get(i.id) || [];
          if (cl.length === 0) return;
          out.push({
            ...base,
            tracks: cl.map((c) => ({ key: `c-${c.id}`, url: fileUrl(c.audio_url), title_en: c.title_en, title_ta: c.title_ta, date: c.class_date || i.item_date, group_en: i.title_en, group_ta: i.title_ta })),
          });
        }
      });
      setEntries(out);
    } catch {
      setError(tr('The audio could not be loaded right now. Please try again.', 'ஒலிப்பதிவுகளை இப்போது ஏற்ற இயலவில்லை. மீண்டும் முயற்சிக்கவும்.'));
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);
  useEffect(() => { load(); }, [load]);

  const name = (en: string, ta: string | null) => (isTa ? ta || en : en);
  const trackLabel = (x: Track) => (x.group_en ? `${name(x.group_en, x.group_ta)} - ${name(x.title_en, x.title_ta)}` : name(x.title_en, x.title_ta));

  const s = q.trim().toLowerCase();
  const shown = useMemo(() => {
    const list = entries.filter((e) =>
      (cat === 'all' || e.cat_id === cat) &&
      (!s || `${e.title_en} ${e.title_ta || ''} ${e.cat_en || ''} ${e.tracks.map((t) => `${t.title_en} ${t.title_ta || ''}`).join(' ')}`.toLowerCase().includes(s))
    );
    list.sort((a, b) => {
      if (sort === 'az') return name(a.title_en, a.title_ta).localeCompare(name(b.title_en, b.title_ta));
      const r = (a.date || '').localeCompare(b.date || '');
      return sort === 'new' ? -r : r;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, cat, s, sort, isTa]);

  // The order the player follows: entries as listed, classes in their order
  const queue = useMemo(() => shown.flatMap((e) => e.tracks), [shown]);
  const now = queue.find((x) => x.key === current) || entries.flatMap((e) => e.tracks).find((x) => x.key === current) || null;
  const nowEntry = entries.find((e) => e.tracks.some((t) => t.key === current)) || null;
  const idxNow = queue.findIndex((x) => x.key === current);

  function play(x: Track) {
    const a = audioRef.current;
    if (!a) return;
    if (current === x.key) { if (a.paused) a.play(); else a.pause(); return; }
    setCurrent(x.key); setPos(0); setDur(0);
    a.src = x.url;
    a.play().catch(() => {});
  }
  const toggle = () => { const a = audioRef.current; if (!a || !now) return; if (a.paused) a.play(); else a.pause(); };
  const jump = (n: number) => { const a = audioRef.current; if (a) a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + n)); };
  const step = (n: number) => { const x = queue[idxNow + n]; if (x) play(x); };

  async function save(x: Track) {
    try {
      const r = await fetch(x.url);
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `${trackLabel(x)}${x.url.slice(x.url.lastIndexOf('.'))}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { window.open(x.url, '_blank', 'noopener'); }
  }

  async function batch() {
    const list = entries.flatMap((e) => e.tracks).filter((x) => picked.has(x.key));
    if (!list.length) return;
    setBusy(true);
    for (const x of list) await save(x);
    setBusy(false);
  }

  async function share(x: Track) {
    try {
      if (navigator.share) { await navigator.share({ title: trackLabel(x), url: x.url }); return; }
      await navigator.clipboard.writeText(x.url);
      setNote(tr('Link copied', 'இணைப்பு நகலெடுக்கப்பட்டது'));
      setTimeout(() => setNote(''), 2500);
    } catch { /* cancelled */ }
  }

  const allKeys = queue.map((x) => x.key);
  const allOn = allKeys.length > 0 && allKeys.every((k) => picked.has(k));
  const toggleAll = () => setPicked((p) => { const n = new Set(p); if (allOn) allKeys.forEach((k) => n.delete(k)); else allKeys.forEach((k) => n.add(k)); return n; });
  const toggleKeys = (keys: string[]) => setPicked((p) => {
    const n = new Set(p);
    const all = keys.every((k) => n.has(k));
    keys.forEach((k) => (all ? n.delete(k) : n.add(k)));
    return n;
  });
  const toggleOpen = (id: string) => setOpenIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const chips = [{ id: 'all', label: tr('All', 'அனைத்தும்') }, ...cats.map((c) => ({ id: c.id, label: name(c.name_en, c.name_ta) }))];

  // One row: checkbox, play, title and info, download, share (used for singles and for classes)
  const row = (x: Track, text: string, entry: Entry, nested = false) => {
    const on = current === x.key;
    return (
      <li key={x.key} className={`flex items-center gap-4 rounded-2xl border px-5 py-4 transition-colors ${nested ? 'ml-6' : ''} ${on ? 'border-maroon/40 bg-rose' : 'border-rose bg-rose/60 hover:bg-rose'}`}>
        <input type="checkbox" checked={picked.has(x.key)} onChange={() => toggleKeys([x.key])} aria-label={`${tr('Select', 'தேர்ந்தெடு')} ${text}`} className="h-5 w-5 shrink-0 accent-maroon" />
        <button type="button" onClick={() => play(x)} aria-label={`${on && playing ? tr('Pause', 'நிறுத்து') : tr('Play', 'இயக்கு')} ${text}`}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-maroon text-white transition-colors hover:bg-charcoal">
          {on && playing ? PAUSE : PLAY}
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-snug text-maroon [html[lang='ta']_&]:leading-[1.4]">{text}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-charcoal/70">
            {entry.cat_en && <span className="rounded-full bg-sand/70 px-3 py-0.5 text-xs font-bold text-maroon">{name(entry.cat_en, entry.cat_ta)}</span>}
            {x.date && <span>{niceDate(x.date)}</span>}
          </div>
        </div>
        <button type="button" onClick={() => save(x)} aria-label={tr('Download', 'பதிவிறக்கு')} className="p-2 text-saffron hover:text-maroon"><Icon d={I_DOWN} size={22} /></button>
        <button type="button" onClick={() => share(x)} aria-label={tr('Share', 'பகிர்')} className="p-2 text-saffron hover:text-maroon"><Icon d={I_SHARE} size={22} /></button>
      </li>
    );
  };

  return (
    <div>
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => step(1)}
      />

      {/* Category chips */}
      <div className="flex flex-wrap gap-3" role="group" aria-label={tr('Categories', 'வகைகள்')}>
        {chips.map((c) => (
          <button key={c.id} type="button" onClick={() => setCat(c.id)}
            className={`rounded-full border px-5 py-2 text-base font-semibold transition-colors ${cat === c.id ? 'border-saffron bg-saffron text-white' : 'border-saffron/60 bg-white text-maroon hover:bg-rose/60'}`}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Archive */}
        <section aria-label={tr('Audio Discourses Archive', 'ஒலிப்பதிவு உரைகள் காப்பகம்')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-3xl font-medium text-maroon sm:text-4xl">{tr('Audio Discourses Archive', 'ஒலிப்பதிவு உரைகள் காப்பகம்')}</h2>
            <button type="button" onClick={batch} disabled={picked.size === 0 || busy}
              className="inline-flex items-center gap-2 text-base font-semibold text-maroon hover:text-saffron disabled:cursor-not-allowed disabled:opacity-50">
              <Icon d={I_DOWN} />{busy ? tr('Downloading...', 'பதிவிறக்குகிறது...') : `${tr('Batch download selected', 'தேர்ந்தவற்றைப் பதிவிறக்கு')}${picked.size ? ` (${picked.size})` : ''}`}
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_13rem]">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Search by title', 'தலைப்பால் தேடுக')} aria-label={tr('Search by title', 'தலைப்பால் தேடுக')}
              className="h-14 w-full rounded-lg border border-sand bg-white px-5 text-lg text-charcoal placeholder:text-charcoal/40 focus:border-maroon focus:outline-none focus:ring-2 focus:ring-saffron/40" />
            <select value={sort} onChange={(e) => setSort(e.target.value as 'new' | 'old' | 'az')} aria-label={tr('Sort', 'வரிசை')}
              className="h-14 rounded-lg border border-sand bg-white px-4 text-lg text-charcoal focus:border-maroon focus:outline-none focus:ring-2 focus:ring-saffron/40">
              <option value="new">{tr('Newest first', 'புதியவை முதலில்')}</option>
              <option value="old">{tr('Oldest first', 'பழையவை முதலில்')}</option>
              <option value="az">{tr('Title A-Z', 'தலைப்பு A-Z')}</option>
            </select>
          </div>

          <div className="mt-4 flex items-center justify-between text-base text-charcoal/80">
            <label className="inline-flex cursor-pointer items-center gap-2.5 font-semibold">
              <input type="checkbox" checked={allOn} onChange={toggleAll} className="h-5 w-5 accent-maroon" />{tr('Select all', 'அனைத்தையும் தேர்ந்தெடு')}
            </label>
            <span className="font-semibold">{shown.length} {tr('discourses', 'உரைகள்')}</span>
          </div>
          {note && <p role="status" className="mt-2 text-sm font-semibold text-maroon">{note}</p>}

          {loading ? (
            <div className="mt-5 space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-sand/50" />)}</div>
          ) : error ? (
            <div role="alert" className="mt-5 rounded-lg border border-red-200 border-l-4 border-l-red-600 bg-red-50 p-6 text-red-800">
              <p className="font-semibold">{error}</p>
              <button type="button" onClick={load} className="mt-3 rounded-md border-2 border-red-700 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-700 hover:text-white">{tr('Try again', 'மீண்டும் முயற்சி')}</button>
            </div>
          ) : shown.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-sand bg-cream/40 py-14 text-center font-serif text-lg text-charcoal/75">
              {entries.length === 0 ? tr('Audio will be added soon.', 'ஒலிப்பதிவுகள் விரைவில் சேர்க்கப்படும்.') : tr('No discourse matches your search.', 'தேடலுக்கு உரைகள் இல்லை.')}
            </div>
          ) : (
            <ul className="mt-5 space-y-4">
              {shown.map((e) => {
                if (e.kind === 'single') return row(e.tracks[0], name(e.title_en, e.title_ta), e);

                // A series: one row with the series title, and a dropdown with its classes
                const isOpen = openIds.has(e.id);
                const keys = e.tracks.map((t) => t.key);
                const allSel = keys.every((k) => picked.has(k));
                const someSel = !allSel && keys.some((k) => picked.has(k));
                const playingHere = playing && e.tracks.some((t) => t.key === current);
                return (
                  <li key={e.id} className="list-none">
                    <div className={`flex items-center gap-4 rounded-2xl border px-5 py-4 transition-colors ${playingHere ? 'border-maroon/40 bg-rose' : 'border-rose bg-rose/60 hover:bg-rose'}`}>
                      <input type="checkbox" checked={allSel} ref={(el) => { if (el) el.indeterminate = someSel; }} onChange={() => toggleKeys(keys)}
                        aria-label={`${tr('Select all classes of', 'அனைத்து வகுப்புகளையும் தேர்ந்தெடு:')} ${name(e.title_en, e.title_ta)}`} className="h-5 w-5 shrink-0 accent-maroon" />
                      <button type="button" onClick={() => play(e.tracks.find((t) => t.key === current) || e.tracks[0])}
                        aria-label={`${playingHere ? tr('Pause', 'நிறுத்து') : tr('Play', 'இயக்கு')} ${name(e.title_en, e.title_ta)}`}
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-maroon text-white transition-colors hover:bg-charcoal">
                        {playingHere ? PAUSE : PLAY}
                      </button>
                      <button type="button" onClick={() => toggleOpen(e.id)} aria-expanded={isOpen} className="min-w-0 flex-1 text-left">
                        <p className="font-display text-xl leading-snug text-maroon [html[lang='ta']_&]:leading-[1.4]">{name(e.title_en, e.title_ta)}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-charcoal/70">
                          {e.cat_en && <span className="rounded-full bg-sand/70 px-3 py-0.5 text-xs font-bold text-maroon">{name(e.cat_en, e.cat_ta)}</span>}
                          <span className="font-semibold">{e.tracks.length} {tr(e.tracks.length === 1 ? 'class' : 'classes', 'வகுப்புகள்')}</span>
                          {e.date && <span>{niceDate(e.date)}</span>}
                        </div>
                      </button>
                      <button type="button" onClick={() => toggleOpen(e.id)} aria-expanded={isOpen} aria-label={isOpen ? tr('Hide classes', 'வகுப்புகளை மறை') : tr('Show classes', 'வகுப்புகளைக் காட்டு')} className="p-2 text-saffron hover:text-maroon">
                        <span className={`block transition-transform ${isOpen ? 'rotate-180' : ''}`}><Icon d={I_CHEV} size={26} /></span>
                      </button>
                    </div>

                    {isOpen && (
                      <ul className="mt-3 space-y-3">
                        {e.tracks.map((x) => row(x, name(x.title_en, x.title_ta), e, true))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Now playing */}
        <aside aria-label={tr('Now playing', 'இப்போது ஒலிக்கிறது')} className="lg:sticky lg:top-28 lg:self-start">
          <div className="overflow-hidden rounded-3xl bg-charcoal p-7 text-white shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-saffron">{tr('Now playing', 'இப்போது ஒலிக்கிறது')}</p>

            <div className="mx-auto mt-6 flex h-56 w-56 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle,#2a0f0f_0%,#5b1a1a_55%,#2a0f0f_100%)] shadow-inner">
              <div className={`flex h-36 w-36 items-center justify-center rounded-full border border-white/10 ${playing ? 'animate-[spin_8s_linear_infinite]' : ''}`}>
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-saffron text-charcoal">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="1.8" fill="currentColor" /><ellipse cx="12" cy="12" rx="9" ry="3.6" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" /></svg>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="font-display text-2xl leading-snug !text-white [html[lang='ta']_&]:leading-[1.4]">{now ? trackLabel(now) : tr('Choose a discourse', 'ஒரு உரையைத் தேர்ந்தெடுக்கவும்')}</p>
              <p className="mt-1 text-base text-white/80">{now ? [nowEntry?.cat_en ? name(nowEntry.cat_en, nowEntry.cat_ta) : '', niceDate(now.date)].filter(Boolean).join(' · ') : tr('Press play on any discourse to listen here.', 'கேட்க எந்த உரையிலும் இயக்கு பொத்தானை அழுத்தவும்.')}</p>
            </div>

            <div className="mt-6 flex items-center gap-3 text-xs tabular-nums text-white/80">
              <span>{clock(pos)}</span>
              <input type="range" min={0} max={dur || 0} step={0.1} value={Math.min(pos, dur || 0)} disabled={!now}
                onChange={(e) => { const a = audioRef.current; if (a) a.currentTime = Number(e.target.value); }}
                aria-label={tr('Seek', 'தேடு')} className="h-1.5 flex-1 cursor-pointer accent-saffron disabled:cursor-not-allowed" />
              <span>{clock(dur)}</span>
            </div>

            <div className="mt-5 flex items-center justify-center gap-5">
              <button type="button" onClick={() => step(-1)} disabled={idxNow <= 0} aria-label={tr('Previous', 'முந்தையது')} className="p-2 text-white/80 hover:text-saffron disabled:opacity-30">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
              </button>
              <button type="button" onClick={() => jump(-15)} disabled={!now} aria-label="-15" className="text-sm font-bold text-white/80 hover:text-saffron disabled:opacity-30">-15</button>
              <button type="button" onClick={toggle} disabled={!now} aria-label={playing ? tr('Pause', 'நிறுத்து') : tr('Play', 'இயக்கு')}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-saffron text-charcoal transition-colors hover:bg-white disabled:opacity-50">
                {playing
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                  : <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>}
              </button>
              <button type="button" onClick={() => jump(15)} disabled={!now} aria-label="+15" className="text-sm font-bold text-white/80 hover:text-saffron disabled:opacity-30">+15</button>
              <button type="button" onClick={() => step(1)} disabled={idxNow < 0 || idxNow >= queue.length - 1} aria-label={tr('Next', 'அடுத்தது')} className="p-2 text-white/80 hover:text-saffron disabled:opacity-30">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}