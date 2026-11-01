import { getSession, csrfValid } from '@/lib/session';
import { insert, val } from '@/lib/db';
import { find } from '@/lib/models/exercise';
import { check as evaluate } from '@/lib/services/evaluator';
import { check as checkBadges } from '@/lib/services/badges';
import { log as activityLog } from '@/lib/activity';

const json = (data: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

// POST /ejercicios/{id}/comprobar (réplica de LabController::check; JSON para app.js).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || s.uid === 0) {
    return json({ ok: false, message: 'Tu sesión expiró. Inicia sesión de nuevo.' }, 401);
  }
  if (!(await csrfValid(req))) {
    return json({ ok: false, message: 'El formulario expiró. Vuelve atrás, recarga la página e inténtalo de nuevo.' }, 403);
  }
  const { id } = await ctx.params;
  const numId = Number(id);
  const ex = await find(numId);
  if (!ex) return json({ ok: false, message: 'Ejercicio no encontrado.' }, 404);

  const fd = await req.formData().catch(() => new FormData());
  const answer = String(fd.get('answer') ?? '').trim();
  if (answer === '') {
    return json({ ok: false, message: 'Escribe o selecciona una respuesta antes de comprobar.' }, 422);
  }
  if (answer.length > 500) {
    return json({ ok: false, message: 'La respuesta es demasiado larga.' }, 422);
  }
  const context = fd.get('context') === 'lesson' ? 'lesson' : 'lab';

  const options = ex.options ?? [];
  const [correct, correctText] = evaluate(ex, answer, options);
  let attempts = 0;
  let badges: { name: string; icon: string }[] = [];
  let shownAnswer = answer;
  if (ex.answer_kind === 'option') {
    for (const o of options) if (String(o.id) === answer) shownAnswer = String(o.label);
  }
  const points = correct ? Number(ex.points) : 0;

  if (s.role === 'estudiante') {
    await insert('exercise_attempts', {
      exercise_id: numId,
      student_id: s.uid,
      context,
      answer: shownAnswer.slice(0, 500),
      is_correct: correct ? 1 : 0,
      points,
    });
    attempts = Number(
      await val('SELECT COUNT(*) FROM exercise_attempts WHERE exercise_id=$1 AND student_id=$2 AND is_correct=0', [numId, s.uid]),
    );
    await activityLog(correct ? 'ejercicio_correcto' : 'ejercicio_incorrecto', 'exercises', numId, String(ex.title));
    if (correct) badges = await checkBadges(s.uid);
  }

  return json({
    ok: true,
    correct,
    points,
    message: correct ? '¡Correcto! Excelente trabajo.' : 'Respuesta incorrecta. Revisa la explicación e inténtalo de nuevo.',
    explanation: ex.explanation ?? null,
    correct_answer: correct || attempts >= 2 || s.role !== 'estudiante' ? correctText : null,
    badges,
    preview: s.role !== 'estudiante',
  });
}
