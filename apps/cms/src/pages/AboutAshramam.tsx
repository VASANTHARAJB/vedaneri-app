import React, { useCallback, useEffect, useState } from 'react';
import * as Kit from './DiscoverKit';
import { API, CSS, Notice, authHeader, failText, fileUrl, readJson, useFlash } from './DiscoverKit';

// API points at .../api/v1/discover, the pages API is .../api/v1/pages
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const SLUG = 'ashramam';
const PAGES = `${API_BASE}/pages/admin/${SLUG}`;

// Uses the Tamil converter of DiscoverKit when it exists
const transliterate = async (text: string): Promise<string | null> => {
  const fn = (Kit as any).transliterate;
  return typeof fn === 'function' ? fn(text) : null;
};

type Bi = { en: string; ta: string };
const bi = (): Bi => ({ en: '', ta: '' });
const b = (x: any): Bi => ({ en: String(x?.en ?? ''), ta: String(x?.ta ?? '') });

const SIMPLE = [
  ['meta_title', 'Browser title', 1], ['meta_description', 'Search description', 2],
  ['eyebrow', 'Small label above the title', 1], ['title', 'Page title', 1], ['tagline', 'Tagline', 1],
  ['intro', 'Introduction', 3], ['est', 'Label under the round photo', 1], ['heroAlt', 'Round photo description', 1],
  ['trustLabel', 'Trust name', 1],
  ['aboutTitle', 'About heading', 1], ['aboutText1', 'About paragraph 1', 4], ['aboutText2', 'About paragraph 2', 4], ['riverAlt', 'River photo description', 1],
  ['settingTitle', 'Setting heading', 1], ['settingText', 'Setting text', 4],
  ['facilitiesTitle', 'Facilities heading', 1], ['facilitiesText', 'Facilities text', 2],
  ['teachersTitle', 'Teachers heading', 1], ['teachersText', 'Teachers text', 2], ['focusLabel', 'Word "Focus" on teacher cards', 1],
  ['quoteText', 'Quote', 3], ['quoteSource', 'Quote source', 1],
  ['visitTitle', 'Visit heading', 1], ['address', 'Address', 3], ['visitCta', 'Visit button', 1],
  ['moreTitle', 'Continue exploring heading', 1],
] as const;
type SimpleKey = (typeof SIMPLE)[number][0];

type Teacher = { photo: string; role: Bi; name: Bi; bio: Bi; focus: Bi[] };
type Facility = { name: Bi; image: string };
type Doc = Record<SimpleKey, Bi> & {
  heroImage: string;
  riverImage: string;
  stats: { label: Bi; value: Bi }[];
  settingTags: Bi[];
  facilities: Facility[];
  teachers: Teacher[];
};
type ListKey = 'stats' | 'settingTags' | 'facilities' | 'teachers';

const emptyDoc = (): Doc => {
  const d: any = { heroImage: '', riverImage: '', stats: [], settingTags: [], facilities: [], teachers: [] };
  SIMPLE.forEach(([k]) => { d[k] = bi(); });
  return d as Doc;
};
const norm = (raw: any): Doc => {
  const d = emptyDoc();
  SIMPLE.forEach(([k]) => { d[k] = b(raw?.[k]); });
  d.heroImage = String(raw?.heroImage ?? '');
  d.riverImage = String(raw?.riverImage ?? '');
  d.stats = (raw?.stats || []).map((x: any) => ({ label: b(x.label), value: b(x.value) }));
  d.settingTags = (raw?.settingTags || []).map(b);
  d.facilities = (raw?.facilities || []).map((x: any) => ({ name: b(x.name), image: String(x?.image ?? '') }));
  d.teachers = (raw?.teachers || []).map((x: any) => ({ photo: String(x?.photo ?? ''), role: b(x.role), name: b(x.name), bio: b(x.bio), focus: (x?.focus || []).map(b) }));
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

export default function AboutAshramam() {
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
  const patch = (key: ListKey, i: number, p: any) => setDoc((d) => ({ ...d, [key]: (d[key] as any[]).map((x, k) => (k === i ? (key === 'settingTags' ? p : { ...x, ...p }) : x)) }));
  const add = (key: ListKey, item: any) => setDoc((d) => ({ ...d, [key]: [...(d[key] as any[]), item] }));
  const remove = (key: ListKey, i: number) => setDoc((d) => ({ ...d, [key]: (d[key] as any[]).filter((_, k) => k !== i) }));
  const move = (key: ListKey, i: number, dir: -1 | 1) => setDoc((d) => {
    const list = [...(d[key] as any[])];
    const j = i + dir;
    if (j < 0 || j >= list.length) return d;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...d, [key]: list };
  });

  // Focus tags inside one teacher
  const setFocus = (ti: number, fi: number, v: Bi) => patch('teachers', ti, { focus: doc.teachers[ti].focus.map((x, k) => (k === fi ? v : x)) });
  const addFocus = (ti: number) => patch('teachers', ti, { focus: [...doc.teachers[ti].focus, bi()] });
  const removeFocus = (ti: number, fi: number) => patch('teachers', ti, { focus: doc.teachers[ti].focus.filter((_, k) => k !== fi) });

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
          <h1 className="title">Ashramam</h1>
          <p className="mut" style={{ marginTop: 2 }}>Everything on the About / Ashramam page, including the teachers. A text left empty keeps the current website text. Photos upload at once and appear on the website after you press Save changes.</p>
        </div>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
      </div>
      <Notice notice={notice} onClear={clear} />

      {sec('Page title and search', <>{simple('meta_title')}{simple('meta_description')}</>)}

      {sec('Top of the page', (
        <>
          <PhotoField label="Round photo (wide view of the ashram)" value={doc.heroImage} onChange={(u) => setDoc((d) => ({ ...d, heroImage: u }))} flash={flash} w={1800} round hint="About 1800 x 800 works well." />
          {simple('eyebrow')}{simple('title')}{simple('tagline')}{simple('intro')}{simple('est')}{simple('heroAlt')}{simple('trustLabel')}
        </>
      ))}

      {sec('Three facts (shown under the top banner)', (
        <>
          {doc.stats.map((f, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
              <BiField label="Label" value={f.label} onChange={(v) => patch('stats', i, { label: v })} />
              <BiField label="Value" value={f.value} onChange={(v) => patch('stats', i, { value: v })} />
              {bar('stats', i, doc.stats.length, 'Remove')}
            </div>
          ))}
          <button type="button" className="btn" onClick={() => add('stats', { label: bi(), value: bi() })}>+ Add a fact</button>
        </>
      ))}

      {sec('About the ashram', (
        <>
          <PhotoField label="River photo (shown in an arch)" value={doc.riverImage} onChange={(u) => setDoc((d) => ({ ...d, riverImage: u }))} flash={flash} w={1200} hint="A portrait photo, about 800 x 1000." />
          {simple('aboutTitle')}{simple('aboutText1')}{simple('aboutText2')}{simple('riverAlt')}
        </>
      ))}

      {sec('Setting (maroon band)', (
        <>
          {simple('settingTitle')}{simple('settingText')}
          {doc.settingTags.map((f, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <BiField label={`Tag ${i + 1}`} value={f} onChange={(v) => patch('settingTags', i, v)} />
              {bar('settingTags', i, doc.settingTags.length, 'Remove')}
            </div>
          ))}
          <button type="button" className="btn" onClick={() => add('settingTags', bi())}>+ Add a tag</button>
        </>
      ))}

      {sec('Facilities (each has its own section and photo)', (
        <>
          {simple('facilitiesTitle')}{simple('facilitiesText')}
          {doc.facilities.map((f, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ fontWeight: 800, marginBottom: 8 }}>Facility {i + 1}</p>
              <BiField label="Name" value={f.name} onChange={(v) => patch('facilities', i, { name: v })} />
              <PhotoField label="Photo" value={f.image} onChange={(u) => patch('facilities', i, { image: u })} flash={flash} w={1400} hint="About 1200 x 900." />
              {bar('facilities', i, doc.facilities.length, 'Remove facility')}
            </div>
          ))}
          <button type="button" className="btn" onClick={() => add('facilities', { name: bi(), image: '' })}>+ Add a facility</button>
        </>
      ))}

      {sec('Teachers', (
        <>
          {simple('teachersTitle')}{simple('teachersText')}{simple('focusLabel')}
          {doc.teachers.length === 0 && <p className="mut" style={{ marginBottom: 12 }}>No teachers yet. Add the first teacher below.</p>}
          {doc.teachers.map((t, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 14, borderLeft: '4px solid #D97706' }}>
              <p style={{ fontWeight: 800, marginBottom: 8 }}>Teacher {i + 1}{t.name.en ? `: ${t.name.en}` : ''}</p>
              <PhotoField label="Photo (round)" value={t.photo} onChange={(u) => patch('teachers', i, { photo: u })} flash={flash} w={800} round hint="A square photo, face centred." />
              <BiField label="Role (badge)" value={t.role} onChange={(v) => patch('teachers', i, { role: v })} />
              <BiField label="Name" value={t.name} onChange={(v) => patch('teachers', i, { name: v })} />
              <BiField label="About" rows={5} value={t.bio} onChange={(v) => patch('teachers', i, { bio: v })} />
              <p className="lbl" style={{ marginTop: 6 }}>Focus tags</p>
              {t.focus.map((fo, fi) => (
                <div key={fi} style={{ marginBottom: 6 }}>
                  <BiField label={`Tag ${fi + 1}`} value={fo} onChange={(v) => setFocus(i, fi, v)} />
                  <button type="button" className="btn sm dng" onClick={() => removeFocus(i, fi)}>Remove tag</button>
                </div>
              ))}
              <button type="button" className="btn sm" onClick={() => addFocus(i)}>+ Add a focus tag</button>
              <div style={{ marginTop: 10 }}>{bar('teachers', i, doc.teachers.length, 'Remove teacher')}</div>
            </div>
          ))}
          <button type="button" className="btn primary" onClick={() => add('teachers', { photo: '', role: bi(), name: bi(), bio: bi(), focus: [] })}>+ Add a teacher</button>
        </>
      ))}

      {sec('Quote', <>{simple('quoteText')}{simple('quoteSource')}</>)}
      {sec('Visit and links', <>{simple('visitTitle')}{simple('address')}{simple('visitCta')}{simple('moreTitle')}</>)}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 30 }}>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
      </div>
    </div>
  );
}