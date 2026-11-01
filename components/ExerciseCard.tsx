import { diffLabel, diffClass, typeLabel, nl2br } from '@/lib/helpers';
import Sheet from './Sheet';
import type { ExerciseRow } from '@/lib/models/exercise';

// Ejercicio interactivo (réplica de app/Views/components/exercise.php).
// $context: 'lab' | 'lesson'. $exam: modo evaluación (sin comprobación inmediata).
export default function ExerciseCard({
  ex,
  context = 'lab',
  exam = false,
  num,
}: {
  ex: ExerciseRow;
  context?: 'lab' | 'lesson';
  exam?: boolean;
  num?: number;
}) {
  const hasOptions = ex.answer_kind === 'option';
  const placeholder =
    { number: 'Escribe el resultado numérico', formula: '=FÓRMULA(…)', text: 'Escribe tu respuesta' }[
      String(ex.answer_kind)
    ] ?? '';
  const id = Number(ex.id);

  return (
    <div
      className="exercise-card"
      id={`ex-${id}`}
      {...(!exam ? { 'data-check-url': `/ejercicios/${id}/comprobar`, 'data-context': context } : {})}
    >
      <div className="d-flex flex-wrap gap-2 mb-2 align-items-center">
        {exam && <span className="chip green">Pregunta {num}</span>}
        <span className="chip">{typeLabel(String(ex.type))}</span>
        <span className={`chip ${diffClass(String(ex.difficulty))}`}>{diffLabel(String(ex.difficulty))}</span>
        <span className="chip green">
          <i className="bi bi-star-fill" /> {Number(ex.points)} pts
        </span>
      </div>
      <div className="text-muted small mb-1">{String(ex.topic)}</div>
      <div className="exercise-statement mb-2" dangerouslySetInnerHTML={{ __html: nl2br(ex.statement) }} />
      {ex.instructions ? (
        <div className="small text-muted mb-2">
          <i className="bi bi-info-circle" /> {String(ex.instructions)}
        </div>
      ) : null}
      {ex.sheet ? <Sheet data={ex.sheet} caption="Datos del ejercicio" /> : null}

      <div className="mt-3">
        {hasOptions ? (
          (ex.options ?? []).map((o) => (
            <label className="opt" key={o.id}>
              <input
                className="form-check-input"
                type="radio"
                name={exam ? `answers[${id}]` : `opt-${id}`}
                value={String(o.id)}
              />
              <span>{String(o.label)}</span>
            </label>
          ))
        ) : (
          <input
            className={`form-control answer-input ${ex.answer_kind === 'formula' ? 'formula-input' : ''}`}
            type="text"
            maxLength={500}
            autoComplete="off"
            spellCheck={false}
            {...(exam ? { name: `answers[${id}]` } : {})}
            placeholder={placeholder}
            aria-label="Respuesta"
          />
        )}
      </div>

      {!exam && (
        <>
          <button type="button" className="btn btn-primary mt-3 btn-check-ex">
            <i className="bi bi-check2-circle" /> Comprobar
          </button>
          <div className="feedback" role="status" aria-live="polite" />
        </>
      )}
    </div>
  );
}
