import { notFound } from 'next/navigation';
import { guard } from '@/lib/session';
import { all, one } from '@/lib/db';
import { fmtDate } from '@/lib/helpers';
import * as stats from '@/lib/services/stats';
import * as progress from '@/lib/services/progress';
import StatusBadge from '@/components/StatusBadge';

// Detalle de estudiante (réplica de TrackingController::student + admin/tracking/student.php).
export default async function SeguimientoEstudiantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  await guard('staff', `/admin/seguimiento/${numId}`);

  const u = await one('SELECT id, name, email, status, last_login_at, created_at FROM users WHERE id=$1 AND role_id=3', [numId]);
  if (!u) notFound();

  const [overall, mods, counts, exAttempts, chAttempts, asAttempts, cases, achievements, log, chart] = await Promise.all([
    progress.overall(numId),
    progress.modules(numId),
    stats.counts(numId),
    all('SELECT a.*, e.title FROM exercise_attempts a JOIN exercises e ON e.id=a.exercise_id WHERE a.student_id=$1 ORDER BY a.id DESC LIMIT 25', [numId]),
    all('SELECT a.*, c.title FROM challenge_attempts a JOIN challenges c ON c.id=a.challenge_id WHERE a.student_id=$1 ORDER BY a.id DESC LIMIT 15', [numId]),
    all("SELECT t.*, a.title FROM assessment_attempts t JOIN assessments a ON a.id=t.assessment_id WHERE t.student_id=$1 AND t.status<>'in_progress' ORDER BY t.id DESC LIMIT 15", [numId]),
    all('SELECT s.*, c.title, c.points AS max_points, c.mode FROM case_submissions s JOIN practical_cases c ON c.id=s.case_id WHERE s.student_id=$1 ORDER BY s.id DESC LIMIT 15', [numId]),
    all('SELECT a.*, sa.awarded_at FROM student_achievements sa JOIN achievements a ON a.id=sa.achievement_id WHERE sa.student_id=$1 ORDER BY sa.awarded_at DESC', [numId]),
    all('SELECT * FROM activity_log WHERE user_id=$1 ORDER BY id DESC LIMIT 20', [numId]),
    stats.pointsByDay(numId, 14),
  ]);

  const strim = (s: string, w: number) => ([...s].length > w ? [...s].slice(0, w).join('') + '…' : s);

  return (
    <>
      <nav className="small mb-2">
        <a href="/admin/seguimiento">Seguimiento</a> <span className="text-muted">›</span> {String(u.name)}
      </nav>
      <div className="page-head">
        <div className="d-flex align-items-center gap-3">
          <div className="avatar" style={{ width: 52, height: 52, fontSize: '1.3rem' }}>
            {String(u.name).slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1>{String(u.name)}</h1>
            <p>
              {String(u.email)} · último acceso: {u.last_login_at ? fmtDate(String(u.last_login_at)) : 'nunca'}
            </p>
          </div>
        </div>
        <div className="d-flex gap-2">
          <a className="btn btn-soft" href={`/admin/reportes?student=${numId}`}>
            <i className="bi bi-file-earmark-bar-graph" /> Reporte del estudiante
          </a>
          <a className="btn btn-light" href={`/admin/estudiantes/${numId}/editar`}>
            <i className="bi bi-pencil" /> Editar
          </a>
        </div>
      </div>
      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <div className="card-x stat-card">
            <div className="stat-icon">
              <i className="bi bi-speedometer2" />
            </div>
            <div>
              <div className="stat-value">{Math.round(overall)}%</div>
              <div className="stat-label">Progreso general</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="card-x stat-card">
            <div className="stat-icon amber">
              <i className="bi bi-star-fill" />
            </div>
            <div>
              <div className="stat-value">{counts.points}</div>
              <div className="stat-label">Puntos</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="card-x stat-card">
            <div className="stat-icon blue">
              <i className="bi bi-pencil-square" />
            </div>
            <div>
              <div className="stat-value">{counts.exercises}</div>
              <div className="stat-label">Ejercicios correctos</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="card-x stat-card">
            <div className="stat-icon violet">
              <i className="bi bi-trophy" />
            </div>
            <div>
              <div className="stat-value">{counts.challenges}</div>
              <div className="stat-label">Retos superados</div>
            </div>
          </div>
        </div>
      </div>
      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>Avance por módulo</h2>
            </div>
            {mods.map((m, i) => {
              const total = Number(m.lessons_total);
              const done = Number(m.lessons_done);
              const p = total ? Math.round((done / total) * 100) : 0;
              return (
                <div className="item-row" key={String(m.id)}>
                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between small">
                      <span>
                        <strong>M{i + 1}</strong> · {String(m.title)}
                      </span>
                      <span>
                        {done}/{total} · {p}%
                      </span>
                    </div>
                    <div className="progress mt-1">
                      <div className="progress-bar" style={{ width: `${p}%` }} />
                    </div>
                  </div>
                  {Boolean(m.certificate_code) && <span className="chip success">Certificado</span>}
                </div>
              );
            })}
          </div>
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>Últimos ejercicios</h2>
            </div>
            <div className="table-responsive">
              <table className="table table-x">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Ejercicio</th>
                    <th>Respuesta</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {!exAttempts.length && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-3">
                        Sin intentos.
                      </td>
                    </tr>
                  )}
                  {exAttempts.map((a) => (
                    <tr key={String(a.id)}>
                      <td className="small text-nowrap">{fmtDate(String(a.created_at))}</td>
                      <td>{String(a.title)}</td>
                      <td>
                        <code>{strim(String(a.answer), 40)}</code>
                      </td>
                      <td>
                        {Number(a.is_correct) ? (
                          <span className="chip success">+{Number(a.points)}</span>
                        ) : (
                          <span className="chip danger">Incorrecto</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-x">
            <div className="card-x-head">
              <h2>Retos</h2>
            </div>
            <div className="table-responsive">
              <table className="table table-x">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Reto</th>
                    <th>Tiempo</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {!chAttempts.length && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-3">
                        Sin intentos.
                      </td>
                    </tr>
                  )}
                  {chAttempts.map((a) => (
                    <tr key={String(a.id)}>
                      <td className="small text-nowrap">{fmtDate(String(a.created_at))}</td>
                      <td>{String(a.title)}</td>
                      <td>{Number(a.seconds_spent)} s</td>
                      <td>
                        {Number(a.is_correct) ? (
                          <span className="chip success">Superado</span>
                        ) : (
                          <span className="chip danger">Fallido</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>Puntos · 14 días</h2>
            </div>
            <div className="card-x-body">
              <canvas id="ch" height="140" />
            </div>
          </div>
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>Evaluaciones</h2>
            </div>
            {!asAttempts.length && <div className="empty py-3">Sin evaluaciones.</div>}
            {asAttempts.map((t) => (
              <a className="item-row" key={String(t.id)} href={`/evaluaciones/resultado/${t.id}`}>
                <i className={`bi ${Number(t.passed) ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}`} />
                <div className="flex-grow-1 small">
                  <div className="fw-semibold">{String(t.title)}</div>
                  <div className="text-muted">{fmtDate(String(t.finished_at ?? ''))}</div>
                </div>
                <strong>{Math.round(Number(t.percent))}%</strong>
              </a>
            ))}
          </div>
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>Casos prácticos</h2>
            </div>
            {!cases.length && <div className="empty py-3">Sin entregas.</div>}
            {cases.map((c) => (
              <a className="item-row" key={String(c.id)} href={`/admin/entregas/${c.id}`}>
                <div className="flex-grow-1 small">
                  <div className="fw-semibold">{String(c.title)}</div>
                  <div className="text-muted">{fmtDate(String(c.created_at))}</div>
                </div>
                <StatusBadge status={String(c.status)} />{' '}
                <strong>{c.score !== null && c.score !== undefined ? Math.round(Number(c.score) * 10) / 10 : '—'}</strong>
              </a>
            ))}
          </div>
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>Insignias ({achievements.length})</h2>
            </div>
            <div className="card-x-body d-flex flex-wrap gap-2">
              {!achievements.length && <span className="text-muted small">Sin insignias todavía.</span>}
              {achievements.map((a) => (
                <span className="chip warning" key={String(a.id)} title={String(a.description)}>
                  <i className={`bi ${a.icon}`} /> {String(a.name)}
                </span>
              ))}
            </div>
          </div>
          <div className="card-x">
            <div className="card-x-head">
              <h2>Historial de actividad</h2>
            </div>
            <div className="card-x-body py-2">
              {!log.length && <div className="empty py-3">Sin registros.</div>}
              {log.map((l) => (
                <div className="feed-item" key={String(l.id)}>
                  <div className="feed-icon">
                    <i className="bi bi-clock-history" />
                  </div>
                  <div>
                    <div>
                      {String(l.action).replace(/_/g, ' ')}
                      {l.detail ? ` · ${strim(String(l.detail), 60)}` : ''}
                    </div>
                    <div className="small text-muted">{fmtDate(String(l.created_at))}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.addEventListener('DOMContentLoaded', function () {
  if (typeof Chart === 'undefined') return;
  new Chart(document.getElementById('ch'), { type: 'line', data: { labels: ${JSON.stringify(chart.labels)}, datasets: [{ data: ${JSON.stringify(chart.values)}, borderColor: '#217346', backgroundColor: 'rgba(22,163,74,.15)', fill: true, tension: .35 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
});`,
        }}
      />
    </>
  );
}
