import React, { useEffect, useRef, useState } from 'react';
import { authHeader, failText, readJson } from './DiscoverKit';
import { ymd } from './PaymentCharts';
import type { FormData } from './sankalpaForm';
import { COUNTRIES, GOTHRAMS, NA, NAKSHATRAS, RASIS, RELATIONS, joinPhone, phoneProblem, splitPhone } from './sankalpaLists';
import type { Choice } from './sankalpaLists';
import { describe, fetchPanchangam } from './panchangamLookup';
import type { PanchangamDay } from './panchangamLookup';

// The on-site entry form: a devotee who gives a seva or a donation at the ashram is written into the register here.
// It is used for a new entry and for correcting one that was already saved.

export type ManualKind = 'seva' | 'donation';
export type ManualPerson = { name: string; relation: string; place: string; gothram: string; nakshathiram: string; rasi: string; dob: string; gAuto?: boolean };
// One sankalpam names at most this many people
export const MAX_PEOPLE = 5;
const hasData = (p: ManualPerson) => [p.name, p.relation, p.place, p.gothram, p.nakshathiram, p.rasi, p.dob].some((v) => v.trim());
// The gothram of the family comes from the husband or the father. When neither is listed, from the first person (self).
const HEADS = new Set(['Husband', 'Father']);
const isHead = (list: ManualPerson[], i: number) => {
  const r = list[i].relation;
  if (HEADS.has(r)) return true;
  return (r === 'Self' || r === '') && !list.some((p) => HEADS.has(p.relation));
};
export type ManualEntry = {
  id: number; kind: ManualKind; series: string; serial: number; receipt_no: string; entry_date: string | null; pooja_date: string | null;
  item_title: string; category: string; amount: number; payment_mode: string; payment_ref: string; name: string; phone: string; email: string;
  address: string; city: string; state: string; pincode: string; notes: string; status: string; cancel_reason: string; people: Partial<ManualPerson>[];
};

export const PAY_LABEL: Record<string, string> = { cash: 'Cash', upi: 'UPI', cheque: 'Cheque', dd: 'Demand draft', card: 'Card', bank: 'Bank transfer', other: 'Other' };

// What the printed Sankalpa form needs, taken from a saved entry
export function formFromEntry(m: ManualEntry): FormData {
  const address = [m.address, m.city, m.state, m.pincode].filter(Boolean).join(', ');
  const people = (m.people || []).map((p) => ({ name: p.name, place: p.place, gothram: p.gothram, nakshathiram: p.nakshathiram, rasi: p.rasi }));
  return {
    name: m.name, address, phone: m.phone, amount: m.amount, receiptNo: m.receipt_no,
    date: m.entry_date || '', poojaDate: m.pooja_date || '', poojaDetails: m.item_title, people,
  };
}

type Candidate = {
  source: 'devotee' | 'onsite'; devotee_id: string; label: string; name: string; email: string; phone: string;
  address: string; city: string; state: string; pincode: string; people: Partial<ManualPerson>[];
};

const blankPerson = (): ManualPerson => ({ name: '', relation: '', place: '', gothram: '', nakshathiram: '', rasi: '', dob: '' });

const MF_CSS = `
.mf-back{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:1000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 12px}
.mf{background:#fff;border-radius:18px;width:min(100%,860px);box-shadow:0 20px 60px rgba(15,23,42,.35);margin:auto}
.mf-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px 22px;border-bottom:1px solid #eaecf0;background:#fff8ec;border-radius:18px 18px 0 0}
.mf-h h2{margin:0;font-size:20px;font-weight:800;color:#3b0d0d}
.mf-h p{margin:4px 0 0;font-size:13px;color:#64748b}
.mf-x{border:0;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:#64748b;padding:0 4px}
.mf-b{padding:18px 22px;display:grid;gap:18px}
.mf-sec{display:grid;gap:10px}
.mf-sec>h3{margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#7a1c1c;font-weight:800}
.mf-g{display:grid;gap:10px 12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))}
.mf-g .pdx-inp,.mf-sec .pdx-inp{width:100%;box-sizing:border-box}
.mf-w2{grid-column:span 2}
@media(max-width:560px){.mf-w2{grid-column:auto}}
.mf-rc{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px 14px;font-size:14px;color:#78350f}
.mf-rc b{font-size:16px;color:#3b0d0d}
.mf-pp{border:1px solid #eaecf0;border-radius:14px;padding:12px;display:grid;gap:10px;background:#fcfcfd}
.mf-ph{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:13px;color:#3b0d0d}
.mf-f{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 22px;border-top:1px solid #eaecf0;background:#fafafa;border-radius:0 0 18px 18px}
.mf-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;font-size:13.5px}
.mf-req{color:#b91c1c}
.mf-ph3{display:grid;grid-template-columns:minmax(0,170px) minmax(0,1fr) auto;gap:8px}
@media(max-width:560px){.mf-ph3{grid-template-columns:minmax(0,1fr)}}
.mf-pn{background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 14px;font-size:13.5px;color:#0c4a6e}
.mf-pn dl{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;margin:6px 0 0}
.mf-pn dt{font-weight:700}.mf-pn dd{margin:0}
.mf-oth{margin-top:6px}
.mf-fd{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:10px 14px;font-size:13.5px;color:#14532d;display:grid;gap:8px}
.mf-fd.warn{background:#fffbeb;border-color:#fde68a;color:#78350f}
.mf-fd .pdx-inp{max-width:100%}
`;

// A dropdown with "N/A" for a devotee who prefers not to say. With `other`, a value that is not in the list can be typed.
function Pick({ id, label, value, onChange, options, other }: { id: string; label: string; value: string; onChange: (v: string) => void; options: Choice[]; other?: boolean }) {
  const known = options.some((o) => o.value === value);
  const [typing, setTyping] = useState(false);
  const custom = value !== '' && value !== NA && !known;
  const showText = other && (typing || custom);
  // A saved value that is not on the list (older records) stays selectable
  const list = !other && custom ? [...options, { value }] : options;
  const sel = showText ? '__other' : value;
  return (
    <div>
      <label className="pdx-lbl" htmlFor={id}>{label}</label>
      <select id={id} className="pdx-inp" value={sel} onChange={(e) => {
        const v = e.target.value;
        if (v === '__other') { setTyping(true); onChange(''); } else { setTyping(false); onChange(v); }
      }}>
        <option value="">Select...</option>
        <option value={NA}>N/A</option>
        {list.map((o) => <option key={o.value} value={o.value}>{o.ta ? `${o.value} (${o.ta})` : o.value}</option>)}
        {other && <option value="__other">Other (type it)</option>}
      </select>
      {showText && <input className="pdx-inp mf-oth" aria-label={`${label}, typed`} autoComplete="off" autoFocus={typing && !custom} value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} placeholder={`Type the ${label.toLowerCase()}`} />}
    </div>
  );
}


export default function ManualEntryForm({ kind, apiBase, editId, items, onClose, onSaved }: {
  kind: ManualKind; apiBase: string; editId: number | null; items: string[];
  onClose: () => void; onSaved: (e: { id: number; receipt_no: string; edited: boolean; print: boolean }) => void;
}) {
  const BASE = `${apiBase}/registers/admin/${kind}/manual`;
  const today = ymd(new Date());
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState<'' | 'save' | 'print'>('');
  const [err, setErr] = useState('');
  const [entryDate, setEntryDate] = useState(today);
  const [poojaDate, setPoojaDate] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [category, setCategory] = useState(kind === 'seva' ? 'seva' : '');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [ref, setRef] = useState('');
  const [name, setName] = useState('');
  const [cc, setCc] = useState('91');
  const [phoneNum, setPhoneNum] = useState('');
  const [panch, setPanch] = useState<{ state: 'idle' | 'load' | 'ok' | 'none' | 'err'; data?: PanchangamDay }>({ state: 'idle' });
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [notes, setNotes] = useState('');
  const [series, setSeries] = useState('');
  const [serial, setSerial] = useState('');
  const [people, setPeople] = useState<ManualPerson[]>([blankPerson()]);
  const [next, setNext] = useState('');
  const firstField = useRef<HTMLInputElement>(null);
  const [found, setFound] = useState<{ state: 'idle' | 'load' | 'none' | 'err' | 'ok'; list: Candidate[]; used: number }>({ state: 'idle', list: [], used: -1 });

  // Escape closes the form; the page behind it does not scroll while it is open
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [onClose, saving]);

  // Correcting an entry: load what was saved
  useEffect(() => {
    if (!editId) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch(`${BASE}/${editId}`, { headers: authHeader(), cache: 'no-store' });
        const j = await readJson(res);
        if (!live) return;
        if (!res.ok) { setErr(failText(j, 'Could not load the entry.')); return; }
        const m = j as ManualEntry;
        setEntryDate(m.entry_date || today); setPoojaDate(m.pooja_date || ''); setItemTitle(m.item_title); setCategory(m.category);
        setAmount(String(m.amount)); setMode(m.payment_mode); setRef(m.payment_ref); setName(m.name); { const ph = splitPhone(m.phone); setCc(ph.cc); setPhoneNum(ph.num); } setEmail(m.email);
        setAddress(m.address); setCity(m.city); setState(m.state); setPincode(m.pincode); setNotes(m.notes);
        setSeries(m.series); setSerial(String(m.serial));
        setPeople(m.people.length ? m.people.map((p) => ({ ...blankPerson(), ...p } as ManualPerson)) : [blankPerson()]);
      } catch { if (live) setErr('Network error. Please close and try again.'); } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [BASE, editId, today]);

  useEffect(() => { if (!loading) firstField.current?.focus(); }, [loading]);

  // The receipt number the next new entry will get; it follows the date (financial year) and the series typed
  useEffect(() => {
    if (editId) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ date: entryDate });
        const res = await fetch(`${BASE}/next?${p}`, { headers: authHeader(), cache: 'no-store' });
        const j = await readJson(res);
        if (live) setNext(res.ok ? String((j as any).receipt_no || '') : '');
      } catch { if (live) setNext(''); }
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [BASE, editId, entryDate]);

  // The Panchangam Manager's entry for the pooja day, read as soon as a date is chosen
  useEffect(() => {
    if (kind !== 'seva' || !poojaDate) { setPanch({ state: 'idle' }); return; }
    let live = true;
    setPanch({ state: 'load' });
    fetchPanchangam(poojaDate).then((d) => { if (live) setPanch(d ? { state: 'ok', data: d } : { state: 'none' }); }).catch(() => { if (live) setPanch({ state: 'err' }); });
    return () => { live = false; };
  }, [kind, poojaDate]);

  // Fill the form from a saved devotee record (a record the staff chose replaces what was filled before)
  const apply = (c: Candidate, overwrite: boolean) => {
    // Each field is checked against what is in it at this moment, so nothing the staff typed meanwhile is overwritten
    const put = (v: string, set: React.Dispatch<React.SetStateAction<string>>) => { if (v) set((cur) => (overwrite || !cur.trim() ? v : cur)); };
    put(c.name, setName); put(c.email, setEmail); put(c.address, setAddress);
    put(c.city, setCity); put(c.state, setState); put(c.pincode, setPincode);
    if (c.people.length) {
      setPeople((cur) => (overwrite || cur.every((p) => !hasData(p))
        ? c.people.slice(0, MAX_PEOPLE).map((p) => ({ ...blankPerson(), ...p } as ManualPerson)) : cur));
    }
  };
  // The mobile number is looked up when the staff press Enter or "Find devotee"
  const phoneReady = !phoneProblem(cc, phoneNum) && phoneNum.replace(/\D/g, '').replace(/^0+/, '').length >= 7;
  async function findDevotee() {
    const bad = phoneProblem(cc, phoneNum);
    if (bad) { setErr(bad); return; }
    if (!phoneReady) { setErr('Please enter the full mobile number first.'); return; }
    setErr('');
    setFound({ state: 'load', list: [], used: -1 });
    try {
      const res = await fetch(`${apiBase}/registers/admin/devotee-lookup?${new URLSearchParams({ phone: joinPhone(cc, phoneNum) })}`, { headers: authHeader(), cache: 'no-store' });
      const j: any = await readJson(res);
      if (!res.ok) { setFound({ state: 'err', list: [], used: -1 }); return; }
      const list: Candidate[] = Array.isArray(j.candidates) ? j.candidates : [];
      if (!list.length) { setFound({ state: 'none', list: [], used: -1 }); return; }
      setFound({ state: 'ok', list, used: list.length === 1 ? 0 : -1 });
      if (list.length === 1) apply(list[0], true);
    } catch { setFound({ state: 'err', list: [], used: -1 }); }
  }

  const setPerson = (i: number, k: Exclude<keyof ManualPerson, 'gAuto'>, v: string) => setPeople((a) => a.map((p, n) => (n === i ? { ...p, [k]: v } : p)));
  // The gothram chosen for the husband or father is copied to the others who have none, or whose gothram was copied; a person whose gothram was changed by hand keeps it
  const setGothram = (i: number, v: string) => setPeople((a) => {
    let next = a.map((p, n) => (n === i ? { ...p, gothram: v, gAuto: false } : p));
    if (isHead(next, i)) next = next.map((p, n) => (n !== i && (!p.gothram || p.gAuto) ? { ...p, gothram: v, gAuto: !!v } : p));
    return next;
  });
  const addPerson = () => setPeople((a) => {
    if (a.length >= MAX_PEOPLE) return a;
    const head = a.findIndex((_, n) => isHead(a, n) && a[n].gothram);
    const g = head >= 0 ? a[head].gothram : '';
    return [...a, { ...blankPerson(), gothram: g, gAuto: !!g }];
  });

  async function save(print: boolean) {
    setErr('');
    if (!name.trim()) { setErr('Please enter the devotee name.'); return; }
    if (!itemTitle.trim()) { setErr(kind === 'seva' ? 'Please enter the seva or pooja name.' : 'Please enter the fund name.'); return; }
    if (!(Number(amount) > 0)) { setErr('Please enter the amount received.'); return; }
    const bad = phoneProblem(cc, phoneNum);
    if (bad) { setErr(bad); return; }
    setSaving(print ? 'print' : 'save');
    try {
      const body = {
        entry_date: entryDate, pooja_date: kind === 'seva' ? poojaDate : '', item_title: itemTitle, category, amount: Number(amount),
        payment_mode: mode, payment_ref: ref, name, phone: joinPhone(cc, phoneNum), email, address, city, state, pincode, notes,
        // A new entry always gets its number from the server; a corrected one keeps its own
        series: editId ? series.trim() : '', serial: editId ? serial.trim() : '', people: people.filter(hasData).map(({ gAuto: _auto, ...p }) => p),
      };
      const res = await fetch(editId ? `${BASE}/${editId}` : BASE, {
        method: editId ? 'PUT' : 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j: any = await readJson(res);
      if (!res.ok) { setErr(failText(j, 'Could not save the entry.')); return; }
      onSaved({ id: Number(j.id), receipt_no: String(j.receipt_no), edited: !!editId, print });
    } catch { setErr('Network error. Please try again.'); } finally { setSaving(''); }
  }

  const fundList = `mf-items-${kind}`;
  return (
    <div className="mf-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <style>{MF_CSS}</style>
      <form className="mf" role="dialog" aria-modal="true" aria-labelledby="mf-title" onSubmit={(e) => { e.preventDefault(); save(false); }}>
        <div className="mf-h">
          <div>
            <h2 id="mf-title">{editId ? 'Correct on-site entry' : kind === 'seva' ? 'New on-site seva entry' : 'New on-site donation entry'}</h2>
            <p>For a devotee who gives at the ashram. The receipt number is given automatically.</p>
          </div>
          <button type="button" className="mf-x" onClick={onClose} aria-label="Close" disabled={!!saving}>&times;</button>
        </div>

        {loading ? <div className="mf-b"><p>Loading...</p></div> : (
          <div className="mf-b">
            {err && <div className="mf-err" role="alert">{err}</div>}

            <div className="mf-sec">
              <h3>Devotee</h3>
              <div className="mf-g">
                <div style={{ gridColumn: '1 / -1' }}><label className="pdx-lbl" htmlFor="mf-phone">Mobile number</label>
                  <div className="mf-ph3">
                    <select aria-label="Country code" className="pdx-inp" value={cc} onChange={(e) => setCc(e.target.value)}>
                      {COUNTRIES.map(([c, n]) => <option key={c} value={c}>+{c} {n}</option>)}
                    </select>
                    <input id="mf-phone" ref={firstField} className="pdx-inp" type="tel" inputMode="tel" autoComplete="off" value={phoneNum}
                      onChange={(e) => setPhoneNum(e.target.value.replace(/[^\d\s-]/g, ''))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!editId) findDevotee(); } }}
                      maxLength={20} placeholder={cc === '91' ? '10-digit number, then press Enter' : 'Number, then press Enter'} />
                    {!editId && <button type="button" className="pdx-btn" onClick={findDevotee} disabled={!phoneReady || found.state === 'load'}>{found.state === 'load' ? 'Searching...' : 'Find devotee'}</button>}
                  </div></div>
                {found.state !== 'idle' && !editId && (
                  <div className={`mf-fd${found.state === 'ok' ? '' : ' warn'}`} style={{ gridColumn: '1 / -1' }} aria-live="polite">
                    {found.state === 'load' && 'Looking for this mobile number...'}
                    {found.state === 'none' && 'This number is not in the database yet. Enter the details below by hand; they are saved with this entry and found next time.'}
                    {found.state === 'err' && 'The mobile number could not be looked up. You can still enter the details by hand.'}
                    {found.state === 'ok' && found.list.length === 1 && (<span><b>Found {found.list[0].label}.</b> The details below are filled from the saved record. Please check them with the devotee.</span>)}
                    {found.state === 'ok' && found.list.length > 1 && (<>
                      <span><b>{found.list.length} records use this number.</b> Choose the devotee:</span>
                      <select className="pdx-inp" aria-label="Choose the devotee" value={found.used} onChange={(e) => { const i = Number(e.target.value); setFound({ ...found, used: i }); if (i >= 0) apply(found.list[i], true); }}>
                        <option value={-1}>Select...</option>
                        {found.list.map((c, i) => <option key={i} value={i}>{c.label}</option>)}
                      </select>
                    </>)}
                  </div>
                )}
                <div className="mf-w2"><label className="pdx-lbl" htmlFor="mf-name">Name <span className="mf-req">*</span></label>
                  <input id="mf-name" autoComplete="off" className="pdx-inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required /></div>
                <div><label className="pdx-lbl" htmlFor="mf-email">Email</label>
                  <input id="mf-email" autoComplete="off" className="pdx-inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={150} /></div>
                <div className="mf-w2"><label className="pdx-lbl" htmlFor="mf-addr">Address</label>
                  <input id="mf-addr" autoComplete="off" className="pdx-inp" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} /></div>
                <div><label className="pdx-lbl" htmlFor="mf-city">City</label>
                  <input id="mf-city" autoComplete="off" className="pdx-inp" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} /></div>
                <div><label className="pdx-lbl" htmlFor="mf-state">State</label>
                  <input id="mf-state" autoComplete="off" className="pdx-inp" value={state} onChange={(e) => setState(e.target.value)} maxLength={100} /></div>
                <div><label className="pdx-lbl" htmlFor="mf-pin">Pincode</label>
                  <input id="mf-pin" autoComplete="off" className="pdx-inp" inputMode="numeric" value={pincode} onChange={(e) => setPincode(e.target.value)} maxLength={12} /></div>
              </div>
            </div>

            <div className="mf-sec">
              <h3>Receipt</h3>
              <div className="mf-rc">
                {editId ? <>Receipt number <b>{series}-{String(serial || '').padStart(4, '0')}</b></> : <>Receipt number <b>{next || '...'}</b> (given automatically when you save)</>}
              </div>
              <div className="mf-g">
                <div><label className="pdx-lbl" htmlFor="mf-date">Receipt date <span className="mf-req">*</span></label>
                  <input id="mf-date" className="pdx-inp" type="date" max={today} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required /></div>
              </div>
            </div>

            <div className="mf-sec">
              <h3>{kind === 'seva' ? 'Seva' : 'Donation'}</h3>
              <div className="mf-g">
                <div className="mf-w2"><label className="pdx-lbl" htmlFor="mf-item">{kind === 'seva' ? 'Seva / pooja name' : 'Fund / purpose'} <span className="mf-req">*</span></label>
                  <input id="mf-item" autoComplete="off" className="pdx-inp" list={fundList} value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} maxLength={255} required />
                  <datalist id={fundList}>{items.map((n) => <option key={n} value={n} />)}</datalist></div>
                {kind === 'seva' && (
                  <div><label className="pdx-lbl" htmlFor="mf-cat">Category</label>
                    <select id="mf-cat" className="pdx-inp" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="seva">Seva</option><option value="corpus">Corpus</option>
                    </select></div>
                )}
                {kind === 'seva' && (
                  <div><label className="pdx-lbl" htmlFor="mf-pooja">Pooja date</label>
                    <input id="mf-pooja" className="pdx-inp" type="date" value={poojaDate} onChange={(e) => setPoojaDate(e.target.value)} /></div>
                )}
                {kind === 'seva' && panch.state !== 'idle' && (
                  <div className="mf-pn mf-w2" style={{ gridColumn: '1 / -1' }} aria-live="polite">
                    {panch.state === 'load' && 'Loading the panchangam...'}
                    {panch.state === 'none' && 'No panchangam is entered for this date in the Panchangam Manager, so the printed form will leave it out.'}
                    {panch.state === 'err' && 'The panchangam could not be loaded. The entry can still be saved.'}
                    {panch.state === 'ok' && panch.data && (<>
                      <b>Panchangam for {poojaDate.split('-').reverse().join('/')}</b> (from the Panchangam Manager)
                      <dl>{describe(panch.data).map((r) => <React.Fragment key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></React.Fragment>)}</dl>
                    </>)}
                  </div>
                )}
                <div><label className="pdx-lbl" htmlFor="mf-amt">Amount received (Rs) <span className="mf-req">*</span></label>
                  <input id="mf-amt" className="pdx-inp" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} required /></div>
                <div><label className="pdx-lbl" htmlFor="mf-mode">Paid by</label>
                  <select id="mf-mode" className="pdx-inp" value={mode} onChange={(e) => setMode(e.target.value)}>
                    {Object.entries(PAY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></div>
                <div><label className="pdx-lbl" htmlFor="mf-ref">{mode === 'cheque' || mode === 'dd' ? 'Cheque / DD number' : mode === 'upi' || mode === 'bank' || mode === 'card' ? 'Transaction reference' : 'Payment reference'}</label>
                  <input id="mf-ref" autoComplete="off" className="pdx-inp" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={100} /></div>
              </div>
            </div>

            <div className="mf-sec">
              <h3>Sankalpam (people the pooja is done for)</h3>
              <p className="pdx-sub" style={{ margin: 0 }}>Up to {MAX_PEOPLE} people. The gothram chosen for the husband or father is copied to the others; change it for anyone whose gothram is different.</p>
              <datalist id="mf-na"><option value={NA} /></datalist>
              {people.map((p, i) => (
                <div key={i} className="mf-pp">
                  <div className="mf-ph"><span>Person {i + 1} of {MAX_PEOPLE}</span>
                    {people.length > 1 && <button type="button" className="pdx-link" onClick={() => setPeople((a) => a.filter((_, n) => n !== i))}>Remove</button>}</div>
                  <div className="mf-g">
                    <div className="mf-w2"><label className="pdx-lbl" htmlFor={`mf-pn-${i}`}>Name</label>
                      <input id={`mf-pn-${i}`} className="pdx-inp" value={p.name} onChange={(e) => setPerson(i, 'name', e.target.value)} maxLength={120} /></div>
                    <Pick id={`mf-pr-${i}`} label="Relation" value={p.relation} options={RELATIONS} other onChange={(v) => setPerson(i, 'relation', v)} />
                    <div><label className="pdx-lbl" htmlFor={`mf-pl-${i}`}>Place (ஊர்)</label>
                      <input id={`mf-pl-${i}`} className="pdx-inp" list="mf-na" autoComplete="off" value={p.place} onChange={(e) => setPerson(i, 'place', e.target.value)} maxLength={80} placeholder="Type, or N/A" /></div>
                    <Pick id={`mf-pg-${i}`} label="Gothram" value={p.gothram} options={GOTHRAMS} other onChange={(v) => setGothram(i, v)} />
                    <Pick id={`mf-pk-${i}`} label="Nakshatram" value={p.nakshathiram} options={NAKSHATRAS} onChange={(v) => setPerson(i, 'nakshathiram', v)} />
                    <Pick id={`mf-ps-${i}`} label="Rasi" value={p.rasi} options={RASIS} onChange={(v) => setPerson(i, 'rasi', v)} />
                    <div><label className="pdx-lbl" htmlFor={`mf-pd-${i}`}>Date of birth</label>
                      <input id={`mf-pd-${i}`} className="pdx-inp" type="date" max={today} value={p.dob} onChange={(e) => setPerson(i, 'dob', e.target.value)} /></div>
                  </div>
                </div>
              ))}
              {people.length < MAX_PEOPLE
                ? <div><button type="button" className="pdx-btn" onClick={addPerson}>+ Add another person</button></div>
                : <p className="pdx-sub" style={{ margin: 0 }}>A sankalpam can name up to {MAX_PEOPLE} people.</p>}
            </div>

            <div className="mf-sec">
              <h3>Notes</h3>
              <input className="pdx-inp" aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Anything to remember about this entry (optional)" />
            </div>
          </div>
        )}

        <div className="mf-f">
          <span className="pdx-sub">* required</span>
          <div className="pdx-row">
            <button type="button" className="pdx-btn" onClick={onClose} disabled={!!saving}>Cancel</button>
            <button type="button" className="pdx-btn" onClick={() => save(true)} disabled={!!saving || loading}>{saving === 'print' ? 'Saving...' : 'Save and print form'}</button>
            <button type="submit" className="pdx-btn pdx-btn-pri" disabled={!!saving || loading} style={{ background: '#7a1c1c', color: '#fff', borderColor: '#7a1c1c' }}>{saving === 'save' ? 'Saving...' : editId ? 'Save changes' : 'Save entry'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}