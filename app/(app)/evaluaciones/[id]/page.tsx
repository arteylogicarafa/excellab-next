import { notFound } from 'next/navigation';
import { guard } from '@/lib/session';
import { all } from '@/lib/db';
import { fmtDate } from '@/lib/helpers';
import { loadAssessment, poolCount, deadlineOf, naive, type AttemptRow } from '@/lib/services/assessment';
import { nowSql } from '@/lib/helpers';

// Detalle de evaluación (réplica de AssessmentController::show + assessments/show.php).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await loadAssessment(Number(id));
  return { title: a ? String(a.title) : 'Evaluación' };
}

export default async function EvaluacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  const s = await guard('auth', `/evaluaciones/${numId}`);

  const a = await loadAssessment(numId);
  if (!a) notFound();

  const pool = await poolCount(numId);
  const attempts = await all<AttemptRow>(
    'SELECT * FROM assessment_attempts WHERE assessment_id=$1 AND student_id=$2 ORDER BY id DESC',
    [numId, s.uid],
  );
  let open: AttemptRow | null = null;
  const now = naive(nowSql()).getTime();
  for (const t of attempts) {
    if (t.status === 'in_progress' && deadlineOf(a, t) > now) open = t;
  }
  const finished = attempts.filter((t) => t.status !== 'in_progress').length;
  const qpa = Number(a.questions_per_attempt);
  const questions = qpa ? Math.min(qpa, pool) : pool;
  const maxAttempts = Number(a.max_attempts);
  const canStart = pool > 0 && (!maxAttempts || finished < maxAttempts);
  const student = s.role === 'estudiante';

  return (
    <>
      <nav className="small mb-2">
        <a href="/evaluaciones">Evaluaciones</a> <span className="text-muted">›</span> {String(a.title)}
      </nav>
      <div className="page-head">
        <div>
          <h1>{String(a.title)}</h1>
          <p>{String(a.description ?? '')}</p>
        </div>
      </div>
      <div className="row g-4">
        <div className="col-lg-5">
          <div className="card-x p-4">
            <h2 className="h6 mb-3">Información</h2>
            <ul className="list-unstyled mb-4">
              <li className="mb-2">
                <i className="bi bi-question-circle text-success" /> <strong>{questions}</strong> preguntas{' '}
                {Number(a.randomize) ? `(aleatorias del banco de ${pool})` : ''}
              </li>
              <li className="mb-2">
                <i className="bi bi-clock text-success" /> Tiempo límite: <strong>{Number(a.time_limit_min)} minutos</strong>
              </li>
              <li className="mb-2">
                <i className="bi bi-bullseye text-success" /> Para aprobar: <strong>{Number(a.pass_percent)}%</strong>
              </li>
              <li>
                <i className="bi bi-arrow-repeat text-success" /> Intentos:{' '}
                <strong>{maxAttempts ? `${finished} de ${maxAttempts}` : 'ilimitados'}</strong>
              </li>
            </ul>
            {!student ? (
              <div className="alert alert-info small mb-0">Modo previsualización: solo los estudiantes pueden realizar la evaluación.</div>
            ) : open ? (
              <a className="btn btn-primary w-100" href={`/evaluaciones/intento/${open.id}`}>
                <i className="bi bi-play-fill" /> Continuar intento en curso
              </a>
            ) : canStart ? (
              <form
                method="post"
                action={`/evaluaciones/${numId}/iniciar`}
                data-confirm="¿Iniciar la evaluación? El tiempo empezará a correr de inmediato."
              >
                <input type="hidden" name="_csrf" value={s.csrf} />
                <button className="btn btn-primary w-100 py-2">
                  <i className="bi bi-play-fill" /> Comenzar evaluación
                </button>
              </form>
            ) : (
              <div className="alert alert-warning small mb-0">
                {pool ? 'Ya usaste todos los intentos disponibles.' : 'Esta evaluación aún no tiene preguntas.'}
              </div>
            )}
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card-x">
            <div className="card-x-head">
              <h2>Mis intentos</h2>
            </div>
            {!attempts.length ? (
              <div className="empty py-4">Aún no hay intentos.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-x">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Puntaje</th>
                      <th>Resultado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((t) => (
                      <tr key={t.id}>
                        <td>{fmtDate(String(t.started_at))}</td>
                        <td>
                          {t.status === 'in_progress'
                            ? '—'
                            : `${Number(t.score)}/${Number(t.max_score)} (${Math.round(Number(t.percent))}%)`}
                        </td>
                        <td>
                          {t.status === 'in_progress' ? (
                            <span className="chip warning">En curso</span>
                          ) : (
                            <>
                              {Number(t.passed) ? (
                                <span className="chip success">Aprobado</span>
                              ) : (
                                <span className="chip danger">No aprobado</span>
                              )}
                              {t.status === 'expired' && <span className="chip">Tiempo agotado</span>}
                            </>
                          )}
                        </td>
                        <td className="text-end">
                          {t.status !== 'in_progress' && <a href={`/evaluaciones/resultado/${t.id}`}>Ver detalle</a>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
