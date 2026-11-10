import React, { useCallback, useEffect, useState } from 'react';
import * as Kit from './DiscoverKit';
import { API, CSS, Notice, authHeader, failText, readJson, useFlash } from './DiscoverKit';

// API points at .../api/v1/discover. The pages API is .../api/v1/pages, the contact API is .../api/v1/contact
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const CONTACT = `${API_BASE}/contact`;
const PAGES = `${CONTACT}/admin/page`;

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
const PAGE_FIELDS: Record<string, Spec[]> = {
  search: [['meta', 'Browser title', 1], ['metaText', 'Search description', 2]],
  top: [['title', 'Page title', 1], ['lead', 'Introduction', 2]],
  cards: [
    ['phone', 'Phone card title', 1], ['email', 'Email card title', 1], ['whatsapp', 'WhatsApp card title', 1], ['chat', 'WhatsApp link text', 1],
    ['address', 'Address card title', 1], ['addressText', 'Address text (left empty, the footer address is used)', 3],
  ],
  visit: [['visitTitle', 'Heading', 1], ['visitText', 'Text', 2], ['directions', 'Directions button', 1], ['mapTitle', 'Map description (for screen readers)', 1]],
  form: [
    ['f_title', 'Form heading', 1], ['f_intro', 'Form introduction', 2], ['f_name', 'Name label', 1], ['f_phone', 'Mobile label', 1], ['f_country', 'Country code label', 1], ['f_email', 'Email label', 1],
    ['f_optional', 'Note above phone and email', 1], ['f_topic', 'Topic label', 1], ['f_message', 'Message label', 1], ['f_messageHint', 'Message hint', 1],
    ['f_consent', 'Consent checkbox text', 2], ['f_send', 'Send button', 1], ['f_sending', 'Send button while sending', 1], ['f_privacy', 'Privacy note', 2],
  ],
  errors: [
    ['f_errName', 'Name missing', 1], ['f_errContact', 'Phone or email wrong', 1], ['f_errTopic', 'Topic missing', 1], ['f_errMessage', 'Message too short', 1],
    ['f_errConsent', 'Checkbox not ticked', 1], ['f_errBot', 'Security check not done', 1], ['f_errWait', 'Sent too fast', 1], ['f_errMany', 'Too many messages', 1], ['f_errServer', 'Could not send', 2],
  ],
  thanks: [
    ['f_thanksTitle', 'Thank you heading', 1], ['f_thanksText', 'Thank you text', 2], ['f_thanksCopy', 'Copy sent (use {email} for the address)', 2],
    ['f_thanksNoCopy', 'Copy could not be sent', 2], ['f_another', 'Send another button', 1],
  ],
  help: [['helpTitle', 'Heading', 1]],
};
const ALL_BI: Spec[] = Object.values(PAGE_FIELDS).flat();

// Pages the links can point to. Anything else can be typed: /some-page for this website, or https://... for another website.
const PAGE_OPTIONS = [
  { value: '/', label: 'Home' },
  { value: '/sevas', label: 'Sevas' },
  { value: '/donate', label: 'Donate' },
  { value: '/camps', label: 'Camps' },
  { value: '/magazine', label: 'Magazine' },
  { value: '/contact', label: 'Contact' },
  { value: '/about/omkarananda', label: 'About: Pujyasri Omkarananda' },
  { value: '/about/ashramam', label: 'About: Ashramam' },
  { value: '/about/adhishtanam', label: 'About: Adhishtanam' },
  { value: '/about/vidyapitham', label: 'About: Vidyapitham' },
];

type HelpItem = { label: Bi; text: Bi; href: string };
type Doc = Record<string, any> & { mapQuery: string; topics: Bi[]; help: HelpItem[] };

const emptyDoc = (): Doc => {
  const d: any = { mapQuery: '', topics: [], help: [] };
  ALL_BI.forEach(([k]) => { d[k] = bi(); });
  return d as Doc;
};
const norm = (raw: any): Doc => {
  const d: any = emptyDoc();
  ALL_BI.forEach(([k]) => { d[k] = b(raw?.[k]); });
  d.mapQuery = String(raw?.mapQuery ?? '');
  d.topics = (Array.isArray(raw?.topics) ? raw.topics : []).map(b);
  d.help = (Array.isArray(raw?.help) ? raw.help : []).map((x: any) => ({ label: b(x?.label), text: b(x?.text), href: String(x?.href ?? '') }));
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

// ======================= Page content =======================
function PageEditor({ flash }: { flash: (k: 'ok' | 'err', m: string) => void }) {
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

  const setBi = (k: string, v: Bi) => setDoc((d) => ({ ...d, [k]: v }));
  const patchList = (key: 'topics' | 'help', i: number, p: any) => setDoc((d) => ({ ...d, [key]: (d[key] as any[]).map((x, k) => (k === i ? (key === 'topics' ? p : { ...x, ...p }) : x)) }));
  const addTo = (key: 'topics' | 'help', item: any) => setDoc((d) => ({ ...d, [key]: [...(d[key] as any[]), item] }));
  const removeAt = (key: 'topics' | 'help', i: number) => setDoc((d) => ({ ...d, [key]: (d[key] as any[]).filter((_, k) => k !== i) }));
  const move = (key: 'topics' | 'help', i: number, dir: -1 | 1) => setDoc((d) => {
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

  const fields = (group: string) => PAGE_FIELDS[group].map(([k, label, rows]) => <BiField key={k} label={label} rows={rows} value={doc[k]} onChange={(v) => setBi(k, v)} />);
  const sec = (title: string, children: React.ReactNode) => (<section className="card" style={{ padding: 18, marginBottom: 16 }}><h3 className="sech">{title}</h3>{children}</section>);
  const bar = (key: 'topics' | 'help', i: number, len: number, removeLabel: string) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
      <button type="button" className="btn sm" disabled={i === 0} onClick={() => move(key, i, -1)}>Move up</button>
      <button type="button" className="btn sm" disabled={i === len - 1} onClick={() => move(key, i, 1)}>Move down</button>
      <button type="button" className="btn sm dng" onClick={() => removeAt(key, i)}>{removeLabel}</button>
    </div>
  );

  if (loading) return <><div className="skel" /><div className="skel" /></>;
  if (err) return <div role="alert" className="alert bad">{err} <button type="button" className="btn link" onClick={load}>Try again</button></div>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <p className="mut" style={{ maxWidth: 640 }}>Everything on the Contact page. A text left empty keeps the current website text.</p>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
      </div>

      {sec('Page title and search', fields('search'))}
      {sec('Top of the page', fields('top'))}
      {sec('Contact cards', (
        <>
          <div className="alert info" style={{ marginBottom: 12 }}>The phone numbers, the email and the WhatsApp link are not edited here. They come from <strong>apps/web/src/lib/site.ts</strong>, so the footer and this page always show the same ones.</div>
          {fields('cards')}
        </>
      ))}
      {sec('Map and visit', (
        <>
          <div style={{ marginBottom: 12 }}>
            <label className="lbl">Map location (how Google Maps finds the ashram)</label>
            <input className="inp" value={doc.mapQuery} placeholder="Sri Swami Chidbhavananda Ashramam, Vedapuri, Chatrapatti Road, Theni 625531" onChange={(e) => setDoc((d) => ({ ...d, mapQuery: e.target.value }))} />
            <p className="hint mut">Left empty, the usual address is used. Check the map on the website after saving.</p>
          </div>
          {fields('visit')}
        </>
      ))}
      {sec('Message form', (
        <>
          {fields('form')}
          <p className="lbl" style={{ marginTop: 6 }}>Topics in the drop-down list</p>
          <p className="hint mut" style={{ marginBottom: 8 }}>The topic the visitor picks is saved with the message and shown in your Messages list.</p>
          {doc.topics.map((x, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <BiField label={`Topic ${i + 1}`} value={x} onChange={(v) => patchList('topics', i, v)} />
              {bar('topics', i, doc.topics.length, 'Remove')}
            </div>
          ))}
          <button type="button" className="btn" onClick={() => addTo('topics', bi())}>+ Add a topic</button>
        </>
      ))}
      {sec('Form messages', <>{fields('errors')}</>)}
      {sec('After sending', <>{fields('thanks')}</>)}
      {sec('Other things people come here for', (
        <>
          {fields('help')}
          {doc.help.map((h, i) => (
            <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
              <p style={{ fontWeight: 800, marginBottom: 8 }}>Card {i + 1}{h.label.en ? `: ${h.label.en}` : ''}</p>
              <BiField label="Name" value={h.label} onChange={(v) => patchList('help', i, { label: v })} />
              <BiField label="Text" rows={2} value={h.text} onChange={(v) => patchList('help', i, { text: v })} />
              <LinkField label="Opens" value={h.href} onChange={(v) => patchList('help', i, { href: v })} />
              {bar('help', i, doc.help.length, 'Remove card')}
            </div>
          ))}
          <button type="button" className="btn" onClick={() => addTo('help', { label: bi(), text: bi(), href: '' })}>+ Add a card</button>
        </>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 30 }}>
        <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
      </div>
    </>
  );
}

// ======================= Messages =======================
type Msg = { id: number; name: string; phone: string | null; email: string | null; topic: string | null; message: string; locale: string; status: 'new' | 'done'; ack_sent: number; created_at: string };

const when = (s: string) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? s : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

function Messages({ flash, onCounts }: { flash: (k: 'ok' | 'err', m: string) => void; onCounts: (n: number) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'new' | 'done' | 'all'>('new');
  const [q, setQ] = useState('');
  const [delId, setDelId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${CONTACT}/admin/messages`, { headers: authHeader(), cache: 'no-store' });
      const d = await readJson(res);
      if (!res.ok) throw new Error(failText(d, `Could not load the messages (${res.status}).`));
      setMsgs(d.messages || []);
      onCounts(Number(d.counts?.new) || 0);
    } catch (e: any) { setErr(`${e?.message || 'Could not load the messages.'}`); } finally { setLoading(false); }
  }, [onCounts]);
  useEffect(() => { load(); }, [load]);

  async function setStatus(m: Msg, status: 'new' | 'done') {
    setBusy(m.id);
    try {
      const res = await fetch(`${CONTACT}/admin/messages/${m.id}`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error(failText(await readJson(res), 'Could not change the status.'));
      setMsgs((l) => { const next = l.map((x) => (x.id === m.id ? { ...x, status } : x)); onCounts(next.filter((x) => x.status === 'new').length); return next; });
    } catch (e: any) { flash('err', e?.message || 'Could not change the status.'); } finally { setBusy(null); }
  }
  async function del(m: Msg) {
    setBusy(m.id);
    try {
      const res = await fetch(`${CONTACT}/admin/messages/${m.id}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) throw new Error(failText(await readJson(res), 'Could not delete.'));
      setDelId(null);
      setMsgs((l) => { const next = l.filter((x) => x.id !== m.id); onCounts(next.filter((x) => x.status === 'new').length); return next; });
      flash('ok', 'Message deleted.');
    } catch (e: any) { flash('err', e?.message || 'Could not delete.'); } finally { setBusy(null); }
  }
  async function exportCsv() {
    try {
      const res = await fetch(`${CONTACT}/admin/messages/export`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = 'contact-messages.csv'; a.click(); URL.revokeObjectURL(url);
    } catch { flash('err', 'The export failed.'); }
  }

  const nNew = msgs.filter((m) => m.status === 'new').length;
  const t = q.trim().toLowerCase();
  const shown = msgs.filter((m) => (filter === 'all' || m.status === filter) && (!t || `${m.name} ${m.phone || ''} ${m.email || ''} ${m.topic || ''} ${m.message} #${m.id}`.toLowerCase().includes(t)));
  const chip = (k: 'new' | 'done' | 'all', label: string) => (
    <button key={k} type="button" className={`btn sm${filter === k ? ' primary' : ''}`} onClick={() => setFilter(k)}>{label}</button>
  );

  if (loading) return <><div className="skel" /><div className="skel" /></>;
  if (err) return <div role="alert" className="alert bad">{err} <button type="button" className="btn link" onClick={load}>Try again</button></div>;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        {chip('new', `New ${nNew}`)}{chip('done', `Done ${msgs.length - nNew}`)}{chip('all', `All ${msgs.length}`)}
        <input className="inp" style={{ width: 240, maxWidth: '100%' }} placeholder="Search" aria-label="Search messages" value={q} onChange={(e) => setQ(e.target.value)} />
        <span style={{ flex: 1 }} />
        <button type="button" className="btn sm" onClick={load}>Refresh</button>
        <button type="button" className="btn sm" onClick={exportCsv}>Export (Excel)</button>
      </div>

      {shown.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 800 }}>{msgs.length === 0 ? 'No messages yet' : 'No message matches this filter'}</p>
          {msgs.length === 0 && <p className="mut" style={{ marginTop: 4 }}>Messages sent from the website Contact form appear here.</p>}
        </div>
      ) : shown.map((m) => (
        <article key={m.id} className="card" style={{ padding: 16, marginBottom: 12, borderLeft: `4px solid ${m.status === 'new' ? '#d97706' : '#cbd5e1'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <p style={{ fontWeight: 800, fontSize: 16 }}>{m.name} <span className="mut" style={{ fontWeight: 600, fontSize: 12 }}>#{m.id}</span>{m.status === 'new' && <span style={{ marginLeft: 8, background: '#fef3c7', color: '#92400e', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 800 }}>NEW</span>}</p>
            <p className="mut" style={{ fontSize: 12 }}>{when(m.created_at)}</p>
          </div>
          <p style={{ marginTop: 6, fontSize: 13, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {m.phone && <a href={`tel:${m.phone}`} style={{ fontWeight: 700, textDecoration: 'underline' }}>{m.phone}</a>}
            {m.email && <a href={`mailto:${m.email}`} style={{ fontWeight: 700, textDecoration: 'underline', wordBreak: 'break-all' }}>{m.email}</a>}
            {m.topic && <span className="mut">Topic: {m.topic}</span>}
            <span className="mut">{m.locale === 'ta' ? 'Tamil page' : 'English page'}</span>
            {m.email && <span style={{ color: m.ack_sent ? '#166534' : '#b91c1c', fontWeight: 700 }}>{m.ack_sent ? 'Copy emailed to the sender' : 'Copy could NOT be emailed'}</span>}
          </p>
          <p style={{ marginTop: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.5 }}>{m.message}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
            {m.status === 'new'
              ? <button type="button" className="btn sm primary" disabled={busy === m.id} onClick={() => setStatus(m, 'done')}>Mark as done</button>
              : <button type="button" className="btn sm" disabled={busy === m.id} onClick={() => setStatus(m, 'new')}>Mark as new</button>}
            {m.email && <a className="btn sm" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.topic || 'your message'} (#${m.id})`)}`}>Reply by email</a>}
            {delId === m.id ? (
              <>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Delete this message?</span>
                <button type="button" className="btn sm dng" disabled={busy === m.id} onClick={() => del(m)}>Yes, delete</button>
                <button type="button" className="btn sm" onClick={() => setDelId(null)}>Cancel</button>
              </>
            ) : <button type="button" className="btn sm dng" onClick={() => setDelId(m.id)}>Delete</button>}
          </div>
        </article>
      ))}
    </>
  );
}

// ======================= Screen =======================
export default function ContactManagement() {
  const { notice, flash, clear } = useFlash();
  const [tab, setTab] = useState<'messages' | 'page'>('messages');
  const [newCount, setNewCount] = useState(0);
  const onCounts = useCallback((n: number) => setNewCount(n), []);

  return (
    <div className="dc">
      <style>{CSS}</style>
      <div className="head">
        <div>
          <h1 className="title">Contact</h1>
          <p className="mut" style={{ marginTop: 2 }}>Messages from the website Contact form, and the text of the Contact page.</p>
        </div>
      </div>
      <Notice notice={notice} onClear={clear} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" className={`btn${tab === 'messages' ? ' primary' : ''}`} onClick={() => setTab('messages')}>Messages{newCount ? ` (${newCount} new)` : ''}</button>
        <button type="button" className={`btn${tab === 'page' ? ' primary' : ''}`} onClick={() => setTab('page')}>Page content</button>
      </div>
      {tab === 'messages' ? <Messages flash={flash} onCounts={onCounts} /> : <PageEditor flash={flash} />}
    </div>
  );
}