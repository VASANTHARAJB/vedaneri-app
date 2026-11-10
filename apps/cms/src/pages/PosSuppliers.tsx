import React, { useCallback, useEffect, useState } from 'react';
import { useFlash } from './DiscoverKit';
import { inr } from './PaymentCharts';
import { Field, Modal, PosShell, posApi } from './PosKit';

type Supplier = { id: number; name: string; phone: string; email: string; address: string; gstin: string; notes: string; active: boolean; purchases: number; purchased: number };
type Form = { id: number | null; name: string; phone: string; email: string; address: string; gstin: string; notes: string; active: boolean };
const blank: Form = { id: null, name: '', phone: '', email: '', address: '', gstin: '', notes: '', active: true };

export default function PosSuppliers() {
  const { notice, flash, clear } = useFlash();
  const [items, setItems] = useState<Supplier[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [formErr, setFormErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await posApi<{ items: Supplier[] }>(`/suppliers${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)).items); }
    catch (e: any) { flash('err', e?.message || 'Could not load the suppliers.'); }
    finally { setLoading(false); }
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const save = async () => {
    if (!form) return;
    setBusy(true); setFormErr('');
    try {
      await posApi(form.id ? `/suppliers/${form.id}` : '/suppliers', { method: form.id ? 'PUT' : 'POST', body: form });
      flash('ok', form.id ? 'Supplier saved.' : 'Supplier added.'); setForm(null); load();
    } catch (e: any) { setFormErr(e?.message || 'Could not save the supplier.'); }
    finally { setBusy(false); }
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <PosShell title="Suppliers" sub="The people you buy stock from. Pick a supplier when you record a purchase." notice={notice} clear={clear}
      actions={<button type="button" className="pdx-btn ps-btn-main" onClick={() => { setFormErr(''); setForm(blank); }}>+ Add supplier</button>}>
      <div className="pdx-card" style={{ marginBottom: 14 }}>
        <Field label="Search"><input className="pdx-inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone" autoComplete="off" style={{ maxWidth: 360 }} /></Field>
      </div>
      <div className="ps-table-wrap">
        <table className="ps-table">
          <thead><tr><th>Supplier</th><th>Contact</th><th>GSTIN</th><th className="r">Purchases</th><th className="r">Bought so far</th><th /></tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className={s.active ? '' : 'off'}>
                <td><b>{s.name}</b>{!s.active && <span className="ps-pill x" style={{ marginLeft: 6 }}>Stopped</span>}{s.address && <small>{s.address}</small>}</td>
                <td>{s.phone || '-'}{s.email && <small>{s.email}</small>}</td>
                <td>{s.gstin || '-'}</td>
                <td className="r">{s.purchases}</td>
                <td className="r">{inr(s.purchased)}</td>
                <td className="r"><button type="button" className="ps-link" onClick={() => { setFormErr(''); setForm({ ...s }); }}>Edit</button></td>
              </tr>
            ))}
            {!loading && !items.length && <tr><td colSpan={6}><p className="ps-empty">No suppliers yet.</p></td></tr>}
          </tbody>
        </table>
      </div>
      {form && (
        <Modal title={form.id ? 'Edit supplier' : 'Add supplier'} onClose={() => setForm(null)}
          foot={<><button type="button" className="pdx-btn" onClick={() => setForm(null)}>Cancel</button><button type="button" className="pdx-btn ps-btn-main" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save supplier'}</button></>}>
          {formErr && <div className="ps-err" role="alert">{formErr}</div>}
          <div className="ps-grid" style={{ marginTop: 0 }}>
            <div style={{ gridColumn: '1 / -1' }}><Field label="Supplier name *"><input className="pdx-inp" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus autoComplete="off" /></Field></div>
            <Field label="Mobile / phone"><input className="pdx-inp" value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="off" /></Field>
            <Field label="Email"><input className="pdx-inp" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" /></Field>
            <Field label="GSTIN"><input className="pdx-inp" value={form.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} maxLength={15} autoComplete="off" /></Field>
            <div style={{ gridColumn: '1 / -1' }}><Field label="Address"><textarea className="pdx-inp" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} /></Field></div>
            <div style={{ gridColumn: '1 / -1' }}><Field label="Notes"><input className="pdx-inp" value={form.notes} onChange={(e) => set('notes', e.target.value)} autoComplete="off" /></Field></div>
          </div>
          {form.id && <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 14 }}><input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> Still buying from this supplier</label>}
        </Modal>
      )}
    </PosShell>
  );
}