'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type Props = {
  loginHref: string;
  profileHref: string;
  loginLabel: string;
  accountLabel: string;
  className?: string;
};

export default function AccountLink({
  loginHref,
  profileHref,
  loginLabel,
  accountLabel,
  className,
}: Props) {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkAuth = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('devotee_token') : null;
      setIsLoggedIn(!!token);
    };

    // Check token on initial mount & whenever URL pathname changes
    checkAuth();

    // Listen to tab storage changes & custom auth events
    window.addEventListener('storage', checkAuth);
    window.addEventListener('devotee-auth-change', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('devotee-auth-change', checkAuth);
    };
  }, [pathname]);

  // SSR Hydration mismatch thadukka
  if (!mounted) {
    return (
      <Link href={loginHref} className={className}>
        {loginLabel}
      </Link>
    );
  }

  // Token irundhaal Profile/Account link kaattum
  if (isLoggedIn) {
    return (
      <Link href={profileHref} className={className}>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {accountLabel || 'My Profile'}
        </span>
      </Link>
    );
  }

  // Token illai endraal Login link kaattum
  return (
    <Link href={loginHref} className={className}>
      {loginLabel}
    </Link>
  );
}