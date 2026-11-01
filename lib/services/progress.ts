import { all, one, val, exec, q } from '../db';
import { log as activityLog } from '../activity';
import { send as notify } from '../notifier';
import { nowSql } from '../helpers';

// Avance por módulo, avance general y certificados (réplica de app/Services/ProgressService.php).

type Row = Record<string, unknown>;

export async function completeLesson(sid: number, lessonId: number): Promise<void> {
  const lesson = await one('SELECT id, module_id, title FROM lessons WHERE id=$1', [lessonId]);
  if (!lesson) return;
  await exec('INSERT INTO lesson_progress (student_id, lesson_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [sid, lessonId]);
  await activityLog('leccion_completada', 'lessons', lessonId, String(lesson.title));
  await recompute(sid, Number(lesson.module_id));
}

export async function recompute(sid: number, moduleId: number): Promise<void> {
  const total = Number(await val("SELECT COUNT(*) FROM lessons WHERE module_id=$1 AND status='active'", [moduleId]));
  const done = Number(
    await val("SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id=lp.lesson_id WHERE lp.student_id=$1 AND l.module_id=$2 AND l.status='active'", [sid, moduleId]),
  );
  const percent = total ? Math.round((done / total) * 100 * 100) / 100 : 0;
  const row = await one('SELECT * FROM student_progress WHERE student_id=$1 AND module_id=$2', [sid, moduleId]);
  const completed = total > 0 && done >= total;
  let completedAt = row ? (row.completed_at ? String(row.completed_at) : null) : null;
  let code = row ? (row.certificate_code ? String(row.certificate_code) : null) : null;
  if (completed && !completedAt) {
    completedAt = nowSql();
    code = `XL-${String(moduleId).padStart(2, '0')}-${String(sid).padStart(3, '0')}-${Math.random().toString(16).slice(2, 7).toUpperCase()}`;
    const mod = await val('SELECT title FROM modules WHERE id=$1', [moduleId]);
    await notify(sid, '¡Módulo completado!', `Terminaste "${mod}". Ya puedes descargar tu certificado.`, `certificado/${moduleId}`);
    await activityLog('modulo_completado', 'modules', moduleId, String(mod));
  } else if (!completed) {
    completedAt = null; // se agregaron lecciones nuevas: el módulo vuelve a estar en curso
  }
  await q(
    `INSERT INTO student_progress (student_id, module_id, lessons_total, lessons_done, percent, completed_at, certificate_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (student_id, module_id) DO UPDATE
     SET lessons_total=EXCLUDED.lessons_total, lessons_done=EXCLUDED.lessons_done,
     percent=EXCLUDED.percent, completed_at=EXCLUDED.completed_at,
     certificate_code=COALESCE(student_progress.certificate_code, EXCLUDED.certificate_code),
     updated_at=NOW()`,
    [sid, moduleId, total, done, percent, completedAt, code],
  );
}

export interface ModuleRow extends Row {
  lessons_total: number | string;
  lessons_done: number | string;
}

/** Módulos activos con el avance del estudiante. */
export async function modules(sid: number): Promise<Row[]> {
  return all(
    `SELECT m.*,
        (SELECT COUNT(*) FROM lessons l WHERE l.module_id=m.id AND l.status='active') AS lessons_total,
        (SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id=lp.lesson_id WHERE lp.student_id=$1 AND l.module_id=m.id AND l.status='active') AS lessons_done,
        (SELECT certificate_code FROM student_progress sp WHERE sp.student_id=$1 AND sp.module_id=m.id AND sp.completed_at IS NOT NULL) AS certificate_code
      FROM modules m WHERE m.status='active' ORDER BY m.position, m.id`,
    [sid],
  );
}

export async function overall(sid: number): Promise<number> {
  const total = Number(await val("SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.status='active' AND m.status='active'"));
  if (!total) return 0;
  const done = Number(
    await val("SELECT COUNT(*) FROM lesson_progress lp JOIN lessons l ON l.id=lp.lesson_id JOIN modules m ON m.id=l.module_id WHERE lp.student_id=$1 AND l.status='active' AND m.status='active'", [sid]),
  );
  return Math.round((done / total) * 100 * 10) / 10;
}

/** Primera lección pendiente (para el botón "Continuar aprendiendo"). */
export async function nextLesson(sid: number): Promise<Row | null> {
  return one(
    `SELECT l.id, l.title, m.title AS module_title FROM lessons l JOIN modules m ON m.id=l.module_id
      WHERE l.status='active' AND m.status='active' AND l.id NOT IN (SELECT lesson_id FROM lesson_progress WHERE student_id=$1)
      ORDER BY m.position, m.id, l.position, l.id LIMIT 1`,
    [sid],
  );
}
