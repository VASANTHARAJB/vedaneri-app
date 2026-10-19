// DUMMY DATA. The CMS portal will replace this file: keep the shape, swap the source.
// Every text has an English and a Tamil version. `amount: 0` means "as per the devotee's ability".

import type { Locale } from '@/lib/i18n';

export type L = { en: string; ta: string };
// 'corpus' items belong to the Corpus List tab; the others belong to the Seva List tab
export type SevaKind = 'festival' | 'regular' | 'annadhanam' | 'corpus';

export type Seva = {
  slug: string;
  kind: SevaKind;
  name: L;
  when: L;                 // shown on cards and on the detail page
  amount: number;          // fixed amount in rupees; 0 = devotee chooses
  minAmount: number;       // lowest amount a devotee may choose (only when amount is 0)
  from?: string;           // first date the seva can be booked for (YYYY-MM-DD)
  to?: string;             // last date (same as `from` for a one-day seva)
  weekday?: number;        // 0 = Sunday ... 6 = Saturday: seva is offered only on this day
  note?: L;                // extra line shown under the date
  benefit?: L;             // one-line "Benefits" text on the card (dummy text from the design; the ashram must confirm)
  status: 'open' | 'closed';
  maxQty: number;
  description: { en: string[]; ta: string[] }; // paragraphs; empty until the ashram writes them
  includes: { label: L; price: number }[];     // itemised list, if any
};

const base = { minAmount: 1, status: 'open' as const, maxQty: 10, description: { en: [], ta: [] }, includes: [] };

export const SEVAS: Seva[] = [
  { ...base, slug: 'kasi-viswanathar-annabishekam', kind: 'festival', amount: 0, from: '2026-10-25', to: '2026-10-25',
    name: { en: 'Sri Kasi Viswanathar Annabishekam', ta: 'ஸ்ரீ காசி விஸ்வநாதர் அன்னாபிஷேகம்' },
    when: { en: '25 Oct 2026', ta: '25 அக் 2026' } },
  { ...base, slug: 'skanda-shashti-puja', kind: 'festival', amount: 0, from: '2026-11-15', to: '2026-11-15',
    name: { en: 'Sri Skanda Shashti Puja', ta: 'ஸ்ரீ ஸ்கந்த சஷ்டி பூஜை' },
    when: { en: '15 Nov 2026', ta: '15 நவ 2026' } },
  { ...base, slug: 'navaratri-one-day-puja-kanikai', kind: 'festival', amount: 10001, from: '2026-10-11', to: '2026-10-21',
    name: { en: 'Sri Saradha Navaratri One Day Puja Kanikai', ta: 'ஸ்ரீ சாரதா நவராத்திரி ஒரு நாள் பூஜை காணிக்கை' },
    when: { en: '11 – 21 Oct 2026', ta: '11 – 21 அக் 2026' } },
  { ...base, slug: 'navaratri-sumangali-puja', kind: 'festival', amount: 2500, from: '2026-10-11', to: '2026-10-21',
    name: { en: 'Sri Saradha Navaratri Sumangali Puja', ta: 'ஸ்ரீ சாரதா நவராத்திரி சுமங்கலி பூஜை' },
    when: { en: '11 – 21 Oct 2026', ta: '11 – 21 அக் 2026' } },
  { ...base, slug: 'navaratri-sankalpam', kind: 'festival', amount: 501, from: '2026-10-11', to: '2026-10-21',
    name: { en: 'Sri Saradha Navaratri Sankalpam', ta: 'ஸ்ரீ சாரதா நவராத்திரி சங்கல்பம்' },
    when: { en: '11 – 21 Oct 2026', ta: '11 – 21 அக் 2026' } },
  { ...base, slug: 'navaratri-2026', kind: 'festival', amount: 0, from: '2026-10-11', to: '2026-10-21',
    name: { en: 'Sri Saradha Navaratri 2026', ta: 'ஸ்ரீ சாரதா நவராத்திரி 2026' },
    when: { en: '11 – 21 Oct 2026', ta: '11 – 21 அக் 2026' },
    includes: [
      { label: { en: 'Homa materials', ta: 'ஹோம பொருட்கள்' }, price: 20000 },
      { label: { en: 'Ghee, 20 kg', ta: 'நெய், 20 கிலோ' }, price: 15000 },
      { label: { en: 'Thirumangalyam (2 gram gold)', ta: 'திருமாங்கல்யம் (2 கிராம் தங்கம்)' }, price: 35000 },
      { label: { en: 'Flowers and garlands', ta: 'பூக்களும் மாலைகளும்' }, price: 15000 },
      { label: { en: 'Vastra samarpanam for Sri Mangala Chandi Homam', ta: 'ஸ்ரீ மங்கள சண்டி ஹோமத்துக்கு வஸ்திர சமர்ப்பணம்' }, price: 10000 },
      { label: { en: 'Sivacharyar sambavanai and Saptasati parayana ritvik sambavanai', ta: 'சிவாச்சாரியார் சம்பாவனை மற்றும் சப்தசதி பாராயண ரித்விக் சம்பாவனை' }, price: 90000 },
      { label: { en: 'Homa Sankalpam', ta: 'ஹோம சங்கல்பம்' }, price: 501 },
    ] },
  { ...base, slug: 'go-puja', benefit: { en: 'Brings prosperity, peace and purifies domestic environment.', ta: 'செழிப்பையும் அமைதியையும் தரும்; இல்லச் சூழலைத் தூய்மைப்படுத்தும்.' },
    kind: 'regular', amount: 200,
    name: { en: 'Go Puja', ta: 'கோபூஜை' }, when: { en: 'As desired', ta: 'விரும்பிய நாளில்' } },
  { ...base, slug: 'archanai', benefit: { en: 'Daily offering in your name with Vedic chantings.', ta: 'வேத மந்திரங்களுடன் உங்கள் பெயரில் தினசரி அர்ப்பணிப்பு.' },
    kind: 'regular', amount: 200,
    name: { en: 'Archanai', ta: 'அர்ச்சனை' }, when: { en: 'As desired', ta: 'விரும்பிய நாளில்' } },
  { ...base, slug: 'special-puja', kind: 'regular', amount: 500,
    name: { en: 'Special Puja (birthday, wedding day, etc.)', ta: 'சிறப்பு பூஜை (பிறந்தநாள், திருமண நாள் போன்றவை)' },
    when: { en: 'As desired', ta: 'விரும்பிய நாளில்' } },
  { ...base, slug: 'ganga-puja', benefit: { en: 'Performed on the holy banks of river Pennai.', ta: 'புனிதமான பெண்ணை ஆற்றின் கரையில் நடத்தப்படுகிறது.' },
    kind: 'regular', amount: 200, weekday: 5,
    name: { en: 'Sri Ganga Puja (Aarti)', ta: 'ஸ்ரீ கங்கா பூஜை (ஆரத்தி)' },
    when: { en: 'Every Friday', ta: 'ஒவ்வொரு வெள்ளிக்கிழமை' } },
  { ...base, slug: 'pradosa-puja', benefit: { en: 'Special bi-monthly worship of Lord Shiva.', ta: 'சிவபெருமானுக்கான சிறப்பு மாதம் இருமுறை வழிபாடு.' },
    kind: 'regular', amount: 200,
    name: { en: 'Sri Pradosa Puja', ta: 'ஸ்ரீ பிரதோஷ கால பூஜை' },
    when: { en: 'Only on Triyodasi', ta: 'திரயோதசி அன்று மட்டும்' },
    note: { en: 'Offered only on Triyodasi. Please choose a Triyodasi date; the ashram will confirm it.', ta: 'திரயோதசி அன்று மட்டும் நடைபெறும். திரயோதசி தேதியைத் தேர்ந்தெடுக்கவும்; ஆசிரமம் உறுதிப்படுத்தும்.' } },
  { ...base, slug: 'special-abhishekam', benefit: { en: 'Detailed ritual bath to presiding deity.', ta: 'மூலவருக்குச் செய்யப்படும் விரிவான அபிஷேகம்.' },
    kind: 'regular', amount: 2000,
    name: { en: 'Special Abhishekam and Alankaram', ta: 'சிறப்பு அபிஷேகம் & அலங்காரம்' },
    when: { en: 'As desired', ta: 'விரும்பிய நாளில்' } },
  { ...base, slug: 'udayastamana-puja', benefit: { en: 'Worship services from sunrise to sunset.', ta: 'சூரிய உதயம் முதல் அஸ்தமனம் வரையிலான வழிபாட்டுச் சேவைகள்.' },
    kind: 'regular', amount: 5000,
    name: { en: 'Udayastamana Puja', ta: 'உதயாஸ்தமன பூஜை' }, when: { en: 'As desired', ta: 'விரும்பிய நாளில்' } },
  { ...base, slug: 'parivara-devata-puja', kind: 'regular', amount: 1000,
    name: { en: 'Sri Parivara Devata Puja', ta: 'ஸ்ரீ பரிவார தேவதா பூஜை' }, when: { en: 'As desired', ta: 'விரும்பிய நாளில்' } },
  { ...base, slug: 'annadhanam', kind: 'annadhanam', amount: 9000, weekday: 4,
    name: { en: 'Annadhanam', ta: 'அன்னதானம்' },
    when: { en: 'Every Thursday', ta: 'ஒவ்வொரு வியாழக்கிழமை' } },
  // Corpus List (dummy). Names and the Rs 50,000 amount come from the old "Annadhanam & Corpus" page;
  // what each corpus funds and its rules are NOT known yet and must come from the ashram.
  { ...base, slug: 'adiguru-nitya-puja-corpus', kind: 'corpus', amount: 50000,
    name: { en: 'Sri Adiguru Nitya Puja Corpus', ta: 'ஸ்ரீ ஆதிகுரு நித்ய பூஜை கார்பஸ்' },
    when: { en: 'As desired', ta: 'விரும்பிய நாளில்' } },
  { ...base, slug: 'corpus-fund-general', kind: 'corpus', amount: 0,
    name: { en: 'Corpus Fund', ta: 'கார்பஸ் நிதி' },
    when: { en: 'As desired', ta: 'விரும்பிய நாளில்' } },
];

export const getSeva = (slug: string) => SEVAS.find((s) => s.slug === slug);
export const txt = (l: L, locale: Locale) => l[locale];

// How the date for a seva is chosen
export type DateMode = 'fixed' | 'range' | 'weekday' | 'any';
export function dateMode(s: Seva): DateMode {
  if (s.from && s.from === s.to) return 'fixed';
  if (s.from && s.to) return 'range';
  if (s.weekday !== undefined) return 'weekday';
  return 'any';
}
