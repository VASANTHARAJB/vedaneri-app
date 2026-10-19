'use client';

import { useState } from 'react';
import type { Dictionary } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { ISSUES, MONTHS_LONG } from '@/data/magazine';
import { txt } from '@/data/sevas';

type T = Dictionary['magazine'];
const YEARS = Array.from(new Set(ISSUES.map((i) => i.year))).sort((a, b) => b - a);
const btn = 'inline-flex flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon';

// Digital archive: year tabs and one card per issue. Buttons stay disabled until the ashram supplies a PDF or reader link.
export default function MagazineArchive({ locale, t }: { locale: Locale; t: T }) {
  const [year, setYear] = useState(YEARS[0]);
  const list = ISSUES.filter((i) => i.year === year).sort((a, b) => b.month - a.month);

  return (
    <div>
      <div role="tablist" aria-label={t.yearTabs} className="flex flex-wrap justify-center gap-2">
        {YEARS.map((y) => (
          <button key={y} type="button" role="tab" id={`yr-${y}`} aria-selected={y === year} aria-controls="archive-panel" onClick={() => setYear(y)}
            className={`rounded-full px-5 py-2 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon ${y === year ? 'bg-maroon text-white' : 'bg-white text-maroon ring-1 ring-rose hover:bg-rose'}`}>
            {y}
          </button>
        ))}
      </div>

      <div id="archive-panel" role="tabpanel" aria-labelledby={`yr-${year}`} className="mt-8">
        {list.length === 0 ? (
          <p className="text-center text-charcoal/70">{t.archiveEmpty}</p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((i) => (
              <li key={i.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow ring-1 ring-rose">
                <div role="img" aria-label={txt(i.title, locale)} className="relative aspect-[4/3] bg-maroon bg-cover bg-center" style={{ backgroundImage: `url('${i.cover}')` }}>
                  <span className="absolute left-3 top-3 rounded-full bg-charcoal/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white [html[lang='ta']_&]:tracking-normal">{MONTHS_LONG[locale][i.month - 1]} {i.year}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-xl font-semibold leading-snug text-maroon [html[lang='ta']_&]:!leading-[1.35] [html[lang='ta']_&]:text-lg">{txt(i.title, locale)}</h3>
                  <p className="mt-2 flex-1 text-sm text-charcoal/80">{txt(i.desc, locale)}</p>
                  <div className="mt-4 flex gap-2">
                    {i.readUrl ? (
                      <a href={i.readUrl} target="_blank" rel="noopener noreferrer" className={`${btn} bg-maroon text-white hover:bg-charcoal`}>{t.read}<span className="sr-only"> ({t.newTab})</span></a>
                    ) : (
                      <span aria-disabled="true" title={t.soon} className={`${btn} cursor-not-allowed bg-rose text-charcoal/50`}>{t.read}</span>
                    )}
                    {i.pdf ? (
                      <a href={i.pdf} download className={`${btn} border-2 border-maroon text-maroon hover:bg-maroon hover:text-white`}>{t.download}</a>
                    ) : (
                      <span aria-disabled="true" title={t.soon} className={`${btn} cursor-not-allowed border-2 border-rose text-charcoal/50`}>{t.download}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-center text-sm text-charcoal/70">{t.archiveNote}</p>
      </div>
    </div>
  );
}
