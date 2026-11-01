import { all, one } from '../db';

// Consultas de ejercicios y sus opciones (réplica de app/Models/Exercise.php).

export interface ExerciseRow extends Record<string, unknown> {
  id: number;
  options?: { id: number; label: string; is_correct: number | string }[];
  sheet?: { headers: unknown[]; rows: unknown[][] } | null;
}

async function hydrateAsync(ex: ExerciseRow): Promise<ExerciseRow> {
  const opts = await all<{ id: number; label: string; is_correct: number | string }>(
    'SELECT id, label, is_correct FROM exercise_options WHERE exercise_id=$1 ORDER BY position, id',
    [Number(ex.id)],
  );
  ex.options = opts;
  try {
    ex.sheet = ex.data_json ? JSON.parse(String(ex.data_json)) : null;
  } catch {
    ex.sheet = null;
  }
  return ex;
}

export async function find(id: number, onlyActive = true): Promise<ExerciseRow | null> {
  const ex = await one<ExerciseRow>(
    "SELECT e.*, m.title AS module_title FROM exercises e JOIN modules m ON m.id=e.module_id WHERE e.id=$1" +
      (onlyActive ? " AND e.status='active'" : ''),
    [id],
  );
  return ex ? hydrateAsync(ex) : null;
}

export async function forLesson(lessonId: number): Promise<ExerciseRow[]> {
  const rows = await all<ExerciseRow>(
    "SELECT e.*, '' AS module_title FROM exercises e WHERE e.lesson_id=$1 AND e.status='active' ORDER BY e.id",
    [lessonId],
  );
  return Promise.all(rows.map(hydrateAsync));
}

/** Resumen del estudiante por ejercicio: intentos y si lo resolvió. */
export async function studentStatus(sid: number): Promise<Record<string, { attempts: number; solved: number; best: number }>> {
  const out: Record<string, { attempts: number; solved: number; best: number }> = {};
  for (const r of await all(
    'SELECT exercise_id, COUNT(*) attempts, MAX(is_correct) solved, MAX(points) best FROM exercise_attempts WHERE student_id=$1 GROUP BY exercise_id',
    [sid],
  )) {
    out[String(r.exercise_id)] = {
      attempts: Number(r.attempts),
      solved: Number(r.solved),
      best: Number(r.best),
    };
  }
  return out;
}

export { hydrateAsync as hydrate };
