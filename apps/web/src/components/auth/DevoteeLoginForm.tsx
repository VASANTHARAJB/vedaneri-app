'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const INPUT =
  'h-12 w-full rounded-xl border border-[#e8dcc6] bg-white px-4 text-base text-charcoal placeholder:text-charcoal/40 focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30';
const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron';

export default function DevoteeLoginForm({ locale }: { locale: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const isTa = locale === 'ta';
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

  // Only allow redirects to paths on this site.
  const raw = params.get('redirect') || '';
  const redirectTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : `/${locale}/sevas`;

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) {
      setError(isTa ? 'மின்னஞ்சல் அல்லது தொலைபேசி எண்ணை உள்ளிடவும்.' : 'Please enter your email or phone number.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE}/devotee/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          phone: phone.trim(),
          first_name: '',
          last_name: '',
        }),
      });

      if (!res.ok) {
        setError(
          isTa
            ? 'உள்நுழைவு தோல்வியடைந்தது. மின்னஞ்சல் / தொலைபேசி எண்ணைச் சரிபார்க்கவும்.'
            : 'Login failed. Please check your email / phone number.'
        );
        return;
      }

      const json = await res.json();
      localStorage.setItem('devotee_token', json.token);
      router.replace(redirectTo);
    } catch (_) {
      setError(isTa ? 'நெட்வொர்க் பிழை. மீண்டும் முயற்சிக்கவும்.' : 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-rose">
      <div className="bg-maroon px-6 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-saffron">
          {isTa ? 'பக்தர் உள்நுழைவு' : 'Devotee Login'}
        </p>
        <h1 style={{ color: '#ffffff' }} className="mt-1 font-display text-2xl font-semibold leading-snug">
          {isTa ? 'உள்நுழைக / பதிவு செய்க' : 'Login / Register'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 p-6 text-charcoal">
        <p className="text-sm leading-relaxed text-charcoal/80">
          {isTa
            ? 'காணிக்கை செலுத்தவும் உங்களது கோத்திரம், குடும்ப விவரங்களை தானாக சேமிக்கவும் மின்னஞ்சல் அல்லது தொலைபேசி எண்ணை உள்ளிடவும்.'
            : 'Enter your email or phone number. Your family & gothram details are saved and restored automatically on every visit.'}
        </p>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Email ID</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className={INPUT}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Mobile / WhatsApp Number</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9876543210"
            className={INPUT}
          />
        </label>

        <p className="text-xs text-charcoal/60">{isTa ? 'ஏதேனும் ஒன்று போதும்.' : 'Either one is enough.'}</p>

        {error && (
          <p role="alert" className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#be123c]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`h-12 w-full rounded-xl bg-saffron text-base font-bold text-charcoal shadow-md transition-colors hover:bg-maroon hover:text-white disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
        >
          {loading ? (isTa ? 'சரிபார்க்கிறது...' : 'Verifying...') : isTa ? 'தொடர்க' : 'Continue'}
        </button>

        <Link
          href={redirectTo}
          className={`block rounded text-center text-sm font-semibold text-maroon hover:underline ${FOCUS}`}
        >
          ← {isTa ? 'திரும்பிச் செல்' : 'Go back'}
        </Link>
      </form>
    </div>
  );
}   