import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { authHeader } from './DiscoverKit';

// Tamil Panchangam calendar: one English month as a grid. Each day shows the Tamil date, thithi, nakshatram,
// festivals, sunrise and sunset. Values come from the database (panchangam_calendar); a day that is not saved yet
// shows the sky calculation for the same day, and one button saves the empty days into the database.

const API_BASE: string = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api/v1';

interface Span {
  name: string;
  from: string;
  to: string;
}
interface DaySpans {
  thithi: Span[];
  nakshatram: Span[];
  yogam: Span[];
  karanam: Span[];
}
interface SavedDay {
  tamilYear: string;
  tamilMonth: string;
  tamilDate: number;
  thithi: string;
  nakshatram: string;
  specialEvent: string | null;
  rasi?: string | null;
  yogam?: string | null;
  karanam?: string | null;
  sunrise?: string | null;
  sunset?: string | null;
  rahuKalam?: string | null;
  yamagandam?: string | null;
  gulikai?: string | null;
  autoFestivals?: string[];
  details?: DaySpans | null;
}
interface CalcDay {
  tamilStartYear: number;
  tamilMonth: string;
  tamilDate: number;
  thithi: string;
  nakshatram: string;
  sunrise: string;
  sunset: string;
  tithiEndsAt: string;
  nakshatraEndsAt: string;
  rasi: string;
  yogam: string;
  karanam: string;
  rahuKalam: string;
  yamagandam: string;
  gulikai: string;
  festivals?: string[];
  spans?: DaySpans;
}
interface DayRow {
  date: string;
  weekday: number;
  saved: SavedDay | null;
  calc: CalcDay | null;
  differs: { thithi: boolean; nakshatram: boolean };
}
interface MonthView {
  year: number;
  month: number;
  place: { lat: number; lng: number };
  savedCount: number;
  totalDays: number;
  extraColumns?: boolean;
  days: DayRow[];
}
interface SyncReport {
  added: number;
  alreadyThere: number;
  enriched?: number;
  extraColumns?: boolean;
  skipped: { date: string; reason: string }[];
  error: string | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK_TA = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// A whole Tamil year in one go: Chithirai 1 to the day before the next Chithirai 1 (365 days).
// The year must exist in the Panchangam Manager (Add Year), because the database stores the year name.
const TAMIL_YEARS = [
  { label: '2025 – 2026 (Viswavasu)', from: '2025-04-14', to: '2026-04-13' },
  { label: '2026 – 2027 (Parabhava)', from: '2026-04-14', to: '2027-04-13' },
];

const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

// "Iyppasi (ஐப்பசி)" -> { en: 'Iyppasi', ta: 'ஐப்பசி' }
const splitName = (label: string) => {
  const i = label.indexOf('(');
  if (i === -1) return { en: label.trim(), ta: '' };
  return { en: label.slice(0, i).trim(), ta: label.slice(i + 1).replace(/\).*$/, '').trim() };
};
// "Sukla Paksha Prathamai" -> { paksha: 'S', base: 'Prathamai' }
const splitThithi = (label: string) => {
  const m = label.match(/^(sukla|shukla|krishna|krushna)\s+paksha\s+(.+)$/i);
  if (!m) return { paksha: '', base: label };
  return { paksha: /^k/i.test(m[1]) ? 'K' : 'S', base: m[2] };
};
// IST "YYYY-MM-DDTHH:mm" compared with the calendar day it belongs to
const clock = (endsAt: string, date: string) => {
  const day = endsAt.slice(0, 10);
  const hm = endsAt.slice(11, 16);
  if (day === date) return hm;
  return day > date ? `${hm} +1` : `${hm} −1`;
};

// Festivals worked out by rule: the saved ones when the day is saved, otherwise the calculation. Tamil name first (it is in brackets).
const autoFestivalsOf = (d: DayRow): string[] => (d.saved?.autoFestivals && d.saved.autoFestivals.length ? d.saved.autoFestivals : d.calc?.festivals || []);
const festivalLabel = (f: string) => {
  const n = splitName(f);
  return n.ta || n.en;
};

// Every thithi / nakshatram / yogam / karanam running that day (they can start the day before and end the day after). Saved details first.
const spansFor = (d: DayRow): DaySpans | null => d.saved?.details || d.calc?.spans || null;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const stamp = (dt: string) => `${Number(dt.slice(8, 10))} ${MON[Number(dt.slice(5, 7)) - 1]} ${dt.slice(11, 16)}`;
const thithiBase = (name: string) => splitThithi(name).base;

const tamilDiffers = (d: DayRow) =>
  Boolean(d.saved && d.calc && (d.saved.tamilMonth !== d.calc.tamilMonth || d.saved.tamilDate !== d.calc.tamilDate));

export default function PanchangamCalendar() {
  const today = istToday();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [view, setView] = useState<MonthView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(today);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [fillPick, setFillPick] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/panchangam/month-view?year=${year}&month=${month}`, { headers: { ...authHeader() } });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) throw new Error('Your login has expired. Please sign in again');
      if (!res.ok) throw new Error(json.message || 'Could not load the calendar');
      setView(json as MonthView);
    } catch (e: any) {
      setView(null);
      setError(e?.message || 'Could not load the calendar');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  // keep the selected day inside the month being shown
  useEffect(() => {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    if (!selected.startsWith(prefix)) setSelected(today.startsWith(prefix) ? today : `${prefix}01`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const go = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  };
  const goToday = () => {
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)));
    setSelected(today);
  };

  const days = view?.days || [];
  const lead = days.length ? days[0].weekday : 0;
  const cells: (DayRow | null)[] = useMemo(() => {
    const out: (DayRow | null)[] = Array(lead).fill(null).concat(days);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [days, lead]);

  const first = days[0];
  const lastDay = days[days.length - 1];
  const tamilSpan = useMemo(() => {
    const f = first && (first.saved || first.calc);
    const l = lastDay && (lastDay.saved || lastDay.calc);
    if (!f || !l) return '';
    const fm = splitName(f.tamilMonth);
    const lm = splitName(l.tamilMonth);
    return `${fm.ta || fm.en} ${f.tamilDate} – ${lm.ta || lm.en} ${l.tamilDate}`;
  }, [first, lastDay]);

  const unsaved = days.filter((d) => !d.saved).length;
  const sel = days.find((d) => d.date === selected) || null;

  const runSave = async (from: string, count: number, what: string) => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/panchangam/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ from, days: count }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) throw new Error('Your login has expired. Please sign in again');
      if (!res.ok) throw new Error(json.message || 'Could not save to the database');
      const r: SyncReport = json.report;
      if (r.error) throw new Error(r.error);
      const extraNote = r.extraColumns === false ? '\nNote: rasi, yogam, karanam and the times were not saved because the database columns have not been added yet (run panchangam-extra-columns.sql).' : '';
      const enrichNote = r.enriched ? ` ${r.enriched} saved days were completed with rasi, yogam, karanam and times.` : '';
      if (r.skipped.length > 0) {
        const reasons = Array.from(new Set(r.skipped.map((s) => s.reason.replace(/\d{4}-\d{2}-\d{2}/g, '').trim()))).slice(0, 3);
        setNotice({
          kind: r.added > 0 ? 'warn' : 'err',
          text: `${r.added} saved, ${r.alreadyThere} were already there, ${r.skipped.length} not saved.\n${reasons.join('\n')}\nFirst skipped day: ${r.skipped[0].date}${extraNote}`,
        });
      } else {
        setNotice({
          kind: r.extraColumns === false ? 'warn' : 'ok',
          text:
            (r.added > 0 ? `Saved ${r.added} ${what} to the database (${r.alreadyThere} were already there).` : 'Nothing new to save: those days are already in the database.') +
            enrichNote +
            extraNote,
        });
      }
      await load();
    } catch (e: any) {
      setNotice({ kind: 'err', text: e?.message || 'Could not save to the database' });
    } finally {
      setSaving(false);
    }
  };

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

  const confirmYear = TAMIL_YEARS.find((y) => y.from === fillPick) || null;

  return (
    <div className="pcal">
      <style>{CSS}</style>

      <div className="pcal-head">
        <div>
          <h1>தமிழ் பஞ்சாங்கக் காலண்டர்</h1>
          <p>Tamil Panchangam calendar · {view ? `${view.place.lat.toFixed(4)}°N, ${view.place.lng.toFixed(4)}°E` : '…'}</p>
        </div>
        <div className="pcal-nav">
          <button type="button" onClick={() => go(-1)} aria-label="Previous month">‹</button>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Month">
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
            {Array.from({ length: 16 }, (_, i) => 2020 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button type="button" onClick={() => go(1)} aria-label="Next month">›</button>
          <button type="button" className="today" onClick={goToday}>Today</button>
        </div>
      </div>

      <div className="pcal-bar">
        <div>
          <strong>{MONTHS[month - 1]} {year}</strong>
          {tamilSpan && <span className="ta"> · {tamilSpan}</span>}
          {view && (
            <span className="muted"> · saved in database: <b>{view.savedCount}</b> of {view.totalDays} days</span>
          )}
        </div>
        <div className="pcal-actions">
          <button type="button" className="ghost" onClick={load} disabled={loading || saving}>Refresh</button>
          <button
            type="button"
            className="primary"
            disabled={loading || saving || unsaved === 0}
            onClick={() => runSave(monthStart, days.length, 'day(s)')}
            title="Saves only the days that are empty. Days already saved are never changed."
          >
            {saving ? 'Saving…' : unsaved === 0 ? 'All days saved' : `Save ${unsaved} empty day${unsaved === 1 ? '' : 's'} to database`}
          </button>
        </div>
      </div>

      <div className="pcal-year">
        <span className="muted">Fill a whole Tamil year into the database:</span>
        {TAMIL_YEARS.map((y) => (
          <button key={y.from} type="button" className="ghost" disabled={loading || saving} onClick={() => setFillPick(y.from)}>
            {y.label}
          </button>
        ))}
        {confirmYear && (
          <span className="pcal-confirm">
            Save every EMPTY day from {confirmYear.from} to {confirmYear.to}? Saved days and festivals are never changed.
            <button
              type="button"
              className="primary"
              disabled={saving}
              onClick={async () => {
                setFillPick(null);
                await runSave(confirmYear.from, 365, 'day(s)');
              }}
            >
              Yes, save the year
            </button>
            <button type="button" className="ghost" onClick={() => setFillPick(null)}>Cancel</button>
          </span>
        )}
      </div>

      {saving && <div className="pcal-note warn">Saving… a whole year can take up to a minute. Please keep this page open.</div>}
      {notice && <div className={`pcal-note ${notice.kind}`}>{notice.text}</div>}
      {error && <div className="pcal-note err">{error}</div>}

      <div className="pcal-body">
        <div className="pcal-gridwrap">
          <div className="pcal-week">
            {WEEK_TA.map((t, i) => (
              <div key={t} className={i === 0 ? 'sun' : ''}>
                <b>{t}</b>
                <small>{WEEK_EN[i]}</small>
              </div>
            ))}
          </div>

          <div className={`pcal-grid${loading ? ' busy' : ''}`}>
            {cells.map((d, idx) => {
              if (!d) return <div key={`b${idx}`} className="cell blank" />;
              const info = d.saved || d.calc;
              const th = splitThithi(d.saved?.thithi || d.calc?.thithi || '');
              const nk = splitName(d.saved?.nakshatram || d.calc?.nakshatram || '');
              const tm = info ? splitName(info.tamilMonth) : { en: '', ta: '' };
              const dateNum = Number(d.date.slice(8, 10));
              const isToday = d.date === today;
              const diff = d.differs.thithi || d.differs.nakshatram || tamilDiffers(d);
              const diffText = [
                d.differs.thithi && `Saved thithi "${d.saved?.thithi}" is not the sunrise thithi "${d.calc?.thithi}"`,
                d.differs.nakshatram && `Saved nakshatram "${d.saved?.nakshatram}" is not the sunrise nakshatram "${d.calc?.nakshatram}"`,
                tamilDiffers(d) && `Saved Tamil date (${d.saved?.tamilMonth} ${d.saved?.tamilDate}) differs from the calculated one (${d.calc?.tamilMonth} ${d.calc?.tamilDate})`,
              ].filter(Boolean).join('\n');
              const sp = spansFor(d);
              const moon = /amavasai/i.test(th.base) ? 'new' : /pournami/i.test(th.base) ? 'full' : '';
              const ekadasi = /ekadasi/i.test(th.base);
              const cls = ['cell', d.saved ? 'saved' : 'calc', d.weekday === 0 ? 'sun' : '', isToday ? 'today' : '', d.date === selected ? 'sel' : ''].join(' ');
              return (
                <button type="button" key={d.date} className={cls} onClick={() => setSelected(d.date)} aria-label={`${d.date}`}>
                  <span className="top">
                    <span className="num">{dateNum}</span>
                    <span className="tamilnum" title="Tamil date">
                      {info && info.tamilDate === 1 && <em>{tm.ta || tm.en}</em>}
                      {info ? info.tamilDate : ''}
                    </span>
                  </span>
                  <span className="thithi">
                    {th.paksha && <i className={`pk ${th.paksha}`}>{th.paksha}</i>}
                    {sp && sp.thithi.length > 1 ? (
                      <span className="segs">
                        {sp.thithi.map((t) => (
                          <span key={t.from} className="seg">
                            {thithiBase(t.name)} <small>{clock(t.to, d.date)}</small>
                          </span>
                        ))}
                      </span>
                    ) : (
                      th.base
                    )}
                    {moon === 'new' && <span className="moon new" title="Amavasai" />}
                    {moon === 'full' && <span className="moon full" title="Pournami" />}
                    {ekadasi && <span className="tag">Ekadasi</span>}
                  </span>
                  <span className="nak">
                    {sp && sp.nakshatram.length > 0 && !d.differs.nakshatram ? (
                      sp.nakshatram.map((n) => (
                        <span key={n.from} className="seg">
                          {splitName(n.name).ta || splitName(n.name).en} <small>{clock(n.to, d.date)}</small>
                        </span>
                      ))
                    ) : (
                      <>
                        {nk.ta || nk.en}
                        {d.calc && !d.differs.nakshatram && <small> {clock(d.calc.nakshatraEndsAt, d.date)}</small>}
                      </>
                    )}
                  </span>
                  {d.saved?.specialEvent && <span className="event">{d.saved.specialEvent}</span>}
                  {autoFestivalsOf(d).length > 0 && (
                    <span className="auto" title={autoFestivalsOf(d).map((f) => splitName(f).en).join(' · ')}>
                      {autoFestivalsOf(d).slice(0, 2).map(festivalLabel).join(' · ')}
                      {autoFestivalsOf(d).length > 2 ? ` +${autoFestivalsOf(d).length - 2}` : ''}
                    </span>
                  )}
                  <span className="foot">
                    {d.calc ? <span>↑{d.calc.sunrise} ↓{d.calc.sunset}</span> : <span />}
                    {diff && <span className="warn" title={diffText}>≠</span>}
                    {!d.saved && <span className="unsaved" title="Not saved in the database yet">·</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="pcal-legend">
            <span className="lg saved" /> saved in database &nbsp; <span className="lg calc" /> calculated, not saved yet &nbsp;
            <span className="warn">≠</span> saved value differs from the sunrise calculation (hover) &nbsp;
            Small times = when each thithi / nakshatram ends (IST, +1 = next day).
          </p>
        </div>

        <aside className="pcal-detail">
          {!sel && <p className="muted">Select a day.</p>}
          {sel && (
            <DayPanel
              day={sel}
              saving={saving}
              onSave={() => runSave(sel.date, 1, 'day')}
            />
          )}
        </aside>
      </div>

      <p className="pcal-foot">
        Each day lists every thithi and nakshatram that runs during it, with its end time (a thithi can start on one day and end on the next). All are calculated from the Sun and Moon positions with the Lahiri ayanamsa. The main thithi of the day is the one at sunrise. Printed panchangams
        can differ by a minute or two, or on days when a thithi or nakshatram changes soon after sunrise. Compare Pournami, Amavasai and Ekadasi days with your printed copy.
        Festival names are added in the Panchangam Manager.
      </p>
    </div>
  );
}

function DayPanel({ day, saving, onSave }: { day: DayRow; saving: boolean; onSave: () => void }) {
  const info = day.saved || day.calc;
  const [y, m, d] = day.date.split('-').map(Number);
  const tm = info ? splitName(info.tamilMonth) : { en: '', ta: '' };
  const calcTh = day.calc ? splitThithi(day.calc.thithi) : null;
  const autoFestivals = autoFestivalsOf(day);
  const sp = spansFor(day);
  const list = (items: Span[] | undefined, label: (n: string) => string) =>
    items && items.length > 0 ? (
      <div className="dp-spans">
        {items.map((x) => (
          <div key={x.from}>
            <b>{label(x.name)}</b>
            <span>{stamp(x.from)} → {stamp(x.to)}</span>
          </div>
        ))}
      </div>
    ) : null;
  // Saved values first (they are what the website shows); the sky calculation fills whatever is not saved yet.
  const pick = (a?: string | null, b?: string | null) => a || b || '';
  const extra = {
    rasi: pick(day.saved?.rasi, day.calc?.rasi),
    yogam: pick(day.saved?.yogam, day.calc?.yogam),
    karanam: pick(day.saved?.karanam, day.calc?.karanam),
    rahuKalam: pick(day.saved?.rahuKalam, day.calc?.rahuKalam),
    yamagandam: pick(day.saved?.yamagandam, day.calc?.yamagandam),
    gulikai: pick(day.saved?.gulikai, day.calc?.gulikai),
  };
  return (
    <div>
      <div className="dp-date">
        <span className="big">{d}</span>
        <span>
          {WEEK_FULL[day.weekday]}
          <br />
          {MONTHS[m - 1]} {y}
        </span>
      </div>

      {info && (
        <div className="dp-row">
          <label>Tamil date</label>
          <div>
            <b className="ta">{tm.ta || tm.en} {info.tamilDate}</b>
            <div className="muted">{tm.en}{day.saved?.tamilYear ? ` · ${day.saved.tamilYear}` : ''}</div>
          </div>
        </div>
      )}

      <div className="dp-row">
        <label>Thithi</label>
        <div>
          <b>{day.saved?.thithi || day.calc?.thithi || '—'}</b>
          {list(sp?.thithi, (n) => n) || (day.calc && <div className="muted">ends {clock(day.calc.tithiEndsAt, day.date)} (sunrise calculation: {calcTh?.base})</div>)}
          {day.differs.thithi && <div className="dp-warn">Saved: {day.saved?.thithi}. At sunrise it is {day.calc?.thithi}.</div>}
        </div>
      </div>

      <div className="dp-row">
        <label>Nakshatram</label>
        <div>
          <b>{day.saved?.nakshatram || day.calc?.nakshatram || '—'}</b>
          {list(sp?.nakshatram, (n) => n) || (day.calc && <div className="muted">ends {clock(day.calc.nakshatraEndsAt, day.date)}</div>)}
          {day.differs.nakshatram && <div className="dp-warn">Saved: {day.saved?.nakshatram}. At sunrise it is {day.calc?.nakshatram}.</div>}
        </div>
      </div>

      {day.calc && (
        <div className="dp-row">
          <label>Sun</label>
          <div>
            <b>↑ {day.calc.sunrise} &nbsp; ↓ {day.calc.sunset}</b>
          </div>
        </div>
      )}

      {(extra.rasi || extra.yogam || extra.karanam) && (
        <>
          <div className="dp-row">
            <label>Rasi (Moon)</label>
            <div><b>{extra.rasi || '—'}</b></div>
          </div>
          <div className="dp-row">
            <label>Yogam</label>
            <div>
              <b>{extra.yogam || '—'}</b>
              {list(sp?.yogam, (n) => splitName(n).en)}
            </div>
          </div>
          <div className="dp-row">
            <label>Karanam</label>
            <div>
              <b>{extra.karanam || '—'}</b>
              {list(sp?.karanam, (n) => splitName(n).en)}
            </div>
          </div>
        </>
      )}

      {(extra.rahuKalam || extra.yamagandam || extra.gulikai) && (
        <div className="dp-row">
          <label>Kalam</label>
          <div className="dp-kalam">
            <div><span>Rahu Kalam</span><b>{extra.rahuKalam || '—'}</b></div>
            <div><span>Yamagandam</span><b>{extra.yamagandam || '—'}</b></div>
            <div><span>Gulikai</span><b>{extra.gulikai || '—'}</b></div>
          </div>
        </div>
      )}

      <div className="dp-row">
        <label>Festival / event</label>
        <div>
          {day.saved?.specialEvent ? <b>{day.saved.specialEvent}</b> : <span className="muted">None typed in the Panchangam Manager</span>}
        </div>
      </div>

      {autoFestivals.length > 0 && (
        <div className="dp-row">
          <label>Automatic</label>
          <div className="dp-auto">
            {autoFestivals.map((f) => (
              <span key={f}>{f}</span>
            ))}
            <div className="muted">Worked out from the thithi, nakshatram and Tamil date. Check against your printed panchangam.</div>
          </div>
        </div>
      )}

      {tamilDiffers(day) && (
        <div className="dp-warn">
          Saved as {day.saved?.tamilMonth} {day.saved?.tamilDate}; the calculation gives {day.calc?.tamilMonth} {day.calc?.tamilDate}. Fix this in the Panchangam Manager.
        </div>
      )}

      <div className="dp-save">
        {day.saved ? (
          <span className="ok">✓ Saved in the database</span>
        ) : (
          <button type="button" className="primary" disabled={saving || !day.calc} onClick={onSave}>
            {saving ? 'Saving…' : 'Save this day to database'}
          </button>
        )}
      </div>
    </div>
  );
}

const CSS = `
.pcal{--mar:#7a1c1c;--mar2:#601414;--gold:#c9962b;--cream:#fffaf0;--line:#ebd8b8;--ink:#3b2a1f;--mut:#8a7560;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--ink);max-width:1280px;margin:0 auto;padding:16px}
.pcal *{box-sizing:border-box}
.pcal-head{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;background:var(--mar);color:#fff;border-radius:16px 16px 0 0;padding:16px 20px}
.pcal-head h1{margin:0;font-size:20px;font-weight:800}
.pcal-head p{margin:2px 0 0;font-size:12px;color:#f3d9a4}
.pcal-nav{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.pcal-nav button,.pcal-nav select{height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:#fff;font-weight:700;padding:0 12px;cursor:pointer;font-size:14px}
.pcal-nav select option{color:#000}
.pcal-nav button:hover{background:rgba(255,255,255,.25)}
.pcal-nav .today{background:#fff;color:var(--mar)}
.pcal-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;background:var(--cream);border:1px solid var(--line);border-top:0;padding:10px 20px;font-size:13px}
.pcal-bar .ta{font-weight:700;color:var(--mar)}
.muted{color:var(--mut)}
.pcal-actions{display:flex;gap:8px}
.pcal button.primary{height:36px;padding:0 16px;border-radius:10px;border:0;background:var(--mar);color:#fff;font-weight:700;cursor:pointer;font-size:13px}
.pcal button.primary:hover:not(:disabled){background:var(--mar2)}
.pcal button.primary:disabled{opacity:.55;cursor:not-allowed}
.pcal button.ghost{height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:#fff;color:var(--ink);font-weight:700;cursor:pointer;font-size:13px}
.pcal-year{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;padding:8px 14px;border:1px dashed var(--line);border-radius:10px;font-size:13px;background:#fff}
.pcal-year .ghost,.pcal-year .primary{height:32px;padding:0 12px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer}
.pcal-confirm{display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%;background:#fff4dc;border:1px solid #f1d9a0;border-radius:8px;padding:8px 10px;color:#8a5a00;font-weight:600}
.pcal-note{margin-top:8px;padding:9px 14px;border-radius:10px;font-size:13px;font-weight:600;white-space:pre-line}
.pcal-note.ok{background:#e9f7ee;color:#18633a;border:1px solid #bfe5cc}
.pcal-note.warn{background:#fff4dc;color:#8a5a00;border:1px solid #f1d9a0}
.pcal-note.err{background:#fdeaea;color:#9b1c1c;border:1px solid #f3c2c2}
.pcal-body{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;margin-top:12px;align-items:start}
.pcal-week{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px}
.pcal-week div{text-align:center;background:var(--mar);color:#fff;border-radius:8px;padding:6px 2px;display:flex;flex-direction:column;line-height:1.2}
.pcal-week div.sun{background:#a63a1a}
.pcal-week b{font-size:13px}.pcal-week small{font-size:10px;opacity:.8}
.pcal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.pcal-grid.busy{opacity:.55;pointer-events:none}
.cell{position:relative;display:flex;flex-direction:column;gap:3px;min-height:122px;text-align:left;border:1px solid var(--line);border-radius:10px;padding:6px 7px;background:#fff;cursor:pointer;font:inherit;color:inherit}
.cell.blank{background:transparent;border-color:transparent;cursor:default;min-height:0}
.cell.calc{background:#fdf6e6;border-style:dashed}
.cell.saved{border-left:3px solid var(--mar)}
.cell.sun .num{color:#b3341a}
.cell:hover:not(.blank){box-shadow:0 2px 8px rgba(122,28,28,.18)}
.cell.today{outline:2px solid var(--gold);outline-offset:-1px}
.cell.sel{background:#f6e7e7;border-color:var(--mar)}
.cell .top{display:flex;justify-content:space-between;align-items:flex-start}
.cell .num{font-size:22px;font-weight:800;line-height:1}
.cell .tamilnum{font-size:12px;font-weight:700;color:var(--mar);background:#f7ead0;border-radius:999px;min-width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;padding:0 6px;gap:4px}
.cell .tamilnum em{font-style:normal;font-size:11px;color:#fff;background:var(--mar);border-radius:999px;padding:1px 6px;margin-left:-2px}
.cell .thithi{font-size:12px;font-weight:700;display:flex;align-items:center;gap:4px;flex-wrap:wrap;line-height:1.25}
.cell .pk{font-style:normal;font-size:10px;font-weight:800;border-radius:4px;padding:0 4px;color:#fff}
.cell .pk.S{background:#c9962b}.cell .pk.K{background:#4d4540}
.cell .moon{display:inline-block;width:11px;height:11px;border-radius:50%;border:1.5px solid #4d4540}
.cell .moon.new{background:#2b2420}.cell .moon.full{background:#fff7d6;border-color:#c9962b}
.cell .tag{font-size:9px;font-weight:800;color:#18633a;background:#e3f3e8;border-radius:4px;padding:1px 4px}
.cell .nak{font-size:12px;color:#5a4637;line-height:1.25}
.cell .nak small{color:var(--mut);font-size:10px}
.cell .segs{display:flex;flex-direction:column;gap:1px;flex:1 1 0;min-width:0}
.cell .seg{display:block}
.cell .seg small{color:var(--mut);font-size:10px;font-weight:600}
.cell .event{font-size:11px;font-weight:700;color:var(--mar);background:#fbecec;border-radius:6px;padding:2px 5px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cell .foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--mut)}
.cell .warn{color:#b45309;font-weight:800;font-size:13px}
.cell .unsaved{color:#c9962b;font-size:18px;line-height:0}
.pcal-legend{font-size:11px;color:var(--mut);margin:8px 2px}
.pcal-legend .lg{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-right:2px}
.pcal-legend .lg.saved{background:#fff;border:1px solid var(--line);border-left:3px solid var(--mar)}
.pcal-legend .lg.calc{background:#fdf6e6;border:1px dashed var(--line)}
.pcal-legend .warn{color:#b45309;font-weight:800}
.pcal-detail{background:var(--cream);border:1px solid var(--line);border-radius:14px;padding:16px;position:sticky;top:12px}
.dp-date{display:flex;gap:12px;align-items:center;margin-bottom:12px;color:var(--mar);font-weight:700;line-height:1.3}
.dp-date .big{font-size:44px;font-weight:800;line-height:1}
.dp-row{display:grid;grid-template-columns:96px 1fr;gap:8px;padding:8px 0;border-top:1px solid var(--line);font-size:13px}
.dp-row label{color:var(--mut);font-weight:600}
.dp-row .ta{color:var(--mar);font-size:15px}
.dp-warn{margin-top:4px;background:#fff4dc;border:1px solid #f1d9a0;color:#8a5a00;border-radius:8px;padding:6px 8px;font-size:12px}
.cell .auto{font-size:10.5px;font-weight:700;color:#8a5a00;background:#fff2cf;border-radius:6px;padding:2px 5px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dp-auto{display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.dp-auto span{font-weight:700;color:#8a5a00;background:#fff2cf;border-radius:6px;padding:2px 7px}
.dp-spans{margin-top:4px;display:grid;gap:3px;font-size:12px}
.dp-spans div{display:flex;flex-direction:column;background:#fff;border:1px solid var(--line);border-radius:7px;padding:3px 7px}
.dp-spans span{color:var(--mut)}
.dp-kalam{display:grid;gap:3px}
.dp-kalam div{display:flex;justify-content:space-between;gap:8px}
.dp-kalam span{color:var(--mut)}
.dp-kalam b{white-space:nowrap;font-size:12.5px}
.dp-save{margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
.dp-save .ok{color:#18633a;font-weight:700;font-size:13px}
.dp-save .primary{width:100%}
.pcal-foot{font-size:11px;color:var(--mut);margin:12px 2px 0;line-height:1.5}
@media (max-width:1000px){.pcal-body{grid-template-columns:1fr}.pcal-detail{position:static}}
@media (max-width:720px){
  .pcal{padding:10px}
  .cell{min-height:64px;padding:4px}
  .cell .num{font-size:16px}
  .cell .thithi,.cell .nak,.cell .event,.cell .auto,.cell .foot span:first-child{display:none}
  .cell .tamilnum{min-width:20px;height:20px;font-size:10px}
  .cell .tamilnum em{display:none}
  .pcal-week small{display:none}
  .pcal-week b{font-size:10px}
}
`;