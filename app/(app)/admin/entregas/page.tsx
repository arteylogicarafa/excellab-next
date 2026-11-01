import { guard } from '@/lib/session';
import { all } from '@/lib/db';
import { fmtDate } from '@/lib/helpers';
import StatusBadge from '@/components/StatusBadge';

export const metadata = { title: 'Entregas' };

// Entregas de casos (réplica de SubmissionsController::index + admin/submissions/index.php).
export default async function EntregasPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; status?: string; case?: string; student?: string }>;
}) {
  await guard('staff', '/admin/entregas');
  const sp = await searchParams;
  const f = {
    mode: sp.mode ?? 'file',
    status: sp.status ?? '',
    case: sp.case ?? '',
    student: sp.student ?? '',
  };

  const where: string[] = [];
  const params: unknown[] = [];
  if (['submitted', 'reviewed'].includes(f.status)) {
    where.push('s.status=?');
    params.push(f.status);
  }
  if (Number(f.case)) {
    where.push('s.case_id=?');
    params.push(Number(f.case));
  }
  if (Number(f.student)) {
    where.push('s.student_id=?');
    params.push(Number(f.student));
  }
  if (['file', 'platform'].includes(f.mode)) {
    where.push('c.mode=?');
    params.push(f.mode);
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [rows, cases, students] = await Promise.all([
    all(
      `SELECT s.*, u.name AS student, c.title AS case_title, c.mode, c.points AS max_points FROM case_submissions s
        JOIN users u ON u.id=s.student_id JOIN practical_cases c ON c.id=s.case_id ${w} ORDER BY (s.status='submitted') DESC, s.id DESC LIMIT 200`,
      params,
    ),
    all('SELECT id, title FROM practical_cases ORDER BY title'),
    all('SELECT id, name FROM users WHERE role_id=3 ORDER BY name'),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <i className="bi bi-inbox text-success" /> Entregas de casos prácticos
          </h1>
          <p>Revisa y califica los archivos entregados por los estudiantes.</p>
        </div>
      </div>
      <form className="card-x p-3 mb-3" method="get" action="/admin/entregas">
        <div className="row g-2">
          <div className="col-6 col-md-2">
            <select className="form-select" name="mode" aria-label="Modalidad">
              <option value="file" selected={f.mode === 'file'}>
                Archivos Excel
              </option>
              <option value="platform" selected={f.mode === 'platform'}>
                En plataforma
              </option>
              <option value="" selected={f.mode === ''}>
                Todas
              </option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select" name="status" aria-label="Estado">
              <option value="">Todos los estados</option>
              <option value="submitted" selected={f.status === 'submitted'}>
                Pendientes
              </option>
              <option value="reviewed" selected={f.status === 'reviewed'}>
                Revisadas
              </option>
            </select>
          </div>
          <div className="col-md-3">
            <select className="form-select" name="case" aria-label="Caso">
              <option value="">Todos los casos</option>
              {cases.map((c) => (
                <option key={String(c.id)} value={String(c.id)} selected={f.case === String(c.id)}>
                  {String(c.title)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <select className="form-select" name="student" aria-label="Estudiante">
              <option value="">Todos los estudiantes</option>
              {students.map((st) => (
                <option key={String(st.id)} value={String(st.id)} selected={f.student === String(st.id)}>
                  {String(st.name)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <button className="btn btn-primary">
              <i className="bi bi-funnel" /> Filtrar
            </button>
          </div>
        </div>
      </form>
      <div className="card-x">
        <div className="table-responsive">
          <table className="table table-x table-hover align-middle">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estudiante</th>
                <th>Caso</th>
                <th>Archivo</th>
                <th>Nota</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty py-4">
                      <i className="bi bi-inbox" />No hay entregas con estos filtros.
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td className="text-nowrap">{fmtDate(String(r.created_at))}</td>
                  <td>{String(r.student)}</td>
                  <td>{String(r.case_title)}</td>
                  <td>
                    {r.original_name ? (
                      <>
                        <i className="bi bi-file-earmark-excel text-success" /> {String(r.original_name)}
                      </>
                    ) : (
                      <span className="text-muted">Auto-calificado</span>
                    )}
                  </td>
                  <td>{r.score !== null && r.score !== undefined ? `${Math.round(Number(r.score) * 10) / 10} / ${Number(r.max_points)}` : '—'}</td>
                  <td>
                    <StatusBadge status={String(r.status)} />
                  </td>
                  <td className="text-end">
                    <a className="btn btn-sm btn-soft" href={`/admin/entregas/${r.id}`}>
                      {r.status === 'submitted' ? 'Revisar' : 'Ver'}
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
