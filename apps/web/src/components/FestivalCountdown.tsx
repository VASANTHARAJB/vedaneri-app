'use client';

import { useEffect, useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';

type Props = { t: Dictionary['festival'] };

const DAY = 86_400_000;
// Festival times are in Indian Standard Time. Evening puja starts 5:00 PM on the first day, ends 8:30 PM on the last.
const at = (iso: string, time: string) => Date.parse(`${iso}T${time}+05:30`);

export default function FestivalCountdown({ t }: Props) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const start = at(t.start, '17:00:00');
  const end = at(t.end, '20:30:00');
  const total = Math.round((at(t.end, '00:00:00') - at(t.start, '00:00:00')) / DAY) + 1;

  // Before the client has measured the time, reserve the space so nothing jumps.
  if (now === null) return <div className="h-[4.5rem]" aria-hidden="true" />;

  if (now > end) return <p className="font-display text-xl font-semibold text-maroon">{t.ended}</p>;

  if (now >= start) {
    const n = Math.min(total, Math.floor((now - at(t.start, '00:00:00')) / DAY) + 1);
    return (
      <div>
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-charcoal/80">
          <span className="h-2 w-2 rounded-full bg-saffron motion-safe:animate-pulse" aria-hidden="true" />
          {t.inProgress}
        </p>
        <p className="mt-1 font-display text-3xl font-semibold text-maroon">{t.dayOf.replace('{n}', String(n)).replace('{total}', String(total))}</p>
      </div>
    );
  }

  const left = start - now;
  const d = Math.floor(left / DAY);
  const h = Math.floor((left % DAY) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const pad = (v: number) => String(v).padStart(2, '0');
  return (
    <div>
      <p className="text-sm text-charcoal/75">{t.countdownLabel}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-maroon" role="timer">
        {pad(d)} {t.days} : {pad(h)} {t.hours} : {pad(m)} {t.mins}
      </p>
    </div>
  );
}
