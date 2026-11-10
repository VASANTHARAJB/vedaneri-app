// The Panchangam of a day, read from the entries kept in the Panchangam Manager (the panchangam_calendar table).
// Nothing is worked out here: the page shows what the ashram has entered for that English date.
import { API, authHeader } from './DiscoverKit';

const API_BASE = String(API).replace(/\/discover\/?$/, '');
// If your API mounts the panchangam router somewhere else, change this one line
export const PANCH_URL = `${API_BASE}/panchangam/date`;

export type PanchangamDay = {
  id: number; calendar_date: string; tamil_year: string; tamil_month: string; tamil_date: number;
  thithi: string; nakshatram: string; special_event: string | null;
};

const VARA_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const VARA_TA = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

const cache = new Map<string, PanchangamDay | null>();

// The entry for a date, or null when none is entered. It throws when the server cannot be reached or refuses.
export async function fetchPanchangam(date: string): Promise<PanchangamDay | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (cache.has(date)) return cache.get(date) ?? null;
  const res = await fetch(`${PANCH_URL}?date=${encodeURIComponent(date)}`, { headers: authHeader(), cache: 'no-store' });
  if (!res.ok) throw new Error(`Panchangam lookup failed (${res.status})`);
  const j: any = await res.json();
  const entry: PanchangamDay | null = j && j.entry ? (j.entry as PanchangamDay) : null;
  // A missing day is not remembered, so an entry added in the Panchangam Manager is found the next time
  if (entry) cache.set(date, entry);
  return entry;
}

// For the entry form on the screen
export function describe(p: PanchangamDay): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: 'Day', value: VARA_EN[weekday(p.calendar_date)] },
    { label: 'Tamil year', value: p.tamil_year },
    { label: 'Tamil date', value: `${p.tamil_month} ${p.tamil_date}` },
    { label: 'Thithi', value: p.thithi },
    { label: 'Nakshatram', value: p.nakshatram },
  ];
  if (p.special_event) rows.push({ label: 'Special event', value: p.special_event });
  return rows.filter((r) => r.value);
}

// One line for the printed Sankalpa form
export function tamilLine(p: PanchangamDay): string {
  return [p.tamil_year, `${p.tamil_month} ${p.tamil_date}`, VARA_TA[weekday(p.calendar_date)], p.thithi, p.nakshatram, p.special_event].filter(Boolean).join(' | ');
}