import { notFound } from 'next/navigation';
import AudioBar from '@/components/AudioBar';
import CalendarSupport from '@/components/CalendarSupport';
import Festival from '@/components/Festival';
import Guides from '@/components/Guides';
import Hero, { type HeroLink } from '@/components/Hero';
import { getDictionary } from '@/lib/dictionary';
import { isLocale } from '@/lib/i18n';
import Founder from '@/components/Founder';
import QuickAccess from '@/components/QuickAccess';
import type { CalEvent, Sponsor } from '@/components/CalendarSupport';
import Quotes from '@/components/Quotes';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const FILES = API_BASE.replace(/\/api\/v1\/?$/, '');
const PAGE_URL = `${API_BASE}/home/page`;

// The sections of the home page that the CMS (Home Page) can change. Each one is a part of the dictionary.
const SECTIONS = ['hero', 'founder', 'guides', 'festival', 'calendar', 'support', 'quick', 'quotes', 'audioBar'] as const;

// Content saved in the CMS: { en: { hero: {...}, ... }, ta: { hero: {...}, ... } }.
// If the API is down the page still shows the dictionary text, and the reason is printed in the web terminal.
async function loadContent(): Promise<any> {
  try {
    const res = await fetch(PAGE_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`[home] fetch failed ${res.status} ${PAGE_URL}`);
      return {};
    }
    return (await res.json()).content || {};
  } catch (e: any) {
    console.error(`[home] fetch error ${PAGE_URL}:`, e?.cause?.code || e?.message || e);
    return {};
  }
}

// ---- Putting the CMS text over the dictionary text ----
// Only keys that already exist in the dictionary are used, and a value of another kind is ignored,
// so a wrong entry in the CMS can never break a section. An empty text keeps the dictionary text.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v: any) => !!v && typeof v === 'object' && !Array.isArray(v);
const blank = (v: any): any => (typeof v === 'string' ? '' : Array.isArray(v) ? [] : isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x)])) : v);
const hasText = (v: any): boolean => (typeof v === 'string' ? v.trim() !== '' : Array.isArray(v) ? v.some(hasText) : isObj(v) ? Object.values(v).some(hasText) : false);

function merge(base: any, over: any): any {
  if (typeof base === 'string') {
    if (typeof over !== 'string') return base;
    const v = over.trim();
    if (!v || v.length > 4000) return base;
    if (DATE.test(base) && !DATE.test(v)) return base; // a date stays a date
    return v;
  }
  if (Array.isArray(base)) {
    if (base.length === 0 || !Array.isArray(over) || over.length === 0) return base;
    // The CMS list replaces the dictionary list. An item added in the CMS follows the shape of the last dictionary item.
    const out = over.slice(0, 50).map((o, i) => (i < base.length ? merge(base[i], o) : merge(blank(base[base.length - 1]), o)));
    return out.filter((x, i) => i < base.length || hasText(x));
  }
  if (isObj(base)) {
    if (!isObj(over)) return base;
    const out: any = { ...base };
    for (const k of Object.keys(base)) if (k in over) out[k] = merge(base[k], over[k]);
    return out;
  }
  return base; // numbers and true/false are never changed from the CMS
}

// A photo uploaded in the CMS lives on the API server. Only a file of that folder is accepted.
const photoUrl = (u: unknown) => (typeof u === 'string' && /^\/uploads\/home\/[\w.-]+$/.test(u) ? `${FILES}${u}` : undefined);

// A link saved in the CMS: a page of this site (/camps), or a web address, mail or phone link.
// Anything else (for example javascript:) is ignored, so a typing mistake cannot break the page.
function link(raw: unknown, locale: string): HeroLink | undefined {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return { href: v, external: true };
  if (v.startsWith('/') && !v.startsWith('//')) return { href: v === '/' ? `/${locale}` : `/${locale}${v}`, external: false };
  return undefined;
}

// Guide photos in the guides list: a file of this website (/images/...) or one uploaded in the CMS (/uploads/home/...).
// Anything else is dropped, so the card shows its soft background instead.
function guidePhotos(guides: any) {
  if (!guides || !Array.isArray(guides.teachers)) return guides;
  return {
    ...guides,
    teachers: guides.teachers.map((x: any) => {
      const u = typeof x?.image === 'string' ? x.image : '';
      const image = /^\/uploads\/home\/[\w.-]+$/.test(u) ? `${FILES}${u}` : /^\/images\/[\w.-]+$/.test(u) ? u : '';
      return { ...x, image };
    }),
  };
}

// Festival dates from the CMS must make a real range of 1 to 31 days, or the dictionary dates stay.
// The daily puja times must be a clock time like 17:00.
function safeFestival(merged: any, base: any) {
  const days = (Date.parse(merged?.end) - Date.parse(merged?.start)) / 86_400_000 + 1;
  return Number.isFinite(days) && days >= 1 && days <= 31 ? merged : { ...merged, start: base.start, end: base.end };
}
const clock = (v: unknown, fb: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.trim()) ? v.trim() : fb);

// The event list and the support cards from the CMS. Each can carry its own link. A list with nothing usable is ignored,
// so the dictionary list stays.
// A date that really exists: 2027-02-30 is refused, not turned into 2 March
const realDate = (d: string) => DATE.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
function eventList(raw: any, locale: string): CalEvent[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.slice(0, 60)
    .map((x: any) => ({ date: str(x?.date, 10), name: str(x?.name), href: link(x?.href, locale) }))
    .filter((x) => realDate(x.date) && x.name);
  return out.length ? out : undefined;
}
function sponsorList(raw: any, locale: string): Sponsor[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.slice(0, 12)
    .map((x: any) => ({ key: str(x?.key, 30) || 'general', title: str(x?.title), text: str(x?.text), href: link(x?.href, locale) }))
    .filter((x) => x.title);
  return out.length ? out : undefined;
}

// The audio file of the audio bar: one uploaded in the CMS, a file in this website's public/audio folder, or an https address.
// Only audio files are accepted, so a typing mistake cannot point the player at a page.
function audioSrc(raw: unknown): string | undefined {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (/^\/uploads\/home\/[\w.-]+\.(mp3|m4a|ogg|wav)$/i.test(v)) return `${FILES}${v}`;
  if (/^\/audio\/[\w.\- ]+\.(mp3|m4a|ogg|wav)$/i.test(v)) return encodeURI(v);
  if (/^https:\/\/[^\s'"<>]+\.(mp3|m4a|ogg|wav)(\?[^\s'"<>]*)?$/i.test(v)) return v;
  return undefined;
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const content = await loadContent();
  const cms = content?.[locale];
  const images = isObj(content?.images) ? content.images : {};
  const links = isObj(content?.links) ? content.links : {};
  const times = isObj(content?.times) ? content.times : {};
  const t: typeof dict = { ...dict };
  if (isObj(cms)) {
    for (const k of SECTIONS) if (k in cms) (t as any)[k] = merge((dict as any)[k], cms[k]);
    if ('guides' in cms) (t as any).guides = guidePhotos((t as any).guides);
    if ('festival' in cms) (t as any).festival = safeFestival((t as any).festival, (dict as any).festival);
  }
  return (
    <main>
      <Hero
        locale={locale}
        t={t.hero}
        bgImage={photoUrl(images.heroBg)}
        photo={photoUrl(images.heroPhoto)}
        primary={link(links.heroPrimary, locale)}
        secondary={link(links.heroSecondary, locale)}
      />
      <Founder locale={locale} t={t.founder} photo={photoUrl(images.founderPhoto)} cta={link(links.founderCta, locale)} />
      <Guides locale={locale} t={t.guides} leadImage={photoUrl(images.guideLead)} dayanandaImage={photoUrl(images.guideDayananda)} />
      <Festival
        locale={locale}
        t={t.festival}
        poster={photoUrl(images.festivalPoster)}
        register={link(links.festivalRegister, locale)}
        startTime={clock(times.festivalStart, '17:00')}
        endTime={clock(times.festivalEnd, '20:30')}
      />
      <CalendarSupport
        locale={locale}
        calendar={t.calendar}
        support={t.support}
        events={eventList(cms?.calendar?.items, locale)}
        sponsors={sponsorList(cms?.support?.items, locale)}
        eventsLink={link(links.calendarAll, locale)}
        donateLink={link(links.sponsor, locale)}
      />
      <QuickAccess
        locale={locale}
        t={{ ...t.quick, eyebrow: merge((dict as any).eyebrow ?? (t.quick as any).eyebrow ?? '', cms?.eyebrow), heading: merge((dict as any).heading ?? (t.quick as any).heading ?? '', cms?.heading) }}
        images={[1, 2, 3, 4].map((k) => photoUrl(images[`quick${k}`]))}
      />
      <Quotes t={t.quotes} attribution={str(cms?.quotes?.attribution, 120)} />
      <AudioBar t={t.audioBar} src={audioSrc(content?.audio)} />
    </main>
  );
}