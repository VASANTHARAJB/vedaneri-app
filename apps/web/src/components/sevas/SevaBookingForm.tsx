'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { COUNTRY_CODES } from '@/data/countryCodes';
import { loadRazorpayScript } from '@/lib/razorpay';

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

const LOGIN_PATH = '/login';

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

const STEPS = [
  { en: 'Devotee', ta: 'பக்தர்' },
  { en: 'Address', ta: 'முகவரி' },
  { en: 'Sankalpam', ta: 'சங்கல்பம்' },
  { en: 'Review & Pay', ta: 'சரிபார்த்து செலுத்து' },
];
const LAST_STEP = STEPS.length - 1;

const QUICK_AMOUNTS = ['501', '1008', '2001', '5001'];

const INPUT =
  'h-12 w-full rounded-xl border border-[#e8dcc6] bg-white px-4 text-base text-charcoal placeholder:text-charcoal/40 focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30';
const TEXTAREA =
  'w-full rounded-xl border border-[#e8dcc6] bg-white px-4 py-3 text-base text-charcoal placeholder:text-charcoal/40 focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30';
const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron';

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-charcoal">{label}</span>
      {children}
    </label>
  );
}

function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${INPUT} appearance-none pr-10 ${className}`}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a5a44]"
      >
        <path d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function StepHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h3 className="font-display text-xl font-semibold leading-snug text-maroon">{title}</h3>
      {sub && <p className="mt-1 text-sm text-charcoal/70">{sub}</p>}
    </div>
  );
}

export default function SevaBookingForm({ seva, locale }: { seva: BookingOffering; locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isTa = locale === 'ta';
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

  const [devoteeToken, setDevoteeToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const isCustom = seva.price_type === 'custom';
  const [customAmount, setCustomAmount] = useState<string>('1008');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');

  const [residency, setResidency] = useState<'indian' | 'nri'>('indian');
  const [commAddress, setCommAddress] = useState('');
  const [permAddress, setPermAddress] = useState('');
  const [sameAsComm, setSameAsComm] = useState(true);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([
    {
      title: 'Sri',
      name: '',
      gothram: '',
      nakshathiram: '',
      rasi: '',
      relation: 'Self (சுய விவரம்)',
    },
  ]);

  const [paying, setPaying] = useState(false);
  const [cartAdding, setCartAdding] = useState(false);

  const [step, setStep] = useState(0);
  const [activeMember, setActiveMember] = useState(0);
  const [memberError, setMemberError] = useState('');
  const topRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const loginHref = `/${locale}${LOGIN_PATH}?redirect=${encodeURIComponent(pathname || `/${locale}/sevas`)}`;

  useEffect(() => {
    const token = localStorage.getItem('devotee_token');
    if (token) {
      setDevoteeToken(token);
      loadDevoteeProfile(token);
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  const loadDevoteeProfile = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/devotee/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('devotee_token');
        setDevoteeToken(null);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const p = data.profile;
        if (p) {
          setFirstName(p.first_name || '');
          setLastName(p.last_name || '');
          setEmail(p.email || '');

          if (p.country_code) {
            setCountryCode(p.country_code);
            setPhone(p.phone || '');
          } else if (p.phone) {
            const raw = p.phone.trim();
            const matched = COUNTRY_CODES.find((c) => raw.startsWith(c.code));
            if (matched) {
              setCountryCode(matched.code);
              setPhone(raw.slice(matched.code.length));
            } else {
              setPhone(raw);
            }
          }

          setResidency(p.residency || 'indian');
          setCommAddress(p.comm_address || '');
          setPermAddress(p.perm_address || '');
          setCity(p.city || '');
          setState(p.state || '');
          if (p.perm_address && p.comm_address && p.perm_address !== p.comm_address) {
            setSameAsComm(false);
          }
        }
        if (Array.isArray(data.familyMembers) && data.familyMembers.length > 0) {
          const normalized = data.familyMembers.map((m: any) => {
            const hasGothram = GOTHRAMS.includes(m.gothram);
            const hasNak = NAKSHATHIRAMS.includes(m.nakshathiram);
            const hasRasi = RASIS.includes(m.rasi);
            const hasRel = RELATIONS.includes(m.relation);

            return {
              ...m,
              gothram: hasGothram ? m.gothram : m.gothram ? 'Other' : '',
              gothramOther: hasGothram ? '' : m.gothram || '',
              nakshathiram: hasNak ? m.nakshathiram : m.nakshathiram ? 'Other' : '',
              nakshathiramOther: hasNak ? '' : m.nakshathiram || '',
              rasi: hasRasi ? m.rasi : m.rasi ? 'Other' : '',
              rasiOther: hasRasi ? '' : m.rasi || '',
              relation: hasRel ? m.relation : m.relation ? 'Other' : 'Self (சுய விவரம்)',
              relationOther: hasRel ? '' : m.relation || '',
            };
          });
          setFamilyMembers(normalized);
          setActiveMember(0);
        }
      }
    } catch (err) {
      console.error('Failed to populate profile:', err);
    }
  };

  const addFamilyMember = () => {
    setFamilyMembers((prev) => [
      ...prev,
      {
        title: 'Sri',
        name: '',
        gothram: prev[0]?.gothram || '',
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

  const finalAmount = isCustom ? Number(customAmount || 0) : Number(seva.amount || 0);

  // Sync profile details to DB
  const syncProfileToDb = async () => {
    const finalPermAddress = sameAsComm ? commAddress : permAddress;
    const cleanPhoneDigits = phone.replace(/\D/g, '');
    const finalPhone = phone.trim().startsWith('+') ? phone.trim() : `${countryCode}${cleanPhoneDigits}`;

    const cleanedMembers = familyMembers.map((m) => ({
      title: m.title || 'Sri',
      name: m.name.trim(),
      gothram: m.gothram === 'Other' ? (m.gothramOther || 'Other') : m.gothram,
      nakshathiram: m.nakshathiram === 'Other' ? (m.nakshathiramOther || 'Other') : m.nakshathiram,
      rasi: m.rasi === 'Other' ? (m.rasiOther || 'Other') : m.rasi,
      relation: m.relation === 'Other' ? (m.relationOther || 'Other') : m.relation,
    }));

    const res = await fetch(`${API_BASE}/devotee/save-booking-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${devoteeToken}`,
      },
      body: JSON.stringify({
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
      }),
    });

    if (!res.ok) {
      console.warn('Profile sync warning: Failed to sync profile before checkout');
    }

    return { finalPhone, cleanedMembers };
  };

  // 1. DIRECT SECURE SEVA PAYMENT (Points directly to dedicated /payment/seva routes)
  const handleDirectRazorpayPayment = async () => {
    if (!devoteeToken) {
      router.push(loginHref);
      return;
    }

    if (finalAmount <= 0) {
      alert(isTa ? 'தயவுசெய்து சரியான காணிக்கை தொகையை உள்ளிடவும்' : 'Please enter a valid amount');
      return;
    }

    try {
      setPaying(true);

      const sdkReady = await loadRazorpayScript();
      if (!sdkReady) {
        alert(isTa ? 'Razorpay நுழைவாயிலை ஏற்றுவதில் பிழை.' : 'Razorpay SDK failed to load. Check internet connection.');
        setPaying(false);
        return;
      }

      const { finalPhone, cleanedMembers } = await syncProfileToDb();

      // ✅ DEDICATED SEVA ORDER ENDPOINT
      const res = await fetch(`${API_BASE}/payment/seva/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devoteeToken}`,
        },
        body: JSON.stringify({
          sevaId: seva.id,
          sevaTitle: isTa ? seva.title_ta || seva.title_en : seva.title_en,
          category: seva.category,
          amount: finalAmount,
          sankalpamMembers: cleanedMembers,
        }),
      });

      if (!res.ok) {
        const rawText = await res.text();
        let errMsg = 'Order creation failed';
        try {
          const parsed = JSON.parse(rawText);
          errMsg = parsed.message || errMsg;
        } catch (_) {
          errMsg = `Server error ${res.status}. Verify /payment/seva route is mounted in backend.`;
        }
        throw new Error(errMsg);
      }

      const orderData = await res.json();

      // Launch Razorpay Modal with Seva Credentials
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Sri Vedaneri Ashram',
        description: `Seva Offering: ${isTa ? seva.title_ta || seva.title_en : seva.title_en}`,
        order_id: orderData.orderId,
        prefill: {
          name: `${firstName} ${lastName}`.trim(),
          email: email.trim(),
          contact: finalPhone,
        },
        theme: {
          color: '#7a1c1c',
        },
        handler: async function (response: any) {
          try {
            // ✅ DEDICATED SEVA VERIFY ENDPOINT
            const verifyRes = await fetch(`${API_BASE}/payment/seva/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${devoteeToken}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingId: orderData.bookingId,
              }),
            });

            if (!verifyRes.ok) {
              const verifyErrText = await verifyRes.text();
              let failMsg = 'Payment signature verification failed';
              try {
                const failJson = JSON.parse(verifyErrText);
                failMsg = failJson.message || failMsg;
              } catch (_) {}
              throw new Error(failMsg);
            }

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              alert(
                isTa
                  ? `வெற்றி! சேவை முன்பதிவு செய்யப்பட்டது. ரசீது எண்: ${verifyData.receiptNo}`
                  : `Success! Seva booked successfully. Receipt No: ${verifyData.receiptNo}`
              );
              router.push(`/${locale}/profile`);
            } else {
              alert(verifyData.message || 'Signature verification failed.');
            }
          } catch (err: any) {
            console.error('Payment Verification Error:', err);
            alert(err.message || 'Payment verification failed. Please contact ashram office.');
          }
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.open();
    } catch (err: any) {
      console.error('Direct Payment Error:', err);
      alert(err.message || 'Payment initiation failed.');
    } finally {
      setPaying(false);
    }
  };

  // 2. ADD TO CART & PAY LATER
  const handleAddToCartAndPayLater = async () => {
    try {
      setCartAdding(true);
      const { finalPhone, cleanedMembers } = await syncProfileToDb();

      const bookingPayload = {
        sevaId: seva.id,
        sevaTitle: isTa ? seva.title_ta || seva.title_en : seva.title_en,
        category: seva.category,
        priceType: seva.price_type,
        amount: finalAmount,
        devotee: {
          firstName,
          lastName,
          email,
          countryCode,
          phone: finalPhone,
          residency,
          city,
          state,
        },
        sankalpamMembers: cleanedMembers,
      };

      const existing = JSON.parse(localStorage.getItem('ashram_cart') || '[]');
      existing.push(bookingPayload);
      localStorage.setItem('ashram_cart', JSON.stringify(existing));

      router.push(`/${locale}/cart`);
    } catch (_) {
      alert(isTa ? 'கூடையில் சேர்க்க முடியவில்லை.' : 'Failed to add to cart');
    } finally {
      setCartAdding(false);
    }
  };

  const findMemberProblem = (): { index: number; message: string } | null => {
    for (let i = 0; i < familyMembers.length; i++) {
      const m = familyMembers[i];
      let problem = '';
      if (!m.name.trim()) {
        problem = isTa ? 'பெயரை உள்ளிடவும்' : 'please enter the name';
      } else if (!m.gothram) {
        problem = isTa ? 'கோத்திரத்தைத் தேர்ந்தெடுக்கவும்' : 'please select the gothram';
      } else if (m.gothram === 'Other' && !(m.gothramOther || '').trim()) {
        problem = isTa ? 'கோத்திரத்தை உள்ளிடவும்' : 'please type the gothram';
      } else if (m.nakshathiram === 'Other' && !(m.nakshathiramOther || '').trim()) {
        problem = isTa ? 'நட்சத்திரத்தை உள்ளிடவும்' : 'please type the nakshatram';
      } else if (m.rasi === 'Other' && !(m.rasiOther || '').trim()) {
        problem = isTa ? 'ராசியை உள்ளிடவும்' : 'please type the rasi';
      } else if (m.relation === 'Other' && !(m.relationOther || '').trim()) {
        problem = isTa ? 'உறவுமுறையை உள்ளிடவும்' : 'please specify the relation';
      }
      if (problem) {
        return { index: i, message: `${isTa ? 'உறுப்பினர்' : 'Member'} ${i + 1}: ${problem}` };
      }
    }
    return null;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < LAST_STEP) {
      if (step === 2) {
        const bad = findMemberProblem();
        if (bad) {
          setActiveMember(bad.index);
          setMemberError(bad.message);
          return;
        }
        setMemberError('');
      }
      setStep((s) => Math.min(s + 1, LAST_STEP));
      return;
    }

    handleDirectRazorpayPayment();
  };

  const displayGothram = (m: FamilyMember) => (m.gothram === 'Other' ? m.gothramOther || 'Other' : m.gothram);
  const displayRelation = (m: FamilyMember) => (m.relation === 'Other' ? m.relationOther || 'Other' : m.relation);

  const stepTitles = [
    { t: isTa ? 'பக்தர் சுய விவரங்கள்' : 'Devotee Personal Details', s: isTa ? 'முன்பதிவு செய்பவரின் தொடர்பு விவரங்கள்.' : 'Who is booking this seva.' },
    { t: isTa ? 'முகவரி மற்றும் இருப்பிடம்' : 'Residency & Address', s: isTa ? 'பிரசாதம் மற்றும் ரசீது அனுப்ப.' : 'Used for prasadam dispatch and your receipt.' },
    { t: isTa ? 'சங்கல்ப விவரங்கள்' : 'Sankalpam Family Members', s: isTa ? 'சங்கல்பத்தில் சேர்க்க வேண்டிய அனைவரையும் சேர்க்கவும்.' : 'Add everyone who should be named in the sankalpam.' },
    { t: isTa ? 'சரிபார்த்து செலுத்துக' : 'Review & Pay', s: isTa ? 'தொகையையும் விவரங்களையும் சரிபார்க்கவும்.' : 'Confirm the amount and your details.' },
  ];

  const backLabel = isTa ? 'பின்செல்' : 'Back';
  const continueLabel = isTa ? 'தொடர்க' : 'Continue';
  const editLabel = isTa ? 'திருத்து' : 'Edit';

  const safeActive = Math.min(activeMember, familyMembers.length - 1);
  const current = familyMembers[safeActive];

  if (!authChecked) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-16 animate-pulse rounded-2xl bg-[#fbf6ec]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[#fbf6ec]" />
      </div>
    );
  }

  if (!devoteeToken) {
    return (
      <div className="rounded-2xl border border-[#e8dcc6] bg-[#fffdfa] px-6 py-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-saffron/15">
          <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-maroon">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 118 0v4" />
          </svg>
        </span>

        <h3 className="mt-4 font-display text-xl font-semibold leading-snug text-maroon">
          {isTa ? 'முன்பதிவு செய்ய உள்நுழையவும்' : 'Login to book this seva'}
        </h3>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-charcoal/70">
          {isTa
            ? 'விவரங்களைச் சேமிக்கவும் மீண்டும் பயன்படுத்தவும் உள்நுழையவும்.'
            : 'Login once and your family, gothram & address details are saved for every future booking.'}
        </p>

        <Link
          href={loginHref}
          className={`mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-maroon px-6 text-base font-bold text-white shadow-md transition-colors hover:bg-maroon/90 ${FOCUS}`}
        >
          {isTa ? 'உள்நுழைக' : 'Login to continue'}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#a7f3d0] bg-[#ecfdf5] px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#047857]">
            {isTa ? '✓ உள்நுழைந்துள்ளீர்' : '✓ Logged in'}
          </p>
          {(email || phone) && <p className="truncate text-sm text-[#047857]/80">{email || `${countryCode} ${phone}`}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('devotee_token');
            setDevoteeToken(null);
          }}
          className={`shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-[#be123c] hover:underline ${FOCUS}`}
        >
          {isTa ? 'வெளியேறு' : 'Logout'}
        </button>
      </div>

      <div ref={topRef} className="scroll-mt-24">
        <ol className="flex items-center" aria-label={isTa ? 'முன்பதிவு படிகள்' : 'Booking steps'}>
          {STEPS.map((s, i) => {
            const done = i < step;
            const isCurrent = i === step;
            return (
              <li key={s.en} className={`flex items-center ${i < LAST_STEP ? 'flex-1' : ''}`}>
                <button
                  type="button"
                  onClick={() => done && setStep(i)}
                  disabled={!done}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`${i + 1}. ${isTa ? s.ta : s.en}`}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${FOCUS} ${
                    done
                      ? 'cursor-pointer bg-maroon text-white hover:bg-maroon/90'
                      : isCurrent
                      ? 'bg-saffron text-charcoal ring-4 ring-saffron/25'
                      : 'bg-[#f1e8d6] text-charcoal/50'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </button>
                {i < LAST_STEP && (
                  <span aria-hidden="true" className={`mx-2 h-0.5 flex-1 rounded-full ${done ? 'bg-maroon' : 'bg-[#e8dcc6]'}`} />
                )}
              </li>
            );
          })}
        </ol>

        <p className="mt-3 text-sm font-semibold text-charcoal/70">
          {isTa ? `படி ${step + 1} / ${STEPS.length}` : `Step ${step + 1} of ${STEPS.length}`}
          {' · '}
          <span className="text-maroon">{isTa ? STEPS[step].ta : STEPS[step].en}</span>
        </p>
      </div>

      <form onSubmit={handleFormSubmit} className="text-charcoal">
        <StepHeading title={stepTitles[step].t} sub={stepTitles[step].s} />

        {/* STEP 1 */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={isTa ? 'முதல் பெயர் (First Name) *' : 'First Name *'}>
                <input
                  type="text"
                  required
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Nagaraj"
                  className={INPUT}
                />
              </Field>
              <Field label={isTa ? 'கடைசி பெயர் (Last Name) *' : 'Last Name *'}>
                <input
                  type="text"
                  required
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Iyer"
                  className={INPUT}
                />
              </Field>
            </div>

            <Field label={isTa ? 'மின்னஞ்சல் (Email ID) *' : 'Email ID *'}>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={INPUT}
              />
            </Field>

            <Field label={isTa ? 'தொலைபேசி எண் (Phone) *' : 'Phone Number *'}>
              <div className="flex gap-2">
                <div className="relative w-36 shrink-0 sm:w-44">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className={`${INPUT} appearance-none pr-8 text-xs font-semibold`}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={`${c.code}-${c.country}`} value={c.code}>
                        {c.label || `${c.country} (${c.code})`}
                      </option>
                    ))}
                  </select>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a5a44]">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                <input
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, '').slice(0, 14))}
                  placeholder="9876543210"
                  className={INPUT}
                />
              </div>
            </Field>
          </div>
        )}

        {/* STEP 2 */}
        {step === 1 && (
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-charcoal">
                {isTa ? 'இருப்பிடம் (Choose Residency) *' : 'Choose Your Residency *'}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-colors ${residency === 'indian' ? 'border-maroon bg-[#fff8ec]' : 'border-[#e8dcc6] bg-white hover:border-saffron/60'}`}>
                  <input type="radio" name="residency" checked={residency === 'indian'} onChange={() => setResidency('indian')} className="h-4 w-4 accent-maroon" />
                  <span>Resident Indian</span>
                </label>
                <label className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-colors ${residency === 'nri' ? 'border-maroon bg-[#fff8ec]' : 'border-[#e8dcc6] bg-white hover:border-saffron/60'}`}>
                  <input type="radio" name="residency" checked={residency === 'nri'} onChange={() => setResidency('nri')} className="h-4 w-4 accent-maroon" />
                  <span>NRI (வெளிநாடு வாழ் இந்தியர்)</span>
                </label>
              </div>
            </fieldset>

            <Field label={isTa ? 'தொடர்பு முகவரி (Communication Address) *' : 'Communication Address *'}>
              <textarea
                rows={3}
                required
                autoComplete="street-address"
                value={commAddress}
                onChange={(e) => setCommAddress(e.target.value)}
                placeholder="Door No, Street name, Area details..."
                className={TEXTAREA}
              />
            </Field>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-semibold text-charcoal/80">
              <input type="checkbox" checked={sameAsComm} onChange={(e) => setSameAsComm(e.target.checked)} className="h-5 w-5 rounded accent-maroon" />
              <span>{isTa ? 'தொடர்பு முகவரியே நிரந்தர முகவரி' : 'Permanent address is same as communication address'}</span>
            </label>

            {!sameAsComm && (
              <Field label={isTa ? 'நிரந்தர முகவரி (Permanent Address) *' : 'Permanent Address *'}>
                <textarea
                  rows={3}
                  required
                  value={permAddress}
                  onChange={(e) => setPermAddress(e.target.value)}
                  placeholder="Permanent family address..."
                  className={TEXTAREA}
                />
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={isTa ? 'நகரம் (City) *' : 'City *'}>
                <input type="text" required autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Coimbatore" className={INPUT} />
              </Field>
              <Field label={isTa ? 'மாநிலம் (State) *' : 'State *'}>
                <input type="text" required autoComplete="address-level1" value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Tamil Nadu" className={INPUT} />
              </Field>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 2 && current && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {familyMembers.map((m, i) => {
                const on = i === safeActive;
                const label = m.name.trim() || (i === 0 ? (isTa ? 'நான்' : 'Self') : `${isTa ? 'உறுப்பினர்' : 'Member'} ${i + 1}`);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setActiveMember(i);
                      setMemberError('');
                    }}
                    className={`flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-bold transition-colors ${FOCUS} ${on ? 'border-maroon bg-maroon text-white shadow-sm' : 'border-[#e8dcc6] bg-white text-charcoal hover:border-saffron'}`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${on ? 'bg-white/20 text-white' : 'bg-[#f1e8d6] text-charcoal/70'}`}>
                      {i + 1}
                    </span>
                    <span className="max-w-[110px] truncate">{label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={addFamilyMember}
                className={`flex h-10 items-center gap-1.5 rounded-full border-2 border-dashed border-saffron bg-[#fffaf0] px-4 text-sm font-bold text-maroon transition-colors hover:bg-saffron/20 ${FOCUS}`}
              >
                <span aria-hidden="true" className="text-base leading-none">+</span>
                {isTa ? 'உறுப்பினர் சேர்' : 'Add member'}
              </button>
            </div>

            {memberError && (
              <p role="alert" className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#be123c]">
                {memberError}
              </p>
            )}

            <div className="rounded-2xl border border-[#e8dcc6] bg-[#fffdfa] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-maroon">
                  {isTa ? `உறுப்பினர் ${safeActive + 1} / ${familyMembers.length}` : `Member ${safeActive + 1} of ${familyMembers.length}`}
                </p>
                {familyMembers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFamilyMember(safeActive)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold text-[#be123c] hover:bg-[#fff1f2] ${FOCUS}`}
                  >
                    {isTa ? 'நீக்கு' : 'Remove'}
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-[104px_1fr] gap-3">
                  <Field label="Title">
                    <Select value={current.title} onChange={(e) => updateFamilyMember(safeActive, 'title', e.target.value)}>
                      <option value="Sri">Sri</option>
                      <option value="Smt">Smt</option>
                      <option value="Kum">Kum</option>
                      <option value="Master">Master</option>
                      <option value="Chi">Chi</option>
                    </Select>
                  </Field>
                  <Field label={isTa ? 'பெயர் (Name) *' : 'Full Name *'}>
                    <input
                      type="text"
                      required
                      value={current.name}
                      onChange={(e) => updateFamilyMember(safeActive, 'name', e.target.value)}
                      placeholder="e.g. Sundaresan"
                      className={INPUT}
                    />
                  </Field>
                </div>

                <div>
                  <Field label={isTa ? 'கோத்திரம் (Gothram) *' : 'Gothram *'}>
                    <Select required value={current.gothram} onChange={(e) => updateFamilyMember(safeActive, 'gothram', e.target.value)}>
                      <option value="">{isTa ? '-- கோத்திரம் தேர்வு --' : '-- Select Gothram --'}</option>
                      {GOTHRAMS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </Select>
                  </Field>
                  {current.gothram === 'Other' && (
                    <input
                      type="text"
                      required
                      value={current.gothramOther || ''}
                      onChange={(e) => updateFamilyMember(safeActive, 'gothramOther', e.target.value)}
                      placeholder="Type Gothram..."
                      className={`${INPUT} mt-2 border-2 border-saffron font-semibold text-maroon`}
                    />
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Field label={isTa ? 'நட்சத்திரம் (Nakshathiram)' : 'Nakshatram'}>
                      <Select value={current.nakshathiram} onChange={(e) => updateFamilyMember(safeActive, 'nakshathiram', e.target.value)}>
                        <option value="">{isTa ? '-- தேர்வு --' : '-- Select --'}</option>
                        {NAKSHATHIRAMS.map((nak) => <option key={nak} value={nak}>{nak}</option>)}
                      </Select>
                    </Field>
                    {current.nakshathiram === 'Other' && (
                      <input
                        type="text"
                        required
                        value={current.nakshathiramOther || ''}
                        onChange={(e) => updateFamilyMember(safeActive, 'nakshathiramOther', e.target.value)}
                        placeholder="Type Nakshatram..."
                        className={`${INPUT} mt-2 border-saffron`}
                      />
                    )}
                  </div>

                  <div>
                    <Field label={isTa ? 'ராசி (Rasi)' : 'Rasi'}>
                      <Select value={current.rasi} onChange={(e) => updateFamilyMember(safeActive, 'rasi', e.target.value)}>
                        <option value="">{isTa ? '-- தேர்வு --' : '-- Select --'}</option>
                        {RASIS.map((ras) => <option key={ras} value={ras}>{ras}</option>)}
                      </Select>
                    </Field>
                    {current.rasi === 'Other' && (
                      <input
                        type="text"
                        required
                        value={current.rasiOther || ''}
                        onChange={(e) => updateFamilyMember(safeActive, 'rasiOther', e.target.value)}
                        placeholder="Type Rasi..."
                        className={`${INPUT} mt-2 border-saffron`}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <Field label={isTa ? 'உறவுமுறை (Relation)' : 'Relation'}>
                    <Select value={current.relation} onChange={(e) => updateFamilyMember(safeActive, 'relation', e.target.value)}>
                      {RELATIONS.map((rel) => <option key={rel} value={rel}>{rel}</option>)}
                    </Select>
                  </Field>
                  {current.relation === 'Other' && (
                    <input
                      type="text"
                      required
                      value={current.relationOther || ''}
                      onChange={(e) => updateFamilyMember(safeActive, 'relationOther', e.target.value)}
                      placeholder="Specify Relation..."
                      className={`${INPUT} mt-2 border-saffron`}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Review and Secure Pay */}
        {step === 3 && (
          <div className="space-y-5">
            {isCustom ? (
              <div className="rounded-2xl border-2 border-saffron bg-[#fffaf0] p-4 sm:p-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-charcoal">
                    {isTa ? 'காணிக்கை தொகை (₹ INR) *' : 'Enter Your Offering Amount (₹ INR) *'}
                  </span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-charcoal/50">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      required
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="1008"
                      className="h-14 w-full rounded-xl border border-[#e8dcc6] bg-white pl-10 pr-4 text-2xl font-extrabold text-maroon focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30"
                    />
                  </div>
                </label>

                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCustomAmount(amt)}
                      aria-pressed={customAmount === amt}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${FOCUS} ${customAmount === amt ? 'border-maroon bg-maroon text-white' : 'border-[#e8dcc6] bg-white text-charcoal hover:border-saffron'}`}
                    >
                      ₹{Number(amt).toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-2xl border border-[#e8dcc6] bg-[#fbf6ec] px-5 py-4">
                <span className="text-sm font-bold uppercase tracking-wider text-charcoal/70">
                  {isTa ? 'சேவை கட்டணம்' : 'Fixed Pooja Offering'}
                </span>
                <span className="text-2xl font-extrabold text-maroon">
                  ₹{Number(seva.amount).toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {/* Devotee Summary */}
            <div className="rounded-2xl border border-[#e8dcc6] p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal/60">
                  {isTa ? 'பக்தர்' : 'Devotee'}
                </p>
                <button type="button" onClick={() => setStep(0)} className={`rounded text-sm font-bold text-maroon underline ${FOCUS}`}>
                  {editLabel}
                </button>
              </div>
              <p className="text-base font-bold text-charcoal">{`${firstName} ${lastName}`.trim() || '—'}</p>
              <p className="mt-1 break-words text-sm text-charcoal/70">{email}</p>
              <p className="text-sm text-charcoal/70">{countryCode} {phone}</p>
              <p className="mt-1 text-sm text-charcoal/70">{[city, state].filter(Boolean).join(', ')}</p>
            </div>

            {/* Members Summary */}
            <div className="rounded-2xl border border-[#e8dcc6] p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal/60">
                  {isTa ? 'சங்கல்ப உறுப்பினர்கள்' : 'Sankalpam members'} ({familyMembers.length})
                </p>
                <button type="button" onClick={() => setStep(2)} className={`rounded text-sm font-bold text-maroon underline ${FOCUS}`}>
                  {editLabel}
                </button>
              </div>
              <ul className="divide-y divide-[#efe6d3]">
                {familyMembers.map((m, i) => (
                  <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-sm font-bold text-charcoal">{m.title} {m.name || '—'}</p>
                    <p className="text-xs text-charcoal/60">{[displayGothram(m), displayRelation(m)].filter(Boolean).join(' · ')}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              className={`h-12 shrink-0 rounded-xl border border-[#e8dcc6] bg-white px-5 text-sm font-bold text-charcoal transition-colors hover:bg-[#fbf6ec] ${FOCUS}`}
            >
              ← {backLabel}
            </button>
          )}

          {step < LAST_STEP ? (
            <button
              type="submit"
              className={`h-12 flex-1 rounded-xl bg-maroon px-6 text-base font-bold text-white shadow-md transition-colors hover:bg-maroon/90 ${FOCUS}`}
            >
              {continueLabel} →
            </button>
          ) : (
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              {/* PRIMARY ACTION: PAY NOW WITH RAZORPAY */}
              <button
                type="submit"
                disabled={paying || cartAdding}
                className={`min-h-[52px] flex-1 rounded-xl bg-saffron px-4 py-3 text-center text-base font-extrabold leading-snug text-charcoal shadow-md transition-all hover:bg-maroon hover:text-white disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${FOCUS}`}
              >
                {paying ? (
                  isTa ? 'Razorpay பாதுகாப்பானது துவங்குகிறது...' : 'Connecting Secure Razorpay...'
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                    {isTa
                      ? `₹${finalAmount.toLocaleString('en-IN')} உடனடியாகச் செலுத்துக (Pay Now)`
                      : `Pay ₹${finalAmount.toLocaleString('en-IN')} Now (Razorpay)`}
                  </span>
                )}
              </button>

              {/* SECONDARY ACTION: SAVE TO CART & PAY LATER */}
              <button
                type="button"
                onClick={handleAddToCartAndPayLater}
                disabled={paying || cartAdding}
                className={`min-h-[52px] rounded-xl border-2 border-maroon bg-white px-5 py-3 text-center text-sm font-bold text-maroon shadow-sm transition-all hover:bg-[#fff8ec] disabled:opacity-60 cursor-pointer ${FOCUS}`}
              >
                {cartAdding ? (isTa ? 'சேர்க்கிறது...' : 'Adding...') : (isTa ? 'கூடையில் சேர்க்க (Pay Later)' : 'Add to Cart & Pay Later')}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}