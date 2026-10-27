'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Props = {
  locale: string;
  t?: any;
  a?: any;
  shop?: any;
  homeLabel?: string;
  siteName?: string;
};

type Kind = 'seva_list' | 'seva_corpus' | 'donation_list' | 'donation_corpus' | 'ashram_donation';
type KindFilter = 'all' | Kind;

interface HistoryItem {
  key: string;
  kind: Kind;
  source: 'seva' | 'donation';
  id: number | string;
  title_en: string;
  title_ta: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
  date: string;
  created_at: string | null;
  receipt_no: string | null;
}

interface SavedIds {
  panMasked: string;
  aadhaarMasked: string;
}

const RASI = [
  'Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)', 'Karka (Cancer)',
  'Simha (Leo)', 'Kanya (Virgo)', 'Tula (Libra)', 'Vrischika (Scorpio)',
  'Dhanu (Sagittarius)', 'Makara (Capricorn)', 'Kumbha (Aquarius)', 'Meena (Pisces)'
];

const NAKSHATRAM = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
  'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
  'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const BACKEND_URL = API_BASE.replace(/\/api\/v1\/?$/, '');
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

const getAvatarUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const formatDate = (v?: string | null) => {
  if (!v) return '';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m && String(v).length <= 10) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = new Date(v);
  if (isNaN(d.getTime())) return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
  return d
    .toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace(/\//g, '.');
};

const readToken = () => (typeof window !== 'undefined' ? localStorage.getItem('devotee_token') : null);

const inputClass =
  'w-full rounded-lg border border-[#e5d9c5] bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/20 transition-all';
const inputErrClass =
  'w-full rounded-lg border border-red-500 bg-red-50 px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-200 transition-all';

function DefaultDevoteeAvatar() {
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="80" height="80" fill="#fef3c7" />
      <circle cx="40" cy="40" r="37" stroke="#d97706" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
      <circle cx="40" cy="29" r="13" fill="#7a1c1c" />
      <rect x="38.5" y="21" width="3" height="7" rx="1.5" fill="#f59e0b" />
      <circle cx="40" cy="27" r="1.2" fill="#dc2626" />
      <path d="M16 66C16 54.9543 24.9543 46 36 46H44C55.0457 46 64 54.9543 64 66V80H16V66Z" fill="#7a1c1c" />
    </svg>
  );
}

export default function ProfileView({ locale }: Props) {
  const router = useRouter();
  const isTa = locale === 'ta';
  const tr = (en: string, ta: string) => (isTa ? ta : en);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    comm_address: '',
    city: '',
    state: '',
    avatar_url: '',
  });
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'sankalpam' | 'history' | 'security' | 'account'>('profile');

  // Photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Password
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Saved PAN / Aadhaar (masked values only)
  const [savedIds, setSavedIds] = useState<SavedIds | null>(null);
  const [idsEditing, setIdsEditing] = useState(false);
  const [panInput, setPanInput] = useState('');
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [idsErr, setIdsErr] = useState<{ pan?: string; aadhaar?: string; general?: string }>({});
  const [idsSaving, setIdsSaving] = useState(false);
  const [confirmRemoveIds, setConfirmRemoveIds] = useState(false);

  // Bookings and donations history
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyPartial, setHistoryPartial] = useState<string[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [showUnpaid, setShowUnpaid] = useState(false);

  // Account deletion (inline confirmation)
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Alerts
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = readToken();
    if (!token) {
      router.replace(`/${locale}/login?redirect=/${locale}/profile`);
      return;
    }

    const fetchAll = async () => {
      try {
        const res = await fetch(`${API_BASE}/devotee/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          localStorage.removeItem('devotee_token');
          window.dispatchEvent(new Event('devotee-auth-change'));
          router.replace(`/${locale}/login?redirect=/${locale}/profile`);
          return;
        }

        const data = await res.json();
        setProfile(data.profile || {});
        setFamilyMembers(data.familyMembers || []);
        if (data.profile?.avatar_url) setPhotoPreview(data.profile.avatar_url);
      } catch (_) {
        setError(tr('Failed to fetch profile.', 'சுயவிவரத்தைப் பெற முடியவில்லை.'));
      } finally {
        setLoading(false);
      }

      try {
        const r = await fetch(`${API_BASE}/donation-booking/my-ids`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (r.ok) {
          const d = await r.json();
          if (d?.saved) setSavedIds({ panMasked: d.panMasked, aadhaarMasked: d.aadhaarMasked });
        }
      } catch (_) {
        // The section simply shows the empty form
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, router]);

  // Load the history the first time the tab opens (and again on Retry)
  useEffect(() => {
    if (activeTab !== 'history' || historyLoaded) return;
    const token = readToken();
    if (!token) return;

    setHistoryLoading(true);
    setHistoryError('');
    fetch(`${API_BASE}/account/history`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        setHistory(Array.isArray(d.items) ? d.items : []);
        setHistoryPartial(Array.isArray(d.errors) ? d.errors : []);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryError(tr('Could not load your history right now.', 'வரலாற்றை இப்போது ஏற்ற இயலவில்லை.')))
      .finally(() => setHistoryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, historyLoaded, historyTick]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError(tr('Please select a JPG, PNG or WebP image.', 'JPG, PNG அல்லது WebP படங்கள் மட்டுமே அனுமதிக்கப்படும்.'));
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError(tr('Image size must be under 4MB.', 'படத்தின் அளவு 4MB-க்குள் இருக்க வேண்டும்.'));
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError('');
  };

  // Save profile and family details (PAN and Aadhaar are handled separately)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const formData = new FormData();
      formData.append('first_name', profile.first_name || '');
      formData.append('last_name', profile.last_name || '');
      formData.append('phone', profile.phone || '');
      formData.append('comm_address', profile.comm_address || '');
      formData.append('city', profile.city || '');
      formData.append('state', profile.state || '');
      formData.append('family_members', JSON.stringify(familyMembers));
      if (photoFile) formData.append('photo', photoFile);

      const res = await fetch(`${API_BASE}/devotee/save-booking-profile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${readToken()}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Save failed');

      if (data.avatar_url) setPhotoPreview(data.avatar_url);
      setPhotoFile(null);
      setMessage(tr('Profile details saved successfully!', 'விவரங்கள் வெற்றிகரமாகச் சேமிக்கப்பட்டன!'));
      setTimeout(() => setMessage(''), 4000);
    } catch (err: any) {
      setError(err.message || tr('Failed to save details.', 'சேமிக்க முடியவில்லை.'));
    } finally {
      setSaving(false);
    }
  };

  const saveIds = async () => {
    const pan = panInput.trim().toUpperCase();
    const aad = aadhaarInput.replace(/\s/g, '');
    const errs: { pan?: string; aadhaar?: string } = {};
    if (!pan) errs.pan = tr('PAN number is required.', 'PAN எண் அவசியம்.');
    else if (!PAN_REGEX.test(pan)) errs.pan = tr('Please enter a valid PAN (for example ABCDE1234F).', 'சரியான PAN எண்ணை உள்ளிடவும் (எ.கா. ABCDE1234F).');
    if (!aad) errs.aadhaar = tr('Aadhaar number is required.', 'ஆதார் எண் அவசியம்.');
    else if (!isValidAadhaar(aad)) errs.aadhaar = tr('Please enter a valid 12-digit Aadhaar number.', 'சரியான 12 இலக்க ஆதார் எண்ணை உள்ளிடவும்.');

    if (errs.pan || errs.aadhaar) {
      setIdsErr(errs);
      return;
    }

    setIdsSaving(true);
    setIdsErr({});
    setMessage('');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/donation-profile/ids`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readToken()}` },
        body: JSON.stringify({ panNumber: pan, aadhaarNumber: aad }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'INVALID_PAN') setIdsErr({ pan: data.message });
        else if (data.code === 'INVALID_AADHAAR') setIdsErr({ aadhaar: data.message });
        else setIdsErr({ general: data.message || tr('Could not save. Please try again.', 'சேமிக்க இயலவில்லை. மீண்டும் முயற்சிக்கவும்.') });
        return;
      }
      setSavedIds({ panMasked: data.panMasked, aadhaarMasked: data.aadhaarMasked });
      setIdsEditing(false);
      setPanInput('');
      setAadhaarInput('');
      setMessage(tr('PAN and Aadhaar saved.', 'PAN மற்றும் ஆதார் சேமிக்கப்பட்டது.'));
      setTimeout(() => setMessage(''), 4000);
    } catch (_) {
      setIdsErr({ general: tr('Network error. Please try again.', 'இணைய பிழை. மீண்டும் முயற்சிக்கவும்.') });
    } finally {
      setIdsSaving(false);
    }
  };

  const removeIds = async () => {
    setIdsSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/donation-profile/ids`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${readToken()}` },
      });
      if (!res.ok) throw new Error('failed');
      setSavedIds(null);
      setConfirmRemoveIds(false);
      setMessage(tr('Saved PAN and Aadhaar removed.', 'சேமித்த PAN மற்றும் ஆதார் நீக்கப்பட்டது.'));
      setTimeout(() => setMessage(''), 4000);
    } catch (_) {
      setError(tr('Could not remove the saved numbers. Please try again.', 'சேமித்த எண்களை நீக்க இயலவில்லை. மீண்டும் முயற்சிக்கவும்.'));
    } finally {
      setIdsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSaving(true);
    setMessage('');
    setError('');

    if (pwForm.new_password !== pwForm.confirm_password) {
      setError(tr('New passwords do not match.', 'புதிய கடவுச்சொற்கள் பொருந்தவில்லை.'));
      setPwSaving(false);
      return;
    }
    if (pwForm.new_password.length < 8) {
      setError(tr('Password must be at least 8 characters long.', 'கடவுச்சொல் குறைந்தது 8 எழுத்துக்கள் இருக்க வேண்டும்.'));
      setPwSaving(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/devotee/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readToken()}` },
        body: JSON.stringify(pwForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Password update failed');

      setMessage(tr('Password changed successfully!', 'கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது!'));
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setMessage(''), 4000);
    } catch (err: any) {
      setError(err.message || tr('Failed to change password.', 'கடவுச்சொல்லை மாற்ற முடியவில்லை.'));
    } finally {
      setPwSaving(false);
    }
  };

  const addFamilyMember = () => {
    setFamilyMembers([...familyMembers, { title: 'Sri', name: '', gothram: '', nakshathiram: '', rasi: '', relation: 'Family' }]);
  };
  const removeFamilyMember = (index: number) => setFamilyMembers(familyMembers.filter((_, i) => i !== index));
  const updateFamilyMember = (index: number, key: string, value: string) => {
    const updated = [...familyMembers];
    updated[index][key] = value;
    setFamilyMembers(updated);
  };

  const handleLogout = () => {
    localStorage.removeItem('devotee_token');
    window.dispatchEvent(new Event('devotee-auth-change'));
    router.replace(`/${locale}/login`);
    router.refresh();
  };

  const handleDeleteAccount = async () => {
    try {
      const res = await fetch(`${API_BASE}/devotee/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${readToken()}` },
      });
      if (res.ok) {
        handleLogout();
      } else {
        const data = await res.json().catch(() => ({}));
        setConfirmDelete(false);
        setError(data.message || tr('Failed to delete account', 'கணக்கை நீக்க முடியவில்லை.'));
      }
    } catch (_) {
      setConfirmDelete(false);
      setError(tr('Network error deleting account.', 'கணக்கை நீக்க முடியவில்லை.'));
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <p className="font-serif text-base font-bold text-maroon animate-pulse">
          {tr('Loading devotee details...', 'பக்தர் விவரங்கள் ஏற்றப்படுகின்றன...')}
        </p>
      </div>
    );
  }

  const tabClass = (key: string) =>
    `border-b-2 px-3.5 py-2.5 transition cursor-pointer ${
      activeTab === key ? 'border-maroon text-maroon font-bold' : 'border-transparent text-charcoal/60 hover:text-charcoal'
    }`;

  // ---------- History grouping ----------
  const KIND_LABEL: Record<Kind, string> = {
    seva_list: tr('Seva List', 'சேவை பட்டியல்'),
    seva_corpus: tr('Seva Corpus', 'சேவை மூலதனம்'),
    donation_list: tr('Donation List', 'நன்கொடை பட்டியல்'),
    donation_corpus: tr('Donation Corpus', 'நன்கொடை மூலதனம்'),
    ashram_donation: tr('Ashram Donation', 'ஆசிரம நன்கொடை'),
  };
  const KINDS: Kind[] = ['seva_list', 'seva_corpus', 'donation_list', 'donation_corpus', 'ashram_donation'];

  const paidOf = (list: HistoryItem[]) => list.filter((i) => i.status === 'SUCCESS');
  const sumOf = (list: HistoryItem[]) => list.reduce((s, i) => s + Number(i.amount || 0), 0);

  const countFor = (k: KindFilter) => {
    const list = k === 'all' ? history : history.filter((i) => i.kind === k);
    return (showUnpaid ? list : paidOf(list)).length;
  };

  const inKind = kindFilter === 'all' ? history : history.filter((i) => i.kind === kindFilter);
  const visibleItems = showUnpaid ? inKind : paidOf(inKind);
  const paidTotal = sumOf(paidOf(inKind));
  const paidCount = paidOf(inKind).length;

  const statusChip = (s: string) =>
    s === 'SUCCESS'
      ? { text: tr('Paid', 'செலுத்தப்பட்டது'), cls: 'border-emerald-300 bg-emerald-50 text-emerald-800' }
      : s === 'PENDING'
      ? { text: tr('Pending', 'நிலுவை'), cls: 'border-amber-300 bg-amber-50 text-amber-800' }
      : { text: tr('Not completed', 'நிறைவடையவில்லை'), cls: 'border-red-200 bg-red-50 text-red-700' };

  const receiptHref = (i: HistoryItem) =>
    i.source === 'seva'
      ? `/${locale}/sevas/booking-status?status=success&bookingId=${i.id}&receiptNo=${encodeURIComponent(i.receipt_no || '')}`
      : `/${locale}/donate/booking-status?status=success&bookingId=${i.id}&receiptNo=${encodeURIComponent(i.receipt_no || '')}`;

  const listHref = (k: KindFilter) =>
    k === 'seva_list' || k === 'seva_corpus'
      ? `/${locale}/sevas`
      : k === 'ashram_donation'
      ? `/${locale}/donate/ashram-donation`
      : `/${locale}/donate/annadhanam-corpus`;

  return (
    <div className="relative z-10 mx-auto -mt-16 max-w-5xl px-4 pb-20 lg:px-8">
      <div className="rounded-2xl border border-[#ebd8b8] bg-white p-6 shadow-[0_16px_50px_rgba(35,26,24,0.12)] lg:p-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-[#f2e6d0] pb-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-saffron bg-[#fef3c7] shadow-md ring-4 ring-white">
                {photoPreview ? (
                  <img
                    src={getAvatarUrl(photoPreview) || ''}
                    alt="Devotee Avatar"
                    className="h-full w-full object-cover"
                    onError={() => setPhotoPreview(null)}
                  />
                ) : (
                  <DefaultDevoteeAvatar />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={tr('Upload photo', 'புகைப்படத்தை மாற்று')}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-maroon text-white shadow-md ring-2 ring-white hover:bg-saffron transition-all cursor-pointer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelect} className="hidden" />
            </div>

            <div>
              <h2 className="font-display text-2xl font-bold text-maroon leading-tight">
                {profile?.first_name} {profile?.last_name}
              </h2>
              <p className="mt-0.5 text-xs font-medium text-charcoal/70">
                {profile?.email} {profile?.phone ? `• ${profile.phone}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="self-start rounded-lg border-2 border-maroon px-4 py-1.5 text-xs font-bold text-maroon transition hover:bg-maroon hover:text-white sm:self-auto cursor-pointer"
          >
            {tr('Sign Out', 'வெளியேறு (Sign Out)')}
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-[#f2e6d0] text-sm font-bold">
          <button type="button" onClick={() => setActiveTab('profile')} className={tabClass('profile')}>
            {tr('Personal Details', 'சுயவிவரம் (Personal Details)')}
          </button>
          <button type="button" onClick={() => setActiveTab('sankalpam')} className={tabClass('sankalpam')}>
            {tr('Family Sankalpam Details', 'குடும்ப சங்கல்பம் (Sankalpam)')}
          </button>
          <button type="button" onClick={() => setActiveTab('history')} className={tabClass('history')}>
            {tr('My Bookings & Donations', 'எனது முன்பதிவுகள் & நன்கொடைகள்')}
          </button>
          <button type="button" onClick={() => setActiveTab('security')} className={tabClass('security')}>
            {tr('Password & Security', 'கடவுச்சொல் (Password)')}
          </button>
          <button type="button" onClick={() => setActiveTab('account')} className={tabClass('account')}>
            {tr('Account Options', 'கணக்கு அமைப்புகள் (Account)')}
          </button>
        </div>

        {message && (
          <div role="status" className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
            {message}
          </div>
        )}
        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* TAB: Personal Details */}
        {activeTab === 'profile' && (
          <div className="mt-6 space-y-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-charcoal">{tr('First Name *', 'முதல் பெயர் *')}</label>
                  <input type="text" required value={profile?.first_name || ''} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-charcoal">{tr('Last Name *', 'கடைசி பெயர் *')}</label>
                  <input type="text" required value={profile?.last_name || ''} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} className={inputClass} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-charcoal">Email ID</label>
                  <input type="email" disabled value={profile?.email || ''} className={`${inputClass} bg-[#f9f7f2] opacity-75 cursor-not-allowed`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-charcoal">{tr('Mobile Number *', 'தொலைபேசி எண் *')}</label>
                  <input type="text" required value={profile?.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-charcoal">{tr('Communication Address', 'தொடர்பு முகவரி')}</label>
                <textarea
                  rows={3}
                  value={profile?.comm_address || ''}
                  onChange={(e) => setProfile({ ...profile, comm_address: e.target.value })}
                  placeholder="Door No, Street Name, Landmark"
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-charcoal">{tr('City', 'நகரம் (City)')}</label>
                  <input type="text" value={profile?.city || ''} onChange={(e) => setProfile({ ...profile, city: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-charcoal">{tr('State', 'மாநிலம் (State)')}</label>
                  <input type="text" value={profile?.state || ''} onChange={(e) => setProfile({ ...profile, state: e.target.value })} className={inputClass} />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-[#f2e6d0]">
                <button type="submit" disabled={saving} className="rounded-xl bg-maroon px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-maroon/90 disabled:opacity-60 cursor-pointer transition-all">
                  {saving ? tr('Saving...', 'சேமிக்கிறது...') : tr('Save Details', 'மாற்றங்களைச் சேமி')}
                </button>
              </div>
            </form>

            {/* PAN and Aadhaar for donation receipts */}
            <section className="rounded-xl border border-[#ebd8b8] bg-[#fdfbf7] p-5 shadow-sm">
              <h3 className="font-display text-base font-bold text-maroon">
                {tr('PAN and Aadhaar for donation receipts', 'நன்கொடை ரசீதுக்கான PAN மற்றும் ஆதார்')}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-charcoal/70">
                {tr(
                  'Saved once, then filled in automatically when you donate. Your Aadhaar number is stored encrypted and is only ever shown as the last 4 digits.',
                  'ஒருமுறை சேமித்தால், நன்கொடையின் போது தானாக நிரப்பப்படும். உங்கள் ஆதார் எண் குறியாக்கம் செய்து சேமிக்கப்படும்; கடைசி 4 இலக்கங்கள் மட்டுமே காட்டப்படும்.'
                )}
              </p>

              {savedIds && !idsEditing ? (
                <div className="mt-4 space-y-3">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#ebd8b8] bg-white p-3">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-charcoal/55">PAN</dt>
                      <dd className="mt-0.5 font-mono text-sm font-semibold text-charcoal">{savedIds.panMasked}</dd>
                    </div>
                    <div className="rounded-lg border border-[#ebd8b8] bg-white p-3">
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-charcoal/55">{tr('Aadhaar', 'ஆதார்')}</dt>
                      <dd className="mt-0.5 font-mono text-sm font-semibold text-charcoal">{savedIds.aadhaarMasked}</dd>
                    </div>
                  </dl>

                  {confirmRemoveIds ? (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs font-semibold text-red-800">
                        {tr(
                          'Remove the saved PAN and Aadhaar? You will need to enter them again for your next donation. Receipts you already received are not changed.',
                          'சேமித்த PAN மற்றும் ஆதாரை நீக்கவா? அடுத்த நன்கொடைக்கு மீண்டும் உள்ளிட வேண்டும். ஏற்கெனவே பெற்ற ரசீதுகள் மாறாது.'
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={idsSaving} onClick={removeIds} className="rounded-lg bg-[#dc2626] px-4 py-2 text-xs font-bold text-white hover:bg-[#b91c1c] disabled:opacity-60 cursor-pointer">
                          {idsSaving ? tr('Removing...', 'நீக்குகிறது...') : tr('Yes, remove', 'ஆம், நீக்கு')}
                        </button>
                        <button type="button" disabled={idsSaving} onClick={() => setConfirmRemoveIds(false)} className="rounded-lg border border-[#e5d9c5] bg-white px-4 py-2 text-xs font-bold text-charcoal hover:border-maroon cursor-pointer">
                          {tr('Cancel', 'ரத்து செய்')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIdsEditing(true);
                          setIdsErr({});
                        }}
                        className="rounded-lg border-2 border-maroon px-4 py-2 text-xs font-bold text-maroon hover:bg-maroon hover:text-white transition-all cursor-pointer"
                      >
                        {tr('Replace numbers', 'எண்களை மாற்று')}
                      </button>
                      <button type="button" onClick={() => setConfirmRemoveIds(true)} className="rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50 cursor-pointer">
                        {tr('Remove', 'நீக்கு')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-charcoal">{tr('PAN Number', 'PAN எண்')}</label>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="ABCDE1234F"
                        autoComplete="off"
                        value={panInput}
                        onChange={(e) => {
                          setPanInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10));
                          setIdsErr((x) => ({ ...x, pan: undefined }));
                        }}
                        className={idsErr.pan ? inputErrClass : inputClass}
                      />
                      {idsErr.pan && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{idsErr.pan}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-charcoal">{tr('Aadhaar Number', 'ஆதார் எண்')}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={12}
                        placeholder="12-digit Aadhaar"
                        autoComplete="off"
                        value={aadhaarInput}
                        onChange={(e) => {
                          setAadhaarInput(e.target.value.replace(/\D/g, '').slice(0, 12));
                          setIdsErr((x) => ({ ...x, aadhaar: undefined }));
                        }}
                        className={idsErr.aadhaar ? inputErrClass : inputClass}
                      />
                      {idsErr.aadhaar && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{idsErr.aadhaar}</p>}
                    </div>
                  </div>
                  {idsErr.general && <p role="alert" className="text-xs font-semibold text-red-700">{idsErr.general}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={idsSaving} onClick={saveIds} className="rounded-xl bg-maroon px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-maroon/90 disabled:opacity-60 cursor-pointer transition-all">
                      {idsSaving ? tr('Saving...', 'சேமிக்கிறது...') : tr('Save PAN and Aadhaar', 'PAN மற்றும் ஆதாரைச் சேமி')}
                    </button>
                    {savedIds && (
                      <button
                        type="button"
                        disabled={idsSaving}
                        onClick={() => {
                          setIdsEditing(false);
                          setPanInput('');
                          setAadhaarInput('');
                          setIdsErr({});
                        }}
                        className="rounded-xl border border-[#e5d9c5] bg-white px-5 py-2.5 text-xs font-bold text-charcoal hover:border-maroon cursor-pointer"
                      >
                        {tr('Cancel', 'ரத்து செய்')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB: Family Sankalpam */}
        {activeTab === 'sankalpam' && (
          <form onSubmit={handleSave} className="mt-6 space-y-4">
            <p className="text-xs text-charcoal/70">
              {tr(
                'These details are automatically populated in the Sankalpam sheet for pujas, sevas and donations.',
                'சேவை முன்பதிவு மற்றும் நன்கொடையின் போது அர்ச்சனை மற்றும் சங்கல்பத்திற்கு இந்த விவரங்கள் தானாகப் பயன்படுத்தப்படும்.'
              )}
            </p>

            {familyMembers.map((member, index) => (
              <div key={index} className="rounded-xl border border-[#ebd8b8] bg-[#fdfbf7] p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-maroon">
                    {index === 0 ? tr('Primary Devotee (Self)', 'முதன்மையானவர் (Self)') : `${tr('Family Member', 'குடும்ப உறுப்பினர்')} #${index + 1}`}
                  </span>
                  {index > 0 && (
                    <button type="button" onClick={() => removeFamilyMember(index)} className="text-xs font-bold text-red-600 hover:underline cursor-pointer">
                      {tr('Remove', 'நீக்கு (Remove)')}
                    </button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-charcoal">{tr('Full Name *', 'பெயர் *')}</label>
                    <input type="text" required value={member.name || ''} onChange={(e) => updateFamilyMember(index, 'name', e.target.value)} placeholder="Name" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-charcoal">{tr('Rasi', 'ராசி')}</label>
                    <select value={member.rasi || ''} onChange={(e) => updateFamilyMember(index, 'rasi', e.target.value)} className={inputClass}>
                      <option value="">Select Rasi</option>
                      {RASI.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-charcoal">{tr('Nakshathiram', 'நட்சத்திரம்')}</label>
                    <select value={member.nakshathiram || ''} onChange={(e) => updateFamilyMember(index, 'nakshathiram', e.target.value)} className={inputClass}>
                      <option value="">Select Nakshathiram</option>
                      {NAKSHATRAM.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-charcoal">{tr('Gothram', 'கோத்ரம்')}</label>
                    <input type="text" value={member.gothram || ''} onChange={(e) => updateFamilyMember(index, 'gothram', e.target.value)} placeholder="e.g. Kashyapa / Atri" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-charcoal">{tr('Relation', 'உறவுமுறை')}</label>
                    <input type="text" value={member.relation || ''} onChange={(e) => updateFamilyMember(index, 'relation', e.target.value)} placeholder="Self / Spouse / Son / Daughter" className={inputClass} />
                  </div>
                </div>
              </div>
            ))}

            <button type="button" onClick={addFamilyMember} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border-2 border-dashed border-maroon/60 bg-white px-4 py-2 text-xs font-bold text-maroon hover:bg-rose/20 cursor-pointer transition-all">
              + {tr('Add Family Member', 'குடும்ப உறுப்பினர் சேர்க்க')}
            </button>

            <div className="flex justify-end pt-4 border-t border-[#f2e6d0]">
              <button type="submit" disabled={saving} className="rounded-xl bg-maroon px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-maroon/90 disabled:opacity-60 cursor-pointer transition-all">
                {saving ? tr('Saving...', 'சேமிக்கிறது...') : tr('Save Sankalpam', 'சங்கல்ப விவரங்களைச் சேமி')}
              </button>
            </div>
          </form>
        )}

        {/* TAB: My Bookings & Donations (by category) */}
        {activeTab === 'history' && (
          <div className="mt-6">
            {historyLoading ? (
              <p className="py-10 text-center text-sm font-semibold text-maroon animate-pulse">
                {tr('Loading your bookings and donations...', 'முன்பதிவுகள் மற்றும் நன்கொடைகள் ஏற்றப்படுகின்றன...')}
              </p>
            ) : historyError ? (
              <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-semibold text-red-700">
                {historyError}
                <button
                  type="button"
                  onClick={() => {
                    setHistoryError('');
                    setHistoryLoaded(false);
                    setHistoryTick((n) => n + 1);
                  }}
                  className="ml-3 underline cursor-pointer"
                >
                  {tr('Retry', 'மீண்டும் முயற்சி')}
                </button>
              </div>
            ) : (
              <>
                {historyPartial.length > 0 && (
                  <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                    {historyPartial.includes('seva') && tr('Seva bookings could not be loaded right now. ', 'சேவை முன்பதிவுகளை இப்போது ஏற்ற இயலவில்லை. ')}
                    {historyPartial.includes('donation') && tr('Donations could not be loaded right now. ', 'நன்கொடைகளை இப்போது ஏற்ற இயலவில்லை. ')}
                    {tr('The rest is shown below.', 'மற்றவை கீழே காட்டப்படுகின்றன.')}
                  </div>
                )}

                {/* Category chips */}
                <div role="tablist" aria-label={tr('Category', 'வகை')} className="flex flex-wrap gap-2">
                  {(['all', ...KINDS] as KindFilter[]).map((k) => {
                    const on = kindFilter === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => setKindFilter(k)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                          on ? 'border-maroon bg-maroon text-white' : 'border-[#e5d9c5] bg-white text-charcoal hover:border-maroon hover:text-maroon'
                        }`}
                      >
                        {k === 'all' ? tr('All', 'அனைத்தும்') : KIND_LABEL[k]}
                        <span className={`ml-1.5 font-semibold ${on ? 'text-white/80' : 'text-charcoal/50'}`}>{countFor(k)}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal/55">
                      {kindFilter === 'all' ? tr('Total paid', 'மொத்தம் செலுத்தியது') : `${KIND_LABEL[kindFilter as Kind]} · ${tr('Total paid', 'மொத்தம்')}`}
                    </p>
                    <p className="font-display text-2xl font-bold text-maroon">₹ {paidTotal.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-charcoal/60">
                      {paidCount} {tr('paid', 'செலுத்தப்பட்டவை')}
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-charcoal">
                    <input type="checkbox" checked={showUnpaid} onChange={(e) => setShowUnpaid(e.target.checked)} className="h-4 w-4 accent-maroon" />
                    {tr('Show attempts that were not completed', 'நிறைவடையாத முயற்சிகளையும் காட்டு')}
                  </label>
                </div>

                {visibleItems.length === 0 ? (
                  <div className="py-12 text-center text-charcoal/70">
                    <p className="text-sm font-semibold">
                      {kindFilter === 'all'
                        ? tr('You have no bookings or donations yet.', 'இன்னும் முன்பதிவுகள் அல்லது நன்கொடைகள் இல்லை.')
                        : tr('Nothing here yet in this category.', 'இந்த வகையில் இன்னும் எதுவும் இல்லை.')}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      <Link href={listHref(kindFilter === 'all' ? 'seva_list' : kindFilter)} className="inline-block rounded-xl bg-maroon px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-maroon/90 transition-all">
                        {kindFilter === 'all' || kindFilter.startsWith('seva') ? tr('Book a Seva', 'சேவா முன்பதிவு செய்ய') : tr('View donation funds', 'நிதிகளைக் காண்க')}
                      </Link>
                      {kindFilter === 'all' && (
                        <Link href={listHref('donation_list')} className="inline-block rounded-xl border-2 border-maroon px-5 py-2.5 text-xs font-bold text-maroon hover:bg-maroon hover:text-white transition-all">
                          {tr('View donation funds', 'நிதிகளைக் காண்க')}
                        </Link>
                      )}
                    </div>
                  </div>
                ) : (
                  <ul className="mt-4 divide-y divide-[#f2e6d0] rounded-xl border border-[#ebd8b8]">
                    {visibleItems.map((i) => {
                      const chip = statusChip(i.status);
                      return (
                        <li key={i.key} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-saffron">{KIND_LABEL[i.kind]}</p>
                            <p className="text-sm font-bold text-maroon">{isTa ? i.title_ta || i.title_en : i.title_en}</p>
                            <p className="mt-0.5 text-xs text-charcoal/70">
                              {tr('Date', 'நாள்')}: {formatDate(i.date) || formatDate(i.created_at)}
                              {i.receipt_no ? ` • ${i.receipt_no}` : ''}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${chip.cls}`}>{chip.text}</span>
                            <span className="text-sm font-bold text-charcoal">₹ {Number(i.amount || 0).toLocaleString('en-IN')}</span>
                            {i.status === 'SUCCESS' && (
                              <Link
                                href={receiptHref(i)}
                                className="rounded-lg border-2 border-maroon px-3 py-1.5 text-xs font-bold text-maroon hover:bg-maroon hover:text-white transition-all"
                              >
                                {tr('Receipt', 'ரசீது')}
                              </Link>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB: Password & Security */}
        {activeTab === 'security' && (
          <form onSubmit={handlePasswordChange} className="mt-6 max-w-lg space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-charcoal">{tr('Current Password *', 'தற்போதைய கடவுச்சொல் *')}</label>
              <input type={showPw ? 'text' : 'password'} required autoComplete="current-password" value={pwForm.current_password} onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-charcoal">{tr('New Password *', 'புதிய கடவுச்சொல் *')}</label>
              <input type={showPw ? 'text' : 'password'} required autoComplete="new-password" value={pwForm.new_password} onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} className={inputClass} />
              <p className="mt-1 text-[11px] text-charcoal/60">{tr('Must be at least 8 characters long.', 'குறைந்தது 8 எழுத்துக்கள் கொண்டிருக்க வேண்டும்.')}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-charcoal">{tr('Confirm New Password *', 'புதிய கடவுச்சொல்லை மீண்டும் உள்ளிடவும் *')}</label>
              <input type={showPw ? 'text' : 'password'} required autoComplete="new-password" value={pwForm.confirm_password} onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })} className={inputClass} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="showPassword" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} className="h-4 w-4 accent-maroon" />
              <label htmlFor="showPassword" className="text-xs font-semibold text-charcoal cursor-pointer">{tr('Show Passwords', 'கடவுச்சொல்லைக் காட்டு')}</label>
            </div>
            <div className="pt-2">
              <button type="submit" disabled={pwSaving} className="rounded-xl bg-maroon px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-maroon/90 disabled:opacity-60 cursor-pointer transition-all">
                {pwSaving ? tr('Updating...', 'மாற்றுகிறது...') : tr('Update Password', 'கடவுச்சொல்லை மாற்று')}
              </button>
            </div>
          </form>
        )}

        {/* TAB: Account Options */}
        {activeTab === 'account' && (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-[#ebd8b8] bg-[#fdfbf7] p-5 shadow-sm">
              <h3 className="font-display text-base font-bold text-maroon">{tr('Session & Devices', 'அமர்வு மேலாண்மை (Session & Devices)')}</h3>
              <p className="mt-1 text-xs text-charcoal/70">{tr('Log out from your current browser session.', 'உங்கள் தற்போதைய உலாவி அமர்விலிருந்து வெளியேறலாம்.')}</p>
              <div className="mt-4">
                <button type="button" onClick={handleLogout} className="rounded-lg border-2 border-maroon px-4 py-2 text-xs font-bold text-maroon hover:bg-maroon hover:text-white transition-all cursor-pointer">
                  {tr('Sign Out of Account', 'வெளியேறு (Sign Out)')}
                </button>
              </div>
            </div>

            <div className="rounded-xl border-2 border-red-200 bg-[#fff5f5] p-5 shadow-sm">
              <h3 className="font-display text-base font-bold text-[#b91c1c]">{tr('Delete Devotee Account', 'கணக்கு நீக்கம் (Danger Zone)')}</h3>
              <p className="mt-1.5 text-xs text-[#7f1d1d]/85 leading-relaxed">
                {tr(
                  'Permanently remove your devotee account, registered family details, and preferences. This action cannot be undone.',
                  'உங்கள் கணக்கு நீக்கப்பட்டால், உங்கள் சுயவிவரம் மற்றும் குடும்ப சங்கல்ப விவரங்கள் நிரந்தரமாக நீக்கப்படும். இந்த செயலை மாற்றியமைக்க முடியாது.'
                )}
              </p>
              <div className="mt-4 pt-3 border-t border-red-200">
                {confirmDelete ? (
                  <div role="alert" className="space-y-3">
                    <p className="text-xs font-bold text-red-800">
                      {tr('Are you sure you want to permanently delete your account?', 'உறுதியாக உங்கள் கணக்கை நிரந்தரமாக நீக்க விரும்புகிறீர்களா?')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={handleDeleteAccount} className="rounded-xl bg-[#dc2626] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#b91c1c] cursor-pointer">
                        {tr('Yes, delete my account', 'ஆம், கணக்கை நீக்கு')}
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-xl border border-[#e5d9c5] bg-white px-5 py-2.5 text-xs font-bold text-charcoal hover:border-maroon cursor-pointer">
                        {tr('Cancel', 'ரத்து செய்')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#dc2626] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#b91c1c] active:scale-95 transition-all cursor-pointer">
                    {tr('Permanently Delete Account', 'கணக்கை நிரந்தரமாக நீக்கு')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}