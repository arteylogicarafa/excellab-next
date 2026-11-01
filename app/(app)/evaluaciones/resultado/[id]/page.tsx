import { notFound, redirect } from 'next/navigation';
import { guard, isStaff } from '@/lib/session';
import { one } from '@/lib/db';
import { nl2br } from '@/lib/helpers';
import { questionExercises } from '@/lib/services/assessment';
import Sheet from '@/components/Sheet';

// Resultado de un intento (réplica de AssessmentController::result + assessments/result.php).
export const metadata = { title: 'Resultado' };

export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  const s = await guard('auth', `/evaluaciones/resultado/${numId}`);

  const t = await one<Record<string, unknown>>(
    'SELECT t.*, u.name AS student_name FROM assessment_attempts t JOIN users u ON u.id=t.student_id WHERE t.id=$1',
    [numId],
  );
  if (!t) notFound();
  const staff = isStaff(s);
  if (!staff && Number(t.student_id) !== s.uid) redirect('/403');
  if (t.status === 'in_progress') redirect(`/evaluaciones/intento/${numId}`);

  const a = await one('SELECT a.*, m.title AS module_title FROM assessments a LEFT JOIN modules m ON m.id=a.module_id WHERE a.id=$1', [
    Number(t.assessment_id),
  ]);
  if (!a) notFound();
  let detail: Record<string, { answer: string; ok: boolean }> = {};
  try {
    detail = t.answers_json ? JSON.parse(String(t.answers_json)) : {};
  } catch {
    detail = {};
  }
  const questions = await questionExercises(String(t.question_ids));
  const ok = Boolean(Number(t.passed));
  const noDetail = !Object.keys(detail).length;

  return (
    <>
      <nav className="small mb-2">
        <a href="/evaluaciones">Evaluaciones</a> <span className="text-muted">›</span> Resultado
      </nav>
      <div
        className="card-x p-4 mb-4 text-center"
        style={{ borderTop: `5px solid ${ok ? '#16a34a' : '#ef4444'}` }}
      >
        <div className={`display-5 fw-bold ${ok ? 'text-success' : 'text-danger'}`}>{Math.round(Number(t.percent))}%</div>
        <h1 className="h4 mb-1">{ok ? '¡Evaluación aprobada!' : 'No alcanzaste el puntaje mínimo'}</h1>
        <p className="text-muted mb-2">
          {String(a.title)} · {Number(t.score)} de {Number(t.max_score)} puntos · mínimo {Number(a.pass_percent)}%
        </p>
        {t.status === 'expired' && <span className="chip warning">Se agotó el tiempo</span>}
        {staff && <div className="small text-muted mt-1">Estudiante: {String(t.student_name)}</div>}
        <div className="mt-3 d-flex gap-2 justify-content-center">
          <a
            className="btn btn-light"
            href={staff ? `/admin/seguimiento/${t.student_id}` : `/evaluaciones/${a.id}`}
          >
            Volver
          </a>
          {!staff && (
            <a className="btn btn-primary" href={`/evaluaciones/${a.id}`}>
              Intentar de nuevo
            </a>
          )}
        </div>
      </div>
      {noDetail && (
        <div className="card-x empty">
          <i className="bi bi-info-circle" />No hay detalle de respuestas para este intento.
        </div>
      )}
      {questions.map((ex, i) => {
        const d = detail[String(ex.id)];
        if (!d) return null;
        const correctText =
          ex.answer_kind === 'option'
            ? (ex.options ?? [])
                .filter((o) => Number(o.is_correct))
                .map((o) => String(o.label))
                .join(' / ')
            : String(ex.correct_answer ?? '').split('||')[0].trim();
        return (
          <div className="exercise-card" key={String(ex.id)}>
            <div className="d-flex gap-2 mb-2 flex-wrap align-items-center">
              <span className="chip green">Pregunta {i + 1}</span>
              <span className={`chip ${d.ok ? 'success' : 'danger'}`}>
                <i className={`bi ${d.ok ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`} />{' '}
                {d.ok ? 'Correcta' : 'Incorrecta'}
              </span>
              <span className="chip">{Number(ex.points)} pts</span>
            </div>
            <div className="exercise-statement mb-2" dangerouslySetInnerHTML={{ __html: nl2br(ex.statement) }} />
            {ex.sheet ? <Sheet data={ex.sheet as { headers: unknown[]; rows?: unknown[][] }} /> : null}
            <div className="small">
              Tu respuesta: <code>{d.answer === '' ? '(sin responder)' : d.answer}</code>
            </div>
            {!d.ok && (
              <div className="small mt-1">
                Respuesta correcta: <code>{correctText}</code>
              </div>
            )}
            {ex.explanation ? (
              <div className="small text-muted mt-2">
                <strong>Explicación:</strong> {String(ex.explanation)}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
