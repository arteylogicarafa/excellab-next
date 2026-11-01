import { guard } from '@/lib/session';
import { all, val } from '@/lib/db';
import { diffLabel, diffClass, timeAgo, hourNow } from '@/lib/helpers';
import * as stats from '@/lib/services/stats';
import * as progress from '@/lib/services/progress';

export const metadata = { title: 'Inicio' };

// Panel del estudiante (réplica de DashboardController::student + student/dashboard.php).
export default async function InicioPage() {
  const s = await guard('student', '/inicio');
  const sid = s.uid;

  const mods = await progress.modules(sid);
  const counts = await stats.counts(sid);
  const overall = await progress.overall(sid);
  const [pending, pendingTotal, achievements, next, chartPoints, recent, pendingSubs] = await Promise.all([
    all(
      "SELECT c.id, c.title, c.difficulty, c.points, c.est_minutes FROM challenges c WHERE c.status='active' AND c.id NOT IN (SELECT challenge_id FROM challenge_attempts WHERE student_id=$1 AND is_correct=1) ORDER BY CASE c.difficulty WHEN 'basico' THEN 1 WHEN 'intermedio' THEN 2 WHEN 'avanzado' THEN 3 END, c.position LIMIT 4",
      [sid],
    ),
    val("SELECT COUNT(*) FROM challenges c WHERE c.status='active' AND c.id NOT IN (SELECT challenge_id FROM challenge_attempts WHERE student_id=$1 AND is_correct=1)", [sid]),
    all('SELECT a.*, sa.awarded_at FROM student_achievements sa JOIN achievements a ON a.id=sa.achievement_id WHERE sa.student_id=$1 ORDER BY sa.awarded_at DESC LIMIT 6', [sid]),
    progress.nextLesson(sid),
    stats.pointsByDay(sid, 14),
    stats.recent(sid, 7),
    val("SELECT COUNT(*) FROM case_submissions WHERE student_id=$1 AND status='submitted'", [sid]),
  ]);

  const modsDone = mods.filter((m) => Number(m.lessons_total) > 0 && Number(m.lessons_done) >= Number(m.lessons_total)).length;
  const first = s.name.split(' ')[0];
  const h = hourNow();
  const greet = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  const modLabels = mods.map((_, i) => `M${i + 1}`);
  const modPercents = mods.map((m) => (Number(m.lessons_total) ? Math.round((Number(m.lessons_done) / Number(m.lessons_total)) * 100) : 0));
  const modTitles = mods.map((m) => String(m.title));

  return (
    <>
      <div className="hero mb-4">
        <div className="d-flex flex-wrap align-items-center gap-4">
          <div className="ring" style={{ '--p': overall } as React.CSSProperties}>
            <span>{Math.round(overall)}%</span>
          </div>
          <div className="flex-grow-1">
            <h1>
              {greet}, {first} 👋
            </h1>
            <p className="mb-3 opacity-75">
              Tu progreso general en Excel es del {Math.round(overall)}%.{' '}
              {next ? 'Sigue donde lo dejaste.' : '¡Completaste todas las lecciones disponibles!'}
            </p>
            {next ? (
              <>
                <a className="btn btn-light" href={`/aprender/leccion/${next.id}`}>
                  <i className="bi bi-play-fill" /> Continuar aprendiendo
                </a>
                <span className="ms-2 small opacity-75 d-block d-sm-inline mt-2 mt-sm-0">
                  {String(next.module_title)} · {String(next.title)}
                </span>
              </>
            ) : (
              <a className="btn btn-light" href="/retos">
                <i className="bi bi-trophy" /> Ir a los retos
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <div className="card-x stat-card">
            <div className="stat-icon">
              <i className="bi bi-collection" />
            </div>
            <div>
              <div className="stat-value">
                {modsDone}
                <small className="text-muted fs-6">/{mods.length}</small>
              </div>
              <div className="stat-label">Módulos completados</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="card-x stat-card">
            <div className="stat-icon blue">
              <i className="bi bi-pencil-square" />
            </div>
            <div>
              <div className="stat-value">{counts.attempted}</div>
              <div className="stat-label">Ejercicios realizados</div>
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
              <div className="stat-label">Puntos acumulados</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-xl-3">
          <div className="card-x stat-card">
            <div className="stat-icon violet">
              <i className="bi bi-trophy" />
            </div>
            <div>
              <div className="stat-value">{Number(pendingTotal ?? 0)}</div>
              <div className="stat-label">Retos pendientes</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>Puntos ganados · últimos 14 días</h2>
            </div>
            <div className="card-x-body">
              <canvas id="chartPoints" height="110" aria-label="Gráfico de puntos por día" role="img" />
            </div>
          </div>
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>Avance por módulo</h2>
              <a className="small" href="/aprender">
                Ver módulos
              </a>
            </div>
            <div className="card-x-body">
              <canvas id="chartModules" height="90" aria-label="Avance por módulo" role="img" />
            </div>
          </div>
          <div className="card-x">
            <div className="card-x-head">
              <h2>Retos pendientes</h2>
              <a className="small" href="/retos">
                Ver todos
              </a>
            </div>
            {!pending.length && (
              <div className="empty">
                <i className="bi bi-emoji-sunglasses" />¡Superaste todos los retos!
              </div>
            )}
            {pending.map((c) => (
              <a key={String(c.id)} className="item-row" href={`/retos/${c.id}`}>
                <div className="stat-icon amber" style={{ width: 38, height: 38, fontSize: '1.1rem' }}>
                  <i className="bi bi-lightning-charge" />
                </div>
                <div className="flex-grow-1">
                  <div className="fw-semibold">{String(c.title)}</div>
                  <div className="small text-muted">
                    <i className="bi bi-clock" /> {Number(c.est_minutes)} min · {Number(c.points)} pts
                  </div>
                </div>
                <span className={`chip ${diffClass(String(c.difficulty))}`}>{diffLabel(String(c.difficulty))}</span>
              </a>
            ))}
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>Últimas actividades</h2>
            </div>
            <div className="card-x-body py-2">
              {!recent.length && (
                <div className="empty py-4">
                  <i className="bi bi-clock-history" />Aún no tienes actividad.
                </div>
              )}
              {recent.map(([icon, tone, text, when, link], i) => (
                <a key={i} className="feed-item text-reset" href={link}>
                  <div className="feed-icon">
                    <i className={`bi ${icon}`} />
                  </div>
                  <div>
                    <div>{text}</div>
                    <div className="small text-muted">{timeAgo(when)}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
          <div className="card-x">
            <div className="card-x-head">
              <h2>Logros obtenidos</h2>
              <a className="small" href="/logros">
                Ver todos
              </a>
            </div>
            <div className="card-x-body">
              {!achievements.length && (
                <div className="empty py-3">
                  <i className="bi bi-award" />Completa tu primera lección para ganar una insignia.
                </div>
              )}
              <div className="row g-2">
                {achievements.map((a) => (
                  <div key={String(a.id)} className="col-4">
                    <div className="achv p-2" title={String(a.description)}>
                      <div className="icon" style={{ width: 44, height: 44, fontSize: '1.3rem' }}>
                        <i className={`bi ${a.icon}`} />
                      </div>
                      <h3 style={{ fontSize: '.74rem' }}>{String(a.name)}</h3>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.addEventListener('DOMContentLoaded', function () {
  if (typeof Chart === 'undefined') return;
  const green = '#217346', soft = 'rgba(22,163,74,.15)';
  new Chart(document.getElementById('chartPoints'), {
    type: 'line',
    data: { labels: ${JSON.stringify(chartPoints.labels)}, datasets: [{ label: 'Puntos', data: ${JSON.stringify(chartPoints.values)}, borderColor: green, backgroundColor: soft, fill: true, tension: .35, pointRadius: 3 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
  new Chart(document.getElementById('chartModules'), {
    type: 'bar',
    data: { labels: ${JSON.stringify(modLabels)}, datasets: [{ label: '% completado', data: ${JSON.stringify(modPercents)}, backgroundColor: green, borderRadius: 6 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => ${JSON.stringify(modTitles)}[i[0].dataIndex] } } }, scales: { y: { beginAtZero: true, max: 100 } } }
  });
});`,
        }}
      />
    </>
  );
}
