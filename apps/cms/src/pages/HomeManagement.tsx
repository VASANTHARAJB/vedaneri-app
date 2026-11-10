import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as Kit from './DiscoverKit';
import { API, CSS, Notice, authHeader, failText, fileUrl, readJson, useFlash } from './DiscoverKit';

// API points at .../api/v1/discover. The Home API is .../api/v1/home
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const HOME = `${API_BASE}/home`;
const PAGE = `${HOME}/admin/page`;

// ---------- The content, and how a field is found inside it ----------
// { en: {hero, founder, ...}, ta: {...}, images: {...}, links: {...}, times: {...}, audio: '/uploads/home/...' }
type Path = (string | number)[];
type Doc = { en: any; ta: any; images: Record<string, string>; links: Record<string, string>; times: Record<string, string>; audio: string };
type Flash = (k: 'ok' | 'err', m: string) => void;

const getIn = (o: any, p: Path): any => p.reduce((a, k) => (a == null ? undefined : a[k]), o);
const setIn = (o: any, p: Path, v: any): any => {
  if (p.length === 0) return v;
  const [k, ...rest] = p;
  const base = Array.isArray(o) ? [...o] : typeof k === 'number' ? [] : { ...(o || {}) };
  (base as any)[k] = setIn(o == null ? undefined : o[k], rest, v);
  return base;
};
const str = (v: any) => (typeof v === 'string' ? v : '');
const obj = (v: any) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

const norm = (raw: any): Doc => ({
  en: obj(raw?.en), ta: obj(raw?.ta), images: obj(raw?.images), links: obj(raw?.links), times: obj(raw?.times), audio: str(raw?.audio),
});

const Ed = createContext<{ doc: Doc; edit: (fn: (d: Doc) => Doc) => void; flash: Flash }>(null as any);
const useEd = () => useContext(Ed);

// Uses the Tamil converter of DiscoverKit when it exists
const transliterate = async (text: string): Promise<string | null> => {
  const fn = (Kit as any).transliterate;
  return typeof fn === 'function' ? fn(text) : null;
};

// Pages the links can point to. Anything else can be typed: /some-page for this website, or https://... for another website.
const PAGE_OPTIONS = [
  { value: '/', label: 'Home' },
  { value: '/sevas', label: 'Sevas' },
  { value: '/donate', label: 'Donate' },
  { value: '/camps', label: 'Camps' },
  { value: '/magazine', label: 'Magazine' },
  { value: '/audio', label: 'Audio' },
  { value: '/video', label: 'Video' },
  { value: '/contact', label: 'Contact' },
  { value: '/accommodation', label: 'Accommodation' },
  { value: '/about', label: 'About' },
  { value: '/about/omkarananda', label: 'About: Pujyasri Omkarananda' },
  { value: '/about/ashramam', label: 'About: Ashramam' },
  { value: '/about/adhishtanam', label: 'About: Adhishtanam' },
  { value: '/about/vidyapitham', label: 'About: Vidyapitham' },
  { value: '/events', label: 'Events' },
];

// ---------- Small building blocks ----------
// A text in English and Tamil, side by side
function Bi({ path, label, rows = 1, hint }: { path: Path; label: string; rows?: number; hint?: string }) {
  const { doc, edit } = useEd();
  const [busy, setBusy] = useState(false);
  const en = str(getIn(doc.en, path));
  const ta = str(getIn(doc.ta, path));
  const Tag: any = rows > 1 ? 'textarea' : 'input';
  const extra = rows > 1 ? { rows } : {};
  const put = (loc: 'en' | 'ta', v: string) => edit((d) => ({ ...d, [loc]: setIn(d[loc], path, v) }));
  async function fill() {
    if (!en.trim()) return;
    setBusy(true);
    const out = await transliterate(en);
    setBusy(false);
    if (out !== null) put('ta', out);
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="g2">
        <div>
          <label className="lbl">{label} (English)</label>
          <Tag {...extra} className="inp" value={en} onChange={(e: any) => put('en', e.target.value)} />
        </div>
        <div>
          <div className="lblrow">
            <label className="lbl">{label} (தமிழ்)</label>
            <button type="button" className="btn link" disabled={busy || !en.trim()} onClick={fill}>{busy ? 'Converting...' : 'Auto-fill'}</button>
          </div>
          <Tag {...extra} className="inp" value={ta} onChange={(e: any) => put('ta', e.target.value)} />
        </div>
      </div>
      {hint && <p className="hint mut">{hint}</p>}
    </div>
  );
}

// A value that is the same in both languages (a date, a link). It is saved in both.
function Shared({ path, label, type = 'text', hint, placeholder, children }: { path: Path; label: string; type?: string; hint?: string; placeholder?: string; children?: React.ReactNode }) {
  const { doc, edit } = useEd();
  const value = str(getIn(doc.en, path));
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="lbl">{label}</label>
      {children ?? <input className="inp" type={type} style={type === 'text' ? undefined : { maxWidth: 220 }} value={value} placeholder={placeholder}
        onChange={(e) => edit((d) => ({ ...d, en: setIn(d.en, path, e.target.value), ta: setIn(d.ta, path, e.target.value) }))} />}
      {hint && <p className="hint mut">{hint}</p>}
    </div>
  );
}

// A value of the images, links or times group
function Grp({ group, k, label, type = 'text', hint }: { group: 'times'; k: string; label: string; type?: string; hint?: string }) {
  const { doc, edit } = useEd();
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="lbl">{label}</label>
      <input className="inp" type={type} style={{ maxWidth: 220 }} value={str(doc[group][k])} onChange={(e) => edit((d) => ({ ...d, [group]: { ...d[group], [k]: e.target.value } }))} />
      {hint && <p className="hint mut">{hint}</p>}
    </div>
  );
}

// Where a link goes: pick a page from the list, or type a page path or a full web address
function LinkBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
function LinkGrp({ k, label, hint }: { k: string; label: string; hint?: string }) {
  const { doc, edit } = useEd();
  return (
    <>
      <LinkBox label={label} value={str(doc.links[k])} onChange={(v) => edit((d) => ({ ...d, links: { ...d.links, [k]: v } }))} />
      {hint && <p className="hint mut" style={{ marginTop: -6, marginBottom: 12 }}>{hint}</p>}
    </>
  );
}
function LinkShared({ path, label }: { path: Path; label: string }) {
  const { doc, edit } = useEd();
  return <LinkBox label={label} value={str(getIn(doc.en, path))} onChange={(v) => edit((d) => ({ ...d, en: setIn(d.en, path, v), ta: setIn(d.ta, path, v) }))} />;
}

// A photo box: preview, upload, remove. The photo uploads at once; it shows on the website after Save changes.
function PhotoBox({ label, value, onChange, hint, w = 1400, resetText }: { label: string; value: string; onChange: (url: string) => void; hint?: string; w?: number; resetText?: string }) {
  const { flash } = useEd();
  const [busy, setBusy] = useState(false);
  async function pick(f?: File) {
    if (!f) return;
    setBusy(true);
    try {
      const body = new FormData(); body.append('image', f);
      const res = await fetch(`${HOME}/admin/upload?w=${w}`, { method: 'POST', headers: authHeader(), body });
      const d = await readJson(res);
      if (!res.ok) { flash('err', failText(d, 'Could not upload the photo.')); return; }
      onChange(d.url);
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy(false); }
  }
  const mine = value.startsWith('/uploads/');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
      <div className="thumb" style={{ width: 120, height: 90, borderRadius: 10, fontSize: 11, textAlign: 'center', padding: 4 }}>
        {mine ? <img src={fileUrl(value)} alt="" /> : value ? 'Website photo' : 'Default'}
      </div>
      <div>
        <p className="lbl" style={{ marginBottom: 6 }}>{label}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="btn sm" style={{ cursor: 'pointer' }}>{busy ? 'Uploading...' : value ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {value && <button type="button" className="btn sm" disabled={busy} onClick={() => onChange('')}>{resetText || "Use the website's own photo"}</button>}
        </div>
        {value && !mine && <p className="hint mut">{value}</p>}
        {hint && <p className="hint mut">{hint}</p>}
      </div>
    </div>
  );
}
function PhotoGrp({ k, label, hint, w }: { k: string; label: string; hint?: string; w?: number }) {
  const { doc, edit } = useEd();
  return <PhotoBox label={label} hint={hint} w={w} value={str(doc.images[k])} onChange={(u) => edit((d) => ({ ...d, images: { ...d.images, [k]: u } }))} />;
}
function PhotoShared({ path, label, hint }: { path: Path; label: string; hint?: string }) {
  const { doc, edit } = useEd();
  return <PhotoBox label={label} hint={hint} resetText="Remove photo" value={str(getIn(doc.en, path))} onChange={(u) => edit((d) => ({ ...d, en: setIn(d.en, path, u), ta: setIn(d.ta, path, u) }))} />;
}

// A list kept in step in both languages: adding, removing and moving act on both
function ListEd({ path, title, item, template, render, min = 0, max = 60, fixed = false }: {
  path: Path; title: string; item: string; template: any; render: (i: number) => React.ReactNode; min?: number; max?: number; fixed?: boolean;
}) {
  const { doc, edit } = useEd();
  const list: any[] = getIn(doc.en, path) || [];
  const both = (fn: (l: any[]) => any[]) => edit((d) => ({ ...d, en: setIn(d.en, path, fn([...(getIn(d.en, path) || [])])), ta: setIn(d.ta, path, fn([...(getIn(d.ta, path) || [])])) }));
  const clone = () => JSON.parse(JSON.stringify(template));
  const move = (i: number, dir: -1 | 1) => both((l) => { const j = i + dir; if (j >= 0 && j < l.length && i < l.length) [l[i], l[j]] = [l[j], l[i]]; return l; });
  return (
    <div style={{ marginTop: 6 }}>
      <p className="lbl">{title}</p>
      {list.length === 0 && <p className="hint mut" style={{ marginBottom: 8 }}>Nothing here yet. The website shows its own {item.toLowerCase()} list until you add some.</p>}
      {list.map((_, i) => (
        <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
          <p style={{ fontWeight: 800, marginBottom: 8 }}>{item} {i + 1}</p>
          {render(i)}
          {!fixed && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <button type="button" className="btn sm" disabled={i === 0} onClick={() => move(i, -1)}>Move up</button>
              <button type="button" className="btn sm" disabled={i === list.length - 1} onClick={() => move(i, 1)}>Move down</button>
              <button type="button" className="btn sm dng" disabled={list.length <= min} onClick={() => both((l) => l.filter((_x, k) => k !== i))}>Remove</button>
            </div>
          )}
        </div>
      ))}
      {!fixed && list.length < max && <button type="button" className="btn" onClick={() => both((l) => [...l, clone()])}>+ Add {item.toLowerCase()}</button>}
    </div>
  );
}

const Sec = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="card" style={{ padding: 18, marginBottom: 16 }}>
    <h3 className="sech">{title}</h3>
    {note && <div className="alert info" style={{ marginBottom: 12 }}>{note}</div>}
    {children}
  </section>
);

// ---------- The sections ----------
function Hero() {
  return (
    <>
      <Sec title="Words">
        <Bi path={['hero', 'pill']} label="Small line above the title" />
        <ListEd path={['hero', 'title']} title="Title (one line each, shown in capitals)" item="Line" template="" max={5} min={1}
          render={(i) => <Bi path={['hero', 'title', i]} label="Text" />} />
        <div style={{ height: 12 }} />
        <Bi path={['hero', 'text']} label="Paragraph" rows={4} />
        <Bi path={['hero', 'primary']} label="First button text" />
        <Bi path={['hero', 'secondary']} label="Second button text" />
        <Bi path={['hero', 'photoAlt']} label="Portrait description (for screen readers)" />
      </Sec>
      <Sec title="Buttons and photos" note="A button left on its first choice keeps going to Sevas (first) and Audio (second).">
        <LinkGrp k="heroPrimary" label="First button opens" />
        <LinkGrp k="heroSecondary" label="Second button opens" />
        <PhotoGrp k="heroBg" label="Background photo" hint="A wide landscape photo, about 1920 x 1080." w={2000} />
        <PhotoGrp k="heroPhoto" label="Portrait photo (in the arch)" hint="A portrait photo, about 800 x 1100." />
      </Sec>
    </>
  );
}

function Founder() {
  return (
    <>
      <Sec title="Words">
        <Bi path={['founder', 'eyebrow']} label="Small label" />
        <Bi path={['founder', 'name']} label="Name" />
        <Bi path={['founder', 'role']} label="Role" />
        <Bi path={['founder', 'bio']} label="Short biography" rows={5} />
        <ListEd path={['founder', 'facts']} title="Short facts (small rounded labels)" item="Fact" template="" max={8}
          render={(i) => <Bi path={['founder', 'facts', i]} label="Text" />} />
        <div style={{ height: 12 }} />
        <Bi path={['founder', 'cta']} label="Button text" />
        <Bi path={['founder', 'quote']} label="Quote in the maroon band" rows={3} />
        <Bi path={['founder', 'photoAlt']} label="Portrait description (for screen readers)" />
      </Sec>
      <Sec title="Button and photo" note="The light that shines on the raised palms is placed for the original portrait. It is not shown on a portrait uploaded here.">
        <LinkGrp k="founderCta" label="Button opens" hint="Left empty, it goes to /about. Make sure that page exists on your website." />
        <PhotoGrp k="founderPhoto" label="Portrait photo" hint="A portrait photo, about 800 x 1000." />
      </Sec>
    </>
  );
}

function Guides() {
  return (
    <>
      <Sec title="Headings">
        <Bi path={['guides', 'guidesTitle']} label="Heading above the guide cards" />
        <Bi path={['guides', 'subtitle']} label="Line under the heading" rows={2} />
        <Bi path={['guides', 'chiefTitle']} label="Heading above the Chief Acharya" />
        <Bi path={['guides', 'specLabel']} label="Label above the focus tags" />
        <Bi path={['guides', 'readMore']} label="'Read full bio' button" />
        <Bi path={['guides', 'close']} label="'Close' button" />
      </Sec>
      <Sec title="Guide cards" note="The cards are shown in this order, with the Dayananda card in second place.">
        <ListEd path={['guides', 'teachers']} title="Guides" item="Guide" template={{ name: '', role: '', image: '', spec: '', text: '' }} max={9}
          render={(i) => (
            <>
              <PhotoShared path={['guides', 'teachers', i, 'image']} label="Photo" hint="A portrait photo, about 800 x 1000." />
              <Bi path={['guides', 'teachers', i, 'name']} label="Name" />
              <Bi path={['guides', 'teachers', i, 'role']} label="Role (optional)" />
              <Bi path={['guides', 'teachers', i, 'text']} label="Text" rows={4} />
              <Bi path={['guides', 'teachers', i, 'spec']} label="Focus tags" hint="Separate the tags with &, for example: Gita & Upanishads" />
            </>
          )} />
      </Sec>
      <Sec title="Dayananda card">
        <PhotoGrp k="guideDayananda" label="Photo" hint="A portrait photo, about 800 x 1000." />
        <Bi path={['guides', 'dayananda', 'name']} label="Name" />
        <Bi path={['guides', 'dayananda', 'role']} label="Role (optional)" />
        <Bi path={['guides', 'dayananda', 'text']} label="Text" rows={5} />
        <Bi path={['guides', 'dayananda', 'spec']} label="Focus tags" hint="Separate the tags with &" />
      </Sec>
      <Sec title="Chief Acharya">
        <PhotoGrp k="guideLead" label="Photo" hint="A portrait photo, about 900 x 1200." />
        <Bi path={['guides', 'lead', 'name']} label="Name" />
        <Bi path={['guides', 'lead', 'role']} label="Role" />
        <Bi path={['guides', 'lead', 'subTitle']} label="Line under the name" />
        <Bi path={['guides', 'lead', 'spec']} label="Focus tags" hint="Separate the tags with &" />
        <Bi path={['guides', 'lead', 'shortBio']} label="Short biography (on the card)" rows={5} />
        <ListEd path={['guides', 'lead', 'paragraphs']} title="Full biography (opens when 'Read full bio' is pressed)" item="Paragraph" template="" max={20}
          render={(i) => <Bi path={['guides', 'lead', 'paragraphs', i]} label="Paragraph" rows={5} />} />
      </Sec>
    </>
  );
}

function Festival() {
  return (
    <>
      <Sec title="Dates and times" note="The countdown and the day circles follow these. The dates must make a range of 1 to 31 days, or the website keeps its own dates.">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Shared path={['festival', 'start']} label="First day" type="date" />
          <Shared path={['festival', 'end']} label="Last day" type="date" />
          <Grp group="times" k="festivalStart" label="Evening puja starts (first day)" type="time" />
          <Grp group="times" k="festivalEnd" label="Evening puja ends (last day)" type="time" />
        </div>
      </Sec>
      <Sec title="Words">
        <Bi path={['festival', 'title']} label="Festival name" />
        <Bi path={['festival', 'text']} label="Paragraph" rows={4} />
        <Bi path={['festival', 'dailyLabel']} label="Label before the daily time" />
        <Bi path={['festival', 'dailyTime']} label="Daily time (as text)" hint="This is only words. The countdown uses the times above." />
        <Bi path={['festival', 'register']} label="Button text" />
        <Bi path={['festival', 'photoAlt']} label="Poster description (for screen readers)" />
      </Sec>
      <Sec title="Countdown words">
        <Bi path={['festival', 'countdownLabel']} label="Countdown heading" />
        <Bi path={['festival', 'days']} label="Days" />
        <Bi path={['festival', 'hours']} label="Hours" />
        <Bi path={['festival', 'mins']} label="Minutes" />
        <Bi path={['festival', 'inProgress']} label="While the festival is on" />
        <Bi path={['festival', 'dayOf']} label="Day number" hint="Keep {n} and {total}, for example: Day {n} of {total}" />
        <Bi path={['festival', 'ended']} label="After the festival" rows={2} />
      </Sec>
      <Sec title="Button and poster">
        <LinkGrp k="festivalRegister" label="Button opens" />
        <PhotoGrp k="festivalPoster" label="Poster" hint="The festival notice. It is shown whole, never cropped." w={1600} />
      </Sec>
    </>
  );
}

function Calendar() {
  return (
    <>
      <Sec title="Headings">
        <Bi path={['calendar', 'title']} label="Heading" />
        <Bi path={['calendar', 'subtitle']} label="Line under the heading" rows={2} />
        <Bi path={['calendar', 'details']} label="'Details' text on each event" />
        <Bi path={['calendar', 'viewAll']} label="'View complete calendar' text" />
        <LinkGrp k="calendarAll" label="'View complete calendar' opens, and an event with no link of its own" hint="Left empty, it goes to /events. Make sure that page exists on your website." />
      </Sec>
      <Sec title="Events" note="Only the next four upcoming events are shown, nearest first. A past event hides itself, so you can leave it in the list.">
        <ListEd path={['calendar', 'items']} title="Events" item="Event" template={{ date: '', name: '', href: '' }} max={60}
          render={(i) => (
            <>
              <Shared path={['calendar', 'items', i, 'date']} label="Date" type="date" />
              <Bi path={['calendar', 'items', i, 'name']} label="Name" />
              <LinkShared path={['calendar', 'items', i, 'href']} label="Opens (optional)" />
            </>
          )} />
      </Sec>
    </>
  );
}

function Support() {
  return (
    <>
      <Sec title="Headings">
        <Bi path={['support', 'title']} label="Heading" />
        <Bi path={['support', 'subtitle']} label="Line under the heading" rows={2} />
        <Bi path={['support', 'sponsor']} label="'Sponsor' button text" />
        <LinkGrp k="sponsor" label="'Sponsor' opens, for a card with no link of its own" hint="Left empty, it goes to /donate." />
      </Sec>
      <Sec title="Cards">
        <ListEd path={['support', 'items']} title="Cards" item="Card" template={{ key: 'general', title: '', text: '', href: '' }} max={12}
          render={(i) => (
            <>
              <Shared path={['support', 'items', i, 'key']} label="Icon">
                <SelectShared path={['support', 'items', i, 'key']} options={[['annadhanam', 'Food bowl'], ['go', 'Heart (cow protection)'], ['veda', 'Open book (Veda)'], ['general', 'Lamp']]} />
              </Shared>
              <Bi path={['support', 'items', i, 'title']} label="Title" />
              <Bi path={['support', 'items', i, 'text']} label="Text" rows={2} />
              <LinkShared path={['support', 'items', i, 'href']} label="'Sponsor' opens (optional)" />
            </>
          )} />
      </Sec>
    </>
  );
}
function SelectShared({ path, options }: { path: Path; options: [string, string][] }) {
  const { doc, edit } = useEd();
  const value = str(getIn(doc.en, path)) || 'general';
  return (
    <select className="inp" style={{ maxWidth: 260 }} value={options.some((o) => o[0] === value) ? value : 'general'}
      onChange={(e) => edit((d) => ({ ...d, en: setIn(d.en, path, e.target.value), ta: setIn(d.ta, path, e.target.value) }))}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function Quick() {
  return (
    <>
      <Sec title="Headings">
        <Bi path={['eyebrow']} label="Small label" />
        <Bi path={['heading']} label="Heading" />
        <Bi path={['quick', 'cta']} label="'Read more' text on each card" />
      </Sec>
      <Sec title="The four cards" note="The layout has exactly four cards, so they can be edited here but not added or removed.">
        <ListEd path={['quick', 'items']} title="Cards" item="Card" template={{ title: '', text: '', href: '' }} fixed
          render={(i) => (
            <>
              <PhotoGrp k={`quick${i + 1}`} label="Photo" hint="A landscape photo, about 1200 x 800." />
              <Bi path={['quick', 'items', i, 'title']} label="Title" />
              <Bi path={['quick', 'items', i, 'text']} label="Text" rows={3} />
              <LinkShared path={['quick', 'items', i, 'href']} label="Opens" />
            </>
          )} />
      </Sec>
    </>
  );
}

function Quotes() {
  return (
    <Sec title="Quotes">
      <Bi path={['quotes', 'title']} label="Heading" />
      <Bi path={['quotes', 'prev']} label="'Previous' button (screen readers)" />
      <Bi path={['quotes', 'next']} label="'Next' button (screen readers)" />
      <Bi path={['quotes', 'attribution']} label="Name under each quote (optional)" hint="Left empty, no name is shown." />
      <ListEd path={['quotes', 'items']} title="Quotes" item="Quote" template={{ text: '' }} max={30} min={1}
        render={(i) => <Bi path={['quotes', 'items', i, 'text']} label="Quote" rows={4} />} />
    </Sec>
  );
}

function Audio() {
  const { doc, edit, flash } = useEd();
  const [busy, setBusy] = useState(false);
  async function pick(f?: File) {
    if (!f) return;
    if (f.size > 100 * 1024 * 1024) { flash('err', 'The audio is too large (up to 100MB).'); return; }
    setBusy(true);
    try {
      const body = new FormData(); body.append('audio', f);
      const res = await fetch(`${HOME}/admin/upload-audio`, { method: 'POST', headers: authHeader(), body });
      const d = await readJson(res);
      if (!res.ok) { flash('err', failText(d, 'Could not upload the audio.')); return; }
      edit((x) => ({ ...x, audio: d.url }));
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy(false); }
  }
  const mine = doc.audio.startsWith('/uploads/');
  return (
    <>
      <Sec title="Audio file" note="Left empty, the website plays the file set in apps/web/src/lib/site.ts. The file uploads at once and goes live after Save changes.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <label className="btn sm" style={{ cursor: 'pointer' }}>{busy ? 'Uploading... (a large file can take a minute)' : doc.audio ? 'Change audio' : 'Upload audio'}
            <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav" className="sr-only" disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {doc.audio && <button type="button" className="btn sm" disabled={busy} onClick={() => edit((x) => ({ ...x, audio: '' }))}>Use the website's own file</button>}
        </div>
        {mine && <audio controls preload="none" src={fileUrl(doc.audio)} style={{ width: '100%', maxWidth: 480, marginBottom: 10 }} />}
        <label className="lbl">Or a path or address</label>
        <input className="inp" value={doc.audio} placeholder="/audio/upanishad-sara-4.mp3  or  https://example.org/lecture.mp3" onChange={(e) => edit((x) => ({ ...x, audio: e.target.value.trim() }))} />
        <p className="hint mut">An MP3, M4A, OGG or WAV file. A path starts with /audio/ (the public/audio folder of the website). Anything else is ignored by the website.</p>
      </Sec>
      <Sec title="Words">
        <Bi path={['audioBar', 'label']} label="Name of the bar (screen readers)" />
        <Bi path={['audioBar', 'title']} label="Title of the discourse" />
        <Bi path={['audioBar', 'tag']} label="Small tag" />
        <Bi path={['audioBar', 'by']} label="'By' line" />
        <Bi path={['audioBar', 'soon']} label="Text when there is no audio" />
      </Sec>
    </>
  );
}

const TABS: [string, string, () => React.ReactElement][] = [
  ['hero', 'Hero banner', Hero], ['founder', 'Founder', Founder], ['guides', 'Guides', Guides], ['festival', 'Festival', Festival],
  ['calendar', 'Calendar', Calendar], ['support', 'Support', Support], ['quick', 'Quick access', Quick], ['quotes', 'Quotes', Quotes], ['audio', 'Audio bar', Audio],
];

// ---------- The screen ----------
export default function HomeManagement() {
  const { notice, flash, clear } = useFlash();
  const [doc, setDoc] = useState<Doc>(norm({}));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('hero');
  const dirtyRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(PAGE, { headers: authHeader(), cache: 'no-store' });
      const d = await readJson(res);
      if (!res.ok) throw new Error(failText(d, `Could not load the page (${res.status}).`));
      setDoc(norm(d.content)); setDirty(false); dirtyRef.current = false;
    } catch (e: any) { setErr(`${e?.message || 'Could not load the page.'} [${PAGE}]`); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Warn before leaving with changes that are not saved
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const edit = useCallback((fn: (d: Doc) => Doc) => { setDoc(fn); setDirty(true); dirtyRef.current = true; }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(PAGE, { method: 'PUT', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ content: doc }) });
      const d = await readJson(res);
      if (!res.ok) { flash('err', failText(d, 'Could not save.')); return; }
      setDirty(false); dirtyRef.current = false;
      flash('ok', 'Saved. The website shows the new content now.');
    } catch { flash('err', 'Network error. Please try again.'); } finally { setSaving(false); }
  }

  const Current = TABS.find((t) => t[0] === tab)?.[2] ?? Hero;
  const empty = !loading && !err && Object.keys(doc.en).length === 0;

  return (
    <Ed.Provider value={{ doc, edit, flash }}>
      <div className="dc">
        <style>{CSS}</style>
        <div className="head">
          <div>
            <h1 className="title">Home Page</h1>
            <p className="mut" style={{ marginTop: 2 }}>Everything on the home page, in English and Tamil. A text left empty keeps the current website text. Photos and audio upload at once and go live after you press Save changes.</p>
          </div>
          <button type="button" className="btn primary" onClick={save} disabled={saving || loading || !dirty}>{saving ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}</button>
        </div>
        <Notice notice={notice} onClear={clear} />

        {loading ? <><div className="skel" /><div className="skel" /></> : err ? (
          <div role="alert" className="alert bad">{err} <button type="button" className="btn link" onClick={load}>Try again</button></div>
        ) : (
          <>
            {empty && <div className="alert info" style={{ marginBottom: 14 }}>The Home Page has no saved content yet, so the fields are empty and the website shows its built-in text. Run <strong>home-content.sql</strong> once to fill the editor with the current text.</div>}
            <div role="tablist" aria-label="Home page sections" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {TABS.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={`btn${tab === id ? ' primary' : ''}`} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
            <Current />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 30 }}>
              <button type="button" className="btn primary" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}</button>
            </div>
          </>
        )}
      </div>
    </Ed.Provider>
  );
}