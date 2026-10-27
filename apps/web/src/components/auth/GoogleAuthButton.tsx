'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function GoogleAuthButton({
  locale,
  onSuccess,
}: {
  locale: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isTa = locale === 'ta';
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const rawRedirect = searchParams.get('redirect') || '';
  const redirectTo =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      ? rawRedirect
      : `/${locale}/sevas`;

  useEffect(() => {
    if (!clientId) return;

    const scriptId = 'google-gsi-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const handleCredentialResponse = async (response: any) => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`${API_BASE}/devotee/google-auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential }),
        });

        if (!res.ok) {
          throw new Error('Google authentication failed');
        }

        const data = await res.json();
        // Save token to localStorage for subsequent Seva bookings
        localStorage.setItem('devotee_token', data.token);

        if (onSuccess) {
          onSuccess();
        } else {
          router.replace(redirectTo);
          router.refresh();
        }
      } catch (_) {
        setError(
          isTa
            ? 'Google உள்நுழைவு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.'
            : 'Google Sign-In failed. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    const initGoogleBtn = () => {
      if ((window as any).google?.accounts?.id && buttonRef.current) {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });

        (window as any).google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogleBtn;
      document.body.appendChild(script);
    } else if ((window as any).google) {
      initGoogleBtn();
    }
  }, [clientId, locale, isTa, redirectTo, router, onSuccess, API_BASE]);

  return (
    <div className="w-full space-y-2">
      <div ref={buttonRef} className="flex min-h-[44px] w-full justify-center" />

      {loading && (
        <p className="text-center text-xs font-bold text-saffron animate-pulse">
          {isTa ? 'Google கணக்கு சரிபார்க்கப்படுகிறது...' : 'Signing in with Google...'}
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-center text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}