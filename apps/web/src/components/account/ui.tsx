'use client';

import type { ReactNode } from 'react';
import type { Dictionary } from '@/lib/dictionary';

export type T = Dictionary['account'];
export type A = Dictionary['auth'];

export const card = 'rounded-2xl bg-white p-5 shadow ring-1 ring-rose sm:p-6';
export const input = 'w-full rounded-md border-2 border-rose bg-white px-3 py-2.5 text-charcoal placeholder:text-charcoal/50 focus:border-saffron focus:outline-none';
export const primary = 'inline-flex items-center justify-center rounded-md bg-maroon px-5 py-2.5 font-semibold text-white transition-colors hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron';
export const ghost = 'inline-flex items-center justify-center rounded-md border-2 border-maroon px-5 py-2.5 font-semibold text-maroon transition-colors hover:bg-maroon hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron';
export const danger = 'inline-flex items-center justify-center rounded-md bg-red-700 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700';

export function Heading({ id, title, text, children }: { id: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} tabIndex={-1} className="font-display text-3xl font-semibold text-maroon focus:outline-none [html[lang='ta']_&]:!leading-[1.3] [html[lang='ta']_&]:text-2xl">{title}</h2>
        {text && <p className="mt-1 text-sm text-charcoal/70">{text}</p>}
      </div>
      {children}
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-rose bg-white/60 p-8 text-center">
      <p className="font-display text-2xl font-semibold text-maroon">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-charcoal/75">{text}</p>
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  );
}

export function Badge({ tone, children }: { tone: 'green' | 'saffron' | 'grey'; children: ReactNode }) {
  const c = tone === 'green' ? 'bg-green-100 text-green-900' : tone === 'saffron' ? 'bg-saffron/20 text-maroon' : 'bg-charcoal/10 text-charcoal/80';
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${c}`}>{children}</span>;
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-bold text-charcoal/70">{label}:</dt>
      <dd className="min-w-0 break-words text-charcoal">{children}</dd>
    </div>
  );
}

export const when = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
