// Tamil calendar worked out from the sky (no website, no key): Tamil year / month / day, and the thithi and nakshatram at sunrise.
//
// Needs:  npm install astronomy-engine   (in apps/api)
//
// Rules used (state them to anyone who compares this with a printed panchangam):
//   * Lahiri (Chitrapaksha) ayanamsa.
//   * Thithi and nakshatram are the ones running at SUNRISE of the day, for the place set by PANCHANGAM_LAT / PANCHANGAM_LNG (default Theni).
//   * A Tamil month starts on the day the Sun enters the next sign before that day's sunset; if it enters after sunset, the month starts next day.
//     So the Tamil month of a day is the sign the Sun is in at that day's sunset.
//   * The Tamil year starts on Chithirai 1.
// Vakya panchangams (used by some temples) can differ from this by a thithi on some days; compare Pournami, Amavasai and Ekadasi days.

import * as Astronomy from 'astronomy-engine';
import { tithiLabel, nakshatraLabel } from './panchangamProvider';

const IST_MS = 5.5 * 3600 * 1000;

// The month names are written exactly as the CMS Panchangam page writes them (TAMIL_MONTH_CONFIG keys).
export const TAMIL_MONTH_NAMES = [
  'Chithirai (சித்திரை)',
  'Vaikasi (வைகாசி)',
  'Aani (ஆனி)',
  'Aadi (ஆடி)',
  'Aavani (ஆவணி)',
  'Purattasi (புரட்டாசி)',
  'Iyppasi (ஐப்பசி)',
  'Karthigai (கார்த்திகை)',
  'Margazhi (மார்கழி)',
  'Thai (தை)',
  'Maasi (மாசி)',
  'Panguni (பங்குனி)',
];

export interface Place { lat: number; lng: number }

export function placeFromEnv(): Place {
  const num = (v: string | undefined, d: number) => {
    const n = v === undefined || v === '' ? NaN : Number(v);
    return Number.isFinite(n) ? n : d;
  };
  return { lat: num(process.env.PANCHANGAM_LAT, 10.0104), lng: num(process.env.PANCHANGAM_LNG, 77.4768) };
}

const ayanamsa = (d: Date): number => {
  const jd = d.getTime() / 86400000 + 2440587.5;
  return 23.85306 + 1.396 * ((jd - 2451545.0) / 36525);
};
const sidSun = (d: Date): number => (((Astronomy.SunPosition(Astronomy.MakeTime(d)).elon - ayanamsa(d)) % 360) + 360) % 360;
const sidMoon = (d: Date): number => (((Astronomy.EclipticGeoMoon(Astronomy.MakeTime(d)).lon - ayanamsa(d)) % 360) + 360) % 360;
const elongation = (d: Date): number => {
  const t = Astronomy.MakeTime(d);
  return (((Astronomy.EclipticGeoMoon(t).lon - Astronomy.SunPosition(t).elon) % 360) + 360) % 360;
};

// A local (IST) calendar date <-> a UTC Date at local midnight
const istMidnight = (iso: string): Date => new Date(new Date(`${iso}T00:00:00Z`).getTime() - IST_MS);
const addDays = (iso: string, n: number): string => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

const riseSetCache = new Map<string, Date>();
function riseSet(kind: 'rise' | 'set', iso: string, p: Place): Date {
  const key = `${kind}|${p.lat}|${p.lng}|${iso}`;
  const hit = riseSetCache.get(key);
  if (hit) return hit;
  const found = Astronomy.SearchRiseSet(
    Astronomy.Body.Sun,
    new Astronomy.Observer(p.lat, p.lng, 0),
    kind === 'rise' ? +1 : -1,
    istMidnight(iso),
    1
  );
  if (!found) throw new Error(`No sun${kind} found for ${iso}`);
  if (riseSetCache.size > 3000) riseSetCache.clear();
  riseSetCache.set(key, found.date);
  return found.date;
}

// The Tamil month (0 = Chithirai ... 11 = Panguni) of a local date = the sign the Sun is in at that day's sunset
const monthIndexOf = (iso: string, p: Place): number => Math.floor(sidSun(riseSet('set', iso, p)) / 30);

export interface TamilDay {
  date: string;
  startYear: number;      // English year in which this Tamil year began (Chithirai 1), e.g. 2026 for Parabhava 2026-27
  monthIndex: number;     // 0..11
  monthName: string;
  day: number;            // 1..32
  monthStart: string;     // English date of day 1
}

export function tamilDayOf(iso: string, p: Place = placeFromEnv()): TamilDay {
  const monthIndex = monthIndexOf(iso, p);
  let start = iso;
  for (let i = 0; i < 33; i++) {
    const prev = addDays(start, -1);
    if (monthIndexOf(prev, p) !== monthIndex) break;
    start = prev;
  }
  const day = Math.round((new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86400000) + 1;

  // Tamil year: began on Chithirai 1 of this English year or of the one before
  const y = Number(iso.slice(0, 4));
  let chith1 = `${y}-04-08`;
  for (let i = 0; i < 20 && monthIndexOf(chith1, p) !== 0; i++) chith1 = addDays(chith1, 1);
  const startYear = iso >= chith1 ? y : y - 1;

  return { date: iso, startYear, monthIndex, monthName: TAMIL_MONTH_NAMES[monthIndex], day, monthStart: start };
}

export interface LocalPanchang {
  date: string;
  thithi: string;
  nakshatram: string;
  tithiNumber: number;
  nakshatraNumber: number;
  sunrise: string;          // HH:mm IST
  sunset: string;           // HH:mm IST
  tithiEndsAt: string;      // IST, YYYY-MM-DDTHH:mm  (when the sunrise thithi ends)
  nakshatraEndsAt: string;  // IST, YYYY-MM-DDTHH:mm  (when the sunrise nakshatram ends)
  tithiEndsHoursAfterSunrise: number;
  nakshatraEndsHoursAfterSunrise: number;
  rasi: string;             // Moon sign at sunrise, "Viruchigam (விருச்சிகம்)"
  yogam: string;            // Yogam at sunrise
  karanam: string;          // Karanam at sunrise
  rahuKalam: string;        // "HH:mm–HH:mm" IST
  yamagandam: string;
  gulikai: string;
  festivals: string[];      // worked out from the rules below (monthly observances and the main festivals)
  spans: DaySpans;          // every thithi / nakshatram / yogam / karanam running between this sunrise and the next, with start and end times
}

export interface Span { name: string; from: string; to: string }   // IST, YYYY-MM-DDTHH:mm
export interface DaySpans { thithi: Span[]; nakshatram: Span[]; yogam: Span[]; karanam: Span[] }

// Names are written "English (தமிழ்)", the same way the CMS writes nakshatrams and months.
export const RASI_NAMES = [
  'Mesham (மேஷம்)', 'Rishabam (ரிஷபம்)', 'Mithunam (மிதுனம்)', 'Katakam (கடகம்)', 'Simmam (சிம்மம்)', 'Kanni (கன்னி)',
  'Thulam (துலாம்)', 'Viruchigam (விருச்சிகம்)', 'Dhanusu (தனுசு)', 'Makaram (மகரம்)', 'Kumbham (கும்பம்)', 'Meenam (மீனம்)',
];
export const YOGAM_NAMES = [
  'Vishkambha (விஷ்கம்பம்)', 'Preeti (ப்ரீதி)', 'Ayushman (ஆயுஷ்மான்)', 'Saubhagya (சௌபாக்யம்)', 'Shobhana (சோபனம்)', 'Atiganda (அதிகண்டம்)',
  'Sukarma (சுகர்மம்)', 'Dhriti (திருதி)', 'Shula (சூலம்)', 'Ganda (கண்டம்)', 'Vriddhi (விருத்தி)', 'Dhruva (துருவம்)',
  'Vyaghata (வியாகாதம்)', 'Harshana (ஹர்ஷணம்)', 'Vajra (வஜ்ரம்)', 'Siddhi (சித்தி)', 'Vyatipata (வ்யதீபாதம்)', 'Variyan (வரீயான்)',
  'Parigha (பரிகம்)', 'Shiva (சிவம்)', 'Siddha (சித்தம்)', 'Sadhya (சாத்யம்)', 'Shubha (சுபம்)', 'Shukla (சுக்லம்)',
  'Brahma (பிரம்மம்)', 'Indra (ஐந்திரம்)', 'Vaidhriti (வைதிருதி)',
];
const KARANAM_MOVABLE = [
  'Bava (பவம்)', 'Balava (பாலவம்)', 'Kaulava (கௌலவம்)', 'Taitila (தைதுலை)', 'Gara (கரசை)', 'Vanija (வணிசை)', 'Vishti / Bhadra (விஷ்டி / பத்திரை)',
];
// k = half-thithi number 1..60 (each karanam is 6 degrees of Moon-Sun elongation)
const karanamName = (k: number): string => {
  if (k === 1) return 'Kimstughna (கிம்ஸ்துக்னம்)';
  if (k === 58) return 'Shakuni (சகுனி)';
  if (k === 59) return 'Chatushpada (சதுஷ்பாதம்)';
  if (k === 60) return 'Naga (நாகவம்)';
  return KARANAM_MOVABLE[(k - 2) % 7];
};

// Rahu Kalam, Yamagandam and Gulikai: the time from sunrise to sunset is cut into 8 equal parts; the part number depends on the weekday.
//                          Sun Mon Tue Wed Thu Fri Sat
const RAHU_PART = [8, 2, 7, 5, 6, 4, 3];
const YAMA_PART = [5, 4, 3, 2, 1, 7, 6];
const GULI_PART = [7, 6, 5, 4, 3, 2, 1];
const part = (sr: Date, ss: Date, n: number): string => {
  const eighth = (ss.getTime() - sr.getTime()) / 8;
  const a = new Date(sr.getTime() + eighth * (n - 1));
  const b = new Date(sr.getTime() + eighth * n);
  const hm = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(11, 16);
  return `${hm(a)}–${hm(b)}`;
};

const istParts = (d: Date): { date: string; hm: string } => {
  const x = new Date(d.getTime() + IST_MS).toISOString();
  return { date: x.slice(0, 10), hm: x.slice(11, 16) };
};

// Time (as a Date) when f(date) next reaches `target` degrees, looking forward from `from` for up to `hours`
function nextCrossing(f: (d: Date) => number, target: number, from: Date, hours = 40): Date {
  const wrap = (v: number) => ((v - target + 540) % 360) - 180; // -180..180, zero at the target
  let lo = from.getTime();
  let prev = wrap(f(new Date(lo)));
  for (let t = lo + 900000; t <= lo + hours * 3600000; t += 900000) {
    const cur = wrap(f(new Date(t)));
    if (prev < 0 && cur >= 0) {
      let a = t - 900000;
      let b = t;
      for (let i = 0; i < 30; i++) {
        const mid = (a + b) / 2;
        if (wrap(f(new Date(mid))) < 0) a = mid; else b = mid;
      }
      return new Date(b);
    }
    prev = cur;
  }
  return new Date(from.getTime() + hours * 3600000);
}


// ---------------------------------------------------------------------------------------------------------------------
// Festivals worked out from the sky, by rule. These are SUGGESTIONS stored in their own column (auto_festivals); the festival a person types
// in the Panchangam Manager (special_event) is never touched.
//
//   * Monthly observances by the thithi at sunrise: Ekadasi, Amavasai, Pournami, Shashti, Masa Sivaratri; Pradosham by the thithi in the evening
//     (sunset + 45 min); Sankashti Chaturthi by the thithi at sunset + 2 h (moonrise time); Krithigai by the nakshatram at sunrise.
//   * Tamil-calendar festivals by Tamil month and day or nakshatram (Pongal, Aadi Perukku, Thaipusam, ...).
//   * Hindu lunar festivals by the lunar month (amanta: a month starts at the new moon; its name comes from the sign the Sun is in at that
//     new moon). An adhika (extra) month is skipped, because festivals are kept in the next month.
// Where a thithi changes through the day, printed panchangams may pick the neighbouring day: check Navami / Dasami / Chaturthi style days.
// ---------------------------------------------------------------------------------------------------------------------
const tnAt = (d: Date): number => Math.floor(elongation(d) / 12) + 1;
const HOUR = 3600000;

interface Lunation { start: number; nextStart: number; month: number; adhika: boolean }
const lunations: Lunation[] = [];

// Lunar month (0 = Chaitra ... 11 = Phalguna) that the given sunrise falls in
function lunarMonthAt(sr: Date): { month: number; adhika: boolean } {
  const t = sr.getTime();
  const e = elongation(sr);
  const daysSince = e / 12.19;
  for (const l of lunations) {
    if (t >= l.start && t < l.nextStart && Math.abs((t - l.start) / 86400000 - daysSince) < 1.6) return { month: l.month, adhika: l.adhika };
  }
  const from = new Date(t - (daysSince + 2) * 86400000);
  const start = nextCrossing(elongation, 0, from, (daysSince + 3) * 24);
  const next = nextCrossing(elongation, 0, new Date(start.getTime() + 20 * 86400000), 15 * 24);
  const signA = Math.floor(sidSun(start) / 30);
  const signB = Math.floor(sidSun(next) / 30);
  const rec: Lunation = { start: start.getTime(), nextStart: next.getTime(), month: (signA + 1) % 12, adhika: signA === signB };
  if (lunations.length > 200) lunations.length = 0;
  lunations.push(rec);
  return { month: rec.month, adhika: rec.adhika };
}

function festivalsOf(iso: string, p: Place, tn: number, nkNum: number, sr: Date, ss: Date, wd: number): string[] {
  const out: string[] = [];
  const add = (s: string) => { if (!out.includes(s)) out.push(s); };
  const td = tamilDayOf(iso, p);
  const mi = td.monthIndex;
  const day = td.day;

  // The thithi at sunrise, plus a thithi that begins and ends between two sunrises (it is kept on the day it happens, as printed panchangams do)
  const nextSr = riseSet('rise', addDays(iso, 1), p);
  const tnNext = tnAt(nextSr);
  const tset = new Set<number>([tn]);
  if (((tnNext - tn + 30) % 30) === 2) tset.add((tn % 30) + 1);
  const has = (n: number) => tset.has(n);
  const midnight = new Date((ss.getTime() + nextSr.getTime()) / 2);
  const tnMidnight = tnAt(midnight);
  const tnSunset = tnAt(new Date(ss.getTime() - 30 * 60000));
  const tEve = new Date(ss.getTime() + 1 * HOUR);
  const nkEve = Math.floor(sidMoon(tEve) / (360 / 27)) + 1;     // nakshatram in the evening (lamps are lit at dusk)
  const aparahna = new Date(sr.getTime() + 0.7 * (ss.getTime() - sr.getTime()));

  // monthly observances
  if (has(11) || has(26)) add('Ekadasi (ஏகாதசி)');
  const eve = tnAt(new Date(ss.getTime() + 0.75 * HOUR));
  if (eve === 13 || eve === 28) add('Pradosham (பிரதோஷம்)');
  if (has(30)) add('Amavasai (அமாவாசை)');
  if (has(15)) add('Pournami (பௌர்ணமி)');
  if (tnAt(new Date(ss.getTime() + 2 * HOUR)) === 19) add('Sankashti Chaturthi (சங்கடஹர சதுர்த்தி)');
  if (tnMidnight === 29) add('Masa Sivaratri (மாத சிவராத்திரி)');
  if (has(6) || has(21)) add('Shashti (சஷ்டி)');
  if (nkNum === 3) add('Krithigai (கிருத்திகை)');

  // Tamil-calendar festivals
  // a nakshatram-with-Pournami festival: the nakshatram at sunrise with the thithi just before Pournami, or the nakshatram at noon when Pournami is running at sunrise
  const nkMid = Math.floor(sidMoon(new Date((sr.getTime() + ss.getTime()) / 2)) / (360 / 27)) + 1;
  const withPournami = (n: number) => (nkNum === n && tn >= 13 && tn <= 15) || (tn === 15 && nkNum !== n && nkMid === n);
  if (mi === 0 && day === 1) add('Tamil New Year (தமிழ் புத்தாண்டு)');
  if (mi === 0 && has(15)) add('Chithra Pournami (சித்ரா பௌர்ணமி)');
  if (mi === 1 && withPournami(16)) add('Vaikasi Visakam (வைகாசி விசாகம்)');
  if (mi === 3 && day === 18) add('Aadi Perukku (ஆடிப்பெருக்கு)');
  if (mi === 3 && has(30)) add('Aadi Amavasai (ஆடி அமாவாசை)');
  if (mi === 3 && nkNum === 3 && day <= 27) add('Aadi Krithigai (ஆடிக் கிருத்திகை)');
  if (mi === 3 && nkNum === 11 && tn >= 3 && tn <= 6) add('Aadi Pooram (ஆடிப்பூரம்)');
  if (mi === 3 && wd === 5) add('Aadi Velli (ஆடி வெள்ளி)');
  if (mi === 3 && wd === 2) add('Aadi Chevvai (ஆடிச் செவ்வாய்)');
  if (mi === 5 && wd === 6) add('Purattasi Saturday (புரட்டாசி சனி)');
  if (mi === 7 && wd === 1) add('Karthigai Somavaram (கார்த்திகை சோமவாரம்)');
  if (mi === 6 && tnSunset === 6) add('Skanda Sashti - Soorasamharam (கந்த சஷ்டி - சூரசம்ஹாரம்)');
  if (mi === 7 && nkEve === 3 && tnAt(tEve) >= 13 && tnAt(tEve) <= 15) add('Karthigai Deepam (கார்த்திகை தீபம்)');
  if (mi === 8 && has(11)) add('Vaikunta Ekadasi (வைகுண்ட ஏகாதசி)');
  if (mi === 8 && nkNum === 6 && (tn >= 13 && tn <= 16)) add('Arudra Darshan (ஆருத்ரா தரிசனம்)');
  if (mi === 8 && monthIndexOf(addDays(iso, 1), p) === 9) add('Bhogi (போகி)');
  if (mi === 9 && day === 1) add('Thai Pongal (தைப் பொங்கல்)');
  if (mi === 9 && day === 2) add('Maattu Pongal (மாட்டுப் பொங்கல்)');
  if (mi === 9 && day === 3) add('Kaanum Pongal (காணும் பொங்கல்)');
  if (mi === 9 && has(30)) add('Thai Amavasai (தை அமாவாசை)');
  if (mi === 9 && withPournami(8)) add('Thaipusam (தைப்பூசம்)');
  if (mi === 10 && withPournami(10)) add('Masi Magam (மாசி மகம்)');
  if (mi === 11 && withPournami(12)) add('Panguni Uthiram (பங்குனி உத்திரம்)');

  // Hindu lunar festivals
  const lm = lunarMonthAt(sr);
  if (!lm.adhika) {
    const noon = new Date((sr.getTime() + ss.getTime()) / 2);
    const tnNoon = tnAt(noon);
    switch (lm.month) {
      case 0: if (has(9)) add('Rama Navami (ஸ்ரீ ராம நவமி)'); break;
      case 1: if (has(3)) add('Akshaya Tritiya (அட்சய திருதியை)'); break;
      case 3: if (has(15)) add('Guru Pournami (குரு பூர்ணிமா)'); break;
      case 4:
        if (has(15)) add('Avani Avittam (ஆவணி அவிட்டம்)');
        if (has(23)) add('Gokulashtami (கோகுலாஷ்டமி)');
        break;
      case 5:
        if (tnNoon === 4) add('Vinayagar Chaturthi (விநாயகர் சதுர்த்தி)');
        if (has(30)) add('Mahalaya Amavasai (மகாளய அமாவாசை)');
        break;
      case 6:
        if (has(1)) add('Navaratri begins (நவராத்திரி ஆரம்பம்)');
        if (has(9)) add('Saraswati / Ayudha Pooja (சரஸ்வதி / ஆயுத பூஜை)');
        if (tnAt(aparahna) === 10) add('Vijayadasami (விஜயதசமி)');
        if (has(29)) add('Deepavali (தீபாவளி)');
        break;
      case 10: if (tnMidnight === 29) add('Maha Sivaratri (மகா சிவராத்திரி)'); break;
      default: break;
    }
  }
  return out;
}


// The parts of the panchangam are not tied to the day: a thithi may start at 14:00 today and end at 11:00 tomorrow. This lists every one that
// runs between this sunrise and the next, with its full start and end (IST). `unit` is the size of one part in degrees (thithi 12, nakshatram
// 360/27, yogam 360/27, karanam 6); `f` is the angle that moves through it.
function spansOf(f: (d: Date) => number, unit: number, label: (idx: number) => string, sr: Date, nextSr: Date, maxHours: number): Span[] {
  const total = Math.round(360 / unit);
  const out: Span[] = [];
  let idx = Math.floor(f(sr) / unit) % total;
  // when the running part began (it may be before sunrise)
  let start = nextCrossing(f, (idx * unit) % 360, new Date(sr.getTime() - 40 * HOUR), 46);
  if (start.getTime() > sr.getTime()) start = new Date(sr.getTime() - 60000); // safety: never later than sunrise
  for (let guard = 0; guard < 12 && start.getTime() < nextSr.getTime(); guard++) {
    const end = nextCrossing(f, (((idx + 1) * unit) % 360), new Date(Math.max(start.getTime(), sr.getTime() - 3 * 60000) - 3 * 60000), maxHours);
    const a = istParts(start);
    const b = istParts(end);
    out.push({ name: label(idx), from: `${a.date}T${a.hm}`, to: `${b.date}T${b.hm}` });
    start = end;
    idx = (idx + 1) % total;
  }
  return out;
}

const sunPlusMoon = (d: Date): number => (sidSun(d) + sidMoon(d)) % 360;

function daySpans(sr: Date, nextSr: Date): DaySpans {
  return {
    thithi: spansOf(elongation, 12, (i) => tithiLabel(i + 1), sr, nextSr, 40),
    nakshatram: spansOf(sidMoon, 360 / 27, (i) => nakshatraLabel(i + 1), sr, nextSr, 40),
    yogam: spansOf(sunPlusMoon, 360 / 27, (i) => YOGAM_NAMES[i], sr, nextSr, 40),
    karanam: spansOf(elongation, 6, (i) => karanamName(i + 1), sr, nextSr, 24),
  };
}

export function localPanchang(iso: string, p: Place = placeFromEnv()): LocalPanchang {
  const sr = riseSet('rise', iso, p);
  const tn = Math.floor(elongation(sr) / 12) + 1;               // 1..30
  const nk = Math.floor(sidMoon(sr) / (360 / 27));              // 0..26
  const tEnd = nextCrossing(elongation, (tn * 12) % 360, new Date(sr.getTime() - 3 * 60000));
  const nEnd = nextCrossing(sidMoon, ((nk + 1) * (360 / 27)) % 360, new Date(sr.getTime() - 3 * 60000));
  const ss = riseSet('set', iso, p);
  const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();          // 0 = Sunday (the local calendar date's weekday)
  const te = istParts(tEnd);
  const ne = istParts(nEnd);
  return {
    date: iso,
    thithi: tithiLabel(tn),
    nakshatram: nakshatraLabel(nk + 1),
    tithiNumber: tn,
    nakshatraNumber: nk + 1,
    sunrise: istParts(sr).hm,
    sunset: istParts(ss).hm,
    tithiEndsAt: `${te.date}T${te.hm}`,
    nakshatraEndsAt: `${ne.date}T${ne.hm}`,
    tithiEndsHoursAfterSunrise: Math.round(((tEnd.getTime() - sr.getTime()) / 3600000) * 10) / 10,
    nakshatraEndsHoursAfterSunrise: Math.round(((nEnd.getTime() - sr.getTime()) / 3600000) * 10) / 10,
    rasi: RASI_NAMES[Math.floor(sidMoon(sr) / 30)],
    yogam: YOGAM_NAMES[Math.floor((((sidSun(sr) + sidMoon(sr)) % 360) / (360 / 27)))],
    karanam: karanamName(Math.floor(elongation(sr) / 6) + 1),
    rahuKalam: part(sr, ss, RAHU_PART[wd]),
    yamagandam: part(sr, ss, YAMA_PART[wd]),
    gulikai: part(sr, ss, GULI_PART[wd]),
    festivals: festivalsOf(iso, p, tn, nk + 1, sr, ss, wd),
    spans: daySpans(sr, riseSet('rise', addDays(iso, 1), p)),
  };
}