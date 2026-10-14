'use client';

import { useState } from 'react';

type Props = { src: string; alt: string; initials: string };

// Round white badge for a logo. If the logo file is missing, the initials show instead.
export default function LogoBadge({ src, alt, initials }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-white p-2.5 shadow-lg ring-2 ring-saffron/70 sm:h-28 sm:w-28">
      {failed ? (
        <span aria-label={alt} className="font-display text-xl font-bold text-maroon">{initials}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-contain" />
      )}
    </span>
  );
}