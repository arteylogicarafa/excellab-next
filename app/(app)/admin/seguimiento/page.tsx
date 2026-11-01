import { guard } from '@/lib/session';
import { all } from '@/lib/db';
import { timeAgo } from '@/lib/helpers';
import * as stats from '@/lib/services/stats';
import * as progress from '@/lib/services/progress';
import StatusBadge from '@/components/StatusBadge';

export const metadata = { title: 'Seguimiento' };

// Progreso individual (réplica de TrackingController::index + admin/tracking/index.php).
export default async function SeguimientoPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await guard('staff', '/admin/seguimiento');
  const sp = await searchParams;
  const q = sp.q ?? '';

  let params: unknown[] = [];
  let w = '';
  if (q !== '') {
    w = ' AND (u.name ILIKE ? OR u.email ILIKE ?)';
    const like = '%' + q.replace(/([%_\\])/g, '\\$1') + '%';
    params = [like, like];
  }
  const students = await all(
    `SELECT u.id, u.name, u.email, u.status,
        (SELECT MAX(created_at) FROM activity_log al WHERE al.user_id=u.id) AS last_activity
      FROM users u WHERE u.role_id=3 AND u.status<>'archived' ${w} ORDER BY u.name`,
    params,
  );
  const map = await stats.pointsMap();
  const rows: (Record<string, unknown> & { progress: number; points: number })[] = [];
  for (const st of students) {
    rows.push({
      ...st,
      progress: await progress.overall(Number(st.id)),
      points: Math.round(map[Number(st.id)] ?? 0),
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <i className="bi bi-graph-up-arrow text-success" /> Progreso individual
          </h1>
          <p>Consulta el avance, las actividades y las calificaciones de cada estudiante.</p>
        </div>
        <form className="d-flex gap-2" method="get">
          <input className="form-control" type="search" name="q" defaultValue={q} placeholder="Buscar estudiante…" />
          <button className="btn btn-primary">
            <i className="bi bi-search" />
          </button>
        </form>
      </div>
      <div className="card-x">
        <div className="table-responsive">
          <table className="table table-x table-hover align-middle">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th style={{ minWidth: 180 }}>Progreso general</th>
                <th>Puntos</th>
                <th>Última actividad</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty py-4">No hay estudiantes.</div>
                  </td>
                </tr>
              )}
              {rows.map((st) => (
                <tr key={String(st.id)}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="avatar">{String(st.name).slice(0, 1).toUpperCase()}</div>
                      <div>
                        <div className="fw-semibold">{String(st.name)}</div>
                        <div className="small text-muted">{String(st.email)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="progress flex-grow-1">
                        <div className="progress-bar" style={{ width: `${st.progress}%` }} />
                      </div>
                      <span className="small">{Math.round(st.progress)}%</span>
                    </div>
                  </td>
                  <td>
                    <strong>{st.points}</strong>
                  </td>
                  <td className="small text-muted">{st.last_activity ? timeAgo(String(st.last_activity)) : 'Sin actividad'}</td>
                  <td>
                    <StatusBadge status={String(st.status)} />
                  </td>
                  <td className="text-end">
                    <a className="btn btn-sm btn-soft" href={`/admin/seguimiento/${st.id}`}>
                      Ver detalle
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
