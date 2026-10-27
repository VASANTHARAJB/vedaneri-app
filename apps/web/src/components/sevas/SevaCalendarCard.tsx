'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { rupees } from '@/lib/format';
import { LiveOffering } from '@/app/[locale]/sevas/[slug]/page';

interface SevaCalendarCardProps {
  seva: LiveOffering;
  locale: string;
}

interface UpcomingPanchangamDate {
  calendar_date: string;
  tamil_year?: string;
  tamil_month?: string;
  tamil_date?: number;
  thithi?: string;
  nakshatram?: string;
  special_event?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_TA = [
  'ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்',
  'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'
];

const WEEK_DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_DAYS_TA = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];

const TOKEN_KEYS = ['devotee_token', 'token', 'auth_token', 'accessToken'];
const SESSION_KEYS = [
  'devotee_token', 'devotee_phone', 'devotee_user', 'devotee_family',
  'token', 'auth_token', 'accessToken', 'user', 'phone',
];

// ---------- helpers ----------
const pad2 = (n: number) => String(n).padStart(2, '0');

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function cleanDate(v?: string | null): string {
  if (!v) return '';
  return String(v).split('T')[0];
}

function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return localYmd(new Date(y, m - 1, d + n));
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const clean = cleanDate(dateStr);
  const parts = clean.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return dateStr;
}

function readToken(): string {
  if (typeof window === 'undefined') return '';
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return '';
}

export default function SevaCalendarCard({ seva, locale }: SevaCalendarCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isTa = locale === 'ta';
  const isCorpus = seva.category === 'corpus';

  const todayStr = useMemo(() => localYmd(new Date()), []);

  // -------------------------------------------------------------
  // 1. Devotee Auth State
  // -------------------------------------------------------------
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [devoteePhone, setDevoteePhone] = useState('');
  const [devoteeName, setDevoteeName] = useState('');

  // Dates this devotee already booked for this seva (double-booking guard)
  const [alreadyBookedDates, setAlreadyBookedDates] = useState<string[]>([]);

  const clearSession = useCallback(() => {
    SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
    setIsLoggedIn(false);
    setAuthToken('');
    setDevoteePhone('');
    setDevoteeName('');
    setAlreadyBookedDates([]);
  }, []);

  const checkActiveSession = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const token = readToken();
    if (!token) {
      setIsLoggedIn(false);
      setCheckingAuth(false);
      return;
    }

    const phone = localStorage.getItem('devotee_phone') || localStorage.getItem('phone') || '';
    const userRaw = localStorage.getItem('devotee_user') || localStorage.getItem('user') || '';

    let parsedName = '';
    let parsedPhone = phone;

    if (userRaw) {
      try {
        const u = JSON.parse(userRaw);
        parsedName = u.display_name || u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || '';
        if (!parsedPhone && (u.phone || u.mobile)) {
          parsedPhone = u.phone || u.mobile;
        }
      } catch (_) {}
    }

    setAuthToken(token);
    setIsLoggedIn(true);
    setDevoteePhone(parsedPhone);
    setDevoteeName(parsedName);

    try {
      const res = await fetch(`${API_BASE}/devotees/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        // Token expired or invalid: treat as logged out
        clearSession();
      } else if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          const p = data.profile;
          const liveName = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name || '';
          const livePhone = p.phone || parsedPhone;
          setDevoteeName(liveName);
          setDevoteePhone(livePhone);
          if (livePhone) localStorage.setItem('devotee_phone', livePhone);
        }
        if (data.familyMembers) {
          localStorage.setItem('devotee_family', JSON.stringify(data.familyMembers));
        }
      }
    } catch (err) {
      console.warn('Profile sync check skipped:', err);
    }

    setCheckingAuth(false);
  }, [clearSession]);

  useEffect(() => {
    checkActiveSession();
  }, [checkActiveSession]);

  // -------------------------------------------------------------
  // 2. Seva Recurrence Rules
  // -------------------------------------------------------------
  const isAnnual = seva.recurrence_type === 'annual';
  const isMonthly = seva.recurrence_type === 'monthly_tithi';
  const enforceUnique = !isCorpus; // corpus donations may repeat on the same date
  const annualDate = cleanDate(seva.event_date);

  // Fetch booked dates
  useEffect(() => {
    if (!isLoggedIn || !authToken || !seva.id || !enforceUnique) {
      setAlreadyBookedDates([]);
      return;
    }
    const controller = new AbortController();
    fetch(`${API_BASE}/payment/seva/my-booked-dates?sevaId=${encodeURIComponent(String(seva.id))}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        if (Array.isArray(data.bookedDates)) {
          setAlreadyBookedDates(data.bookedDates.map((d: string) => cleanDate(d)));
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.warn('Could not load booked dates:', err);
      });
    return () => controller.abort();
  }, [isLoggedIn, authToken, seva.id, enforceUnique]);

  // Panchangam dates for monthly recurring tithi
  const [upcomingTithiDates, setUpcomingTithiDates] = useState<UpcomingPanchangamDate[]>([]);
  const [loadingPanchangam, setLoadingPanchangam] = useState(false);
  const [tithiError, setTithiError] = useState(false);

  useEffect(() => {
    if (!isMonthly || !seva.id) return;
    const controller = new AbortController();
    setLoadingPanchangam(true);
    setTithiError(false);
    fetch(`${API_BASE}/offerings/${seva.id}/upcoming-dates`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setUpcomingTithiDates(Array.isArray(data.upcoming_dates) ? data.upcoming_dates : []);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error fetching tithi dates:', err);
          setTithiError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPanchangam(false);
      });
    return () => controller.abort();
  }, [isMonthly, seva.id]);

  const bookedSet = useMemo(
    () => new Set(enforceUnique ? alreadyBookedDates : []),
    [alreadyBookedDates, enforceUnique]
  );

  const sortedTithi = useMemo(
    () => Array.from(new Set(upcomingTithiDates.map((u) => cleanDate(u.calendar_date)))).filter(Boolean).sort(),
    [upcomingTithiDates]
  );
  const tithiSet = useMemo(() => new Set(sortedTithi), [sortedTithi]);

  // Single source of truth: can this date be booked?
  const isDateAvailable = useCallback(
    (ds: string): boolean => {
      if (!ds || ds < todayStr) return false;
      if (bookedSet.has(ds)) return false;
      if (isAnnual) return ds === annualDate;
      if (isMonthly) return tithiSet.has(ds);
      return true;
    },
    [todayStr, bookedSet, isAnnual, isMonthly, annualDate, tithiSet]
  );

  // Calendar view month
  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = localYmd(new Date()).split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  // Selected date: auto-corrected to the first available date
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    if (!isLoggedIn) return;
    if (selectedDate && isDateAvailable(selectedDate)) return;

    let next = '';
    if (isAnnual) {
      next = annualDate && isDateAvailable(annualDate) ? annualDate : '';
    } else if (isMonthly) {
      next = sortedTithi.find((d) => isDateAvailable(d)) || '';
    } else {
      for (let i = 1; i <= 400; i++) {
        const c = addDaysYmd(todayStr, i);
        if (isDateAvailable(c)) {
          next = c;
          break;
        }
      }
    }

    if (next !== selectedDate) {
      setSelectedDate(next);
      if (next) {
        const [y, m] = next.split('-').map(Number);
        setViewDate(new Date(y, m - 1, 1));
      }
    }
  }, [isLoggedIn, selectedDate, isDateAvailable, isAnnual, isMonthly, annualDate, sortedTithi, todayStr]);

  // -------------------------------------------------------------
  // 3. Calendar grid
  // -------------------------------------------------------------
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: {
      day: number;
      dateString: string;
      isPast: boolean;
      isAlreadyBooked: boolean;
      isSelectable: boolean;
      isAnnualFestival: boolean;
      isMonthlyTithi: boolean;
    }[] = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        day: 0,
        dateString: '',
        isPast: true,
        isAlreadyBooked: false,
        isSelectable: false,
        isAnnualFestival: false,
        isMonthlyTithi: false,
      });
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateString = `${year}-${pad2(month + 1)}-${pad2(d)}`;
      days.push({
        day: d,
        dateString,
        isPast: dateString < todayStr,
        isAlreadyBooked: bookedSet.has(dateString),
        isSelectable: isDateAvailable(dateString),
        isAnnualFestival: isAnnual && dateString === annualDate,
        isMonthlyTithi: isMonthly && tithiSet.has(dateString),
      });
    }

    return days;
  }, [viewDate, todayStr, bookedSet, isDateAvailable, isAnnual, isMonthly, annualDate, tithiSet]);

  const now = new Date();
  const canGoPrev =
    viewDate.getFullYear() * 12 + viewDate.getMonth() > now.getFullYear() * 12 + now.getMonth();

  // Why nothing can be selected (shown instead of a silent empty calendar)
  let availabilityNotice = '';
  if (isAnnual) {
    if (!annualDate) {
      availabilityNotice = isTa
        ? 'விசேஷ நாள் இன்னும் நிர்ணயிக்கப்படவில்லை.'
        : 'The festival date has not been set yet.';
    } else if (annualDate < todayStr) {
      availabilityNotice = isTa
        ? 'இந்த ஆண்டின் விசேஷ நாள் கடந்துவிட்டது. அடுத்த தேதி அறிவிக்கப்பட்டவுடன் முன்பதிவு திறக்கப்படும்.'
        : 'This year’s festival date has passed. Booking will reopen when the next date is announced.';
    }
  } else if (isMonthly) {
    if (loadingPanchangam) {
      availabilityNotice = isTa ? 'திதி நாட்கள் ஏற்றப்படுகின்றன...' : 'Loading tithi dates...';
    } else if (tithiError || sortedTithi.length === 0) {
      availabilityNotice = isTa
        ? 'வரவிருக்கும் திதி நாட்கள் தற்போது கிடைக்கவில்லை. சிறிது நேரம் கழித்து முயற்சிக்கவும்.'
        : 'Upcoming tithi dates are not available right now. Please try again later.';
    }
  }
  if (!availabilityNotice && !selectedDate && !checkingAuth) {
    availabilityNotice = isTa
      ? 'தற்போது முன்பதிவு செய்யக்கூடிய தேதிகள் இல்லை.'
      : 'There are no bookable dates available right now.';
  }

  const handleProceed = () => {
    if (!selectedDate || !isDateAvailable(selectedDate)) {
      if (selectedDate && bookedSet.has(selectedDate)) {
        alert(
          isTa
            ? 'இந்த நாளில் நீங்கள் ஏற்கெனவே இந்த சேவையை முன்பதிவு செய்துள்ளீர்கள். தயவுசெய்து வேறு நாளைத் தேர்ந்தெடுக்கவும்.'
            : 'You have already booked this seva for the selected date. Please pick another auspicious date.'
        );
      } else {
        alert(isTa ? 'தயவுசெய்து ஒரு மங்கல நாளைத் தேர்ந்தெடுக்கவும்.' : 'Please select an auspicious date.');
      }
      return;
    }

    router.push(`/${locale}/sevas/${seva.slug}/checkout?date=${encodeURIComponent(selectedDate)}`);
  };

  const loginRedirectUrl = `/${locale}/login?redirect=${encodeURIComponent(
    pathname || `/${locale}/sevas/${seva.slug}`
  )}`;

  const openAmountLabel = isCorpus
    ? isTa ? 'பகுதி கட்டணம்' : 'Part Payment'
    : isTa ? 'யதாசக்தி' : 'Yathashakti';

  return (
    <div className="overflow-hidden rounded-md border border-sand bg-white shadow-md">
      {/* 1. Header */}
      <div className="border-t-4 border-saffron bg-maroon px-6 py-5 text-white">
        <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-saffron">
          {isTa ? 'பூஜை முன்பதிவு' : 'Seva Booking'}
        </span>
        <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-white [html[lang='ta']_&]:leading-[1.4]">
          {isTa ? seva.title_ta || seva.title_en : seva.title_en}
        </h3>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/20 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
            {isTa ? 'காணிக்கைத் தொகை' : 'Offering Amount'}
          </span>
          <span className="text-right text-lg font-bold leading-none text-saffron">
            {seva.price_type === 'custom' || !(Number(seva.amount) > 0)
              ? openAmountLabel
              : rupees(seva.amount)}
          </span>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {/* 2. AUTH GATE */}
        {checkingAuth ? (
          <div className="space-y-2 py-8 text-center">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-maroon border-t-transparent" />
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal/60">
              {isTa ? 'சரிபார்க்கப்படுகிறது...' : 'Verifying session...'}
            </p>
          </div>
        ) : !isLoggedIn ? (
          <div className="space-y-4 rounded-md border border-sand bg-cream/60 p-5 text-center">
            <div>
              <h4 className="font-display text-base font-semibold text-maroon">
                {isTa ? 'தேதி தேர்வு செய்ய உள்நுழைக' : 'Login to Select Auspicious Date'}
              </h4>
              <p className="mt-2 font-serif text-[13px] leading-relaxed text-charcoal/75">
                {isTa
                  ? 'பக்தர்கள் தங்கள் கணக்கில் உள்நுழைந்த பிறகு மட்டுமே நாள்காட்டியில் தேதி தேர்ந்தெடுத்து முன்பதிவு செய்ய முடியும்.'
                  : 'Please log in to your account to view temple calendar availability and book this seva.'}
              </p>
            </div>

            <Link
              href={loginRedirectUrl}
              className="flex w-full cursor-pointer items-center justify-center rounded-md bg-saffron px-4 py-3 text-sm font-bold text-charcoal transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
            >
              <span>{isTa ? 'உள்நுழைவுப் பக்கத்திற்குச் செல்க' : 'Go to Login Page'}</span>
            </Link>
          </div>
        ) : (
          /* 3. LOGGED-IN: CALENDAR */
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-md border border-sand bg-cream/60 px-4 py-2.5 text-xs text-charcoal">
              <span className="truncate font-semibold">
                {devoteeName
                  ? `${devoteeName}${devoteePhone ? ` (+91 ${devoteePhone})` : ''}`
                  : devoteePhone
                  ? `+91 ${devoteePhone}`
                  : isTa
                  ? 'பக்தர் கணக்கு'
                  : 'Devotee Account'}
              </span>
              <button
                type="button"
                onClick={clearSession}
                className="ml-3 shrink-0 cursor-pointer text-[11px] font-bold uppercase tracking-wider text-maroon underline-offset-4 hover:underline"
              >
                {isTa ? 'வெளியேறு' : 'Logout'}
              </button>
            </div>

            {/* SEVA TYPE CONTEXT NOTICE */}
            {isAnnual && (
              <div className="space-y-1.5 rounded-md border-l-4 border-saffron bg-cream/70 p-3.5 text-xs text-charcoal">
                <div className="flex items-center justify-between gap-2 font-bold">
                  <span>{isTa ? 'வருடாந்திர விசேஷ நாள்' : 'Annual Festival Occasion'}</span>
                  <span className="whitespace-nowrap rounded-sm border border-saffron bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-maroon">
                    {isTa ? 'விசேஷ நாள் மட்டும்' : 'Locked Date'}
                  </span>
                </div>
                <p className="font-serif text-[12px] leading-relaxed text-charcoal/75">
                  {isTa
                    ? 'இந்த சேவை கீழே நாள்காட்டியில் குறிக்கப்பட்டுள்ள விசேஷ நாளில் மட்டுமே நிகழும்.'
                    : 'This seva is exclusively performed on the festival date marked on the calendar below.'}
                </p>
              </div>
            )}

            {isMonthly && (
              <div className="space-y-1.5 rounded-md border-l-4 border-maroon bg-cream/70 p-3.5 text-xs text-charcoal">
                <div className="flex items-center justify-between gap-2 font-bold">
                  <span>{isTa ? 'மாதாந்திர திதி பூஜை' : 'Monthly Recurring Tithi'} ({seva.tithi_trigger || 'Sashti'})</span>
                  <span className="whitespace-nowrap rounded-sm border border-maroon bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-maroon">
                    {isTa ? 'திதி சுழற்சி' : 'Auto Tithi'}
                  </span>
                </div>
                <p className="font-serif text-[12px] leading-relaxed text-charcoal/75">
                  {isTa
                    ? 'நாள்காட்டியில் ஊதா நிறத்தில் உள்ள திதி நாட்களில் ஏதேனும் ஒரு நாளைத் தேர்வு செய்யலாம்.'
                    : 'Select any upcoming tithi date highlighted in purple on the calendar.'}
                </p>
              </div>
            )}

            {availabilityNotice && (
              <div
                role="status"
                className="rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-amber-900"
              >
                {availabilityNotice}
              </div>
            )}

            {/* CALENDAR GRID */}
            <div className="space-y-2.5">
              <div className="flex items-end justify-between gap-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-charcoal/70">
                  {isTa ? 'தேதி தேர்வு' : 'Calendar Selection'}
                </label>
                <span className="text-xs font-bold text-maroon">
                  {isTa ? 'தேர்ந்தெடுக்கப்பட்டது' : 'Selected'}: {selectedDate ? formatDisplayDate(selectedDate) : '—'}
                </span>
              </div>

              <div className="space-y-3 rounded-md border border-sand bg-cream/40 p-3.5">
                {/* Month Navigator */}
                <div className="flex items-center justify-between border-b border-sand pb-3 text-sm font-bold text-charcoal">
                  <span className="font-display">
                    {isTa ? MONTH_NAMES_TA[viewDate.getMonth()] : MONTH_NAMES_EN[viewDate.getMonth()]} {viewDate.getFullYear()}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!canGoPrev}
                      onClick={() =>
                        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
                      }
                      className="cursor-pointer rounded-sm border border-sand bg-white px-3 py-1 text-[11px] font-bold text-charcoal transition-colors hover:border-maroon hover:text-maroon disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-sand disabled:hover:text-charcoal"
                    >
                      {isTa ? 'முந்தைய' : 'Prev'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
                      }
                      className="cursor-pointer rounded-sm border border-sand bg-white px-3 py-1 text-[11px] font-bold text-charcoal transition-colors hover:border-maroon hover:text-maroon"
                    >
                      {isTa ? 'அடுத்த' : 'Next'}
                    </button>
                  </div>
                </div>

                {/* Day Names */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-charcoal/55">
                  {(isTa ? WEEK_DAYS_TA : WEEK_DAYS_EN).map((d, i) => (
                    <span key={i} className="truncate">{d}</span>
                  ))}
                </div>

                {/* Date Cells */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((item, idx) => {
                    if (!item.day) {
                      return <div key={`empty-${idx}`} className="h-9 w-full" />;
                    }

                    // 1. Expired
                    if (item.isPast) {
                      return (
                        <div
                          key={item.dateString}
                          title={isTa ? 'காலாவதியான தேதி' : 'Expired / Past Date'}
                          className="flex h-9 w-full cursor-not-allowed select-none items-center justify-center rounded-sm border border-red-200 bg-red-50 text-xs font-medium text-red-500 line-through"
                        >
                          {item.day}
                        </div>
                      );
                    }

                    // 2. Already booked by this devotee
                    if (item.isAlreadyBooked) {
                      return (
                        <div
                          key={item.dateString}
                          title={isTa ? 'நீங்கள் ஏற்கெனவே முன்பதிவு செய்துள்ளீர்கள்' : 'Already Booked by You'}
                          className="flex h-9 w-full cursor-not-allowed select-none items-center justify-center rounded-sm border-2 border-amber-500 bg-amber-100 text-xs font-black text-amber-950 line-through"
                        >
                          {item.day}
                        </div>
                      );
                    }

                    const isCurrentSelected = selectedDate === item.dateString;

                    // 3. Selected
                    if (isCurrentSelected) {
                      return (
                        <button
                          key={item.dateString}
                          type="button"
                          onClick={() => setSelectedDate(item.dateString)}
                          className="h-9 w-full cursor-pointer rounded-sm border border-maroon bg-maroon text-xs font-bold text-white shadow-sm"
                        >
                          {item.day}
                        </button>
                      );
                    }

                    // 4. Annual festival day
                    if (item.isAnnualFestival) {
                      return (
                        <button
                          key={item.dateString}
                          type="button"
                          onClick={() => setSelectedDate(item.dateString)}
                          className="h-9 w-full cursor-pointer rounded-sm border-2 border-saffron bg-saffron/25 text-xs font-bold text-charcoal transition-colors hover:bg-saffron/50"
                        >
                          {item.day}
                        </button>
                      );
                    }

                    // 5. Monthly tithi day
                    if (item.isMonthlyTithi) {
                      return (
                        <button
                          key={item.dateString}
                          type="button"
                          onClick={() => setSelectedDate(item.dateString)}
                          className="h-9 w-full cursor-pointer rounded-sm border-2 border-purple-500 bg-purple-100 text-xs font-bold text-purple-950 transition-colors hover:bg-purple-200"
                        >
                          {item.day}
                        </button>
                      );
                    }

                    // 6. Selectable regular day
                    if (item.isSelectable) {
                      return (
                        <button
                          key={item.dateString}
                          type="button"
                          onClick={() => setSelectedDate(item.dateString)}
                          className="h-9 w-full cursor-pointer rounded-sm border border-sand bg-white text-xs font-semibold text-charcoal transition-colors hover:border-saffron hover:bg-saffron/15 hover:text-maroon"
                        >
                          {item.day}
                        </button>
                      );
                    }

                    // 7. Not bookable
                    return (
                      <div
                        key={item.dateString}
                        className="flex h-9 w-full cursor-not-allowed select-none items-center justify-center rounded-sm border border-slate-100 bg-slate-50 text-xs font-medium text-slate-300"
                      >
                        {item.day}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-sand pt-3 text-[10px] font-bold uppercase tracking-wider text-charcoal/60">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-3.5 w-4 items-center justify-center rounded-sm border border-red-200 bg-red-50 text-[8px] text-red-500 line-through">
                      1
                    </span>
                    <span>{isTa ? 'காலாவதியானது' : 'Expired'}</span>
                  </div>

                  {bookedSet.size > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-3.5 w-4 items-center justify-center rounded-sm border-2 border-amber-500 bg-amber-100 text-[8px] font-bold text-amber-950 line-through">
                        1
                      </span>
                      <span>{isTa ? 'பதிவு செய்யப்பட்டது' : 'Already Booked'}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <span className="h-3.5 w-4 rounded-sm bg-maroon" />
                    <span>{isTa ? 'தேர்வு செய்யப்பட்டது' : 'Selected'}</span>
                  </div>

                  {isAnnual && (
                    <div className="flex items-center gap-1.5">
                      <span className="h-3.5 w-4 rounded-sm border border-saffron bg-saffron/25" />
                      <span>{isTa ? 'விசேஷ நாள்' : 'Festival Day'}</span>
                    </div>
                  )}

                  {isMonthly && (
                    <div className="flex items-center gap-1.5">
                      <span className="h-3.5 w-4 rounded-sm border border-purple-500 bg-purple-100" />
                      <span>{isTa ? 'திதி நாள்' : 'Tithi Day'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PROCEED */}
            <button
              type="button"
              onClick={handleProceed}
              disabled={!selectedDate}
              className="flex w-full cursor-pointer items-center justify-center rounded-md bg-saffron px-4 py-3.5 text-sm font-bold text-charcoal transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-saffron disabled:hover:text-charcoal"
            >
              <span>{isTa ? 'சங்கல்ப விவரங்களுக்குச் செல்க (Step 1)' : 'Proceed to Sankalpam (Step 1 of 3)'}</span>
            </button>
          </div>
        )}

        {/* Benefits Footer */}
        <div className="space-y-2 border-t border-sand pt-4 text-[12px] text-charcoal/75">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-maroon">
            {isTa ? 'வேத முறைப்படியான சங்கல்ப பூஜை:' : 'Vedic Sankalpam Service:'}
          </p>
          <ul className="list-inside list-disc space-y-1 font-serif leading-relaxed marker:text-saffron">
            <li>{isTa ? 'ஆசிரம வேத பண்டிதர்களால் குடும்பப் பெயரில் சங்கல்பம்' : 'Personalized sankalpam with Gothram and Nakshatram'}</li>
            <li>{isTa ? 'பூஜை பிரசாதம் தபால் மூலம் அனுப்பி வைக்கப்படும்' : 'Sacred prasadam dispatched to registered address'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}