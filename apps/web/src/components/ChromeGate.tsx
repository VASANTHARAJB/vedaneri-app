'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// Pages that stand alone, without the site header and footer (the login / create account page has its own slim top bar).
const STANDALONE = /^\/(en|ta)\/login\/?$/;

export default function ChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (STANDALONE.test(pathname)) return null;
  return <>{children}</>;
}
