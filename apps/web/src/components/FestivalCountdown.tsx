'use client';

import { useEffect, useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';

type Props = { t: Dictionary['festival'] };

const DAY = 86_400_000;
// Festival times are in Indian Standard Time. Evening puja starts 5:00 PM on the first day, ends 8:30 PM on the last.
const at = (iso: string, time: string) => Date.parse(`${iso}T${time}+05:30`);

// Status line plus one circle per festival day: done (maroon), today (saffron), coming (outline).
export default function FestivalCountdown({ t }: Props) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const start = at(t.start, '17:00:00');
  const end = at(t.end, '20:30:00');
  const firstDay = at(t.start, '00:00:00');
  const total = Math.round((at(t.end, '00:00:00') - firstDay) / DAY) + 1;

  // Before the client has measured the time, reserve the space so nothing jumps.
  if (now === null) return <div className="h-[7.5rem]" aria-hidden="true" />;

  if (now > end) return <p className="font-display text-xl font-semibold text-maroon">{t.ended}</p>;

  const live = now >= start;
  const n = live ? Math.min(total, Math.floor((now - firstDay) / DAY) + 1) : 0; // today's number, 0 = not started
  const dates = Array.from({ length: total }, (_, i) => new Date(Date.parse(t.start) + i * DAY).getUTCDate());

  let head;
  if (live) {
    head = (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-charcoal/80">
          <span className="h-2.5 w-2.5 rounded-full bg-saffron motion-safe:animate-pulse" aria-hidden="true" />
          {t.inProgress}
        </p>
        <p className="font-display text-2xl font-semibold text-maroon">{t.dayOf.replace('{n}', String(n)).replace('{total}', String(total))}</p>
      </div>
    );
  } else {
    const left = start - now;
    const d = Math.floor(left / DAY);
    const h = Math.floor((left % DAY) / 3_600_000);
    const m = Math.floor((left % 3_600_000) / 60_000);
    const pad = (v: number) => String(v).padStart(2, '0');
    head = (
      <div>
        <p className="text-sm text-charcoal/75">{t.countdownLabel}</p>
        <p className="mt-1 font-display text-2xl font-semibold text-maroon" role="timer">
          {pad(d)} {t.days} : {pad(h)} {t.hours} : {pad(m)} {t.mins}
        </p>
      </div>
    );
  }

  return (
    <div>
      {head}
      <ol className="mt-4 grid gap-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} aria-hidden="true">
        {dates.map((date, i) => {
          const day = i + 1;
          const cls = day < n ? 'bg-maroon text-white' : day === n ? 'bg-saffron text-charcoal ring-4 ring-saffron/30' : 'bg-white text-maroon ring-1 ring-maroon/30';
          return (
            <li key={day} className={`flex aspect-square items-center justify-center rounded-full text-[0.7rem] font-bold sm:text-sm ${cls}`}>
              {date}
            </li>
          );
        })}
      </ol>
    </div>
  );
}