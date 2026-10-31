import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  API, CSS, Cat, CategoriesPanel, Confirm, ErrBox, Notice, Pair, Status, StatusSelect, TamilNotice,
  authHeader, failText, fileUrl, fmtD, readJson, useCats, useFlash, useTamil,
} from './DiscoverKit';

interface Item { id: string; category_id: string | null; category_en: string | null; title_en: string; title_ta: string | null; cover_url: string | null; cover_thumb_url: string | null; item_date: string | null; status: Status; sort_order: number; photo_count: number }
interface Photo { id: string; image_url: string; web_url: string; thumb_url: string }
type NewPhoto = { file: File; url: string; note?: string };
const emptyForm = { category_id: '', title_en: '', title_ta: '', item_date: '', status: 'draft', sort_order: '0' };

const MAX_MB = 200;                    // largest original you can pick (it is shrunk before upload)
const MAX_BYTES = MAX_MB * 1024 * 1024;
const TARGET_BYTES = 7.5 * 1024 * 1024; // every uploaded photo ends up below this (under 8 MB)
const MAX_SIDE = 4096;                 // longest side in pixels after shrinking
const MAX_PHOTOS = 40;
const BATCH = 3;
const mb = (n: number) => (n / 1048576).toFixed(1);

// Shrinks a big photo to a JPEG below TARGET_BYTES. Small photos are returned untouched.
async function shrink(file: File): Promise<{ file: File; note?: string }> {
  if (file.size <= TARGET_BYTES) return { file };
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any); }
  catch { return { file, note: `${file.name} could not be read, so it was kept as it is.` }; }

  let scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  let quality = 0.88;
  let best: Blob | null = null;
  for (let attempt = 0; attempt < 9; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.fillStyle = '#ffffff'; // PNG transparency becomes white in a JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (blob) {
      best = blob;
      if (blob.size <= TARGET_BYTES) break;
    }
    quality = Math.max(0.6, quality - 0.07);
    scale *= 0.85;
  }
  bmp.close?.();
  if (!best || best.size > 8 * 1024 * 1024 - 1) return { file, note: `${file.name} could not be shrunk below 8MB.` };
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return { file: new File([best], name, { type: 'image/jpeg' }), note: `${file.name}: ${mb(file.size)} MB shrunk to ${mb(best.size)} MB` };
}

export default function DiscoverAlbum() {
  const [params, setParams] = useSearchParams();
  const { notice, flash, clear } = useFlash();
  const { cats, reload: reloadCats } = useCats('album');
  const [tab, setTab] = useState<'items' | 'cats'>('items');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<{ message: string; detail?: string } | null>(null);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState<'all' | Status>('all');
  const [fCat, setFCat] = useState('all');

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Item | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState('');
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const [delItem, setDelItem] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const t = useTamil(form, setForm);

  const fetchList = useCallback(async (): Promise<Item[]> => {
    const res = await fetch(`${API}/admin/albums`, { headers: authHeader(), cache: 'no-store' });
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

  const clearNew = () => { newPhotos.forEach((p) => URL.revokeObjectURL(p.url)); setNewPhotos([]); };

  const openNew = useCallback(() => {
    t.reset(); setEdit(null); setForm({ ...emptyForm }); setPhotos([]); setNewPhotos([]); setCover(null); setErrs({}); setProgress(''); setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPhotos(id: string) {
    try {
      const res = await fetch(`${API}/admin/albums/${id}`, { headers: authHeader(), cache: 'no-store' });
      if (res.ok) setPhotos((await res.json()).photos || []);
    } catch { /* shown empty */ }
  }

  const openEdit = (i: Item) => {
    t.reset({ title_ta: !!i.title_ta });
    setEdit(i); setCover(i.cover_url); setPhotos([]); clearNew(); setProgress('');
    setForm({ category_id: i.category_id || '', title_en: i.title_en, title_ta: i.title_ta || '', item_date: i.item_date || '', status: i.status, sort_order: String(i.sort_order) });
    setErrs({}); setOpen(true); loadPhotos(i.id);
  };

  useEffect(() => {
    if (params.get('new') === '1') {
      setTab('items'); openNew();
      const next = new URLSearchParams(params); next.delete('new'); setParams(next, { replace: true });
    }
  }, [params, setParams, openNew]);

  async function pickPhotos(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const room = MAX_PHOTOS - photos.length - newPhotos.length;
    const add: NewPhoto[] = [];
    const notes: string[] = [];
    setPreparing(true);
    try {
      for (const f of files) {
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { if (!notes.includes('Only JPG, PNG or WebP images were added.')) notes.push('Only JPG, PNG or WebP images were added.'); continue; }
        if (f.size > MAX_BYTES) { notes.push(`${f.name} is ${mb(f.size)} MB, more than ${MAX_MB} MB.`); continue; }
        if (add.length >= room) { if (!notes.includes(`An album can have up to ${MAX_PHOTOS} photos.`)) notes.push(`An album can have up to ${MAX_PHOTOS} photos.`); continue; }
        const r = await shrink(f);
        if (r.file.size > 8 * 1024 * 1024 - 1 && r.note) { notes.push(r.note); continue; }
        add.push({ file: r.file, url: URL.createObjectURL(r.file), note: r.note });
      }
    } finally { setPreparing(false); }
    setNewPhotos((p) => [...p, ...add]);
    setErrs((e) => ({ ...e, photos: notes.filter((n) => !/shrunk to/.test(n)).join(' '), form: '' }));
  }
  const dropNewPhoto = (idx: number) => setNewPhotos((p) => { URL.revokeObjectURL(p[idx].url); return p.filter((_, i) => i !== idx); });

  async function removePhoto(p: Photo) {
    if (!edit) return;
    setPhotoBusy(p.id);
    try {
      const res = await fetch(`${API}/admin/albums/${edit.id}/photos/${p.id}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) throw new Error((await readJson(res)).message);
      const left = photos.filter((x) => x.id !== p.id);
      setPhotos(left);
      if (cover === p.image_url) setCover(left[0]?.image_url || null);
      load();
    } catch (e: any) { flash('err', e?.message || 'Could not remove the photo.'); } finally { setPhotoBusy(null); }
  }

  async function makeCover(p: Photo) {
    if (!edit) return;
    setPhotoBusy(p.id);
    try {
      const res = await fetch(`${API}/admin/albums/${edit.id}/cover`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ photoId: p.id }) });
      if (!res.ok) throw new Error((await readJson(res)).message);
      setCover(p.image_url); load();
    } catch (e: any) { flash('err', e?.message || 'Could not set the cover.'); } finally { setPhotoBusy(null); }
  }

  async function sendBatches(albumId: string, list: NewPhoto[], done0: number, total: number): Promise<{ left: NewPhoto[]; error: string }> {
    let done = done0;
    for (let i = 0; i < list.length; i += BATCH) {
      const chunk = list.slice(i, i + BATCH);
      setProgress(`Uploading and optimizing photos ${done + 1} to ${Math.min(done + chunk.length, total)} of ${total}...`);
      const body = new FormData();
      chunk.forEach((p) => body.append('photos', p.file));
      try {
        const res = await fetch(`${API}/admin/albums/${albumId}/photos`, { method: 'POST', headers: authHeader(), body });
        if (!res.ok) return { left: list.slice(i), error: failText(await readJson(res), 'Upload failed.') };
      } catch { return { left: list.slice(i), error: 'Network error.' }; }
      done += chunk.length;
    }
    return { left: [], error: '' };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving || preparing) return;
    const x: Record<string, string> = {};
    if (!form.title_en.trim()) x.title_en = 'Enter the title in English';
    if (!edit && newPhotos.length === 0) x.photos = 'Add at least one photo';
    setErrs(x);
    if (Object.keys(x).length) return;

    setSaving(true);
    const total = newPhotos.length;
    try {
      let albumId: string;
      let rest = newPhotos;
      let done = 0;

      if (!edit) {
        const first = newPhotos.slice(0, BATCH);
        setProgress(`Uploading and optimizing photos 1 to ${first.length} of ${total}...`);
        const body = new FormData();
        Object.entries(form).forEach(([k, v]) => body.append(k, String(v)));
        first.forEach((p) => body.append('photos', p.file));
        const res = await fetch(`${API}/admin/albums`, { method: 'POST', headers: authHeader(), body });
        const d = await readJson(res);
        if (!res.ok) { setErrs({ form: failText(d, 'Could not save the album.') }); return; }
        albumId = d.id; rest = newPhotos.slice(BATCH); done = first.length;
      } else {
        const res = await fetch(`${API}/admin/albums/${edit.id}`, { method: 'PUT', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
        const d = await readJson(res);
        if (!res.ok) { setErrs({ form: failText(d, 'Could not save the album.') }); return; }
        albumId = edit.id;
      }

      const out = await sendBatches(albumId, rest, done, total);
      reloadCats();
      const list = await fetchList();
      setItems(list);

      if (out.left.length) {
        const made = list.find((i) => i.id === albumId) || null;
        const keep = new Set(out.left.map((p) => p.url));
        newPhotos.forEach((p) => { if (!keep.has(p.url)) URL.revokeObjectURL(p.url); });
        setEdit(made); setNewPhotos(out.left); loadPhotos(albumId);
        setErrs({ form: `The album was saved, but ${out.left.length} photo${out.left.length === 1 ? '' : 's'} did not upload. ${out.error} Press Save again to retry.` });
        return;
      }
      t.reset(); clearNew(); setOpen(false);
      flash('ok', edit ? 'Album saved.' : `Album added with ${total} photo${total === 1 ? '' : 's'}.`);
    } catch { setErrs({ form: 'Network error. Please try again.' }); } finally { setSaving(false); setProgress(''); }
  }

  async function setStatus(i: Item, status: Status) {
    try {
      const res = await fetch(`${API}/admin/albums/${i.id}/status`, { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error((await readJson(res)).message);
      setItems((l) => l.map((x) => (x.id === i.id ? { ...x, status } : x)));
    } catch (e: any) { flash('err', e?.message || 'Could not change the status.'); }
  }

  async function doDelete() {
    if (!delItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/admin/albums/${delItem.id}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) throw new Error((await readJson(res)).message);
      flash('ok', 'Album deleted.'); setDelItem(null); load(); reloadCats();
    } catch (e: any) { setDelItem(null); flash('err', e?.message || 'Could not delete.'); } finally { setDeleting(false); }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (delItem) { if (!deleting) setDelItem(null); } else if (open && !saving) setOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [delItem, deleting, open, saving]);

  const nPub = items.filter((i) => i.status === 'published').length;
  const nDraft = items.length - nPub;
  const s = q.trim().toLowerCase();
  const shown = useMemo(() => items.filter((i) =>
    (fStatus === 'all' || i.status === fStatus) && (fCat === 'all' || (fCat === 'none' ? !i.category_id : i.category_id === fCat)) &&
    (!s || `${i.title_en} ${i.title_ta || ''} ${i.category_en || ''}`.toLowerCase().includes(s))
  ), [items, fStatus, fCat, s]);

  const catOptions = (c: Cat) => <option key={c.id} value={c.id}>{c.name_en}</option>;
  const totalNewBytes = newPhotos.reduce((n, p) => n + p.file.size, 0);

  return (
    <div className="dc">
      <style>{CSS}</style>
      <div className="head">
        <div>
          <h1 className="title">Discover: Album</h1>
          <p className="mut" style={{ marginTop: 2 }}>Photo albums. Upload many images at once and choose the cover.</p>
        </div>
        <button type="button" className="btn primary" onClick={openNew}>+ New Album</button>
      </div>
      <Notice notice={notice} onClear={clear} />

      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="tabs">
          <button type="button" className={`tab${tab === 'items' ? ' on' : ''}`} onClick={() => setTab('items')}>Albums ({items.length})</button>
          <button type="button" className={`tab${tab === 'cats' ? ' on' : ''}`} onClick={() => setTab('cats')}>Categories ({cats.length})</button>
        </div>

        {tab === 'cats' ? (
          <CategoriesPanel kind="album" cats={cats} reload={() => { reloadCats(); load(); }} flash={flash} />
        ) : (
          <>
            <div className="toolbar">
              {([['all', `All ${items.length}`], ['published', `Published ${nPub}`], ['draft', `Draft ${nDraft}`]] as const).map(([k, label]) => (
                <button key={k} type="button" className={`chip${fStatus === k ? ' on' : ''}`} onClick={() => setFStatus(k)}>{label}</button>
              ))}
              <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="inp" aria-label="Category">
                <option value="all">All categories</option>{cats.map(catOptions)}<option value="none">No category</option>
              </select>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search" className="inp" style={{ width: 240, maxWidth: '100%' }} />
            </div>

            {loading ? <div>{[0, 1, 2].map((i) => <div key={i} className="skel" />)}</div>
            : loadErr ? <ErrBox message={loadErr.message} detail={loadErr.detail} onRetry={load} />
            : shown.length === 0 ? (
              <div className="empty">
                <p style={{ fontSize: 16, fontWeight: 800 }}>{items.length === 0 ? 'No albums yet' : 'No album matches this filter'}</p>
                {items.length === 0 && <div style={{ marginTop: 16 }}><button type="button" className="btn primary" onClick={openNew}>+ Add the first album</button></div>}
              </div>
            ) : (
              <div className="tblwrap">
                <table className="tbl">
                  <thead><tr><th>Album</th><th>Category</th><th>Photos</th><th>Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                  <tbody>
                    {shown.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div className="thumb">{i.cover_thumb_url || i.cover_url ? <img src={fileUrl(i.cover_thumb_url || i.cover_url)} alt="" loading="lazy" /> : 'Album'}</div>
                            <div><strong>{i.title_en}</strong>{i.title_ta && <span className="mut" style={{ display: 'block' }}>{i.title_ta}</span>}</div>
                          </div>
                        </td>
                        <td>{i.category_en ? <span className="pill cat">{i.category_en}</span> : <span className="mut">None</span>}</td>
                        <td style={{ fontWeight: 700 }}>{i.photo_count}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtD(i.item_date) || <span className="mut">-</span>}</td>
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

      {open && (
        <div className="ov" onClick={() => !saving && setOpen(false)}>
          <form onSubmit={save} noValidate onClick={(e) => e.stopPropagation()} className="drawer" style={{ maxWidth: 780 }}>
            <div className="dh">
              <div><h2 style={{ fontSize: 18, fontWeight: 800 }}>{edit ? 'Edit album' : 'New album'}</h2><p className="mut">Fields marked * are required.</p></div>
              <button type="button" className="btn" disabled={saving} onClick={() => setOpen(false)}>Close</button>
            </div>
            <div className="db">
              {errs.form && <div role="alert" className="alert bad">{errs.form}</div>}
              {saving && progress && <div role="status" className="alert info">{progress}</div>}
              {preparing && <div role="status" className="alert info">Preparing photos: big photos are being shrunk to under 8MB...</div>}
              <TamilNotice t={t} />

              <h3 className="sech">Details</h3>
              <div style={{ marginBottom: 14 }}>
                <label className="lbl" htmlFor="al-cat">Category</label>
                <select id="al-cat" value={form.category_id} onChange={(e) => set('category_id', e.target.value)} className="inp">
                  <option value="">No category</option>{cats.map(catOptions)}
                </select>
                <p className="hint mut">Create categories in the Categories tab.</p>
              </div>
              <Pair t={t} form={form} en="title_en" ta="title_ta" label="Album title" required error={errs.title_en} />
              <div className="g3">
                <div><label className="lbl" htmlFor="al-date">Date</label><input id="al-date" type="date" value={form.item_date} onChange={(e) => set('item_date', e.target.value)} className="inp" /></div>
                <div><label className="lbl" htmlFor="al-so">Order</label><input id="al-so" type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} className="inp" /></div>
                <div>
                  <label className="lbl" htmlFor="al-st">Status</label>
                  <select id="al-st" value={form.status} onChange={(e) => set('status', e.target.value)} className="inp"><option value="draft">Draft</option><option value="published">Published</option></select>
                </div>
              </div>

              <h3 className="sech">Photos {edit ? `(${photos.length} saved)` : '*'}</h3>
              <label className="btn" style={{ cursor: 'pointer' }}>
                {preparing ? 'Preparing...' : edit ? 'Add more photos' : 'Choose photos'}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={preparing}
                  onChange={(e) => { const input = e.target; pickPhotos(input.files).finally(() => { input.value = ''; }); }} />
              </label>
              <span className="mut" style={{ marginLeft: 10 }}>JPG, PNG or WebP, up to {MAX_MB}MB each, up to {MAX_PHOTOS} per album. You can select many at once.</span>
              <p className="hint mut">v2: photos over 8MB are not skipped. They are shrunk to under 8MB before upload, then optimized again for the website.</p>
              {errs.photos && <span role="alert" className="err">{errs.photos}</span>}

              {edit && photos.length > 0 && (
                <>
                  <p className="lbl" style={{ marginTop: 16 }}>Saved photos (changes here apply at once)</p>
                  <div className="photos">
                    {photos.map((p) => (
                      <div key={p.id} className="ph">
                        <img src={fileUrl(p.thumb_url)} alt="" loading="lazy" />
                        {cover === p.image_url && <span className="tag">Cover</span>}
                        <div className="bar">
                          {cover !== p.image_url && <button type="button" className="btn sm" disabled={photoBusy === p.id} onClick={() => makeCover(p)}>Cover</button>}
                          <button type="button" className="btn sm dng" disabled={photoBusy === p.id} onClick={() => removePhoto(p)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {newPhotos.length > 0 && (
                <>
                  <p className="lbl" style={{ marginTop: 16 }}>{newPhotos.length} new photo{newPhotos.length === 1 ? '' : 's'}, {mb(totalNewBytes)} MB in total (uploaded when you save)</p>
                  {newPhotos.some((p) => p.note) && (
                    <p className="hint mut">{newPhotos.filter((p) => p.note).map((p) => p.note).join(' | ')}</p>
                  )}
                  <div className="photos">
                    {newPhotos.map((p, idx) => (
                      <div key={p.url} className="ph">
                        <img src={p.url} alt="" />
                        {!edit && idx === 0 && <span className="tag">Cover</span>}
                        <div className="bar" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="mut" style={{ fontSize: 11 }}>{mb(p.file.size)} MB</span>
                          <button type="button" className="btn sm dng" disabled={saving} onClick={() => dropNewPhoto(idx)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!edit && <p className="hint mut">The first photo becomes the cover. You can change the cover after saving.</p>}
                </>
              )}
            </div>
            <div className="df">
              <button type="button" className="btn" disabled={saving} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={saving || preparing || t.anyBusy}>{saving ? 'Uploading...' : preparing ? 'Preparing photos...' : t.anyBusy ? 'Converting Tamil...' : edit ? 'Save changes' : 'Save album'}</button>
            </div>
          </form>
        </div>
      )}

      {delItem && <Confirm title="Delete this album?" text={`${delItem.title_en} and all ${delItem.photo_count} photo(s) in it are removed. This cannot be undone.`} busy={deleting} onYes={doDelete} onNo={() => setDelItem(null)} />}
    </div>
  );
}