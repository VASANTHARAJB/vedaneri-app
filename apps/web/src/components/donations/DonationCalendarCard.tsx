'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { DonationFund } from '@/type/donation';
import { rupees } from '@/lib/format';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const TOKEN_KEYS = ['devotee_token', 'token', 'auth_token', 'accessToken'];

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_TA = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_TA = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const cleanDate = (v?: string | null) => (v ? String(v).split('T')[0] : '');
const addDays = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number);
  return ymd(new Date(y, m - 1, d + n));
};
const display = (s?: string) => {
  const p = cleanDate(s).split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : '';
};

function readToken(): string {
  if (typeof window === 'undefined') return '';
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return '';
}

export default function DonationCalendarCard({ fund, locale }: { fund: DonationFund; locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isTa = locale === 'ta';
  const tr = (en: string, ta: string) => (isTa ? ta : en);

  const isCorpus = fund.category === 'corpus';
  const isOpen = fund.price_type === 'custom' || !(Number(fund.amount) > 0);
  const openLabel = isCorpus ? tr('Part Payment', 'பகுதி கட்டணம்') : tr('Yathashakti', 'யதாசக்தி');
  const title = isTa ? fund.title_ta || fund.title_en : fund.title_en;

  const isAnnual = fund.recurrence_type === 'annual';
  const pinnedDate = cleanDate(fund.event_date);
  const todayStr = useMemo(() => ymd(new Date()), []);

  const [checking, setChecking] = useState(true);
  const [token, setToken] = useState('');
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [view, setView] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  useEffect(() => {
    setToken(readToken());
    setChecking(false);
  }, []);

  // Dates this donor already paid for this fund
  const loadBooked = useCallback(() => {
    if (!token) {
      setBookedDates([]);
      return () => {};
    }
    const controller = new AbortController();
    fetch(`${API_BASE}/donation-booking/my-booked-dates?donationId=${encodeURIComponent(String(fund.id))}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (Array.isArray(d.bookedDates)) setBookedDates(d.bookedDates.map((x: string) => cleanDate(x)));
      })
      .catch((e) => {
        if (e.name !== 'AbortError') console.warn('Could not load donated dates:', e);
      });
    return () => controller.abort();
  }, [token, fund.id]);

  useEffect(() => {
    const cancel = loadBooked();
    const onShow = () => loadBooked();
    window.addEventListener('pageshow', onShow);
    return () => {
      cancel();
      window.removeEventListener('pageshow', onShow);
    };
  }, [loadBooked]);

  const bookedSet = useMemo(() => new Set(bookedDates), [bookedDates]);

  const isAvailable = useCallback(
    (ds: string) => {
      if (!ds || ds < todayStr) return false;
      if (bookedSet.has(ds)) return false;
      if (isAnnual) return ds === pinnedDate;
      return true;
    },
    [todayStr, bookedSet, isAnnual, pinnedDate]
  );

  // Keep the selection on a valid date (first available, starting today)
  useEffect(() => {
    if (!token) return;
    if (selected && isAvailable(selected)) return;
    let next = '';
    if (isAnnual) {
      next = pinnedDate && isAvailable(pinnedDate) ? pinnedDate : '';
    } else {
      for (let i = 0; i <= 400; i++) {
        const c = addDays(todayStr, i);
        if (isAvailable(c)) {
          next = c;
          break;
        }
      }
    }
    if (next !== selected) {
      setSelected(next);
      if (next) {
        const [y, m] = next.split('-').map(Number);
        setView(new Date(y, m - 1, 1));
      }
    }
  }, [token, selected, isAvailable, isAnnual, pinnedDate, todayStr]);

  const cells = useMemo(() => {
    const y = view.getFullYear();
    const m = view.getMonth();
    const first = new Date(y, m, 1).getDay();
    const total = new Date(y, m + 1, 0).getDate();
    const out: { day: number; ds: string }[] = [];
    for (let i = 0; i < first; i++) out.push({ day: 0, ds: '' });
    for (let d = 1; d <= total; d++) out.push({ day: d, ds: `${y}-${pad2(m + 1)}-${pad2(d)}` });
    return out;
  }, [view]);

  const now = new Date();
  const canPrev = view.getFullYear() * 12 + view.getMonth() > now.getFullYear() * 12 + now.getMonth();

  let notice = '';
  if (isAnnual && !pinnedDate) notice = tr('The festival date has not been set yet.', 'விசேஷ நாள் இன்னும் நிர்ணயிக்கப்படவில்லை.');
  else if (isAnnual && pinnedDate < todayStr)
    notice = tr('This year’s festival date has passed. Donations will reopen when the next date is announced.', 'இந்த ஆண்டின் விசேஷ நாள் கடந்துவிட்டது. அடுத்த தேதி அறிவிக்கப்பட்டவுடன் திறக்கப்படும்.');
  else if (token && !selected) notice = tr('There are no available dates right now.', 'தற்போது தேர்வு செய்யக்கூடிய தேதிகள் இல்லை.');

  const loginHref = `/${locale}/login?redirect=${encodeURIComponent(pathname || `/${locale}/donate/${fund.slug}`)}`;

  const proceed = () => {
    if (!selected || !isAvailable(selected)) return;
    router.push(`/${locale}/donate/${fund.slug}/checkout?date=${encodeURIComponent(selected)}`);
  };

  const bookedLabel = tr('Already Donated', 'ஏற்கெனவே பங்களித்தது');

  return (
    <div className="overflow-hidden rounded-md border border-sand bg-white shadow-md">
      <div className="border-t-4 border-saffron bg-maroon px-6 py-5 text-white">
        <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-saffron">{tr('Make a Donation', 'நன்கொடை அளிக்க')}</span>
        <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-white [html[lang='ta']_&]:leading-[1.4]">{title}</h3>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/20 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">{tr('Donation Amount', 'நன்கொடைத் தொகை')}</span>
          <span className="text-right text-lg font-bold leading-none text-saffron">{isOpen ? openLabel : rupees(fund.amount)}</span>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {checking ? (
          <p className="py-6 text-center text-xs font-semibold uppercase tracking-wider text-charcoal/60">{tr('Verifying session...', 'சரிபார்க்கப்படுகிறது...')}</p>
        ) : !token ? (
          <div className="space-y-4 rounded-md border border-sand bg-cream/60 p-5 text-center">
            <h4 className="font-display text-base font-semibold text-maroon">{tr('Login to Select Date', 'தேதி தேர்வு செய்ய உள்நுழைக')}</h4>
            <p className="font-serif text-[13px] leading-relaxed text-charcoal/75">
              {tr('Please log in so your receipt is issued in your name.', 'உங்கள் பெயரில் ரசீது வழங்கப்பட உள்நுழையவும்.')}
            </p>
            <Link href={loginHref} className="flex w-full items-center justify-center rounded-md bg-saffron px-4 py-3 text-sm font-bold text-charcoal transition-colors hover:bg-maroon hover:text-white">
              {tr('Go to Login Page', 'உள்நுழைவுப் பக்கத்திற்குச் செல்க')}
            </Link>
          </div>
        ) : (
          <>
            {isAnnual && (
              <div className="rounded-md border-l-4 border-saffron bg-cream/70 p-3.5 text-xs text-charcoal">
                <p className="font-bold">{tr('Annual Festival Occasion', 'வருடாந்திர விசேஷ நாள்')}</p>
                <p className="mt-1 font-serif text-[12px] leading-relaxed text-charcoal/75">
                  {tr('This donation is accepted on the festival date marked on the calendar.', 'இந்த நன்கொடை நாள்காட்டியில் குறிக்கப்பட்ட விசேஷ நாளில் ஏற்கப்படும்.')}
                </p>
              </div>
            )}

            {notice && (
              <div role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-amber-900">
                {notice}
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex items-end justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-charcoal/70">{tr('Calendar Selection', 'தேதி தேர்வு')}</span>
                <span className="text-xs font-bold text-maroon">
                  {tr('Selected', 'தேர்ந்தெடுக்கப்பட்டது')}: {selected ? display(selected) : '—'}
                </span>
              </div>

              <div className="space-y-3 rounded-md border border-sand bg-cream/40 p-3.5">
                <div className="flex items-center justify-between border-b border-sand pb-3 text-sm font-bold text-charcoal">
                  <span className="font-display">{(isTa ? MONTHS_TA : MONTHS_EN)[view.getMonth()]} {view.getFullYear()}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!canPrev}
                      onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                      className="cursor-pointer rounded-sm border border-sand bg-white px-3 py-1 text-[11px] font-bold text-charcoal transition-colors hover:border-maroon hover:text-maroon disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tr('Prev', 'முந்தைய')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                      className="cursor-pointer rounded-sm border border-sand bg-white px-3 py-1 text-[11px] font-bold text-charcoal transition-colors hover:border-maroon hover:text-maroon"
                    >
                      {tr('Next', 'அடுத்த')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-charcoal/55">
                  {(isTa ? DAYS_TA : DAYS_EN).map((d, i) => (
                    <span key={i} className="truncate">{d}</span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {cells.map((c, idx) => {
                    if (!c.day) return <div key={`e-${idx}`} className="h-9 w-full" />;
                    if (c.ds < todayStr)
                      return (
                        <div key={c.ds} title={tr('Expired / Past Date', 'காலாவதியான தேதி')} className="flex h-9 w-full cursor-not-allowed select-none items-center justify-center rounded-sm border border-red-200 bg-red-50 text-xs font-medium text-red-500 line-through">
                          {c.day}
                        </div>
                      );
                    if (bookedSet.has(c.ds))
                      return (
                        <div key={c.ds} title={bookedLabel} className="flex h-9 w-full cursor-not-allowed select-none items-center justify-center rounded-sm border-2 border-amber-500 bg-amber-100 text-xs font-black text-amber-950 line-through">
                          {c.day}
                        </div>
                      );
                    if (selected === c.ds)
                      return (
                        <button key={c.ds} type="button" onClick={() => setSelected(c.ds)} className="h-9 w-full cursor-pointer rounded-sm border border-maroon bg-maroon text-xs font-bold text-white shadow-sm">
                          {c.day}
                        </button>
                      );
                    if (isAvailable(c.ds))
                      return (
                        <button
                          key={c.ds}
                          type="button"
                          onClick={() => setSelected(c.ds)}
                          className={`h-9 w-full cursor-pointer rounded-sm text-xs font-semibold text-charcoal transition-colors hover:bg-saffron/15 hover:text-maroon ${
                            isAnnual ? 'border-2 border-saffron bg-saffron/25 font-bold' : 'border border-sand bg-white hover:border-saffron'
                          }`}
                        >
                          {c.day}
                        </button>
                      );
                    return (
                      <div key={c.ds} className="flex h-9 w-full cursor-not-allowed select-none items-center justify-center rounded-sm border border-slate-100 bg-slate-50 text-xs font-medium text-slate-300">
                        {c.day}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-sand pt-3 text-[10px] font-bold uppercase tracking-wider text-charcoal/60">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-3.5 w-4 items-center justify-center rounded-sm border border-red-200 bg-red-50 text-[8px] text-red-500 line-through">1</span>
                    <span>{tr('Expired', 'காலாவதியானது')}</span>
                  </div>
                  {bookedSet.size > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-3.5 w-4 items-center justify-center rounded-sm border-2 border-amber-500 bg-amber-100 text-[8px] font-bold text-amber-950 line-through">1</span>
                      <span>{bookedLabel}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="h-3.5 w-4 rounded-sm bg-maroon" />
                    <span>{tr('Selected', 'தேர்வு செய்யப்பட்டது')}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={proceed}
              disabled={!selected}
              className="flex w-full cursor-pointer items-center justify-center rounded-md bg-saffron px-4 py-3.5 text-sm font-bold text-charcoal transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-saffron disabled:hover:text-charcoal"
            >
              {tr('Proceed to Checkout', 'செலுத்தும் பக்கத்திற்குச் செல்க')}
            </button>
          </>
        )}

        <p className="border-t border-sand pt-4 text-[12px] leading-relaxed text-charcoal/65">
          {tr('Secure online payment. A receipt is sent to your email after the payment is confirmed.', 'பாதுகாப்பான இணையவழி கட்டணம். கட்டணம் உறுதியான பின் ரசீது மின்னஞ்சலுக்கு அனுப்பப்படும்.')}
        </p>
      </div>
    </div>
  );
}