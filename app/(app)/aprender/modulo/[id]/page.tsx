import { notFound } from 'next/navigation';
import { guard } from '@/lib/session';
import { all, one, val } from '@/lib/db';

// Detalle de módulo (réplica de LearnController::module + learn/module.php).
export default async function ModuloPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cert?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const numId = Number(id);
  const s = await guard('auth', `/aprender/modulo/${numId}`);

  const mod = await one("SELECT * FROM modules WHERE id=$1 AND status='active'", [numId]);
  if (!mod) notFound();

  const lessons = await all(
    `SELECT l.*, (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.lesson_id=l.id AND lp.student_id=$1) AS done
     FROM lessons l WHERE l.module_id=$2 AND l.status='active' ORDER BY l.position, l.id`,
    [s.uid, numId],
  );
  const done = lessons.filter((l) => Number(l.done) > 0).length;
  const cert = await one(
    'SELECT certificate_code FROM student_progress WHERE student_id=$1 AND module_id=$2 AND completed_at IS NOT NULL',
    [s.uid, numId],
  );
  const assessment = await one("SELECT id, title FROM assessments WHERE module_id=$1 AND status='active' ORDER BY id LIMIT 1", [numId]);
  const exCount = Number(await val("SELECT COUNT(*) FROM exercises WHERE module_id=$1 AND status='active'", [numId]));
  const count = lessons.length;
  const pct = count ? Math.round((done / count) * 100) : 0;

  return (
    <>
      <nav className="small mb-2">
        <a href="/aprender">Aprender</a> <span className="text-muted">›</span> {String(mod.title)}
      </nav>
      {sp.cert === '0' && (
        <div className="alert alert-warning">
          Debes completar todas las lecciones del módulo para obtener el certificado.
        </div>
      )}
      <div className="page-head">
        <div className="d-flex align-items-center gap-3">
          <div className="stat-icon" style={{ width: 56, height: 56, fontSize: '1.7rem' }}>
            <i className={`bi ${mod.icon}`} />
          </div>
          <div>
            <h1>{String(mod.title)}</h1>
            <p>{String(mod.description ?? '')}</p>
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <a className="btn btn-soft" href={`/laboratorio?module=${numId}`}>
            <i className="bi bi-journal-check" /> Ejercicios ({exCount})
          </a>
          {assessment && (
            <a className="btn btn-soft" href={`/evaluaciones/${assessment.id}`}>
              <i className="bi bi-clipboard-check" /> Evaluación
            </a>
          )}
          {cert && s.role === 'estudiante' && (
            <a className="btn btn-primary" href={`/certificado/${numId}`}>
              <i className="bi bi-patch-check" /> Certificado
            </a>
          )}
        </div>
      </div>
      <div className="card-x mb-4 p-3 d-flex align-items-center gap-3">
        <div className="flex-grow-1">
          <div className="d-flex justify-content-between small mb-1">
            <span>
              <strong>{done}</strong> de {count} lecciones completadas
            </span>
            <span>{pct}%</span>
          </div>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="card-x">
        {!lessons.length && (
          <div className="empty">
            <i className="bi bi-journal" />Este módulo aún no tiene lecciones.
          </div>
        )}
        {lessons.map((l, i) => (
          <a className="item-row" key={String(l.id)} href={`/aprender/leccion/${l.id}`}>
            <div className={`item-check ${Number(l.done) ? 'done' : ''}`}>
              {Number(l.done) ? (
                <i className="bi bi-check-lg" />
              ) : (
                <span className="text-muted small">{i + 1}</span>
              )}
            </div>
            <div className="flex-grow-1">
              <div className="fw-semibold">{String(l.title)}</div>
              <div className="small text-muted">{String(l.description ?? '')}</div>
            </div>
            <i className="bi bi-chevron-right text-muted" />
          </a>
        ))}
      </div>
    </>
  );
}
