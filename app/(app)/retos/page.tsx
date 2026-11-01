import { guard } from '@/lib/session';
import { all } from '@/lib/db';
import { diffLabel, diffClass } from '@/lib/helpers';

export const metadata = { title: 'Excel Challenge' };

// Retos (réplica de ChallengeController::index + challenges/index.php).
export default async function RetosPage() {
  const s = await guard('auth', '/retos');
  const rows = await all(
    `SELECT c.*, (SELECT MAX(is_correct) FROM challenge_attempts a WHERE a.challenge_id=c.id AND a.student_id=$1) AS solved,
        (SELECT COUNT(*) FROM challenge_attempts a WHERE a.challenge_id=c.id AND a.student_id=$1) AS attempts
      FROM challenges c WHERE c.status='active' ORDER BY CASE c.difficulty WHEN 'basico' THEN 1 WHEN 'intermedio' THEN 2 WHEN 'avanzado' THEN 3 END, c.position, c.id`,
    [s.uid],
  );
  const solved = rows.filter((r) => Number(r.solved)).length;
  const earned = rows.reduce((acc, r) => acc + (Number(r.solved) ? Number(r.points) : 0), 0);
  const order = ['basico', 'intermedio', 'avanzado'];
  const groups = order.map((d) => [d, rows.filter((r) => String(r.difficulty) === d)] as const);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Excel Challenge</h1>
          <p>Resuelve situaciones reales, valida tu resultado y gana puntos e insignias.</p>
        </div>
        <div className="d-flex gap-2">
          <span className="chip green fs-6 px-3 py-2">
            <i className="bi bi-trophy" /> {solved}/{rows.length} superados
          </span>
          <span className="chip warning fs-6 px-3 py-2">
            <i className="bi bi-star-fill" /> {earned} pts
          </span>
        </div>
      </div>
      {groups.map(([d, list]) =>
        list.length ? (
          <div key={d}>
            <h2 className="h5 mt-4 mb-3">
              <span className={`chip ${diffClass(d)} fs-6`}>{diffLabel(d)}</span>
            </h2>
            <div className="row g-3">
              {list.map((c) => (
                <div className="col-md-6 col-xl-4" key={String(c.id)}>
                  <a className="card-x module-card" href={`/retos/${c.id}`}>
                    <div className="d-flex justify-content-between mb-2">
                      <div
                        className={`stat-icon ${Number(c.solved) ? '' : 'amber'}`}
                        style={{ width: 40, height: 40 }}
                      >
                        <i className={`bi ${Number(c.solved) ? 'bi-trophy-fill' : 'bi-lightning-charge'}`} />
                      </div>
                      {Number(c.solved) ? (
                        <span className="chip success">
                          <i className="bi bi-check-circle-fill" /> Superado
                        </span>
                      ) : Number(c.attempts) ? (
                        <span className="chip warning">{Number(c.attempts)} intentos</span>
                      ) : null}
                    </div>
                    <h3 className="h6 mb-1">{String(c.title)}</h3>
                    <p className="small text-muted mb-3">{String(c.objective)}</p>
                    <div className="small text-muted">
                      <i className="bi bi-clock" /> {Number(c.est_minutes)} min &nbsp;{' '}
                      <i className="bi bi-star" /> {Number(c.points)} pts
                    </div>
                  </a>
                </div>
              ))}
            </div>
          </div>
        ) : null,
      )}
      {!rows.length && (
        <div className="card-x empty">
          <i className="bi bi-trophy" />No hay retos disponibles.
        </div>
      )}
    </>
  );
}
