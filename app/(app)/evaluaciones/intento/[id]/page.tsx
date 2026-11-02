import { notFound, redirect } from 'next/navigation';
import { guard } from '@/lib/session';
import { one } from '@/lib/db';
import { nowSql } from '@/lib/helpers';
import { questionExercises, gradeAttempt, deadlineOf, naive, type AttemptRow } from '@/lib/services/assessment';
import ExerciseCard from '@/components/ExerciseCard';

// Intento en curso (réplica de AssessmentController::take + assessments/take.php).
export const metadata = { title: 'Evaluación' };

export default async function TakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  const s = await guard('student', `/evaluaciones/intento/${numId}`);

  const t = await one<AttemptRow>('SELECT * FROM assessment_attempts WHERE id=$1 AND student_id=$2', [numId, s.uid]);
  if (!t) notFound();
  const a = await one('SELECT * FROM assessments WHERE id=$1', [Number(t.assessment_id)]);
  if (!a) notFound();
  if (t.status !== 'in_progress') redirect(`/evaluaciones/resultado/${numId}`);

  const remaining = Math.floor((deadlineOf(a, t) - naive(nowSql()).getTime()) / 1000);
  if (remaining <= 0) {
    // Sin cookies en Server Components: el resultado ya muestra el aviso «Se agotó el tiempo».
    await gradeAttempt(a, t, {}, 'expired');
    redirect(`/evaluaciones/resultado/${numId}`);
  }

  const questions = await questionExercises(t.question_ids);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{String(a.title)}</h1>
          <p>Responde todas las preguntas. Al terminar el tiempo, la evaluación se enviará automáticamente.</p>
        </div>
      </div>
      <form
        id="examForm"
        method="post"
        action={`/evaluaciones/intento/${numId}/enviar`}
        data-confirm="¿Enviar la evaluación? No podrás modificar tus respuestas."
      >
        <input type="hidden" name="_csrf" value={s.csrf} />
        <div className="row g-4">
          <div className="col-lg-9">
            {questions.map((ex, i) => (
              <ExerciseCard key={String(ex.id)} ex={ex} exam num={i + 1} />
            ))}
          </div>
          <div className="col-lg-3">
            <div className="card-x p-3 timer-box text-center">
              <div className="text-muted small">Tiempo restante</div>
              <div className="timer" id="examTimer" data-remaining={remaining} suppressHydrationWarning>
                --:--
              </div>
              <div className="small text-muted my-2">
                {questions.length} preguntas · aprueba con {Number(a.pass_percent)}%
              </div>
              <button className="btn btn-primary w-100" type="submit">
                <i className="bi bi-send" /> Enviar evaluación
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
