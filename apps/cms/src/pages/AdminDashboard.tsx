import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLE_LABEL, canOpen } from '../lib/access';
import { DashShell, KIND_LABEL, Skeleton, Stat, dayTime, inr, num, useDash } from './DashKit';
import { useAuth } from '../lib/auth';

interface Data {
  generated_at: string;
  kinds: { kind: string; today: { n: number; amount: number; offline_n: number; offline_amount: number }; month: { n: number; amount: number }; pending: number; failed: number; cancelled: number; next7: number; expiring: number }[];
  today: { n: number; amount: number; offline_n: number; offline_amount: number };
  attention: { pending: number; failed: number; cancelled: number; magazine_expiring: number };
  next7: number;
  counters: { who: string; n: number; amount: number; kinds: Record<string, number> }[];
  recent: { kind: string; id: string; source: string; name: string; item: string; amount: number; status: string; receipt_no: string; at: string }[];
  staff: { role: string; n: number; active: number }[];
  devotees: { total: number; month: number; today: number };
}

const TONE: Record<string, string> = { PAID: 'ok', FREE: 'info', PENDING: 'warn', FAILED: 'bad', CANCELLED: 'off' };
const STATUS: Record<string, string> = { PAID: 'Paid', FREE: 'Free', PENDING: 'Waiting', FAILED: 'Failed', CANCELLED: 'Cancelled' };

export default function AdminDashboard() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, err, loading, reload } = useDash<Data>('admin');
  const may = (slug: string) => canOpen(user?.role, slug, user?.page_access);
  const a = data?.attention;

  return (
    <DashShell title="Admin Dashboard" sub="What is happening at the counters today, and what needs attention." at={data?.generated_at} loading={loading} onReload={reload} error={err}>
      {!data ? (loading ? <Skeleton /> : null) : (
        <>
          <div className="dk-grid g4">
            <Stat label="Entries today" value={num(data.today.n)} sub={`${inr(data.today.amount)} received`} tone="good" />
            <Stat label="At the counter today" value={num(data.today.offline_n)} sub={`${inr(data.today.offline_amount)} in offline entries`} />
            <Stat label="Coming up in 7 days" value={num(data.next7)} sub="seva, donation and camp dates" />
            <Stat label="Devotees" value={num(data.devotees.total)} sub={`${num(data.devotees.today)} new today, ${num(data.devotees.month)} this month`} />
          </div>

          <section className="dk-card" style={{ marginBottom: 12 }}>
            <h2>Needs attention</h2>
            <div className="dk-grid g4" style={{ marginBottom: 0 }}>
              <Stat label="Waiting for payment" value={num(a!.pending)} sub="last 7 days" tone={a!.pending ? 'warn' : 'good'} />
              <Stat label="Failed payments" value={num(a!.failed)} sub="last 7 days" tone={a!.failed ? 'bad' : 'good'} />
              <Stat label="Cancelled entries" value={num(a!.cancelled)} sub="last 30 days" />
              <Stat label="Magazine ending" value={num(a!.magazine_expiring)} sub="within 30 days" tone={a!.magazine_expiring ? 'warn' : 'good'} />
            </div>
          </section>

          <div className="dk-grid g2">
            <section className="dk-card">
              <h2>Today by register</h2>
              <div className="dk-wrap">
                <table className="dk-tbl">
                  <thead><tr><th>Register</th><th className="r">Entries</th><th className="r">Amount</th><th className="r">At the counter</th><th /></tr></thead>
                  <tbody>
                    {data.kinds.map((k) => (
                      <tr key={k.kind}>
                        <td>{KIND_LABEL[k.kind]}</td>
                        <td className="r">{num(k.today.n)}</td>
                        <td className="r">{inr(k.today.amount)}</td>
                        <td className="r">{num(k.today.offline_n)}</td>
                        <td className="r">
                          {may(`${k.kind}-offline`) && <button type="button" className="dk-link" onClick={() => nav(`/${k.kind}-offline`)}>New entry</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="dk-card">
              <h2>Counter entries today, by login</h2>
              {data.counters.length === 0 ? <p className="dk-empty">No counter entries yet today.</p> : (
                <div className="dk-wrap">
                  <table className="dk-tbl">
                    <thead><tr><th>Login</th><th className="r">Entries</th><th className="r">Amount</th></tr></thead>
                    <tbody>
                      {data.counters.map((c) => (
                        <tr key={c.who}>
                          <td>{c.who}<span className="dk-mut" style={{ display: 'block', fontSize: 11.5 }}>{Object.entries(c.kinds).map(([k, v]) => `${KIND_LABEL[k] || k} ${v}`).join(', ')}</span></td>
                          <td className="r">{num(c.n)}</td>
                          <td className="r">{inr(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="dk-card" style={{ marginBottom: 12 }}>
            <h2>Latest entries</h2>
            {data.recent.length === 0 ? <p className="dk-empty">No entries yet.</p> : (
              <div className="dk-wrap">
                <table className="dk-tbl">
                  <thead><tr><th>When</th><th>Register</th><th>Name</th><th>Item</th><th>Receipt</th><th>Where</th><th>Status</th><th className="r">Amount</th></tr></thead>
                  <tbody>
                    {data.recent.map((r) => (
                      <tr key={`${r.kind}-${r.source}-${r.id}`}>
                        <td style={{ whiteSpace: 'nowrap' }}>{r.at ? dayTime(r.at.replace(' ', 'T')) : ''}</td>
                        <td>{KIND_LABEL[r.kind]}</td>
                        <td>{r.name || <span className="dk-mut">-</span>}</td>
                        <td>{r.item}</td>
                        <td>{r.receipt_no || <span className="dk-mut">-</span>}</td>
                        <td>{r.source === 'manual' ? 'Counter' : 'Online'}</td>
                        <td><span className={`dk-pill ${TONE[r.status] || 'off'}`}>{STATUS[r.status] || r.status}</span></td>
                        <td className="r">{inr(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dk-card">
            <h2>Staff logins</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.staff.map((s) => <span key={s.role} className="dk-pill info">{ROLE_LABEL[s.role] || s.role}: {s.active} active{s.n !== s.active ? ` of ${s.n}` : ''}</span>)}
            </div>
          </section>
        </>
      )}
    </DashShell>
  );
}