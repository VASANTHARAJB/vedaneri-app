import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

// Images direct from apps/web/public/images
import swamijiCutout from '@images/swamiji-cutout.png';
import ashramSeal from '@images/ashram-seal.png';

const HANDS = [{ x: 31, y: 52 }, { x: 67, y: 52 }];
const SPARKLES = [
  { dx: 0, dy: -9, size: 20, delay: 0 },
  { dx: -7, dy: -2, size: 13, delay: 0.7 },
  { dx: 7, dy: -4, size: 15, delay: 1.4 },
  { dx: -4, dy: 8, size: 11, delay: 2.0 },
  { dx: 6, dy: 7, size: 17, delay: 0.4 },
  { dx: 0, dy: 0, size: 12, delay: 1.1 },
];

const Icon = ({ d }: { d: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export default function Login() {
  const { user, login } = useAuth();
  const loc = useLocation() as { state?: { from?: string } };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [agreed, setAgreed] = useState(true); // Default checked for slick SaaS flow
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={loc.state?.from ?? '/'} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setErr('Please accept the 24-hour session terms to sign in.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await login(email.trim(), password);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'Cannot reach the server. Check that the API is running.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f5f8] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans text-slate-800">
      {/* SaaS Main Card */}
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        
        {/* Left Side: SaaS Form */}
        <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between bg-white">
          <div>
            {/* Top SaaS Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={ashramSeal}
                  alt="Ashram Seal"
                  className="h-10 w-10 rounded-full object-contain ring-1 ring-amber-500/30"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-xl text-[#7a1c1c] tracking-tight">Vedaneri</span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-800 border border-amber-500/20 rounded-full tracking-wide uppercase">
                      Admin Console
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-400">Identity & Operations Portal</p>
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="mt-8">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-sans">
                Sign in to your account
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Manage sevas, donations, camps, and temple records.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon d="M4 6h16v12H4zM4 7l8 6 8-6" />
                  </span>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@vedaneri.org"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-[#7a1c1c] focus:outline-none focus:ring-4 focus:ring-[#7a1c1c]/10"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Password
                  </label>
                  {caps && <span className="text-[11px] font-semibold text-amber-600">Caps Lock ON</span>}
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
                  </span>
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))}
                    onBlur={() => setCaps(false)}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-[#7a1c1c] focus:outline-none focus:ring-4 focus:ring-[#7a1c1c]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                    aria-label="Toggle password visibility"
                  >
                    <Icon d={show ? 'M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-3.2 3.7M6.6 7.7A15 15 0 0 0 3 12s4 6 9 6a9 9 0 0 0 3.4-.7M9.9 10a3 3 0 0 0 4.1 4.1' : 'M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'} />
                  </button>
                </div>
              </div>

              {/* 24-Hour & Terms Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#7a1c1c] focus:ring-[#7a1c1c] accent-[#7a1c1c] cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 leading-normal">
                    Keep me signed in for <strong>24 hours</strong>. I acknowledge that all administrative actions on this portal are audited.
                  </span>
                </label>
              </div>

              {/* Error Message */}
              {err && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center gap-2">
                  <span className="text-sm">⚠️</span>
                  <span>{err}</span>
                </div>
              )}

              {/* Sign In Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={busy || !email || !password || !agreed}
                  className="w-full py-3 px-4 rounded-lg bg-[#7a1c1c] hover:bg-[#641414] active:bg-[#520f0f] text-white font-semibold text-sm shadow-md shadow-[#7a1c1c]/25 hover:shadow-lg hover:shadow-[#7a1c1c]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <span>Sign In to Dashboard →</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Zoho SaaS Style Discrete Footer */}
          <div className="pt-8 mt-6 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Secured by 256-bit SSL</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              API Online (v1)
            </span>
          </div>
        </div>

        {/* Right Side: Sacred Ashram Hero Panel */}
        <div className="hidden lg:flex lg:col-span-6 bg-gradient-to-br from-[#7a1c1c] via-[#591313] to-[#2b0808] p-10 flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Subtle Glow */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Swamiji Arch */}
          <div className="relative aspect-[4/5] h-[min(23rem,calc(100vh-14rem))] z-10">
            <div className="absolute -inset-2 rounded-t-full border border-amber-400/40" />
            <div className="absolute inset-0 rounded-t-full shadow-[0_0_40px_rgba(217,119,6,0.45)]" />
            <div className="relative h-full w-full overflow-hidden rounded-t-full border-2 border-amber-400 bg-stone-900 flex items-center justify-center">
              <img
                src={swamijiCutout}
                alt="Swami Chidbhavananda"
                className="h-full w-full object-contain pt-4 drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)]"
              />
              {HANDS.map((h, hi) => (
                <div key={hi}>
                  <div
                    className="halo absolute h-16 w-16 rounded-full bg-[radial-gradient(circle,rgba(255,226,160,0.75),transparent_70%)]"
                    style={{ left: `${h.x}%`, top: `${h.y}%`, marginLeft: -32, marginTop: -32 }}
                  />
                  {SPARKLES.map((s, i) => (
                    <svg
                      key={i}
                      viewBox="0 0 24 24"
                      className="sparkle absolute text-white"
                      style={{
                        left: `calc(${h.x}% + ${s.dx}%)`,
                        top: `calc(${h.y}% + ${s.dy}%)`,
                        width: s.size * 0.85,
                        height: s.size * 0.85,
                        marginLeft: -s.size * 0.425,
                        marginTop: -s.size * 0.425,
                        animationDelay: `${s.delay + hi * 0.5}s`,
                      }}
                    >
                      <path d="M12 0c.8 6.2 5.8 11.2 12 12-6.2.8-11.2 5.8-12 12-.8-6.2-5.8-11.2-12-12C6.2 11.2 11.2 6.2 12 0z" fill="currentColor" />
                    </svg>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-7 z-10">
            <p className="font-serif text-2xl font-bold text-white tracking-wide">
              Dharma Rakshati Rakshitah
            </p>
            <p className="mt-1 text-xs text-amber-200/80 font-medium">
              Sri Swami Chidbhavananda Ashramam, Vedapuri, Theni
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}