'use client';

import Link from 'next/link';
import { useCart } from './CartProvider';

// Shopping-bag icon with the number of selected sevas, for the header
export default function CartLink({ href, label }: { href: string; label: string }) {
  const { count, ready } = useCart();
  const n = ready ? count : 0;
  return (
    <Link
      href={href}
      aria-label={n > 0 ? `${label}: ${n}` : label}
      className="relative inline-flex h-9 w-9 items-center sm:h-10 sm:w-10 justify-center rounded-full text-maroon transition-colors hover:bg-rose focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 7h12l1 13H5L6 7z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      {n > 0 && (
        <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-saffron px-1 text-xs font-bold text-charcoal">
          {n}
        </span>
      )}
    </Link>
  );
}
