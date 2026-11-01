import { guard } from '@/lib/session';
import { all } from '@/lib/db';
import { fmtDate } from '@/lib/helpers';

export const metadata = { title: 'Evaluaciones' };

// Listado de evaluaciones (réplica de AssessmentController::index + assessments/index.php).
export default async function EvaluacionesPage() {
  const s = await guard('auth', '/evaluaciones');

  const rows = await all(
    `SELECT a.*, m.title AS module_title,
        (SELECT COUNT(*) FROM assessment_questions q JOIN exercises e ON e.id=q.exercise_id AND e.status='active' WHERE q.assessment_id=a.id) AS pool,
        (SELECT COUNT(*) FROM assessment_attempts t WHERE t.assessment_id=a.id AND t.student_id=$1 AND t.status<>'in_progress') AS tries,
        (SELECT MAX(percent) FROM assessment_attempts t WHERE t.assessment_id=a.id AND t.student_id=$1 AND t.status<>'in_progress') AS best,
        (SELECT MAX(passed) FROM assessment_attempts t WHERE t.assessment_id=a.id AND t.student_id=$1) AS passed
      FROM assessments a LEFT JOIN modules m ON m.id=a.module_id WHERE a.status='active' ORDER BY (a.module_id IS NULL), m.position, a.id`,
    [s.uid],
  );
  const history = await all(
    "SELECT t.*, a.title FROM assessment_attempts t JOIN assessments a ON a.id=t.assessment_id WHERE t.student_id=$1 AND t.status<>'in_progress' ORDER BY t.id DESC LIMIT 10",
    [s.uid],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Evaluaciones</h1>
          <p>Pon a prueba lo aprendido. Las preguntas se sortean y se califican automáticamente.</p>
        </div>
      </div>
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card-x">
            {!rows.length && (
              <div className="empty">
                <i className="bi bi-clipboard" />No hay evaluaciones disponibles.
              </div>
            )}
            {rows.map((a) => (
              <a className="item-row" key={String(a.id)} href={`/evaluaciones/${a.id}`}>
                <div className={`item-check ${Number(a.passed) ? 'done' : ''}`}>
                  {Number(a.passed) ? <i className="bi bi-check-lg" /> : ''}
                </div>
                <div className="flex-grow-1">
                  <div className="fw-semibold">{String(a.title)}</div>
                  <div className="small text-muted">
                    <i className="bi bi-clock" /> {Number(a.time_limit_min)} min · aprueba con {Number(a.pass_percent)}% ·{' '}
                    {Number(a.pool)} preguntas en el banco
                  </div>
                </div>
                {Number(a.tries) ? (
                  <span className={`chip ${Number(a.passed) ? 'success' : 'warning'}`}>
                    Mejor: {Math.round(Number(a.best ?? 0))}%
                  </span>
                ) : null}
                <i className="bi bi-chevron-right text-muted" />
              </a>
            ))}
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card-x">
            <div className="card-x-head">
              <h2>Historial reciente</h2>
            </div>
            {!history.length && <div className="empty py-4">Aún no has realizado evaluaciones.</div>}
            {history.map((t) => (
              <a className="item-row" key={String(t.id)} href={`/evaluaciones/resultado/${t.id}`}>
                <i
                  className={`bi ${
                    Number(t.passed) ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'
                  }`}
                />
                <div className="flex-grow-1 small">
                  <div className="fw-semibold text-truncate" style={{ maxWidth: 190 }}>
                    {String(t.title)}
                  </div>
                  <div className="text-muted">{fmtDate(String(t.finished_at ?? ''))}</div>
                </div>
                <strong>{Math.round(Number(t.percent))}%</strong>
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
