import React from 'react';
import { ROLE_LABEL } from '../lib/access';
import { DashShell, Skeleton, Stat, dayTime, num, span, useDash } from './DashKit';

interface Data {
  generated_at: string;
  server: { node: string; platform: string; env: string; pid: number; uptime_s: number; host: string; rss_mb: number; heap_mb: number; heap_total_mb: number; load: number[]; cpus: number; free_mb: number; total_mb: number };
  deploy: { commit: string; branch: string; committed_at: string; message: string };
  database: { ok: boolean; error: string; version: string; ping_ms: number; threads_connected: number; threads_running: number; server_uptime_s: number };
  tables: { name: string; rows: number; mb: number }[];
  roles: { role: string; n: number; active: number }[];
  manual: { kind: string; n: number; cancelled: number; last: string }[];
  log: { at: string; level: 'error' | 'warn'; text: string }[];
}

export default function DeveloperDashboard() {
  const { data, err, loading, reload } = useDash<Data>('developer');
  const d = data;
  const errors = d ? d.log.filter((l) => l.level === 'error').length : 0;

  return (
    <DashShell title="Developer Dashboard" sub="Health of the server and the database, the running version and the latest errors." at={d?.generated_at} loading={loading} onReload={reload} error={err}>
      {!d ? (loading ? <Skeleton /> : null) : (
        <>
          <div className="dk-grid g4">
            <Stat label="Database" value={d.database.ok ? 'Connected' : 'Not reachable'} sub={d.database.ok ? `${d.database.ping_ms} ms, ${d.database.threads_connected} connections open` : d.database.error} tone={d.database.ok ? (d.database.ping_ms > 800 ? 'warn' : 'good') : 'bad'} />
            <Stat label="Server running for" value={span(d.server.uptime_s)} sub={`Node ${d.server.node}, ${d.server.env}`} tone="good" />
            <Stat label="Memory in use" value={`${d.server.rss_mb} MB`} sub={`heap ${d.server.heap_mb} of ${d.server.heap_total_mb} MB`} />
            <Stat label="Errors since the last start" value={num(errors)} sub={`${d.log.length - errors} warnings kept`} tone={errors ? 'bad' : 'good'} />
          </div>

          <div className="dk-grid g2">
            <section className="dk-card">
              <h2>Running version</h2>
              {d.deploy.commit ? (
                <dl className="dk-kv">
                  <dt>Commit</dt><dd>{d.deploy.commit}</dd>
                  <dt>Branch</dt><dd>{d.deploy.branch}</dd>
                  <dt>Committed</dt><dd>{d.deploy.committed_at ? dayTime(d.deploy.committed_at) : '-'}</dd>
                  <dt>Message</dt><dd>{d.deploy.message || '-'}</dd>
                </dl>
              ) : <p className="dk-empty">The version could not be read here (git is not available to the server).</p>}
              <h3>Server</h3>
              <dl className="dk-kv">
                <dt>Host</dt><dd>{d.server.host}</dd>
                <dt>System</dt><dd>{d.server.platform}</dd>
                <dt>Process</dt><dd>{d.server.pid}</dd>
                <dt>CPU load (1, 5, 15 min)</dt><dd>{d.server.load.join(' / ')} on {d.server.cpus} cores</dd>
                <dt>Machine memory free</dt><dd>{num(d.server.free_mb)} of {num(d.server.total_mb)} MB</dd>
              </dl>
            </section>

            <section className="dk-card">
              <h2>Database</h2>
              <dl className="dk-kv">
                <dt>Version</dt><dd>{d.database.version || '-'}</dd>
                <dt>Answer time</dt><dd>{d.database.ping_ms} ms</dd>
                <dt>Connections open</dt><dd>{d.database.threads_connected}</dd>
                <dt>Queries running</dt><dd>{d.database.threads_running}</dd>
                <dt>Database up for</dt><dd>{d.database.server_uptime_s ? span(d.database.server_uptime_s) : '-'}</dd>
              </dl>
              <h3>Logins by role</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {d.roles.map((r) => <span key={r.role} className="dk-pill info">{ROLE_LABEL[r.role] || r.role}: {r.active}{r.n !== r.active ? ` of ${r.n}` : ''}</span>)}
              </div>
              <h3>Counter (offline) entries</h3>
              {d.manual.length === 0 ? <p className="dk-mut">None yet.</p> : (
                <ul className="dk-rows">
                  {d.manual.map((m) => <li key={m.kind}><span>{m.kind}</span><span><strong>{num(m.n)}</strong> <span className="dk-mut">({m.cancelled} cancelled{m.last ? `, last ${dayTime(m.last)}` : ''})</span></span></li>)}
                </ul>
              )}
            </section>
          </div>

          <section className="dk-card" style={{ marginBottom: 12 }}>
            <h2>Largest tables</h2>
            {d.tables.length === 0 ? <p className="dk-empty">No table information.</p> : (
              <div className="dk-wrap">
                <table className="dk-tbl">
                  <thead><tr><th>Table</th><th className="r">Rows (about)</th><th className="r">Size</th></tr></thead>
                  <tbody>{d.tables.map((t) => <tr key={t.name}><td>{t.name}</td><td className="r">{num(t.rows)}</td><td className="r">{t.mb} MB</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dk-card">
            <h2>Latest errors and warnings</h2>
            {d.log.length === 0 ? <p className="dk-empty">Nothing logged since the server started.</p> : (
              <div className="dk-wrap">
                <table className="dk-tbl dk-log">
                  <thead><tr><th>Time</th><th>Level</th><th>Message</th></tr></thead>
                  <tbody>
                    {d.log.map((l, i) => (
                      <tr key={`${l.at}-${i}`}>
                        <td style={{ whiteSpace: 'nowrap' }}>{dayTime(l.at)}</td>
                        <td><span className={`dk-pill ${l.level === 'error' ? 'bad' : 'warn'}`}>{l.level}</span></td>
                        <td style={{ wordBreak: 'break-word' }}>{l.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </DashShell>
  );
}