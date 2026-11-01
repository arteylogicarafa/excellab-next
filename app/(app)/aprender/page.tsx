import { guard } from '@/lib/session';
import { all } from '@/lib/db';
import * as progress from '@/lib/services/progress';

export const metadata = { title: 'Aprender Excel' };

// Índice de módulos (réplica de LearnController::index + learn/index.php).
export default async function AprenderPage() {
  const s = await guard('auth', '/aprender');

  const mods =
    s.role === 'estudiante'
      ? await progress.modules(s.uid)
      : await all(
          "SELECT m.*, (SELECT COUNT(*) FROM lessons l WHERE l.module_id=m.id AND l.status='active') AS lessons_total, 0 AS lessons_done, NULL AS certificate_code FROM modules m WHERE m.status='active' ORDER BY m.position",
        );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Aprender Excel</h1>
          <p>Ocho módulos para pasar de cero a aplicar Excel en situaciones reales.</p>
        </div>
      </div>
      <div className="row g-3">
        {mods.map((m, i) => {
          const total = Number(m.lessons_total);
          const done = Number(m.lessons_done);
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <div className="col-md-6 col-xl-4" key={String(m.id)}>
              <a className="card-x module-card" href={`/aprender/modulo/${m.id}`}>
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div className="stat-icon">
                    <i className={`bi ${m.icon}`} />
                  </div>
                  {pct === 100 ? (
                    <span className="chip success">
                      <i className="bi bi-check-circle-fill" /> Completado
                    </span>
                  ) : pct > 0 ? (
                    <span className="chip warning">En curso</span>
                  ) : (
                    <span className="chip">Por empezar</span>
                  )}
                </div>
                <div className="module-num">Módulo {i + 1}</div>
                <h2 className="h5 mb-1">{String(m.title)}</h2>
                <p className="text-muted small mb-3">{String(m.description ?? '')}</p>
                <div className="d-flex justify-content-between small text-muted mb-1">
                  <span>
                    {done} de {total} lecciones
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="progress">
                  <div className="progress-bar" style={{ width: `${pct}%` }} />
                </div>
              </a>
            </div>
          );
        })}
      </div>
    </>
  );
}
