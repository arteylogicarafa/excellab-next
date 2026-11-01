import { getSession, csrfValid } from '@/lib/session';
import { one, val, insert } from '@/lib/db';
import { matches } from '@/lib/services/evaluator';
import { check as checkBadges } from '@/lib/services/badges';
import { log as activityLog } from '@/lib/activity';

const json = (data: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

// POST /retos/{id}/comprobar (réplica de ChallengeController::check; JSON para app.js).
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
  const c = await one("SELECT * FROM challenges WHERE id=$1 AND status='active'", [numId]);
  if (!c) return json({ ok: false, message: 'Reto no encontrado.' }, 404);

  const fd = await req.formData().catch(() => new FormData());
  const answer = String(fd.get('answer') ?? '').trim();
  if (answer === '') {
    return json({ ok: false, message: 'Escribe tu resultado antes de validar.' }, 422);
  }

  const correct = matches(String(c.answer_kind), answer, String(c.correct_answer), Number(c.tolerance ?? 0.01));
  let points = 0;
  let badges: { name: string; icon: string }[] = [];
  let already = false;
  if (s.role === 'estudiante') {
    already = Boolean(await val('SELECT 1 FROM challenge_attempts WHERE challenge_id=$1 AND student_id=$2 AND is_correct=1 LIMIT 1', [numId, s.uid]));
    points = correct && !already ? Number(c.points) : 0;
    await insert('challenge_attempts', {
      challenge_id: numId,
      student_id: s.uid,
      answer: answer.slice(0, 500),
      is_correct: correct ? 1 : 0,
      points,
      seconds_spent: Math.min(86400, Math.max(0, Number(fd.get('seconds') ?? 0) || 0)),
    });
    await activityLog(correct ? 'reto_superado' : 'reto_fallido', 'challenges', numId, String(c.title));
    if (correct) badges = await checkBadges(s.uid);
  }

  return json({
    ok: true,
    correct,
    points,
    already,
    message: correct
      ? c.feedback_ok || '¡Reto superado!'
      : c.feedback_fail || 'Resultado incorrecto. Revisa los datos e inténtalo de nuevo.',
    badges,
    preview: s.role !== 'estudiante',
  });
}
