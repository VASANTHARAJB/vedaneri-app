'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { PHOTO_FOLDER_URL } from '@/data/media';

type T = Dictionary['albums'];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const FILES = API_BASE.replace(/\/api\/v1\/?$/, '');
const fileUrl = (u?: string | null) => (u ? (u.startsWith('http') ? u : `${FILES}${u}`) : '');

type AlbumRow = { id: string; title_en: string; title_ta: string | null; photo_count?: number };
type Album = { id: string; name: { en: string; ta: string } };
type Photo = { id: string; album: string; thumb: string; web: string; full: string; title: { en: string; ta: string } };

// Photo albums: album chips, a masonry gallery, and a full-screen viewer with previous / next and download.
export default function AlbumGallery({ t, locale }: { t: T; locale: Locale }) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [album, setAlbum] = useState<'all' | string>('all');
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch(`${API_BASE}/discover/albums`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const rows: AlbumRow[] = (await res.json()).items || [];
      const withPhotos = rows.filter((r) => (r.photo_count || 0) > 0);
      const lists = await Promise.all(withPhotos.map(async (r) => {
        try {
          const p = await fetch(`${API_BASE}/discover/albums/${r.id}`, { cache: 'no-store' });
          return p.ok ? ((await p.json()).photos as any[]) || [] : [];
        } catch { return [] as any[]; }
      }));
      const a: Album[] = [];
      const p: Photo[] = [];
      withPhotos.forEach((r, k) => {
        const name = { en: r.title_en, ta: r.title_ta || r.title_en };
        a.push({ id: r.id, name });
        lists[k].forEach((x) => p.push({
          id: x.id, album: r.id, thumb: fileUrl(x.thumb_url), web: fileUrl(x.web_url), full: fileUrl(x.image_url || x.web_url), title: name,
        }));
      });
      setAlbums(a); setPhotos(p);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => photos.filter((p) => album === 'all' || p.album === album), [photos, album]);
  const photo = index !== null ? shown[index] : null;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (index !== null && !d.open) d.showModal();
    if (index === null && d.open) d.close();
  }, [index]);

  const go = (dir: 1 | -1) => setIndex((i) => (i === null ? i : (i + dir + shown.length) % shown.length));

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  }
  function close() {
    setIndex(null);
    opener.current?.focus();
  }

  // The files live on the API server, so a plain download link would only open them. This saves them.
  async function save(e: React.MouseEvent, p: Photo) {
    e.preventDefault();
    try {
      const r = await fetch(p.full);
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `${p.title[locale]}${p.full.slice(p.full.lastIndexOf('.'))}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { window.open(p.full, '_blank', 'noopener'); }
  }

  const chips = [{ key: 'all', label: t.all }, ...albums.map((a) => ({ key: a.id, label: a.name[locale] }))];
  const albumLabel = (k: string) => albums.find((a) => a.id === k)?.name[locale] ?? '';

  if (loading) {
    return <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">{[0, 1, 2, 3].map((i) => <div key={i} className="mb-5 h-64 animate-pulse break-inside-avoid rounded-xl bg-sand/50" />)}</div>;
  }
  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 border-l-4 border-l-red-600 bg-red-50 p-6 text-red-800">
        <p className="font-semibold">{locale === 'ta' ? 'படங்களை இப்போது ஏற்ற இயலவில்லை.' : 'The photos could not be loaded right now.'}</p>
        <button type="button" onClick={load} className="mt-3 rounded-md border-2 border-red-700 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-700 hover:text-white">{locale === 'ta' ? 'மீண்டும் முயற்சி' : 'Try again'}</button>
      </div>
    );
  }

  return (
    <div>
      <div role="group" aria-label={t.filtersLabel} className="flex flex-wrap items-center gap-2">
        {chips.map((c) => {
          const on = album === c.key;
          return (
            <button key={c.key} type="button" aria-pressed={on} onClick={() => { setAlbum(c.key); setIndex(null); }} className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron ${on ? 'bg-saffron text-charcoal ring-saffron' : 'bg-white text-maroon ring-saffron/60 hover:bg-rose'}`}>{c.label}</button>
          );
        })}
        <p role="status" className="ml-auto text-sm font-semibold text-charcoal/70">{t.countLabel.replace('{n}', String(shown.length))}</p>
      </div>

      {shown.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-sand bg-cream/40 py-14 text-center font-serif text-lg text-charcoal/75">
          {locale === 'ta' ? 'படங்கள் விரைவில் சேர்க்கப்படும்.' : 'Photos will be added soon.'}
        </div>
      ) : (
        <ul className="mt-6 columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
          {shown.map((p, i) => (
            <li key={p.id} className="mb-5 break-inside-avoid">
              <figure className="group overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-rose transition-shadow hover:shadow-lg">
                <button
                  type="button"
                  onClick={(e) => { opener.current = e.currentTarget; setIndex(i); }}
                  aria-label={`${t.open}: ${p.title[locale]}`}
                  className="relative block w-full overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-saffron"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt={p.title[locale]} loading="lazy" className="h-auto w-full transition-transform duration-500 group-hover:scale-105" />
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                </button>
                <figcaption className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-charcoal">{p.title[locale]}</span>
                    <span className="block truncate text-xs text-charcoal/60">{albumLabel(p.album)}</span>
                  </span>
                  <a href={p.full} onClick={(e) => save(e, p)} download aria-label={`${t.download}: ${p.title[locale]}`} className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-xs font-bold text-maroon hover:bg-rose focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>
                    JPG
                  </a>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}

      {/* High-resolution photos */}
      <section aria-labelledby="hires-title" className="mt-14 rounded-2xl bg-maroon px-6 py-8 text-white sm:px-10 lg:flex lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 id="hires-title" className="font-display text-3xl font-semibold !text-white">{t.hiresTitle}</h2>
          <p className="mt-2 text-lg text-white/90">{t.hiresText}</p>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:mt-0">
          <a href={PHOTO_FOLDER_URL} target="_blank" rel="noopener noreferrer" className="rounded-md bg-saffron px-7 py-3 text-center font-semibold text-charcoal transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            {t.hiresCta}<span className="sr-only"> ({t.newTab})</span>
          </a>
          <Link href={`/${locale}/contact`} className="rounded-md border-2 border-white/70 px-7 py-3 text-center font-semibold text-white transition-colors hover:bg-white hover:text-maroon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t.contactCta}</Link>
        </div>
      </section>

      {/* Viewer */}
      <dialog ref={dialogRef} onClose={() => setIndex(null)} onKeyDown={onKey} onClick={(e) => { if (e.target === dialogRef.current) close(); }} aria-label={photo ? photo.title[locale] : t.open} className="m-auto max-h-[94vh] w-[min(72rem,96vw)] overflow-hidden rounded-2xl bg-charcoal p-0 text-white backdrop:bg-charcoal/90">
        {photo && (
          <div className="flex max-h-[94vh] flex-col">
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.web} alt={photo.title[locale]} className="max-h-[72vh] w-auto max-w-full object-contain" />
              <button type="button" onClick={() => go(-1)} aria-label={t.prev} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal/70 text-xl hover:bg-saffron hover:text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">‹</button>
              <button type="button" onClick={() => go(1)} aria-label={t.next} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal/70 text-xl hover:bg-saffron hover:text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">›</button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-display text-xl font-semibold text-white">{photo.title[locale]}</p>
                <p className="text-sm text-white/70">{albumLabel(photo.album)} · {t.counter.replace('{i}', String((index ?? 0) + 1)).replace('{n}', String(shown.length))}</p>
              </div>
              <div className="flex gap-2">
                <a href={photo.full} onClick={(e) => save(e, photo)} download className="rounded-md bg-saffron px-4 py-2 text-sm font-bold text-charcoal hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">{t.download}</a>
                <button type="button" onClick={close} className="rounded-md border border-white/40 px-4 py-2 text-sm font-semibold hover:bg-white hover:text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-saffron">{t.close}</button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}