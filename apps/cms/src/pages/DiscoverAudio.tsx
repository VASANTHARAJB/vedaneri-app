import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  API, CSS, Cat, CategoriesPanel, Confirm, ErrBox, Notice, Pair, Status, StatusSelect, TamilNotice,
  authHeader, failText, fileUrl, fmtD, readJson, useCats, useFlash, useTamil,
} from './DiscoverKit';

type Type = 'single' | 'series';
interface Item { id: string; kind: Type; category_id: string | null; category_en: string | null; title_en: string; title_ta: string | null; audio_url: string | null; cover_url: string | null; item_date: string | null; status: Status; sort_order: number; class_count: number }
interface Cls { id: string; title_en: string; title_ta: string | null; audio_url: string; class_date: string | null; sort_order: number }
interface Pending { key: string; title_en: string; title_ta: string; class_date: string; file: File }
const emptyForm = { kind: 'single', category_id: '', title_en: '', title_ta: '', item_date: '', status: 'draft', sort_order: '0' };
const emptyCls = { title_en: '', title_ta: '', class_date: '' };

const EXTRA = `
.dc .opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
.dc .opt{display:flex;align-items:center;gap:10px;padding:12px 14px;border:2px solid #cfd4dc !important;border-radius:10px;background:#fff !important;color:#1f2937 !important;font-size:14px;font-weight:700;cursor:pointer;text-align:left;}
.dc .opt .dot{width:16px;height:16px;border-radius:50%;border:2px solid #9ca3af;flex:none;background:#fff !important;}
.dc .opt.on{border-color:#7a1c1c !important;background:#f6e7e7 !important;color:#7a1c1c !important;}
.dc .opt.on .dot{border-color:#7a1c1c;background:radial-gradient(circle,#7a1c1c 45%,#fff 50%) !important;}
.dc .opt:disabled{opacity:.6;cursor:not-allowed;}
.dc .clsbox{border:2px solid #7a1c1c;border-radius:12px;padding:16px;background:#fffafa !important;margin-bottom:14px;}
.dc .clsrow{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:6px;background:#fff !important;flex-wrap:wrap;}
.dc .clsrow .no{font-weight:800;width:26px;}
.dc .clsrow .nm{flex:1;min-width:140px;}
`;

export default function DiscoverAudio() {
  const [params, setParams] = useSearchParams();
  const { notice, flash, clear } = useFlash();
  const { cats, reload: reloadCats } = useCats('audio');
  const [tab, setTab] = useState<'items' | 'cats'>('items');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<{ message: string; detail?: string } | null>(null);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState<'all' | Status>('all');
  const [fCat, setFCat] = useState('all');
  const [fType, setFType] = useState<'all' | Type>('all');

  // Audio form
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Item | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPrev, setCoverPrev] = useState('');
  const [removeCover, setRemoveCover] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [delItem, setDelItem] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const t = useTamil(form, setForm);

  // Classes (inside the same form)
  const [saved, setSaved] = useState<Cls[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [clsLoading, setClsLoading] = useState(false);
  const [clsForm, setClsForm] = useState({ ...emptyCls });
  const [clsFile, setClsFile] = useState<File | null>(null);
  const [clsEdit, setClsEdit] = useState<Cls | null>(null);
  const [clsErrs, setClsErrs] = useState<Record<string, string>>({});
  const [clsBusy, setClsBusy] = useState(false);
  const [delCls, setDelCls] = useState<Cls | null>(null);
  const [delClsBusy, setDelClsBusy] = useState(false);
  const tc = useTamil(clsForm, setClsForm);

  const fetchList = useCallback(async (): Promise<Item[]> => {
    const res = await fetch(`${API}/admin/audio`, { headers: authHeader(), cache: 'no-store' });
    const d = await readJson(res);
    if (res.status === 401) throw { message: 'Your admin session has ended. Please sign in again.' };
    if (!res.ok) throw { message: d.message || `The server returned an error (${res.status}).`, detail: d.detail };
    return d.items || [];
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadErr(null);
    try { setItems(await fetchList()); }
    catch (e: any) { setLoadErr({ message: e?.message || 'Could not load.', detail: e?.detail }); }
    finally { setLoading(false); }
  }, [fetchList]);
  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrs((e) => ({ ...e, [k]: '', form: '' })); };
  const setC = (k: string, v: string) => { setClsForm((f) => ({ ...f, [k]: v })); setClsErrs((e) => ({ ...e, [k]: '', form: '' })); };

  async function loadSaved(id: string) {
    setClsLoading(true);
    try {
      const res = await fetch(`${API}/admin/audio/${id}/classes`, { headers: authHeader(), cache: 'no-store' });
      const d = await readJson(res);
      setSaved(res.ok ? d.classes || [] : []);
    } catch { setSaved([]); } finally { setClsLoading(false); }
  }

  const resetClassBits = () => { tc.reset(); setSaved([]); setPending([]); setClsForm({ ...emptyCls }); setClsFile(null); setClsEdit(null); setClsErrs({}); };

  const openNew = useCallback(() => {
    t.reset(); resetClassBits();
    setEdit(null); setForm({ ...emptyForm }); setAudio(null); setCover(null); setCoverPrev(''); setRemoveCover(false); setErrs({}); setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const openEdit = (i: Item) => {
    t.reset({ title_ta: !!i.title_ta }); resetClassBits();
    setEdit(i);
    setForm({ kind: i.kind, category_id: i.category_id || '', title_en: i.title_en, title_ta: i.title_ta || '', item_date: i.item_date || '', status: i.status, sort_order: String(i.sort_order) });
    setAudio(null); setCover(null); setCoverPrev(fileUrl(i.cover_url)); setRemoveCover(false); setErrs({}); setOpen(true);
    if (i.kind === 'series') loadSaved(i.id);
  };

  useEffect(() => {
    if (params.get('new') === '1') {
      setTab('items'); openNew();
      const next = new URLSearchParams(params); next.delete('new'); setParams(next, { replace: true });
    }
  }, [params, setParams, openNew]);

  function pickAudio(f?: File) {
    if (!f) return;
    if (!f.type.startsWith('audio/')) { setErrs((e) => ({ ...e, audio: 'Choose an audio file (MP3, M4A, AAC, WAV or OGG)' })); return; }
    if (f.size > 60 * 1024 * 1024) { setErrs((e) => ({ ...e, audio: 'The audio must be under 60MB' })); return; }
    setErrs((e) => ({ ...e, audio: '' })); setAudio(f);
  }
  function pickCover(f?: File) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setErrs((e) => ({ ...e, cover: 'Choose a JPG, PNG or WebP image' })); return; }
    if (f.size > 8 * 1024 * 1024) { setErrs((e) => ({ ...e, cover: 'The image must be under 8MB' })); return; }
    setErrs((e) => ({ ...e, cover: '' })); setCover(f); setCoverPrev(URL.createObjectURL(f)); setRemoveCover(false);
  }
  function pickClassAudio(f?: File) {
    if (!f) return;
    if (!f.type.startsWith('audio/')) { setClsErrs((e) => ({ ...e, audio: 'Choose an audio file (MP3, M4A, AAC, WAV or OGG)' })); return; }
    if (f.size > 60 * 1024 * 1024) { setClsErrs((e) => ({ ...e, audio: 'The audio must be under 60MB' })); return; }
    setClsErrs((e) => ({ ...e, audio: '' })); setClsFile(f);
  }

  // ----- the "Add class" button -----
  async function addClass() {
    if (clsBusy) return;
    if (clsEdit) {
      // changing an already saved class: applied at once
      const body = new FormData();
      Object.entries(clsForm).forEach(([k, v]) => body.append(k, String(v)));
      if (clsFile) body.append('audio', clsFile);
      setClsBusy(true);
      try {
        const res = await fetch(`${API}/admin/audio-classes/${clsEdit.id}`, { method: 'PUT', headers: authHeader(), body });
        const d = await readJson(res);
        if (!res.ok) { setClsErrs({ form: failText(d, 'Could not save the class.') }); return; }
        flash('ok', 'Class saved.'); cancelClassEdit(); if (edit) loadSaved(edit.id);
      } catch { setClsErrs({ form: 'Network error. Please try again.' }); } finally { setClsBusy(false); }
      return;
    }
    if (!clsFile) { setClsErrs({ audio: 'Choose the audio file for this class' }); return; }
    setPending((p) => [...p, { key: `${Date.now()}-${p.length}`, title_en: clsForm.title_en.trim(), title_ta: clsForm.title_ta, class_date: clsForm.class_date, file: clsFile }]);
    tc.reset(); setClsForm({ ...emptyCls }); setClsFile(null); setClsErrs({});
  }
  function editSaved(c: Cls) {
    tc.reset({ title_ta: !!c.title_ta });
    setClsEdit(c); setClsForm({ title_en: c.title_en, title_ta: c.title_ta || '', class_date: c.class_date || '' }); setClsFile(null); setClsErrs({});
  }
  function cancelClassEdit() { tc.reset(); setClsEdit(null); setClsForm({ ...emptyCls }); setClsFile(null); setClsErrs({}); }

  async function removeSaved() {
    if (!delCls) return;
    setDelClsBusy(true);
    try {
      const res = await fetch(`${API}/admin/audio-classes/${delCls.id}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) throw new Error((await readJson(res)).message);
      flash('ok', 'Class deleted.'); setDelCls(null); if (edit) loadSaved(edit.id); load();
    } catch (e: any) { setDelCls(null); flash('err', e?.message || 'Could not delete the class.'); } finally { setDelClsBusy(false); }
  }

  // ----- save the audio (and upload the listed classes) -----
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const isSeries = form.kind === 'series';
    const x: Record<string, string> = {};
    if (!form.title_en.trim()) x.title_en = 'Enter the title in English';
    if (!isSeries && !edit && !audio) x.audio = 'Upload the audio file';
    setErrs(x);
    if (Object.keys(x).length) return;

    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, String(v)));
    if (!isSeries && audio) body.append('audio', audio);
    if (cover) body.append('cover', cover);
    if (removeCover) body.append('remove_cover', 'true');

    setSaving(true);
    try {
      const res = await fetch(edit ? `${API}/admin/audio/${edit.id}` : `${API}/admin/audio`, { method: edit ? 'PUT' : 'POST', headers: authHeader(), body });
      const d = await readJson(res);
      if (!res.ok) { setErrs({ form: failText(d, 'Could not save the audio.') }); return; }
      const seriesId: string = edit ? edit.id : d.id;

      // Upload the classes that were added to the list, in order
      const left: Pending[] = [];
      let firstError = '';
      if (isSeries) {
        for (const p of pending) {
          if (firstError) { left.push(p); continue; }
          const b = new FormData();
          b.append('title_en', p.title_en); b.append('title_ta', p.title_ta); b.append('class_date', p.class_date); b.append('audio', p.file);
          try {
            const r = await fetch(`${API}/admin/audio/${seriesId}/classes`, { method: 'POST', headers: authHeader(), body: b });
            if (!r.ok) { firstError = failText(await readJson(r), 'Upload failed.'); left.push(p); }
          } catch { firstError = 'Network error.'; left.push(p); }
        }
      }

      reloadCats();
      const list = await fetchList();
      setItems(list);
      if (left.length) {
        // The series is saved; keep the classes that did not upload so they can be retried
        const made = list.find((i) => i.id === seriesId) || null;
        setEdit(made); setPending(left); loadSaved(seriesId);
        setErrs({ form: `The series was saved, but ${left.length} class${left.length === 1 ? '' : 'es'} did not upload. ${firstError} Press Save again to retry.` });
        return;
      }
      t.reset(); setOpen(false);
      flash('ok', isSeries ? `Series saved${pending.length ? ` with ${pending.length} new class${pending.length === 1 ? '' : 'es'}` : ''}.` : edit ? 'Audio saved.' : 'Audio added.');
    } catch { setErrs({ form: 'Network error. Please try again.' }); } finally { setSaving(false); }
  }

  async function setStatus(i: Item, status: Status) {
    try {
      const res = await fetch(`${API}/admin/audio/${i.id}/status`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error((await readJson(res)).message);
      setItems((l) => l.map((x) => (x.id === i.id ? { ...x, status } : x)));
    } catch (e: any) { flash('err', e?.message || 'Could not change the status.'); }
  }

  async function doDelete() {
    if (!delItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/admin/audio/${delItem.id}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) throw new Error((await readJson(res)).message);
      flash('ok', 'Audio deleted.'); setDelItem(null); load(); reloadCats();
    } catch (e: any) { setDelItem(null); flash('err', e?.message || 'Could not delete.'); } finally { setDeleting(false); }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (delCls) { if (!delClsBusy) setDelCls(null); }
      else if (delItem) { if (!deleting) setDelItem(null); }
      else if (open && !saving) setOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [delCls, delClsBusy, delItem, deleting, open, saving]);

  const nPub = items.filter((i) => i.status === 'published').length;
  const nDraft = items.length - nPub;
  const s = q.trim().toLowerCase();
  const shown = useMemo(() => items.filter((i) =>
    (fStatus === 'all' || i.status === fStatus) && (fType === 'all' || i.kind === fType) &&
    (fCat === 'all' || (fCat === 'none' ? !i.category_id : i.category_id === fCat)) &&
    (!s || `${i.title_en} ${i.title_ta || ''} ${i.category_en || ''}`.toLowerCase().includes(s))
  ), [items, fStatus, fType, fCat, s]);

  const catOptions = (c: Cat) => <option key={c.id} value={c.id}>{c.name_en}</option>;
  const isSeriesForm = form.kind === 'series';
  const nextNo = saved.length + pending.length + 1;

  return (
    <div className="dc">
      <style>{CSS + EXTRA}</style>
      <div className="head">
        <div>
          <h1 className="title">Discover: Audio</h1>
          <p className="mut" style={{ marginTop: 2 }}>Single audio files, or a regular classes series with many audio classes.</p>
        </div>
        <button type="button" className="btn primary" onClick={openNew}>+ New Audio</button>
      </div>
      <Notice notice={notice} onClear={clear} />

      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="tabs">
          <button type="button" className={`tab${tab === 'items' ? ' on' : ''}`} onClick={() => setTab('items')}>Audio ({items.length})</button>
          <button type="button" className={`tab${tab === 'cats' ? ' on' : ''}`} onClick={() => setTab('cats')}>Categories ({cats.length})</button>
        </div>

        {tab === 'cats' ? (
          <CategoriesPanel kind="audio" cats={cats} reload={() => { reloadCats(); load(); }} flash={flash} />
        ) : (
          <>
            <div className="toolbar">
              {([['all', `All ${items.length}`], ['published', `Published ${nPub}`], ['draft', `Draft ${nDraft}`]] as const).map(([k, label]) => (
                <button key={k} type="button" className={`chip${fStatus === k ? ' on' : ''}`} onClick={() => setFStatus(k)}>{label}</button>
              ))}
              <select value={fType} onChange={(e) => setFType(e.target.value as 'all' | Type)} className="inp" aria-label="Type">
                <option value="all">All types</option><option value="single">Single audio</option><option value="series">Regular classes</option>
              </select>
              <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="inp" aria-label="Category">
                <option value="all">All categories</option>{cats.map(catOptions)}<option value="none">No category</option>
              </select>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search" className="inp" style={{ width: 240, maxWidth: '100%' }} />
            </div>

            {loading ? <div>{[0, 1, 2].map((i) => <div key={i} className="skel" />)}</div>
            : loadErr ? <ErrBox message={loadErr.message} detail={loadErr.detail} onRetry={load} />
            : shown.length === 0 ? (
              <div className="empty">
                <p style={{ fontSize: 16, fontWeight: 800 }}>{items.length === 0 ? 'No audio yet' : 'No audio matches this filter'}</p>
                {items.length === 0 && <div style={{ marginTop: 16 }}><button type="button" className="btn primary" onClick={openNew}>+ Add the first audio</button></div>}
              </div>
            ) : (
              <div className="tblwrap">
                <table className="tbl">
                  <thead><tr><th>Title</th><th>Type</th><th>Category</th><th>Date</th><th>Listen / Classes</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                  <tbody>
                    {shown.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div className="thumb">{i.cover_url ? <img src={fileUrl(i.cover_url)} alt="" /> : 'Audio'}</div>
                            <div><strong>{i.title_en}</strong>{i.title_ta && <span className="mut" style={{ display: 'block' }}>{i.title_ta}</span>}</div>
                          </div>
                        </td>
                        <td>{i.kind === 'series' ? <span className="pill cat">Classes</span> : <span className="pill draft">Single</span>}</td>
                        <td>{i.category_en ? <span className="pill cat">{i.category_en}</span> : <span className="mut">None</span>}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtD(i.item_date) || <span className="mut">-</span>}</td>
                        <td>
                          {i.kind === 'series'
                            ? <button type="button" className="btn sm" onClick={() => openEdit(i)}>{i.class_count} class{i.class_count === 1 ? '' : 'es'} / Add</button>
                            : i.audio_url ? <audio controls preload="none" src={fileUrl(i.audio_url)} /> : <span className="mut">No file</span>}
                        </td>
                        <td><StatusSelect value={i.status} onChange={(v) => setStatus(i, v)} label={`Status of ${i.title_en}`} /></td>
                        <td><div className="acts">
                          <button type="button" className="btn sm" onClick={() => openEdit(i)}>Edit</button>
                          <button type="button" className="btn sm dng" onClick={() => setDelItem(i)}>Delete</button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* Audio form */}
      {open && (
        <div className="ov" onClick={() => !saving && setOpen(false)}>
          <form onSubmit={save} noValidate onClick={(e) => e.stopPropagation()} className="drawer" style={{ maxWidth: 780 }}>
            <div className="dh">
              <div><h2 style={{ fontSize: 18, fontWeight: 800 }}>{edit ? 'Edit audio' : 'New audio'}</h2><p className="mut">Fields marked * are required.</p></div>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="db">
              {errs.form && <div role="alert" className="alert bad">{errs.form}</div>}
              <TamilNotice t={t} />

              <h3 className="sech">Type</h3>
              <div className="opts" role="radiogroup" aria-label="Audio type">
                <button type="button" role="radio" aria-checked={form.kind === 'single'} disabled={!!edit} className={`opt${form.kind === 'single' ? ' on' : ''}`} onClick={() => set('kind', 'single')}>
                  <span className="dot" />Single audio
                </button>
                <button type="button" role="radio" aria-checked={form.kind === 'series'} disabled={!!edit} className={`opt${form.kind === 'series' ? ' on' : ''}`} onClick={() => set('kind', 'series')}>
                  <span className="dot" />Regular classes
                </button>
              </div>
              {edit && <p className="hint mut" style={{ marginTop: -8, marginBottom: 12 }}>The type cannot be changed after saving.</p>}

              <h3 className="sech">Details</h3>
              <div style={{ marginBottom: 14 }}>
                <label className="lbl" htmlFor="a-cat">Category</label>
                <select id="a-cat" value={form.category_id} onChange={(e) => set('category_id', e.target.value)} className="inp">
                  <option value="">No category</option>{cats.map(catOptions)}
                </select>
                <p className="hint mut">Create categories in the Categories tab.</p>
              </div>
              <Pair t={t} form={form} en="title_en" ta="title_ta" label={isSeriesForm ? 'Series title' : 'Title'} required error={errs.title_en} />
              <div className="g3">
                <div><label className="lbl" htmlFor="a-date">{isSeriesForm ? 'Start date' : 'Date'}</label><input id="a-date" type="date" value={form.item_date} onChange={(e) => set('item_date', e.target.value)} className="inp" /></div>
                <div><label className="lbl" htmlFor="a-so">Order</label><input id="a-so" type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} className="inp" /></div>
                <div>
                  <label className="lbl" htmlFor="a-st">Status</label>
                  <select id="a-st" value={form.status} onChange={(e) => set('status', e.target.value)} className="inp"><option value="draft">Draft</option><option value="published">Published</option></select>
                </div>
              </div>

              {!isSeriesForm ? (
                <>
                  <h3 className="sech">Audio file</h3>
                  <div style={{ marginBottom: 16 }}>
                    <span className="lbl">Audio {edit ? '(leave empty to keep the current file)' : '*'}</span>
                    <label className="btn" style={{ cursor: 'pointer' }}>{audio ? 'Change audio' : 'Choose audio'}<input type="file" accept="audio/*" className="sr-only" onChange={(e) => pickAudio(e.target.files?.[0])} /></label>
                    <span className="mut" style={{ marginLeft: 10 }}>{audio ? `${audio.name} (${(audio.size / 1048576).toFixed(1)} MB)` : edit ? 'Current audio kept' : 'No file chosen'}</span>
                    {errs.audio && <span role="alert" className="err">{errs.audio}</span>}
                    {edit && edit.audio_url && !audio && <div style={{ marginTop: 8 }}><audio controls preload="none" src={fileUrl(edit.audio_url)} /></div>}
                    <p className="hint mut">MP3, M4A, AAC, WAV or OGG, up to 60MB.</p>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="sech">Classes</h3>
                  <div className="clsbox">
                    <p style={{ fontWeight: 800, marginBottom: 10 }}>{clsEdit ? `Edit class ${clsEdit.sort_order}` : `Add class ${nextNo}`}</p>
                    {clsErrs.form && <div role="alert" className="alert bad">{clsErrs.form}</div>}
                    <div className="g2">
                      <div>
                        <label className="lbl" htmlFor="cl-en">Class title (English)</label>
                        <input id="cl-en" value={clsForm.title_en} placeholder={`Class ${clsEdit ? clsEdit.sort_order : nextNo}`} onChange={(e) => tc.onEn('title_en', 'title_ta', e.target.value)} className="inp" />
                      </div>
                      <div>
                        <div className="lblrow">
                          <label className="lbl" htmlFor="cl-ta">Class title (தமிழ்)</label>
                          <button type="button" className="btn link" disabled={!clsForm.title_en.trim() || tc.busy.title_ta} onClick={() => tc.force('title_en', 'title_ta')}>Auto-fill</button>
                        </div>
                        <input id="cl-ta" value={clsForm.title_ta} onChange={(e) => tc.onTa('title_en', 'title_ta', e.target.value)} className="inp" />
                        <p className="hint mut">{tc.busy.title_ta ? 'Converting to Tamil...' : tc.touched.title_ta ? 'Edited by you.' : 'Fills in from the English title.'}</p>
                      </div>
                    </div>
                    <div className="g2">
                      <div><label className="lbl" htmlFor="cl-date">Class date</label><input id="cl-date" type="date" value={clsForm.class_date} onChange={(e) => setC('class_date', e.target.value)} className="inp" /></div>
                      <div>
                        <span className="lbl">Audio {clsEdit ? '(empty keeps the current file)' : '*'}</span>
                        <label className="btn" style={{ cursor: 'pointer' }}>{clsFile ? 'Change audio' : 'Choose audio'}<input type="file" accept="audio/*" className="sr-only" onChange={(e) => pickClassAudio(e.target.files?.[0])} /></label>
                        <p className="hint mut">{clsFile ? `${clsFile.name} (${(clsFile.size / 1048576).toFixed(1)} MB)` : clsEdit ? 'Current audio kept' : 'No file chosen. Up to 60MB.'}</p>
                        {clsErrs.audio && <span role="alert" className="err">{clsErrs.audio}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      {clsEdit && <button type="button" className="btn" onClick={cancelClassEdit}>Cancel edit</button>}
                      <button type="button" className="btn primary" disabled={clsBusy || tc.anyBusy} onClick={addClass}>{clsBusy ? 'Saving...' : tc.anyBusy ? 'Converting Tamil...' : clsEdit ? 'Save class' : '+ Add class'}</button>
                    </div>
                  </div>

                  {/* The classes listed so far */}
                  {clsLoading && <p className="mut">Loading classes...</p>}
                  {saved.map((c) => (
                    <div key={c.id} className="clsrow">
                      <span className="no">{c.sort_order}</span>
                      <span className="nm"><strong>{c.title_en}</strong>{c.title_ta && <span className="mut" style={{ display: 'block' }}>{c.title_ta}</span>}{c.class_date && <span className="mut" style={{ display: 'block' }}>{fmtD(c.class_date)}</span>}</span>
                      <audio controls preload="none" src={fileUrl(c.audio_url)} />
                      <button type="button" className="btn sm" onClick={() => editSaved(c)}>Edit</button>
                      <button type="button" className="btn sm dng" onClick={() => setDelCls(c)}>Delete</button>
                    </div>
                  ))}
                  {pending.map((p, idx) => (
                    <div key={p.key} className="clsrow" style={{ borderStyle: 'dashed' }}>
                      <span className="no">{saved.length + idx + 1}</span>
                      <span className="nm"><strong>{p.title_en || `Class ${saved.length + idx + 1}`}</strong>{p.title_ta && <span className="mut" style={{ display: 'block' }}>{p.title_ta}</span>}<span className="mut" style={{ display: 'block' }}>{p.file.name} ({(p.file.size / 1048576).toFixed(1)} MB) · uploads when you save</span></span>
                      <button type="button" className="btn sm dng" onClick={() => setPending((l) => l.filter((x) => x.key !== p.key))}>Remove</button>
                    </div>
                  ))}
                  {!clsLoading && saved.length + pending.length === 0 && <p className="mut" style={{ marginBottom: 14 }}>No classes yet. Add the first class above.</p>}
                  {pending.length > 0 && <p className="hint mut" style={{ marginBottom: 14 }}>{pending.length} class{pending.length === 1 ? '' : 'es'} will upload when you press Save.</p>}
                </>
              )}

              <h3 className="sech">Cover image (optional)</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="thumb" style={{ width: 96, height: 72 }}>{coverPrev && !removeCover ? <img src={coverPrev} alt="" /> : 'No cover'}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label className="btn" style={{ cursor: 'pointer' }}>{coverPrev && !removeCover ? 'Change cover' : 'Add cover'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pickCover(e.target.files?.[0])} /></label>
                  {coverPrev && !removeCover && <button type="button" className="btn" onClick={() => { setRemoveCover(true); setCover(null); }}>Remove</button>}
                </div>
              </div>
              {errs.cover && <span role="alert" className="err">{errs.cover}</span>}
            </div>
            <div className="df">
              <button type="button" className="btn" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={saving || t.anyBusy}>
                {saving ? (pending.length ? 'Saving and uploading...' : 'Saving...') : t.anyBusy ? 'Converting Tamil...' : edit ? 'Save changes' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {delItem && <Confirm title="Delete this audio?" text={`${delItem.title_en}. ${delItem.kind === 'series' ? `All ${delItem.class_count} class(es) and their audio files are removed too. ` : 'The audio file is removed too. '}This cannot be undone.`} busy={deleting} onYes={doDelete} onNo={() => setDelItem(null)} />}
      {delCls && <Confirm title="Delete this class?" text={`${delCls.title_en}. Its audio file is removed too. This cannot be undone.`} busy={delClsBusy} onYes={removeSaved} onNo={() => setDelCls(null)} />}
    </div>
  );
}