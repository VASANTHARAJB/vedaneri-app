import { pool } from './db';
import { tamilDayOf, localPanchang, placeFromEnv } from './panchangamCalendar';
import { getSuggestion, safeMessage } from './panchangamProvider';
import { hasExtraColumns } from './panchangamColumns';

// Keeps panchangam_calendar filled for the coming days without anyone pressing a button.
//
//   * Runs once every IST day (after PANCHANGAM_SYNC_HOUR, default 02:00) and once shortly after the API starts.
//   * Fills only the days that are EMPTY. An entry that already exists (typed by hand, or saved from the CMS) is never changed,
//     and special_event is never written.
//   * Tamil year / month / day come from the sky (panchangamCalendar.ts). The Tamil YEAR NAME is read from the panchangam_years table,
//     so a day is skipped (and reported) when that year has not been added in the CMS yet.
//
// Env (apps/api/.env):
//   PANCHANGAM_SYNC=1                  switch the schedule on (leave it out to switch it off; POST /panchangam/sync still works)
//   PANCHANGAM_SYNC_DAYS=60            how many days ahead to keep filled (1 to 400)
//   PANCHANGAM_SYNC_HOUR=2             IST hour after which the daily run happens
//   PANCHANGAM_SYNC_SOURCE=local       local = thithi/nakshatram calculated from the sky (default, recommended)
//                                      api   = taken from the third-party provider (PANCHANGAM_PROVIDER)
//                                      both  = saved only when the provider and the calculation agree; days where they differ stay
//                                              empty and are listed in the run report so a person can decide

export type SyncSource = 'local' | 'api' | 'both';

export interface SyncSkip { date: string; reason: string }
export interface SyncReport {
  startedAt: string;
  finishedAt: string | null;
  source: SyncSource;
  from: string;
  to: string;
  checked: number;
  alreadyThere: number;
  added: number;
  skipped: SyncSkip[];
  checkClosely: string[];   // added days where a thithi/nakshatram changes soon after sunrise
  enriched: number;         // saved days that only got the extra details (rasi, yogam, karanam, times) added
  extraColumns: boolean;    // false = sql/panchangam-extra-columns.sql has not been run yet, so only the basic fields were saved
  error: string | null;
}

const AUTHOR = 'Auto sync';
let running = false;
let lastRun: SyncReport | null = null;
let lastRunDay = '';

const istDay = (offsetDays = 0): string => new Date(Date.now() + 5.5 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);
const addDays = (iso: string, n: number): string => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

function sourceFromEnv(): SyncSource {
  const v = (process.env.PANCHANGAM_SYNC_SOURCE || 'local').toLowerCase();
  return v === 'api' || v === 'both' ? v : 'local';
}

export function getSyncStatus() {
  return {
    scheduled: process.env.PANCHANGAM_SYNC === '1',
    running,
    source: sourceFromEnv(),
    days: Math.min(400, Math.max(1, Number(process.env.PANCHANGAM_SYNC_DAYS) || 60)),
    lastRun,
  };
}

const isRealDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

// opts.from: first English date to fill (YYYY-MM-DD). Leave it out to start today. Past dates are allowed, so a whole Tamil year can be filled.
export async function runPanchangamSync(opts: { days?: number; from?: string } = {}): Promise<SyncReport> {
  if (running) throw new Error('A panchangam sync is already running');
  running = true;
  const days = Math.min(400, Math.max(1, Math.floor(opts.days || Number(process.env.PANCHANGAM_SYNC_DAYS) || 60)));
  const source = sourceFromEnv();
  const from = isRealDate(opts.from) && opts.from >= '2000-01-01' && opts.from <= '2100-12-31' ? opts.from : istDay(0);
  const to = addDays(from, days - 1);
  const report: SyncReport = {
    startedAt: new Date().toISOString(), finishedAt: null, source, from, to,
    checked: 0, alreadyThere: 0, added: 0, skipped: [], checkClosely: [], enriched: 0, extraColumns: false, error: null,
  };
  try {
    const place = placeFromEnv();
    const extras = await hasExtraColumns();
    report.extraColumns = extras;

    // Tamil years the CMS knows about: first English year of the span -> year name
    const [yearRows]: any = await pool.query('SELECT year_name, english_span FROM panchangam_years');
    const yearName = new Map<number, string>();
    for (const y of yearRows || []) {
      const m = String(y.english_span || '').match(/(\d{4})/);
      if (m && y.year_name) yearName.set(Number(m[1]), String(y.year_name));
    }

    // What is already saved in the window
    const [haveRows]: any = await pool.query(
      `SELECT DATE_FORMAT(calendar_date, '%Y-%m-%d') AS d, tamil_year, tamil_month, tamil_date
         FROM panchangam_calendar WHERE calendar_date BETWEEN ? AND ?`,
      [from, to]
    );
    const haveDate = new Set<string>((haveRows || []).map((r: any) => r.d));
    const [haveDayRows]: any = await pool.query(
      `SELECT tamil_year, tamil_month, tamil_date FROM panchangam_calendar WHERE calendar_date BETWEEN ? AND ?`,
      [addDays(from, -40), addDays(to, 40)]
    );
    const haveTamil = new Set<string>((haveDayRows || []).map((r: any) => `${r.tamil_year}|${r.tamil_month}|${Number(r.tamil_date)}`));

    for (let i = 0; i < days; i++) {
      const date = addDays(from, i);
      report.checked++;
      if (haveDate.has(date)) { report.alreadyThere++; continue; }

      try {
        const td = tamilDayOf(date, place);
        const ty = yearName.get(td.startYear);
        if (!ty) { report.skipped.push({ date, reason: `Tamil year starting ${td.startYear} is not added in the CMS (Add Year)` }); continue; }
        if (haveTamil.has(`${ty}|${td.monthName}|${td.day}`)) {
          report.skipped.push({ date, reason: `${td.monthName} day ${td.day} of ${ty} is already saved under another English date` });
          continue;
        }

        const local = localPanchang(date, place);
        let thithi = local.thithi;
        let nakshatram = local.nakshatram;

        if (source !== 'local') {
          let api;
          try {
            api = await getSuggestion(date);
          } catch (e: any) {
            report.skipped.push({ date, reason: `Provider: ${safeMessage(e)}` });
            continue;
          }
          if (source === 'api') {
            thithi = api.thithi;
            nakshatram = api.nakshatram;
          } else if (api.tithiNumber !== local.tithiNumber || api.nakshatraNumber !== local.nakshatraNumber) {
            report.skipped.push({
              date,
              reason: `Provider and calculation differ: provider ${api.thithi} / ${api.nakshatram}; calculated ${local.thithi} / ${local.nakshatram}`,
            });
            continue;
          }
        }

        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          if (extras) {
            await conn.query(
              `INSERT INTO panchangam_calendar
                 (calendar_date, tamil_year, tamil_month, tamil_date, thithi, nakshatram, special_event, created_by, updated_by,
                  rasi, yogam, karanam, sunrise, sunset, rahu_kalam, yamagandam, gulikai, auto_festivals, details_json)
               VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [date, ty, td.monthName, td.day, thithi, nakshatram, AUTHOR, AUTHOR,
               local.rasi, local.yogam, local.karanam, local.sunrise, local.sunset, local.rahuKalam, local.yamagandam, local.gulikai,
               local.festivals.join(' · '), JSON.stringify(local.spans)]
            );
          } else {
            await conn.query(
              `INSERT INTO panchangam_calendar
                 (calendar_date, tamil_year, tamil_month, tamil_date, thithi, nakshatram, special_event, created_by, updated_by)
               VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
              [date, ty, td.monthName, td.day, thithi, nakshatram, AUTHOR, AUTHOR]
            );
          }
          await conn.query(
            `INSERT INTO panchangam_audit_logs
               (calendar_date, tamil_year, tamil_month, tamil_date, action, changed_by, payload_snapshot)
             VALUES (?, ?, ?, ?, 'INSERT', ?, ?)`,
            [date, ty, td.monthName, td.day, AUTHOR, JSON.stringify({ thithi, nakshatram, special_event: null, source })]
          );
          report.added++;
          haveDate.add(date);
          haveTamil.add(`${ty}|${td.monthName}|${td.day}`);
          if (local.tithiEndsHoursAfterSunrise < 2.5 || local.nakshatraEndsHoursAfterSunrise < 2.5) report.checkClosely.push(date);
          await conn.commit();
        } catch (e: any) {
          try { await conn.rollback(); } catch { /* ignore */ }
          // Another API instance (or a person in the CMS) saved this day a moment ago: leave theirs as it is
          if (e?.code === 'ER_DUP_ENTRY') { report.alreadyThere++; continue; }
          throw e;
        } finally {
          conn.release();
        }
      } catch (e: any) {
        console.error(`Panchangam sync failed for ${date}:`, e?.sqlMessage || e?.message || e);
        report.skipped.push({ date, reason: 'Could not be saved (see the server log)' });
      }
    }

    // Days that were saved earlier (typed by hand, or saved before the extra columns existed) get the extra details added, and the automatic
    // festivals are refreshed. Only the extra columns are written: thithi, nakshatram, the Tamil date and special_event are never touched.
    if (extras) {
      const [needRows]: any = await pool.query(
        `SELECT DATE_FORMAT(calendar_date, '%Y-%m-%d') AS d, rasi, auto_festivals, details_json FROM panchangam_calendar
          WHERE calendar_date BETWEEN ? AND ?`,
        [from, to]
      );
      for (const r of needRows || []) {
        try {
          const l = localPanchang(r.d, place);
          const festivals = l.festivals.join(' · ');
          const details = JSON.stringify(l.spans);
          if (!r.rasi) {
            await pool.query(
              `UPDATE panchangam_calendar
                  SET rasi = ?, yogam = ?, karanam = ?, sunrise = ?, sunset = ?, rahu_kalam = ?, yamagandam = ?, gulikai = ?, auto_festivals = ?, details_json = ?
                WHERE calendar_date = ? AND (rasi IS NULL OR rasi = '')`,
              [l.rasi, l.yogam, l.karanam, l.sunrise, l.sunset, l.rahuKalam, l.yamagandam, l.gulikai, festivals, details, r.d]
            );
            report.enriched++;
          } else if ((r.auto_festivals ?? null) !== festivals || (r.details_json ?? null) !== details) {
            await pool.query(`UPDATE panchangam_calendar SET auto_festivals = ?, details_json = ? WHERE calendar_date = ?`, [festivals, details, r.d]);
            report.enriched++;
          }
        } catch (e: any) {
          console.error(`Panchangam sync: could not add the extra details for ${r.d}:`, e?.sqlMessage || e?.message || e);
          report.skipped.push({ date: r.d, reason: 'Extra details could not be saved (see the server log)' });
        }
      }
    }
  } catch (e: any) {
    console.error('Panchangam sync failed:', e?.sqlMessage || e?.message || e);
    report.error = 'The sync could not run (see the server log)';
  } finally {
    report.finishedAt = new Date().toISOString();
    lastRun = report;
    running = false;
    console.log(
      `Panchangam sync (${report.source}) ${report.from}..${report.to}: ${report.added} added, ${report.alreadyThere} already there, ${report.enriched} completed with extra details, ${report.skipped.length} skipped` +
        (report.checkClosely.length ? `, ${report.checkClosely.length} to check closely` : '')
    );
  }
  return report;
}

// Call once when the API starts. Does nothing unless PANCHANGAM_SYNC=1.
export function startPanchangamSync(): void {
  if (process.env.PANCHANGAM_SYNC !== '1') return;
  const hour = Math.min(23, Math.max(0, Number(process.env.PANCHANGAM_SYNC_HOUR ?? 2) || 0));
  const tick = () => {
    const nowIst = new Date(Date.now() + 5.5 * 3600000);
    const today = nowIst.toISOString().slice(0, 10);
    if (running || lastRunDay === today || nowIst.getUTCHours() < hour) return;
    lastRunDay = today;
    runPanchangamSync().catch((e) => console.error('Panchangam sync:', e?.message || e));
  };
  // one catch-up run shortly after start (so a restart or a new month never waits for the next night), then a check every 15 minutes
  setTimeout(() => {
    lastRunDay = istDay(0);
    runPanchangamSync().catch((e) => console.error('Panchangam sync:', e?.message || e));
  }, 20000).unref();
  setInterval(tick, 15 * 60 * 1000).unref();
  console.log(`Panchangam auto sync is on (source: ${sourceFromEnv()}, every IST day after ${String(hour).padStart(2, '0')}:00)`);
}