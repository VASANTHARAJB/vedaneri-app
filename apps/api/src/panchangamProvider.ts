// Panchangam 3rd-party API adapter.
// Fills ONLY thithi + nakshatram for an English date. It never writes to the database.
//
// Env vars (server .env):
//   PANCHANGAM_PROVIDER = nitya | freeastro | astrologyapi   (default: nitya)
//   PANCHANGAM_LAT / PANCHANGAM_LNG                (default: Theni 10.0104 / 77.4768)
//   PANCHANGAM_TZ                                  (default: Asia/Kolkata, freeastro only)
//   FREEASTRO_API_KEY                              (freeastro only)
//   FREEASTRO_BASE_URL                             (optional, default https://www.freeastroapi.com)
//   ASTROLOGYAPI_ACCESS_TOKEN                      (astrologyapi, new-style single token "ak-...", sent as x-astrologyapi-key)
//   ASTROLOGYAPI_USER_ID / ASTROLOGYAPI_API_KEY    (astrologyapi, old-style pair, sent as Basic auth). Use one style, not both.
//                                                  (paid account; these stay on the server and are never sent to the browser)
//   ASTROLOGYAPI_BASE_URL                          (optional, default https://json.astrologyapi.com)
//   PANCHANGAM_TZONE                               (astrologyapi only, hours from UTC, default 5.5)
//   PANCHANGAM_DEBUG = 1                           (lets ?debug=1 return the raw provider JSON)

export interface PanchangamSuggestion {
  date: string;
  thithi: string;
  nakshatram: string;
  tithiNumber: number | null;
  nakshatraNumber: number | null;
  tithiEndsAt: string | null;
  nakshatraEndsAt: string | null;
  provider: string;
  warnings: string[];
  raw?: unknown;
}

export interface BatchResult {
  date: string;
  ok: boolean;
  suggestion?: PanchangamSuggestion;
  error?: string;
}

export class ProviderConfigError extends Error {}

// A ProviderDataError carries a message that is safe to show in the CMS (no provider body, no URL, no key).
// Anything else that goes wrong is logged on the server and shown to the user as a short generic text.
export class ProviderDataError extends Error {}
const GENERIC_ERROR = 'The Panchangam service could not answer for this date';
export function safeMessage(e: unknown): string {
  if (e instanceof ProviderDataError || e instanceof ProviderConfigError) return e.message;
  return GENERIC_ERROR;
}

/* ------------------------------------------------------------------ */
/* Labels - keep these identical to COMMON_THITHIS / NAKSHATRAMS_LIST  */
/* in your web app's lib/panchangam.ts so saved text stays consistent. */
/* ------------------------------------------------------------------ */

// Index 1..14 (same for both pakshas). 15 is Pournami (Sukla) or Amavasai (Krishna).
const TITHI_BASE = [
  'Prathamai',
  'Dwitiyai',
  'Thrithiyai',
  'Chathurthi',
  'Panchami',
  'Sashti',
  'Sapthami',
  'Ashtami',
  'Navami',
  'Dasami',
  'Ekadasi',
  'Dwadasi',
  'Thrayodasi',
  'Sathuradasi',
];

const NAKSHATRA_LABELS: string[] = [
  'Ashwini (அசுவினி)',
  'Bharani (பரணி)',
  'Krittika (கார்த்திகை)',
  'Rohini (ரோகிணி)',
  'Mrigashira (மிருகசீரிடம்)',
  'Ardra (திருவாதிரை)',
  'Punarvasu (புனர்பூசம்)',
  'Pushya (பூசம்)',
  'Ashlesha (ஆயில்யம்)',
  'Magha (மகம்)',
  'Purva Phalguni (பூரம்)',
  'Uttara Phalguni (உத்திரம்)',
  'Hasta (அஸ்தம்)',
  'Chitra (சித்திரை)',
  'Swati (சுவாதி)',
  'Vishakha (விசாகம்)',
  'Anuradha (அனுஷம்)',
  'Jyeshtha (கேட்டை)',
  'Mula (மூலம்)',
  'Purva Ashadha (பூராடம்)',
  'Uthiradam (உத்திராடம்)',
  'Shravana (திருவோணம்)',
  'Dhanishta (அவிட்டம்)',
  'Sadayam (சதயம்)',
  'Purva Bhadrapada (பூரட்டாதி)',
  'Uthirattathi (உத்திரட்டாதி)',
  'Revati (ரேவதி)',
];

// Spellings providers may return, letters only, lower-case. Index = nakshatra number - 1.
const NAKSHATRA_ALIASES: string[][] = [
  ['ashwini', 'ashvini', 'aswini'],
  ['bharani', 'bharni'],
  ['krittika', 'kritika', 'karthigai', 'kartika', 'karthika'],
  ['rohini'],
  ['mrigashira', 'mrigasira', 'mrigashirsha', 'mrigasheersha', 'mirugasirisham', 'mrigashirsa'],
  ['ardra', 'arudra', 'aridra', 'thiruvathirai'],
  ['punarvasu', 'punarpoosam'],
  ['pushya', 'pushyami', 'pusya', 'poosam'],
  ['ashlesha', 'aslesha', 'ashlesa', 'ayilyam'],
  ['magha', 'makha', 'maham'],
  ['purvaphalguni', 'purvaphalguna', 'purvaphalgunee', 'pubba', 'pooram'],
  ['uttaraphalguni', 'uttaraphalguna', 'uttaraphalgunee', 'uthiram'],
  ['hasta', 'hastham', 'astham'],
  ['chitra', 'chitta', 'chithirai'],
  ['swati', 'svati', 'swathi'],
  ['vishakha', 'visakha', 'visakam'],
  ['anuradha', 'anuradhaa', 'anusham'],
  ['jyeshtha', 'jyeshta', 'jyestha', 'kettai'],
  ['mula', 'moola', 'moolam'],
  ['purvaashadha', 'purvashadha', 'purvaashada', 'pooradam'],
  ['uttaraashadha', 'uttarashadha', 'uttaraashada', 'uthiradam'],
  ['shravana', 'sravana', 'shravan', 'thiruvonam'],
  ['dhanishta', 'dhanishtha', 'shravishtha', 'avittam'],
  ['shatabhisha', 'shatabhishak', 'satabhisha', 'shatataraka', 'sathayam', 'sadayam'],
  ['purvabhadrapada', 'purvabhadra', 'purvaproshthapada', 'pooratathi', 'poorattathi'],
  ['uttarabhadrapada', 'uttarabhadra', 'uttaraproshthapada', 'uthirattathi'],
  ['revati', 'revathi'],
];

// Tithi base names -> 1..15 (15 = purnima / amavasya).
const TITHI_ALIASES: Record<string, number> = {
  pratipada: 1, prathama: 1, prathamai: 1, pirathamai: 1,
  dwitiya: 2, dvitiya: 2, dwitiyai: 2, thuthiyai: 2, dwithiya: 2,
  tritiya: 3, thritiya: 3, trithiya: 3, thrithiyai: 3, thiruthiyai: 3,
  chaturthi: 4, sathurthi: 4, chathurthi: 4,
  panchami: 5, panjami: 5,
  shashthi: 6, shashti: 6, sashti: 6, shasti: 6,
  saptami: 7, sapthami: 7,
  ashtami: 8, astami: 8,
  navami: 9,
  dashami: 10, dasami: 10, thasami: 10,
  ekadashi: 11, ekadasi: 11, egadashi: 11, egadasi: 11,
  dwadashi: 12, dvadashi: 12, dwadasi: 12, duvadasi: 12, thuvadasi: 12,
  trayodashi: 13, thrayodasi: 13, thirayodasi: 13,
  chaturdashi: 14, chathurdasi: 14, sathuradasi: 14,
  purnima: 15, pournami: 15, pournamai: 15, poornima: 15, purnamasi: 15,
  amavasya: 15, amavasai: 15, amavasi: 15,
};

const lettersOnly = (s: unknown): string => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');

export function tithiLabel(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 30) throw new Error(`Invalid tithi number ${n}`);
  const sukla = n <= 15;
  const idx = ((n - 1) % 15) + 1; // 1..15
  const base = idx === 15 ? (sukla ? 'Pournami' : 'Amavasai') : TITHI_BASE[idx - 1];
  return `${sukla ? 'Sukla' : 'Krishna'} Paksha ${base}`;
}

export function nakshatraLabel(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 27) throw new Error(`Invalid nakshatra number ${n}`);
  return NAKSHATRA_LABELS[n - 1];
}

export function nakshatraNumberFromName(name: unknown): number | null {
  const key = lettersOnly(name);
  if (!key) return null;
  const i = NAKSHATRA_ALIASES.findIndex((list) => list.includes(key));
  return i === -1 ? null : i + 1;
}

// "Chaturthi (Krishna)" / "Krishna Chaturthi" + optional paksha -> 1..30
export function tithiNumberFromName(name: unknown, paksha?: unknown): number | null {
  const text = String(name ?? '').toLowerCase();
  const pakshaText = `${text} ${String(paksha ?? '').toLowerCase()}`;
  const words = text.split(/[^a-z]+/).filter(Boolean);
  let idx: number | null = null;
  let word = '';
  for (const w of words) {
    if (TITHI_ALIASES[w]) {
      idx = TITHI_ALIASES[w];
      word = w;
      break;
    }
  }
  if (idx === null) return null;
  if (['purnima', 'pournami', 'pournamai', 'poornima', 'purnamasi'].includes(word)) return 15;
  if (['amavasya', 'amavasai', 'amavasi'].includes(word)) return 30;
  const krishna = /krishna|krushna|bahula|\bk\b/.test(pakshaText);
  const sukla = /shukla|sukla|sudha|\bs\b/.test(pakshaText);
  if (krishna === sukla) return null; // unknown or contradictory
  return krishna ? 15 + idx : idx;
}

// Works out the tithi 1..30 from the provider's number AND its name/paksha, and refuses to guess when they disagree.
// Some providers number tithis 1..15 inside each paksha; trusting the bare number would label every Krishna day as Sukla.
export function resolveTithi(numberRaw: unknown, name: unknown, paksha: unknown, warnings: string[]): number {
  const n = numberRaw === null || numberRaw === undefined || numberRaw === '' ? NaN : Number(numberRaw);
  const num = Number.isInteger(n) && n >= 1 && n <= 30 ? n : null;
  const byName = tithiNumberFromName(name, paksha);
  if (num === null && byName === null) throw new ProviderDataError('Could not read the tithi from the provider answer');
  if (num === null) return byName as number;
  if (byName === null) {
    if (num <= 15 && !String(paksha ?? '').trim() && !/krishna|shukla|sukla|bahula|sudha/i.test(String(name ?? ''))) {
      warnings.push('Provider gave no paksha; Sukla was assumed, check the paksha');
    }
    return num;
  }
  if (byName === num) return num;
  if (num <= 15 && byName === num + 15) {
    warnings.push('Provider numbers tithis inside each paksha; the paksha from its name was used');
    return byName;
  }
  throw new ProviderDataError(`Provider tithi number (${num}) and name (${String(name ?? '').slice(0, 40)}) disagree; not used`);
}

/* ------------------------------------------------------------------ */
/* Config + HTTP                                                       */
/* ------------------------------------------------------------------ */

function config() {
  const num = (v: string | undefined, d: number) => {
    const n = v === undefined || v === '' ? NaN : Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const provider = (process.env.PANCHANGAM_PROVIDER || 'nitya').toLowerCase();
  return {
    provider,
    lat: num(process.env.PANCHANGAM_LAT, 10.0104),
    lng: num(process.env.PANCHANGAM_LNG, 77.4768),
    tz: process.env.PANCHANGAM_TZ || 'Asia/Kolkata',
    freeAstroKey: process.env.FREEASTRO_API_KEY || '',
    astroToken: process.env.ASTROLOGYAPI_ACCESS_TOKEN || '',
    astroUserId: process.env.ASTROLOGYAPI_USER_ID || '',
    astroApiKey: process.env.ASTROLOGYAPI_API_KEY || '',
    astroBase: (process.env.ASTROLOGYAPI_BASE_URL || 'https://json.astrologyapi.com').replace(/\/+$/, ''),
    tzone: num(process.env.PANCHANGAM_TZONE, 5.5),
    freeAstroBase: (process.env.FREEASTRO_BASE_URL || 'https://www.freeastroapi.com').replace(/\/+$/, ''),
  };
}

async function httpJson(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Panchangam provider HTTP ${res.status}:`, text.slice(0, 200));
      if (res.status === 401 || res.status === 403) throw new ProviderConfigError('The Panchangam provider rejected the server credentials');
      if (res.status === 429) throw new ProviderDataError('The Panchangam provider daily limit is reached. Try again tomorrow');
      throw new ProviderDataError(`The Panchangam provider returned an error (HTTP ${res.status})`);
    }
    try {
      return JSON.parse(text);
    } catch {
      console.error('Panchangam provider returned non-JSON:', text.slice(0, 120));
      throw new ProviderDataError('The Panchangam provider returned an unreadable answer');
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new ProviderDataError('The Panchangam provider timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/* ------------------------------------------------------------------ */
/* Adapters                                                            */
/* ------------------------------------------------------------------ */

// nityapanchangam.com - no key. Free tier: 1000 req/IP/day, attribution required (CC-BY 4.0),
// and the page also says "non-commercial". Documented accuracy ~1 degree (simplified model).
async function fromNitya(date: string): Promise<PanchangamSuggestion> {
  const c = config();
  const url = new URL('https://nityapanchangam.com/api/panchangam.php');
  url.searchParams.set('date', date);
  url.searchParams.set('lat', String(c.lat));
  url.searchParams.set('lng', String(c.lng));
  const body = await httpJson(url.toString());

  const warnings: string[] = [];
  if (body?.date && body.date !== date) {
    // A suggestion for another day must never be shown against this day.
    throw new ProviderDataError('The provider answered for a different date; not used');
  }

  const tn = resolveTithi(body?.tithi?.number, body?.tithi?.name, body?.tithi?.paksha ?? body?.paksha, warnings);
  const nn = nakshatraNumberFromName(body?.nakshatra?.name);
  if (nn === null) {
    console.error('Unknown nakshatra from provider:', JSON.stringify(body?.nakshatra));
    throw new ProviderDataError('The provider returned a nakshatra name that is not recognised');
  }

  warnings.push('Source gives no tithi/nakshatra end times; verify near boundaries');
  return {
    date,
    thithi: tithiLabel(tn),
    nakshatram: nakshatraLabel(nn),
    tithiNumber: tn,
    nakshatraNumber: nn,
    tithiEndsAt: null,
    nakshatraEndsAt: null,
    provider: 'nitya',
    warnings,
    raw: body,
  };
}

// freeastroapi.com - free key in x-api-key header. Response shape taken from their docs
// (tithi/nakshatra objects with number, name, paksha, ends_at_iso); check one real response.
async function fromFreeAstro(date: string): Promise<PanchangamSuggestion> {
  const c = config();
  if (!c.freeAstroKey) throw new ProviderConfigError('FREEASTRO_API_KEY is not set on the server');
  const [y, m, d] = date.split('-').map(Number);
  const body = await httpJson(`${c.freeAstroBase}/api/v2/vedic/panchang`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': c.freeAstroKey },
    // 06:00 is close to sunrise in Tamil Nadu; the day's tithi/nakshatra are the ones at sunrise.
    body: JSON.stringify({ year: y, month: m, day: d, hour: 6, minute: 0, lat: c.lat, lng: c.lng, tz_str: c.tz }),
  });

  const root = body?.data ?? body?.panchang ?? body;
  const t = root?.tithi;
  const n = root?.nakshatra;
  if (!t || !n) throw new ProviderDataError('Unexpected answer from the provider (no tithi/nakshatra)');

  const warnings: string[] = [];
  const tn = resolveTithi(t.number, t.name, t.paksha, warnings);

  const numRaw = n.number === null || n.number === undefined || n.number === '' ? NaN : Number(n.number);
  const byName = nakshatraNumberFromName(n.name);
  let nn: number | null = Number.isInteger(numRaw) && numRaw >= 1 && numRaw <= 27 ? numRaw : byName;
  if (nn === null) throw new ProviderDataError('The provider returned a nakshatra that is not recognised');
  // Number and name must agree; if they do not, do not guess.
  if (byName !== null && byName !== nn) {
    throw new ProviderDataError(`Provider nakshatra number (${nn}) and name (${String(n.name ?? '').slice(0, 40)}) disagree; not used`);
  }

  return {
    date,
    thithi: tithiLabel(tn),
    nakshatram: nakshatraLabel(nn),
    tithiNumber: tn,
    nakshatraNumber: nn,
    tithiEndsAt: t.ends_at_iso ?? t.ends_at ?? null,
    nakshatraEndsAt: n.ends_at_iso ?? n.ends_at ?? null,
    provider: 'freeastro',
    warnings,
    raw: body,
  };
}

// astrologyapi.com tamil_panchang - paid account, Basic auth (user id : api key). Fields as listed in their docs:
// tithi.details + tithi.end_time, nakshatra.details + nakshatra.end_time, paksha, tamil_month.month_name, sunrise.
// English transliteration only (no Tamil script). Check one real response before relying on it.
async function fromAstrologyApi(date: string): Promise<PanchangamSuggestion> {
  const c = config();
  let authHeaders: Record<string, string>;
  if (c.astroToken) {
    authHeaders = { 'x-astrologyapi-key': c.astroToken };
  } else if (c.astroUserId && c.astroApiKey) {
    authHeaders = { Authorization: `Basic ${Buffer.from(`${c.astroUserId}:${c.astroApiKey}`).toString('base64')}` };
  } else {
    throw new ProviderConfigError('Set ASTROLOGYAPI_ACCESS_TOKEN (or ASTROLOGYAPI_USER_ID and ASTROLOGYAPI_API_KEY) on the server');
  }
  const [y, m, d] = date.split('-').map(Number);
  const body = await httpJson(`${c.astroBase}/v1/tamil_panchang`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Language': 'en', ...authHeaders },
    // 06:00 is close to sunrise in Tamil Nadu; the day's tithi/nakshatra are the ones at sunrise.
    body: JSON.stringify({ day: d, month: m, year: y, hour: 6, min: 0, lat: c.lat, lon: c.lng, tzone: c.tzone }),
  });

  const t = body?.tithi;
  const n = body?.nakshatra;
  if (!t || !n || typeof t !== 'object' || typeof n !== 'object') {
    console.error('astrologyapi unexpected answer:', JSON.stringify(body).slice(0, 300));
    throw new ProviderDataError('Unexpected answer from the provider (no tithi/nakshatra)');
  }

  const warnings: string[] = [];
  const tn = resolveTithi(undefined, t.details, body?.paksha, warnings);
  const nn = nakshatraNumberFromName(n.details);
  if (nn === null) {
    console.error('Unknown nakshatra from provider:', JSON.stringify(n));
    throw new ProviderDataError('The provider returned a nakshatra name that is not recognised');
  }
  if (!t.end_time && !n.end_time) warnings.push('Provider gave no end times; verify near boundaries');

  const text = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v).slice(0, 60));
  return {
    date,
    thithi: tithiLabel(tn),
    nakshatram: nakshatraLabel(nn),
    tithiNumber: tn,
    nakshatraNumber: nn,
    tithiEndsAt: text(t.end_time),
    nakshatraEndsAt: text(n.end_time),
    provider: 'astrologyapi',
    warnings,
    raw: body,
  };
}

/* ------------------------------------------------------------------ */
/* Public API with in-memory cache                                     */
/* ------------------------------------------------------------------ */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: PanchangamSuggestion }>();

export async function getSuggestion(date: string, opts: { includeRaw?: boolean } = {}): Promise<PanchangamSuggestion> {
  if (!isValidIsoDate(date)) throw new Error('date must be a real date in YYYY-MM-DD form');
  const c = config();
  if (c.provider !== 'nitya' && c.provider !== 'freeastro' && c.provider !== 'astrologyapi') {
    throw new ProviderConfigError(`Unknown PANCHANGAM_PROVIDER "${c.provider}" (use nitya, freeastro or astrologyapi)`);
  }
  const key = `${c.provider}|${c.lat}|${c.lng}|${date}`;
  const hit = cache.get(key);
  let value: PanchangamSuggestion;
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    value = hit.value;
  } else {
    value =
      c.provider === 'freeastro' ? await fromFreeAstro(date)
      : c.provider === 'astrologyapi' ? await fromAstrologyApi(date)
      : await fromNitya(date);
    cache.set(key, { at: Date.now(), value });
  }
  const { raw, ...rest } = value;
  return opts.includeRaw ? { ...rest, raw } : rest;
}

export async function getSuggestions(dates: string[], concurrency = 3): Promise<BatchResult[]> {
  const results: BatchResult[] = new Array(dates.length);
  let next = 0;
  const worker = async () => {
    while (next < dates.length) {
      const i = next++;
      const date = dates[i];
      try {
        results[i] = { date, ok: true, suggestion: await getSuggestion(date) };
      } catch (e: any) {
        if (e instanceof ProviderConfigError) throw e; // misconfiguration: fail the whole batch
        console.error(`Panchangam lookup failed for ${date}:`, e?.message || e);
        results[i] = { date, ok: false, error: safeMessage(e) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, dates.length) }, worker));
  return results;
}