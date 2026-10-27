'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import {
  TAMIL_MONTHS,
  COMMON_THITHIS,
  NAKSHATRAMS_LIST,
} from '../lib/panchangam';

export interface ExtendedPanchangamEntry {
  id?: number;
  calendar_date: string;
  tamil_year: string;
  tamil_month: string;
  tamil_date: number;
  thithi: string;
  nakshatram: string;
  special_event?: string | null;
  created_by?: string;
  updated_by?: string;
  updated_at?: string;
}

interface TamilYearOption {
  id: string;
  name: string;
  englishSpan: string;
}

const DEFAULT_TAMIL_YEARS: TamilYearOption[] = [
  { id: 'viswavasu', name: 'Viswavasu (விஸ்வாவசு)', englishSpan: '2025 - 2026' },
  { id: 'parabhava', name: 'Parabhava (பராபவ)', englishSpan: '2026 - 2027' },
  { id: 'plavanga', name: 'Plavanga (ப்ளவங்க)', englishSpan: '2027 - 2028' },
  { id: 'keelaka', name: 'Keelaka (கீலக)', englishSpan: '2028 - 2029' },
];

const TAMIL_MONTH_CONFIG: Record<string, { mmdd: string; length: number; isNextYear?: boolean }> = {
  'Chithirai (சித்திரை)': { mmdd: '04-14', length: 31 },
  'Vaikasi (வைகாசி)': { mmdd: '05-15', length: 31 },
  'Aani (ஆனி)': { mmdd: '06-15', length: 32 },
  'Aadi (ஆடி)': { mmdd: '07-17', length: 31 },
  'Aavani (ஆவணி)': { mmdd: '08-18', length: 31 },
  'Purattasi (புரட்டாசி)': { mmdd: '09-18', length: 31 },
  'Iyppasi (ஐப்பசி)': { mmdd: '10-18', length: 30 },
  'Karthigai (கார்த்திகை)': { mmdd: '11-17', length: 30 },
  'Margazhi (மார்கழி)': { mmdd: '12-16', length: 30 },
  'Thai (தை)': { mmdd: '01-15', length: 30, isNextYear: true },
  'Maasi (மாசி)': { mmdd: '02-13', length: 30, isNextYear: true },
  'Panguni (பங்குனி)': { mmdd: '03-15', length: 30, isNextYear: true },
};

const WEEKDAYS = [
  { en: 'Sunday', ta: 'ஞாயிறு', short: 'ஞா' },
  { en: 'Monday', ta: 'திங்கள்', short: 'தி' },
  { en: 'Tuesday', ta: 'செவ்வாய்', short: 'செ' },
  { en: 'Wednesday', ta: 'புதன்', short: 'பு' },
  { en: 'Thursday', ta: 'வியாழன்', short: 'வி' },
  { en: 'Friday', ta: 'வெள்ளி', short: 'வெ' },
  { en: 'Saturday', ta: 'சனி', short: 'ச' },
];

type ViewMode = 'grid' | 'agenda';

const splitName = (full: string) => {
  const i = full.indexOf(' (');
  if (i === -1) return { en: full, ta: '' };
  return { en: full.slice(0, i), ta: full.slice(i + 2).replace(/\)$/, '') };
};

export default function PanchangamPage() {
  const { user } = useAuth();
  const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api/v1';

  const [tamilYears, setTamilYears] = useState<TamilYearOption[]>(DEFAULT_TAMIL_YEARS);
  const [selectedYear, setSelectedYear] = useState<string>('Parabhava (பராபவ)');
  const [selectedMonth, setSelectedMonth] = useState<string>('Iyppasi (ஐப்பசி)');
  const [monthStartDate, setMonthStartDate] = useState<string>('2026-10-18');

  const [activeFilter, setActiveFilter] = useState<'all' | 'special'>('all');
  const [view, setView] = useState<ViewMode>('grid');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Strictly indexed by tamil_date (number)
  const [calendarEntries, setCalendarEntries] = useState<Record<number, ExtendedPanchangamEntry>>({});

  // Drawer & Edit Lock State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDateLocked, setIsDateLocked] = useState(true);
  const [editingTamilDate, setEditingTamilDate] = useState<number>(1);
  const [formData, setFormData] = useState<ExtendedPanchangamEntry>({
    calendar_date: '',
    tamil_year: selectedYear,
    tamil_month: selectedMonth,
    tamil_date: 1,
    thithi: '',
    nakshatram: '',
    special_event: '',
  });

  // Add Year Modal State
  const [isAddYearModalOpen, setIsAddYearModalOpen] = useState(false);
  const [newYearName, setNewYearName] = useState('');
  const [newEnglishSpan, setNewEnglishSpan] = useState('');

  // 1. Fetch available Tamil Years from Database
  useEffect(() => {
    fetch(`${API_BASE}/panchangam/years`)
      .then((r) => r.json())
      .then((data) => {
        if (data.years && data.years.length > 0) {
          setTamilYears(data.years);
        }
      })
      .catch((e) => console.error('Failed to load years from DB:', e));
  }, [API_BASE]);

  // 2. Synchronize English Start Date whenever Year or Month switches
  useEffect(() => {
    const currentYearObj = tamilYears.find((y) => y.name === selectedYear);
    const span = currentYearObj?.englishSpan || '';
    const match = span.match(/(\d{4})/);
    const startYear = match ? parseInt(match[1], 10) : 2026;

    const monthCfg = TAMIL_MONTH_CONFIG[selectedMonth];
    if (monthCfg) {
      const yearToUse = monthCfg.isNextYear ? startYear + 1 : startYear;
      setMonthStartDate(`${yearToUse}-${monthCfg.mmdd}`);
    }
  }, [selectedYear, selectedMonth, tamilYears]);

  // 3. Fetch Month Data & strictly replace state
  useEffect(() => {
    const fetchMonthFromDb = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/panchangam/month?year=${encodeURIComponent(selectedYear.trim())}&month=${encodeURIComponent(selectedMonth.trim())}`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to fetch month data');
        }
        const json = await res.json();

        // Complete state replacement indexed strictly by numeric tamil_date
        const cleanMap: Record<number, ExtendedPanchangamEntry> = {};
        (json.entries || []).forEach((row: any) => {
          cleanMap[Number(row.tamil_date)] = {
            id: row.id,
            calendar_date: row.calendar_date,
            tamil_year: row.tamil_year,
            tamil_month: row.tamil_month,
            tamil_date: Number(row.tamil_date),
            thithi: row.thithi,
            nakshatram: row.nakshatram,
            special_event: row.special_event || null,
            created_by: row.created_by,
            updated_by: row.updated_by,
            updated_at: row.updated_at,
          };
        });

        setCalendarEntries(cleanMap);
      } catch (err: any) {
        setCalendarEntries({});
        setToast({ message: err.message || 'Error loading month data', type: 'error' });
      }
    };

    fetchMonthFromDb();
  }, [selectedYear, selectedMonth, API_BASE]);

  // Toast Auto-Dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const parseDate = (s: string): Date | null => {
    if (!s) return null;
    const d = new Date(`${s}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  };

  const startDayOfWeek = useMemo(() => {
    const d = parseDate(monthStartDate);
    return d ? d.getUTCDay() : 0;
  }, [monthStartDate]);

  const totalDays = TAMIL_MONTH_CONFIG[selectedMonth]?.length || 30;
  const daysInTamilMonth = useMemo(() => Array.from({ length: totalDays }, (_, i) => i + 1), [totalDays]);

  const getAutoEnglishDate = (tDate: number): string => {
    const base = parseDate(monthStartDate);
    if (!base) return '';
    base.setUTCDate(base.getUTCDate() + (tDate - 1));
    return base.toISOString().split('T')[0];
  };

  const formatShort = (dateStr: string) => {
    const d = parseDate(dateStr);
    if (!d) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  };

  const weekdayOf = (tDate: number) => WEEKDAYS[(startDayOfWeek + tDate - 1) % 7];

  const stats = useMemo(() => {
    let filled = 0;
    let special = 0;
    daysInTamilMonth.forEach((d) => {
      const e = calendarEntries[d];
      if (e?.thithi || e?.nakshatram || e?.special_event) filled++;
      if (e?.special_event) special++;
    });
    return { filled, special, pending: totalDays - filled };
  }, [calendarEntries, daysInTamilMonth, totalDays]);

  const progress = Math.round((stats.filled / totalDays) * 100);

  const visibleDays = daysInTamilMonth.filter((d) =>
    activeFilter === 'special' ? Boolean(calendarEntries[d]?.special_event) : true
  );

  const handleOpenEdit = (tDate: number) => {
    setEditingTamilDate(tDate);
    setIsDateLocked(true); // Lock English date by default to prevent accidental collisions
    const existing = calendarEntries[tDate];
    const autoEngDate = getAutoEnglishDate(tDate);

    if (existing) {
      setFormData({ ...existing, calendar_date: existing.calendar_date || autoEngDate });
    } else {
      setFormData({
        calendar_date: autoEngDate,
        tamil_year: selectedYear,
        tamil_month: selectedMonth,
        tamil_date: tDate,
        thithi: '',
        nakshatram: '',
        special_event: '',
      });
    }
    setIsDrawerOpen(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const finalEngDate = formData.calendar_date || getAutoEnglishDate(editingTamilDate);
    const currentUser = user?.full_name || user?.email || 'Admin User';
    const cleanSpecialEvent = formData.special_event?.trim() || null;

    // 1. API Payload for MariaDB
    const payload = {
      calendar_date: finalEngDate,
      tamil_year: selectedYear,
      tamil_month: selectedMonth,
      tamil_date: editingTamilDate,
      thithi: formData.thithi.trim(),
      nakshatram: formData.nakshatram.trim(),
      special_event: cleanSpecialEvent,
      user_name: currentUser,
    };

    try {
      const res = await fetch(`${API_BASE}/panchangam/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        // Handles 409 Conflict when date is already registered to another Tamil day
        throw new Error(json.message || 'Failed to save date');
      }

      // 2. Strict typed entry for React state
      const savedEntry: ExtendedPanchangamEntry = {
        calendar_date: finalEngDate,
        tamil_year: selectedYear,
        tamil_month: selectedMonth,
        tamil_date: editingTamilDate,
        thithi: formData.thithi.trim(),
        nakshatram: formData.nakshatram.trim(),
        special_event: cleanSpecialEvent,
        updated_by: currentUser,
        updated_at: 'Just now',
      };

      setCalendarEntries((prev) => ({
        ...prev,
        [editingTamilDate]: savedEntry,
      }));

      setIsDrawerOpen(false);
      setToast({ message: `தமிழ் தேதி ${editingTamilDate} சேமிக்கப்பட்டது`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearEntry = async () => {
    const currentUser = user?.full_name || user?.email || 'Admin User';
    try {
      const res = await fetch(`${API_BASE}/panchangam/entry`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tamil_year: selectedYear,
          tamil_month: selectedMonth,
          tamil_date: editingTamilDate,
          user_name: currentUser,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || 'Failed to delete');
      }

      setCalendarEntries((prev) => {
        const next = { ...prev };
        delete next[editingTamilDate];
        return next;
      });
      setIsDrawerOpen(false);
      setToast({ message: `தமிழ் தேதி ${editingTamilDate} நீக்கப்பட்டது`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleAddNewYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearName.trim() || !newEnglishSpan.trim()) return;

    const newYearObj: TamilYearOption = {
      id: newYearName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: newYearName.trim(),
      englishSpan: newEnglishSpan.trim(),
    };

    try {
      const res = await fetch(`${API_BASE}/panchangam/years`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newYearObj),
      });

      if (!res.ok) throw new Error('Failed to save year into database');

      setTamilYears((prev) => [...prev, newYearObj]);
      setSelectedYear(newYearObj.name);
      setNewYearName('');
      setNewEnglishSpan('');
      setIsAddYearModalOpen(false);
      setToast({ message: `வருடம் ${newYearObj.name} சேர்க்கப்பட்டது`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const monthName = splitName(selectedMonth);
  const inputCls =
    'w-full h-11 px-3.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-[#7a1c1c] focus:outline-none';
  const fieldTitle = 'block text-xs font-bold text-slate-700 mb-1.5';
  const barTitle = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1';

  return (
    <div className="w-full space-y-5 p-2 sm:p-4">
      {/* 1. Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="block text-xs font-bold uppercase tracking-widest text-[#b45309]">
            {selectedYear} · {tamilYears.find((y) => y.name === selectedYear)?.englishSpan}
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#7a1c1c] leading-tight mt-1">
            {monthName.ta || monthName.en}
            <span className="ml-3 text-xl font-bold text-slate-400">{monthName.en}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {formatShort(getAutoEnglishDate(1))} → {formatShort(getAutoEnglishDate(totalDays))}
            <span className="mx-2 text-slate-300">•</span>
            {totalDays} நாட்கள்
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            {(['grid', 'agenda'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  view === v ? 'bg-white text-[#7a1c1c] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {v === 'grid' ? 'Grid' : 'Agenda'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setActiveFilter((f) => (f === 'all' ? 'special' : 'all'))}
            className={`h-9 px-4 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              activeFilter === 'special'
                ? 'bg-[#b45309] border-[#b45309] text-white shadow-xs'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {activeFilter === 'special' ? 'அனைத்து நாட்கள்' : '✨ விசேஷங்கள்'}
          </button>
        </div>
      </div>

      {/* 2. Controls Toolbar */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 space-y-4">
        {/* Month Strip */}
        <div>
          <span className={barTitle}>தமிழ் மாதம்</span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TAMIL_MONTHS.map((m) => {
              const active = m === selectedMonth;
              const n = splitName(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMonth(m)}
                  className={`shrink-0 px-4 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-[#7a1c1c] border-[#7a1c1c] text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:border-[#7a1c1c]/50 hover:bg-[#fffaf0]'
                  }`}
                >
                  <span className={`block text-sm font-extrabold leading-tight ${active ? 'text-white' : 'text-slate-800'}`}>
                    {n.ta || n.en}
                  </span>
                  <span className={`block text-[10px] font-semibold ${active ? 'text-amber-200' : 'text-slate-400'}`}>
                    {n.en}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Year Picker */}
          <div className="md:col-span-4">
            <span className={barTitle}>தமிழ் வருடம்</span>
            <div className="flex gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="flex-1 h-10 px-3 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-[#7a1c1c] focus:outline-none"
              >
                {tamilYears.map((y) => (
                  <option key={y.id} value={y.name}>
                    {y.name} ({y.englishSpan})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsAddYearModalOpen(true)}
                className="h-10 px-3 rounded-xl bg-[#fff8eb] hover:bg-[#feecdc] border border-[#fcd34d] text-[#b45309] text-xs font-black cursor-pointer"
              >
                + புதிய வருடம்
              </button>
            </div>
          </div>

          
          {/* Progress Stats */}
          <div className="md:col-span-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">பதிவு நிலை</span>
              <span className="text-xs font-extrabold text-[#7a1c1c]">
                {stats.filled}/{totalDays} · {progress}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-[#7a1c1c] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex gap-4 mt-1.5 text-[11px] font-semibold text-slate-500">
              <span>✓ பூர்த்தி: {stats.filled}</span>
              <span>✨ விசேஷம்: {stats.special}</span>
              <span>○ மீதம்: {stats.pending}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Grid View */}
      {view === 'grid' && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-3 sm:p-4">
          {activeFilter === 'all' && (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
              {WEEKDAYS.map((w, idx) => (
                <div
                  key={w.en}
                  className={`text-center text-[11px] font-bold py-2 rounded-xl ${
                    idx === 0
                      ? 'text-red-700 bg-red-50 border border-red-100'
                      : 'text-[#7a1c1c] bg-[#fffaf0] border border-[#ebd8b8]'
                  }`}
                >
                  <span className="hidden sm:inline">{w.ta}</span>
                  <span className="sm:hidden">{w.short}</span>
                </div>
              ))}
            </div>
          )}

          <div
            className={`grid gap-1.5 sm:gap-2 ${
              activeFilter === 'all' ? 'grid-cols-7' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'
            }`}
          >
            {activeFilter === 'all' &&
              Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`e-${i}`} className="min-h-[84px] sm:min-h-[104px] rounded-xl bg-slate-50/50 hidden sm:block" />
              ))}

            {visibleDays.map((tDate) => {
              const entry = calendarEntries[tDate];
              const isSpecial = Boolean(entry?.special_event);
              const hasData = Boolean(entry?.thithi || entry?.nakshatram || isSpecial);
              const eng = entry?.calendar_date || getAutoEnglishDate(tDate);
              const isSunday = weekdayOf(tDate).en === 'Sunday';

              return (
                <button
                  key={tDate}
                  type="button"
                  onClick={() => handleOpenEdit(tDate)}
                  className={`group min-h-[84px] sm:min-h-[104px] p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col ${
                    isSpecial
                      ? 'bg-[#fffaf0] border-[#d97706] shadow-xs'
                      : hasData
                      ? 'bg-white border-[#ebd8b8] hover:border-[#7a1c1c]'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                        isSpecial
                          ? 'bg-[#d97706] text-white'
                          : isSunday
                          ? 'bg-red-100 text-red-700'
                          : hasData
                          ? 'bg-[#7a1c1c] text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {tDate}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">{formatShort(eng)}</span>
                  </div>

                  <div className="mt-1.5 flex-1 min-w-0">
                    {hasData ? (
                      <>
                        <p className="hidden sm:block text-[10px] font-bold text-slate-800 truncate">
                          {entry?.thithi || '—'}
                        </p>
                        <p className="hidden sm:block text-[9.5px] text-slate-500 truncate">
                          {entry?.nakshatram || '—'}
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] italic text-slate-400 group-hover:text-[#7a1c1c]">+ சேர்க்க</p>
                    )}
                  </div>

                  {isSpecial && (
                    <p className="text-[9.5px] font-extrabold text-[#b45309] truncate">✨ {entry?.special_event}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Agenda View */}
      {view === 'agenda' && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {visibleDays.map((tDate) => {
            const entry = calendarEntries[tDate];
            const isSpecial = Boolean(entry?.special_event);
            const hasData = Boolean(entry?.thithi || entry?.nakshatram || isSpecial);
            const eng = entry?.calendar_date || getAutoEnglishDate(tDate);
            const wd = weekdayOf(tDate);

            return (
              <button
                key={tDate}
                type="button"
                onClick={() => handleOpenEdit(tDate)}
                className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors cursor-pointer ${
                  isSpecial ? 'bg-[#fffaf0] hover:bg-[#fff8eb]' : 'hover:bg-slate-50'
                }`}
              >
                <div
                  className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-base font-black ${
                    isSpecial ? 'bg-[#d97706] text-white' : 'bg-[#7a1c1c] text-white'
                  }`}
                >
                  {tDate}
                </div>
                <div className="w-24 shrink-0">
                  <p className="text-sm font-bold text-slate-800">{formatShort(eng)}</p>
                  <p className={`text-[11px] font-semibold ${wd.en === 'Sunday' ? 'text-red-600' : 'text-slate-500'}`}>
                    {wd.ta}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  {hasData ? (
                    <>
                      <p className="text-sm font-semibold text-slate-800 truncate">{entry?.thithi || '—'}</p>
                      <p className="text-xs text-slate-500 truncate">{entry?.nakshatram || '—'}</p>
                    </>
                  ) : (
                    <p className="text-xs italic text-slate-400">இன்னும் பதிவு செய்யப்படவில்லை</p>
                  )}
                </div>
                {isSpecial && (
                  <span className="hidden sm:inline-block max-w-[200px] truncate px-2.5 py-1 rounded-full bg-[#fef3c7] text-[#b45309] text-[11px] font-extrabold border border-[#fcd34d]">
                    ✨ {entry?.special_event}
                  </span>
                )}
                <span className="text-slate-300 text-lg">›</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 5. Edit Slide Drawer with Conflict Lock */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col">
            <div className="bg-[#7a1c1c] text-white px-6 py-5 flex items-start justify-between">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-amber-200">
                  {selectedYear} • {selectedMonth}
                </span>
                <h3 className="text-xl font-black mt-1">
                  தமிழ் தேதி {editingTamilDate}
                  <span className="ml-2 text-sm font-semibold text-amber-200">
                    {weekdayOf(editingTamilDate).ta}
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="flex-1 flex flex-col overflow-y-auto">
              <div className="flex-1 p-6 space-y-5">
                {/* English Date Box with Lock Guard */}
                <div className="rounded-xl bg-[#fff8eb] border border-[#fcd34d] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">ஆங்கிலத் தேதி (English Date) *</span>
                    <button
                      type="button"
                      onClick={() => setIsDateLocked(!isDateLocked)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                        isDateLocked ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-[#b45309] text-white'
                      }`}
                    >
                      {isDateLocked ? '🔒 Locked (Click to Edit)' : '🔓 Unlocked'}
                    </button>
                  </div>

                  <input
                    type="date"
                    required
                    disabled={isDateLocked}
                    value={formData.calendar_date}
                    onChange={(e) => setFormData({ ...formData, calendar_date: e.target.value })}
                    className={`${inputCls} ${isDateLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                  />

                  {!isDateLocked ? (
                    <p className="text-[10.5px] font-semibold text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                      ⚠️ எச்சரிக்கை: இந்த ஆங்கிலத் தேதியை மாற்றினால் வேறு தமிழ் நாளுடன் மோதல் (Conflict) ஏற்பட வாய்ப்புள்ளது.
                    </p>
                  ) : (
                    <p className="text-[10.5px] text-slate-500">மாதத்தின் 1-ம் தேதிப்படி இது தானாக இணைக்கப்பட்டுள்ளது.</p>
                  )}
                </div>

                <div>
                  <span className={fieldTitle}>திதி (Thithi) *</span>
                  <input
                    type="text"
                    required
                    list="thithi-list"
                    value={formData.thithi}
                    onChange={(e) => setFormData({ ...formData, thithi: e.target.value })}
                    placeholder="எ.கா. Sukla Paksha Sathuradasi / பௌர்ணமி"
                    className={inputCls}
                  />
                  <datalist id="thithi-list">
                    {COMMON_THITHIS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <span className={fieldTitle}>நட்சத்திரம் (Nakshatram) *</span>
                  <input
                    type="text"
                    required
                    list="nak-list"
                    value={formData.nakshatram}
                    onChange={(e) => setFormData({ ...formData, nakshatram: e.target.value })}
                    placeholder="எ.கா. Revati (ரேவதி)"
                    className={inputCls}
                  />
                  <datalist id="nak-list">
                    {NAKSHATRAMS_LIST.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <span className={fieldTitle}>விசேஷ நிகழ்வுகள் / பண்டிகைகள்</span>
                  <input
                    type="text"
                    value={formData.special_event || ''}
                    onChange={(e) => setFormData({ ...formData, special_event: e.target.value })}
                    placeholder="எ.கா. தீபாவளி, பிரதோஷம், அமாவாசை..."
                    className={inputCls}
                  />
                </div>

                {/* Audit Trail Badge */}
                {calendarEntries[editingTamilDate]?.updated_by && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500">
                    <span className="font-bold text-slate-700">கடைசி திருத்தம்:</span>{' '}
                    {calendarEntries[editingTamilDate]?.updated_by} ({calendarEntries[editingTamilDate]?.updated_at || 'Saved'})
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center gap-2">
                {calendarEntries[editingTamilDate] && (
                  <button
                    type="button"
                    onClick={handleClearEntry}
                    className="h-11 px-4 rounded-xl border border-red-300 text-red-700 bg-white hover:bg-red-50 text-sm font-bold cursor-pointer"
                  >
                    Clear entry
                  </button>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="h-11 px-4 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-11 px-6 rounded-xl bg-[#7a1c1c] hover:bg-[#601414] text-white text-sm font-bold shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isSaving ? 'சேமிக்கிறது...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Add Year Modal */}
      {isAddYearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setIsAddYearModalOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-[#7a1c1c] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">புதிய தமிழ் வருடம் (+ Add Year)</h3>
              <button
                type="button"
                onClick={() => setIsAddYearModalOpen(false)}
                className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 font-bold cursor-pointer flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddNewYear} className="p-6 space-y-4">
              <div>
                <span className={fieldTitle}>தமிழ் ஆண்டின் பெயர் (Tamil Year Name) *</span>
                <input
                  type="text"
                  required
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                  placeholder="எ.கா. Saumya (சௌமிய)"
                  className={inputCls}
                />
              </div>
              <div>
                <span className={fieldTitle}>ஆங்கில வருட எல்லை (English Year Span) *</span>
                <input
                  type="text"
                  required
                  value={newEnglishSpan}
                  onChange={(e) => setNewEnglishSpan(e.target.value)}
                  placeholder="எ.கா. 2029 - 2030"
                  className={inputCls}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddYearModalOpen(false)}
                  className="h-10 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-[#7a1c1c] hover:bg-[#601414] text-white text-xs font-extrabold cursor-pointer"
                >
                  + Add Year
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Toast Alerts */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-white text-sm font-semibold shadow-xl transition-all ${
            toast.type === 'error' ? 'bg-red-700 border border-red-500' : 'bg-[#7a1c1c]'
          }`}
        >
          {toast.type === 'error' ? '❌' : '✓'} {toast.message}
        </div>
      )}
    </div>
  );
}   