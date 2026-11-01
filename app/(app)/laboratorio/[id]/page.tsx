import { notFound } from 'next/navigation';
import { guard } from '@/lib/session';
import { all } from '@/lib/db';
import { fmtDate } from '@/lib/helpers';
import { find } from '@/lib/models/exercise';
import ExerciseCard from '@/components/ExerciseCard';

// Detalle de ejercicio (réplica de LabController::show + lab/show.php).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ex = await find(Number(id));
  return { title: ex ? String(ex.title) : 'Ejercicio' };
}

export default async function EjercicioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  const s = await guard('auth', `/laboratorio/${numId}`);

  const ex = await find(numId);
  if (!ex) notFound();

  const attempts =
    s.role === 'estudiante'
      ? await all(
          'SELECT * FROM exercise_attempts WHERE exercise_id=$1 AND student_id=$2 ORDER BY id DESC LIMIT 8',
          [numId, s.uid],
        )
      : [];
  const siblings = await all<{ id: number }>("SELECT id FROM exercises WHERE status='active' ORDER BY module_id, id");
  const ids = siblings.map((x) => Number(x.id));
  const pos = ids.indexOf(numId);
  const prevId = pos > 0 ? ids[pos - 1] : null;
  const nextId = pos >= 0 && pos < ids.length - 1 ? ids[pos + 1] : null;

  return (
    <>
      <nav className="small mb-2">
        <a href="/laboratorio">Laboratorio</a> <span className="text-muted">›</span> {String(ex.title)}
      </nav>
      <div className="page-head">
        <div>
          <h1>{String(ex.title)}</h1>
          <p>{String(ex.module_title)}</p>
        </div>
        <div className="d-flex gap-2">
          {prevId !== null && (
            <a className="btn btn-light" href={`/laboratorio/${prevId}`}>
              <i className="bi bi-arrow-left" />
            </a>
          )}
          {nextId !== null && (
            <a className="btn btn-light" href={`/laboratorio/${nextId}`}>
              Siguiente <i className="bi bi-arrow-right" />
            </a>
          )}
        </div>
      </div>
      <div className="row g-4">
        <div className="col-lg-8">
          <ExerciseCard ex={ex} context="lab" />
        </div>
        <div className="col-lg-4">
          <div className="card-x">
            <div className="card-x-head">
              <h2>Mis intentos</h2>
            </div>
            {s.role !== 'estudiante' ? (
              <div className="empty py-4">Modo previsualización.</div>
            ) : !attempts.length ? (
              <div className="empty py-4">Aún no has intentado este ejercicio.</div>
            ) : null}
            {attempts.map((a) => (
              <div className="item-row" key={String(a.id)}>
                <i className={`bi ${Number(a.is_correct) ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}`} />
                <div className="flex-grow-1 small">
                  <div className="text-truncate" style={{ maxWidth: 180 }}>
                    <code>{String(a.answer)}</code>
                  </div>
                  <div className="text-muted">{fmtDate(String(a.created_at))}</div>
                </div>
                {Number(a.is_correct) && <span className="chip success">+{Number(a.points)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
