import { notFound } from 'next/navigation';
import { guard } from '@/lib/session';
import { all, one } from '@/lib/db';
import { diffLabel, diffClass, fmtDate, nl2br } from '@/lib/helpers';
import Sheet from '@/components/Sheet';

// Detalle de reto (réplica de ChallengeController::show + challenges/show.php).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await one("SELECT * FROM challenges WHERE id=$1 AND status='active'", [Number(id)]);
  return { title: c ? String(c.title) : 'Reto' };
}

export default async function RetoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  const s = await guard('auth', `/retos/${numId}`);

  const c = await one("SELECT * FROM challenges WHERE id=$1 AND status='active'", [numId]);
  if (!c) notFound();

  const attempts =
    s.role === 'estudiante'
      ? await all('SELECT * FROM challenge_attempts WHERE challenge_id=$1 AND student_id=$2 ORDER BY id DESC LIMIT 8', [numId, s.uid])
      : [];
  const solved = attempts.some((a) => Number(a.is_correct));
  let sheet: { headers: unknown[]; rows?: unknown[][] } | null = null;
  try {
    sheet = c.data_json ? JSON.parse(String(c.data_json)) : null;
  } catch {
    sheet = null;
  }
  const placeholder =
    { number: 'Escribe el resultado numérico', formula: '=FÓRMULA(…)', text: 'Escribe tu respuesta' }[String(c.answer_kind)] ?? '';
  const sectionStyle = { letterSpacing: '.06em' };

  return (
    <>
      <nav className="small mb-2">
        <a href="/retos">Excel Challenge</a> <span className="text-muted">›</span> {String(c.title)}
      </nav>
      <div className="page-head">
        <div>
          <h1>{String(c.title)}</h1>
          <div className="d-flex flex-wrap gap-2 mt-2">
            <span className={`chip ${diffClass(String(c.difficulty))}`}>{diffLabel(String(c.difficulty))}</span>
            <span className="chip">
              <i className="bi bi-clock" /> {Number(c.est_minutes)} min estimados
            </span>
            <span className="chip green">
              <i className="bi bi-star-fill" /> {Number(c.points)} pts
            </span>
            {solved && (
              <span className="chip success">
                <i className="bi bi-check-circle-fill" /> Superado
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card-x mb-4">
            <div className="card-x-body">
              <h2 className="h6 text-success text-uppercase" style={sectionStyle}>
                Situación
              </h2>
              <p dangerouslySetInnerHTML={{ __html: nl2br(c.situation) }} />
              <h2 className="h6 text-success text-uppercase" style={sectionStyle}>
                Objetivo
              </h2>
              <p>{String(c.objective)}</p>
              {sheet && <Sheet data={sheet} caption="Datos de entrada" />}
              <h2 className="h6 text-success text-uppercase mt-3" style={sectionStyle}>
                Instrucciones
              </h2>
              <p className="mb-0" dangerouslySetInnerHTML={{ __html: nl2br(c.instructions ?? '') }} />
              {c.hint && (
                <details className="mt-3">
                  <summary className="text-muted small" style={{ cursor: 'pointer' }}>
                    <i className="bi bi-lightbulb" /> Ver pista
                  </summary>
                  <p className="small mt-2 mb-0">{String(c.hint)}</p>
                </details>
              )}
            </div>
          </div>
          <div className="card-x">
            <div className="card-x-body" id="challengeBox" data-url={`/retos/${numId}/comprobar`}>
              <label className="form-label fw-semibold" htmlFor="challengeAnswer">
                Tu resultado
              </label>
              <div className="input-group">
                <input
                  className={`form-control ${c.answer_kind === 'formula' ? 'formula-input' : ''}`}
                  id="challengeAnswer"
                  type="text"
                  maxLength={500}
                  autoComplete="off"
                  placeholder={placeholder}
                />
                <button className="btn btn-primary" id="challengeBtn" type="button">
                  <i className="bi bi-check2-circle" /> Validar resultado
                </button>
              </div>
              <div className="feedback" role="status" aria-live="polite" />
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card-x p-3 mb-3 text-center">
            <div className="text-muted small">Tiempo en este reto</div>
            <div className="timer" id="challengeTimer" suppressHydrationWarning>
              00:00
            </div>
          </div>
          <div className="card-x">
            <div className="card-x-head">
              <h2>Mis intentos</h2>
            </div>
            {!attempts.length && <div className="empty py-4">Aún sin intentos.</div>}
            {attempts.map((a) => (
              <div className="item-row" key={String(a.id)}>
                <i className={`bi ${Number(a.is_correct) ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}`} />
                <div className="flex-grow-1 small">
                  <code>{String(a.answer)}</code>
                  <div className="text-muted">
                    {fmtDate(String(a.created_at))} · {Number(a.seconds_spent)} s
                  </div>
                </div>
                {Number(a.points) > 0 && <span className="chip success">+{Number(a.points)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
