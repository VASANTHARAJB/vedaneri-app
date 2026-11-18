import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API, CSS, Notice, authHeader, failText, fileUrl, readJson, useFlash } from './DiscoverKit';
import { PDX_CSS, inr, rangeOf, when, ymd } from './PaymentCharts';
import type { Preset } from './PaymentCharts';
import { pageList } from './reportKit';

// API points at .../api/v1/discover. The devotee API is .../api/v1/devotees-admin/admin/devotees
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const DV = `${API_BASE}/devotees-admin/admin/devotees`;
const G80 = `${API_BASE}/devotees-admin/admin/donations-80g/export`;

type Totals = { donation: number; seva: number; camp: number; magazine: number };
type Devotee = {
  id: string; code: string; name: string; email: string | null; phone: string | null; residency: 'indian' | 'nri'; city: string | null; state: string | null;
  comm_address: string | null; perm_address: string | null; avatar_url: string | null; verified: boolean; login: 'google' | 'password'; has_pan: boolean;
  joined_at: string; last_active: string; last_paid: string | null; pay_count: number; pay_total: number; family_count: number; totals: Totals;
};
type Family = { id: number; title: string; name: string; gothram: string; nakshathiram: string; rasi: string; relation: string };
type Pay = { source: string; item: string; amount: number; status: 'PAID' | 'PENDING' | 'FAILED'; receipt_no: string | null; payment_id: string | null; paid_at: string };
type Camp = { id: number; title: string; adults: number; children: number; status: string; amount: number; payment_status: string; registered_at: string };
type PanOut = { profile: { pan: string; valid: boolean | null }; donations: { id: number; receipt_no: string | null; fund: string; amount: number; date: string; pan: string; valid: boolean | null; address: string }[] };
type Detail = { devotee: Devotee; family: Family[]; payments: Pay[]; camps: Camp[] };
type ListOut = { total: number; items: Devotee[]; totals: { devotees: number; verified: number; paying: number; paid: number }; states: string[] };

const SOURCE_LABEL: Record<string, string> = { donation: 'Donation', seva: 'Seva', camp: 'Camp', magazine: 'Magazine' };
const SOURCE_COLOR: Record<string, string> = { donation: '#7a1c1c', seva: '#ea580c', camp: '#e0a526', magazine: '#7c3aed' };
const STATUS_LABEL: Record<string, string> = { PAID: 'Paid', PENDING: 'Pending', FAILED: 'Failed' };
const STATUS_COLOR: Record<string, string> = { PAID: '#15803d', PENDING: '#b45309', FAILED: '#b91c1c' };
const PAGE_SIZES = [10, 25, 50, 100];
const SORTS: [string, string][] = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['name', 'Name A-Z'], ['paid', 'Most paid'], ['active', 'Recently active'], ['family', 'Most family members']];

const csvDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const telHref = (p: string | null) => (p && /^\+?[\d\s-]{6,20}$/.test(p) ? `tel:${p.replace(/[\s-]/g, '')}` : undefined);
const dateLabel = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="pdx-card">
      <p className="pdx-kpi-l">{label}</p>
      <p className="pdx-kpi-n" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="pdx-sub">{sub}</p>}
    </div>
  );
}

function Avatar({ d, size = 34 }: { d: { name: string; avatar_url: string | null }; size?: number }) {
  const [bad, setBad] = useState(false);
  const letter = (d.name || '?').trim().charAt(0).toUpperCase();
  if (d.avatar_url && !bad) {
    return <img src={fileUrl(d.avatar_url)} alt="" width={size} height={size} onError={() => setBad(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />;
  }
  return <span className="pdx-ava" aria-hidden="true" style={{ width: size, height: size }}>{letter}</span>;
}


// A short id with a Copy button
function CopyText({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <b style={{ letterSpacing: '.06em' }}>{value}</b>
      <button type="button" className="pdx-link" aria-label="Copy PAN" onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* the browser may block copying */ }
      }}>{done ? 'Copied' : 'Copy'}</button>
    </span>
  );
}

// PAN numbers for 80G receipts. Hidden until an admin asks; the server writes each request to its log.
function PanBox({ id }: { id: string }) {
  const [out, setOut] = useState<PanOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function show() {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`${DV}/${encodeURIComponent(id)}/pan`, { headers: authHeader(), cache: 'no-store' });
      const j = await readJson(res);
      if (!res.ok) throw new Error(failText(j, `Could not load the PAN numbers (${res.status}).`));
      setOut(j);
    } catch (e: any) { setErr(e?.message || 'Could not load the PAN numbers.'); } finally { setBusy(false); }
  }
  const badge = (valid: boolean | null) => (valid === null ? <span className="pdx-pill"><i style={{ background: STATUS_COLOR.FAILED }} />Missing</span> : valid ? <span className="pdx-pill"><i style={{ background: STATUS_COLOR.PAID }} />Format OK</span> : <span className="pdx-pill"><i style={{ background: STATUS_COLOR.PENDING }} />Check format</span>);
  return (
    <div style={{ margin: '14px 0 0' }}>
      <p style={{ fontWeight: 700, margin: '0 0 6px' }}>PAN for 80G receipts</p>
      {!out ? (
        <>
          <p className="pdx-sub" style={{ marginBottom: 8 }}>PAN numbers are private. They show only when you press the button, and the server records who looked.</p>
          <button type="button" className="pdx-btn" onClick={show} disabled={busy}>{busy ? 'Loading...' : 'Show PAN numbers'}</button>
          {err && <p role="alert" className="pdx-err" style={{ marginTop: 8 }}>{err}</p>}
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, marginBottom: 8 }}>PAN saved on the profile: {out.profile.pan ? <><CopyText value={out.profile.pan} /> {badge(out.profile.valid)}</> : <span className="pdx-mut">none</span>}</p>
          {out.donations.length === 0 ? <p className="pdx-sub">No paid donations for this devotee.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 760, fontSize: 13 }}>
                <thead><tr>{['Date', 'Receipt', 'Fund', 'Amount', 'PAN given with the donation', 'Address on the receipt'].map((h) => <th key={h} scope="col" style={{ padding: '6px 10px', textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {out.donations.map((d) => (
                    <tr key={d.id}>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{when(d.date)}</td>
                      <td style={{ padding: '6px 10px' }}>{d.receipt_no || '-'}</td>
                      <td style={{ padding: '6px 10px' }}>{d.fund}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{inr(d.amount)}</td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{d.pan ? <CopyText value={d.pan} /> : <span className="pdx-mut">-</span>} {badge(d.valid)}</td>
                      <td style={{ padding: '6px 10px' }}>{d.address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" className="pdx-link" style={{ marginTop: 6 }} onClick={() => setOut(null)}>Hide PAN numbers</button>
        </>
      )}
    </div>
  );
}

// One labelled value: a small grey label above the value
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="dvm-f" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <span className="dvm-l">{label}</span>
      <div className="dvm-v">{children}</div>
    </div>
  );
}
const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="dvm-sec">
    <h3>{title}</h3>
    {note && <p className="pdx-sub" style={{ margin: '-4px 0 10px' }}>{note}</p>}
    {children}
  </section>
);
const Dash = () => <span className="dvm-none">Not given</span>;

// The communication address, with a Change button. Saving writes it to the devotee's profile.
function AddressEditor({ id, value, onSaved }: { id: string; value: string | null; onSaved: (v: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(value || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!edit) setText(value || ''); }, [value, edit]);
  const clean = text.replace(/\r\n/g, '\n').trim();
  const same = clean === (value || '').trim();
  async function save() {
    if (busy) return;
    if (clean.length > 500) { setErr('The address is too long (500 letters at most).'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch(`${DV}/${encodeURIComponent(id)}/address`, {
        method: 'PUT', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ comm_address: clean }),
      });
      const j = await readJson(res);
      if (!res.ok) throw new Error(failText(j, `Could not save the address (${res.status}).`));
      onSaved(String(j?.comm_address ?? clean));
      setEdit(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setErr(e?.message || 'Could not save the address.'); } finally { setBusy(false); }
  }
  if (!edit) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, whiteSpace: 'pre-line' }}>{value ? value : <Dash />}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span role="status" style={{ color: STATUS_COLOR.PAID, fontSize: 13, fontWeight: 700 }}>Saved</span>}
          <button type="button" className="pdx-btn" onClick={() => { setText(value || ''); setErr(''); setEdit(true); }}>{value ? 'Change address' : 'Add address'}</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <textarea id={`addr-${id}`} className="pdx-inp" style={{ width: '100%', minHeight: 96, resize: 'vertical', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.4 }}
        value={text} maxLength={600} autoFocus aria-label="Communication address" aria-invalid={!!err}
        placeholder="House or flat number, street, area, city, state and PIN code"
        onChange={(e) => { setText(e.target.value); setErr(''); }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation?.(); setEdit(false); setErr(''); } }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" className="pdx-btn on" onClick={save} disabled={busy || same}>{busy ? 'Saving...' : 'Save address'}</button>
        <button type="button" className="pdx-btn" onClick={() => { setEdit(false); setErr(''); }} disabled={busy}>Cancel</button>
        <span className="pdx-sub" style={{ marginLeft: 'auto' }}>{clean.length}/500</span>
      </div>
      {clean === '' && !same && <p className="pdx-sub" style={{ marginTop: 6 }}>Saving an empty box removes the address.</p>}
      {err && <p role="alert" className="pdx-err" style={{ marginTop: 8 }}>{err}</p>}
    </div>
  );
}

// The content of the popup: every detail of one devotee, each with its own label
function Panel({ id, onPick, onAddress }: { id: string; onPick: (v: string) => void; onAddress: (id: string, v: string) => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    setData(null); setErr('');
    (async () => {
      try {
        const res = await fetch(`${DV}/${encodeURIComponent(id)}`, { headers: authHeader(), cache: 'no-store' });
        const j = await readJson(res);
        if (!res.ok) throw new Error(failText(j, `Could not load this devotee (${res.status}).`));
        if (live) setData(j);
      } catch (e: any) { if (live) setErr(e?.message || 'Could not load this devotee.'); }
    })();
    return () => { live = false; };
  }, [id]);

  if (err) return <p role="alert" className="pdx-err">{err}</p>;
  if (!data) return <p className="pdx-sub">Loading the devotee...</p>;
  const d = data.devotee;
  const mix = (Object.keys(SOURCE_LABEL) as (keyof Totals)[]);
  return (
    <div>
      <Section title="Personal details">
        <div className="dvm-grid">
          <Field label="Devotee name">{d.name || <Dash />}</Field>
          <Field label="Devotee ID"><b style={{ letterSpacing: '.04em' }}>{d.code || d.id}</b></Field>
          <Field label="Residency">{d.residency === 'nri' ? 'NRI (lives outside India)' : 'Indian resident'}</Field>
          <Field label="Joined on">{csvDate(d.joined_at)}</Field>
          <Field label="Last active">{when(d.last_active)}</Field>
          <Field label="Last paid on">{d.last_paid ? csvDate(d.last_paid) : <span className="dvm-none">Never paid</span>}</Field>
        </div>
      </Section>

      <Section title="Contact and sign-in">
        <div className="dvm-grid">
          <Field label="Mobile number">{d.phone ? (telHref(d.phone) ? <a className="pdx-link" style={{ padding: 0 }} href={telHref(d.phone)}>{d.phone}</a> : d.phone) : <Dash />}</Field>
          <Field label="Email address"><span style={{ wordBreak: 'break-all' }}>{d.email || <Dash />}</span></Field>
          <Field label="Email status">{d.email ? <span className="pdx-pill"><i style={{ background: d.verified ? STATUS_COLOR.PAID : STATUS_COLOR.PENDING }} />{d.verified ? 'Verified' : 'Not verified'}</span> : <Dash />}</Field>
          <Field label="Signs in with">{d.login === 'google' ? 'Google account' : 'Email and password'}</Field>
        </div>
      </Section>

      <Section title="Address">
        <div className="dvm-grid">
          <Field label="City">{d.city || <Dash />}</Field>
          <Field label="State">{d.state || <Dash />}</Field>
          <Field label="Communication address" wide><AddressEditor id={d.id} value={d.comm_address} onSaved={(v) => { setData((x) => (x ? { ...x, devotee: { ...x.devotee, comm_address: v || null } } : x)); onAddress(d.id, v); }} /></Field>
          <Field label="Permanent address" wide>{d.perm_address || <Dash />}</Field>
        </div>
      </Section>

      <Section title="Giving summary" note="Money counted only for paid payments.">
        <div className="dvm-grid">
          <Field label="Total given"><b style={{ fontSize: 18 }}>{inr(d.pay_total)}</b></Field>
          <Field label="Number of paid payments">{d.pay_count}</Field>
          <Field label="Family members saved">{d.family_count}</Field>
          <Field label="PAN given for 80G">{d.has_pan ? 'Yes' : 'No'}</Field>
        </div>
        <div className="dvm-grid" style={{ marginTop: 10 }}>
          {mix.map((k) => (
            <Field key={k} label={`${SOURCE_LABEL[k]} total`}>
              <span className="pdx-pill"><i style={{ background: SOURCE_COLOR[k] }} />{inr(d.totals[k])}</span>
            </Field>
          ))}
        </div>
        <PanBox id={d.id} />
      </Section>

      <Section title={`Family members for sankalpam (${data.family.length})`}>
        {data.family.length === 0 ? <p className="pdx-sub">No family members saved.</p> : (
          <div className="dvm-tw">
            <table className="dvm-table" style={{ minWidth: 560 }}>
              <thead><tr>{['No.', 'Name', 'Relation', 'Gothram', 'Nakshatram', 'Rasi'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>
                {data.family.map((m, i) => (
                  <tr key={m.id}>
                    <td>{i + 1}</td>
                    <td>{[m.title, m.name].filter(Boolean).join(' ') || '-'}</td>
                    <td>{m.relation || '-'}</td>
                    <td>{m.gothram || '-'}</td>
                    <td>{m.nakshathiram || '-'}</td>
                    <td>{m.rasi || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`Payments and bookings (${data.payments.length})`}>
        {data.payments.length === 0 ? <p className="pdx-sub">No payments yet.</p> : (
          <div className="dvm-tw">
            <table className="dvm-table" style={{ minWidth: 720 }}>
              <thead><tr>{['Date and time', 'Type', 'Paid for', 'Amount', 'Status', 'Receipt no', 'Transaction id'].map((h) => <th key={h} scope="col" style={{ textAlign: h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
              <tbody>
                {data.payments.map((p, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{when(p.paid_at)}</td>
                    <td><span className="pdx-pill"><i style={{ background: SOURCE_COLOR[p.source] }} />{SOURCE_LABEL[p.source] || p.source}</span></td>
                    <td>{p.item}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{inr(p.amount)}</td>
                    <td><span className="pdx-pill"><i style={{ background: STATUS_COLOR[p.status] }} />{STATUS_LABEL[p.status]}</span></td>
                    <td>{p.receipt_no || '-'}</td>
                    <td style={{ wordBreak: 'break-all', fontSize: 12 }}>{p.payment_id || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {data.camps.length > 0 && (
        <Section title={`Camp registrations (${data.camps.length})`}>
          <div className="dvm-tw">
            <table className="dvm-table" style={{ minWidth: 640 }}>
              <thead><tr>{['Camp', 'Registered on', 'Adults', 'Children', 'Registration', 'Payment', 'Fee'].map((h) => <th key={h} scope="col" style={{ textAlign: h === 'Fee' ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
              <tbody>
                {data.camps.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>{c.title}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{dateLabel(c.registered_at.slice(0, 10))}</td>
                    <td>{c.adults}</td>
                    <td>{c.children}</td>
                    <td style={{ textTransform: 'capitalize' }}>{c.status.toLowerCase()}</td>
                    <td>{c.amount > 0 ? (STATUS_LABEL[c.payment_status] || c.payment_status.toLowerCase()) : 'No fee'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{c.amount > 0 ? inr(c.amount) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <div style={{ marginTop: 4 }}>
        <button type="button" className="pdx-btn" onClick={() => onPick(d.code || d.id)}>Show only this devotee in the list</button>
      </div>
    </div>
  );
}

const MODAL_CSS = `
.dvm-back{position:fixed;inset:0;z-index:1000;background:rgba(40,12,12,.55);display:flex;align-items:center;justify-content:center;padding:20px}
.dvm{background:#fff;color:#1f1f1f;width:min(920px,100%);max-height:min(92vh,100%);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}
.dvm-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #f0e2c8;background:#fff8ec}
.dvm-body{padding:16px 18px 20px;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.dvm-sec{border:1px solid #f0e2c8;border-radius:12px;padding:14px 16px;margin-bottom:14px;background:#fff}
.dvm-sec>h3{font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#7a1c1c;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #fde7b0}
.dvm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px 18px}
.dvm-f{min-width:0}
.dvm-l{display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#7a6a5a;margin-bottom:3px}
.dvm-v{font-size:15px;font-weight:600;color:#1f1f1f;word-break:break-word}
.dvm-none{font-weight:400;color:#9a8f85;font-style:italic}
.dvm-tw{overflow-x:auto;border:1px solid #f0e2c8;border-radius:10px}
.dvm-table{width:100%;border-collapse:collapse;font-size:13px}
.dvm-table th{background:#7a1c1c;color:#fff;text-align:left;padding:8px 10px;font-weight:700;white-space:nowrap}
.dvm-table td{padding:8px 10px;border-top:1px solid #f0e2c8;vertical-align:top}
.dvm-table tbody tr:nth-child(even){background:#fffaf4}
.dvm-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 18px;border-top:1px solid #f0e2c8;background:#fff8ec;flex-wrap:wrap}
@media (max-width:640px){.dvm-back{padding:0;align-items:flex-end}.dvm{width:100%;max-height:96vh;border-radius:16px 16px 0 0}}
`;

// The popup that shows one devotee: profile, PAN on request, family and every payment
function DevoteeModal({ d, index, count, onClose, onMove, onPick, onAddress }: { d: Devotee; index: number; count: number; onClose: () => void; onMove: (step: number) => void; onPick: (v: string) => void; onAddress: (id: string, v: string) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // the page behind does not scroll
    closeRef.current?.focus();
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [d.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key === 'Tab') { // keep the focus inside the popup
        const box = document.getElementById('dvm-box');
        const items = box ? Array.from(box.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],select,input,[tabindex]:not([tabindex="-1"])')) : [];
        if (items.length === 0) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dvm-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div id="dvm-box" className="dvm" role="dialog" aria-modal="true" aria-labelledby="dvm-title">
        <div className="dvm-head">
          <Avatar d={d} size={44} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="dvm-title" style={{ fontSize: 18, fontWeight: 800, color: '#7a1c1c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name || 'No name'}</h2>
            <p className="pdx-sub">{d.code || d.id} · {[d.city, d.state].filter(Boolean).join(', ') || (d.residency === 'nri' ? 'NRI' : 'Indian resident')} · joined {csvDate(d.joined_at)}</p>
          </div>
          <button ref={closeRef} type="button" className="pdx-btn" onClick={onClose} aria-label="Close devotee details">Close</button>
        </div>
        <div className="dvm-body" ref={bodyRef}>
          <Panel id={d.id} onPick={onPick} onAddress={onAddress} />
        </div>
        <div className="dvm-foot">
          <button type="button" className="pdx-btn" disabled={index <= 0} onClick={() => onMove(-1)}>Previous devotee</button>
          <span className="pdx-sub">{index >= 0 ? `${index + 1} of ${count} on this page` : ''}</span>
          <button type="button" className="pdx-btn" disabled={index < 0 || index >= count - 1} onClick={() => onMove(1)}>Next devotee</button>
        </div>
      </div>
    </div>
  );
}

export default function DevoteeDetails() {
  const { notice, flash, clear } = useFlash();
  const [preset, setPreset] = useState<Preset>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [residency, setResidency] = useState('');
  const [state, setState] = useState('');
  const [verified, setVerified] = useState('');
  const [paid, setPaid] = useState('');
  const [login, setLogin] = useState('');
  const [sort, setSort] = useState('newest');
  const [q, setQ] = useState('');
  const [qNow, setQNow] = useState('');
  const [page, setPage] = useState(1);
  const [out, setOut] = useState<ListOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [view, setView] = useState<Devotee | null>(null); // the devotee shown in the popup
  const [limit, setLimit] = useState(25);
  const lastBtn = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const thisFy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // Indian financial year starts in April
  const [fy, setFy] = useState(thisFy);
  const [busy80, setBusy80] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => { setQNow(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (residency) p.set('residency', residency);
    if (state) p.set('state', state);
    if (verified) p.set('verified', verified);
    if (paid) p.set('paid', paid);
    if (login) p.set('login', login);
    if (qNow) p.set('q', qNow);
    return p;
  }, [from, to, residency, state, verified, paid, login, qNow]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setErr('');
    try {
      const p = qs(); p.set('page', String(page)); p.set('limit', String(limit)); p.set('sort', sort);
      const res = await fetch(`${DV}/list?${p}`, { headers: authHeader(), cache: 'no-store' });
      const j = await readJson(res);
      if (!res.ok) throw new Error(failText(j, `Could not load the devotees (${res.status}).`));
      if (mine === seq.current) setOut(j);
    } catch (e: any) {
      if (mine === seq.current) setErr(`${e?.message || 'Could not load the devotees.'} [${DV}]`);
    } finally { if (mine === seq.current) setLoading(false); }
  }, [qs, page, sort, limit]);
  useEffect(() => { load(); }, [load]);

  function choose(p: Preset) {
    setPreset(p); setPage(1);
    if (p !== 'custom') { const r = rangeOf(p); setFrom(r.from); setTo(r.to); }
  }

  async function download() {
    setBusy(true);
    try {
      const p = qs(); p.set('sort', sort);
      const res = await fetch(`${DV}/export?${p}`, { headers: authHeader() });
      if (!res.ok) { flash('err', failText(await readJson(res), 'Could not make the file.')); return; }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `devotees-${ymd(new Date())}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy(false); }
  }

  async function download80g() {
    setBusy80(true);
    try {
      const p = new URLSearchParams({ from: `${fy}-04-01`, to: `${fy + 1}-03-31` });
      const res = await fetch(`${G80}?${p}`, { headers: authHeader() });
      if (!res.ok) { flash('err', failText(await readJson(res), 'Could not make the 80G file.')); return; }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `80g-donations-${fy}-${String(fy + 1).slice(2)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { flash('err', 'Network error. Please try again.'); } finally { setBusy80(false); }
  }

  const rows = out?.items || [];
  const total = out?.total || 0;
  const pages = Math.max(1, Math.ceil(total / limit));
  const showFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showTo = Math.min(total, page * limit);
  const viewIndex = view ? rows.findIndex((x) => x.id === view.id) : -1;
  const closeView = () => { setView(null); setTimeout(() => lastBtn.current?.focus(), 0); };
  const filtered = !!(residency || state || verified || paid || login || qNow);
  const periodText = from || to ? `${from ? dateLabel(from) : 'the start'} to ${to ? dateLabel(to) : 'today'}` : 'all dates';
  const t = out?.totals;

  return (
    <div className="dc">
      <style>{CSS}</style>
      <style>{PDX_CSS}</style>
      <style>{MODAL_CSS}</style>
      <Notice notice={notice} onClear={clear} />
      <div className="pdx">
        <div className="pdx-top">
          <div>
            <h1 className="pdx-title">Devotee details</h1>
            <p className="pdx-sub" style={{ fontSize: 14 }}>Every devotee with contact details, family members for sankalpam, and everything they have paid. Press Details to open a devotee.</p>
          </div>
          <button type="button" className="pdx-btn" onClick={download} disabled={busy || loading || total === 0}>{busy ? 'Preparing...' : 'Download CSV'}</button>
        </div>

        <div className="pdx-card" style={{ marginBottom: 14 }}>
          <div className="pdx-head" style={{ marginBottom: 0 }}>
            <div><h3>80G donation file</h3><p className="pdx-sub">Every paid donation of a financial year with the donor name, PAN and address, ready for 80G receipts and the yearly return. Admins only; each download is recorded.</p></div>
            <div className="pdx-row">
              <div>
                <label className="pdx-lbl" htmlFor="fy">Financial year</label>
                <select id="fy" className="pdx-inp" value={fy} onChange={(e) => setFy(Number(e.target.value))}>
                  {[0, 1, 2, 3].map((i) => <option key={i} value={thisFy - i}>{`April ${thisFy - i} to March ${thisFy - i + 1}`}</option>)}
                </select>
              </div>
              <button type="button" className="pdx-btn on" onClick={download80g} disabled={busy80}>{busy80 ? 'Preparing...' : 'Download 80G file'}</button>
            </div>
          </div>
        </div>

        <div className="pdx-card" style={{ marginBottom: 14 }}>
          <div className="pdx-row" style={{ marginBottom: 12 }} role="group" aria-label="Joined">
            {([['all', 'All time'], ['month', 'Joined this month'], ['30', 'Last 30 days'], ['year', 'This year'], ['custom', 'Choose dates']] as [Preset, string][]).map(([id, label]) => (
              <button key={id} type="button" className={`pdx-btn${preset === id ? ' on' : ''}`} aria-pressed={preset === id} onClick={() => choose(id)}>{label}</button>
            ))}
          </div>
          <div className="pdx-row">
            <div><label className="pdx-lbl" htmlFor="df">Joined from</label><input id="df" className="pdx-inp" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPreset('custom'); setPage(1); }} /></div>
            <div><label className="pdx-lbl" htmlFor="dt">Joined to</label><input id="dt" className="pdx-inp" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPreset('custom'); setPage(1); }} /></div>
            <div>
              <label className="pdx-lbl" htmlFor="dr">Residency</label>
              <select id="dr" className="pdx-inp" value={residency} onChange={(e) => { setResidency(e.target.value); setPage(1); }}>
                <option value="">Indian and NRI</option><option value="indian">Indian resident</option><option value="nri">NRI</option>
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="ds">State</label>
              <select id="ds" className="pdx-inp" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}>
                <option value="">All states</option>
                {(out?.states || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="dv">Email</label>
              <select id="dv" className="pdx-inp" value={verified} onChange={(e) => { setVerified(e.target.value); setPage(1); }}>
                <option value="">Verified or not</option><option value="yes">Verified</option><option value="no">Not verified</option>
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="dp">Payments</label>
              <select id="dp" className="pdx-inp" value={paid} onChange={(e) => { setPaid(e.target.value); setPage(1); }}>
                <option value="">Paid or never paid</option><option value="yes">Has paid</option><option value="no">Never paid</option>
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="dl">Signs in with</label>
              <select id="dl" className="pdx-inp" value={login} onChange={(e) => { setLogin(e.target.value); setPage(1); }}>
                <option value="">Google or password</option><option value="google">Google</option><option value="password">Email and password</option>
              </select>
            </div>
            <div>
              <label className="pdx-lbl" htmlFor="do">Sort by</label>
              <select id="do" className="pdx-inp" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label className="pdx-lbl" htmlFor="dq">Search devotees</label>
              <input id="dq" className="pdx-inp" style={{ width: '100%' }} value={q} maxLength={80} placeholder="Name, phone, email, city, state or devotee ID (SDSS00001)" onChange={(e) => setQ(e.target.value)} />
            </div>
            {filtered && <button type="button" className="pdx-btn" onClick={() => { setResidency(''); setState(''); setVerified(''); setPaid(''); setLogin(''); setQ(''); setQNow(''); setPage(1); }}>Clear filters</button>}
          </div>
        </div>

        {err ? (
          <div role="alert" className="pdx-err">{err} <button type="button" className="pdx-link" onClick={load}>Try again</button></div>
        ) : (
          <div className={loading && out ? 'pdx-busy' : ''} aria-busy={loading}>
            <p className="pdx-sub" style={{ margin: '0 2px 8px' }}>Joined: {periodText}.</p>
            <div className="pdx-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))' }}>
              <Stat label="Devotees" value={t ? String(t.devotees) : '...'} sub={filtered || from || to ? 'matching the filters' : 'registered in all'} color="#7a1c1c" />
              <Stat label="Email verified" value={t ? String(t.verified) : '...'} sub={t && t.devotees ? `${Math.round((t.verified / t.devotees) * 100)}% of these devotees` : ''} color={STATUS_COLOR.PAID} />
              <Stat label="Have paid" value={t ? String(t.paying) : '...'} sub={t && t.devotees ? `${Math.round((t.paying / t.devotees) * 100)}% paid at least once` : ''} color="#ea580c" />
              <Stat label="Total given" value={t ? inr(t.paid) : '...'} sub={t && t.paying ? `${inr(Math.round(t.paid / t.paying))} on average each` : 'paid payments only'} />
            </div>

            <section className="pdx-card" aria-label="Devotees" style={{ marginTop: 14 }}>
              <div className="pdx-head">
                <h3>Devotees</h3>
                <span className="pdx-sub">{loading ? 'Loading...' : `${total} found`}</span>
              </div>
              <div className="pdx-tablewrap">
                <table style={{ minWidth: 980 }}>
                  <thead>
                    <tr>{['Devotee', 'Contact', 'Place', 'Joined', 'Family', 'Given', 'Last active', ''].map((h, i) => <th key={i} scope="col" style={{ textAlign: h === 'Given' ? 'right' : 'left' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {!loading && rows.length === 0 && <tr><td colSpan={8} className="pdx-empty">{filtered || from || to ? 'No devotees match these filters.' : 'No devotees yet.'}</td></tr>}
                    {rows.map((r) => {
                      const isOpen = view?.id === r.id;
                      return (
                        <React.Fragment key={r.id}>
                          <tr className={isOpen ? 'open' : ''}>
                            <td style={{ minWidth: 190 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Avatar d={r} />
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontWeight: 700 }}>{r.name || <span className="pdx-mut">No name</span>}</p>
                                  <p className="pdx-sub">{r.code || r.id} · {r.residency === 'nri' ? 'NRI' : 'Indian resident'}</p>
                                </div>
                              </div>
                            </td>
                            <td style={{ minWidth: 170 }}>
                              <p>{r.phone ? (telHref(r.phone) ? <a className="pdx-link" style={{ padding: 0 }} href={telHref(r.phone)}>{r.phone}</a> : r.phone) : <span className="pdx-mut">No phone</span>}</p>
                              <p className="pdx-sub" style={{ wordBreak: 'break-all' }}>{r.email} <span className="pdx-pill" style={{ marginLeft: 4 }}><i style={{ background: r.verified ? STATUS_COLOR.PAID : STATUS_COLOR.PENDING }} />{r.verified ? 'Verified' : 'Not verified'}</span></p>
                            </td>
                            <td>{[r.city, r.state].filter(Boolean).join(', ') || <span className="pdx-mut">-</span>}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{csvDate(r.joined_at)}</td>
                            <td>{r.family_count || <span className="pdx-mut">0</span>}</td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <b>{r.pay_total > 0 ? inr(r.pay_total) : '-'}</b>
                              {r.pay_count > 0 && <p className="pdx-sub">{r.pay_count} payment{r.pay_count === 1 ? '' : 's'}</p>}
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{when(r.last_active)}</td>
                            <td><button type="button" className="pdx-btn" aria-haspopup="dialog" onClick={(e) => { lastBtn.current = e.currentTarget; setView(r); }}>Details</button></td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Always shown: the count, the pages, and how many rows to a page */}
              <div className="pdx-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 14 }}>{loading ? 'Loading...' : total === 0 ? 'Showing 0 devotees' : `Showing ${showFrom}-${showTo} of ${total} devotee${total === 1 ? '' : 's'}`}</span>
                <div className="pdx-row" role="navigation" aria-label="Pages" style={{ alignItems: 'center' }}>
                  <button type="button" className="pdx-btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</button>
                  {pageList(page, pages).map((n, i) => n === '...'
                    ? <span key={`gap${i}`} style={{ padding: '0 4px' }}>...</span>
                    : <button key={n} type="button" className={`pdx-btn${n === page ? ' on' : ''}`} aria-current={n === page ? 'page' : undefined} disabled={loading} onClick={() => setPage(n)}>{n}</button>)}
                  <button type="button" className="pdx-btn" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Next</button>
                </div>
                <div className="pdx-row" style={{ alignItems: 'center' }}>
                  <label className="pdx-lbl" htmlFor="dpg" style={{ margin: 0 }}>Go to page</label>
                  <input id="dpg" className="pdx-inp" type="number" min={1} max={pages} style={{ width: 80 }} placeholder={String(page)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { const n = Math.min(pages, Math.max(1, Number((e.target as HTMLInputElement).value) || 1)); setPage(n); (e.target as HTMLInputElement).value = ''; } }} />
                  <label className="pdx-lbl" htmlFor="dl2" style={{ margin: 0 }}>Rows per page</label>
                  <select id="dl2" className="pdx-inp" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                    {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
      {view && (
        <DevoteeModal d={view} index={viewIndex} count={rows.length} onClose={closeView}
          onMove={(step) => { const n = rows[viewIndex + step]; if (n) setView(n); }}
          onPick={(id) => { setQ(id); setQNow(id); setPage(1); setView(null); }}
          onAddress={(id, v) => {
            const next = (x: Devotee) => (x.id === id ? { ...x, comm_address: v || null } : x);
            setOut((o) => (o ? { ...o, items: o.items.map(next) } : o));
            setView((x) => (x ? next(x) : x));
          }} />
      )}
    </div>
  );
}