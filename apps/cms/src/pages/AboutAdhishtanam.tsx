import React, { useCallback, useEffect, useState } from 'react';
import * as Kit from './DiscoverKit';
import { API, CSS, Notice, authHeader, failText, fileUrl, readJson, useFlash } from './DiscoverKit';

// API points at .../api/v1/discover, the pages API is .../api/v1/pages
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const SLUG = 'adhishtanam';
const PAGES = `${API_BASE}/pages/admin/${SLUG}`;

// Uses the Tamil converter of DiscoverKit when it exists
const transliterate = async (text: string): Promise<string | null> => {
  const fn = (Kit as any).transliterate;
  return typeof fn === 'function' ? fn(text) : null;
};

type Bi = { en: string; ta: string };
const bi = (): Bi => ({ en: '', ta: '' });
const b = (x: any): Bi => ({ en: String(x?.en ?? ''), ta: String(x?.ta ?? '') });

// key, label in the CMS, number of text lines
const SIMPLE = [
  ['meta_title', 'Browser title', 1], ['meta_description', 'Search description', 2],
  ['eyebrow', 'Small label above the title', 1], ['title', 'Page title', 1], ['tagline', 'Tagline', 1],
  ['intro', 'Introduction', 3], ['est', 'Label under the round photo', 1], ['heroAlt', 'Round photo description', 1],
  ['aboutTitle', 'About heading', 1], ['aboutText1', 'About paragraph 1', 4], ['aboutText2', 'About paragraph 2', 4], ['photoAlt', 'Mandapam photo description', 1],
  ['verseTranslation', 'Verse meaning', 3], ['verseSource', 'Verse source', 1],
  ['doTitle', 'Heading', 1], ['doText', 'Introduction', 2],
  ['parayanamLabel', 'Small label', 1], ['parayanamTime', 'Time', 1], ['parayanamTitle', 'Heading', 1], ['parayanamText', 'Text', 2],
  ['teachingText', 'Teaching quote', 3], ['teachingSource', 'Quote source', 1],
  ['visitTitle', 'Visit heading', 1], ['address', 'Address', 3], ['visitCta', 'Visit button', 1],
  ['moreTitle', 'Continue exploring heading', 1],
] as const;
type SimpleKey = (typeof SIMPLE)[number][0];

// Pages the button and links can point to. Anything else can be typed in the link box:
// /some-page for a page of this website, or https://... for another website.
const PAGE_OPTIONS = [
  { value: '/', label: 'Home' },
  { value: '/about/omkarananda', label: 'About: Pujyasri Omkarananda' },
  { value: '/about/ashramam', label: 'About: Ashramam' },
  { value: '/about/adhishtanam', label: 'About: Adhishtanam' },
  { value: '/about/vidyapitham', label: 'About: Vidyapitham' },
  { value: '/contact', label: 'Contact' },
];
type LinkItem = { label: Bi; href: string };
const DEFAULT_LINKS: LinkItem[] = [
  { label: { en: 'Pujyasri Omkarananda MahaSwamigal', ta: 'பூஜ்யஸ்ரீ சுவாமி ஓங்காரானந்த மகாஸ்வாமிகள்' }, href: '/about/omkarananda' },
  { label: { en: 'Ashramam', ta: 'ஆசிரமம்' }, href: '/about/ashramam' },
  { label: { en: 'Vidyapitham', ta: 'வித்யாபீடம்' }, href: '/about/vidyapitham' },
];

type Doc = Record<SimpleKey, Bi> & {
  visitLink: string;
  links: LinkItem[];
  heroImage: string;
  mandapamImage: string;
  verseSanskrit: string;
  stats: { label: Bi; value: Bi }[];
  practices: { name: Bi; text: Bi }[];
  parayanam: Bi[];
};
type ListKey = 'stats' | 'practices' | 'parayanam' | 'links';

const emptyDoc = (): Doc => {
  const d: any = { heroImage: '', mandapamImage: '', verseSanskrit: '', visitLink: '/contact', links: [], stats: [], practices: [], parayanam: [] };
  SIMPLE.forEach(([k]) => { d[k] = bi(); });
  return d as Doc;
};
const norm = (raw: any): Doc => {
  const d = emptyDoc();
  SIMPLE.forEach(([k]) => { d[k] = b(raw?.[k]); });
  d.heroImage = String(raw?.heroImage ?? '');
  d.mandapamImage = String(raw?.mandapamImage ?? '');
  d.verseSanskrit = String(raw?.verseSanskrit ?? '');
  d.stats = (raw?.stats || []).map((x: any) => ({ label: b(x.label), value: b(x.value) }));
  d.practices = (raw?.practices || []).map((x: any) => ({ name: b(x.name), text: b(x.text) }));
  d.parayanam = (raw?.parayanam || []).map(b);
  // A page saved before links existed shows the three current links, ready to edit
  d.visitLink = typeof raw?.visitLink === 'string' && raw.visitLink.trim() ? raw.visitLink : '/contact';
  d.links = Array.isArray(raw?.links)
    ? raw.links.map((x: any) => ({ label: b(x?.label), href: String(x?.href ?? '') }))
    : DEFAULT_LINKS.map((x) => ({ label: { ...x.label }, href: x.href }));
  return d;
};

function BiField({ label, value, onChange, rows = 1 }: { label: string; value: Bi; onChange: (v: Bi) => void; rows?: number }) {
  const [busy, setBusy] = useState(false);
  const Tag: any = rows > 1 ? 'textarea' : 'input';
  const extra = rows > 1 ? { rows } : {};
  async function fill() {
    if (!value.en.trim()) return;
    setBusy(true);
    const out = await transliterate(value.en);
    setBusy(false);
    if (out !== null) onChange({ ...value, ta: out });
  }
  return (
    <div className="g2">
      <div>
        <label className="lbl">{label} (English)</label>
        <Tag {...extra} className="inp" value={value.en} onChange={(e: any) => onChange({ ...value, en: e.target.value })} />
      </div>
      <div>
        <div className="lblrow">
          <label className="lbl">{label} (தமிழ்)</label>
          <button type="button" className="btn link" disabled={busy || !value.en.trim()} onClick={fill}>{busy ? 'Converting...' : 'Auto-fill'}</button>
        </div>
        <Tag {...extra} className="inp" value={value.ta} onChange={(e: any) => onChange({ ...value, ta: e.target.value })} />
      </div>
    </div>
  );
}

// A photo box: preview, upload, remove. The photo uploads at once; it shows on the website after Save changes.
function PhotoField({ label, value, onChange, flash, w = 1600, round = false, hint }: {
  label: string; value: string; onChange: (url: string) => void; flash: (k: 'ok' | 'err', m: string) => void; w?: number; round?: boolean; hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function pick(f?: File) {
    if (!f) return;
    setBusy(true);
    try {
      const body = new FormData(); body.append('image', f);
      const res = await fetch(`${PAGES}/upload?w=${w}`, { method: 'POST', headers: authHeader(), body });
      const d = await readJson(res);
      if (!res.ok) { flash('err', failText(d, 'Could not upload the photo.')); return; }
      onChange(d.url);
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy(false); }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
      <div className="thumb" style={{ width: 96, height: 96, borderRadius: round ? '50%' : 10 }}>{value ? <img src={fileUrl(value)} alt="" /> : 'None'}</div>
      <div>
        <p className="lbl" style={{ marginBottom: 6 }}>{label}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="btn sm" style={{ cursor: 'pointer' }}>{busy ? 'Uploading...' : value ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {value && <button type="button" className="btn sm" disabled={busy} onClick={() => onChange('')}>Remove</button>}
        </div>
        {hint && <p className="hint mut">{hint}</p>}
      </div>
    </div>
  );
}

// Where a link goes: pick a page from the list, or type a page path or a full web address
function LinkField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const known = PAGE_OPTIONS.some((o) => o.value === value);
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="lbl">{label}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="inp" style={{ width: 'auto', minWidth: 220 }} value={known ? value : ''} onChange={(e) => { if (e.target.value) onChange(e.target.value); }}>
          <option value="">Other (type in the box)</option>
          {PAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input className="inp" style={{ flex: 1, minWidth: 200 }} value={value} placeholder="/contact  or  https://example.org" onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

export default function AboutAdhishtanam() {
  const { notice, flash, clear } = useFlash();
  const [doc, setDoc] = useState<Doc>(emptyDoc());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(PAGES, { headers: authHeader(), cache: 'no-store' });
      const d = await readJson(res);
      if (!res.ok) throw new Error(failText(d, `Could not load the page (${res.status}).`));
      setDoc(norm(d.content));
    } catch (e: any) { setErr(`${e?.message || 'Could not load the page.'} [${PAGES}]`); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setSimple = (k: SimpleKey, v: Bi) => setDoc((d) => ({ ...d, [k]: v }));
  // 'parayanam' items are plain Bi values, the other lists hold objects
  const patch = (key: ListKey, i: number, p: any) => setDoc((d) => ({ ...d, [key]: (d[key] as any[]).map((x, k) => (k === i ? (key === 'parayanam' ? p : { ...x, ...p }) : x)) }));
  const add = (key: ListKey, item: any) => setDoc((d) => ({ ...d, [key]: [...(d[key] as any[]), item] }));
  const remove = (key: ListKey, i: number) => setDoc((d) => ({ ...d, [key]: (d[key] as any[]).filter((_, k) => k !== i) }));
  const move = (key: ListKey, i: number, dir: -1 | 1) => setDoc((d) => {
    const list = [...(d[key] as any[])];
    const j = i + dir;
    if (j < 0 || j >= list.length) return d;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...d, [key]: list };
  });

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(PAGES, { method: 'PUT', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ content: doc }) });
      const d = await readJson(res);
      if (!res.ok) { flash('err', failText(d, 'Could not save.')); return; }
      flash('ok', 'Saved. The website shows the new content now.');
    } catch { flash('err', 'Network error. Please try again.'); } finally { setSaving(false); }
  }

  const S = (k: SimpleKey) => SIMPLE.find((x) => x[0] === k)!;
  const simple = (k: SimpleKey) => <BiField key={k} label={S(k)[1]} rows={S(k)[2]} value={doc[k]} onChange={(v) => setSimple(k, v)} />;
  const sec = (title: string, children: React.ReactNode) => (<section className="card" style={{ padding: 18, marginBottom: 16 }}><h3 className="sech">{title}</h3>{children}</section>);
  const bar = (key: ListKey, i: number, len: number, removeLabel: string) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
      <button type="button" className="btn sm" disabled={i === 0} onClick={() => move(key, i, -1)}>Move up</button>
      <button type="button" className="btn sm" disabled={i === len - 1} onClick={() => move(key, i, 1)}>Move down</button>
      <button type="button" className="btn sm dng" onClick={() => remove(key, i)}>{removeLabel}</button>
    </div>
  );

  if (loading) return <div className="dc"><style>{CSS}</style><div className="skel" /><div className="skel" /></div>;
  if (err) return <div className="dc"><style>{CSS}</style><div role="alert" className="alert bad">{err} <button type="button" className="btn link" onClick={load}>Try again</button></div></div>;

  return (
    <div className="dc">
      <style>{CSS}</style>
      <div className="head">
        <div>
          <h1 className="title">Adhishtanam</h1>
          <p className="mut" style={{ marginTop: 2 }}>Everything on the About / Adhishtanam page. A text left empty keeps the current website text. Photos upload at once and appear on the website after you press Save changes.</p>
        </div>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
      </div>
      <Notice notice={notice} onClear={clear} />

      {sec('Page title and search', <>{simple('meta_title')}{simple('meta_description')}</>)}

      {sec('Top of the page', (
        <>
          <PhotoField label="Round photo (the Adhishtanam)" value={doc.heroImage} onChange={(u) => setDoc((d) => ({ ...d, heroImage: u }))} flash={flash} w={1200} round hint="A square photo, about 1000 x 1000." />
          {simple('eyebrow')}{simple('title')}{simple('tagline')}{simple('intro')}{simple('est')}{simple('heroAlt')}
        </>
      ))}

      {sec('Three facts (shown under the top banner)', (
        <>
          {doc.stats.map((f, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ fontWeight: 800, marginBottom: 8 }}>Fact {i + 1}</p>
              <BiField label="Value (big text)" value={f.value} onChange={(v) => patch('stats', i, { value: v })} />
              <BiField label="Label (small text)" value={f.label} onChange={(v) => patch('stats', i, { label: v })} />
              {bar('stats', i, doc.stats.length, 'Remove')}
            </div>
          ))}
          <button type="button" className="btn" onClick={() => add('stats', { label: bi(), value: bi() })}>+ Add a fact</button>
        </>
      ))}

      {sec('About the Adhishtanam', (
        <>
          <PhotoField label="Dhyana Mandapam photo" value={doc.mandapamImage} onChange={(u) => setDoc((d) => ({ ...d, mandapamImage: u }))} flash={flash} w={1600} hint="A landscape photo, about 1200 x 900." />
          {simple('aboutTitle')}{simple('aboutText1')}{simple('aboutText2')}{simple('photoAlt')}
        </>
      ))}

      {sec('Guru verse (dark band)', (
        <>
          <div style={{ marginBottom: 12 }}>
            <label className="lbl">Sanskrit verse (one line per row, same on English and Tamil pages)</label>
            <textarea className="inp" rows={3} lang="sa" value={doc.verseSanskrit} onChange={(e) => setDoc((d) => ({ ...d, verseSanskrit: e.target.value }))} />
          </div>
          {simple('verseTranslation')}{simple('verseSource')}
        </>
      ))}

      {sec('What devotees do here', (
        <>
          {simple('doTitle')}{simple('doText')}
          <p className="hint mut" style={{ marginBottom: 8 }}>The round icon on each card follows the order: walking around, prayer beads, lotus, then the same three again.</p>
          {doc.practices.map((p, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ fontWeight: 800, marginBottom: 8 }}>Card {i + 1}{p.name.en ? `: ${p.name.en}` : ''}</p>
              <BiField label="Name" value={p.name} onChange={(v) => patch('practices', i, { name: v })} />
              <BiField label="Text" rows={2} value={p.text} onChange={(v) => patch('practices', i, { text: v })} />
              {bar('practices', i, doc.practices.length, 'Remove card')}
            </div>
          ))}
          <button type="button" className="btn" onClick={() => add('practices', { name: bi(), text: bi() })}>+ Add a card</button>
        </>
      ))}

      {sec('Evening parayanam (maroon band)', (
        <>
          {simple('parayanamLabel')}{simple('parayanamTime')}{simple('parayanamTitle')}{simple('parayanamText')}
          <p className="lbl" style={{ marginTop: 6 }}>Texts chanted</p>
          {doc.parayanam.map((x, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <BiField label={`Text ${i + 1}`} value={x} onChange={(v) => patch('parayanam', i, v)} />
              {bar('parayanam', i, doc.parayanam.length, 'Remove')}
            </div>
          ))}
          <button type="button" className="btn" onClick={() => add('parayanam', bi())}>+ Add a text</button>
        </>
      ))}

      {sec('Teaching quote', <>{simple('teachingText')}{simple('teachingSource')}</>)}
      {sec('Visit and links', (
        <>
          {simple('visitTitle')}{simple('address')}{simple('visitCta')}
          <LinkField label="Visit button opens" value={doc.visitLink} onChange={(v) => setDoc((d) => ({ ...d, visitLink: v }))} />
          <p className="hint mut" style={{ marginBottom: 14 }}>Choose a page from the list, or type a page of this website like /contact (no language part needed), or a full address like https://example.org. The English or Tamil version of the page opens by itself.</p>

          <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '8px 0 16px' }} />
          {simple('moreTitle')}
          <p className="lbl" style={{ marginTop: 6 }}>Links to other pages (shown as cards at the bottom)</p>
          {doc.links.map((l, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ fontWeight: 800, marginBottom: 8 }}>Link {i + 1}{l.label.en ? `: ${l.label.en}` : ''}</p>
              <BiField label="Card text" value={l.label} onChange={(v) => patch('links', i, { label: v })} />
              <LinkField label="Opens" value={l.href} onChange={(v) => patch('links', i, { href: v })} />
              {bar('links', i, doc.links.length, 'Remove link')}
            </div>
          ))}
          <button type="button" className="btn" onClick={() => add('links', { label: bi(), href: '' })}>+ Add a link</button>
        </>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 30 }}>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
      </div>
    </div>
  );
}