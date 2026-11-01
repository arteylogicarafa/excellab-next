import { all, val } from '../db';
import { dateKey } from '../helpers';

// Cálculos de puntaje, métricas y actividad reciente (réplica de app/Services/Stats.php).

type Row = Record<string, unknown>;

/** Puntos por estudiante: mejor resultado de cada ejercicio, reto y caso. */
export async function pointsMap(): Promise<Record<number, number>> {
  const map: Record<number, number> = {};
  const queries = [
    'SELECT student_id, SUM(m) p FROM (SELECT student_id, MAX(points) m FROM exercise_attempts GROUP BY student_id, exercise_id) t GROUP BY student_id',
    'SELECT student_id, SUM(m) p FROM (SELECT student_id, MAX(points) m FROM challenge_attempts GROUP BY student_id, challenge_id) t GROUP BY student_id',
    'SELECT student_id, SUM(m) p FROM (SELECT student_id, MAX(score) m FROM case_submissions WHERE score IS NOT NULL GROUP BY student_id, case_id) t GROUP BY student_id',
  ];
  for (const sql of queries) {
    for (const r of await all(sql)) {
      const k = Number(r.student_id);
      map[k] = (map[k] ?? 0) + Number(r.p ?? 0);
    }
  }
  return map;
}

export async function points(sid: number): Promise<number> {
  return Math.round((await pointsMap())[sid] ?? 0);
}

/** Métricas usadas por los logros y el panel del estudiante. */
export async function counts(sid: number): Promise<Record<string, number>> {
  return {
    lessons: Number(await val('SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id=lp.lesson_id WHERE lp.student_id=$1', [sid])),
    exercises: Number(await val('SELECT COUNT(DISTINCT exercise_id) FROM exercise_attempts WHERE student_id=$1 AND is_correct=1', [sid])),
    attempted: Number(await val('SELECT COUNT(DISTINCT exercise_id) FROM exercise_attempts WHERE student_id=$1', [sid])),
    challenges: Number(await val('SELECT COUNT(DISTINCT challenge_id) FROM challenge_attempts WHERE student_id=$1 AND is_correct=1', [sid])),
    modules: Number(await val('SELECT COUNT(*) FROM student_progress WHERE student_id=$1 AND completed_at IS NOT NULL', [sid])),
    assessments: Number(await val('SELECT COUNT(DISTINCT assessment_id) FROM assessment_attempts WHERE student_id=$1 AND passed=1', [sid])),
    cases: Number(await val('SELECT COUNT(DISTINCT case_id) FROM case_submissions WHERE student_id=$1', [sid])),
    points: await points(sid),
  };
}

/** Puntos ganados por día durante los últimos $days días (primer acierto de cada actividad). */
export async function pointsByDay(sid: number, days = 14): Promise<{ labels: string[]; values: number[] }> {
  const from = new Date(Date.now() - (days - 1) * 86400000);
  const rows: Record<string, number> = {};
  const queries = [
    'SELECT DATE(f) d, SUM(p) s FROM (SELECT MIN(created_at) f, MAX(points) p FROM exercise_attempts WHERE student_id=$1 AND is_correct=1 GROUP BY exercise_id) t GROUP BY d',
    'SELECT DATE(f) d, SUM(p) s FROM (SELECT MIN(created_at) f, MAX(points) p FROM challenge_attempts WHERE student_id=$1 AND is_correct=1 GROUP BY challenge_id) t GROUP BY d',
    'SELECT DATE(f) d, SUM(p) s FROM (SELECT MIN(created_at) f, MAX(score) p FROM case_submissions WHERE student_id=$1 AND score IS NOT NULL GROUP BY case_id) t GROUP BY d',
  ];
  for (const sql of queries) {
    for (const r of await all(sql, [sid])) {
      const k = dateKey(r.d);
      rows[k] = (rows[k] ?? 0) + Number(r.s ?? 0);
    }
  }
  const labels: string[] = [];
  const values: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getTime() + i * 86400000);
    const p = (n: number) => String(n).padStart(2, '0');
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    labels.push(`${p(d.getDate())}/${p(d.getMonth() + 1)}`);
    values.push(Math.round((rows[key] ?? 0) * 10) / 10);
  }
  return { labels, values };
}

export type FeedItem = [icon: string, tone: string, text: string, when: string, link: string];

/** Últimas actividades del estudiante combinando todas las fuentes. */
export async function recent(sid: number, limit = 8): Promise<FeedItem[]> {
  const items: FeedItem[] = [];
  const L = Number(limit);
  for (const r of await all('SELECT l.title, l.id, lp.completed_at t FROM lesson_progress lp JOIN lessons l ON l.id=lp.lesson_id WHERE lp.student_id=$1 ORDER BY lp.completed_at DESC LIMIT ' + L, [sid])) {
    items.push(['bi-book', 'success', `Completaste la lección "${r.title}"`, String(r.t), `/aprender/leccion/${r.id}`]);
  }
  for (const r of await all('SELECT e.title, e.id, a.is_correct, a.points, a.created_at t FROM exercise_attempts a JOIN exercises e ON e.id=a.exercise_id WHERE a.student_id=$1 ORDER BY a.id DESC LIMIT ' + L, [sid])) {
    items.push([
      Number(r.is_correct) ? 'bi-check-circle' : 'bi-x-circle',
      Number(r.is_correct) ? 'success' : 'danger',
      (Number(r.is_correct) ? 'Acertaste' : 'Fallaste') + ` el ejercicio "${r.title}"` + (Number(r.is_correct) ? ` (+${r.points} pts)` : ''),
      String(r.t),
      `/laboratorio/${r.id}`,
    ]);
  }
  for (const r of await all('SELECT c.title, c.id, a.is_correct, a.points, a.created_at t FROM challenge_attempts a JOIN challenges c ON c.id=a.challenge_id WHERE a.student_id=$1 ORDER BY a.id DESC LIMIT ' + L, [sid])) {
    items.push([
      'bi-trophy',
      Number(r.is_correct) ? 'warning' : 'secondary',
      (Number(r.is_correct) ? 'Superaste' : 'Intentaste') + ` el reto "${r.title}"`,
      String(r.t),
      `/retos/${r.id}`,
    ]);
  }
  for (const r of await all("SELECT a.title, a.id, t.percent, t.passed, t.finished_at t FROM assessment_attempts t JOIN assessments a ON a.id=t.assessment_id WHERE t.student_id=$1 AND t.status<>'in_progress' ORDER BY t.id DESC LIMIT " + L, [sid])) {
    items.push([
      'bi-clipboard-check',
      Number(r.passed) ? 'success' : 'danger',
      `Evaluación "${r.title}": ${Math.round(Number(r.percent))}%`,
      String(r.t),
      `/evaluaciones/${r.id}`,
    ]);
  }
  for (const r of await all('SELECT c.title, c.id, s.created_at t FROM case_submissions s JOIN practical_cases c ON c.id=s.case_id WHERE s.student_id=$1 ORDER BY s.id DESC LIMIT ' + L, [sid])) {
    items.push(['bi-briefcase', 'primary', `Entregaste el caso "${r.title}"`, String(r.t), `/casos/${r.id}`]);
  }
  items.sort((a, b) => (String(b[3]) < String(a[3]) ? -1 : String(b[3]) > String(a[3]) ? 1 : 0));
  return items.slice(0, limit);
}
