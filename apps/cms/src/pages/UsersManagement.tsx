import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ALL_PAGES, PAGE_GROUPS, ROLE_HELP, ROLE_LABEL, isAdminRole, roleDefaultPages } from '../lib/access';

const API = `${API_BASE_URL}/users`;

interface Row {
  id: string; email: string; phone: string | null; full_name: string; role: string; is_active: number | boolean;
  created_at: string; updated_at: string;
  page_access?: string[] | null; // the pages ticked for this login; null = the pages of its role
}

const ROLE_OPTIONS = ['superadmin', 'admin', 'website', 'payments', 'registration', 'sales'] as const;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtD = (s: string) => {
  const d = String(s || '').slice(0, 10);
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${Number(dd)} ${MON[Number(m) - 1] || ''} ${y}`;
};
const active = (r: Row) => Number(r.is_active) !== 0;

// The same list of pages, in sidebar order, so two lists can be compared
const ordered = (l: string[]) => ALL_PAGES.filter((s) => l.includes(s));
const sameList = (a: string[], b: string[]) => ordered(a).join('|') === ordered(b).join('|');
const TOTAL_PAGES = ALL_PAGES.length;

// A checkbox that can show "some of the group is ticked"
function Tick({ checked, some, onChange, label, strong }: { checked: boolean; some?: boolean; onChange: (v: boolean) => void; label: string; strong?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!some && !checked; }, [some, checked]);
  return (
    <label className="tick" style={strong ? { fontWeight: 800 } : undefined}>
      <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// A random password with letters and numbers, without look-alike characters
function makePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += chars[b % chars.length];
  return `${out}7a`;
}

const CSS = `
.um{--p:#7a1c1c;--pd:#5e1414;--ink:#1f2937;--mut:#6b7280;--line:#e5e7eb;font-size:13px;color:var(--ink);}
.um *{box-sizing:border-box;}
.um p,.um h1,.um h2,.um td,.um th,.um label,.um span,.um small{color:inherit !important;background:transparent !important;}
.um .mut{color:var(--mut) !important;}
.um .head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;}
.um .title{font-size:22px;font-weight:800;line-height:1.2;}
.um .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;line-height:1.2;cursor:pointer;border:1px solid #cfd4dc !important;background:#fff !important;color:var(--ink) !important;white-space:nowrap;}
.um .btn:hover{background:#f3f4f6 !important;}
.um .btn:disabled{opacity:.55;cursor:not-allowed;}
.um .btn.primary{background:var(--p) !important;border-color:var(--p) !important;color:#fff !important;}
.um .btn.primary:hover{background:var(--pd) !important;}
.um .btn.dng{color:#b91c1c !important;border-color:#fca5a5 !important;}
.um .btn.dng:hover{background:#fef2f2 !important;}
.um .btn.dfill{background:#dc2626 !important;border-color:#dc2626 !important;color:#fff !important;}
.um .btn.sm{padding:5px 10px;font-size:12px;border-radius:6px;}
.um .btn.link{border:none !important;background:transparent !important;padding:0;color:var(--p) !important;font-weight:700;}
.um .btn.link:hover{background:transparent !important;text-decoration:underline;}
.um .card{background:#fff !important;border:1px solid var(--line);border-radius:10px;}
.um .toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);}
.um .tblwrap{overflow-x:auto;}
.um .tbl{width:100%;border-collapse:collapse;min-width:900px;}
.um .tbl th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--mut) !important;background:#f9fafb !important;border-bottom:1px solid var(--line);white-space:nowrap;}
.um .tbl td{padding:12px 14px;border-bottom:1px solid #f0f1f3;vertical-align:middle;}
.um .tbl tr:hover td{background:#fafafa !important;}
.um .pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;border:1px solid transparent;}
.um .pill.role{background:#ede9fe !important;color:#5b21b6 !important;border-color:#c4b5fd;}
.um .pill.super{background:#fef3c7 !important;color:#92400e !important;border-color:#fcd34d;}
.um .pill.on{background:#dcfce7 !important;color:#166534 !important;border-color:#86efac;}
.um .pill.off{background:#f1f5f9 !important;color:#64748b !important;border-color:#e2e8f0;}
.um .acts{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;}
.um .empty{padding:48px 16px;text-align:center;}
.um .skel{height:44px;margin:10px 14px;border-radius:8px;background:linear-gradient(90deg,#f1f2f4 25%,#e7e9ec 37%,#f1f2f4 63%);background-size:400% 100%;animation:umsk 1.2s ease infinite;}
@keyframes umsk{0%{background-position:100% 50%}100%{background-position:0 50%}}
.um .ov{position:fixed;inset:0;z-index:70;display:flex;justify-content:center;align-items:center;padding:16px;background:rgba(17,24,39,.5);}
.um .modal{width:100%;max-width:560px;max-height:94vh;overflow-y:auto;background:#fff !important;border-radius:12px;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.25);}
.um .lbl{display:block;font-size:12px;font-weight:700;margin-bottom:4px;}
.um .inp{width:100%;border:1px solid #cfd4dc !important;border-radius:8px;padding:9px 11px;font-size:14px;background:#fff !important;color:var(--ink) !important;}
.um .inp:focus{outline:2px solid #d97777;outline-offset:0;border-color:var(--p) !important;}
.um .inp.bad{border-color:#ef4444 !important;background:#fef2f2 !important;}
.um .inp:disabled{background:#f3f4f6 !important;color:#9ca3af !important;}
.um .fld{margin-bottom:14px;}
.um .hint{font-size:11.5px;margin-top:4px;}
.um .err{display:block;font-size:12px;font-weight:600;margin-top:4px;color:#b91c1c !important;}
.um .alert{border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:14px;}
.um .alert.ok{background:#dcfce7 !important;color:#166534 !important;border:1px solid #86efac;}
.um .alert.bad{background:#fee2e2 !important;color:#991b1b !important;border:1px solid #fca5a5;}
.um .alert.info{background:#eff6ff !important;color:#1e40af !important;border:1px solid #bfdbfe;}
.um .pwrow{display:flex;gap:8px;}
.um .pages{border:1px solid var(--line);border-radius:10px;padding:12px;}
.um .pages-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;}
.um .pages-scroll{max-height:290px;overflow-y:auto;padding-right:4px;}
.um .pgroup{padding:8px 0;border-top:1px solid #f0f1f3;}
.um .pgroup:first-child{border-top:none;}
.um .pgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 12px;margin:4px 0 0 24px;}
.um .tick{display:flex;align-items:center;gap:8px;padding:3px 0;cursor:pointer;font-size:13px;}
.um .pill.custom{background:#e0f2fe !important;color:#075985 !important;border-color:#bae6fd;}
.um .pill.dflt{background:#f1f5f9 !important;color:#475569 !important;border-color:#e2e8f0;}
@media (max-width:520px){.um .pgrid{grid-template-columns:1fr;}}
.um .pwrow .inp{flex:1;min-width:0;}
.um input[type=checkbox]{accent-color:var(--p);width:16px;height:16px;cursor:pointer;flex:none;}
`;

type FormState = { full_name: string; email: string; phone: string; role: string; password: string; is_active: boolean; pages: string[] };
const blank: FormState = { full_name: '', email: '', phone: '', role: 'website', password: '', is_active: true, pages: roleDefaultPages('website') };

export default function UsersManagement() {
  const { user: me, token } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [q, setQ] = useState('');

  const [editing, setEditing] = useState<Row | null>(null); // null with open = adding
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(blank);
  const [showPw, setShowPw] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pagesTouched, setPagesTouched] = useState(false); // once pages are ticked by hand, changing the role no longer resets them

  const [pwFor, setPwFor] = useState<Row | null>(null);
  const [newPw, setNewPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const [delAsk, setDelAsk] = useState<Row | null>(null);
  const [delErr, setDelErr] = useState('');
  const [deleting, setDeleting] = useState(false);

  const flash = useCallback((tone: 'ok' | 'err', text: string) => {
    setNotice({ tone, text });
    if (tone === 'ok') setTimeout(() => setNotice(null), 4000);
  }, []);

  const call = useCallback(async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token || ''}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    let data: any = {};
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      const e: any = new Error(data.message || (res.status === 403 ? 'Only a super admin can manage logins.' : `The server returned an error (${res.status}).`));
      e.field = data.field;
      throw e;
    }
    return data;
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true); setLoadErr('');
    try {
      const d = await call('GET', '');
      setRows(d.users || []);
    } catch (e: any) {
      setLoadErr(e?.message || 'Could not load the users.');
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => !t || `${r.full_name} ${r.email} ${r.phone || ''} ${ROLE_LABEL[r.role] || r.role}`.toLowerCase().includes(t));
  }, [rows, q]);

  const activeSupers = rows.filter((r) => r.role === 'superadmin' && active(r)).length;

  function openAdd() {
    setEditing(null); setForm(blank); setPagesTouched(false); setErrs({}); setShowPw(false); setOpen(true);
  }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({ full_name: r.full_name || '', email: r.email, phone: r.phone || '', role: r.role, password: '', is_active: active(r), pages: r.page_access?.length ? r.page_access : roleDefaultPages(r.role) });
    setPagesTouched(!!r.page_access?.length);
    setErrs({}); setShowPw(false); setOpen(true);
  }
  const set = (k: keyof FormState, v: string | boolean) => { setForm((f) => ({ ...f, [k]: v })); setErrs((e) => ({ ...e, [k]: '', form: '' })); };
  const pickRole = (role: string) => {
    setForm((f) => ({ ...f, role, pages: pagesTouched ? f.pages : roleDefaultPages(role) }));
    setErrs((e) => ({ ...e, role: '', form: '' }));
  };
  const setPages = (pages: string[]) => { setPagesTouched(true); setForm((f) => ({ ...f, pages: ordered(pages) })); setErrs((e) => ({ ...e, page_access: '', form: '' })); };
  const toggleSlugs = (slugs: string[], on: boolean) => setPages(on ? Array.from(new Set([...form.pages, ...slugs])) : form.pages.filter((s) => !slugs.includes(s)));
  const fullAccess = isAdminRole(form.role);
  // Same as the role's own pages: nothing is stored, so later changes to the role's pages apply by themselves
  const pageValue = (): string[] | null => (fullAccess || sameList(form.pages, roleDefaultPages(form.role)) ? null : ordered(form.pages));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const x: Record<string, string> = {};
    if (form.full_name.trim().length < 2) x.full_name = 'Enter the full name';
    if (!editing) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) x.email = 'Enter a valid email address';
      if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) x.password = 'At least 8 characters, with a letter and a number';
    } else if (form.password && (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))) {
      x.password = 'At least 8 characters, with a letter and a number';
    }
    if (!fullAccess && form.pages.length === 0) x.page_access = 'Tick at least one page';
    setErrs(x);
    if (Object.keys(x).length) return;

    setSaving(true);
    try {
      if (editing) {
        const body: Record<string, unknown> = { full_name: form.full_name.trim(), phone: form.phone.trim() };
        if (form.role !== editing.role) body.role = form.role;
        if (form.is_active !== active(editing)) body.is_active = form.is_active;
        if (form.password) body.password = form.password;
        const pv = pageValue();
        if (JSON.stringify(pv) !== JSON.stringify(editing.page_access?.length ? editing.page_access : null)) body.page_access = pv;
        await call('PATCH', `/${editing.id}`, body);
        flash('ok', 'Login updated.');
      } else {
        await call('POST', '', { full_name: form.full_name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(), role: form.role, password: form.password, page_access: pageValue() });
        flash('ok', 'Login created. Give the person their email and password.');
      }
      setOpen(false);
      load();
    } catch (err: any) {
      setErrs(err.field ? { [err.field]: err.message } : { form: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: Row) {
    try {
      await call('PATCH', `/${r.id}`, { is_active: !active(r) });
      flash('ok', active(r) ? `${r.full_name || r.email} is now deactivated.` : `${r.full_name || r.email} is active again.`);
      load();
    } catch (e: any) {
      flash('err', e?.message || 'Could not change the status.');
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwFor || pwBusy) return;
    if (newPw.length < 8 || !/[A-Za-z]/.test(newPw) || !/\d/.test(newPw)) { setPwErr('At least 8 characters, with a letter and a number'); return; }
    setPwBusy(true); setPwErr('');
    try {
      await call('PATCH', `/${pwFor.id}`, { password: newPw });
      flash('ok', `Password changed for ${pwFor.full_name || pwFor.email}.`);
      setPwFor(null); setNewPw('');
    } catch (err: any) {
      setPwErr(err.message);
    } finally {
      setPwBusy(false);
    }
  }

  async function doDelete() {
    if (!delAsk) return;
    setDeleting(true); setDelErr('');
    try {
      await call('DELETE', `/${delAsk.id}`);
      flash('ok', 'Login deleted.');
      setDelAsk(null);
      load();
    } catch (e: any) {
      setDelErr(e.message);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (delAsk) { if (!deleting) setDelAsk(null); }
      else if (pwFor) { if (!pwBusy) setPwFor(null); }
      else if (open) { if (!saving) setOpen(false); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [delAsk, deleting, pwFor, pwBusy, open, saving]);

  const isSelf = (r: Row) => me?.id === r.id;
  const isLastSuper = (r: Row) => r.role === 'superadmin' && active(r) && activeSupers <= 1;

  return (
    <div className="um">
      <style>{CSS}</style>

      <div className="head">
        <div>
          <h1 className="title">Users</h1>
          <p className="mut" style={{ marginTop: 2 }}>Add, change and remove the logins that can use this portal. Each role sees only its own pages.</p>
        </div>
        <button type="button" className="btn primary" onClick={openAdd}>+ New login</button>
      </div>

      {notice && (
        <div role={notice.tone === 'err' ? 'alert' : 'status'} className={`alert ${notice.tone === 'ok' ? 'ok' : 'bad'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>{notice.text}</span>
          <button type="button" className="btn sm" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}

      <section className="card">
        <div className="toolbar">
          <input className="inp" style={{ maxWidth: 320 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or role" aria-label="Search users" />
          <span className="mut">{shown.length} login{shown.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? (
          <div>{[0, 1, 2].map((i) => <div key={i} className="skel" />)}</div>
        ) : loadErr ? (
          <div role="alert" className="empty">
            <p style={{ fontSize: 15, fontWeight: 800 }}>The users could not be loaded</p>
            <p className="mut" style={{ marginTop: 4 }}>{loadErr}</p>
            <div style={{ marginTop: 16 }}><button type="button" className="btn" onClick={load}>Try again</button></div>
          </div>
        ) : shown.length === 0 ? (
          <p className="empty mut">{rows.length === 0 ? 'No logins yet.' : 'No login matches that search.'}</p>
        ) : (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr><th>Name</th><th>Role</th><th>Pages</th><th>Mobile</th><th>Status</th><th>Created</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.full_name || '-'}</strong>{isSelf(r) && <span className="mut"> (you)</span>}
                      <span className="mut" style={{ display: 'block', fontSize: 12 }}>{r.email}</span>
                    </td>
                    <td><span className={`pill ${r.role === 'superadmin' ? 'super' : 'role'}`}>{ROLE_LABEL[r.role] || r.role}</span></td>
                    <td>
                      {isAdminRole(r.role)
                        ? <span className="pill dflt">All pages</span>
                        : r.page_access?.length
                          ? <span className="pill custom" title={ordered(r.page_access).join(', ')}>{r.page_access.length} of {TOTAL_PAGES} pages</span>
                          : <span className="pill dflt" title="The pages that go with this role">Role default</span>}
                    </td>
                    <td>{r.phone || <span className="mut">-</span>}</td>
                    <td><span className={`pill ${active(r) ? 'on' : 'off'}`}>{active(r) ? 'Active' : 'Deactivated'}</span></td>
                    <td className="mut" style={{ whiteSpace: 'nowrap' }}>{fmtD(r.created_at)}</td>
                    <td>
                      <div className="acts">
                        <button type="button" className="btn sm" onClick={() => openEdit(r)}>Edit</button>
                        <button type="button" className="btn sm" onClick={() => { setPwFor(r); setNewPw(''); setPwErr(''); }}>Reset password</button>
                        <button type="button" className="btn sm" disabled={isSelf(r) || isLastSuper(r)} title={isSelf(r) ? 'You cannot deactivate yourself' : isLastSuper(r) ? 'The last super admin must stay active' : ''} onClick={() => toggleActive(r)}>
                          {active(r) ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" className="btn sm dng" disabled={isSelf(r) || isLastSuper(r)} title={isSelf(r) ? 'You cannot delete yourself' : isLastSuper(r) ? 'The last super admin cannot be deleted' : ''} onClick={() => { setDelAsk(r); setDelErr(''); }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ===== Add / edit ===== */}
      {open && (
        <div className="ov" onClick={() => !saving && setOpen(false)}>
          <form className="modal" onSubmit={save} noValidate onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{editing ? 'Edit login' : 'New login'}</h2>
            {errs.form && <div role="alert" className="alert bad">{errs.form}</div>}

            <div className="fld">
              <label className="lbl" htmlFor="u-name">Full name *</label>
              <input id="u-name" className={`inp${errs.full_name ? ' bad' : ''}`} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} autoFocus />
              {errs.full_name && <span role="alert" className="err">{errs.full_name}</span>}
            </div>
            <div className="fld">
              <label className="lbl" htmlFor="u-email">Email (the sign-in name) *</label>
              <input id="u-email" type="email" className={`inp${errs.email ? ' bad' : ''}`} value={form.email} onChange={(e) => set('email', e.target.value)} disabled={!!editing} />
              {errs.email && <span role="alert" className="err">{errs.email}</span>}
            </div>
            <div className="fld">
              <label className="lbl" htmlFor="u-phone">Mobile (optional)</label>
              <input id="u-phone" className={`inp${errs.phone ? ' bad' : ''}`} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
              {errs.phone && <span role="alert" className="err">{errs.phone}</span>}
            </div>
            <div className="fld">
              <label className="lbl" htmlFor="u-role">Role *</label>
              <select id="u-role" className={`inp${errs.role ? ' bad' : ''}`} value={form.role} onChange={(e) => pickRole(e.target.value)} disabled={!!editing && isSelf(editing)}>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                {editing && !ROLE_OPTIONS.includes(editing.role as typeof ROLE_OPTIONS[number]) && <option value={editing.role}>{ROLE_LABEL[editing.role] || editing.role}</option>}
              </select>
              <p className="hint mut">{ROLE_HELP[form.role] || ''}</p>
              {errs.role && <span role="alert" className="err">{errs.role}</span>}
            </div>
            <div className="fld">
              <span className="lbl">Pages this login can open</span>
              {fullAccess ? (
                <div className="alert info" style={{ marginBottom: 0 }}>{ROLE_LABEL[form.role]} opens every page, so there is nothing to tick.</div>
              ) : (
                <div className={`pages${errs.page_access ? ' bad' : ''}`} style={errs.page_access ? { borderColor: '#ef4444' } : undefined}>
                  <div className="pages-top">
                    <b>{form.pages.length} of {TOTAL_PAGES} pages ticked</b>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="btn sm" onClick={() => setPages(ALL_PAGES)}>Select all</button>
                      <button type="button" className="btn sm" onClick={() => setPages([])}>Clear</button>
                      <button type="button" className="btn sm" onClick={() => { setPages(roleDefaultPages(form.role)); setPagesTouched(false); }}>Use the role's pages</button>
                    </div>
                  </div>
                  <div className="pages-scroll">
                    {PAGE_GROUPS.map((g) => {
                      const slugs = g.pages.map((p) => p.slug);
                      const n = slugs.filter((s) => form.pages.includes(s)).length;
                      return (
                        <div className="pgroup" key={g.title}>
                          <Tick strong label={g.title} checked={n === slugs.length} some={n > 0} onChange={(v) => toggleSlugs(slugs, v)} />
                          <div className="pgrid">
                            {g.pages.map((p) => <Tick key={p.slug} label={p.label} checked={form.pages.includes(p.slug)} onChange={(v) => toggleSlugs([p.slug], v)} />)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!fullAccess && <p className="hint mut">The server refuses the data of a page that is not ticked, not only the menu. Ticking the same pages as the role is the same as the role's default. The Users page is always for super admins only.</p>}
              {errs.page_access && <span role="alert" className="err">{errs.page_access}</span>}
            </div>
            <div className="fld">
              <label className="lbl" htmlFor="u-pw">{editing ? 'New password (leave empty to keep the old one)' : 'Password *'}</label>
              <div className="pwrow">
                <input id="u-pw" type={showPw ? 'text' : 'password'} autoComplete="new-password" className={`inp${errs.password ? ' bad' : ''}`} value={form.password} onChange={(e) => set('password', e.target.value)} />
                <button type="button" className="btn" onClick={() => setShowPw((s) => !s)}>{showPw ? 'Hide' : 'Show'}</button>
                <button type="button" className="btn" onClick={() => { set('password', makePassword()); setShowPw(true); }}>Generate</button>
              </div>
              <p className="hint mut">At least 8 characters, with a letter and a number. Do not reuse one password for several logins.</p>
              {errs.password && <span role="alert" className="err">{errs.password}</span>}
            </div>
            {editing && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: isSelf(editing) ? 'not-allowed' : 'pointer' }}>
                <input type="checkbox" checked={form.is_active} disabled={isSelf(editing)} onChange={(e) => set('is_active', e.target.checked)} />
                <span>Active (can sign in)</span>
              </label>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" className="btn" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Create login'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ===== Reset password ===== */}
      {pwFor && (
        <div className="ov" onClick={() => !pwBusy && setPwFor(null)}>
          <form className="modal" onSubmit={resetPassword} noValidate onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800 }}>Reset password</h2>
            <p className="mut" style={{ margin: '6px 0 14px' }}>{pwFor.full_name || pwFor.email} ({pwFor.email})</p>
            <div className="fld">
              <label className="lbl" htmlFor="u-npw">New password</label>
              <div className="pwrow">
                <input id="u-npw" type="text" autoComplete="off" className={`inp${pwErr ? ' bad' : ''}`} value={newPw} onChange={(e) => { setNewPw(e.target.value); setPwErr(''); }} autoFocus />
                <button type="button" className="btn" onClick={() => { setNewPw(makePassword()); setPwErr(''); }}>Generate</button>
              </div>
              {pwErr && <span role="alert" className="err">{pwErr}</span>}
            </div>
            <p className="hint mut">They stay signed in on a device until their 24 hours end. Deactivate the login first if you need them out at once.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn" disabled={pwBusy} onClick={() => setPwFor(null)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={pwBusy}>{pwBusy ? 'Saving...' : 'Change password'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ===== Delete ===== */}
      {delAsk && (
        <div className="ov" onClick={() => !deleting && setDelAsk(null)}>
          <div className="modal" role="alertdialog" aria-modal="true" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 800 }}>Delete this login?</h2>
            <p className="mut" style={{ marginTop: 8 }}>
              {delAsk.full_name || delAsk.email} ({delAsk.email}) will no longer be able to sign in. This cannot be undone. To keep the record and only stop the sign-in, choose Deactivate instead.
            </p>
            {delErr && <div role="alert" className="alert bad" style={{ marginTop: 12 }}>{delErr}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="btn" disabled={deleting} onClick={() => setDelAsk(null)}>Cancel</button>
              <button type="button" className="btn dfill" disabled={deleting} onClick={doDelete}>{deleting ? 'Deleting...' : 'Yes, delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}