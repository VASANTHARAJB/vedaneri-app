'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { COUNTRY_CODES } from '@/data/countryCodes';
import { loadRazorpayScript } from '@/lib/razorpay';
import { rupees } from '@/lib/format';
import type { DonationFund } from '@/type/donation';

interface FamilyMember {
  title: string;
  name: string;
  gothram: string;
  gothramOther?: string;
  nakshathiram: string;
  nakshathiramOther?: string;
  rasi: string;
  rasiOther?: string;
  relation: string;
  relationOther?: string;
}

interface NoticeState {
  tone: 'error' | 'info';
  text: string;
  linkHref?: string;
  linkLabel?: string;
}

interface MemberErr {
  index: number;
  field: string;
  message: string;
}

interface SavedIds {
  panMasked: string;
  aadhaarMasked: string;
}

const GOTHRAMS = [
  'Harita (ஹரித)', 'Kasyapa (காஷ்யப)', 'Bharadwaja (பாரத்வாஜ)', 'Vasishta (வசிஷ்ட)',
  'Kaundinya (கௌண்டின்ய)', 'Viswamitra (விஸ்வாமித்ர)', 'Gautama (கௌதம)', 'Agastya (அகஸ்திய)',
  'Sandilya (சாண்டில்ய)', 'Srivatsa (ஸ்ரீவத்ச)', 'Vadula (வாதுல)', 'Kausika (கௌசிக)',
  'Athreya (ஆத்ரேய)', 'Parasara (பராசர)', 'Jamadagni (ஜமதக்னி)', 'Gargya (கார்க்ய)',
  'Naidhruva (நைத்ருவ)', 'Sankrithi (சங்க்ரிதி)', 'Mudgala (முத்கல)', 'Saunaka (சௌனக)',
  'Upamanyu (உபமன்யு)', 'Other',
];

const NAKSHATHIRAMS = [
  'Ashwini (அசுவினி)', 'Bharani (பரணி)', 'Krittika (கிருத்திகை)', 'Rohini (ரோகிணி)',
  'Mrigashirsha (மிருகசீரிஷம்)', 'Ardra (திருவாதிரை)', 'Punarvasu (புனர்பூசம்)', 'Pushya (பூசம்)',
  'Ashlesha (ஆயில்யம்)', 'Magha (மகம்)', 'Purva Phalguni (பூரம்)', 'Uttara Phalguni (உத்திரம்)',
  'Hasta (அஸ்தம்)', 'Chitra (சித்திரை)', 'Swati (சுவாதி)', 'Vishakha (விசாகம்)',
  'Anuradha (அனுஷம்)', 'Jyeshtha (கேட்டை)', 'Mula (மூலம்)', 'Purva Ashadha (பூராடம்)',
  'Uttara Ashadha (உத்திராடம்)', 'Shravana (திருவோணம்)', 'Dhanishta (அவிட்டம்)',
  'Shatabhisha (சதயம்)', 'Purva Bhadrapada (பூரட்டாதி)', 'Uttara Bhadrapada (உத்திரட்டாதி)',
  'Revati (ரேவதி)', 'Other',
];

const RASIS = [
  'Mesha (மேஷம்)', 'Vrishabha (ரிஷபம்)', 'Mithuna (மிதுனம்)', 'Karkataka (கடகம்)',
  'Simha (சிம்மம்)', 'Kanya (கன்னி)', 'Tula (துலாம்)', 'Vrischika (விருச்சிகம்)',
  'Dhanu (தனுசு)', 'Makara (மகரம்)', 'Kumbha (கும்பம்)', 'Meena (மீனம்)', 'Other',
];

const RELATIONS = [
  'Self (சுய விவரம்)', 'Spouse (மனைவி / கணவர்)', 'Son (மகன்)', 'Daughter (மகள்)',
  'Father (தந்தை)', 'Mother (தாய்)', 'Brother (சகோதரன்)', 'Sister (சகோதரி)', 'Other',
];

const QUICK_AMOUNTS = ['501', '1008', '2001', '5001'];
const TOKEN_KEYS = ['devotee_token', 'token', 'auth_token', 'accessToken'];
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Aadhaar checksum (Verhoeff)
const VD = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
  [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0],
];
const VP = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],
  [9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];
function isValidAadhaar(a: string): boolean {
  if (!/^[2-9][0-9]{11}$/.test(a)) return false;
  let c = 0;
  const digits = a.split('').reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = VD[c][VP[i % 8][digits[i]]];
  return c === 0;
}

// Fields that show an error get a red border, a light red background and a red focus ring
const INPUT_BASE =
  'h-12 w-full rounded-md border px-4 text-base text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-2';
const inputClass = (hasError?: boolean) =>
  `${INPUT_BASE} ${
    hasError
      ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-300'
      : 'border-sand bg-white focus:border-maroon focus:ring-saffron/40'
  }`;
const TEXTAREA_BASE =
  'w-full rounded-md border px-4 py-3 text-base text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-2';
const textareaClass = (hasError?: boolean) =>
  `${TEXTAREA_BASE} ${
    hasError
      ? 'border-red-500 bg-red-50 focus:border-red-600 focus:ring-red-300'
      : 'border-sand bg-white focus:border-maroon focus:ring-saffron/40'
  }`;

const CARD = 'rounded-md border border-sand bg-white p-5 shadow-sm sm:p-7';
const BTN_PRIMARY =
  'inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-md bg-saffron px-7 py-3 text-base font-bold text-charcoal transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-saffron disabled:hover:text-charcoal';
const BTN_MAROON =
  'inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-md bg-maroon px-7 py-3 text-base font-bold text-white transition-colors hover:bg-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron disabled:cursor-not-allowed disabled:opacity-60';
const BTN_SECONDARY =
  'inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-md border border-sand bg-white px-6 py-3 text-base font-bold text-charcoal transition-colors hover:border-maroon hover:text-maroon disabled:cursor-not-allowed disabled:opacity-60';

function Field({
  label,
  error,
  children,
  className = '',
  name,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  name?: string;
}) {
  return (
    <label data-field={name} className={`block scroll-mt-32 ${className}`}>
      <span className={`mb-1.5 block text-sm font-bold ${error ? 'text-red-700' : 'text-charcoal'}`}>{label}</span>
      {children}
      {error && (
        <span role="alert" className="mt-1.5 block text-sm font-semibold text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}

function Select({
  hasError,
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }) {
  return (
    <select {...props} className={`${inputClass(hasError)} cursor-pointer ${className}`}>
      {children}
    </select>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border-b border-sand pb-4">
      <h2 className="font-display text-xl font-semibold text-maroon sm:text-2xl">{title}</h2>
      {hint && <p className="mt-1 font-serif text-[15px] leading-relaxed text-charcoal/70">{hint}</p>}
    </div>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const localYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const parts = String(dateStr).split('T')[0].split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : String(dateStr);
}

function readToken(): string {
  if (typeof window === 'undefined') return '';
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return '';
}

const emptyMember = (relation = 'Self (சுய விவரம்)'): FamilyMember => ({
  title: 'Sri', name: '', gothram: '', nakshathiram: '', rasi: '', relation,
});

export default function DonationCheckoutPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const locale = (params.locale as string) || 'en';
  const slug = decodeURIComponent((params.slug as string) || '');
  const isTa = locale === 'ta';
  const bookingDate = (searchParams.get('date') || '').split('T')[0];
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  const tr = (en: string, ta: string) => (isTa ? ta : en);

  // Step: 1 = Donor & Family, 2 = Address, 3 = Review & Pay
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [maxStep, setMaxStep] = useState<1 | 2 | 3>(1);
  const [loadingFund, setLoadingFund] = useState(true);
  const [fund, setFund] = useState<DonationFund | null>(null);

  const [devoteeToken, setDevoteeToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Donor
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaar, setAadhaar] = useState('');

  // PAN and Aadhaar saved from an earlier donation (masked values only)
  const [savedIds, setSavedIds] = useState<SavedIds | null>(null);
  const [useSaved, setUseSaved] = useState(false);

  // Address
  const [commAddress, setCommAddress] = useState('');
  const [permAddress, setPermAddress] = useState('');
  const [sameAsComm, setSameAsComm] = useState(true);
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');

  // Family members
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([emptyMember()]);
  const [activeMember, setActiveMember] = useState(0);
  const [memberErr, setMemberErr] = useState<MemberErr | null>(null);

  // Amount and payment
  const [customAmount, setCustomAmount] = useState<string>('1008');
  const [paying, setPaying] = useState(false);

  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dateBlockedMessage, setDateBlockedMessage] = useState('');

  const topRef = useRef<HTMLDivElement>(null);
  const paymentDone = useRef(false);

  const isCorpus = fund?.category === 'corpus';
  const isOpenAmount = !!fund && (fund.price_type === 'custom' || !(Number(fund.amount) > 0));
  const openAmountLabel = isCorpus ? tr('Part Payment', 'பகுதி கட்டணம்') : tr('Yathashakti', 'யதாசக்தி');
  const backHref = `/${locale}/donate/${encodeURIComponent(slug)}`;
  const checkoutPath = `/${locale}/donate/${encodeURIComponent(slug)}/checkout?date=${bookingDate}`;

  const usingSaved = useSaved && !!savedIds;

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const showNotice = useCallback((n: NoticeState) => {
    setNotice(n);
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, []);

  const goStep = (s: 1 | 2 | 3) => {
    setCurrentStep(s);
    setMaxStep((m) => (s > m ? s : m));
    setNotice(null);
    setTimeout(scrollTop, 50);
  };

  // Scroll to a field and put the cursor in it
  const focusField = useCallback((key: string, delay = 120) => {
    setTimeout(() => {
      const el = document.querySelector(`[data-field="${key}"]`) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = el.querySelector('input, select, textarea') as HTMLElement | null;
      input?.focus({ preventScroll: true });
    }, delay);
  }, []);

  // Remove one field's error as soon as the donor edits it
  const clearErr = (key: string) =>
    setFieldErrors((f) => {
      if (!f[key]) return f;
      const next = { ...f };
      delete next[key];
      return next;
    });

  // Show the warning banner, the red fields, and jump to the first one
  const reportErrors = (errs: Record<string, string>, order: string[], labels: Record<string, string>, extraFirst?: string) => {
    setFieldErrors(errs);
    const keys = order.filter((k) => errs[k]);
    const missing = keys.map((k) => labels[k] || k);
    setNotice({
      tone: 'error',
      text:
        tr('Please fill in the required details: ', 'தேவையான விவரங்களை நிரப்பவும்: ') +
        missing.join(', ') +
        '.',
    });
    focusField(extraFirst || keys[0]);
  };

  // 1. Load the fund (donation table only)
  useEffect(() => {
    async function loadFund() {
      try {
        setLoadingFund(true);
        const res = await fetch(`${API_BASE}/donate/funds/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.fund) setFund(data.fund as DonationFund);
        }
      } catch (err) {
        console.error('Failed to load donation fund:', err);
      } finally {
        setLoadingFund(false);
      }
    }
    loadFund();
  }, [slug, API_BASE]);

  // 2. Date sanity check
  const dateProblem = useMemo(() => {
    if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      return tr(
        'No date was selected. Please go back and choose a date from the calendar.',
        'தேதி தேர்ந்தெடுக்கப்படவில்லை. தயவுசெய்து திரும்பிச் சென்று நாள்காட்டியில் தேதியைத் தேர்ந்தெடுக்கவும்.'
      );
    }
    if (bookingDate < localYmd(new Date())) {
      return tr(
        'The selected date has already passed. Please choose another date.',
        'தேர்ந்தெடுத்த தேதி கடந்துவிட்டது. வேறு தேதியைத் தேர்ந்தெடுக்கவும்.'
      );
    }
    return '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingDate, isTa]);

  const alreadyDonatedMessage = tr(
    'You have already donated to this fund for the selected date. Please choose another date.',
    'இந்த நாளில் நீங்கள் ஏற்கெனவே இந்த நிதிக்கு நன்கொடை அளித்துள்ளீர்கள். வேறு தேதியைத் தேர்ந்தெடுக்கவும்.'
  );

  // 3. Prefill from the devotee profile (read only) and look up saved PAN / Aadhaar
  const initDonor = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const token = readToken();
    if (!token) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(checkoutPath)}`);
      return;
    }
    setDevoteeToken(token);

    // Saved PAN and Aadhaar (masked); the full numbers stay on the server
    try {
      const idRes = await fetch(`${API_BASE}/donation-booking/my-ids`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (idRes.ok) {
        const idData = await idRes.json();
        if (idData?.saved && idData.panMasked && idData.aadhaarMasked) {
          setSavedIds({ panMasked: idData.panMasked, aadhaarMasked: idData.aadhaarMasked });
          setUseSaved(true);
        }
      }
    } catch (_) {
      // The donor can still type the numbers
    }

    try {
      const res = await fetch(`${API_BASE}/devotee/profile`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const p = data?.profile;
        if (p) {
          setFirstName(p.first_name || '');
          setLastName(p.last_name || '');
          setEmail(p.email || '');
          if (p.phone) {
            const raw = String(p.phone).trim();
            const matched = COUNTRY_CODES.find((c) => raw.startsWith(c.code));
            if (matched) {
              setCountryCode(matched.code);
              setPhone(raw.slice(matched.code.length));
            } else {
              setPhone(raw.replace(/\D/g, '').slice(-10));
            }
          }
          setCommAddress(p.comm_address || '');
          setPermAddress(p.perm_address || p.comm_address || '');
          setCity(p.city || '');
          setStateName(p.state || '');

          if (Array.isArray(data.familyMembers) && data.familyMembers.length > 0) {
            const normalized: FamilyMember[] = data.familyMembers.map((m: any) => {
              const hasG = GOTHRAMS.includes(m.gothram);
              const hasN = NAKSHATHIRAMS.includes(m.nakshathiram);
              const hasR = RASIS.includes(m.rasi);
              const hasRel = RELATIONS.includes(m.relation);
              return {
                title: m.title || 'Sri',
                name: m.name || '',
                gothram: hasG ? m.gothram : m.gothram ? 'Other' : '',
                gothramOther: hasG ? '' : m.gothram || '',
                nakshathiram: hasN ? m.nakshathiram : m.nakshathiram ? 'Other' : '',
                nakshathiramOther: hasN ? '' : m.nakshathiram || '',
                rasi: hasR ? m.rasi : m.rasi ? 'Other' : '',
                rasiOther: hasR ? '' : m.rasi || '',
                relation: hasRel ? m.relation : m.relation ? 'Other' : 'Other',
                relationOther: hasRel ? '' : m.relation || '',
              };
            });
            setFamilyMembers(normalized);
          } else {
            setFamilyMembers([{ ...emptyMember(), name: [p.first_name, p.last_name].filter(Boolean).join(' ') }]);
          }
        }
      }
    } catch (_) {
      // The form can still be filled in by hand
    }
    setAuthChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, locale, router, checkoutPath]);

  useEffect(() => {
    initDonor();
  }, [initDonor]);

  // 4. Already donated on this date? (donation_booking only)
  useEffect(() => {
    if (!devoteeToken || !fund || dateProblem) return;
    const controller = new AbortController();
    fetch(`${API_BASE}/donation-booking/my-booked-dates?donationId=${encodeURIComponent(String(fund.id))}`, {
      headers: { Authorization: `Bearer ${devoteeToken}` },
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.bookedDates)) {
          const set = new Set<string>(data.bookedDates.map((d: string) => String(d).split('T')[0]));
          if (set.has(bookingDate)) setDateBlockedMessage(alreadyDonatedMessage);
        }
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devoteeToken, fund, bookingDate, dateProblem, API_BASE]);

  // Family members
  const addFamilyMember = () => {
    setFamilyMembers((prev) => [
      ...prev,
      { ...emptyMember('Spouse (மனைவி / கணவர்)'), gothram: prev[0]?.gothram || '', gothramOther: prev[0]?.gothramOther || '' },
    ]);
    setActiveMember(familyMembers.length);
    setMemberErr(null);
  };

  const removeFamilyMember = (index: number) => {
    if (familyMembers.length === 1) return;
    setFamilyMembers((prev) => prev.filter((_, i) => i !== index));
    setActiveMember((cur) => (cur > index ? cur - 1 : cur === index ? Math.max(0, index - 1) : cur));
    setMemberErr(null);
  };

  const updateFamilyMember = (index: number, field: keyof FamilyMember, val: string) => {
    setFamilyMembers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
    // Clear the red state of the field being edited
    setMemberErr((cur) => (cur && cur.index === index && (cur.field === field || cur.field === `${String(field)}Other`) ? null : cur));
  };

  const findMemberProblem = (): MemberErr | null => {
    for (let i = 0; i < familyMembers.length; i++) {
      const m = familyMembers[i];
      const prefix = `${tr('Member', 'உறுப்பினர்')} ${i + 1}: `;
      if (!m.name.trim())
        return { index: i, field: 'name', message: prefix + tr('please enter the name.', 'பெயரை உள்ளிடவும்.') };
      if (!m.gothram)
        return { index: i, field: 'gothram', message: prefix + tr('please select the gothram.', 'கோத்திரத்தைத் தேர்ந்தெடுக்கவும்.') };
      if (m.gothram === 'Other' && !(m.gothramOther || '').trim())
        return { index: i, field: 'gothramOther', message: prefix + tr('please type the gothram.', 'கோத்திரத்தை உள்ளிடவும்.') };
      if (m.nakshathiram === 'Other' && !(m.nakshathiramOther || '').trim())
        return { index: i, field: 'nakshathiramOther', message: prefix + tr('please type the nakshatram.', 'நட்சத்திரத்தை உள்ளிடவும்.') };
      if (m.rasi === 'Other' && !(m.rasiOther || '').trim())
        return { index: i, field: 'rasiOther', message: prefix + tr('please type the rasi.', 'ராசியை உள்ளிடவும்.') };
      if (m.relation === 'Other' && !(m.relationOther || '').trim())
        return { index: i, field: 'relationOther', message: prefix + tr('please specify the relation.', 'உறவுமுறையை உள்ளிடவும்.') };
    }
    return null;
  };

  const cleanedMembers = () =>
    familyMembers.map((m) => ({
      title: m.title || 'Sri',
      name: m.name.trim(),
      gothram: m.gothram === 'Other' ? m.gothramOther || 'Other' : m.gothram,
      nakshathiram: m.nakshathiram === 'Other' ? m.nakshathiramOther || 'Other' : m.nakshathiram,
      rasi: m.rasi === 'Other' ? m.rasiOther || 'Other' : m.rasi,
      relation: m.relation === 'Other' ? m.relationOther || 'Other' : m.relation,
    }));

  const finalAmount = useMemo(() => {
    if (!fund) return 0;
    if (isOpenAmount) return Number(customAmount || 0);
    return Number(fund.amount || 0);
  }, [fund, isOpenAmount, customAmount]);

  const validateAmount = (): string => {
    if (!isOpenAmount) return '';
    const n = Number(customAmount);
    if (!customAmount.trim() || !Number.isFinite(n) || n < 1) {
      return tr('Please enter an amount of ₹1 or more.', '₹1 அல்லது அதற்கு மேல் தொகையை உள்ளிடவும்.');
    }
    return '';
  };

  // Go back to a step and highlight one field with the server's message
  const jumpTo = (step: 1 | 2 | 3, key: string, message: string) => {
    goStep(step);
    setFieldErrors({ [key]: message });
    setNotice({ tone: 'error', text: message });
    focusField(key, 250);
  };

  // Pay Now
  const handlePayNow = async () => {
    if (paying) return;

    const amountErr = validateAmount();
    if (amountErr) {
      setFieldErrors({ amount: amountErr });
      setNotice({ tone: 'error', text: amountErr });
      focusField('amount');
      return;
    }
    setFieldErrors({});
    setNotice(null);
    paymentDone.current = false;
    setPaying(true);

    try {
      const sdkReady = await loadRazorpayScript();
      if (!sdkReady) {
        throw {
          message: tr(
            'Secure payment could not be loaded. Please check your internet connection and try again.',
            'பாதுகாப்பான கட்டண சேவையை ஏற்ற இயலவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.'
          ),
        };
      }

      const cleanDigits = phone.replace(/\D/g, '');
      const finalPhone = phone.trim().startsWith('+') ? phone.trim() : `${countryCode}${cleanDigits}`;

      const res = await fetch(`${API_BASE}/donation-booking/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${devoteeToken}` },
        body: JSON.stringify({
          donationId: fund?.id,
          amount: finalAmount,
          bookingDate,
          // Saved numbers stay on the server; only a flag is sent
          useSavedIds: usingSaved,
          panNumber: usingSaved ? undefined : panNumber.trim().toUpperCase(),
          aadhaarNumber: usingSaved ? undefined : aadhaar.replace(/\s/g, ''),
          familyMembers: cleanedMembers(),
          address: {
            comm: commAddress.trim(),
            perm: sameAsComm ? commAddress.trim() : permAddress.trim(),
            city: city.trim(),
            state: stateName.trim(),
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw {
          status: res.status,
          code: body?.code,
          message:
            body?.message ||
            tr('We could not start the payment. Please try again.', 'கட்டணத்தைத் தொடங்க இயலவில்லை. மீண்டும் முயற்சிக்கவும்.'),
        };
      }

      const orderData = await res.json();
      const titleForGateway = isTa ? fund?.title_ta || fund?.title_en : fund?.title_en;

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'VEDANTA SASTHRA PRACHARA TRUST',
        description: titleForGateway || '',
        order_id: orderData.orderId,
        prefill: { name: `${firstName} ${lastName}`.trim(), email: email.trim(), contact: finalPhone },
        theme: { color: '#3b0d0d' },
        modal: {
          ondismiss: function () {
            if (paymentDone.current) return;
            setPaying(false);
            showNotice({
              tone: 'info',
              text: tr(
                'The payment was not completed. You can press Pay Now to try again.',
                'கட்டணம் நிறைவடையவில்லை. மீண்டும் முயற்சிக்க "இப்போது செலுத்துக" பொத்தானை அழுத்தவும்.'
              ),
            });
          },
        },
        handler: async function (response: any) {
          paymentDone.current = true;
          const statusBase = `/${locale}/donate/booking-status`;
          try {
            const verifyRes = await fetch(`${API_BASE}/donation-booking/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${devoteeToken}` },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingId: orderData.bookingId,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (verifyData.success) {
              router.push(
                `${statusBase}?status=success&bookingId=${verifyData.bookingId || orderData.bookingId}&receiptNo=${verifyData.receiptNo}&slug=${encodeURIComponent(slug)}`
              );
            } else {
              router.push(`${statusBase}?status=failed&reason=verification_failed&slug=${encodeURIComponent(slug)}`);
            }
          } catch (_) {
            router.push(`${statusBase}?status=failed&reason=network_error&slug=${encodeURIComponent(slug)}`);
          }
        },
      };

      const instance = new (window as any).Razorpay(options);
      instance.on('payment.failed', function (resp: any) {
        const reason = resp?.error?.description;
        showNotice({
          tone: 'error',
          text: reason
            ? `${tr('Payment failed', 'கட்டணம் தோல்வியடைந்தது')}: ${reason}`
            : tr('Payment failed. Please try again.', 'கட்டணம் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.'),
        });
      });
      instance.open();
    } catch (err: any) {
      console.error('Payment start error:', err?.message || err);
      setPaying(false);

      if (err?.code === 'DONATION_ALREADY_MADE') {
        setDateBlockedMessage(alreadyDonatedMessage);
        return;
      }
      // The saved numbers are gone on the server: ask for them again
      if (err?.code === 'SAVED_IDS_MISSING') {
        setSavedIds(null);
        setUseSaved(false);
        return jumpTo(1, 'pan', err.message);
      }
      // The server checks the same details again; send the donor to the right field
      if (err?.code === 'INVALID_PAN') return jumpTo(1, 'pan', err.message);
      if (err?.code === 'INVALID_AADHAAR') return jumpTo(1, 'aadhaar', err.message);
      if (err?.code === 'INVALID_MEMBERS') {
        goStep(1);
        setNotice({ tone: 'error', text: err.message });
        focusField('m-name', 250);
        return;
      }
      if (err?.code === 'INVALID_ADDRESS') return jumpTo(2, 'commAddress', err.message);

      if (err?.status === 401) {
        showNotice({
          tone: 'error',
          text: tr('Your session has expired. Please log in again to continue.', 'உங்கள் உள்நுழைவு காலாவதியானது. தொடர மீண்டும் உள்நுழையவும்.'),
          linkHref: `/${locale}/login?redirect=${encodeURIComponent(checkoutPath)}`,
          linkLabel: tr('Log in', 'உள்நுழைக'),
        });
        return;
      }
      showNotice({
        tone: 'error',
        text: err?.message || tr('Payment could not be started. Please try again.', 'கட்டணத்தைத் தொடங்க இயலவில்லை. மீண்டும் முயற்சிக்கவும்.'),
      });
    }
  };

  // Step 1 validation: highlight, message, jump to the first problem
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!firstName.trim()) errs.firstName = tr('Please enter your first name.', 'முதல் பெயரை உள்ளிடவும்.');
    if (!lastName.trim()) errs.lastName = tr('Please enter your last name.', 'கடைசி பெயரை உள்ளிடவும்.');
    if (!email.trim()) errs.email = tr('Please enter your email address.', 'மின்னஞ்சல் முகவரியை உள்ளிடவும்.');
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = tr('Please enter a valid email address.', 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.');
    if (!phone.trim()) errs.phone = tr('Please enter your mobile number.', 'மொபைல் எண்ணை உள்ளிடவும்.');
    else if (phone.replace(/\D/g, '').length < 6) errs.phone = tr('Please enter a valid phone number.', 'சரியான மொபைல் எண்ணை உள்ளிடவும்.');

    // PAN and Aadhaar are checked only when the donor is not using the saved ones
    if (!usingSaved) {
      if (!panNumber.trim()) errs.pan = tr('PAN number is required.', 'PAN எண் அவசியம்.');
      else if (!PAN_REGEX.test(panNumber.trim().toUpperCase()))
        errs.pan = tr('Please enter a valid PAN (for example ABCDE1234F).', 'சரியான PAN எண்ணை உள்ளிடவும் (எ.கா. ABCDE1234F).');

      const aad = aadhaar.replace(/\s/g, '');
      if (!aad) errs.aadhaar = tr('Aadhaar number is required.', 'ஆதார் எண் அவசியம்.');
      else if (!isValidAadhaar(aad))
        errs.aadhaar = tr('Please enter a valid 12-digit Aadhaar number.', 'சரியான 12 இலக்க ஆதார் எண்ணை உள்ளிடவும்.');
    }

    const bad = findMemberProblem();
    setMemberErr(bad);

    const labels: Record<string, string> = {
      firstName: tr('First Name', 'முதல் பெயர்'),
      lastName: tr('Last Name', 'கடைசி பெயர்'),
      email: tr('Email', 'மின்னஞ்சல்'),
      phone: tr('Mobile Number', 'மொபைல் எண்'),
      pan: tr('PAN Number', 'PAN எண்'),
      aadhaar: tr('Aadhaar Number', 'ஆதார் எண்'),
    };

    if (Object.keys(errs).length > 0 || bad) {
      const keys = ['firstName', 'lastName', 'email', 'phone', 'pan', 'aadhaar'].filter((k) => errs[k]);
      const missing = keys.map((k) => labels[k]);
      if (bad) missing.push(bad.message.replace(/[.:]$/, ''));

      setFieldErrors(errs);
      setNotice({
        tone: 'error',
        text: tr('Please fill in the required details: ', 'தேவையான விவரங்களை நிரப்பவும்: ') + missing.join(', ') + '.',
      });

      if (keys.length > 0) {
        focusField(keys[0]);
      } else if (bad) {
        setActiveMember(bad.index);
        focusField(`m-${bad.field}`, 220);
      }
      return;
    }

    setFieldErrors({});
    goStep(2);
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!commAddress.trim()) errs.commAddress = tr('Please enter your address.', 'முகவரியை உள்ளிடவும்.');
    if (!sameAsComm && !permAddress.trim()) errs.permAddress = tr('Please enter your permanent address.', 'நிரந்தர முகவரியை உள்ளிடவும்.');
    if (!city.trim()) errs.city = tr('Please enter your city.', 'நகரத்தை உள்ளிடவும்.');
    if (!stateName.trim()) errs.state = tr('Please enter your state.', 'மாநிலத்தை உள்ளிடவும்.');

    if (Object.keys(errs).length > 0) {
      reportErrors(
        errs,
        ['commAddress', 'permAddress', 'city', 'state'],
        {
          commAddress: tr('Communication Address', 'தொடர்பு முகவரி'),
          permAddress: tr('Permanent Address', 'நிரந்தர முகவரி'),
          city: tr('City', 'நகரம்'),
          state: tr('State', 'மாநிலம்'),
        }
      );
      return;
    }
    setFieldErrors({});
    goStep(3);
  };

  const displayGothram = (m: FamilyMember) => (m.gothram === 'Other' ? m.gothramOther || 'Other' : m.gothram);
  const displayRelation = (m: FamilyMember) => (m.relation === 'Other' ? m.relationOther || 'Other' : m.relation);

  const safeActive = Math.min(activeMember, Math.max(0, familyMembers.length - 1));
  const current = familyMembers[safeActive];
  const fundTitle = isTa ? fund?.title_ta || fund?.title_en : fund?.title_en;

  const typedAadhaar = aadhaar.replace(/\s/g, '');
  const maskedAadhaar = usingSaved
    ? savedIds!.aadhaarMasked
    : typedAadhaar.length === 12
    ? `XXXX XXXX ${typedAadhaar.slice(-4)}`
    : '';
  const maskedPan = usingSaved ? savedIds!.panMasked : panNumber.length === 10 ? `XXXXXX${panNumber.slice(6)}` : '';

  // Is this member field the one currently flagged?
  const memberHas = (field: string) => !!memberErr && memberErr.index === safeActive && memberErr.field === field;
  const memberMsg = (field: string) => (memberHas(field) ? memberErr!.message : undefined);

  // Loading and blocked states
  if (!authChecked || loadingFund) {
    return (
      <main className="min-h-screen bg-cream/40 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl animate-pulse space-y-5">
          <div className="h-5 w-48 rounded bg-sand/60" />
          <div className="h-20 rounded-md bg-sand/50" />
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="h-96 rounded-md bg-sand/40" />
            <div className="h-64 rounded-md bg-sand/40" />
          </div>
          <p className="text-center text-sm font-semibold uppercase tracking-wider text-charcoal/50">
            {tr('Loading checkout details...', 'விவரங்கள் ஏற்றப்படுகின்றன...')}
          </p>
        </div>
      </main>
    );
  }

  const BlockedCard = ({ title, text, showCalendar = true }: { title: string; text: string; showCalendar?: boolean }) => (
    <main className="min-h-screen bg-cream/40 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-md border border-sand border-l-4 border-l-maroon bg-white p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-2xl font-semibold text-maroon">{title}</h1>
        <p className="mt-3 font-serif text-lg leading-relaxed text-charcoal/80">{text}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {showCalendar && (
            <Link href={backHref} className={BTN_PRIMARY}>
              {tr('Choose another date', 'வேறு தேதியைத் தேர்ந்தெடுக்க')}
            </Link>
          )}
          <Link href={`/${locale}/donate/annadhanam-corpus`} className={BTN_SECONDARY}>
            {tr('View all funds', 'அனைத்து நிதிகளையும் காண்க')}
          </Link>
        </div>
      </div>
    </main>
  );

  if (!fund) {
    return (
      <BlockedCard
        title={tr('Fund not available', 'நிதி கிடைக்கவில்லை')}
        text={tr('This donation fund is not available right now.', 'இந்த நிதி தற்போது கிடைக்கவில்லை.')}
        showCalendar={false}
      />
    );
  }
  if (dateProblem) return <BlockedCard title={tr('Date not available', 'தேதி கிடைக்கவில்லை')} text={dateProblem} />;
  if (dateBlockedMessage) return <BlockedCard title={tr('Date not available', 'தேதி கிடைக்கவில்லை')} text={dateBlockedMessage} />;

  const steps: { n: 1 | 2 | 3; en: string; ta: string }[] = [
    { n: 1, en: 'Donor & Family', ta: 'நன்கொடையாளர் & குடும்பம்' },
    { n: 2, en: 'Address', ta: 'முகவரி' },
    { n: 3, en: 'Review & Pay', ta: 'சரிபார்த்து செலுத்துக' },
  ];

  const payLabel = isTa
    ? `₹${finalAmount.toLocaleString('en-IN')} இப்போது செலுத்துக`
    : `Pay ₹${finalAmount.toLocaleString('en-IN')} Now`;

  return (
    <main className="min-h-screen bg-cream/40 px-4 py-8 text-charcoal sm:px-6 sm:py-12 lg:px-8">
      <div ref={topRef} className="mx-auto max-w-6xl scroll-mt-24 space-y-6">
        {/* Top bar */}
        <div className="flex flex-col gap-2 border-b border-sand pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href={backHref} className="text-base font-bold text-charcoal/70 underline-offset-4 hover:text-maroon hover:underline">
            {tr('Back to fund page', 'நிதி விவரப் பக்கத்திற்குத் திரும்பு')}
          </Link>
          <span className="text-sm font-bold uppercase tracking-[0.16em] text-maroon">
            {tr('Donation Checkout', 'நன்கொடை முன்பதிவு')}
          </span>
        </div>

        {/* Step bar */}
        <ol className="grid grid-cols-3 gap-2 sm:gap-4">
          {steps.map((s) => {
            const active = currentStep === s.n;
            const reachable = s.n <= maxStep;
            const done = s.n < currentStep;
            return (
              <li key={s.n}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => reachable && goStep(s.n)}
                  aria-current={active ? 'step' : undefined}
                  className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors sm:p-4 ${
                    active
                      ? 'border-maroon bg-maroon text-white'
                      : done
                      ? 'cursor-pointer border-saffron bg-white text-charcoal hover:bg-cream'
                      : reachable
                      ? 'cursor-pointer border-sand bg-white text-charcoal hover:bg-cream'
                      : 'cursor-not-allowed border-sand bg-white/60 text-charcoal/40'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold sm:h-9 sm:w-9 ${
                      active || done ? 'bg-saffron text-charcoal' : 'bg-sand/60 text-charcoal/70'
                    }`}
                  >
                    {s.n}
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span className="block text-[11px] font-bold uppercase tracking-wider opacity-70">
                      {tr('Step', 'படி')} {s.n}
                    </span>
                    <span className="block truncate text-[15px] font-bold">{tr(s.en, s.ta)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Warning banner: stays visible while the donor scrolls to the red fields */}
        {notice && (
          <div
            role="alert"
            className={`sticky top-3 z-30 flex flex-col gap-3 rounded-md border border-l-4 p-4 text-base font-semibold leading-relaxed shadow-md sm:flex-row sm:items-center sm:justify-between ${
              notice.tone === 'error'
                ? 'border-red-200 border-l-red-600 bg-red-50 text-red-800'
                : 'border-amber-300 border-l-amber-500 bg-amber-50 text-amber-900'
            }`}
          >
            <span>{notice.text}</span>
            <span className="flex shrink-0 items-center gap-4">
              {notice.linkHref && (
                <Link href={notice.linkHref} className="font-bold underline underline-offset-4">
                  {notice.linkLabel}
                </Link>
              )}
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="cursor-pointer text-sm font-bold uppercase tracking-wider opacity-70 hover:opacity-100"
              >
                {tr('Dismiss', 'மூடு')}
              </button>
            </span>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* LEFT: STEPS */}
          <div className="min-w-0">
            {/* STEP 1: donor, PAN, Aadhaar, family */}
            {currentStep === 1 && (
              <form onSubmit={handleStep1Submit} noValidate className="space-y-6">
                <div className={`${CARD} space-y-5`}>
                  <SectionTitle
                    title={tr('Donor Details', 'நன்கொடையாளர் விவரங்கள்')}
                    hint={tr('Fields marked * are required.', '* குறிக்கப்பட்ட விவரங்கள் அவசியம்.')}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field name="firstName" label={tr('First Name *', 'முதல் பெயர் *')} error={fieldErrors.firstName}>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value);
                          clearErr('firstName');
                        }}
                        className={inputClass(!!fieldErrors.firstName)}
                        autoComplete="given-name"
                      />
                    </Field>
                    <Field name="lastName" label={tr('Last Name *', 'கடைசி பெயர் *')} error={fieldErrors.lastName}>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => {
                          setLastName(e.target.value);
                          clearErr('lastName');
                        }}
                        className={inputClass(!!fieldErrors.lastName)}
                        autoComplete="family-name"
                      />
                    </Field>
                  </div>

                  <Field name="email" label={tr('Email Address *', 'மின்னஞ்சல் முகவரி *')} error={fieldErrors.email}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearErr('email');
                      }}
                      className={inputClass(!!fieldErrors.email)}
                      autoComplete="email"
                    />
                  </Field>

                  <Field name="phone" label={tr('Mobile Number *', 'மொபைல் எண் *')} error={fieldErrors.phone}>
                    <div className="flex gap-2">
                      <div className="w-36 shrink-0 sm:w-48">
                        <Select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                          {COUNTRY_CODES.map((c) => (
                            <option key={`${c.code}-${c.country}`} value={c.code}>
                              {c.label || `${c.country} (${c.code})`}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value.replace(/[^\d\s]/g, '').slice(0, 14));
                          clearErr('phone');
                        }}
                        className={inputClass(!!fieldErrors.phone)}
                        autoComplete="tel-national"
                      />
                    </div>
                  </Field>

                  {/* PAN and Aadhaar: saved numbers, or new ones */}
                  {usingSaved ? (
                    <div className="space-y-3 border-t border-sand pt-5">
                      <div className="rounded-md border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50 p-4">
                        <p className="text-sm font-bold uppercase tracking-wider text-emerald-800">
                          {tr('Saved PAN and Aadhaar', 'சேமிக்கப்பட்ட PAN மற்றும் ஆதார்')}
                        </p>
                        <dl className="mt-2 grid grid-cols-1 gap-2 text-base font-semibold text-charcoal sm:grid-cols-2">
                          <div>
                            <dt className="text-[11px] font-bold uppercase tracking-wider text-charcoal/55">PAN</dt>
                            <dd className="font-mono">{savedIds!.panMasked}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-bold uppercase tracking-wider text-charcoal/55">{tr('Aadhaar', 'ஆதார்')}</dt>
                            <dd className="font-mono">{savedIds!.aadhaarMasked}</dd>
                          </div>
                        </dl>
                        <p className="mt-2 text-sm text-charcoal/65">
                          {tr(
                            'These were saved from your earlier donation. You do not need to enter them again.',
                            'இவை உங்கள் முந்தைய நன்கொடையில் சேமிக்கப்பட்டன. மீண்டும் உள்ளிட வேண்டியதில்லை.'
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUseSaved(false);
                          setPanNumber('');
                          setAadhaar('');
                        }}
                        className="cursor-pointer text-[15px] font-bold text-maroon underline-offset-4 hover:underline"
                      >
                        {tr('Use different numbers', 'வேறு எண்களைப் பயன்படுத்த')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-4 border-t border-sand pt-5 sm:grid-cols-2">
                        <Field name="pan" label={tr('PAN Number *', 'PAN எண் *')} error={fieldErrors.pan}>
                          <input
                            type="text"
                            value={panNumber}
                            onChange={(e) => {
                              setPanNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10));
                              clearErr('pan');
                            }}
                            placeholder="ABCDE1234F"
                            className={inputClass(!!fieldErrors.pan)}
                            autoComplete="off"
                          />
                        </Field>
                        <Field name="aadhaar" label={tr('Aadhaar Number *', 'ஆதார் எண் *')} error={fieldErrors.aadhaar}>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={aadhaar}
                            onChange={(e) => {
                              setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12));
                              clearErr('aadhaar');
                            }}
                            placeholder="12-digit Aadhaar"
                            className={inputClass(!!fieldErrors.aadhaar)}
                            autoComplete="off"
                          />
                        </Field>
                      </div>
                      <p className="text-sm leading-relaxed text-charcoal/65">
                        {tr(
                          'PAN and Aadhaar are required for the donation receipt. They are saved for your next donation. Your Aadhaar number is stored encrypted and is shown only as the last 4 digits.',
                          'நன்கொடை ரசீதுக்கு PAN மற்றும் ஆதார் தேவை. அடுத்த நன்கொடைக்காக அவை சேமிக்கப்படும். உங்கள் ஆதார் எண் குறியாக்கம் செய்து சேமிக்கப்படும்; கடைசி 4 இலக்கங்கள் மட்டுமே காட்டப்படும்.'
                        )}
                      </p>
                      {savedIds && (
                        <button
                          type="button"
                          onClick={() => {
                            setUseSaved(true);
                            clearErr('pan');
                            clearErr('aadhaar');
                          }}
                          className="cursor-pointer text-[15px] font-bold text-maroon underline-offset-4 hover:underline"
                        >
                          {tr('Use my saved PAN and Aadhaar', 'சேமித்த PAN மற்றும் ஆதாரைப் பயன்படுத்த')}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Family members */}
                <div className={`${CARD} space-y-5`}>
                  <SectionTitle
                    title={tr('Family Members', 'குடும்ப உறுப்பினர்கள்')}
                    hint={tr(
                      'Names to be included in the sankalpam for this donation.',
                      'இந்த நன்கொடைக்கான சங்கல்பத்தில் சேர்க்கப்பட வேண்டிய நபர்களை உள்ளிடவும்.'
                    )}
                  />

                  <div className="flex flex-wrap gap-2">
                    {familyMembers.map((m, i) => {
                      const on = i === safeActive;
                      const flagged = memberErr?.index === i;
                      const label = m.name.trim() || `${tr('Member', 'உறுப்பினர்')} ${i + 1}`;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveMember(i)}
                          className={`min-h-[44px] max-w-[14rem] cursor-pointer truncate rounded-md border px-4 text-[15px] font-bold transition-colors ${
                            flagged
                              ? on
                                ? 'border-red-600 bg-red-600 text-white'
                                : 'border-red-500 bg-red-50 text-red-700'
                              : on
                              ? 'border-maroon bg-maroon text-white'
                              : 'border-sand bg-white text-charcoal hover:border-maroon hover:text-maroon'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={addFamilyMember}
                      className="min-h-[44px] cursor-pointer rounded-md border border-dashed border-maroon bg-white px-4 text-[15px] font-bold text-maroon transition-colors hover:bg-cream"
                    >
                      + {tr('Add Member', 'உறுப்பினர் சேர்')}
                    </button>
                  </div>

                  {memberErr && (
                    <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-base font-semibold text-red-700">
                      {memberErr.message}
                    </p>
                  )}

                  {current && (
                    <div className="space-y-4 rounded-md border border-sand bg-cream/50 p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold uppercase tracking-wider text-charcoal/70">
                          {tr(`Member ${safeActive + 1} of ${familyMembers.length}`, `உறுப்பினர் ${safeActive + 1} / ${familyMembers.length}`)}
                        </span>
                        {familyMembers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFamilyMember(safeActive)}
                            className="cursor-pointer text-sm font-bold text-red-700 underline-offset-4 hover:underline"
                          >
                            {tr('Remove', 'நீக்கு')}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-[110px_1fr] gap-3">
                        <Field label={tr('Title', 'தலைப்பு')}>
                          <Select value={current.title} onChange={(e) => updateFamilyMember(safeActive, 'title', e.target.value)}>
                            <option value="Sri">Sri</option>
                            <option value="Smt">Smt</option>
                            <option value="Kum">Kum</option>
                            <option value="Master">Master</option>
                            <option value="Chi">Chi</option>
                          </Select>
                        </Field>
                        <Field name="m-name" label={tr('Full Name *', 'பெயர் *')} error={memberMsg('name')}>
                          <input
                            type="text"
                            value={current.name}
                            onChange={(e) => updateFamilyMember(safeActive, 'name', e.target.value)}
                            placeholder="e.g. Sundaresan"
                            className={inputClass(memberHas('name'))}
                          />
                        </Field>
                      </div>

                      <div>
                        <Field name="m-gothram" label={tr('Gothram *', 'கோத்திரம் *')} error={memberMsg('gothram')}>
                          <Select
                            hasError={memberHas('gothram')}
                            value={current.gothram}
                            onChange={(e) => updateFamilyMember(safeActive, 'gothram', e.target.value)}
                          >
                            <option value="">{tr('-- Select Gothram --', '-- கோத்திரம் தேர்வு --')}</option>
                            {GOTHRAMS.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </Select>
                        </Field>
                        {current.gothram === 'Other' && (
                          <div data-field="m-gothramOther" className="mt-2 scroll-mt-32">
                            <input
                              type="text"
                              value={current.gothramOther || ''}
                              onChange={(e) => updateFamilyMember(safeActive, 'gothramOther', e.target.value)}
                              placeholder="Type Gothram..."
                              className={inputClass(memberHas('gothramOther'))}
                            />
                            {memberHas('gothramOther') && (
                              <p role="alert" className="mt-1.5 text-sm font-semibold text-red-700">{memberErr!.message}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Field label={tr('Nakshatram', 'நட்சத்திரம்')}>
                            <Select value={current.nakshathiram} onChange={(e) => updateFamilyMember(safeActive, 'nakshathiram', e.target.value)}>
                              <option value="">{tr('-- Select Nakshatram --', '-- நட்சத்திரம் தேர்வு --')}</option>
                              {NAKSHATHIRAMS.map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </Select>
                          </Field>
                          {current.nakshathiram === 'Other' && (
                            <div data-field="m-nakshathiramOther" className="mt-2 scroll-mt-32">
                              <input
                                type="text"
                                value={current.nakshathiramOther || ''}
                                onChange={(e) => updateFamilyMember(safeActive, 'nakshathiramOther', e.target.value)}
                                placeholder="Type Nakshatram..."
                                className={inputClass(memberHas('nakshathiramOther'))}
                              />
                              {memberHas('nakshathiramOther') && (
                                <p role="alert" className="mt-1.5 text-sm font-semibold text-red-700">{memberErr!.message}</p>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <Field label={tr('Rasi', 'ராசி')}>
                            <Select value={current.rasi} onChange={(e) => updateFamilyMember(safeActive, 'rasi', e.target.value)}>
                              <option value="">{tr('-- Select Rasi --', '-- ராசி தேர்வு --')}</option>
                              {RASIS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </Select>
                          </Field>
                          {current.rasi === 'Other' && (
                            <div data-field="m-rasiOther" className="mt-2 scroll-mt-32">
                              <input
                                type="text"
                                value={current.rasiOther || ''}
                                onChange={(e) => updateFamilyMember(safeActive, 'rasiOther', e.target.value)}
                                placeholder="Type Rasi..."
                                className={inputClass(memberHas('rasiOther'))}
                              />
                              {memberHas('rasiOther') && (
                                <p role="alert" className="mt-1.5 text-sm font-semibold text-red-700">{memberErr!.message}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <Field label={tr('Relation', 'உறவுமுறை')}>
                          <Select value={current.relation} onChange={(e) => updateFamilyMember(safeActive, 'relation', e.target.value)}>
                            {RELATIONS.map((rel) => (
                              <option key={rel} value={rel}>{rel}</option>
                            ))}
                          </Select>
                        </Field>
                        {current.relation === 'Other' && (
                          <div data-field="m-relationOther" className="mt-2 scroll-mt-32">
                            <input
                              type="text"
                              value={current.relationOther || ''}
                              onChange={(e) => updateFamilyMember(safeActive, 'relationOther', e.target.value)}
                              placeholder="Specify Relation..."
                              className={inputClass(memberHas('relationOther'))}
                            />
                            {memberHas('relationOther') && (
                              <p role="alert" className="mt-1.5 text-sm font-semibold text-red-700">{memberErr!.message}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button type="submit" className={`${BTN_MAROON} w-full sm:w-auto`}>
                    {tr('Continue to Step 2: Address', 'தொடர்க: படி 2 (முகவரி)')}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: address */}
            {currentStep === 2 && (
              <form onSubmit={handleStep2Submit} noValidate className="space-y-6">
                <div className={`${CARD} space-y-5`}>
                  <SectionTitle
                    title={tr('Donor Address', 'நன்கொடையாளர் முகவரி')}
                    hint={tr('This address is printed on your receipt. Fields marked * are required.', 'இந்த முகவரி உங்கள் ரசீதில் இடம்பெறும். * குறிக்கப்பட்டவை அவசியம்.')}
                  />

                  <Field name="commAddress" label={tr('Communication Address *', 'தொடர்பு முகவரி *')} error={fieldErrors.commAddress}>
                    <textarea
                      rows={3}
                      value={commAddress}
                      onChange={(e) => {
                        setCommAddress(e.target.value);
                        clearErr('commAddress');
                      }}
                      placeholder="Door No, Street Name, Area..."
                      className={textareaClass(!!fieldErrors.commAddress)}
                    />
                  </Field>

                  <label className="flex cursor-pointer items-center gap-3 text-base font-semibold text-charcoal">
                    <input
                      type="checkbox"
                      checked={sameAsComm}
                      onChange={(e) => setSameAsComm(e.target.checked)}
                      className="h-5 w-5 cursor-pointer accent-maroon"
                    />
                    <span>{tr('Permanent address is same as communication address', 'தொடர்பு முகவரியே நிரந்தர முகவரி')}</span>
                  </label>

                  {!sameAsComm && (
                    <Field name="permAddress" label={tr('Permanent Address *', 'நிரந்தர முகவரி *')} error={fieldErrors.permAddress}>
                      <textarea
                        rows={3}
                        value={permAddress}
                        onChange={(e) => {
                          setPermAddress(e.target.value);
                          clearErr('permAddress');
                        }}
                        placeholder="Permanent family address..."
                        className={textareaClass(!!fieldErrors.permAddress)}
                      />
                    </Field>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field name="city" label={tr('City *', 'நகரம் *')} error={fieldErrors.city}>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => {
                          setCity(e.target.value);
                          clearErr('city');
                        }}
                        className={inputClass(!!fieldErrors.city)}
                      />
                    </Field>
                    <Field name="state" label={tr('State *', 'மாநிலம் *')} error={fieldErrors.state}>
                      <input
                        type="text"
                        value={stateName}
                        onChange={(e) => {
                          setStateName(e.target.value);
                          clearErr('state');
                        }}
                        className={inputClass(!!fieldErrors.state)}
                      />
                    </Field>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button type="button" onClick={() => goStep(1)} className={`${BTN_SECONDARY} w-full sm:w-auto`}>
                    {tr('Back to Step 1', 'முந்தைய படி')}
                  </button>
                  <button type="submit" className={`${BTN_MAROON} w-full sm:w-auto`}>
                    {tr('Continue to Step 3: Review & Pay', 'தொடர்க: படி 3 (சரிபார்த்து செலுத்துக)')}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: review and pay */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className={`${CARD} space-y-6`}>
                  <SectionTitle
                    title={tr('Review & Payment', 'விவரங்கள் சரிபார்ப்பு')}
                    hint={tr('Please check your details before paying.', 'செலுத்துவதற்கு முன் விவரங்களைச் சரிபார்க்கவும்.')}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1 rounded-md border border-sand bg-cream/50 p-4">
                      <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal/55">
                        {tr('Donor', 'நன்கொடையாளர்')}
                      </span>
                      <p className="text-lg font-bold text-maroon">{firstName} {lastName}</p>
                      <p className="text-[15px] text-charcoal/80">{countryCode} {phone}</p>
                      <p className="break-all text-[15px] text-charcoal/80">{email}</p>
                      <p className="pt-1 text-sm font-semibold text-charcoal/70">PAN: {maskedPan}</p>
                      <p className="text-sm font-semibold text-charcoal/70">{tr('Aadhaar', 'ஆதார்')}: {maskedAadhaar}</p>
                    </div>

                    <div className="space-y-1 rounded-md border border-sand bg-cream/50 p-4">
                      <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal/55">
                        {tr('Address', 'முகவரி')}
                      </span>
                      <p className="text-[15px] font-semibold text-charcoal">{commAddress}</p>
                      <p className="text-[15px] text-charcoal/80">{city}, {stateName}</p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-sand pt-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold uppercase tracking-[0.14em] text-maroon">
                        {tr('Family Members', 'குடும்ப உறுப்பினர்கள்')}
                      </span>
                      <button
                        type="button"
                        onClick={() => goStep(1)}
                        className="cursor-pointer text-[15px] font-bold text-maroon underline-offset-4 hover:underline"
                      >
                        {tr('Edit', 'திருத்து')}
                      </button>
                    </div>
                    <ul className="divide-y divide-sand/70">
                      {familyMembers.map((m, i) => (
                        <li key={i} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-base font-bold text-charcoal">{m.title}. {m.name}</span>
                          <span className="text-sm text-charcoal/65">
                            {[displayGothram(m), m.nakshathiram === 'Other' ? m.nakshathiramOther : m.nakshathiram, displayRelation(m)]
                              .filter(Boolean)
                              .join(' | ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {isOpenAmount && (
                    <div
                      data-field="amount"
                      className={`scroll-mt-32 space-y-3 rounded-md border p-4 sm:p-5 ${
                        fieldErrors.amount ? 'border-red-500 bg-red-50' : 'border-saffron bg-saffron/10'
                      }`}
                    >
                      <label className="block text-base font-bold text-charcoal" htmlFor="donation-amount">
                        {tr('Enter Donation Amount (₹ INR) *', 'நன்கொடைத் தொகை (₹ INR) *')}
                      </label>
                      <input
                        id="donation-amount"
                        type="number"
                        inputMode="decimal"
                        min="1"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          clearErr('amount');
                        }}
                        className={`${inputClass(!!fieldErrors.amount)} sm:w-64 !text-xl font-bold`}
                      />
                      {fieldErrors.amount && (
                        <p role="alert" className="text-sm font-semibold text-red-700">{fieldErrors.amount}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {QUICK_AMOUNTS.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => {
                              setCustomAmount(amt);
                              clearErr('amount');
                            }}
                            className={`min-h-[44px] cursor-pointer rounded-md border px-4 text-[15px] font-bold transition-colors ${
                              customAmount === amt
                                ? 'border-maroon bg-maroon text-white'
                                : 'border-sand bg-white text-charcoal hover:border-maroon hover:text-maroon'
                            }`}
                          >
                            ₹{Number(amt).toLocaleString('en-IN')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-end justify-between border-t border-sand pt-5">
                    <span className="text-lg font-bold text-charcoal">{tr('Total Amount', 'மொத்தத் தொகை')}</span>
                    <span className="text-3xl font-bold text-maroon">₹ {finalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="button" onClick={() => goStep(2)} disabled={paying} className={`${BTN_SECONDARY} w-full sm:w-auto`}>
                    {tr('Back to Step 2', 'முந்தைய படி')}
                  </button>
                  <button type="button" disabled={paying} onClick={handlePayNow} className={`${BTN_PRIMARY} w-full flex-1 text-lg`}>
                    {paying ? tr('Processing...', 'செயலாக்கப்படுகிறது...') : payLabel}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: SUMMARY */}
          <aside className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-md border border-sand bg-white shadow-md">
              <div className="border-t-4 border-saffron bg-maroon px-5 py-5 text-white sm:px-6">
                <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-saffron">
                  {tr('Selected Fund', 'தேர்ந்தெடுக்கப்பட்ட நிதி')}
                </span>
                <h1 className="mt-2 font-display text-xl font-semibold leading-snug text-white sm:text-2xl [html[lang='ta']_&]:leading-[1.4]">
                  {fundTitle}
                </h1>
                <span className="mt-3 inline-block rounded-sm border border-saffron px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-saffron">
                  {fund.category === 'corpus'
                    ? tr('Corpus Fund', 'மூலதன நிதி')
                    : fund.category === 'ashram'
                    ? tr('Ashram', 'ஆசிரமம்')
                    : tr('Donation', 'நன்கொடை')}
                </span>
              </div>

              <dl className="space-y-4 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-sm font-bold uppercase tracking-wider text-charcoal/55">{tr('Donation Date', 'நன்கொடை நாள்')}</dt>
                  <dd className="text-right text-lg font-bold text-maroon">{formatDisplayDate(bookingDate)}</dd>
                </div>

                <div className="flex items-start justify-between gap-4 border-t border-sand pt-4">
                  <dt className="text-sm font-bold uppercase tracking-wider text-charcoal/55">{tr('Amount', 'தொகை')}</dt>
                  <dd className="text-right text-lg font-bold text-charcoal">
                    {isOpenAmount ? openAmountLabel : rupees(fund.amount || 0)}
                  </dd>
                </div>

                <div className="flex items-start justify-between gap-4 border-t border-sand pt-4">
                  <dt className="text-sm font-bold uppercase tracking-wider text-charcoal/55">{tr('Family Members', 'உறுப்பினர்கள்')}</dt>
                  <dd className="text-right text-lg font-bold text-charcoal">{familyMembers.length}</dd>
                </div>

                <div className="flex items-end justify-between gap-4 border-t-2 border-maroon pt-4">
                  <dt className="text-base font-bold text-charcoal">{tr('Total', 'மொத்தம்')}</dt>
                  <dd className="text-3xl font-bold text-maroon">₹ {finalAmount.toLocaleString('en-IN')}</dd>
                </div>
              </dl>

              <p className="border-t border-sand bg-cream/50 px-5 py-3 text-center text-sm leading-relaxed text-charcoal/65 sm:px-6">
                {tr(
                  'Secure online payment. A receipt is available after payment is confirmed.',
                  'பாதுகாப்பான இணையவழி கட்டணம். கட்டணம் உறுதியான பின் ரசீது கிடைக்கும்.'
                )}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}