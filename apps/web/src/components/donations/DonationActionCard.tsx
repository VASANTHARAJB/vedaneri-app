'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { DonationFund } from '@/type/donation';
import { rupees } from '@/lib/format';

const TOKEN_KEYS = ['devotee_token', 'token', 'auth_token', 'accessToken'];
const QUICK_AMOUNTS = [501, 1008, 2001, 5001];

function readToken(): string {
  if (typeof window === 'undefined') return '';
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return '';
}

export default function DonationActionCard({ fund, locale }: { fund: DonationFund; locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const isTa = locale === 'ta';
  const tr = (en: string, ta: string) => (isTa ? ta : en);

  const isCorpus = fund.category === 'corpus';
  const isOpen = fund.price_type === 'custom' || !(Number(fund.amount) > 0);
  const openLabel = isCorpus ? tr('Part Payment', 'பகுதி கட்டணம்') : tr('Yathashakti', 'யதாசக்தி');
  const title = isTa ? fund.title_ta || fund.title_en : fund.title_en;

  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setLoggedIn(Boolean(readToken()));
    setChecking(false);
  }, []);

  const loginHref = `/${locale}/login?redirect=${encodeURIComponent(pathname || `/${locale}/donate/${fund.slug}`)}`;

  const proceed = () => {
    if (isOpen) {
      const n = Number(amount);
      if (!amount.trim() || !Number.isFinite(n) || n < 1) {
        setError(tr('Please enter an amount of ₹1 or more.', '₹1 அல்லது அதற்கு மேல் தொகையை உள்ளிடவும்.'));
        return;
      }
      router.push(`/${locale}/donate/${fund.slug}/checkout?amount=${encodeURIComponent(String(n))}`);
      return;
    }
    router.push(`/${locale}/donate/${fund.slug}/checkout`);
  };

  return (
    <div className="overflow-hidden rounded-md border border-sand bg-white shadow-md">
      <div className="border-t-4 border-saffron bg-maroon px-6 py-5 text-white">
        <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-saffron">
          {tr('Make a Donation', 'நன்கொடை அளிக்க')}
        </span>
        <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-white [html[lang='ta']_&]:leading-[1.4]">
          {title}
        </h3>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/20 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
            {tr('Donation Amount', 'நன்கொடைத் தொகை')}
          </span>
          <span className="text-right text-lg font-bold leading-none text-saffron">
            {isOpen ? openLabel : rupees(fund.amount)}
          </span>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {checking ? (
          <p className="py-6 text-center text-xs font-semibold uppercase tracking-wider text-charcoal/60">
            {tr('Verifying session...', 'சரிபார்க்கப்படுகிறது...')}
          </p>
        ) : !loggedIn ? (
          <div className="space-y-4 rounded-md border border-sand bg-cream/60 p-5 text-center">
            <h4 className="font-display text-base font-semibold text-maroon">
              {tr('Login to Donate', 'நன்கொடை அளிக்க உள்நுழைக')}
            </h4>
            <p className="font-serif text-[13px] leading-relaxed text-charcoal/75">
              {tr(
                'Please log in to your account so that your receipt is issued in your name.',
                'உங்கள் பெயரில் ரசீது வழங்கப்பட உங்கள் கணக்கில் உள்நுழையவும்.'
              )}
            </p>
            <Link
              href={loginHref}
              className="flex w-full items-center justify-center rounded-md bg-saffron px-4 py-3 text-sm font-bold text-charcoal transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
            >
              {tr('Go to Login Page', 'உள்நுழைவுப் பக்கத்திற்குச் செல்க')}
            </Link>
          </div>
        ) : (
          <>
            {isOpen && (
              <div className="space-y-3">
                <label htmlFor="donation-amount" className="block text-[11px] font-bold uppercase tracking-[0.16em] text-charcoal/70">
                  {tr('Enter Amount (₹ INR)', 'தொகையை உள்ளிடவும் (₹)')}
                </label>
                <input
                  id="donation-amount"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. 1008"
                  className={`h-12 w-full rounded-md border bg-white px-4 text-xl font-bold text-charcoal placeholder:font-normal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-saffron/40 ${
                    error ? 'border-red-500' : 'border-sand focus:border-maroon'
                  }`}
                />
                {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        setAmount(String(a));
                        setError('');
                      }}
                      className={`min-h-[40px] cursor-pointer rounded-md border px-3.5 text-sm font-bold transition-colors ${
                        amount === String(a)
                          ? 'border-maroon bg-maroon text-white'
                          : 'border-sand bg-white text-charcoal hover:border-maroon hover:text-maroon'
                      }`}
                    >
                      ₹{a.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={proceed}
              className="flex w-full cursor-pointer items-center justify-center rounded-md bg-saffron px-4 py-3.5 text-sm font-bold text-charcoal transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon"
            >
              {tr('Proceed to Donate', 'நன்கொடைக்குத் தொடர்க')}
            </button>
          </>
        )}

        <p className="border-t border-sand pt-4 text-[12px] leading-relaxed text-charcoal/65">
          {tr(
            'Secure online payment. A receipt is sent to your email after the payment is confirmed.',
            'பாதுகாப்பான இணையவழி கட்டணம். கட்டணம் உறுதியான பின் ரசீது மின்னஞ்சலுக்கு அனுப்பப்படும்.'
          )}
        </p>
      </div>
    </div>
  );
}