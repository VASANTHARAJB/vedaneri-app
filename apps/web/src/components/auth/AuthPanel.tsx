'use client';

import React, { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import GoogleAuthButton from './GoogleAuthButton';

interface AuthPanelProps {
  locale: string;
  t: any;
  siteTagline?: string;
  languageLabel?: string;
  initialTab?: 'login' | 'register';
}

const INPUT =
  'h-11 w-full rounded-xl border border-[#e8dcc6] bg-white px-3.5 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30';

export default function AuthPanel({
  locale,
  t,
  siteTagline,
  initialTab = 'login',
}: AuthPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTa = locale === 'ta';
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginTerms, setLoginTerms] = useState(true);

  // Register Form States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [regTerms, setRegTerms] = useState(false);

  // Photo Upload State (Optional)
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpTargetEmail, setOtpTargetEmail] = useState('');
  const [mockOtpHint, setMockOtpHint] = useState('');

  // Status & Loaders
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const rawRedirect = searchParams.get('redirect') || '';
  const redirectTo =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      ? rawRedirect
      : `/${locale}/sevas`;

  // 1. Photo Selection Handler
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setError(isTa ? 'புகைப்படம் 4MB-க்குள் இருக்க வேண்டும்.' : 'Photo must be under 4MB.');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // 2. Handle Login Submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!loginTerms) {
      setError(isTa ? 'விதிமுறைகளை ஏற்க வேண்டும்.' : 'You must accept the Terms and Conditions.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/devotee-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: loginIdentifier,
          password: loginPassword,
          terms_accepted: loginTerms,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requiresOtp) {
          setOtpTargetEmail(data.email);
          setShowOtpModal(true);
          return;
        }
        throw new Error(data.message || 'Login failed');
      }

      localStorage.setItem('devotee_token', data.token);
      router.replace(redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message || (isTa ? 'உள்நுழைவு தோல்வியடைந்தது.' : 'Login failed.'));
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Registration Submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!regTerms) {
      setError(isTa ? 'விதிமுறைகளை ஏற்க வேண்டும்.' : 'You must accept the Terms and Conditions.');
      return;
    }

    if (regPassword !== confirmPassword) {
      setError(isTa ? 'கடவுச்சொற்கள் பொருந்தவில்லை.' : 'Passwords do not match.');
      return;
    }

    // PAN Format Validation (ABCDE1234F) if provided
    if (panNumber.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.trim().toUpperCase())) {
      setError(isTa ? 'சரியான பான் (PAN) எண்ணை உள்ளிடவும்.' : 'Please enter a valid 10-character PAN (e.g. ABCDE1234F).');
      return;
    }

    // Aadhaar Format Validation (12 Digits) if provided
    const cleanAadhaar = aadhaarNumber.replace(/\s+/g, '');
    if (cleanAadhaar && !/^\d{12}$/.test(cleanAadhaar)) {
      setError(isTa ? 'ஆதார் எண் 12 இலக்கங்களாக இருக்க வேண்டும்.' : 'Aadhaar must be exactly 12 digits.');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('first_name', firstName);
      formData.append('last_name', lastName);
      formData.append('email', regEmail);
      formData.append('phone', regPhone);
      formData.append('password', regPassword);
      formData.append('confirm_password', confirmPassword);
      formData.append('aadhaar_number', cleanAadhaar);
      formData.append('pan_number', panNumber.trim().toUpperCase());
      formData.append('terms_accepted', String(regTerms));
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      const res = await fetch(`${API_BASE}/devotee-auth/register`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setOtpTargetEmail(data.email);
      if (data.mockOtp) setMockOtpHint(data.mockOtp);
      setShowOtpModal(true);
    } catch (err: any) {
      setError(err.message || (isTa ? 'பதிவு தோல்வியடைந்தது.' : 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle OTP Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/devotee-auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpTargetEmail, otp: otpValue }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid OTP');
      }

      localStorage.setItem('devotee_token', data.token);
      setShowOtpModal(false);
      setSuccessMsg(isTa ? 'கணக்கு வெற்றிகரமாக உருவாக்கப்பட்டது!' : 'Account verified successfully! Redirecting...');

      setTimeout(() => {
        router.replace(redirectTo);
        router.refresh();
      }, 800);
    } catch (err: any) {
      setError(err.message || (isTa ? 'OTP சரிபார்ப்பு தோல்வியடைந்தது.' : 'OTP verification failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-between p-6 sm:p-8">
      <div>
        {/* Header */}
        <div className="border-b border-[#f2e6d0] pb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-saffron">
            {isTa ? 'ஸ்ரீ வேதநேரி ஆசிரமம்' : 'Sri Vedaneri Ashram'}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-maroon">
            {activeTab === 'login'
              ? isTa ? 'பக்தர் உள்நுழைவு' : 'Devotee Sign In'
              : isTa ? 'புதிய பக்தர் பதிவு' : 'Create an Account'}
          </h2>
          {siteTagline && <p className="text-xs text-charcoal/60 mt-0.5">{siteTagline}</p>}
        </div>

        {/* Tab Switcher */}
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-sand/20 p-1 border border-sand/40">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setError(''); }}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'login' ? 'bg-white text-maroon shadow-xs' : 'text-charcoal/70 hover:text-charcoal'
            }`}
          >
            {isTa ? 'உள்நுழைக (Sign In)' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setError(''); }}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'register' ? 'bg-white text-maroon shadow-xs' : 'text-charcoal/70 hover:text-charcoal'
            }`}
          >
            {isTa ? 'புதிய கணக்கு (Create Account)' : 'Create Account'}
          </button>
        </div>

        {/* Google One-Tap / Sign-In Button */}
        <div className="mt-5">
          <GoogleAuthButton locale={locale} />
        </div>

        {/* Divider */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="w-full border-t border-[#f0e2c8]" />
          <span className="absolute bg-white px-3 text-[10.5px] font-bold uppercase tracking-wider text-charcoal/50">
            {isTa ? 'அல்லது' : 'OR'}
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-600">
            {error}
          </p>
        )}

        {/* Success Alert */}
        {successMsg && (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-700">
            {successMsg}
          </p>
        )}

        {/* A. LOGIN FORM */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold mb-1 text-charcoal">
                {isTa ? 'மின்னஞ்சல் அல்லது தொலைபேசி எண் *' : 'Email ID or Mobile Number *'}
              </label>
              <input
                type="text"
                required
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="name@example.com / 9876543210"
                className={INPUT}
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-charcoal">
                {isTa ? 'கடவுச்சொல் (Password) *' : 'Password *'}
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className={INPUT}
              />
            </div>

            {/* Terms and Conditions Checkbox */}
            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="login-terms"
                checked={loginTerms}
                onChange={(e) => setLoginTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-sand text-maroon focus:ring-saffron"
              />
              <label htmlFor="login-terms" className="text-xs text-charcoal/80 cursor-pointer">
                {isTa ? 'நான் ஆசிரமத்தின் ' : 'I agree to the '}
                <a href={`/${locale}/terms`} target="_blank" className="font-bold text-maroon hover:underline">
                  {isTa ? 'விதிமுறைகள் மற்றும் நிபந்தனைகளை' : 'Terms and Conditions'}
                </a>
                {isTa ? ' ஏற்கிறேன்.' : '.'}
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-saffron text-sm font-bold text-charcoal shadow-sm hover:bg-maroon hover:text-white transition-all cursor-pointer disabled:opacity-60"
            >
              {loading ? (isTa ? 'சரிபார்க்கிறது...' : 'Verifying...') : (isTa ? 'உள்நுழைக' : 'Sign In')}
            </button>
          </form>
        ) : (
          /* B. CREATE ACCOUNT FORM */
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            {/* First Name & Last Name */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold mb-1 text-charcoal">
                  {isTa ? 'முதல் பெயர் *' : 'First Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Nagaraj"
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-charcoal">
                  {isTa ? 'கடைசி பெயர் *' : 'Last Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Iyer"
                  className={INPUT}
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold mb-1 text-charcoal">
                  Email ID *
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@mail.com"
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-charcoal">
                  {isTa ? 'தொலைபேசி எண் *' : 'Mobile Number *'}
                </label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="9876543210"
                  className={INPUT}
                />
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold mb-1 text-charcoal">
                  {isTa ? 'கடவுச்சொல் *' : 'Password *'}
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-charcoal">
                  {isTa ? 'உறுதி செய்க *' : 'Confirm Password *'}
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className={INPUT}
                />
              </div>
            </div>

            {/* Aadhaar & PAN Number */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold mb-1 text-charcoal">
                  {isTa ? 'ஆதார் எண் *' : 'Aadhaar Number *'}
                </label>
                <input
                  type="text"
                  required
                  maxLength={12}
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value)}
                  placeholder="12-digit Aadhaar Number"
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-charcoal">
                  {isTa ? 'பான் எண் (PAN) *' : 'PAN Card Number *'}
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className={INPUT}
                />
              </div>
            </div>

            {/* Optional Photo Upload */}
            <div>
              <label className="block text-xs font-bold mb-1 text-charcoal">
                {isTa ? 'புகைப்படம் (Photo - விருப்பத்தேர்வு)' : 'Photo (Optional)'}
              </label>
              <div className="flex items-center gap-3">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="h-10 w-10 rounded-full object-cover border border-saffron"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-sand/30 flex items-center justify-center text-sm">
                    📷
                  </div>
                )}
                <input
                  type="file"
                  ref={photoInputRef}
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-sand bg-cream text-xs font-bold text-charcoal hover:bg-sand/30 cursor-pointer"
                >
                  {photoFile ? photoFile.name.slice(0, 15) + '...' : (isTa ? 'புகைப்படம் தேர்வு செய்க' : 'Choose Photo')}
                </button>
              </div>
            </div>

            {/* Terms and Conditions Checkbox */}
            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                required
                id="reg-terms"
                checked={regTerms}
                onChange={(e) => setRegTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-sand text-maroon focus:ring-saffron"
              />
              <label htmlFor="reg-terms" className="text-xs text-charcoal/80 cursor-pointer">
                {isTa ? 'நான் ஆசிரமத்தின் ' : 'I agree to the '}
                <a href={`/${locale}/terms`} target="_blank" className="font-bold text-maroon hover:underline">
                  {isTa ? 'விதிமுறைகள் மற்றும் நிபந்தனைகளை' : 'Terms and Conditions'}
                </a>
                {isTa ? ' ஏற்கிறேன்.' : '.'}
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-saffron text-sm font-bold text-charcoal shadow-sm hover:bg-maroon hover:text-white transition-all cursor-pointer disabled:opacity-60"
            >
              {loading ? (isTa ? 'உருவாக்குகிறது...' : 'Creating Account...') : (isTa ? 'கணக்கை உருவாக்கு (Create Account)' : 'Create Account')}
            </button>
          </form>
        )}
      </div>

      {/* OTP VERIFICATION MODAL */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-sand shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-display text-lg font-bold text-maroon">
              {isTa ? 'OTP சரிபார்ப்பு' : 'Verify Your Account'}
            </h3>
            <p className="text-xs text-charcoal/80">
              {isTa
                ? `${otpTargetEmail} என்ற மின்னஞ்சலுக்கு அனுப்பப்பட்ட 6 இலக்க OTP எண்ணை உள்ளிடவும்.`
                : `Enter the 6-digit OTP code sent to ${otpTargetEmail}.`}
            </p>

            {mockOtpHint && (
              <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 p-2 rounded-lg">
                Dev OTP: {mockOtpHint}
              </p>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <input
                type="text"
                required
                maxLength={6}
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value)}
                placeholder="123456"
                className="w-full text-center tracking-widest text-2xl font-bold h-12 rounded-xl border border-sand focus:border-saffron focus:outline-none"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-sand text-xs font-bold text-charcoal hover:bg-sand/20 cursor-pointer"
                >
                  {isTa ? 'ரத்து' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-saffron text-xs font-bold text-charcoal hover:bg-maroon hover:text-white transition-all cursor-pointer"
                >
                  {loading ? 'Verifying...' : (isTa ? 'உறுதி செய்க' : 'Verify & Login')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-6 border-t border-[#f2e6d0] pt-3 text-center">
        <p className="text-[11px] text-charcoal/60">
          🔒 {isTa ? 'அனைத்து விவரங்களும் மாரியாதளத்தில் பாதுகாப்பாக சேமிக்கப்படும்.' : 'Encrypted & secured in MariaDB.'}
        </p>
      </div>
    </div>
  );
}