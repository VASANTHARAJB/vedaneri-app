import React, { useCallback, useEffect, useState } from 'react';
import { API, authHeader, failText, readJson } from './DiscoverKit';
import { PDX_CSS } from './PaymentCharts';
import { useAuth } from '../lib/auth';

// 80G donations for the Donation Register: what is in a financial year, and the file for 80G receipts and the yearly return.
// Super admin and admin only (the server enforces the same rule).
const API_BASE = String(API).replace(/\/discover\/?$/, '');
const G80 = `${API_BASE}/registers/admin/donation80g`;

type Row = { id: number; name: string; phone: string; pan: string };
type Preview = { count: number; withPan: number; withoutPan: number; badPan: number; rows: Row[] };

export default function Donation80gCard() {
  const auth = useAuth() as any;
  const role = String(auth?.user?.role || '');
  const isAdmin = role === 'superadmin' || role === 'admin';

  const now = new Date();
  const thisFy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // the Indian financial year starts in April
  const [fy, setFy] = useState(thisFy);
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);

  const qs = useCallback(() => new URLSearchParams({ from: `${fy}-04-01`, to: `${fy + 1}-03-31` }).toString(), [fy]);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${G80}/preview?${qs()}`, { headers: authHeader(), cache: 'no-store' });
      const j = await readJson(res);
      if (!res.ok) throw new Error(failText(j, `Could not load the 80G donations (${res.status}).`));
      setData(j as Preview);
    } catch (e: any) { setData(null); setErr(e?.message || 'Could not load the 80G donations.'); } finally { setLoading(false); }
  }, [qs]);

  useEffect(() => { if (isAdmin && open) load(); }, [isAdmin, open, load]);

  async function download() {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`${G80}/export?${qs()}`, { headers: authHeader() });
      if (!res.ok) { setErr(failText(await readJson(res), 'Could not make the 80G file.')); return; }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `80g-donations-${fy}-${String(fy + 1).slice(2)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { setErr('Network error. Please try again.'); } finally { setBusy(false); }
  }

  if (!isAdmin) return null;

  return (
    <div className="pdx" style={{ marginBottom: 14 }}>
      <style>{PDX_CSS}</style>
      <div className="pdx-card">
        <div className="pdx-top" style={{ marginBottom: open ? 12 : 0 }}>
          <div>
            <h3>80G donations</h3>
            <p className="pdx-sub" style={{ maxWidth: 720 }}>
              Donor name, PAN and mobile number of the paid donations in a financial year. Admins only; each download is recorded.
            </p>
          </div>
          <div className="pdx-row">
            <div>
              <label className="pdx-lbl" htmlFor="g80fy">Financial year</label>
              <select id="g80fy" className="pdx-inp" value={fy} onChange={(e) => setFy(Number(e.target.value))}>
                {[0, 1, 2, 3].map((i) => <option key={i} value={thisFy - i}>{`April ${thisFy - i} to March ${thisFy - i + 1}`}</option>)}
              </select>
            </div>
            <button type="button" className="pdx-btn" onClick={() => setOpen((o) => !o)}>{open ? 'Hide list' : 'Show list'}</button>
            <button type="button" className="pdx-btn on" onClick={download} disabled={busy}>{busy ? 'Preparing...' : 'Download 80G file'}</button>
          </div>
        </div>

        {err && <p role="alert" className="pdx-err" style={{ marginTop: 8 }}>{err}</p>}

        {open && (
          loading ? <p className="pdx-sub">Loading...</p> : data && (
            <>
              <div className="pdx-row" style={{ gap: 18, margin: '4px 0 10px' }}>
                <span><b>{data.count}</b> paid donation{data.count === 1 ? '' : 's'}</span>
                <span>With PAN <b>{data.withPan}</b></span>
                <span>Without PAN <b>{data.withoutPan}</b></span>
                {data.badPan > 0 && <span>PAN format to check <b>{data.badPan}</b></span>}
              </div>
              {data.count === 0 ? (
                <p className="pdx-sub">No paid donations in this financial year.</p>
              ) : (
                <div className="pdx-tablewrap">
                  <table style={{ minWidth: 480 }}>
                    <thead><tr>{['Donor name', 'PAN', 'Mobile'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                    <tbody>
                      {data.rows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name || '-'}</td>
                          <td>{r.pan || <span className="pdx-mut">Missing</span>}</td>
                          <td>{r.phone || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data.count > data.rows.length && <p className="pdx-sub" style={{ marginTop: 8 }}>Showing the latest {data.rows.length}. The downloaded file has all {data.count}.</p>}
            </>
          )
        )}
      </div>
    </div>
  );
}