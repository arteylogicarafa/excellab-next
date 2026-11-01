import { getSession, csrfValid, flash, redirectTo } from '@/lib/session';
import { all, val, insert } from '@/lib/db';
import { nowSql } from '@/lib/helpers';
import { loadAssessment, gradeAttempt, deadlineOf, naive, type AttemptRow } from '@/lib/services/assessment';
import { log as activityLog } from '@/lib/activity';

// POST /evaluaciones/{id}/iniciar (réplica de AssessmentController::start).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  const s = await getSession();
  if (!s || s.uid === 0) return redirectTo(req, `/login?next=${encodeURIComponent(`/evaluaciones/${numId}`)}`);
  if (s.role !== 'estudiante') return new Response('No tienes permisos para ver esta sección.', { status: 403 });
  const fd = await req.formData().catch(() => new FormData());
  if (!(await csrfValid(req, fd))) {
    return new Response('Formulario expirado. Vuelve atrás, recarga la página e inténtalo de nuevo.', { status: 403 });
  }

  const a = await loadAssessment(numId);
  if (!a) return new Response('No encontrado.', { status: 404 });

  const open = await all<AttemptRow>(
    "SELECT * FROM assessment_attempts WHERE assessment_id=$1 AND student_id=$2 AND status='in_progress'",
    [numId, s.uid],
  );
  const now = naive(nowSql()).getTime();
  for (const t of open) {
    if (deadlineOf(a, t) > now) return redirectTo(req, `/evaluaciones/intento/${t.id}`);
    await gradeAttempt(a, t, {}, 'expired');
  }

  const finished = Number(
    await val("SELECT COUNT(*) FROM assessment_attempts WHERE assessment_id=$1 AND student_id=$2 AND status<>'in_progress'", [numId, s.uid]),
  );
  const maxAttempts = Number(a.max_attempts);
  if (maxAttempts && finished >= maxAttempts) {
    await flash('warning', 'Ya usaste todos los intentos disponibles de esta evaluación.');
    return redirectTo(req, `/evaluaciones/${numId}`);
  }

  const rows = await all<{ id: number }>(
    "SELECT e.id FROM assessment_questions q JOIN exercises e ON e.id=q.exercise_id WHERE q.assessment_id=$1 AND e.status='active' ORDER BY q.position",
    [numId],
  );
  let ids = rows.map((r) => Number(r.id));
  if (!ids.length) {
    await flash('warning', 'Esta evaluación aún no tiene preguntas.');
    return redirectTo(req, `/evaluaciones/${numId}`);
  }
  if (Number(a.randomize)) {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
  }
  const qpa = Number(a.questions_per_attempt);
  if (qpa > 0) ids = ids.slice(0, qpa);

  const aid = await insert('assessment_attempts', {
    assessment_id: numId,
    student_id: s.uid,
    question_ids: JSON.stringify(ids.map((x) => Number(x))),
    started_at: nowSql(),
  });
  await activityLog('evaluacion_iniciada', 'assessments', numId, String(a.title));
  return redirectTo(req, `/evaluaciones/intento/${aid}`);
}
