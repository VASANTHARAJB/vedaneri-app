'use client';

import React, { useEffect, useRef, useState } from 'react';

// The Tamil panchangam of one English date, shown under the booking calendar.
// It reads the public GET /panchangam/date?date=YYYY-MM-DD of the API (the same saved calendar the CMS fills), so nothing is worked out here.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface PanchangamEntry {
  calendar_date: string;
  tamil_year: string;
  tamil_month: string;
  tamil_date: number;
  thithi: string;
  nakshatram: string;
  special_event?: string | null;
  rasi?: string | null;
  yogam?: string | null;
  karanam?: string | null;
  sunrise?: string | null;
  sunset?: string | null;
  rahu_kalam?: string | null;
  yamagandam?: string | null;
  gulikai?: string | null;
  auto_festivals?: string | null;
  details_json?: string | null;
}

interface Span {
  name: string;
  from: string; // IST, YYYY-MM-DDTHH:mm
  to: string;
}
interface Spans {
  thithi: Span[];
  nakshatram: Span[];
  yogam: Span[];
  karanam: Span[];
}

export type PanchangamStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

const WEEK_DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_DAYS_TA = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];
const MONTH_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_SHORT_TA = ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'];

// ---------- helpers ----------

// Names are saved as "English (தமிழ்)"
function pickName(full: string | null | undefined, isTa: boolean): string {
  const s = String(full || '').trim();
  const i = s.indexOf(' (');
  if (i === -1) return s;
  const en = s.slice(0, i);
  const ta = s.slice(i + 2).replace(/\)$/, '');
  return isTa ? ta || en : en;
}

// Thithi names are saved in English only ("Krishna Paksha Sathuradasi"); this gives the Tamil form for the Tamil page
const TITHI_TA: Record<string, string> = {
  Prathamai: 'பிரதமை', Dwitiyai: 'துவிதியை', Thrithiyai: 'திருதியை', Chathurthi: 'சதுர்த்தி', Panchami: 'பஞ்சமி',
  Sashti: 'சஷ்டி', Sapthami: 'சப்தமி', Ashtami: 'அஷ்டமி', Navami: 'நவமி', Dasami: 'தசமி', Ekadasi: 'ஏகாதசி',
  Dwadasi: 'துவாதசி', Thrayodasi: 'திரயோதசி', Sathuradasi: 'சதுர்தசி', Pournami: 'பௌர்ணமி', Amavasai: 'அமாவாசை',
};

function thithiName(full: string | null | undefined, isTa: boolean): string {
  const s = String(full || '').trim();
  if (!isTa) return s;
  const m = /^(Sukla|Krishna) Paksha (\S+)$/.exec(s);
  if (!m || !TITHI_TA[m[2]]) return s;
  const paksha = m[1] === 'Sukla' ? 'வளர்பிறை' : 'தேய்பிறை';
  return m[2] === 'Pournami' || m[2] === 'Amavasai' ? TITHI_TA[m[2]] : `${paksha} ${TITHI_TA[m[2]]}`;
}

function to12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

// "13:30–15:00" -> "1:30 PM – 3:00 PM"
function to12Range(r?: string | null): string {
  return String(r || '')
    .replace(/\d{1,2}:\d{2}/g, (t) => to12(t))
    .replace('–', ' – ');
}

// "2026-11-10T14:00" -> "10 Nov, 2:00 PM"
function stamp(ts: string, isTa: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(String(ts || ''));
  if (!m) return String(ts || '');
  const mon = (isTa ? MONTH_SHORT_TA : MONTH_SHORT_EN)[Number(m[2]) - 1] || '';
  return `${Number(m[3])} ${mon}, ${to12(m[4])}`;
}

function parseSpans(json?: string | null): Spans {
  const empty: Spans = { thithi: [], nakshatram: [], yogam: [], karanam: [] };
  if (!json) return empty;
  try {
    const raw = JSON.parse(json);
    const clean = (v: any): Span[] =>
      Array.isArray(v)
        ? v
            .filter((s) => s && typeof s.name === 'string' && typeof s.from === 'string' && typeof s.to === 'string')
            .map((s) => ({ name: s.name, from: s.from, to: s.to }))
        : [];
    return { thithi: clean(raw?.thithi), nakshatram: clean(raw?.nakshatram), yogam: clean(raw?.yogam), karanam: clean(raw?.karanam) };
  } catch (_) {
    return empty;
  }
}

function festivalsOf(e: PanchangamEntry): string[] {
  const list = [...String(e.auto_festivals || '').split(' · '), String(e.special_event || '')]
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(list));
}

function weekdayOf(ymd: string, isTa: boolean): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return '';
  return (isTa ? WEEK_DAYS_TA : WEEK_DAYS_EN)[new Date(y, m - 1, d).getDay()];
}

function formatDate(ymd: string): string {
  const p = ymd.split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : ymd;
}

// ---------- presentation ----------

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] gap-x-3 border-b border-sand/70 py-2 last:border-b-0 sm:grid-cols-[132px_1fr]">
      <dt className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-charcoal/55">{label}</dt>
      <dd className="min-w-0 text-[13px] font-semibold leading-snug text-charcoal">{children}</dd>
    </div>
  );
}

function SpanList({
  spans,
  fallback,
  isTa,
  thithi = false,
}: {
  spans: Span[];
  fallback?: string | null;
  isTa: boolean;
  thithi?: boolean;
}) {
  const show = (n: string | null | undefined) => (thithi ? thithiName(n, isTa) : pickName(n, isTa));
  if (spans.length === 0) return <span>{show(fallback) || '—'}</span>;
  return (
    <ul className="space-y-1">
      {spans.map((s, i) => (
        <li key={`${s.name}-${i}`}>
          <span className="block">{show(s.name)}</span>
          <span className="block text-[11.5px] font-medium text-charcoal/65">
            {stamp(s.from, isTa)} → {stamp(s.to, isTa)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PanchangamDayView({
  date,
  entry,
  status,
  isTa,
}: {
  date: string;
  entry: PanchangamEntry | null;
  status: PanchangamStatus;
  isTa: boolean;
}) {
  if (!date || status === 'idle') return null;

  const heading = isTa ? 'தமிழ் பஞ்சாங்கம்' : 'Tamil Panchangam';
  const wd = weekdayOf(date, isTa);

  return (
    <div className="space-y-2 rounded-md border border-sand bg-white p-4" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 border-b border-sand pb-3">
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-maroon">{heading}</span>
          <span className="mt-0.5 block text-xs font-semibold text-charcoal/70">
            {formatDate(date)}
            {wd ? ` · ${wd}` : ''}
          </span>
        </div>
        {status === 'ready' && entry && (
          <div className="text-right">
            <span className="block font-display text-base font-semibold leading-tight text-maroon">
              {pickName(entry.tamil_month, isTa)} {entry.tamil_date}
            </span>
            <span className="block text-[11px] font-semibold text-charcoal/60">{pickName(entry.tamil_year, isTa)}</span>
          </div>
        )}
      </div>

      {status === 'loading' && (
        <p className="py-3 text-xs font-semibold text-charcoal/60">{isTa ? 'பஞ்சாங்கம் ஏற்றப்படுகிறது...' : 'Loading panchangam...'}</p>
      )}

      {status === 'missing' && (
        <p className="py-3 text-xs font-semibold leading-relaxed text-charcoal/65">
          {isTa
            ? 'இந்த தேதிக்கான பஞ்சாங்க விவரங்கள் இன்னும் பதிவாகவில்லை.'
            : 'The panchangam details for this date are not available yet.'}
        </p>
      )}

      {status === 'error' && (
        <p className="py-3 text-xs font-semibold leading-relaxed text-charcoal/65">
          {isTa
            ? 'பஞ்சாங்க விவரங்களை இப்போது பெற முடியவில்லை.'
            : 'The panchangam details could not be loaded right now.'}
        </p>
      )}

      {status === 'ready' && entry && <Details entry={entry} isTa={isTa} />}
    </div>
  );
}

function Details({ entry, isTa }: { entry: PanchangamEntry; isTa: boolean }) {
  const spans = parseSpans(entry.details_json);
  const festivals = festivalsOf(entry);
  const hasKalam = Boolean(entry.rahu_kalam || entry.yamagandam || entry.gulikai);

  return (
    <dl>
      {festivals.length > 0 && (
        <Row label={isTa ? 'விசேஷம்' : 'Festivals'}>
          <div className="flex flex-wrap gap-1.5">
            {festivals.map((f) => (
              <span
                key={f}
                className="rounded-sm border border-saffron bg-saffron/20 px-2 py-0.5 text-[11.5px] font-bold text-maroon"
              >
                {pickName(f, isTa)}
              </span>
            ))}
          </div>
        </Row>
      )}

      <Row label={isTa ? 'திதி' : 'Thithi'}>
        <SpanList spans={spans.thithi} fallback={entry.thithi} isTa={isTa} thithi />
      </Row>

      <Row label={isTa ? 'நட்சத்திரம்' : 'Nakshatram'}>
        <SpanList spans={spans.nakshatram} fallback={entry.nakshatram} isTa={isTa} />
      </Row>

      {(entry.yogam || spans.yogam.length > 0) && (
        <Row label={isTa ? 'யோகம்' : 'Yogam'}>
          <SpanList spans={spans.yogam} fallback={entry.yogam} isTa={isTa} />
        </Row>
      )}

      {(entry.karanam || spans.karanam.length > 0) && (
        <Row label={isTa ? 'கரணம்' : 'Karanam'}>
          <SpanList spans={spans.karanam} fallback={entry.karanam} isTa={isTa} />
        </Row>
      )}

      {entry.rasi && (
        <Row label={isTa ? 'ராசி (சந்திரன்)' : 'Rasi (Moon)'}>
          <span>{pickName(entry.rasi, isTa)}</span>
          <span className="block text-[11px] font-medium text-charcoal/55">
            {isTa ? 'சூரிய உதய நேரத்தில்' : 'at sunrise'}
          </span>
        </Row>
      )}

      {(entry.sunrise || entry.sunset) && (
        <Row label={isTa ? 'சூரியன்' : 'Sun'}>
          <span>
            {isTa ? 'உதயம்' : 'Rise'} {to12(entry.sunrise || '')} · {isTa ? 'அஸ்தமனம்' : 'Set'} {to12(entry.sunset || '')}
          </span>
        </Row>
      )}

      {hasKalam && (
        <Row label={isTa ? 'காலங்கள்' : 'Kalam'}>
          <ul className="space-y-0.5">
            {entry.rahu_kalam && (
              <li>
                {isTa ? 'ராகு காலம்' : 'Rahu Kalam'}: <span className="font-medium">{to12Range(entry.rahu_kalam)}</span>
              </li>
            )}
            {entry.yamagandam && (
              <li>
                {isTa ? 'எமகண்டம்' : 'Yamagandam'}: <span className="font-medium">{to12Range(entry.yamagandam)}</span>
              </li>
            )}
            {entry.gulikai && (
              <li>
                {isTa ? 'குளிகை' : 'Gulikai'}: <span className="font-medium">{to12Range(entry.gulikai)}</span>
              </li>
            )}
          </ul>
        </Row>
      )}
    </dl>
  );
}

// ---------- the card: fetches the day and shows it ----------

export default function PanchangamDayCard({ date, isTa }: { date: string; isTa: boolean }) {
  const cache = useRef<Record<string, PanchangamEntry | null>>({});
  const [entry, setEntry] = useState<PanchangamEntry | null>(null);
  const [status, setStatus] = useState<PanchangamStatus>('idle');

  useEffect(() => {
    if (!date) {
      setEntry(null);
      setStatus('idle');
      return;
    }
    const cached = cache.current[date];
    if (cached !== undefined) {
      setEntry(cached);
      setStatus(cached ? 'ready' : 'missing');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    fetch(`${API_BASE}/panchangam/date?date=${encodeURIComponent(date)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const found: PanchangamEntry | null = data && data.entry ? data.entry : null;
        cache.current[date] = found;
        setEntry(found);
        setStatus(found ? 'ready' : 'missing');
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.warn('Could not load the panchangam of', date, err);
        setEntry(null);
        setStatus('error');
      });
    return () => controller.abort();
  }, [date]);

  return <PanchangamDayView date={date} entry={entry} status={status} isTa={isTa} />;
}