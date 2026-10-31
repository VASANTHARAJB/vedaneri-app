import React, { useCallback, useEffect, useRef, useState } from 'react';

export const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api/v1';
export const API = `${API_BASE}/discover`;
const FILES = API_BASE.replace(/\/api\/v1\/?$/, '');

export function getToken(): string {
  for (const k of ['token', 'admin_token', 'auth_token', 'accessToken', 'cms_token']) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return '';
}
export const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });
export async function readJson(res: Response) { try { return await res.json(); } catch { return {}; } }
export const fileUrl = (u?: string | null) => (u ? (u.startsWith('http') ? u : `${FILES}${u}`) : '');
export const failText = (d: any, fallback: string) => `${d.message || fallback}${d.detail ? ` (${d.detail})` : ''}`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtD = (s?: string | null) => {
  const d = (s || '').slice(0, 10);
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${Number(dd)} ${MON[Number(m) - 1] || ''} ${y}`;
};

export type Status = 'draft' | 'published';
export interface Cat { id: string; kind: string; name_en: string; name_ta: string | null; sort_order: number; items: number }

// YouTube link -> video id (same rule as the server)
export function ytId(u: string): string | null {
  try {
    const x = new URL(u.trim());
    const h = x.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id: string | null = null;
    if (h === 'youtu.be') id = x.pathname.slice(1).split('/')[0];
    else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      if (x.pathname === '/watch') id = x.searchParams.get('v');
      else { const m = x.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/); if (m) id = m[2]; }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
export const ytThumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

// English letters -> Tamil script (phonetic). Uses Google Input Tools, no API key.
export async function transliterate(text: string): Promise<string | null> {
  const lines = text.split('\n').slice(0, 30);
  try {
    const out = await Promise.all(
      lines.map(async (line) => {
        if (!line.trim()) return '';
        const words = line.trim().split(/\s+/);
        const parts: string[] = [];
        for (let i = 0; i < words.length; i += 15) parts.push(words.slice(i, i + 15).join(' '));
        const done = await Promise.all(
          parts.map(async (p) => {
            const r = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(p)}&itc=ta-t-i0-und&num=1`);
            if (!r.ok) throw new Error('bad status');
            const d = await r.json();
            const v = d?.[0] === 'SUCCESS' ? d?.[1]?.[0]?.[1]?.[0] : null;
            if (!v) throw new Error('no result');
            return String(v);
          })
        );
        return done.join(' ');
      })
    );
    return out.join('\n');
  } catch { return null; }
}

export const CSS = `
.dc{--p:#7a1c1c;--pd:#5e1414;--ink:#1f2937;--mut:#6b7280;--line:#e5e7eb;font-size:13px;color:var(--ink);}
.dc *{box-sizing:border-box;}
.dc p,.dc h1,.dc h2,.dc h3,.dc td,.dc th,.dc dt,.dc dd,.dc label,.dc span{color:inherit !important;background:transparent !important;}
.dc .mut{color:var(--mut) !important;}
.dc .head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;}
.dc .title{font-size:22px;font-weight:800;}
.dc .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #cfd4dc !important;background:#fff !important;color:var(--ink) !important;white-space:nowrap;}
.dc .btn:hover{background:#f3f4f6 !important;}
.dc .btn:disabled{opacity:.55;cursor:not-allowed;}
.dc .btn.primary{background:var(--p) !important;border-color:var(--p) !important;color:#fff !important;}
.dc .btn.primary:hover{background:var(--pd) !important;}
.dc .btn.dng{color:#b91c1c !important;border-color:#fca5a5 !important;}
.dc .btn.dfill{background:#dc2626 !important;border-color:#dc2626 !important;color:#fff !important;}
.dc .btn.sm{padding:5px 10px;font-size:12px;border-radius:6px;}
.dc .btn.link{border:none !important;background:transparent !important;padding:0;color:var(--p) !important;font-weight:700;}
.dc .card{background:#fff !important;border:1px solid var(--line);border-radius:10px;}
.dc .tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);padding:0 14px;}
.dc .tab{padding:12px 16px;font-size:14px;font-weight:700;cursor:pointer;border:none !important;border-bottom:2px solid transparent !important;background:transparent !important;color:var(--mut) !important;}
.dc .tab.on{color:var(--p) !important;border-bottom-color:var(--p) !important;}
.dc .toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);}
.dc .grow{flex:1;}
.dc .chip{border-radius:999px;padding:6px 14px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid #cfd4dc !important;background:#fff !important;color:var(--ink) !important;}
.dc .chip.on{background:var(--p) !important;border-color:var(--p) !important;color:#fff !important;}
.dc .tblwrap{overflow-x:auto;}
.dc .tbl{width:100%;border-collapse:collapse;min-width:820px;}
.dc .tbl th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--mut) !important;background:#f9fafb !important;border-bottom:1px solid var(--line);white-space:nowrap;}
.dc .tbl td{padding:12px 14px;border-bottom:1px solid #f0f1f3;vertical-align:middle;}
.dc .thumb{width:56px;height:42px;border-radius:6px;overflow:hidden;background:#f6e7e7;flex:none;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--mut);}
.dc .thumb img{width:100%;height:100%;object-fit:cover;}
.dc .pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;border:1px solid transparent;text-transform:capitalize;}
.dc .pill.published{background:#dcfce7 !important;color:#166534 !important;border-color:#86efac;}
.dc .pill.draft{background:#f1f5f9 !important;color:#334155 !important;border-color:#cbd5e1;}
.dc .pill.cat{background:#ede9fe !important;color:#5b21b6 !important;border-color:#c4b5fd;}
.dc select.pill{cursor:pointer;padding:3px 8px;}
.dc .acts{display:flex;gap:6px;justify-content:flex-end;}
.dc .empty{padding:52px 16px;text-align:center;}
.dc .skel{height:46px;margin:10px 14px;border-radius:8px;background:linear-gradient(90deg,#f1f2f4 25%,#e7e9ec 37%,#f1f2f4 63%);background-size:400% 100%;animation:dcsk 1.2s ease infinite;}
@keyframes dcsk{0%{background-position:100% 50%}100%{background-position:0 50%}}
.dc .ov{position:fixed;inset:0;z-index:70;display:flex;justify-content:flex-end;background:rgba(17,24,39,.45);}
.dc .ov.mid{justify-content:center;align-items:center;padding:16px;}
.dc .drawer{display:flex;flex-direction:column;height:100%;width:100%;max-width:720px;background:#fff !important;box-shadow:-12px 0 40px rgba(0,0,0,.2);}
.dc .dh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 22px;border-bottom:1px solid var(--line);}
.dc .db{flex:1;overflow-y:auto;padding:20px 22px;}
.dc .df{display:flex;justify-content:flex-end;gap:8px;padding:14px 22px;border-top:1px solid var(--line);background:#fafafa !important;}
.dc .modal{width:100%;max-width:420px;background:#fff !important;border-radius:12px;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.25);}
.dc .sech{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--mut) !important;margin:6px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--line);}
.dc .g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
.dc .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;}
@media(max-width:700px){.dc .g2,.dc .g3{grid-template-columns:1fr;}}
.dc .lblrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
.dc .lbl{display:block;font-size:12px;font-weight:700;margin-bottom:4px;}
.dc .lblrow .lbl{margin-bottom:0;}
.dc .inp{width:100%;border:1px solid #cfd4dc !important;border-radius:8px;padding:9px 11px;font-size:14px;background:#fff !important;color:var(--ink) !important;}
.dc .inp:focus{outline:2px solid #d97777;border-color:var(--p) !important;}
.dc .inp.bad{border-color:#ef4444 !important;background:#fef2f2 !important;}
.dc .toolbar .inp{width:auto;}
.dc .hint{font-size:11.5px;margin-top:4px;}
.dc .err{display:block;font-size:12px;font-weight:600;margin-top:4px;color:#b91c1c !important;}
.dc .alert{border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;margin-bottom:14px;}
.dc .alert.ok{background:#dcfce7 !important;color:#166534 !important;border:1px solid #86efac;}
.dc .alert.bad{background:#fee2e2 !important;color:#991b1b !important;border:1px solid #fca5a5;}
.dc .alert.info{background:#eff6ff !important;color:#1e40af !important;border:1px solid #bfdbfe;}
.dc .detail{display:block;font-weight:400;margin-top:4px;word-break:break-word;}
.dc .photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:10px;}
.dc .ph{position:relative;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#f3f4f6;}
.dc .ph img{width:100%;height:96px;object-fit:cover;display:block;}
.dc .ph .bar{display:flex;gap:4px;padding:4px;background:#fff !important;}
.dc .ph .tag{position:absolute;left:6px;top:6px;background:#7a1c1c !important;color:#fff !important;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:800;}
.dc .vprev{display:flex;gap:12px;align-items:center;margin-top:10px;}
.dc .vprev img{width:160px;height:90px;object-fit:cover;border-radius:8px;}
.dc audio{height:34px;max-width:240px;}
`;

// ---------- small helpers ----------
export function useFlash() {
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const flash = useCallback((tone: 'ok' | 'err', text: string) => {
    setNotice({ tone, text });
    if (tone === 'ok') setTimeout(() => setNotice(null), 4000);
  }, []);
  return { notice, flash, clear: () => setNotice(null) };
}

export function Notice({ notice, onClear }: { notice: { tone: 'ok' | 'err'; text: string } | null; onClear: () => void }) {
  if (!notice) return null;
  return (
    <div role={notice.tone === 'err' ? 'alert' : 'status'} className={`alert ${notice.tone === 'ok' ? 'ok' : 'bad'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span>{notice.text}</span><button type="button" className="btn sm" onClick={onClear}>Dismiss</button>
    </div>
  );
}

export function Confirm({ title, text, busy, onYes, onNo }: { title: string; text: string; busy: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <div className="ov mid" onClick={() => !busy && onNo()}>
      <div className="modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 17, fontWeight: 800 }}>{title}</h2>
        <p className="mut" style={{ marginTop: 8 }}>{text}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" className="btn" disabled={busy} onClick={onNo}>Cancel</button>
          <button type="button" className="btn dfill" disabled={busy} onClick={onYes}>{busy ? 'Deleting...' : 'Yes, delete'}</button>
        </div>
      </div>
    </div>
  );
}

export function StatusSelect({ value, onChange, label }: { value: Status; onChange: (v: Status) => void; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Status)} aria-label={label} className={`pill ${value}`}>
      <option value="draft">draft</option><option value="published">published</option>
    </select>
  );
}

export function ErrBox({ message, detail, onRetry }: { message: string; detail?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="empty">
      <p style={{ fontSize: 15, fontWeight: 800 }}>This list could not be loaded</p>
      <p className="mut" style={{ marginTop: 4 }}>{message}</p>
      {detail && <p className="detail mut">Reason: {detail}</p>}
      <div style={{ marginTop: 16 }}><button type="button" className="btn" onClick={onRetry}>Try again</button></div>
    </div>
  );
}

// ---------- categories hook ----------
export function useCats(kind: 'audio' | 'video' | 'album') {
  const [cats, setCats] = useState<Cat[]>([]);
  const reload = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/categories?kind=${kind}`, { headers: authHeader(), cache: 'no-store' });
      if (res.ok) setCats((await res.json()).categories || []);
    } catch { /* the page shows its own error */ }
  }, [kind]);
  useEffect(() => { reload(); }, [reload]);
  return { cats, reload };
}

// ---------- Tamil auto-fill ----------
export function useTamil(form: Record<string, any>, setForm: (fn: (f: any) => any) => void) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [fail, setFail] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const seq = useRef<Record<string, number>>({});

  const cancel = useCallback((k: string) => {
    clearTimeout(timers.current[k]);
    seq.current[k] = (seq.current[k] || 0) + 1;
    setBusy((b) => (b[k] ? { ...b, [k]: false } : b));
  }, []);

  const run = useCallback((ta: string, text: string, delay: number) => {
    cancel(ta);
    if (!text.trim()) { setForm((f) => ({ ...f, [ta]: '' })); return; }
    const id = seq.current[ta];
    setBusy((b) => ({ ...b, [ta]: true }));
    timers.current[ta] = setTimeout(async () => {
      const out = await transliterate(text);
      if (seq.current[ta] !== id) return;
      setBusy((b) => ({ ...b, [ta]: false }));
      if (out === null) { setFail(true); return; }
      setFail(false);
      setForm((f) => ({ ...f, [ta]: out }));
    }, delay);
  }, [cancel, setForm]);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  const reset = useCallback((initial: Record<string, boolean> = {}) => {
    Object.keys(seq.current).forEach(cancel);
    setTouched(initial);
    setFail(false);
  }, [cancel]);

  const onEn = (en: string, ta: string, v: string, long = false) => {
    setForm((f) => ({ ...f, [en]: v }));
    if (!touched[ta]) run(ta, v, long ? 700 : 450);
  };
  const onTa = (en: string, ta: string, v: string) => {
    cancel(ta);
    setForm((f) => ({ ...f, [ta]: v }));
    if (v.trim() === '') {
      setTouched((t) => ({ ...t, [ta]: false }));
      const e = form[en] as string;
      if (e && e.trim()) run(ta, e, 0);
    } else setTouched((t) => ({ ...t, [ta]: true }));
  };
  const force = (en: string, ta: string) => { setTouched((t) => ({ ...t, [ta]: false })); run(ta, form[en] || '', 0); };

  return { touched, busy, fail, reset, onEn, onTa, force, anyBusy: Object.values(busy).some(Boolean) };
}
export type TamilApi = ReturnType<typeof useTamil>;

export function TamilNotice({ t }: { t: TamilApi }) {
  return (
    <>
      <div className="alert info">Type in English and the Tamil field fills in by itself. It is a phonetic spelling in Tamil script, not a translation, so please check it before saving.</div>
      {t.fail && <div role="alert" className="alert bad">Auto-fill could not reach the Tamil conversion service. Type the Tamil text yourself.</div>}
    </>
  );
}

export function Pair({ t, form, en, ta, label, required, error, placeholder }: { t: TamilApi; form: Record<string, any>; en: string; ta: string; label: string; required?: boolean; error?: string; placeholder?: string }) {
  return (
    <div className="g2">
      <div>
        <label className="lbl" htmlFor={`f-${en}`}>{label} (English){required ? ' *' : ''}</label>
        <input id={`f-${en}`} placeholder={placeholder} value={form[en]} onChange={(e) => t.onEn(en, ta, e.target.value)} className={`inp${error ? ' bad' : ''}`} />
        {error && <span role="alert" className="err">{error}</span>}
      </div>
      <div>
        <div className="lblrow">
          <label className="lbl" htmlFor={`f-${ta}`}>{label} (தமிழ்)</label>
          <button type="button" className="btn link" disabled={!String(form[en] || '').trim() || t.busy[ta]} onClick={() => t.force(en, ta)}>Auto-fill</button>
        </div>
        <input id={`f-${ta}`} value={form[ta]} onChange={(e) => t.onTa(en, ta, e.target.value)} className="inp" />
        <p className="hint mut">{t.busy[ta] ? 'Converting to Tamil...' : t.touched[ta] ? 'Edited by you. It will not be overwritten.' : 'Fills in automatically from the English text.'}</p>
      </div>
    </div>
  );
}

// ---------- Categories tab ----------
export function CategoriesPanel({ kind, cats, reload, flash }: { kind: 'audio' | 'video' | 'album'; cats: Cat[]; reload: () => void; flash: (tone: 'ok' | 'err', text: string) => void }) {
  const empty = { name_en: '', name_ta: '', sort_order: '0' };
  const [form, setForm] = useState({ ...empty });
  const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const t = useTamil(form, setForm);

  const startEdit = (c: Cat) => {
    t.reset({ name_ta: !!c.name_ta });
    setEditId(c.id); setForm({ name_en: c.name_en, name_ta: c.name_ta || '', sort_order: String(c.sort_order) }); setErr('');
  };
  const cancel = () => { t.reset(); setEditId(null); setForm({ ...empty }); setErr(''); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!form.name_en.trim()) { setErr('Enter the category name in English'); return; }
    setSaving(true);
    try {
      const res = await fetch(editId ? `${API}/admin/categories/${editId}` : `${API}/admin/categories`, {
        method: editId ? 'PUT' : 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, kind }),
      });
      const d = await readJson(res);
      if (!res.ok) { setErr(failText(d, 'Could not save the category.')); return; }
      flash('ok', editId ? 'Category saved.' : 'Category added.');
      cancel(); reload();
    } catch { setErr('Network error. Please try again.'); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`${API}/admin/categories/${id}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) throw new Error((await readJson(res)).message);
      setDelId(null); flash('ok', 'Category deleted.'); reload();
    } catch (e: any) { setDelId(null); flash('err', e?.message || 'Could not delete the category.'); }
  }

  return (
    <div style={{ padding: 16 }}>
      <form onSubmit={save} noValidate className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 className="sech">{editId ? 'Edit category' : 'New category'}</h3>
        {err && <div role="alert" className="alert bad">{err}</div>}
        <TamilNotice t={t} />
        <Pair t={t} form={form} en="name_en" ta="name_ta" label="Name" required placeholder="Discourse, Bhajan, Festival..." />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 160 }}>
            <label className="lbl" htmlFor="cat-so">Order</label>
            <input id="cat-so" type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} className="inp" />
          </div>
          <span className="grow" />
          {editId && <button type="button" className="btn" onClick={cancel}>Cancel</button>}
          <button type="submit" className="btn primary" disabled={saving || t.anyBusy}>{saving ? 'Saving...' : t.anyBusy ? 'Converting Tamil...' : editId ? 'Save changes' : 'Add category'}</button>
        </div>
      </form>

      {cats.length === 0 ? (
        <p className="empty mut">No categories yet. Add the first one above.</p>
      ) : (
        <div className="tblwrap">
          <table className="tbl" style={{ minWidth: 560 }}>
            <thead><tr><th>Category</th><th>Items</th><th>Order</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name_en}</strong>{c.name_ta && <span className="mut" style={{ display: 'block' }}>{c.name_ta}</span>}</td>
                  <td>{c.items}</td>
                  <td>{c.sort_order}</td>
                  <td>
                    {delId === c.id ? (
                      <div className="acts">
                        <span style={{ fontWeight: 700, color: '#b91c1c' }}>Delete? Its items stay uncategorised.</span>
                        <button type="button" className="btn sm dfill" onClick={() => remove(c.id)}>Yes</button>
                        <button type="button" className="btn sm" onClick={() => setDelId(null)}>No</button>
                      </div>
                    ) : (
                      <div className="acts">
                        <button type="button" className="btn sm" onClick={() => startEdit(c)}>Edit</button>
                        <button type="button" className="btn sm dng" onClick={() => setDelId(c.id)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}