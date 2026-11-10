import React, { useCallback, useEffect, useState } from 'react';
import * as Kit from './DiscoverKit';
import { API, CSS, Notice, authHeader, failText, fileUrl, readJson, useFlash } from './DiscoverKit';

// API points at .../api/v1/discover. The Accommodation API is .../api/v1/accommodation
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const ACC = `${API_BASE}/accommodation`;
const PAGE = `${ACC}/admin/page`;

// Uses the Tamil converter of DiscoverKit when it exists
const transliterate = async (text: string): Promise<string | null> => {
  const fn = (Kit as any).transliterate;
  return typeof fn === 'function' ? fn(text) : null;
};

type Bi = { en: string; ta: string };
const bi = (): Bi => ({ en: '', ta: '' });
const b = (x: any): Bi => ({ en: String(x?.en ?? ''), ta: String(x?.ta ?? '') });

// key, label in the CMS, number of text lines
type Spec = readonly [string, string, number];
const FIELDS: Record<string, Spec[]> = {
  search: [['meta', 'Page name and browser title', 1], ['metaText', 'Search description', 2]],
  top: [['title', 'Page title', 1], ['lead', 'Introduction', 2], ['campCta', 'First button text', 1], ['writeCta', 'Second button text', 1]],
  stay: [['stayTag', 'Small label', 1], ['stayTitle', 'Heading', 1], ['stayName', 'Name of the building', 1], ['stayText', 'Text', 3]],
  food: [['foodTag', 'Small label', 1], ['foodTitle', 'Heading', 1], ['foodText', 'Text', 3]],
  setting: [['setTag', 'Small label', 1], ['setTitle', 'Heading', 1], ['setText', 'Text', 3]],
  details: [['detailsTitle', 'Heading', 1], ['detailsLead', 'Short line under the heading', 2]],
  steps: [['stepsTitle', 'Heading', 1]],
  cta: [['ctaTitle', 'Heading', 1], ['ctaText', 'Text', 2], ['callCta', 'Call button text (the phone number is added after it)', 1]],
};
const ALL_BI: Spec[] = Object.values(FIELDS).flat();

// Pages the links can point to. Anything else can be typed: /some-page for this website, or https://... for another website.
const PAGE_OPTIONS = [
  { value: '/', label: 'Home' },
  { value: '/camps', label: 'Camps' },
  { value: '/sevas', label: 'Sevas' },
  { value: '/donate', label: 'Donate' },
  { value: '/magazine', label: 'Magazine' },
  { value: '/contact', label: 'Contact' },
  { value: '/accommodation', label: 'Accommodation' },
  { value: '/about/ashramam', label: 'About: Ashramam' },
];

type Detail = { label: Bi; text: Bi };
type Step = { title: Bi; text: Bi };
type Doc = Record<string, any> & { details: Detail[]; steps: Step[]; stayImage: string; foodImage: string; settingImage: string; campLink: string; writeLink: string };

const emptyDoc = (): Doc => {
  const d: any = { details: [], steps: [], stayImage: '', foodImage: '', settingImage: '', campLink: '/camps', writeLink: '/contact' };
  ALL_BI.forEach(([k]) => { d[k] = bi(); });
  return d as Doc;
};
const norm = (raw: any): Doc => {
  const d: any = emptyDoc();
  ALL_BI.forEach(([k]) => { d[k] = b(raw?.[k]); });
  d.details = (Array.isArray(raw?.details) ? raw.details : []).map((x: any) => ({ label: b(x?.label), text: b(x?.text) }));
  d.steps = (Array.isArray(raw?.steps) ? raw.steps : []).map((x: any) => ({ title: b(x?.title), text: b(x?.text) }));
  ['stayImage', 'foodImage', 'settingImage'].forEach((k) => { d[k] = typeof raw?.[k] === 'string' ? raw[k] : ''; });
  d.campLink = typeof raw?.campLink === 'string' && raw.campLink.trim() ? raw.campLink : '/camps';
  d.writeLink = typeof raw?.writeLink === 'string' && raw.writeLink.trim() ? raw.writeLink : '/contact';
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
function PhotoField({ label, value, onChange, flash, hint }: { label: string; value: string; onChange: (url: string) => void; flash: (k: 'ok' | 'err', m: string) => void; hint?: string }) {
  const [busy, setBusy] = useState(false);
  async function pick(f?: File) {
    if (!f) return;
    setBusy(true);
    try {
      const body = new FormData(); body.append('image', f);
      const res = await fetch(`${ACC}/admin/upload?w=1400`, { method: 'POST', headers: authHeader(), body });
      const d = await readJson(res);
      if (!res.ok) { flash('err', failText(d, 'Could not upload the photo.')); return; }
      onChange(d.url);
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy(false); }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
      <div className="thumb" style={{ width: 120, height: 90, borderRadius: 10 }}>{value ? <img src={fileUrl(value)} alt="" /> : 'Default'}</div>
      <div>
        <p className="lbl" style={{ marginBottom: 6 }}>{label}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="btn sm" style={{ cursor: 'pointer' }}>{busy ? 'Uploading...' : value ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {value && <button type="button" className="btn sm" disabled={busy} onClick={() => onChange('')}>Use the website's own photo</button>}
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
        <input className="inp" style={{ flex: 1, minWidth: 200 }} value={value} placeholder="/camps  or  https://example.org" onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

export default function AccommodationManagement() {
  const { notice, flash, clear } = useFlash();
  const [doc, setDoc] = useState<Doc>(emptyDoc());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(PAGE, { headers: authHeader(), cache: 'no-store' });
      const d = await readJson(res);
      if (!res.ok) throw new Error(failText(d, `Could not load the page (${res.status}).`));
      setDoc(norm(d.content));
    } catch (e: any) { setErr(`${e?.message || 'Could not load the page.'} [${PAGE}]`); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setBi = (k: string, v: Bi) => setDoc((d) => ({ ...d, [k]: v }));
  const patch = (key: 'details' | 'steps', i: number, p: any) => setDoc((d) => ({ ...d, [key]: (d[key] as any[]).map((x, k) => (k === i ? { ...x, ...p } : x)) }));
  const remove = (key: 'details' | 'steps', i: number) => setDoc((d) => ({ ...d, [key]: (d[key] as any[]).filter((_, k) => k !== i) }));
  const move = (key: 'details' | 'steps', i: number, dir: -1 | 1) => setDoc((d) => {
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
      const res = await fetch(PAGE, { method: 'PUT', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ content: doc }) });
      const d = await readJson(res);
      if (!res.ok) { flash('err', failText(d, 'Could not save.')); return; }
      flash('ok', 'Saved. The website shows the new content now.');
    } catch { flash('err', 'Network error. Please try again.'); } finally { setSaving(false); }
  }

  const fields = (group: string) => FIELDS[group].map(([k, label, rows]) => <BiField key={k} label={label} rows={rows} value={doc[k]} onChange={(v) => setBi(k, v)} />);
  const sec = (title: string, children: React.ReactNode) => (<section className="card" style={{ padding: 18, marginBottom: 16 }}><h3 className="sech">{title}</h3>{children}</section>);
  const bar = (key: 'details' | 'steps', i: number, len: number, removeLabel: string) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
      <button type="button" className="btn sm" disabled={i === 0} onClick={() => move(key, i, -1)}>Move up</button>
      <button type="button" className="btn sm" disabled={i === len - 1} onClick={() => move(key, i, 1)}>Move down</button>
      <button type="button" className="btn sm dng" onClick={() => remove(key, i)}>{removeLabel}</button>
    </div>
  );

  return (
    <div className="dc">
      <style>{CSS}</style>
      <div className="head">
        <div>
          <h1 className="title">Accommodation</h1>
          <p className="mut" style={{ marginTop: 2 }}>Everything on the Accommodation page. A text left empty keeps the current website text. Photos upload at once and appear on the website after you press Save changes.</p>
        </div>
        <button type="button" className="btn primary" onClick={save} disabled={saving || loading}>{saving ? 'Saving...' : 'Save changes'}</button>
      </div>
      <Notice notice={notice} onClear={clear} />

      {loading ? <><div className="skel" /><div className="skel" /></> : err ? (
        <div role="alert" className="alert bad">{err} <button type="button" className="btn link" onClick={load}>Try again</button></div>
      ) : (
        <>
          {sec('Page name and search', fields('search'))}
          {sec('Top of the page', (
            <>
              {fields('top')}
              <LinkField label="First button opens" value={doc.campLink} onChange={(v) => setDoc((d) => ({ ...d, campLink: v }))} />
              <LinkField label="Second button opens" value={doc.writeLink} onChange={(v) => setDoc((d) => ({ ...d, writeLink: v }))} />
            </>
          ))}
          {sec('Card 1: Accommodation', (
            <>
              <PhotoField label="Photo" value={doc.stayImage} onChange={(u) => setDoc((d) => ({ ...d, stayImage: u }))} flash={flash} hint="A landscape photo, about 1200 x 900." />
              {fields('stay')}
            </>
          ))}
          {sec('Card 2: Food', (
            <>
              <PhotoField label="Photo" value={doc.foodImage} onChange={(u) => setDoc((d) => ({ ...d, foodImage: u }))} flash={flash} hint="A landscape photo, about 1200 x 900." />
              {fields('food')}
            </>
          ))}
          {sec('Card 3: The setting', (
            <>
              <PhotoField label="Photo" value={doc.settingImage} onChange={(u) => setDoc((d) => ({ ...d, settingImage: u }))} flash={flash} hint="A landscape photo, about 1200 x 900." />
              {fields('setting')}
            </>
          ))}
          {sec('Rooms and charges', (
            <>
              {fields('details')}
              <p className="lbl" style={{ marginTop: 6 }}>Rows (for example Rooms, Charges)</p>
              {doc.details.map((x, i) => (
                <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
                  <p style={{ fontWeight: 800, marginBottom: 8 }}>Row {i + 1}{x.label.en ? `: ${x.label.en}` : ''}</p>
                  <BiField label="Name" value={x.label} onChange={(v) => patch('details', i, { label: v })} />
                  <BiField label="Text" rows={2} value={x.text} onChange={(v) => patch('details', i, { text: v })} />
                  {bar('details', i, doc.details.length, 'Remove row')}
                </div>
              ))}
              <button type="button" className="btn" onClick={() => setDoc((d) => ({ ...d, details: [...d.details, { label: bi(), text: bi() }] }))}>+ Add a row</button>
            </>
          ))}
          {sec('How to request a stay', (
            <>
              {fields('steps')}
              <p className="lbl" style={{ marginTop: 6 }}>Steps</p>
              {doc.steps.map((x, i) => (
                <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
                  <p style={{ fontWeight: 800, marginBottom: 8 }}>Step {i + 1}{x.title.en ? `: ${x.title.en}` : ''}</p>
                  <BiField label="Title" value={x.title} onChange={(v) => patch('steps', i, { title: v })} />
                  <BiField label="Text" rows={2} value={x.text} onChange={(v) => patch('steps', i, { text: v })} />
                  {bar('steps', i, doc.steps.length, 'Remove step')}
                </div>
              ))}
              <button type="button" className="btn" onClick={() => setDoc((d) => ({ ...d, steps: [...d.steps, { title: bi(), text: bi() }] }))}>+ Add a step</button>
            </>
          ))}
          {sec('Closing banner', (
            <>
              <div className="alert info" style={{ marginBottom: 12 }}>The phone number on the call button comes from <strong>apps/web/src/lib/site.ts</strong>, the same as the footer and the Contact page.</div>
              {fields('cta')}
            </>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 30 }}>
            <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
          </div>
        </>
      )}
    </div>
  );
}