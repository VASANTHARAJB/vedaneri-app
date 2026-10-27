'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useParams, usePathname } from 'next/navigation';

interface ReceiptMember {
  title?: string;
  name: string;
  gothram?: string;
  nakshathiram?: string;
  rasi?: string;
  relation?: string;
}

interface DonationReceipt {
  receiptNo: string;
  category?: 'donation' | 'corpus' | 'ashram';
  fundName: string;
  donationDate: string;
  amount: number;
  paymentId: string;
  paymentStatus: string;
  createdAt: string;
  panNumber?: string;
  aadhaarNumber?: string;
  familyMembers: ReceiptMember[];
  donor: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
  };
}

type LoadState = 'loading' | 'ok' | 'unauthorized' | 'notfound' | 'error' | 'missing';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const TOKEN_KEYS = ['devotee_token', 'token', 'auth_token', 'accessToken'];

function readToken(): string {
  if (typeof window === 'undefined') return '';
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return '';
}

// Plain dates (YYYY-MM-DD) are shown as they are.
// Timestamps are converted to Indian time first, so late-night payments never show the wrong day.
function formatDate(value?: string | null): string {
  if (!value) return '';
  const s = String(value);
  const plain = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plain) return `${plain[3]}.${plain[2]}.${plain[1]}`;

  const dt = new Date(s);
  if (isNaN(dt.getTime())) return '';
  return dt
    .toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace(/\//g, '.');
}

const CARD = 'rounded-md border border-sand bg-white';
const LABEL = 'block text-[10px] font-bold uppercase tracking-[0.14em] text-charcoal/55';

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 rounded-md border border-sand bg-white p-5 sm:p-8">
      <div className="h-6 w-2/3 rounded bg-sand/50" />
      <div className="h-4 w-1/3 rounded bg-sand/50" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 rounded bg-sand/40" />
        <div className="h-24 rounded bg-sand/40" />
      </div>
      <div className="h-32 rounded bg-sand/40" />
    </div>
  );
}

function NoticeCard({
  tone,
  title,
  text,
  children,
}: {
  tone: 'error' | 'warn' | 'info';
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  const tones = {
    error: 'border-red-200 border-l-red-600',
    warn: 'border-amber-300 border-l-amber-500',
    info: 'border-sand border-l-maroon',
  } as const;
  return (
    <div className={`${CARD} border-l-4 p-5 sm:p-6 ${tones[tone]}`}>
      <h1 className="font-display text-lg font-semibold text-maroon sm:text-xl">{title}</h1>
      <p className="mt-2 font-serif text-sm leading-relaxed text-charcoal/75">{text}</p>
      {children && <div className="mt-5 flex flex-col gap-3 sm:flex-row">{children}</div>}
    </div>
  );
}

const BTN_PRIMARY =
  'inline-flex w-full items-center justify-center rounded-md bg-saffron px-5 py-3 text-sm font-bold text-charcoal transition-colors hover:bg-maroon hover:text-white sm:w-auto';
const BTN_SECONDARY =
  'inline-flex w-full items-center justify-center rounded-md border border-sand bg-white px-5 py-3 text-sm font-bold text-charcoal transition-colors hover:border-maroon hover:text-maroon sm:w-auto';

function StatusContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const pathname = usePathname();

  const locale = (params?.locale as string) || 'en';
  const isTa = locale === 'ta';
  const tr = (en: string, ta: string) => (isTa ? ta : en);

  const status = searchParams.get('status') || 'success';
  const bookingId = searchParams.get('bookingId') || '';
  const receiptNoParam = searchParams.get('receiptNo') || '';
  const slug = searchParams.get('slug') || '';
  const failureReason = searchParams.get('reason') || '';

  const target = bookingId || receiptNoParam;

  const [receipt, setReceipt] = useState<DonationReceipt | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(target ? 'loading' : 'missing');

  useEffect(() => {
    if (status !== 'success') return;
    if (!target) {
      setLoadState('missing');
      return;
    }

    const token = readToken();
    if (!token) {
      setLoadState('unauthorized');
      return;
    }

    const controller = new AbortController();
    setLoadState('loading');

    fetch(`${API_BASE}/donation-booking/receipt/${encodeURIComponent(target)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (res) => {
        if (res.status === 401) {
          setLoadState('unauthorized');
          return;
        }
        if (res.status === 404) {
          setLoadState('notfound');
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setReceipt(data);
        setLoadState('ok');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Receipt lookup failed:', err);
          setLoadState('error');
        }
      });

    return () => controller.abort();
  }, [status, target]);

  const loginHref = `/${locale}/login?redirect=${encodeURIComponent(
    `${pathname || ''}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  )}`;

  const category = receipt?.category;
  const listPath = category === 'ashram' ? '/donate/ashram-donation' : '/donate/annadhanam-corpus';
  const kindLabel =
    category === 'corpus' ? 'Corpus Fund' : category === 'ashram' ? 'Ashram' : 'Donation';
  const receiptTitle =
    category === 'corpus'
      ? 'Vedaneri Corpus Donation Receipt'
      : category === 'ashram'
      ? 'Vedaneri Ashram Donation Receipt'
      : 'Vedaneri Donation Receipt';

  const payStatus = String(receipt?.paymentStatus || '').toUpperCase();
  const members = receipt?.familyMembers || [];
  const donationDate = formatDate(receipt?.donationDate);
  const paidOn = formatDate(receipt?.createdAt);

  const fullName = [receipt?.donor?.firstName, receipt?.donor?.lastName].filter(Boolean).join(' ');
  const addressLine = [receipt?.donor?.address, receipt?.donor?.city, receipt?.donor?.state].filter(Boolean).join(', ');

  const retryHref = slug ? `/${locale}/donate/${encodeURIComponent(slug)}` : `/${locale}/donate/annadhanam-corpus`;

  return (
    <main className="min-h-screen bg-cream/40 px-4 py-8 text-charcoal sm:px-6 sm:py-12 lg:px-8">
      <style>{`
        @media print {
          @page { size: A5 portrait; margin: 6mm; }
          body { background: #ffffff !important; font-size: 11px !important; color: #000000 !important; }
          header, footer, nav, .no-print { display: none !important; }
          main { background: #ffffff !important; padding: 0 !important; min-height: 0 !important; }
          .print-container {
            border: 1px solid #78350f !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 12px 16px !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="mx-auto w-full max-w-3xl space-y-5">
        {status !== 'success' ? (
          /* ---------- Payment not completed ---------- */
          <NoticeCard
            tone="error"
            title={tr('Payment Incomplete or Cancelled', 'கட்டணம் செலுத்தப்படவில்லை')}
            text={
              failureReason === 'cancelled'
                ? tr(
                    'The payment window was closed before completion, so this donation was not completed.',
                    'கட்டண சாளரம் மூடப்பட்டது அல்லது ரத்து செய்யப்பட்டது. உங்கள் நன்கொடை நிறைவடையவில்லை.'
                  )
                : tr(
                    'We were unable to verify your payment. If money was debited from your bank, please contact the ashram with your payment reference.',
                    'கட்டணத்தை சரிபார்க்க இயலவில்லை. வங்கியில் பணம் பிடித்தம் செய்யப்பட்டிருந்தால், உங்கள் கட்டண எண்ணுடன் ஆசிரமத்தைத் தொடர்பு கொள்ளவும்.'
                  )
            }
          >
            <Link href={retryHref} className={BTN_PRIMARY}>
              {slug ? tr('Retry Donation', 'மீண்டும் முயற்சிக்கவும்') : tr('View Donation Funds', 'நிதிகளைக் காண்க')}
            </Link>
            <Link href={`/${locale}/contact`} className={BTN_SECONDARY}>
              {tr('Contact the Ashram', 'ஆசிரமத்தைத் தொடர்பு கொள்ள')}
            </Link>
            <Link href={`/${locale}/profile`} className={BTN_SECONDARY}>
              {tr('My Account', 'எனது கணக்கு')}
            </Link>
          </NoticeCard>
        ) : loadState === 'loading' ? (
          <Skeleton />
        ) : loadState === 'unauthorized' ? (
          <NoticeCard
            tone="info"
            title={tr('Login to View Your Receipt', 'ரசீதைக் காண உள்நுழைக')}
            text={tr(
              'Receipts are shown only to the donor who made the donation. Please log in to continue.',
              'நன்கொடை ரசீது உங்கள் கணக்கிற்கு மட்டுமே காட்டப்படும். தயவுசெய்து உள்நுழையவும்.'
            )}
          >
            <Link href={loginHref} className={BTN_PRIMARY}>
              {tr('Go to Login', 'உள்நுழைக')}
            </Link>
          </NoticeCard>
        ) : loadState !== 'ok' || !receipt ? (
          <NoticeCard
            tone="warn"
            title={tr('Receipt Not Available', 'ரசீது கிடைக்கவில்லை')}
            text={
              loadState === 'error'
                ? tr(
                    'We could not load the receipt right now. Please try again in a moment.',
                    'ரசீதை ஏற்றுவதில் பிழை ஏற்பட்டது. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.'
                  )
                : tr(
                    'We could not find a receipt for this donation under your account.',
                    'இந்த நன்கொடைக்கான ரசீது உங்கள் கணக்கில் இல்லை.'
                  )
            }
          >
            {receiptNoParam && (
              <p className="font-mono text-xs text-charcoal/60 sm:self-center">
                {tr('Receipt No', 'ரசீது எண்')}: {receiptNoParam}
              </p>
            )}
            <Link href={`/${locale}/profile`} className={BTN_PRIMARY}>
              {tr('Go to My Account', 'எனது கணக்கிற்குச் செல்க')}
            </Link>
            <Link href={`/${locale}/contact`} className={BTN_SECONDARY}>
              {tr('Contact the Ashram', 'ஆசிரமத்தைத் தொடர்பு கொள்ள')}
            </Link>
          </NoticeCard>
        ) : payStatus !== 'SUCCESS' ? (
          <NoticeCard
            tone={payStatus === 'FAILED' ? 'error' : 'warn'}
            title={
              payStatus === 'FAILED'
                ? tr('Payment Failed', 'கட்டணம் தோல்வியடைந்தது')
                : tr('Payment Confirmation Pending', 'கட்டண உறுதிப்படுத்தல் நிலுவையில் உள்ளது')
            }
            text={
              payStatus === 'FAILED'
                ? tr(
                    'The payment for this donation failed. If money was debited, please contact the ashram.',
                    'இந்த நன்கொடைக்கான கட்டணம் தோல்வியடைந்தது. வங்கியில் பணம் பிடித்தம் செய்யப்பட்டிருந்தால் ஆசிரமத்தைத் தொடர்பு கொள்ளவும்.'
                  )
                : tr(
                    'Your payment has not been confirmed yet. If money was debited, please contact the ashram with your payment reference.',
                    'உங்கள் கட்டணம் இன்னும் உறுதிப்படுத்தப்படவில்லை. பணம் பிடித்தம் செய்யப்பட்டிருந்தால், உங்கள் கட்டண எண்ணுடன் ஆசிரமத்தைத் தொடர்பு கொள்ளவும்.'
                  )
            }
          >
            {receipt.paymentId && (
              <p className="break-all font-mono text-xs text-charcoal/60 sm:self-center">
                {tr('Payment Ref', 'கட்டண எண்')}: {receipt.paymentId}
              </p>
            )}
            <Link href={`/${locale}/contact`} className={BTN_PRIMARY}>
              {tr('Contact the Ashram', 'ஆசிரமத்தைத் தொடர்பு கொள்ள')}
            </Link>
            <Link href={`/${locale}/profile`} className={BTN_SECONDARY}>
              {tr('My Account', 'எனது கணக்கு')}
            </Link>
          </NoticeCard>
        ) : (
          /* ---------- Confirmed donation ---------- */
          <>
            <div className="no-print flex flex-col gap-3 rounded-md border border-emerald-200 border-l-4 border-l-emerald-600 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                  {tr('Payment Confirmed', 'கட்டணம் உறுதிப்படுத்தப்பட்டது')}
                </span>
                <p className="mt-1 font-serif text-sm leading-relaxed text-charcoal/75">
                  {tr(
                    'Thank you. Your donation has been received. Print or save this receipt for your records.',
                    'நன்றி. உங்கள் நன்கொடை பெறப்பட்டது. ரசீதை அச்சிட்டு அல்லது சேமித்து வைத்துக் கொள்ளவும்.'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center rounded-md border border-maroon bg-white px-5 py-2.5 text-sm font-bold text-maroon transition-colors hover:bg-maroon hover:text-white sm:w-auto"
              >
                {tr('Print / Download A5 Receipt', 'ரசீது அச்சிடுக (A5)')}
              </button>
            </div>

            {/* Receipt document */}
            <article className="print-container space-y-5 rounded-md border border-sand bg-white p-4 shadow-md sm:p-8">
              {/* Header */}
              <div className="flex flex-col gap-4 border-b-2 border-maroon pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3.5">
                  <img
                    src="/images/ashram-seal.png"
                    alt="Ashram Seal"
                    className="h-14 w-14 shrink-0 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="min-w-0">
                    <h1 className="font-display text-base font-bold uppercase leading-tight tracking-wide text-maroon sm:text-lg">
                                            Vedanta Sasthra Prachara Trust
                    </h1>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-saffron">{receiptTitle}</p>
                    <p className="text-[10px] font-semibold text-charcoal/60">Theni, Tamil Nadu, India</p>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-4 border-t border-sand pt-3 sm:block sm:border-t-0 sm:pt-0 sm:text-right">
                  <div>
                    <span className={LABEL}>Receipt No</span>
                    <span className="break-all text-sm font-black text-maroon">{receipt.receiptNo}</span>
                  </div>
                  <span className="inline-block rounded-sm border border-maroon px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-maroon sm:mt-2">
                    {kindLabel}
                  </span>
                </div>
              </div>

              {/* Summary */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 rounded-md border border-sand bg-cream/50 p-3">
                  <span className={LABEL}>Donation Details</span>
                  <p className="text-sm font-extrabold leading-snug text-maroon">{receipt.fundName}</p>
                  <p className="text-[12px] font-semibold text-charcoal/75">
                    Donation Date: {donationDate || 'Not recorded'}
                  </p>
                  {paidOn && <p className="text-[11px] text-charcoal/60">Paid On: {paidOn}</p>}
                  {receipt.paymentId && (
                    <p className="break-all font-mono text-[10px] text-charcoal/50">Ref: {receipt.paymentId}</p>
                  )}
                </div>

                <div className="space-y-1 rounded-md border border-sand bg-cream/50 p-3">
                  <span className={LABEL}>Donor</span>
                  <p className="text-sm font-extrabold leading-snug text-maroon">{fullName || 'Donor'}</p>
                  {receipt.donor.phone && (
                    <p className="text-[12px] font-semibold text-charcoal/75">Phone: {receipt.donor.phone}</p>
                  )}
                  {receipt.donor.email && (
                    <p className="break-all text-[11px] text-charcoal/65">{receipt.donor.email}</p>
                  )}
                  {receipt.panNumber && <p className="text-[11px] text-charcoal/65">PAN: {receipt.panNumber}</p>}
                  {receipt.aadhaarNumber && (
                    <p className="text-[11px] text-charcoal/65">Aadhaar: {receipt.aadhaarNumber}</p>
                  )}
                  {addressLine && <p className="text-[11px] text-charcoal/65">{addressLine}</p>}
                </div>
              </div>

              {/* Family members */}
              {members.length > 0 && (
                <div className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal/70">
                    Family Members
                  </span>

                  {/* Phones: stacked cards */}
                  <ul className="space-y-2 sm:hidden print:hidden">
                    {members.map((m, idx) => (
                      <li key={idx} className="rounded-md border border-sand p-3 text-xs">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-bold text-maroon">
                            {idx + 1}. {m.title ? `${m.title}. ` : ''}
                            {m.name}
                          </span>
                          <span className="shrink-0 text-[11px] text-charcoal/60">{m.relation || 'Family'}</span>
                        </div>
                        <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <dt className="text-[9px] font-bold uppercase tracking-wider text-charcoal/50">Gothram</dt>
                            <dd className="font-medium">{m.gothram || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-[9px] font-bold uppercase tracking-wider text-charcoal/50">Nakshatram</dt>
                            <dd className="font-medium">{m.nakshathiram || '-'}</dd>
                          </div>
                          <div>
                            <dt className="text-[9px] font-bold uppercase tracking-wider text-charcoal/50">Rasi</dt>
                            <dd className="font-medium">{m.rasi || '-'}</dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>

                  {/* Tablet, desktop and print: table */}
                  <div className="hidden overflow-x-auto rounded-md border border-sand sm:block print:block">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-sand bg-cream text-[10px] font-bold uppercase tracking-wider text-charcoal/60">
                          <th className="px-2.5 py-2">#</th>
                          <th className="px-2.5 py-2">Name</th>
                          <th className="px-2.5 py-2">Relation</th>
                          <th className="px-2.5 py-2">Gothram</th>
                          <th className="px-2.5 py-2">Nakshatram</th>
                          <th className="px-2.5 py-2">Rasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sand/70 text-[11px] font-medium">
                        {members.map((m, idx) => (
                          <tr key={idx}>
                            <td className="px-2.5 py-1.5 text-charcoal/50">{idx + 1}</td>
                            <td className="px-2.5 py-1.5 font-bold text-maroon">
                              {m.title ? `${m.title}. ` : ''}
                              {m.name}
                            </td>
                            <td className="px-2.5 py-1.5 text-charcoal/70">{m.relation || 'Family'}</td>
                            <td className="px-2.5 py-1.5">{m.gothram || '-'}</td>
                            <td className="px-2.5 py-1.5">{m.nakshathiram || '-'}</td>
                            <td className="px-2.5 py-1.5">{m.rasi || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="flex items-end justify-between gap-3 border-t border-sand pt-4">
                <div />
                <div className="text-right">
                  <span className={LABEL}>Donation Amount</span>
                  <span className="text-xl font-black text-maroon sm:text-2xl">
                    INR {Number(receipt.amount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Notice */}
              <p className="border-t border-dashed border-sand pt-3 text-center text-[10px] leading-relaxed text-charcoal/60">
                Thank you for your generous donation. Please keep this receipt for your records.
              </p>
            </article>

            {/* Actions */}
            <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={`/${locale}${listPath}`}
                className="text-center text-sm font-bold text-charcoal/70 underline-offset-4 hover:text-maroon hover:underline sm:text-left"
              >
                {tr('Explore Other Funds', 'மற்ற நிதிகளைக் காண்க')}
              </Link>
              <Link
                href={`/${locale}/profile`}
                className="inline-flex w-full items-center justify-center rounded-md bg-maroon px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-charcoal sm:w-auto"
              >
                {tr('Go to My Account', 'எனது கணக்கிற்குச் செல்க')}
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function DonationBookingStatusPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream/40 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-3xl">
            <Skeleton />
          </div>
        </main>
      }
    >
      <StatusContent />
    </Suspense>
  );
}