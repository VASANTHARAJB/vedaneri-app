'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { authHeader } from './DiscoverKit';

export interface SuggestRow {
  tamilDate: number;
  englishDate: string; // YYYY-MM-DD
  existing: { thithi: string; nakshatram: string } | null;
}

export interface SaveItem {
  tamilDate: number;
  calendar_date: string;
  thithi: string;
  nakshatram: string;
}

interface ApiSuggestion {
  thithi: string;
  nakshatram: string;
  provider: string;
  warnings: string[];
}

type ApiResult = { ok: true; suggestion: ApiSuggestion } | { ok: false; error: string };

interface Props {
  apiBase: string;
  monthLabel: string;
  rows: SuggestRow[];
  onClose: () => void;
  onSave: (items: SaveItem[]) => Promise<{ saved: number; failed: { tamilDate: number; message: string }[] }>;
}

const letters = (s: string) => (s || '').toLowerCase().replace(/[^a-z]/g, '');
// Compare tithis without caring about spacing or the word "Paksha". The paksha itself (Sukla / Krishna) is compared only when
// the saved text states one, so an old entry "Pournami" is not flagged against "Sukla Paksha Pournami".
const pakshaOf = (s: string) => (/krishna|krushna|bahula/i.test(s) ? 'k' : /sukla|shukla|sudha/i.test(s) ? 's' : '');
const tithiBase = (s: string) => letters(s).replace(/krishna|krushna|bahula|sukla|shukla|sudha|paksha/g, '');
const sameThithi = (saved: string, api: string) => {
  if (tithiBase(saved) !== tithiBase(api)) return false;
  const a = pakshaOf(saved);
  const b = pakshaOf(api);
  return !a || !b || a === b;
};
// Nakshatram: equal if the English part or the Tamil part (inside the brackets) matches.
const nakParts = (s: string) => {
  const i = (s || '').indexOf('(');
  return { en: letters(i === -1 ? s : s.slice(0, i)), ta: i === -1 ? '' : (s.slice(i + 1).replace(/\).*$/, '').trim()) };
};
const sameNak = (saved: string, api: string) => {
  const a = nakParts(saved);
  const b = nakParts(api);
  return (a.en !== '' && a.en === b.en) || (a.ta !== '' && a.ta === b.ta);
};

type Status = 'new' | 'same' | 'differs' | 'error' | 'loading';

export default function PanchangamSuggestModal({ apiBase, monthLabel, rows, onClose, onSave }: Props) {
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ApiResult>>({});
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<{ saved: number; failed: { tamilDate: number; message: string }[] } | null>(
    null
  );

  const datesKey = useMemo(() => rows.map((r) => r.englishDate).join(','), [rows]);

  // Fetch suggestions once per set of dates.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setFatal(null);
      try {
        const res = await fetch(`${apiBase}/panchangam/suggest-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({ dates: datesKey.split(',') }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) throw new Error('Your login has expired. Please sign in again');
        if (!res.ok) throw new Error(json.message || 'Could not reach the Panchangam API');
        const map: Record<string, ApiResult> = {};
        (json.results || []).forEach((r: any) => {
          map[r.date] = r.ok
            ? { ok: true, suggestion: r.suggestion }
            : { ok: false, error: r.error || 'Lookup failed' };
        });
        if (cancelled) return;
        setResults(map);
        // Pre-select only days that are still empty. Existing entries are never pre-selected.
        setChecked(
          new Set(rows.filter((r) => !r.existing && map[r.englishDate]?.ok).map((r) => r.tamilDate))
        );
      } catch (e: any) {
        if (!cancelled) setFatal(e?.message || 'Lookup failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, datesKey]);

  const statusOf = (r: SuggestRow): Status => {
    if (loading) return 'loading';
    const res = results[r.englishDate];
    if (!res || !res.ok) return 'error';
    if (!r.existing) return 'new';
    const same =
      sameThithi(r.existing.thithi, res.suggestion.thithi) && sameNak(r.existing.nakshatram, res.suggestion.nakshatram);
    return same ? 'same' : 'differs';
  };

  const badge: Record<Status, string> = {
    loading: 'bg-slate-100 text-slate-500',
    new: 'bg-emerald-100 text-emerald-800',
    same: 'bg-slate-100 text-slate-600',
    differs: 'bg-amber-100 text-amber-800',
    error: 'bg-red-100 text-red-700',
  };
  const badgeText: Record<Status, string> = {
    loading: '…',
    new: 'New',
    same: 'Same',
    differs: 'Differs',
    error: 'Error',
  };

  const toggle = (d: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  const selectable = rows.filter((r) => results[r.englishDate]?.ok && statusOf(r) !== 'same');

  const handleSave = async () => {
    const items: SaveItem[] = [];
    rows.forEach((r) => {
      const res = results[r.englishDate];
      if (checked.has(r.tamilDate) && res && res.ok) {
        items.push({
          tamilDate: r.tamilDate,
          calendar_date: r.englishDate,
          thithi: res.suggestion.thithi,
          nakshatram: res.suggestion.nakshatram,
        });
      }
    });
    if (items.length === 0) return;
    setSaving(true);
    try {
      const out = await onSave(items);
      setReport(out);
      setChecked(new Set());
    } finally {
      setSaving(false);
    }
  };

  const providerName = Object.values(results).find((r) => r.ok) as { ok: true; suggestion: ApiSuggestion } | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/50" onClick={saving ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-[#7a1c1c] text-white px-6 py-4 flex items-start justify-between">
          <div>
            <h3 className="font-bold text-base">⚡ Panchangam API suggestions</h3>
            <p className="text-[11px] text-amber-200 mt-0.5">
              {monthLabel}
              {providerName ? ` · source: ${providerName.suggestion.provider}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 font-bold cursor-pointer disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-3 text-[11px] text-slate-600 bg-[#fffaf0] border-b border-[#ebd8b8]">
          These are suggestions from a free third-party calculator. Check them against your printed panchangam before
          saving, especially on Pournami, Amavasai and days where the thithi or nakshatram changes close to sunrise.
          Existing entries are never selected automatically.
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="p-8 text-center text-sm text-slate-500">Fetching {rows.length} days…</p>}
          {fatal && <p className="p-8 text-center text-sm font-semibold text-red-700">❌ {fatal}</p>}

          {!loading && !fatal && (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-2 py-2">தேதி</th>
                  <th className="px-2 py-2">English</th>
                  <th className="px-2 py-2">Current</th>
                  <th className="px-2 py-2">API suggestion</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const res = results[r.englishDate];
                  const st = statusOf(r);
                  const canCheck = Boolean(res && res.ok) && st !== 'same';
                  return (
                    <tr key={r.tamilDate} className={checked.has(r.tamilDate) ? 'bg-[#fffaf0]' : ''}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          disabled={!canCheck || saving}
                          checked={checked.has(r.tamilDate)}
                          onChange={() => toggle(r.tamilDate)}
                          className="h-4 w-4 accent-[#7a1c1c] cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-2 py-2 font-black text-[#7a1c1c]">{r.tamilDate}</td>
                      <td className="px-2 py-2 font-semibold text-slate-700 whitespace-nowrap">{r.englishDate}</td>
                      <td className="px-2 py-2 text-slate-600">
                        {r.existing ? (
                          <>
                            <div>{r.existing.thithi || '—'}</div>
                            <div className="text-slate-400">{r.existing.nakshatram || '—'}</div>
                          </>
                        ) : (
                          <span className="italic text-slate-400">empty</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-slate-800">
                        {res && res.ok ? (
                          <>
                            <div className="font-semibold">{res.suggestion.thithi}</div>
                            <div className="text-slate-500">{res.suggestion.nakshatram}</div>
                            {res.suggestion.warnings
                              .filter((w) => !w.startsWith('Source gives no'))
                              .map((w, i) => (
                                <div key={i} className="text-[10px] text-amber-700">⚠ {w}</div>
                              ))}
                          </>
                        ) : (
                          <span className="text-red-700">{res && !res.ok ? res.error : '—'}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${badge[st]}`}>
                          {badgeText[st]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {report && (
          <div
            className={`px-6 py-3 text-xs font-semibold border-t ${
              report.failed.length ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            Saved {report.saved} day(s)
            {report.failed.length > 0 && (
              <>
                {' '}
                · {report.failed.length} failed:{' '}
                {report.failed.map((f) => `#${f.tamilDate} (${f.message})`).join('; ')}
              </>
            )}
          </div>
        )}

        <div className="border-t border-slate-200 p-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => setChecked(new Set(selectable.map((r) => r.tamilDate)))}
            className="h-9 px-3 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            Select all changes
          </button>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => setChecked(new Set())}
            className="h-9 px-3 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            Clear
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 px-4 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm font-bold cursor-pointer disabled:opacity-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || checked.size === 0}
            className="h-10 px-5 rounded-xl bg-[#7a1c1c] hover:bg-[#601414] text-white text-sm font-bold shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'சேமிக்கிறது...' : `Save ${checked.size} selected`}
          </button>
        </div>
      </div>
    </div>
  );
}