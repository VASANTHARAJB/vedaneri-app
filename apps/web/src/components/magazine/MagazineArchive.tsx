'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const FILES = API_BASE.replace(/\/api\/v1\/?$/, '');
const TOKEN_KEY = 'devotee_token';

type Issue = { id: string; title_en: string; title_ta: string | null; issue_month: number; issue_year: number; cover_url: string | null };
type Props = { t?: any; locale: string };

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_TA = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
const imgUrl = (u: string | null) => (u ? (u.startsWith('http') ? u : `${FILES}${u}`) : '');

export default function MagazineArchive({ locale }: Props) {
  const isTa = locale === 'ta';
  const tr = (en: string, ta: string) => (isTa ? ta : en);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState<'all' | number>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const loginHref = `/${locale}/login?redirect=${encodeURIComponent(`/${locale}/magazine`)}`;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/magazine/issues`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setIssues((await res.json()).issues || []);
    } catch {
      setError(tr('The issues could not be loaded right now. Please try again.', 'இதழ்களை இப்போது ஏற்ற இயலவில்லை. மீண்டும் முயற்சிக்கவும்.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);
  useEffect(() => { load(); }, [load]);

  // The PDF needs the login, so it is fetched with the token and opened from memory
  async function open(i: Issue, save: boolean) {
    setMsg('');
    const tk = localStorage.getItem(TOKEN_KEY);
    if (!tk) { window.location.href = loginHref; return; }
    setBusyId(i.id);
    try {
      const res = await fetch(`${API_BASE}/magazine/issues/${i.id}/pdf`, { headers: { Authorization: `Bearer ${tk}` } });
      if (res.status === 401) { window.location.href = loginHref; return; }
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      if (save) {
        const a = document.createElement('a');
        a.href = url; a.download = `${i.title_en}.pdf`; a.click();
      } else {
        window.open(url, '_blank', 'noopener');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setMsg(tr('The issue could not be opened. Please try again.', 'இதழைத் திறக்க இயலவில்லை. மீண்டும் முயற்சிக்கவும்.'));
    } finally {
      setBusyId(null);
    }
  }

  const years = Array.from(new Set(issues.map((i) => i.issue_year))).sort((a, b) => b - a);
  const shown = year === 'all' ? issues : issues.filter((i) => i.issue_year === year);

  if (loading) return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-80 animate-pulse rounded-md bg-sand/50" />)}</div>;
  if (error) {
    return (
      <div role="alert" className="rounded-md border border-red-200 border-l-4 border-l-red-600 bg-red-50 p-5 text-red-800">
        <p className="font-semibold">{error}</p>
        <button type="button" onClick={load} className="mt-3 rounded-md border-2 border-red-700 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-700 hover:text-white">{tr('Try again', 'மீண்டும் முயற்சி')}</button>
      </div>
    );
  }
  if (issues.length === 0) {
    return <div className="rounded-md border border-dashed border-sand bg-white py-14 text-center font-serif text-lg text-charcoal/75">{tr('The first issues will be added here soon.', 'முதல் இதழ்கள் விரைவில் இங்கே சேர்க்கப்படும்.')}</div>;
  }

  return (
    <div>
      {years.length > 1 && (
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {(['all', ...years] as const).map((y) => (
            <button key={y} type="button" onClick={() => setYear(y)} className={`rounded-full border px-4 py-1.5 text-sm font-bold ${year === y ? 'border-maroon bg-maroon text-white' : 'border-sand bg-white text-charcoal hover:border-maroon'}`}>
              {y === 'all' ? tr('All', 'அனைத்தும்') : y}
            </button>
          ))}
        </div>
      )}
      {msg && <p role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">{msg}</p>}
      {typeof window !== 'undefined' && !localStorage.getItem(TOKEN_KEY) && (
        <p className="mb-6 text-center text-charcoal/75">
          {tr('Please ', 'இதழ்களைப் படிக்க ')}<Link href={loginHref} className="font-bold text-maroon underline underline-offset-4">{tr('sign in', 'உள்நுழையவும்')}</Link>{tr(' to read or download an issue.', '.')}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((i) => {
          const title = isTa ? i.title_ta || i.title_en : i.title_en;
          const month = (isTa ? MONTHS_TA : MONTHS_EN)[i.issue_month - 1];
          return (
            <article key={i.id} className="flex flex-col overflow-hidden rounded-md border border-sand bg-white shadow-sm transition-shadow hover:shadow-lg">
              <div className="aspect-[3/4] bg-sand/40">
                {i.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgUrl(i.cover_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-maroon to-charcoal px-4 text-center font-display text-xl font-semibold text-white">{title}</div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-saffron">{month} {i.issue_year}</p>
                  <h3 className="mt-0.5 font-display text-lg font-semibold leading-snug text-maroon [html[lang='ta']_&]:leading-[1.4]">{title}</h3>
                </div>
                <div className="mt-auto flex gap-2">
                  <button type="button" disabled={busyId === i.id} onClick={() => open(i, false)} className="flex-1 rounded-md bg-maroon px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-charcoal disabled:opacity-60">
                    {busyId === i.id ? tr('Opening...', 'திறக்கிறது...') : tr('Read', 'படிக்க')}
                  </button>
                  <button type="button" disabled={busyId === i.id} onClick={() => open(i, true)} className="rounded-md border border-sand bg-white px-3 py-2 text-sm font-bold text-charcoal hover:border-maroon disabled:opacity-60">{tr('Download', 'பதிவிறக்கு')}</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}