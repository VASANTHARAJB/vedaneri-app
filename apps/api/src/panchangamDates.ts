import { pool } from './db';
import { hasExtraColumns } from './panchangamColumns';

// One place that answers "on which saved calendar days does this thithi or festival fall?" for the sevas and donation funds.
//
// A trigger such as "Sukla Paksha Sashti", "Krishna Paksha Chathurthi", "Ekadasi", "Sankashti Chaturthi" or "Deepavali" is searched in
//   - thithi            the thithi at sunrise that the calendar saves ("Sukla Paksha Sashti")
//   - special_event     the festival text typed by a person (older entries)
//   - auto_festivals    the festivals worked out by the calendar (only when sql/panchangam-extra-columns.sql has been run)
// Common spellings are tried too (Sashti = Shashti, Chathurthi = Chaturthi, Sankashti = Sankatahara ...).
// Only days that are already saved in panchangam_calendar can be found, so the whole-year fills have to be run first.

export interface PanchangamDateRow {
  calendar_date: string; // YYYY-MM-DD
  tamil_year: string;
  tamil_month: string;
  tamil_date: number;
  thithi: string;
  nakshatram: string;
  special_event: string | null;
  auto_festivals?: string | null;
}

const SPELLINGS: string[][] = [
  ['Sashti', 'Shashti', 'Shasti'],
  ['Chathurthi', 'Chaturthi'],
  ['Amavasai', 'Amavasya'],
  ['Pournami', 'Purnima', 'Pournima'],
  ['Ekadasi', 'Ekadashi'],
  ['Sankashti', 'Sankatahara'],
];

const regexEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const likeEscape = (s: string) => s.replace(/[\\%_]/g, '\\$&');

// The trigger as typed, plus the same words with the other common spellings
export function triggerPatterns(trigger: string): string[] {
  const base = String(trigger ?? '').trim().slice(0, 100);
  if (!base) return [];
  let patterns = [base];
  for (const group of SPELLINGS) {
    const added: string[] = [];
    for (const p of patterns) {
      const hit = group.find((m) => new RegExp(regexEscape(m), 'i').test(p));
      if (!hit) continue;
      for (const other of group) {
        if (other === hit) continue;
        added.push(p.replace(new RegExp(regexEscape(hit), 'ig'), other));
      }
    }
    patterns = Array.from(new Set([...patterns, ...added])).slice(0, 16);
  }
  return patterns;
}

// Saved days from today onwards that match the trigger, oldest first.
//   limit        at most this many days
//   withinDays   only days up to this many days from today (366 = "the coming year")
export async function findPanchangamDates(
  trigger: string,
  opts: { limit?: number; withinDays?: number } = {}
): Promise<PanchangamDateRow[]> {
  const patterns = triggerPatterns(trigger);
  if (patterns.length === 0) return [];

  const extra = await hasExtraColumns();
  const one = extra
    ? '(thithi LIKE ? OR special_event LIKE ? OR auto_festivals LIKE ?)'
    : '(thithi LIKE ? OR special_event LIKE ?)';

  const params: string[] = [];
  for (const p of patterns) {
    const like = `%${likeEscape(p)}%`;
    params.push(like, like);
    if (extra) params.push(like);
  }

  const limit = Number.isInteger(opts.limit) && (opts.limit as number) > 0 ? Math.min(opts.limit as number, 400) : 0;
  const days = Number.isInteger(opts.withinDays) && (opts.withinDays as number) > 0 ? Math.min(opts.withinDays as number, 1000) : 0;

  const sql = `SELECT DATE_FORMAT(calendar_date, '%Y-%m-%d') AS calendar_date,
        tamil_year, tamil_month, tamil_date, thithi, nakshatram, special_event${extra ? ', auto_festivals' : ''}
     FROM panchangam_calendar
     WHERE (${patterns.map(() => one).join(' OR ')})
       AND calendar_date >= CURDATE()${days ? ` AND calendar_date <= DATE_ADD(CURDATE(), INTERVAL ${days} DAY)` : ''}
     ORDER BY calendar_date ASC${limit ? ` LIMIT ${limit}` : ''}`;

  const [rows]: any = await pool.query(sql, params);
  return Array.isArray(rows) ? rows : [];
}

// The next matching day (YYYY-MM-DD), or null
export async function nextPanchangamDate(trigger: string): Promise<string | null> {
  if (!trigger) return null;
  try {
    const rows = await findPanchangamDates(trigger, { limit: 1 });
    return rows.length ? rows[0].calendar_date : null;
  } catch (e) {
    console.error('[Panchangam] next date lookup failed:', e);
    return null;
  }
}

/* ---------------- the pick list for the CMS ---------------- */

const TITHI_NAMES = [
  'Prathamai', 'Dwitiyai', 'Thrithiyai', 'Chathurthi', 'Panchami', 'Sashti', 'Sapthami',
  'Ashtami', 'Navami', 'Dasami', 'Ekadasi', 'Dwadasi', 'Thrayodasi', 'Sathuradasi',
];

// Festival names exactly as the calendar writes them (English part used for matching, Tamil part for display)
const FESTIVALS: string[] = [
  'Tamil New Year (தமிழ் புத்தாண்டு)',
  'Akshaya Tritiya (அட்சய திருதியை)',
  'Chithra Pournami (சித்ரா பௌர்ணமி)',
  'Vaikasi Visakam (வைகாசி விசாகம்)',
  'Guru Pournami (குரு பூர்ணிமா)',
  'Aadi Perukku (ஆடிப்பெருக்கு)',
  'Aadi Pooram (ஆடிப்பூரம்)',
  'Aadi Amavasai (ஆடி அமாவாசை)',
  'Avani Avittam (ஆவணி அவிட்டம்)',
  'Gokulashtami (கோகுலாஷ்டமி)',
  'Vinayagar Chaturthi (விநாயகர் சதுர்த்தி)',
  'Mahalaya Amavasai (மகாளய அமாவாசை)',
  'Navaratri begins (நவராத்திரி ஆரம்பம்)',
  'Saraswati / Ayudha Pooja (சரஸ்வதி / ஆயுத பூஜை)',
  'Vijayadasami (விஜயதசமி)',
  'Deepavali (தீபாவளி)',
  'Skanda Sashti - Soorasamharam (கந்த சஷ்டி - சூரசம்ஹாரம்)',
  'Karthigai Deepam (கார்த்திகை தீபம்)',
  'Arudra Darshan (ஆருத்ரா தரிசனம்)',
  'Vaikunta Ekadasi (வைகுண்ட ஏகாதசி)',
  'Bhogi (போகி)',
  'Thai Pongal (தைப் பொங்கல்)',
  'Maattu Pongal (மாட்டுப் பொங்கல்)',
  'Kaanum Pongal (காணும் பொங்கல்)',
  'Thaipusam (தைப்பூசம்)',
  'Thai Amavasai (தை அமாவாசை)',
  'Maha Sivaratri (மகா சிவராத்திரி)',
  'Masi Magam (மாசி மகம்)',
  'Panguni Uthiram (பங்குனி உத்திரம்)',
  'Rama Navami (ஸ்ரீ ராம நவமி)',
];

// Observances that come every month (or every fortnight)
const MONTHLY: string[] = [
  'Sankashti Chaturthi (சங்கடஹர சதுர்த்தி)',
  'Pradosham (பிரதோஷம்)',
  'Masa Sivaratri (மாத சிவராத்திரி)',
  'Krithigai (கிருத்திகை)',
  'Ekadasi (ஏகாதசி)',
  'Amavasai (அமாவாசை)',
  'Pournami (பௌர்ணமி)',
];

export interface PanchangamOption {
  value: string; // what is stored as the trigger
  label: string; // what the admin sees
}

const fromName = (full: string): PanchangamOption => ({ value: full.split(' (')[0].trim(), label: full });

export function panchangamOptions(): { monthly: PanchangamOption[]; thithis: PanchangamOption[]; festivals: PanchangamOption[] } {
  const thithis: PanchangamOption[] = [];
  for (const paksha of ['Sukla', 'Krishna']) {
    TITHI_NAMES.forEach((n) => {
      const value = `${paksha} Paksha ${n}`;
      thithis.push({ value, label: `${value} (${paksha === 'Sukla' ? 'waxing' : 'waning'} moon)` });
    });
  }
  thithis.push({ value: 'Sukla Paksha Pournami', label: 'Sukla Paksha Pournami (full moon)' });
  thithis.push({ value: 'Krishna Paksha Amavasai', label: 'Krishna Paksha Amavasai (new moon)' });

  return {
    monthly: MONTHLY.map(fromName),
    thithis,
    festivals: FESTIVALS.map(fromName),
  };
}