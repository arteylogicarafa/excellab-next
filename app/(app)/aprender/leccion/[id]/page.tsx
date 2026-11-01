import { notFound } from 'next/navigation';
import { guard } from '@/lib/session';
import { all, one, val } from '@/lib/db';
import { cleanHtml, imageUrl } from '@/lib/helpers';
import { forLesson } from '@/lib/models/exercise';
import Sheet from '@/components/Sheet';
import ExerciseCard from '@/components/ExerciseCard';

// Lección (réplica de LearnController::lesson + learn/lesson.php).
async function loadLesson(idStr: string) {
  const numId = Number(idStr);
  return one(
    "SELECT l.*, m.title AS module_title, m.id AS mid FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=$1 AND l.status='active' AND m.status='active'",
    [numId],
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await loadLesson(id);
  return { title: lesson ? String(lesson.title) : 'Lección' };
}

export default async function LeccionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  const s = await guard('auth', `/aprender/leccion/${numId}`);

  const lesson = await loadLesson(id);
  if (!lesson) notFound();

  const [exercises, siblings] = await Promise.all([
    forLesson(numId),
    all<{ id: number; title: string }>('SELECT id, title FROM lessons WHERE module_id=$1 AND status=\'active\' ORDER BY position, id', [Number(lesson.module_id)]),
  ]);
  const idx = siblings.findIndex((x) => Number(x.id) === numId);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const position = idx >= 0 ? idx + 1 : 1;
  const total = siblings.length;
  const done = Boolean(await val('SELECT 1 FROM lesson_progress WHERE student_id=$1 AND lesson_id=$2', [s.uid, numId]));
  let sheet: unknown = null;
  try {
    sheet = lesson.example_data ? JSON.parse(String(lesson.example_data)) : null;
  } catch {
    sheet = null;
  }

  return (
    <>
      <nav className="small mb-2">
        <a href="/aprender">Aprender</a> <span className="text-muted">›</span>{' '}
        <a href={`/aprender/modulo/${lesson.mid}`}>{String(lesson.module_title)}</a>{' '}
        <span className="text-muted">›</span> {String(lesson.title)}
      </nav>
      <div className="page-head">
        <div>
          <div className="module-num">
            Lección {position} de {total}
          </div>
          <h1>{String(lesson.title)}</h1>
          <p>{String(lesson.description ?? '')}</p>
        </div>
        {done && (
          <span className="chip success fs-6 px-3 py-2">
            <i className="bi bi-check-circle-fill" /> Lección completada
          </span>
        )}
      </div>
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>
                <i className="bi bi-book text-success" /> Explicación
              </h2>
            </div>
            <div className="card-x-body lesson-body" dangerouslySetInnerHTML={{ __html: cleanHtml(String(lesson.theory ?? '')) }} />
          </div>
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>
                <i className="bi bi-lightbulb text-success" /> Ejemplo práctico
              </h2>
            </div>
            <div className="card-x-body lesson-body">
              <div dangerouslySetInnerHTML={{ __html: cleanHtml(String(lesson.example ?? '')) }} />
              {sheet ? <Sheet data={sheet as { headers: unknown[]; rows?: unknown[][] }} caption="Hoja de ejemplo" /> : null}
              {lesson.image_url ? (
                <img
                  className="lesson-img mt-2"
                  src={imageUrl(String(lesson.image_url))}
                  alt={`Ilustración de la lección: ${lesson.title}`}
                />
              ) : null}
            </div>
          </div>
          {exercises.length > 0 && (
            <>
              <h2 className="h5 mb-3">
                <i className="bi bi-pencil-square text-success" /> Ejercicio de comprobación
              </h2>
              {exercises.map((ex) => (
                <ExerciseCard key={ex.id} ex={ex} context="lesson" />
              ))}
            </>
          )}
        </div>
        <div className="col-lg-4">
          <div className="card-x p-3 position-sticky" style={{ top: 80 }}>
            {s.role === 'estudiante' ? (
              done ? (
                <div className="text-success fw-semibold">
                  <i className="bi bi-check-circle-fill" /> ¡Ya completaste esta lección!
                </div>
              ) : (
                <>
                  <form method="post" action={`/aprender/leccion/${numId}/completar`}>
                    <input type="hidden" name="_csrf" value={s.csrf} />
                    <button className="btn btn-primary w-100 py-2">
                      <i className="bi bi-check2-circle" /> Marcar como completada
                    </button>
                  </form>
                  <div className="small text-muted mt-2">
                    Resuelve el ejercicio de comprobación y marca la lección cuando la hayas entendido.
                  </div>
                </>
              )
            ) : (
              <div className="small text-muted">
                <i className="bi bi-eye" /> Estás en modo previsualización: el progreso no se registra.
              </div>
            )}
            <hr />
            <div className="d-flex justify-content-between gap-2">
              {prev ? (
                <a className="btn btn-light btn-sm" href={`/aprender/leccion/${prev.id}`}>
                  <i className="bi bi-arrow-left" /> Anterior
                </a>
              ) : (
                <span />
              )}
              {next && (
                <a className="btn btn-light btn-sm" href={`/aprender/leccion/${next.id}`}>
                  Siguiente <i className="bi bi-arrow-right" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
