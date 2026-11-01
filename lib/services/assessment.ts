import { one, val, q } from '../db';
import { nowSql } from '../helpers';
import { find, type ExerciseRow } from '../models/exercise';
import { check as evaluate } from './evaluator';
import { log as activityLog } from '../activity';
import { send as notify } from '../notifier';

// Lógica compartida de evaluaciones (réplica de AssessmentController y su método grade).

export interface AttemptRow extends Record<string, unknown> {
  id: number;
  assessment_id: number;
  student_id: number;
  question_ids: string;
  status: string;
  started_at: string;
  finished_at?: string | null;
}

/** Fecha «Y-m-d H:i:s» tratada en el mismo dominio (hora local de la aplicación). */
export function naive(s: string | Date): Date {
  const str = typeof s === 'string' ? s : nowSql();
  return new Date(str.replace(' ', 'T').slice(0, 19));
}

export function deadlineOf(a: Record<string, unknown>, t: { started_at: string | Date }): number {
  return naive(t.started_at).getTime() + Number(a.time_limit_min) * 60000;
}

export function remainingSeconds(a: Record<string, unknown>, t: { started_at: string | Date }): number {
  return Math.floor((deadlineOf(a, t) - naive(nowSql()).getTime()) / 1000);
}

export async function loadAssessment(id: number): Promise<Record<string, unknown> | null> {
  return one("SELECT a.*, m.title AS module_title FROM assessments a LEFT JOIN modules m ON m.id=a.module_id WHERE a.id=$1 AND a.status='active'", [id]);
}

export async function poolCount(assessmentId: number): Promise<number> {
  return Number(
    await val(
      "SELECT COUNT(*) FROM assessment_questions q JOIN exercises e ON e.id=q.exercise_id AND e.status='active' WHERE q.assessment_id=$1",
      [assessmentId],
    ),
  );
}

/**
 * Califica un intento (réplica de AssessmentController::grade).
 * $answers: mapa idEjercicio => respuesta dada.
 */
export async function gradeAttempt(
  a: Record<string, unknown>,
  t: AttemptRow,
  answers: Record<string, string>,
  status: 'finished' | 'expired',
): Promise<void> {
  const ids: number[] = JSON.parse(t.question_ids) ?? [];
  let score = 0;
  let max = 0;
  const detail: Record<string, { answer: string; ok: boolean }> = {};
  for (const exId of ids) {
    const ex = await find(Number(exId), false);
    if (!ex) continue;
    const givenRaw = answers[String(exId)];
    const given = givenRaw !== undefined && !Array.isArray(givenRaw) ? String(givenRaw).trim() : '';
    const [ok] = evaluate(ex, given, ex.options ?? []);
    max += Number(ex.points);
    score += ok ? Number(ex.points) : 0;
    let label = given;
    if (ex.answer_kind === 'option') {
      for (const o of ex.options ?? []) if (String(o.id) === given) label = String(o.label);
    }
    detail[String(exId)] = { answer: label.slice(0, 300), ok };
  }
  const percent = max ? Math.round((score / max) * 100 * 100) / 100 : 0;
  const passed = percent >= Number(a.pass_percent) ? 1 : 0;
  await q(
    `UPDATE assessment_attempts SET answers_json=$1, score=$2, max_score=$3, percent=$4, passed=$5, finished_at=NOW(), status=$6
     WHERE id=$7 AND status='in_progress'`,
    [JSON.stringify(detail), score, max, percent, passed, status, Number(t.id)],
  );
  await activityLog('evaluacion_finalizada', 'assessments', Number(a.id), `${a.title}: ${Math.round(percent)}%`, Number(t.student_id));
  await notify(
    Number(t.student_id),
    passed ? 'Evaluación aprobada' : 'Evaluación finalizada',
    `${a.title}: ${Math.round(percent)}% (mínimo ${a.pass_percent}%)`,
    `evaluaciones/resultado/${t.id}`,
  );
}

/** Extrae las respuestas del formulario (answers[id]). */
export function formAnswers(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  fd.forEach((value, key) => {
    const m = key.match(/^answers\[(\d+)\]$/);
    if (m && typeof value === 'string') out[m[1]] = value;
  });
  return out;
}

export async function questionExercises(questionIds: string): Promise<ExerciseRow[]> {
  const ids: number[] = JSON.parse(questionIds) ?? [];
  const out: ExerciseRow[] = [];
  for (const id of ids) {
    const ex = await find(Number(id), false);
    if (ex) out.push(ex);
  }
  return out;
}
