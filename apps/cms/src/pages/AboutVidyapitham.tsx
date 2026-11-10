import React, { useCallback, useEffect, useState } from 'react';
import * as Kit from './DiscoverKit';
import { API, CSS, Notice, authHeader, failText, fileUrl, readJson, useFlash } from './DiscoverKit';

// API points at .../api/v1/discover, the pages API is .../api/v1/pages
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const SLUG = 'vidyapitham';
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
  ['aboutTitle', 'About heading', 1], ['aboutText1', 'About paragraph 1', 4], ['aboutText2', 'About paragraph 2', 4], ['photoAlt', 'Temple photo description', 1],
  ['murtisTitle', 'Heading', 1], ['murtisText', 'Introduction', 2], ['murtiTag', 'Small text under each deity', 1],
  ['kshetraTitle', 'Heading', 1], ['kshetraText', 'Introduction', 2],
  ['historyTitle', 'Heading', 1], ['worshipText', 'Worship paragraph (below the milestones)', 4],
  ['featuresTitle', 'Heading', 1], ['featuresNote', 'Note below the features', 3],
  ['scheduleTitle', 'Heading', 1], ['scheduleText', 'Introduction', 2], ['morningLabel', 'Morning column title', 1], ['eveningLabel', 'Evening column title', 1], ['scheduleNote', 'Note below the schedule', 2],
  ['corpusTitle', 'Heading', 1], ['corpusText', 'Text', 3], ['corpusCta', 'Button text', 1],
  ['trustTitle', 'Heading', 1], ['trustText', 'Text', 3], ['trustReg', 'Registration number', 1],
  ['visitTitle', 'Visit heading', 1], ['address', 'Address', 3], ['visitCta', 'Visit button', 1],
  ['moreTitle', 'Continue exploring heading', 1],
] as const;
type SimpleKey = (typeof SIMPLE)[number][0];

// Lists: each item has these fields (key, label, lines). A null field list means the item is just one text.
type FieldSpec = readonly [string, string, number];
const LISTS: Record<string, { item: string; fields: readonly FieldSpec[] | null; gate?: boolean }> = {
  stats: { item: 'Fact', fields: [['value', 'Value (big text)', 1], ['label', 'Label (small text)', 1]] },
  murtis: { item: 'Deity', fields: null },
  kshetra: { item: 'Feature', fields: [['label', 'Heading', 1], ['value', 'Text', 1]] },
  history: { item: 'Milestone', fields: [['when', 'When', 1], ['title', 'Title', 1], ['text', 'Text', 2]] },
  features: { item: 'Feature', fields: [['label', 'Heading', 1], ['value', 'Text', 2]] },
  morning: { item: 'Time', fields: [['time', 'Time', 1], ['label', 'What happens', 2]], gate: true },
  evening: { item: 'Time', fields: [['time', 'Time', 1], ['label', 'What happens', 2]], gate: true },
  corpusOptions: { item: 'Option', fields: [['label', 'Name', 1], ['value', 'Amount', 1]] },
};
type ListKey = 'stats' | 'murtis' | 'kshetra' | 'history' | 'features' | 'morning' | 'evening' | 'corpusOptions' | 'links';
const LIST_KEYS = Object.keys(LISTS) as ListKey[];

// Pages the buttons and links can point to. Anything else can be typed in the link box:
// /some-page for a page of this website, or https://... for another website.
const PAGE_OPTIONS = [
  { value: '/', label: 'Home' },
  { value: '/about/omkarananda', label: 'About: Pujyasri Omkarananda' },
  { value: '/about/ashramam', label: 'About: Ashramam' },
  { value: '/about/adhishtanam', label: 'About: Adhishtanam' },
  { value: '/about/vidyapitham', label: 'About: Vidyapitham' },
  { value: '/sevas', label: 'Sevas' },
  { value: '/contact', label: 'Contact' },
];
type LinkItem = { label: Bi; href: string };
const DEFAULT_LINKS: LinkItem[] = [
  { label: { en: 'Pujyasri Omkarananda MahaSwamigal', ta: 'பூஜ்யஸ்ரீ சுவாமி ஓங்காரானந்த மகாஸ்வாமிகள்' }, href: '/about/omkarananda' },
  { label: { en: 'Ashramam', ta: 'ஆசிரமம்' }, href: '/about/ashramam' },
  { label: { en: 'Adhishtanam', ta: 'அதிஷ்டானம்' }, href: '/about/adhishtanam' },
];

type Doc = Record<SimpleKey, Bi> & Record<ListKey, any[]> & {
  heroImage: string;
  templeImage: string;
  corpusLink: string;
  visitLink: string;
};

const emptyDoc = (): Doc => {
  const d: any = { heroImage: '', templeImage: '', corpusLink: '/sevas', visitLink: '/contact', links: [] };
  SIMPLE.forEach(([k]) => { d[k] = bi(); });
  LIST_KEYS.forEach((k) => { d[k] = []; });
  return d as Doc;
};
const norm = (raw: any): Doc => {
  const d: any = emptyDoc();
  SIMPLE.forEach(([k]) => { d[k] = b(raw?.[k]); });
  d.heroImage = String(raw?.heroImage ?? '');
  d.templeImage = String(raw?.templeImage ?? '');
  LIST_KEYS.forEach((k) => {
    const spec = LISTS[k];
    const arr: any[] = Array.isArray(raw?.[k]) ? raw[k] : [];
    d[k] = arr.map((x) => {
      if (!spec.fields) return b(x);
      const o: any = {};
      spec.fields.forEach(([f]) => { o[f] = b(x?.[f]); });
      if (spec.gate) o.gate = !!x?.gate;
      return o;
    });
  });
  const str = (v: any, fb: string) => (typeof v === 'string' && v.trim() ? v : fb);
  d.corpusLink = str(raw?.corpusLink, '/sevas');
  d.visitLink = str(raw?.visitLink, '/contact');
  // A page saved before links existed shows the three current links, ready to edit
  d.links = Array.isArray(raw?.links)
    ? raw.links.map((x: any) => ({ label: b(x?.label), href: String(x?.href ?? '') }))
    : DEFAULT_LINKS.map((x) => ({ label: { ...x.label }, href: x.href }));
  return d as Doc;
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

export default function AboutVidyapitham() {
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
  // 'murtis' items are plain Bi values, the other lists hold objects
  const patch = (key: ListKey, i: number, p: any) => setDoc((d) => ({ ...d, [key]: d[key].map((x, k) => (k === i ? (key === 'murtis' ? p : { ...x, ...p }) : x)) }));
  const add = (key: ListKey, item: any) => setDoc((d) => ({ ...d, [key]: [...d[key], item] }));
  const remove = (key: ListKey, i: number) => setDoc((d) => ({ ...d, [key]: d[key].filter((_, k) => k !== i) }));
  const move = (key: ListKey, i: number, dir: -1 | 1) => setDoc((d) => {
    const list = [...d[key]];
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
  const simple = (k: SimpleKey, label?: string) => <BiField key={k} label={label || S(k)[1]} rows={S(k)[2]} value={doc[k]} onChange={(v) => setSimple(k, v)} />;
  const sec = (title: string, children: React.ReactNode) => (<section className="card" style={{ padding: 18, marginBottom: 16 }}><h3 className="sech">{title}</h3>{children}</section>);
  const bar = (key: ListKey, i: number, len: number, removeLabel: string) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
      <button type="button" className="btn sm" disabled={i === 0} onClick={() => move(key, i, -1)}>Move up</button>
      <button type="button" className="btn sm" disabled={i === len - 1} onClick={() => move(key, i, 1)}>Move down</button>
      <button type="button" className="btn sm dng" onClick={() => remove(key, i)}>{removeLabel}</button>
    </div>
  );

  // One editable list: every item with its fields, move and remove buttons, and an add button
  const listBlock = (key: ListKey) => {
    const spec = LISTS[key];
    const items = doc[key];
    const emptyItem = () => {
      if (!spec.fields) return bi();
      const o: any = {};
      spec.fields.forEach(([f]) => { o[f] = bi(); });
      if (spec.gate) o.gate = false;
      return o;
    };
    return (
      <>
        {items.map((it: any, i: number) => (
          <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
            <p style={{ fontWeight: 800, marginBottom: 8 }}>{spec.item} {i + 1}</p>
            {spec.fields ? (
              <>
                {spec.fields.map(([f, label, rows]) => (
                  <BiField key={f} label={label} rows={rows} value={it[f]} onChange={(v) => patch(key, i, { [f]: v })} />
                ))}
                {spec.gate && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 8px', fontWeight: 600 }}>
                    <input type="checkbox" checked={!!it.gate} onChange={(e) => patch(key, i, { gate: e.target.checked })} />
                    Highlight this row (temple opens or closes)
                  </label>
                )}
              </>
            ) : (
              <BiField label="Name" value={it} onChange={(v) => patch(key, i, v)} />
            )}
            {bar(key, i, items.length, 'Remove')}
          </div>
        ))}
        <button type="button" className="btn" onClick={() => add(key, emptyItem())}>+ Add {spec.item.toLowerCase()}</button>
      </>
    );
  };

  if (loading) return <div className="dc"><style>{CSS}</style><div className="skel" /><div className="skel" /></div>;
  if (err) return <div className="dc"><style>{CSS}</style><div role="alert" className="alert bad">{err} <button type="button" className="btn link" onClick={load}>Try again</button></div></div>;

  return (
    <div className="dc">
      <style>{CSS}</style>
      <div className="head">
        <div>
          <h1 className="title">Vidyapitham</h1>
          <p className="mut" style={{ marginTop: 2 }}>Everything on the About / Vidyapitham page. A text left empty keeps the current website text. Photos upload at once and appear on the website after you press Save changes.</p>
        </div>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
      </div>
      <Notice notice={notice} onClear={clear} />

      {sec('Page title and search', <>{simple('meta_title')}{simple('meta_description')}</>)}

      {sec('Top of the page', (
        <>
          <PhotoField label="Round photo (the temple or the Moolavar)" value={doc.heroImage} onChange={(u) => setDoc((d) => ({ ...d, heroImage: u }))} flash={flash} w={1200} round hint="A square photo, about 1000 x 1000." />
          {simple('eyebrow')}{simple('title')}{simple('tagline')}{simple('intro')}{simple('est')}{simple('heroAlt')}
        </>
      ))}

      {sec('Three facts (shown under the top banner)', listBlock('stats'))}

      {sec('About the Vidyapitham', (
        <>
          <PhotoField label="Temple photo (with the vimanam)" value={doc.templeImage} onChange={(u) => setDoc((d) => ({ ...d, templeImage: u }))} flash={flash} w={1600} hint="A landscape photo, about 1200 x 900." />
          {simple('aboutTitle')}{simple('aboutText1')}{simple('aboutText2')}{simple('photoAlt')}
        </>
      ))}

      {sec('The six Shanmatha Murtis', <>{simple('murtisTitle')}{simple('murtisText')}{simple('murtiTag')}{listBlock('murtis')}</>)}

      {sec('Features of an ideal kshetra (maroon band)', <>{simple('kshetraTitle')}{simple('kshetraText')}{listBlock('kshetra')}</>)}

      {sec('History and milestones', <>{simple('historyTitle')}{listBlock('history')}{simple('worshipText')}</>)}

      {sec('Other features of the temple', <>{simple('featuresTitle')}{listBlock('features')}{simple('featuresNote')}</>)}

      {sec('Daily puja and abhishekam', (
        <>
          {simple('scheduleTitle')}{simple('scheduleText')}
          <h4 style={{ fontWeight: 800, margin: '10px 0 8px' }}>Morning rows</h4>
          {simple('morningLabel')}
          {listBlock('morning')}
          <h4 style={{ fontWeight: 800, margin: '18px 0 8px' }}>Evening rows</h4>
          {simple('eveningLabel')}
          {listBlock('evening')}
          <div style={{ marginTop: 12 }}>{simple('scheduleNote')}</div>
        </>
      ))}

      {sec('Pooja Corpus (dark band)', (
        <>
          {simple('corpusTitle')}{simple('corpusText')}
          {listBlock('corpusOptions')}
          <div style={{ marginTop: 12 }}>{simple('corpusCta')}</div>
          <LinkField label="Button opens" value={doc.corpusLink} onChange={(v) => setDoc((d) => ({ ...d, corpusLink: v }))} />
        </>
      ))}

      {sec('Sri Dakshinamurti Seva Samiti', <>{simple('trustTitle')}{simple('trustText')}{simple('trustReg')}</>)}

      {sec('Visit and links', (
        <>
          {simple('visitTitle')}{simple('address')}{simple('visitCta')}
          <LinkField label="Visit button opens" value={doc.visitLink} onChange={(v) => setDoc((d) => ({ ...d, visitLink: v }))} />
          <p className="hint mut" style={{ marginBottom: 14 }}>Choose a page from the list, or type a page of this website like /contact (no language part needed), or a full address like https://example.org. The English or Tamil version of the page opens by itself.</p>

          <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '8px 0 16px' }} />
          {simple('moreTitle')}
          <p className="lbl" style={{ marginTop: 6 }}>Links to other pages (shown as cards at the bottom)</p>
          {doc.links.map((l: LinkItem, i: number) => (
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