import React, { useCallback, useEffect, useState } from 'react';
import * as Kit from './DiscoverKit';
import { API, CSS, Notice, authHeader, failText, fileUrl, readJson, useFlash } from './DiscoverKit';

// API points at .../api/v1/discover, the pages API is .../api/v1/pages
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const SLUG = 'omkarananda';
const PAGES = `${API_BASE}/pages/admin/${SLUG}`;

// Uses the Tamil converter of DiscoverKit when it exists
const transliterate = async (text: string): Promise<string | null> => {
  const fn = (Kit as any).transliterate;
  return typeof fn === 'function' ? fn(text) : null;
};

type Bi = { en: string; ta: string };
const bi = (): Bi => ({ en: '', ta: '' });
const SIMPLE = [
  ['meta_title', 'Browser title', 1], ['meta_description', 'Search description', 2],
  ['eyebrow', 'Small label above the name', 1], ['name', 'Name', 1], ['profile', 'Title under the name', 1],
  ['role', 'Role', 1], ['intro', 'Introduction', 3], ['tagline', 'Tagline', 1],
  ['photoAlt', 'Photo description', 1], ['samadhi', 'Label under the photo', 1],
  ['lifeTitle', 'Life journey heading', 1],
  ['todayTitle', 'Teacher section heading', 1], ['todayIntro', 'Teacher section quote', 3],
  ['abroadTitle', 'Abroad heading', 1], ['abroadText', 'Abroad text', 2],
  ['listenTitle', 'Listen band heading', 1], ['listenText', 'Listen band text', 2],
  ['listenAudio', 'Audio button', 1], ['listenVideo', 'Video button', 1], ['moreTitle', 'Continue exploring heading', 1],
] as const;
type SimpleKey = (typeof SIMPLE)[number][0];
type Doc = Record<SimpleKey, Bi> & {
  facts: { label: Bi; value: Bi }[];
  timeline: { when: Bi; title: Bi; text: Bi }[];
  roles: { title: Bi; text: Bi }[];
  abroad: Bi[];
};
const emptyDoc = (): Doc => {
  const d: any = { facts: [], timeline: [], roles: [], abroad: [] };
  SIMPLE.forEach(([k]) => { d[k] = bi(); });
  return d as Doc;
};
const norm = (raw: any): Doc => {
  const d = emptyDoc();
  const b = (x: any): Bi => ({ en: String(x?.en ?? ''), ta: String(x?.ta ?? '') });
  SIMPLE.forEach(([k]) => { d[k] = b(raw?.[k]); });
  d.facts = (raw?.facts || []).map((f: any) => ({ label: b(f.label), value: b(f.value) }));
  d.timeline = (raw?.timeline || []).map((f: any) => ({ when: b(f.when), title: b(f.title), text: b(f.text) }));
  d.roles = (raw?.roles || []).map((f: any) => ({ title: b(f.title), text: b(f.text) }));
  d.abroad = (raw?.abroad || []).map(b);
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

export default function AboutOmkarananda() {
  const { notice, flash, clear } = useFlash();
  const [doc, setDoc] = useState<Doc>(emptyDoc());
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(PAGES, { headers: authHeader(), cache: 'no-store' });
      const d = await readJson(res);
      if (!res.ok) throw new Error(failText(d, `Could not load the page (${res.status}).`));
      setDoc(norm(d.content)); setImage(d.image_url || null);
    } catch (e: any) { setErr(`${e?.message || 'Could not load the page.'} [${PAGES}]`); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setSimple = (k: SimpleKey, v: Bi) => setDoc((d) => ({ ...d, [k]: v }));
  type ListKey = 'facts' | 'timeline' | 'roles' | 'abroad';
  const patch = (key: ListKey, i: number, p: any) => setDoc((d) => ({ ...d, [key]: (d[key] as any[]).map((x, k) => (k === i ? (key === 'abroad' ? p : { ...x, ...p }) : x)) }));
  const add = (key: ListKey, item: any) => setDoc((d) => ({ ...d, [key]: [...(d[key] as any[]), item] }));
  const remove = (key: ListKey, i: number) => setDoc((d) => ({ ...d, [key]: (d[key] as any[]).filter((_, k) => k !== i) }));

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(PAGES, { method: 'PUT', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ content: doc }) });
      const d = await readJson(res);
      if (!res.ok) { flash('err', failText(d, 'Could not save.')); return; }
      flash('ok', 'Saved. The website shows the new text now.');
    } catch { flash('err', 'Network error. Please try again.'); } finally { setSaving(false); }
  }

  async function pickImage(f?: File) {
    if (!f) return;
    setImgBusy(true);
    try {
      const body = new FormData(); body.append('image', f);
      const res = await fetch(`${PAGES}/image`, { method: 'POST', headers: authHeader(), body });
      const d = await readJson(res);
      if (!res.ok) { flash('err', failText(d, 'Could not save the photo.')); return; }
      setImage(d.image_url); flash('ok', 'Photo updated.');
    } catch { flash('err', 'Network error. Please try again.'); } finally { setImgBusy(false); }
  }
  async function dropImage() {
    setImgBusy(true);
    try {
      const res = await fetch(`${PAGES}/image`, { method: 'DELETE', headers: authHeader() });
      if (res.ok) { setImage(null); flash('ok', 'Photo removed. The default photo is shown.'); }
    } finally { setImgBusy(false); }
  }

  const S = (k: SimpleKey) => SIMPLE.find((x) => x[0] === k)!;
  const simple = (k: SimpleKey) => <BiField key={k} label={S(k)[1]} rows={S(k)[2]} value={doc[k]} onChange={(v) => setSimple(k, v)} />;
  const sec = (title: string, children: React.ReactNode) => (<section className="card" style={{ padding: 18, marginBottom: 16 }}><h3 className="sech">{title}</h3>{children}</section>);

  if (loading) return <div className="dc"><style>{CSS}</style><div className="skel" /><div className="skel" /></div>;
  if (err) return <div className="dc"><style>{CSS}</style><div role="alert" className="alert bad">{err} <button type="button" className="btn link" onClick={load}>Try again</button></div></div>;

  return (
    <div className="dc">
      <style>{CSS}</style>
      <div className="head">
        <div>
          <h1 className="title">Sri Swami Omkarananda</h1>
          <p className="mut" style={{ marginTop: 2 }}>Everything on the About / Omkarananda page. A field left empty keeps the current website text.</p>
        </div>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
      </div>
      <Notice notice={notice} onClear={clear} />

      {sec('Portrait photo', (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="thumb" style={{ width: 110, height: 110, borderRadius: '50%' }}>{image ? <img src={fileUrl(image)} alt="" /> : 'Default'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label className="btn" style={{ cursor: 'pointer' }}>{imgBusy ? 'Saving...' : image ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={imgBusy} onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ''; }} /></label>
            {image && <button type="button" className="btn" disabled={imgBusy} onClick={dropImage}>Remove</button>}
          </div>
          <p className="hint mut">Square photos work best. It is optimized automatically. The photo saves at once.</p>
        </div>
      ))}

      {sec('Page title and search', <>{simple('meta_title')}{simple('meta_description')}</>)}
      {sec('Top of the page', <>{simple('eyebrow')}{simple('name')}{simple('profile')}{simple('role')}{simple('intro')}{simple('tagline')}{simple('samadhi')}{simple('photoAlt')}</>)}

      {sec('The four dates (shown under the top banner)', (
        <>
          {doc.facts.map((f, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
              <BiField label="Label" value={f.label} onChange={(v) => patch('facts', i, { label: v })} />
              <BiField label="Value" value={f.value} onChange={(v) => patch('facts', i, { value: v })} />
              <button type="button" className="btn sm dng" onClick={() => remove('facts', i)}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => add('facts', { label: bi(), value: bi() })}>+ Add a date</button>
        </>
      ))}

      {sec('Life journey', (
        <>
          {simple('lifeTitle')}
          {doc.timeline.map((f, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ fontWeight: 800, marginBottom: 8 }}>Stop {i + 1}</p>
              <BiField label="When" value={f.when} onChange={(v) => patch('timeline', i, { when: v })} />
              <BiField label="Title" value={f.title} onChange={(v) => patch('timeline', i, { title: v })} />
              <BiField label="Text" rows={3} value={f.text} onChange={(v) => patch('timeline', i, { text: v })} />
              <button type="button" className="btn sm dng" onClick={() => remove('timeline', i)}>Remove stop</button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => add('timeline', { when: bi(), title: bi(), text: bi() })}>+ Add a stop</button>
        </>
      ))}

      {sec('Teacher, Acharya and guide', (
        <>
          {simple('todayTitle')}{simple('todayIntro')}
          {doc.roles.map((f, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
              <BiField label="Role title" value={f.title} onChange={(v) => patch('roles', i, { title: v })} />
              <BiField label="Role text" rows={3} value={f.text} onChange={(v) => patch('roles', i, { text: v })} />
              <button type="button" className="btn sm dng" onClick={() => remove('roles', i)}>Remove role</button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => add('roles', { title: bi(), text: bi() })}>+ Add a role</button>
        </>
      ))}

      {sec('Around the world', (
        <>
          {simple('abroadTitle')}{simple('abroadText')}
          {doc.abroad.map((f, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <BiField label={`Country ${i + 1}`} value={f} onChange={(v) => patch('abroad', i, v)} />
              <button type="button" className="btn sm dng" onClick={() => remove('abroad', i)}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => add('abroad', bi())}>+ Add a country</button>
        </>
      ))}

      {sec('Listen band and links', <>{simple('listenTitle')}{simple('listenText')}{simple('listenAudio')}{simple('listenVideo')}{simple('moreTitle')}</>)}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 30 }}>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
      </div>
    </div>
  );
}