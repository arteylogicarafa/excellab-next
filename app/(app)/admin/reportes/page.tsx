import { guard } from '@/lib/session';
import { all, one } from '@/lib/db';
import { fmtDate } from '@/lib/helpers';
import { unionSql, REPORT_TYPES as TYPES } from '@/lib/services/reports';

export const metadata = { title: 'Reportes' };


const GOOD = ['Correcto', 'Superado', 'Aprobado', 'Completada', 'Revisado'];

// Reportes (réplica de ReportsController::index + admin/reports/index.php).
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; module?: string; type?: string; from?: string; to?: string }>;
}) {
  await guard('staff', '/admin/reportes');
  const sp = await searchParams;
  const f = {
    student: sp.student ?? '',
    module: sp.module ?? '',
    type: sp.type ?? '',
    from: sp.from ?? '',
    to: sp.to ?? '',
  };

  const where: string[] = [];
  const params: unknown[] = [];
  if (Number(f.student)) {
    where.push('x.student_id=?');
    params.push(Number(f.student));
  }
  if (Number(f.module)) {
    where.push('x.module_id=?');
    params.push(Number(f.module));
  }
  if (f.type in TYPES) {
    where.push('x.kind=?');
    params.push(f.type);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.from)) {
    where.push('x.occurred_at >= ?');
    params.push(f.from + ' 00:00:00');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.to)) {
    where.push('x.occurred_at <= ?');
    params.push(f.to + ' 23:59:59');
  }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const base = 'FROM (' + unionSql() + ') x JOIN users u ON u.id=x.student_id LEFT JOIN modules m ON m.id=x.module_id' + w;

  const [rows, summary, students, modules] = await Promise.all([
    all(
      `SELECT x.occurred_at, u.id AS student_id, u.name AS student, x.kind, x.activity, m.title AS module_title, x.result, x.score ${base} ORDER BY x.occurred_at DESC NULLS LAST LIMIT 300`,
      params,
    ),
    one(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT x.student_id) AS students,
        SUM(CASE WHEN x.kind='exercise' AND x.result='Correcto' THEN 1 ELSE 0 END) AS ok_ex, SUM(CASE WHEN x.kind='exercise' THEN 1 ELSE 0 END) AS all_ex,
        AVG(CASE WHEN x.kind='assessment' THEN x.score END) AS avg_assess ${base}`,
      params,
    ),
    all('SELECT id, name FROM users WHERE role_id=3 ORDER BY name'),
    all('SELECT id, title FROM modules ORDER BY position'),
  ]);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== '') qs.set(k, v);
  const query = qs.toString();

  const allEx = Number(summary?.all_ex ?? 0);
  const okEx = Number(summary?.ok_ex ?? 0);
  const avgAssess = summary?.avg_assess ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <i className="bi bi-file-earmark-bar-graph text-success" /> Reportes
          </h1>
          <p>
            Filtra la actividad por estudiante, módulo, tipo de actividad y fecha. Exporta el resultado a CSV (se abre
            en Excel).
          </p>
        </div>
        <a className="btn btn-primary" href={`/admin/reportes?${query}${query ? '&' : ''}export=1`}>
          <i className="bi bi-download" /> Exportar CSV
        </a>
      </div>
      <form className="card-x p-3 mb-3" method="get" action="/admin/reportes">
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label small mb-1">Estudiante</label>
            <select className="form-select" name="student">
              <option value="">Todos</option>
              {students.map((st) => (
                <option key={String(st.id)} value={String(st.id)} selected={f.student === String(st.id)}>
                  {String(st.name)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Módulo</label>
            <select className="form-select" name="module">
              <option value="">Todos</option>
              {modules.map((m) => (
                <option key={String(m.id)} value={String(m.id)} selected={f.module === String(m.id)}>
                  {String(m.title)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">Actividad</label>
            <select className="form-select" name="type">
              <option value="">Todas</option>
              {Object.entries(TYPES).map(([k, l]) => (
                <option key={k} value={k} selected={f.type === k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small mb-1">Desde</label>
            <input className="form-control" type="date" name="from" defaultValue={f.from} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small mb-1">Hasta</label>
            <input className="form-control" type="date" name="to" defaultValue={f.to} />
          </div>
          <div className="col-12 d-flex gap-2">
            <button className="btn btn-primary">
              <i className="bi bi-funnel" /> Aplicar filtros
            </button>
            <a className="btn btn-light" href="/admin/reportes">
              Limpiar
            </a>
          </div>
        </div>
      </form>
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-3">
          <div className="card-x stat-card">
            <div className="stat-icon">
              <i className="bi bi-list-check" />
            </div>
            <div>
              <div className="stat-value">{Number(summary?.total ?? 0)}</div>
              <div className="stat-label">Registros</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card-x stat-card">
            <div className="stat-icon blue">
              <i className="bi bi-people" />
            </div>
            <div>
              <div className="stat-value">{Number(summary?.students ?? 0)}</div>
              <div className="stat-label">Estudiantes</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card-x stat-card">
            <div className="stat-icon amber">
              <i className="bi bi-check2-circle" />
            </div>
            <div>
              <div className="stat-value">{allEx ? `${Math.round((okEx / allEx) * 100)}%` : '—'}</div>
              <div className="stat-label">Aciertos en ejercicios</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card-x stat-card">
            <div className="stat-icon violet">
              <i className="bi bi-clipboard-check" />
            </div>
            <div>
              <div className="stat-value">{avgAssess !== null ? `${Math.round(Number(avgAssess))}%` : '—'}</div>
              <div className="stat-label">Promedio en evaluaciones</div>
            </div>
          </div>
        </div>
      </div>
      <div className="card-x">
        <div className="table-responsive">
          <table className="table table-x table-hover align-middle">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estudiante</th>
                <th>Actividad</th>
                <th>Detalle</th>
                <th>Módulo</th>
                <th>Resultado</th>
                <th>Puntaje</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty py-4">
                      <i className="bi bi-search" />No hay registros con estos filtros.
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                const good = GOOD.includes(String(r.result));
                const pending = r.result === 'Pendiente';
                return (
                  <tr key={i}>
                    <td className="small text-nowrap">{fmtDate(String(r.occurred_at))}</td>
                    <td>
                      <a href={`/admin/seguimiento/${r.student_id}`}>{String(r.student)}</a>
                    </td>
                    <td>
                      <span className="chip">{TYPES[String(r.kind)] ?? String(r.kind)}</span>
                    </td>
                    <td>{String(r.activity)}</td>
                    <td className="small text-muted">{String(r.module_title ?? '—')}</td>
                    <td>
                      <span className={`chip ${good ? 'success' : pending ? 'warning' : 'danger'}`}>{String(r.result)}</span>
                    </td>
                    <td>
                      {r.score !== null && r.score !== undefined
                        ? `${Math.round(Number(r.score) * 10) / 10}${r.kind === 'assessment' ? '%' : ''}`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length >= 300 && (
          <div className="p-3 small text-muted border-top">
            Se muestran los 300 registros más recientes. Usa «Exportar CSV» para obtener todos.
          </div>
        )}
      </div>
    </>
  );
}
