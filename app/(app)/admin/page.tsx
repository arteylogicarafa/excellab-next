import { guard } from '@/lib/session';
import { all, val } from '@/lib/db';
import { nowSql, timeAgo } from '@/lib/helpers';
import * as stats from '@/lib/services/stats';
import * as progress from '@/lib/services/progress';

export const metadata = { title: 'Panel docente' };

// Panel docente (réplica de AdminDashboardController::index + admin/dashboard.php).
export default async function AdminPage() {
  const s = await guard('staff', '/admin');

  const kpi = {
    students: Number(await val("SELECT COUNT(*) FROM users WHERE role_id=3 AND status<>'archived'")),
    active: Number(
      await val(
        "SELECT COUNT(DISTINCT al.user_id) FROM activity_log al JOIN users u ON u.id=al.user_id WHERE u.role_id=3 AND u.status='active' AND al.created_at >= NOW() - INTERVAL '30 days'",
      ),
    ),
    modules: Number(await val("SELECT COUNT(*) FROM modules WHERE status='active'")),
    exercises: Number(await val("SELECT COUNT(*) FROM exercises WHERE status='active'")),
    assessments: Number(await val("SELECT COUNT(*) FROM assessment_attempts WHERE status<>'in_progress'")),
    average: Math.round(Number(await val("SELECT AVG(percent) FROM assessment_attempts WHERE status<>'in_progress'")) * 10) / 10,
    pending: Number(await val("SELECT COUNT(*) FROM case_submissions WHERE status='submitted'")),
    lessons: Number(await val("SELECT COUNT(*) FROM lessons WHERE status='active'")),
  };

  // Actividad diaria (intentos y entregas) en los últimos 14 días
  const days: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const p = (n: number) => String(n).padStart(2, '0');
    days[`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`] = 0;
  }
  const from = Object.keys(days)[0];
  const sources = [
    'SELECT DATE(created_at) d, COUNT(*) n FROM exercise_attempts WHERE created_at >= $1 GROUP BY d',
    'SELECT DATE(created_at) d, COUNT(*) n FROM challenge_attempts WHERE created_at >= $1 GROUP BY d',
    'SELECT DATE(created_at) d, COUNT(*) n FROM case_submissions WHERE created_at >= $1 GROUP BY d',
    'SELECT DATE(started_at) d, COUNT(*) n FROM assessment_attempts WHERE started_at >= $1 GROUP BY d',
    'SELECT DATE(completed_at) d, COUNT(*) n FROM lesson_progress WHERE completed_at >= $1 GROUP BY d',
  ];
  for (const sql of sources) {
    for (const r of await all(sql, [from])) {
      const key = String(r.d).slice(0, 10);
      if (key in days) days[key] += Number(r.n);
    }
  }
  const dayLabels = Object.keys(days).map((k) => k.slice(8, 10) + '/' + k.slice(5, 7));
  const dayValues = Object.values(days);

  const activeCount = Math.max(1, Number(await val("SELECT COUNT(*) FROM users WHERE role_id=3 AND status='active'")));
  const moduleStats = await all(
    `SELECT m.title, COALESCE(SUM(sp.percent),0) AS total FROM modules m
      LEFT JOIN student_progress sp ON sp.module_id=m.id AND sp.student_id IN (SELECT id FROM users WHERE role_id=3 AND status='active')
      WHERE m.status='active' GROUP BY m.id, m.title ORDER BY m.position`,
  );
  const statsAvg = moduleStats.map((m) => Math.round((Number(m.total) / activeCount) * 10) / 10);

  const passed = Number(await val("SELECT COUNT(*) FROM assessment_attempts WHERE status<>'in_progress' AND passed=1"));
  const failed = kpi.assessments - passed;

  const map = await stats.pointsMap();
  const top: { id: number; name: string; points: number; progress: number }[] = [];
  for (const stu of await all("SELECT id, name FROM users WHERE role_id=3 AND status='active'")) {
    top.push({
      id: Number(stu.id),
      name: String(stu.name),
      points: Math.round(map[Number(stu.id)] ?? 0),
      progress: await progress.overall(Number(stu.id)),
    });
  }
  top.sort((a, b) => b.points - a.points);

  const pendingSubs = await all(
    "SELECT s.id, s.created_at, u.name, c.title FROM case_submissions s JOIN users u ON u.id=s.student_id JOIN practical_cases c ON c.id=s.case_id WHERE s.status='submitted' ORDER BY s.id DESC LIMIT 5",
  );

  const kpis: [string, string, string | number, string][] = [
    ['bi-people', '', kpi.students, 'Total de estudiantes'],
    ['bi-person-check', 'blue', kpi.active, 'Activos (últimos 30 días)'],
    ['bi-collection', '', kpi.modules, 'Módulos disponibles'],
    ['bi-pencil-square', 'violet', kpi.exercises, 'Ejercicios registrados'],
    ['bi-clipboard-check', 'amber', kpi.assessments, 'Evaluaciones realizadas'],
    ['bi-graph-up', '', `${kpi.average}%`, 'Promedio general de resultados'],
  ];
  const modLabels = moduleStats.map((_, i) => `M${i + 1}`);
  const modTitles = moduleStats.map((m) => String(m.title));
  const modAvgs = statsAvg;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Panel docente</h1>
          <p>Resumen del curso de Paquetes Informáticos.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <a className="btn btn-soft" href="/admin/estudiantes/nuevo">
            <i className="bi bi-person-plus" /> Nuevo estudiante
          </a>
          <a className="btn btn-primary" href="/admin/reportes">
            <i className="bi bi-file-earmark-bar-graph" /> Reportes
          </a>
        </div>
      </div>
      <div className="row g-3 mb-4">
        {kpis.map(([icon, tone, val, label]) => (
          <div className="col-6 col-md-4" key={label}>
            <div className="card-x stat-card">
              <div className={`stat-icon ${tone}`}>
                <i className={`bi ${icon}`} />
              </div>
              <div>
                <div className="stat-value">{val}</div>
                <div className="stat-label">{label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <div className="card-x">
            <div className="card-x-head">
              <h2>Actividad de los estudiantes · 14 días</h2>
            </div>
            <div className="card-x-body">
              <canvas id="chActivity" height="100" role="img" aria-label="Actividad diaria" />
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card-x h-100">
            <div className="card-x-head">
              <h2>Resultados de evaluaciones</h2>
            </div>
            <div className="card-x-body d-grid place-items-center">
              {passed + failed === 0 ? (
                <div className="empty">Sin evaluaciones aún</div>
              ) : (
                <canvas id="chAssess" height="200" role="img" aria-label="Aprobados y no aprobados" />
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card-x">
            <div className="card-x-head">
              <h2>Avance promedio por módulo</h2>
            </div>
            <div className="card-x-body">
              <canvas id="chModules" height="150" role="img" aria-label="Avance por módulo" />
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card-x mb-4">
            <div className="card-x-head">
              <h2>
                Entregas por revisar <span className="badge text-bg-warning ms-1">{kpi.pending}</span>
              </h2>
              <a className="small" href="/admin/entregas">
                Ver todas
              </a>
            </div>
            {!pendingSubs.length && <div className="empty py-4">No hay entregas pendientes.</div>}
            {pendingSubs.map((p) => (
              <a className="item-row" key={String(p.id)} href={`/admin/entregas/${p.id}`}>
                <div className="feed-icon">
                  <i className="bi bi-file-earmark-excel" />
                </div>
                <div className="flex-grow-1">
                  <div className="fw-semibold">{String(p.title)}</div>
                  <div className="small text-muted">
                    {String(p.name)} · {timeAgo(String(p.created_at))}
                  </div>
                </div>
                <i className="bi bi-chevron-right text-muted" />
              </a>
            ))}
          </div>
          <div className="card-x">
            <div className="card-x-head">
              <h2>Estudiantes con más puntos</h2>
              <a className="small" href="/admin/seguimiento">
                Seguimiento
              </a>
            </div>
            {top.slice(0, 5).map((t) => (
              <a className="item-row" key={t.id} href={`/admin/seguimiento/${t.id}`}>
                <div className="avatar">{t.name.slice(0, 1).toUpperCase()}</div>
                <div className="flex-grow-1">
                  <div className="fw-semibold">{t.name}</div>
                  <div className="progress mt-1" style={{ height: '.35rem' }}>
                    <div className="progress-bar" style={{ width: `${t.progress}%` }} />
                  </div>
                </div>
                <strong>{t.points} pts</strong>
              </a>
            ))}
          </div>
        </div>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.addEventListener('DOMContentLoaded', function () {
  if (typeof Chart === 'undefined') return;
  const g = '#217346';
  new Chart(document.getElementById('chActivity'), { type: 'bar', data: { labels: ${JSON.stringify(dayLabels)}, datasets: [{ label: 'Actividades', data: ${JSON.stringify(dayValues)}, backgroundColor: g, borderRadius: 5 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
  ${passed + failed > 0 ? `new Chart(document.getElementById('chAssess'), { type: 'doughnut', data: { labels: ['Aprobados', 'No aprobados'], datasets: [{ data: [${passed}, ${failed}], backgroundColor: [g, '#e5e7eb'] }] }, options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } } });` : ''}
  new Chart(document.getElementById('chModules'), { type: 'bar', data: { labels: ${JSON.stringify(modLabels)}, datasets: [{ label: '% promedio', data: ${JSON.stringify(modAvgs)}, backgroundColor: '#16a34a', borderRadius: 5 }] }, options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => ${JSON.stringify(modTitles)}[i[0].dataIndex] } } }, scales: { x: { beginAtZero: true, max: 100 } } } });
});`,
        }}
      />
    </>
  );
}
