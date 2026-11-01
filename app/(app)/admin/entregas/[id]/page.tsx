import { notFound } from 'next/navigation';
import { guard } from '@/lib/session';
import { one } from '@/lib/db';
import { fmtDate, nl2br } from '@/lib/helpers';
import StatusBadge from '@/components/StatusBadge';

// Detalle de entrega (réplica de SubmissionsController::show + admin/submissions/show.php).
export default async function EntregaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  const s = await guard('staff', `/admin/entregas/${numId}`);

  const sub = await one(
    `SELECT s.*, u.name AS student, u.email, c.title AS case_title, c.mode, c.points AS max_points, c.criteria, c.id AS cid, c.questions_json
     FROM case_submissions s JOIN users u ON u.id=s.student_id JOIN practical_cases c ON c.id=s.case_id WHERE s.id=$1`,
    [numId],
  );
  if (!sub) notFound();

  let questions: { label: string; answer: string }[] = [];
  try {
    questions = sub.questions_json ? JSON.parse(String(sub.questions_json)) ?? [] : [];
  } catch {
    questions = [];
  }
  let results: { answer?: string; ok?: boolean }[] = [];
  try {
    const parsed = sub.answers_json ? JSON.parse(String(sub.answers_json)) : [];
    results = (Array.isArray(parsed) ? parsed : []).filter((x) => x && typeof x === 'object') as {
      answer?: string;
      ok?: boolean;
    }[];
  } catch {
    results = [];
  }
  const maxPoints = Number(sub.max_points);

  return (
    <>
      <nav className="small mb-2">
        <a href="/admin/entregas">Entregas</a> <span className="text-muted">›</span> Detalle
      </nav>
      <div className="page-head">
        <div>
          <h1>{String(sub.case_title)}</h1>
          <p>
            Entregado por <strong>{String(sub.student)}</strong> ({String(sub.email)}) el{' '}
            {fmtDate(String(sub.created_at))}
          </p>
        </div>
        <StatusBadge status={String(sub.status)} />
      </div>
      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>Contenido de la entrega</h2>
            </div>
            <div className="card-x-body">
              {sub.file_path ? (
                <div className="d-flex align-items-center gap-3">
                  <i className="bi bi-file-earmark-excel text-success" style={{ fontSize: '2.4rem' }} />
                  <div>
                    <div className="fw-semibold">{String(sub.original_name)}</div>
                    <a className="btn btn-sm btn-primary mt-1" href={`/archivo/${sub.id}`}>
                      <i className="bi bi-download" /> Descargar archivo
                    </a>
                  </div>
                </div>
              ) : (
                questions.map((q, i) => {
                  const r = results[i];
                  return (
                    <div className="mb-2" key={i}>
                      <div className="small text-muted">
                        {i + 1}. {q.label}
                      </div>
                      <div>
                        <i className={`bi ${r?.ok ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}`} />{' '}
                        Respuesta del estudiante:{' '}
                        <code>{r?.answer ? String(r.answer) : '(vacía)'}</code>
                        <span className="text-muted small">
                          {' '}
                          · esperada: <code>{String(q.answer ?? '')}</code>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {sub.criteria && (
            <div className="card-x">
              <div className="card-x-head">
                <h2>Criterios de evaluación</h2>
              </div>
              <div className="card-x-body" dangerouslySetInnerHTML={{ __html: nl2br(sub.criteria) }} />
            </div>
          )}
        </div>
        <div className="col-lg-5">
          <div className="card-x">
            <div className="card-x-head">
              <h2>Calificación</h2>
            </div>
            <form className="card-x-body needs-validation" method="post" action={`/admin/entregas/${numId}/calificar`} noValidate>
              <input type="hidden" name="_csrf" value={s.csrf} />
              <div className="mb-3">
                <label className="form-label" htmlFor="score">
                  Puntaje (0 a {maxPoints})
                </label>
                <input
                  className="form-control"
                  type="number"
                  id="score"
                  name="score"
                  min={0}
                  max={maxPoints}
                  step={0.5}
                  defaultValue={sub.score !== null && sub.score !== undefined ? String(sub.score) : ''}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="feedback">
                  Retroalimentación para el estudiante
                </label>
                <textarea className="form-control" id="feedback" name="feedback" rows={5} maxLength={2000} defaultValue={String(sub.feedback ?? '')} />
              </div>
              <button className="btn btn-primary w-100">
                <i className="bi bi-check2-circle" /> Guardar calificación
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
