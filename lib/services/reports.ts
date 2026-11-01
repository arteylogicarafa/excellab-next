// Lógica compartida de reportes (réplica de ReportsController::union y TYPES).

export const REPORT_TYPES: Record<string, string> = {
  lesson: 'Lección',
  exercise: 'Ejercicio',
  challenge: 'Reto',
  case: 'Caso práctico',
  assessment: 'Evaluación',
};

/** Unión de todas las fuentes de actividad. */
export function unionSql(): string {
  return `SELECT lp.completed_at AS occurred_at, lp.student_id, 'lesson' AS kind, l.title AS activity, l.module_id AS module_id, 'Completada' AS result, NULL AS score
              FROM lesson_progress lp JOIN lessons l ON l.id=lp.lesson_id
          UNION ALL
          SELECT a.created_at, a.student_id, 'exercise', e.title, e.module_id, CASE WHEN a.is_correct=1 THEN 'Correcto' ELSE 'Incorrecto' END, a.points
              FROM exercise_attempts a JOIN exercises e ON e.id=a.exercise_id
          UNION ALL
          SELECT a.created_at, a.student_id, 'challenge', c.title, NULL, CASE WHEN a.is_correct=1 THEN 'Superado' ELSE 'Fallido' END, a.points
              FROM challenge_attempts a JOIN challenges c ON c.id=a.challenge_id
          UNION ALL
          SELECT s.created_at, s.student_id, 'case', pc.title, NULL, CASE WHEN s.status='reviewed' THEN 'Revisado' ELSE 'Pendiente' END, s.score
              FROM case_submissions s JOIN practical_cases pc ON pc.id=s.case_id
          UNION ALL
          SELECT t.finished_at, t.student_id, 'assessment', a.title, a.module_id, CASE WHEN t.passed=1 THEN 'Aprobado' ELSE 'No aprobado' END, t.percent
              FROM assessment_attempts t JOIN assessments a ON a.id=t.assessment_id WHERE t.status<>'in_progress'`;
}
