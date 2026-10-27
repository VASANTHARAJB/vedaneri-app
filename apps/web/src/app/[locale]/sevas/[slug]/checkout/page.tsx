'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { COUNTRY_CODES } from '@/data/countryCodes';
import { loadRazorpayScript } from '@/lib/razorpay';
import { rupees } from '@/lib/format';

export interface BookingOffering {
  id: string | number;
  slug: string;
  title_en: string;
  title_ta: string;
  description_en?: string;
  description_ta?: string;
  amount: number;
  price_type: 'fixed' | 'custom';
  category: 'seva' | 'corpus';
  status: 'published' | 'draft';
  image_url?: string;
  recurrence_type?: 'none' | 'annual' | 'monthly_tithi';
  event_date?: string | null;
  tithi_trigger?: string;
  panchangam_tag?: string;
}

interface FamilyMember {
  id?: number;
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

const INPUT_BASE =
  'h-12 w-full rounded-md border bg-white px-4 text-base text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-saffron/40';
const inputClass = (hasError?: boolean) =>
  `${INPUT_BASE} ${hasError ? 'border-red-500 focus:border-red-600' : 'border-sand focus:border-maroon'}`;
const TEXTAREA_BASE =
  'w-full rounded-md border bg-white px-4 py-3 text-base text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-saffron/40';
const textareaClass = (hasError?: boolean) =>
  `${TEXTAREA_BASE} ${hasError ? 'border-red-500 focus:border-red-600' : 'border-sand focus:border-maroon'}`;

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
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-bold text-charcoal">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-sm font-semibold text-red-700">{error}</span>}
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

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const clean = String(dateStr).split('T')[0];
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

export default function SevaCheckoutPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const locale = (params.locale as string) || 'en';
  const slug = params.slug as string;
  const isTa = locale === 'ta';
  const bookingDate = (searchParams.get('date') || '').split('T')[0];
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

  const tr = (en: string, ta: string) => (isTa ? ta : en);

  // Step: 1 = Devotee & Sankalpam, 2 = Address, 3 = Review & Pay
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [maxStep, setMaxStep] = useState<1 | 2 | 3>(1);
  const [loadingSeva, setLoadingSeva] = useState(true);
  const [seva, setSeva] = useState<BookingOffering | null>(null);

  // Auth
  const [devoteeToken, setDevoteeToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Personal details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [primaryGothram, setPrimaryGothram] = useState('');
  const [primaryGothramOther, setPrimaryGothramOther] = useState('');
  const [primaryNakshathiram, setPrimaryNakshathiram] = useState('');
  const [primaryNakshathiramOther, setPrimaryNakshathiramOther] = useState('');
  const [primaryRasi, setPrimaryRasi] = useState('');
  const [primaryRasiOther, setPrimaryRasiOther] = useState('');

  // Address
  const [residency, setResidency] = useState<'indian' | 'nri'>('indian');
  const [commAddress, setCommAddress] = useState('');
  const [permAddress, setPermAddress] = useState('');
  const [sameAsComm, setSameAsComm] = useState(true);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Family members
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [activeMember, setActiveMember] = useState(0);
  const [memberError, setMemberError] = useState('');

  // Amount and payment
  const [customAmount, setCustomAmount] = useState<string>('1008');
  const [paying, setPaying] = useState(false);
  const [cartAdding, setCartAdding] = useState(false);

  // Messages (replace browser pop-ups)
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dateBlockedMessage, setDateBlockedMessage] = useState('');

  const topRef = useRef<HTMLDivElement>(null);
  const paymentDone = useRef(false);

  const isCorpus = seva?.category === 'corpus';
  const isOpenAmount = !!seva && (seva.price_type === 'custom' || !(Number(seva.amount) > 0));

  const openAmountLabel = isCorpus ? tr('Part Payment', 'பகுதி கட்டணம்') : tr('Yathashakti', 'யதாசக்தி');
  const dateLabel = isCorpus ? tr('Contribution Date', 'பங்களிப்பு நாள்') : tr('Pooja Date', 'பூஜை நாள்');
  const calendarHref = `/${locale}/sevas/${slug}`;

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

  // ---------------------------------------------------------------
  // 1. Load offering
  // ---------------------------------------------------------------
  useEffect(() => {
    async function loadSeva() {
      try {
        setLoadingSeva(true);
        const res = await fetch(`${API_BASE}/offerings`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const list: BookingOffering[] = data.sevas || data.offerings || [];
          const found = list.find((it) => it.slug === slug || String(it.id) === slug);
          if (found && found.status === 'published') setSeva(found);
        }
      } catch (err) {
        console.error('Failed to load offering details:', err);
      } finally {
        setLoadingSeva(false);
      }
    }
    loadSeva();
  }, [slug, API_BASE]);

  // ---------------------------------------------------------------
  // 2. Date sanity check (missing, malformed or past)
  // ---------------------------------------------------------------
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

  const alreadyPaidMessage = (corpus: boolean) =>
    corpus
      ? tr(
          'You have already contributed to this fund on the selected date. Please choose another date.',
          'இந்த நாளில் நீங்கள் ஏற்கெனவே இந்த நிதிக்குப் பங்களித்துள்ளீர்கள். வேறு தேதியைத் தேர்ந்தெடுக்கவும்.'
        )
      : tr(
          'You have already booked this seva for the selected date. Please choose another date.',
          'இந்த நாளில் நீங்கள் ஏற்கெனவே இந்த சேவையை முன்பதிவு செய்துள்ளீர்கள். வேறு தேதியைத் தேர்ந்தெடுக்கவும்.'
        );

  // ---------------------------------------------------------------
  // 3. Profile + auto-fill
  // ---------------------------------------------------------------
  const fetchProfileApi = useCallback(
    async (token: string) => {
      let res = await fetch(`${API_BASE}/devotee/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`${API_BASE}/devotees/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);
      }

      if (res && res.ok) return await res.json();
      return null;
    },
    [API_BASE]
  );

  const initDevoteeData = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const token = readToken();
    if (!token) {
      router.push(
        `/${locale}/login?redirect=${encodeURIComponent(`/${locale}/sevas/${slug}/checkout?date=${bookingDate}`)}`
      );
      return;
    }

    setDevoteeToken(token);

    const data = await fetchProfileApi(token);

    if (data && data.profile) {
      const p = data.profile;
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
      setState(p.state || '');
      setResidency(p.residency || 'indian');

      if (Array.isArray(data.familyMembers) && data.familyMembers.length > 0) {
        const normalized: FamilyMember[] = data.familyMembers.map((m: any) => {
          const hasG = GOTHRAMS.includes(m.gothram);
          const hasN = NAKSHATHIRAMS.includes(m.nakshathiram);
          const hasR = RASIS.includes(m.rasi);
          const hasRel = RELATIONS.includes(m.relation);

          return {
            ...m,
            name: m.name || '',
            title: m.title || 'Sri',
            gothram: hasG ? m.gothram : m.gothram ? 'Other' : '',
            gothramOther: hasG ? '' : m.gothram || '',
            nakshathiram: hasN ? m.nakshathiram : m.nakshathiram ? 'Other' : '',
            nakshathiramOther: hasN ? '' : m.nakshathiram || '',
            rasi: hasR ? m.rasi : m.rasi ? 'Other' : '',
            rasiOther: hasR ? '' : m.rasi || '',
            relation: hasRel ? m.relation : m.relation ? 'Other' : 'Family',
            relationOther: hasRel ? '' : m.relation || '',
          };
        });

        setFamilyMembers(normalized);
        setActiveMember(0);

        const selfMember = normalized.find((m) => String(m.relation).includes('Self')) || normalized[0];
        if (selfMember) {
          setPrimaryGothram(selfMember.gothram);
          setPrimaryGothramOther(selfMember.gothramOther || '');
          setPrimaryNakshathiram(selfMember.nakshathiram);
          setPrimaryNakshathiramOther(selfMember.nakshathiramOther || '');
          setPrimaryRasi(selfMember.rasi);
          setPrimaryRasiOther(selfMember.rasiOther || '');
        }
      } else {
        setFamilyMembers([
          {
            title: 'Sri',
            name: [p.first_name, p.last_name].filter(Boolean).join(' ') || '',
            gothram: '',
            nakshathiram: '',
            rasi: '',
            relation: 'Self (சுய விவரம்)',
          },
        ]);
      }
    } else {
      // No profile available: start with one empty member so the form is never blank
      setFamilyMembers([
        { title: 'Sri', name: '', gothram: '', nakshathiram: '', rasi: '', relation: 'Self (சுய விவரம்)' },
      ]);
    }

    setAuthChecked(true);
  }, [bookingDate, fetchProfileApi, locale, router, slug]);

  useEffect(() => {
    initDevoteeData();
  }, [initDevoteeData]);

  // ---------------------------------------------------------------
  // 4. Is this date already paid by this devotee? (checked up front)
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!devoteeToken || !seva || dateProblem) return;
    const controller = new AbortController();
    fetch(`${API_BASE}/payment/seva/my-booked-dates?sevaId=${encodeURIComponent(String(seva.id))}`, {
      headers: { Authorization: `Bearer ${devoteeToken}` },
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.bookedDates)) {
          const set = new Set<string>(data.bookedDates.map((d: string) => String(d).split('T')[0]));
          if (set.has(bookingDate)) {
            setDateBlockedMessage(alreadyPaidMessage(seva.category === 'corpus'));
          }
        }
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devoteeToken, seva, bookingDate, dateProblem, API_BASE]);

  // ---------------------------------------------------------------
  // Family members
  // ---------------------------------------------------------------
  const addFamilyMember = () => {
    setFamilyMembers((prev) => [
      ...prev,
      {
        title: 'Sri',
        name: '',
        gothram: primaryGothram || prev[0]?.gothram || '',
        gothramOther: primaryGothramOther || prev[0]?.gothramOther || '',
        nakshathiram: '',
        rasi: '',
        relation: 'Spouse (மனைவி / கணவர்)',
      },
    ]);
    setActiveMember(familyMembers.length);
    setMemberError('');
  };

  const removeFamilyMember = (index: number) => {
    if (familyMembers.length === 1) return;
    setFamilyMembers((prev) => prev.filter((_, i) => i !== index));
    setActiveMember((cur) => (cur > index ? cur - 1 : cur === index ? Math.max(0, index - 1) : cur));
    setMemberError('');
  };

  const updateFamilyMember = (index: number, field: keyof FamilyMember, val: string) => {
    setFamilyMembers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const finalAmount = useMemo(() => {
    if (!seva) return 0;
    if (isOpenAmount) return Number(customAmount || 0);
    return Number(seva.amount || 0);
  }, [seva, isOpenAmount, customAmount]);

  const findMemberProblem = (): { index: number; message: string } | null => {
    for (let i = 0; i < familyMembers.length; i++) {
      const m = familyMembers[i];
      let problem = '';
      if (!m.name.trim()) {
        problem = tr('please enter the name', 'பெயரை உள்ளிடவும்');
      } else if (!m.gothram) {
        problem = tr('please select the gothram', 'கோத்திரத்தைத் தேர்ந்தெடுக்கவும்');
      } else if (m.gothram === 'Other' && !(m.gothramOther || '').trim()) {
        problem = tr('please type the gothram', 'கோத்திரத்தை உள்ளிடவும்');
      } else if (m.nakshathiram === 'Other' && !(m.nakshathiramOther || '').trim()) {
        problem = tr('please type the nakshatram', 'நட்சத்திரத்தை உள்ளிடவும்');
      } else if (m.rasi === 'Other' && !(m.rasiOther || '').trim()) {
        problem = tr('please type the rasi', 'ராசியை உள்ளிடவும்');
      } else if (m.relation === 'Other' && !(m.relationOther || '').trim()) {
        problem = tr('please specify the relation', 'உறவுமுறையை உள்ளிடவும்');
      }
      if (problem) {
        return { index: i, message: `${tr('Member', 'உறுப்பினர்')} ${i + 1}: ${problem}` };
      }
    }
    return null;
  };

  // ---------------------------------------------------------------
  // Save profile back to the database
  // ---------------------------------------------------------------
  const syncProfileToDb = async () => {
    const finalPermAddress = sameAsComm ? commAddress : permAddress;
    const cleanPhoneDigits = phone.replace(/\D/g, '');
    const finalPhone = phone.trim().startsWith('+') ? phone.trim() : `${countryCode}${cleanPhoneDigits}`;

    const cleanedMembers = familyMembers.map((m) => ({
      title: m.title || 'Sri',
      name: m.name.trim(),
      gothram: m.gothram === 'Other' ? m.gothramOther || 'Other' : m.gothram,
      nakshathiram: m.nakshathiram === 'Other' ? m.nakshathiramOther || 'Other' : m.nakshathiram,
      rasi: m.rasi === 'Other' ? m.rasiOther || 'Other' : m.rasi,
      relation: m.relation === 'Other' ? m.relationOther || 'Other' : m.relation,
    }));

    const payload = {
      first_name: firstName,
      last_name: lastName,
      email,
      country_code: countryCode,
      phone: finalPhone,
      residency,
      comm_address: commAddress,
      perm_address: finalPermAddress,
      city,
      state,
      family_members: cleanedMembers,
    };

    const res = await fetch(`${API_BASE}/devotee/save-booking-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${devoteeToken}` },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!res || !res.ok) {
      await fetch(`${API_BASE}/devotees/save-booking-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${devoteeToken}` },
        body: JSON.stringify(payload),
      }).catch(() => null);
    }

    return { finalPhone, cleanedMembers };
  };

  const validateAmount = (): string => {
    if (!isOpenAmount) return '';
    const n = Number(customAmount);
    if (!customAmount.trim() || !Number.isFinite(n) || n < 1) {
      return tr('Please enter an amount of ₹1 or more.', '₹1 அல்லது அதற்கு மேல் தொகையை உள்ளிடவும்.');
    }
    return '';
  };

  // ---------------------------------------------------------------
  // Pay Now
  // ---------------------------------------------------------------
  const handlePayNow = async () => {
    if (paying || cartAdding) return;

    const amountErr = validateAmount();
    if (amountErr) {
      setFieldErrors({ amount: amountErr });
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

      const { finalPhone, cleanedMembers } = await syncProfileToDb();

      const res = await fetch(`${API_BASE}/payment/seva/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${devoteeToken}` },
        body: JSON.stringify({
          sevaId: seva?.id,
          sevaTitle: isTa ? seva?.title_ta || seva?.title_en : seva?.title_en,
          category: seva?.category,
          amount: finalAmount,
          bookingDate,
          sankalpamMembers: cleanedMembers,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw {
          status: res.status,
          code: body?.code,
          message: body?.message || tr('We could not start the payment. Please try again.', 'கட்டணத்தைத் தொடங்க இயலவில்லை. மீண்டும் முயற்சிக்கவும்.'),
        };
      }

      const orderData = await res.json();
      const titleForGateway = isTa ? seva?.title_ta || seva?.title_en : seva?.title_en;

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'SRI DAKSHINAMURTI SEVA SAMITI',
        description: titleForGateway || '',
        order_id: orderData.orderId,
        prefill: {
          name: `${firstName} ${lastName}`.trim(),
          email: email.trim(),
          contact: finalPhone,
        },
        theme: { color: '#3b0d0d' },
        modal: {
          ondismiss: function () {
            // Window closed without paying: stay here so the devotee can try again
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
          try {
            const verifyRes = await fetch(`${API_BASE}/payment/seva/verify`, {
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
                `/${locale}/sevas/booking-status?status=success&bookingId=${verifyData.bookingId || orderData.bookingId}&receiptNo=${verifyData.receiptNo}&slug=${slug}`
              );
            } else {
              router.push(`/${locale}/sevas/booking-status?status=failed&reason=verification_failed&slug=${slug}`);
            }
          } catch (_) {
            router.push(`/${locale}/sevas/booking-status?status=failed&reason=network_error&slug=${slug}`);
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
      // paying stays true until the payment window is closed or the payment completes
    } catch (err: any) {
      console.error('Payment start error:', err);
      setPaying(false);

      if (err?.code === 'SEVA_ALREADY_BOOKED') {
        setDateBlockedMessage(alreadyPaidMessage(!!isCorpus));
        return;
      }
      if (err?.status === 401) {
        showNotice({
          tone: 'error',
          text: tr('Your session has expired. Please log in again to continue.', 'உங்கள் உள்நுழைவு காலாவதியானது. தொடர மீண்டும் உள்நுழையவும்.'),
          linkHref: `/${locale}/login?redirect=${encodeURIComponent(`/${locale}/sevas/${slug}/checkout?date=${bookingDate}`)}`,
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

  // ---------------------------------------------------------------
  // Add to cart
  // ---------------------------------------------------------------
  const handleAddToCartAndPayLater = async () => {
    if (paying || cartAdding) return;
    const amountErr = validateAmount();
    if (amountErr) {
      setFieldErrors({ amount: amountErr });
      return;
    }
    setFieldErrors({});

    try {
      setCartAdding(true);
      const { finalPhone, cleanedMembers } = await syncProfileToDb();

      const bookingPayload = {
        sevaId: seva?.id,
        sevaTitle: isTa ? seva?.title_ta || seva?.title_en : seva?.title_en,
        category: seva?.category,
        priceType: seva?.price_type,
        amount: finalAmount,
        bookingDate,
        devotee: { firstName, lastName, email, countryCode, phone: finalPhone, residency, city, state },
        sankalpamMembers: cleanedMembers,
      };

      const existing = JSON.parse(localStorage.getItem('ashram_cart') || '[]');
      existing.push(bookingPayload);
      localStorage.setItem('ashram_cart', JSON.stringify(existing));

      router.push(`/${locale}/cart`);
    } catch (_) {
      showNotice({
        tone: 'error',
        text: tr('The item could not be added to your cart. Please try again.', 'கூடையில் சேர்க்க இயலவில்லை. மீண்டும் முயற்சிக்கவும்.'),
      });
    } finally {
      setCartAdding(false);
    }
  };

  // ---------------------------------------------------------------
  // Step validation (inline, no pop-ups)
  // ---------------------------------------------------------------
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!firstName.trim()) errs.firstName = tr('Please enter your first name.', 'முதல் பெயரை உள்ளிடவும்.');
    if (!lastName.trim()) errs.lastName = tr('Please enter your last name.', 'கடைசி பெயரை உள்ளிடவும்.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = tr('Please enter a valid email address.', 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.');
    if (phone.replace(/\D/g, '').length < 6) errs.phone = tr('Please enter a valid phone number.', 'சரியான மொபைல் எண்ணை உள்ளிடவும்.');
    if (primaryGothram === 'Other' && !primaryGothramOther.trim()) errs.primaryGothram = tr('Please enter your gothram.', 'உங்கள் கோத்திரத்தை உள்ளிடவும்.');
    if (primaryNakshathiram === 'Other' && !primaryNakshathiramOther.trim()) errs.primaryNakshathiram = tr('Please enter your nakshatram.', 'உங்கள் நட்சத்திரத்தை உள்ளிடவும்.');
    if (primaryRasi === 'Other' && !primaryRasiOther.trim()) errs.primaryRasi = tr('Please enter your rasi.', 'உங்கள் ராசியை உள்ளிடவும்.');

    const bad = findMemberProblem();
    if (bad) {
      setActiveMember(bad.index);
      setMemberError(bad.message);
    } else {
      setMemberError('');
    }

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0 || bad) {
      setNotice({
        tone: 'error',
        text: tr('Please correct the highlighted details to continue.', 'தொடர, குறிக்கப்பட்ட விவரங்களைச் சரிசெய்யவும்.'),
      });
      setTimeout(scrollTop, 50);
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
    if (!state.trim()) errs.state = tr('Please enter your state.', 'மாநிலத்தை உள்ளிடவும்.');

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setNotice({
        tone: 'error',
        text: tr('Please complete the highlighted address details.', 'குறிக்கப்பட்ட முகவரி விவரங்களை நிரப்பவும்.'),
      });
      setTimeout(scrollTop, 50);
      return;
    }
    goStep(3);
  };

  const displayGothram = (m: FamilyMember) => (m.gothram === 'Other' ? m.gothramOther || 'Other' : m.gothram);
  const displayRelation = (m: FamilyMember) => (m.relation === 'Other' ? m.relationOther || 'Other' : m.relation);

  const safeActive = Math.min(activeMember, Math.max(0, familyMembers.length - 1));
  const current = familyMembers[safeActive];
  const sevaTitle = isTa ? seva?.title_ta || seva?.title_en : seva?.title_en;

  // ---------------------------------------------------------------
  // Loading / unavailable states
  // ---------------------------------------------------------------
  if (!authChecked || loadingSeva) {
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
            {tr('Loading checkout details...', 'முன்பதிவு விவரங்கள் ஏற்றப்படுகின்றன...')}
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
            <Link href={calendarHref} className={BTN_PRIMARY}>
              {tr('Choose another date', 'வேறு தேதியைத் தேர்ந்தெடுக்க')}
            </Link>
          )}
          <Link href={`/${locale}/sevas`} className={BTN_SECONDARY}>
            {tr('View all offerings', 'அனைத்து சேவைகளையும் காண்க')}
          </Link>
        </div>
      </div>
    </main>
  );

  if (!seva) {
    return (
      <BlockedCard
        title={tr('Offering not available', 'சேவை கிடைக்கவில்லை')}
        text={tr(
          'This offering is not available for booking right now.',
          'இந்த சேவை தற்போது முன்பதிவுக்கு கிடைக்கவில்லை.'
        )}
        showCalendar={false}
      />
    );
  }

  if (dateProblem) {
    return <BlockedCard title={tr('Date not available', 'தேதி கிடைக்கவில்லை')} text={dateProblem} />;
  }

  if (dateBlockedMessage) {
    return <BlockedCard title={tr('Date not available', 'தேதி கிடைக்கவில்லை')} text={dateBlockedMessage} />;
  }

  // ---------------------------------------------------------------
  // Page
  // ---------------------------------------------------------------
  const steps: { n: 1 | 2 | 3; en: string; ta: string }[] = [
    { n: 1, en: 'Devotee & Sankalpam', ta: 'பக்தர் & சங்கல்பம்' },
    { n: 2, en: 'Prasadam Address', ta: 'பிரசாத முகவரி' },
    { n: 3, en: 'Review & Pay', ta: 'சரிபார்த்து செலுத்துக' },
  ];

  const payLabel = isTa
    ? `₹${finalAmount.toLocaleString('en-IN')} இப்போது செலுத்துக`
    : `Pay ₹${finalAmount.toLocaleString('en-IN')} Now`;

  const primarySankalpamLine = [
    primaryGothram ? (primaryGothram === 'Other' ? primaryGothramOther : primaryGothram) : '',
    primaryNakshathiram ? (primaryNakshathiram === 'Other' ? primaryNakshathiramOther : primaryNakshathiram) : '',
    primaryRasi ? (primaryRasi === 'Other' ? primaryRasiOther : primaryRasi) : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return (
    <main className="min-h-screen bg-cream/40 px-4 py-8 text-charcoal sm:px-6 sm:py-12 lg:px-8">
      <div ref={topRef} className="mx-auto max-w-6xl scroll-mt-24 space-y-6">
        {/* Top bar */}
        <div className="flex flex-col gap-2 border-b border-sand pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={calendarHref}
            className="text-base font-bold text-charcoal/70 underline-offset-4 hover:text-maroon hover:underline"
          >
            {tr('Back to offering page', 'சேவை விவரப் பக்கத்திற்குத் திரும்பு')}
          </Link>
          <span className="text-sm font-bold uppercase tracking-[0.16em] text-maroon">
            {isCorpus ? tr('Contribution Checkout', 'பங்களிப்பு முன்பதிவு') : tr('Sankalpam Booking', 'சங்கல்ப முன்பதிவு')}
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
                      active ? 'bg-saffron text-charcoal' : done ? 'bg-saffron text-charcoal' : 'bg-sand/60 text-charcoal/70'
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

        {/* Inline notice */}
        {notice && (
          <div
            role="alert"
            className={`flex flex-col gap-3 rounded-md border border-l-4 p-4 text-base font-semibold leading-relaxed sm:flex-row sm:items-center sm:justify-between ${
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
          {/* ===================== LEFT: STEPS ===================== */}
          <div className="min-w-0">
            {/* STEP 1 */}
            {currentStep === 1 && (
              <form onSubmit={handleStep1Submit} noValidate className="space-y-6">
                <div className={`${CARD} space-y-5`}>
                  <SectionTitle
                    title={tr('Primary Devotee Details', 'முதன்மை பக்தர் விவரங்கள்')}
                    hint={tr('These details are used for your receipt and prasadam.', 'இந்த விவரங்கள் உங்கள் ரசீது மற்றும் பிரசாதத்திற்குப் பயன்படுத்தப்படும்.')}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={tr('First Name *', 'முதல் பெயர் *')} error={fieldErrors.firstName}>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={inputClass(!!fieldErrors.firstName)}
                        autoComplete="given-name"
                      />
                    </Field>
                    <Field label={tr('Last Name *', 'கடைசி பெயர் *')} error={fieldErrors.lastName}>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={inputClass(!!fieldErrors.lastName)}
                        autoComplete="family-name"
                      />
                    </Field>
                  </div>

                  <Field label={tr('Email Address *', 'மின்னஞ்சல் முகவரி *')} error={fieldErrors.email}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass(!!fieldErrors.email)}
                      autoComplete="email"
                    />
                  </Field>

                  <Field label={tr('Mobile Number *', 'மொபைல் எண் *')} error={fieldErrors.phone}>
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
                        onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, '').slice(0, 14))}
                        className={inputClass(!!fieldErrors.phone)}
                        autoComplete="tel-national"
                      />
                    </div>
                  </Field>

                  <div className="space-y-4 border-t border-sand pt-5">
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-maroon">
                      {tr('Primary Devotee Sankalpam Details', 'முதன்மை பக்தர் சங்கல்ப விபரம்')}
                    </p>

                    <div>
                      <Field label={tr('Gothram', 'கோத்திரம்')}>
                        <Select value={primaryGothram} onChange={(e) => setPrimaryGothram(e.target.value)}>
                          <option value="">{tr('-- Select Gothram --', '-- கோத்திரம் தேர்வு செய்க --')}</option>
                          {GOTHRAMS.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </Select>
                      </Field>
                      {primaryGothram === 'Other' && (
                        <>
                          <input
                            type="text"
                            value={primaryGothramOther}
                            onChange={(e) => setPrimaryGothramOther(e.target.value)}
                            placeholder={tr('Type your Gothram...', 'உங்கள் கோத்திரத்தைத் தட்டச்சு செய்க...')}
                            className={`${inputClass(!!fieldErrors.primaryGothram)} mt-2`}
                          />
                          {fieldErrors.primaryGothram && (
                            <p className="mt-1.5 text-sm font-semibold text-red-700">{fieldErrors.primaryGothram}</p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <Field label={tr('Nakshatram', 'நட்சத்திரம்')}>
                          <Select value={primaryNakshathiram} onChange={(e) => setPrimaryNakshathiram(e.target.value)}>
                            <option value="">{tr('-- Select Nakshatram --', '-- நட்சத்திரம் தேர்வு செய்க --')}</option>
                            {NAKSHATHIRAMS.map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </Select>
                        </Field>
                        {primaryNakshathiram === 'Other' && (
                          <>
                            <input
                              type="text"
                              value={primaryNakshathiramOther}
                              onChange={(e) => setPrimaryNakshathiramOther(e.target.value)}
                              placeholder={tr('Type your Nakshatram...', 'உங்கள் நட்சத்திரத்தைத் தட்டச்சு செய்க...')}
                              className={`${inputClass(!!fieldErrors.primaryNakshathiram)} mt-2`}
                            />
                            {fieldErrors.primaryNakshathiram && (
                              <p className="mt-1.5 text-sm font-semibold text-red-700">{fieldErrors.primaryNakshathiram}</p>
                            )}
                          </>
                        )}
                      </div>

                      <div>
                        <Field label={tr('Rasi', 'ராசி')}>
                          <Select value={primaryRasi} onChange={(e) => setPrimaryRasi(e.target.value)}>
                            <option value="">{tr('-- Select Rasi --', '-- ராசி தேர்வு செய்க --')}</option>
                            {RASIS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </Select>
                        </Field>
                        {primaryRasi === 'Other' && (
                          <>
                            <input
                              type="text"
                              value={primaryRasiOther}
                              onChange={(e) => setPrimaryRasiOther(e.target.value)}
                              placeholder={tr('Type your Rasi...', 'உங்கள் ராசியைத் தட்டச்சு செய்க...')}
                              className={`${inputClass(!!fieldErrors.primaryRasi)} mt-2`}
                            />
                            {fieldErrors.primaryRasi && (
                              <p className="mt-1.5 text-sm font-semibold text-red-700">{fieldErrors.primaryRasi}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Family members */}
                <div className={`${CARD} space-y-5`}>
                  <SectionTitle
                    title={tr('Family Members for Archana Sankalpam', 'குடும்ப உறுப்பினர்கள் சேர்க்கை')}
                    hint={tr(
                      'Names to be recited during the Vedic archana and sankalpam.',
                      'அர்ச்சனை சங்கல்பத்தில் சேர்க்கப்பட வேண்டிய நபர்களை உள்ளிடவும்.'
                    )}
                  />

                  <div className="flex flex-wrap gap-2">
                    {familyMembers.map((m, i) => {
                      const on = i === safeActive;
                      const label = m.name.trim() || `${tr('Member', 'உறுப்பினர்')} ${i + 1}`;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setActiveMember(i);
                            setMemberError('');
                          }}
                          className={`min-h-[44px] max-w-[14rem] cursor-pointer truncate rounded-md border px-4 text-[15px] font-bold transition-colors ${
                            on
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

                  {memberError && (
                    <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-base font-semibold text-red-700">
                      {memberError}
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
                        <Field label={tr('Full Name *', 'பெயர் *')}>
                          <input
                            type="text"
                            value={current.name}
                            onChange={(e) => updateFamilyMember(safeActive, 'name', e.target.value)}
                            placeholder="e.g. Sundaresan"
                            className={inputClass()}
                          />
                        </Field>
                      </div>

                      <div>
                        <Field label={tr('Gothram *', 'கோத்திரம் *')}>
                          <Select value={current.gothram} onChange={(e) => updateFamilyMember(safeActive, 'gothram', e.target.value)}>
                            <option value="">{tr('-- Select Gothram --', '-- கோத்திரம் தேர்வு --')}</option>
                            {GOTHRAMS.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </Select>
                        </Field>
                        {current.gothram === 'Other' && (
                          <input
                            type="text"
                            value={current.gothramOther || ''}
                            onChange={(e) => updateFamilyMember(safeActive, 'gothramOther', e.target.value)}
                            placeholder="Type Gothram..."
                            className={`${inputClass()} mt-2`}
                          />
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
                            <input
                              type="text"
                              value={current.nakshathiramOther || ''}
                              onChange={(e) => updateFamilyMember(safeActive, 'nakshathiramOther', e.target.value)}
                              placeholder="Type Nakshatram..."
                              className={`${inputClass()} mt-2`}
                            />
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
                            <input
                              type="text"
                              value={current.rasiOther || ''}
                              onChange={(e) => updateFamilyMember(safeActive, 'rasiOther', e.target.value)}
                              placeholder="Type Rasi..."
                              className={`${inputClass()} mt-2`}
                            />
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
                          <input
                            type="text"
                            value={current.relationOther || ''}
                            onChange={(e) => updateFamilyMember(safeActive, 'relationOther', e.target.value)}
                            placeholder="Specify Relation..."
                            className={`${inputClass()} mt-2`}
                          />
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

            {/* STEP 2 */}
            {currentStep === 2 && (
              <form onSubmit={handleStep2Submit} noValidate className="space-y-6">
                <div className={`${CARD} space-y-5`}>
                  <SectionTitle
                    title={tr('Residency & Delivery Address', 'இருப்பிடம் மற்றும் பிரசாத முகவரி')}
                    hint={tr('Prasadam is sent to the communication address.', 'பிரசாதம் தொடர்பு முகவரிக்கு அனுப்பப்படும்.')}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        { key: 'indian', en: 'Resident Indian', ta: 'இந்தியாவில் வசிப்பவர்' },
                        { key: 'nri', en: 'NRI', ta: 'வெளிநாடு வாழ் இந்தியர்' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setResidency(opt.key)}
                        className={`min-h-[52px] cursor-pointer rounded-md border px-3 py-3 text-center text-base font-bold transition-colors ${
                          residency === opt.key
                            ? 'border-maroon bg-maroon text-white'
                            : 'border-sand bg-white text-charcoal hover:border-maroon hover:text-maroon'
                        }`}
                      >
                        {tr(opt.en, opt.ta)}
                      </button>
                    ))}
                  </div>

                  <Field label={tr('Communication Address *', 'தொடர்பு முகவரி *')} error={fieldErrors.commAddress}>
                    <textarea
                      rows={3}
                      value={commAddress}
                      onChange={(e) => setCommAddress(e.target.value)}
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
                    <span>
                      {tr('Permanent address is same as communication address', 'தொடர்பு முகவரியே நிரந்தர முகவரி')}
                    </span>
                  </label>

                  {!sameAsComm && (
                    <Field label={tr('Permanent Address *', 'நிரந்தர முகவரி *')} error={fieldErrors.permAddress}>
                      <textarea
                        rows={3}
                        value={permAddress}
                        onChange={(e) => setPermAddress(e.target.value)}
                        placeholder="Permanent family address..."
                        className={textareaClass(!!fieldErrors.permAddress)}
                      />
                    </Field>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={tr('City *', 'நகரம் *')} error={fieldErrors.city}>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={inputClass(!!fieldErrors.city)}
                      />
                    </Field>
                    <Field label={tr('State *', 'மாநிலம் *')} error={fieldErrors.state}>
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
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

            {/* STEP 3 */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className={`${CARD} space-y-6`}>
                  <SectionTitle
                    title={tr('Review & Payment', 'முன்பதிவு விவரங்கள் சரிபார்ப்பு')}
                    hint={tr('Please check your details before paying.', 'செலுத்துவதற்கு முன் விவரங்களைச் சரிபார்க்கவும்.')}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1 rounded-md border border-sand bg-cream/50 p-4">
                      <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal/55">
                        {tr('Primary Devotee', 'முதன்மை பக்தர்')}
                      </span>
                      <p className="text-lg font-bold text-maroon">
                        {firstName} {lastName}
                      </p>
                      <p className="text-[15px] text-charcoal/80">
                        {countryCode} {phone}
                      </p>
                      <p className="break-all text-[15px] text-charcoal/80">{email}</p>
                      {primarySankalpamLine && (
                        <p className="pt-1 text-sm font-semibold text-charcoal/70">{primarySankalpamLine}</p>
                      )}
                    </div>

                    <div className="space-y-1 rounded-md border border-sand bg-cream/50 p-4">
                      <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal/55">
                        {tr('Dispatch Address', 'பிரசாத முகவரி')}
                      </span>
                      <p className="text-[15px] font-semibold text-charcoal">{commAddress}</p>
                      <p className="text-[15px] text-charcoal/80">
                        {city}, {state}
                      </p>
                    </div>
                  </div>

                  {familyMembers.length > 0 && (
                    <div className="space-y-2 border-t border-sand pt-5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold uppercase tracking-[0.14em] text-maroon">
                          {tr('Sankalpam Members', 'சங்கல்பத்தில் உள்ளவர்கள்')}
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
                            <span className="text-base font-bold text-charcoal">
                              {m.title}. {m.name}
                            </span>
                            <span className="text-sm text-charcoal/65">
                              {[displayGothram(m), m.nakshathiram === 'Other' ? m.nakshathiramOther : m.nakshathiram, displayRelation(m)]
                                .filter(Boolean)
                                .join(' | ')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isOpenAmount && (
                    <div className="space-y-3 rounded-md border border-saffron bg-saffron/10 p-4 sm:p-5">
                      <label className="block text-base font-bold text-charcoal" htmlFor="offering-amount">
                        {isCorpus
                          ? tr('Enter Contribution Amount (₹ INR) *', 'பங்களிப்புத் தொகை (₹ INR) *')
                          : tr('Enter Offering Amount (₹ INR) *', 'காணிக்கைத் தொகை (₹ INR) *')}
                      </label>
                      <input
                        id="offering-amount"
                        type="number"
                        inputMode="decimal"
                        min="1"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setFieldErrors((f) => ({ ...f, amount: '' }));
                        }}
                        className={`${inputClass(!!fieldErrors.amount)} sm:w-64 !text-xl font-bold`}
                      />
                      {fieldErrors.amount && (
                        <p className="text-sm font-semibold text-red-700">{fieldErrors.amount}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {QUICK_AMOUNTS.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => {
                              setCustomAmount(amt);
                              setFieldErrors((f) => ({ ...f, amount: '' }));
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
                    <span className="text-lg font-bold text-charcoal">
                      {tr('Total Amount', 'மொத்தத் தொகை')}
                    </span>
                    <span className="text-3xl font-bold text-maroon">₹ {finalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => goStep(2)}
                    disabled={paying || cartAdding}
                    className={`${BTN_SECONDARY} w-full sm:w-auto`}
                  >
                    {tr('Back to Step 2', 'முந்தைய படி')}
                  </button>

                  <button
                    type="button"
                    disabled={paying || cartAdding}
                    onClick={handlePayNow}
                    className={`${BTN_PRIMARY} w-full flex-1 text-lg`}
                  >
                    {paying ? tr('Processing...', 'செயலாக்கப்படுகிறது...') : payLabel}
                  </button>

                  <button
                    type="button"
                    disabled={paying || cartAdding}
                    onClick={handleAddToCartAndPayLater}
                    className={`${BTN_SECONDARY} w-full sm:w-auto`}
                  >
                    {cartAdding
                      ? tr('Adding...', 'சேர்க்கிறது...')
                      : tr('Add to Cart & Pay Later', 'கூடையில் சேர்க்க (பின்னர் செலுத்த)')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ===================== RIGHT: SUMMARY ===================== */}
          <aside className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-md border border-sand bg-white shadow-md">
              <div className="border-t-4 border-saffron bg-maroon px-5 py-5 text-white sm:px-6">
                <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-saffron">
                  {tr('Selected Offering', 'தேர்ந்தெடுக்கப்பட்ட சேவை')}
                </span>
                <h1 className="mt-2 font-display text-xl font-semibold leading-snug text-white sm:text-2xl [html[lang='ta']_&]:leading-[1.4]">
                  {sevaTitle}
                </h1>
                <span className="mt-3 inline-block rounded-sm border border-saffron px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-saffron">
                  {isCorpus ? tr('Corpus Fund', 'மூலதன நிதி') : tr('Seva', 'சேவை')}
                </span>
              </div>

              <dl className="space-y-4 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-sm font-bold uppercase tracking-wider text-charcoal/55">{dateLabel}</dt>
                  <dd className="text-right text-lg font-bold text-maroon">{formatDisplayDate(bookingDate)}</dd>
                </div>

                <div className="flex items-start justify-between gap-4 border-t border-sand pt-4">
                  <dt className="text-sm font-bold uppercase tracking-wider text-charcoal/55">
                    {tr('Offering', 'காணிக்கை')}
                  </dt>
                  <dd className="text-right text-lg font-bold text-charcoal">
                    {isOpenAmount ? openAmountLabel : rupees(seva.amount || 0)}
                  </dd>
                </div>

                {familyMembers.length > 0 && (
                  <div className="flex items-start justify-between gap-4 border-t border-sand pt-4">
                    <dt className="text-sm font-bold uppercase tracking-wider text-charcoal/55">
                      {tr('Sankalpam Members', 'சங்கல்ப உறுப்பினர்கள்')}
                    </dt>
                    <dd className="text-right text-lg font-bold text-charcoal">{familyMembers.length}</dd>
                  </div>
                )}

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