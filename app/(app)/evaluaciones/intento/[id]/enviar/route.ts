import { getSession, csrfValid, redirectTo, flash } from '@/lib/session';
import { one } from '@/lib/db';
import { nowSql } from '@/lib/helpers';
import { loadAssessment, gradeAttempt, deadlineOf, naive, formAnswers, type AttemptRow } from '@/lib/services/assessment';
import { check as checkBadges } from '@/lib/services/badges';

// POST /evaluaciones/intento/{id}/enviar (réplica de AssessmentController::finish).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  const s = await getSession();
  if (!s || s.uid === 0) return redirectTo(req, `/login?next=${encodeURIComponent(`/evaluaciones/intento/${numId}`)}`);
  if (s.role !== 'estudiante') return new Response('No tienes permisos para ver esta sección.', { status: 403 });
  const fd = await req.formData().catch(() => new FormData());
  if (!(await csrfValid(req, fd))) {
    return new Response('Formulario expirado. Vuelve atrás, recarga la página e inténtalo de nuevo.', { status: 403 });
  }

  const t = await one<AttemptRow>('SELECT * FROM assessment_attempts WHERE id=$1 AND student_id=$2', [numId, s.uid]);
  if (!t) return new Response('No encontrado.', { status: 404 });
  const a = await one('SELECT * FROM assessments WHERE id=$1', [Number(t.assessment_id)]);
  if (!a) return new Response('No encontrado.', { status: 404 });
  if (t.status !== 'in_progress') return redirectTo(req, `/evaluaciones/resultado/${numId}`);

  const late = naive(nowSql()).getTime() > deadlineOf(a, t) + 30000; // 30 s de tolerancia
  await gradeAttempt(a, t, formAnswers(fd), late ? 'expired' : 'finished');
  const badges = await checkBadges(s.uid);
  for (const b of badges) await flash('info', 'Nuevo logro: ' + b.name);
  return redirectTo(req, `/evaluaciones/resultado/${numId}`);
}
