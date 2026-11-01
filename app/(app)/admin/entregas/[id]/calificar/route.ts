import { getSession, csrfValid, flash, redirectTo } from '@/lib/session';
import { one, exec } from '@/lib/db';
import { send as notify } from '@/lib/notifier';
import { check as checkBadges } from '@/lib/services/badges';
import { log as activityLog } from '@/lib/activity';

// POST /admin/entregas/{id}/calificar (réplica de SubmissionsController::grade).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  const s = await getSession();
  if (!s || s.uid === 0) return redirectTo(req, '/login?next=' + encodeURIComponent(`/admin/entregas/${numId}`));
  if (s.role !== 'admin' && s.role !== 'docente') return new Response('No tienes permisos para ver esta sección.', { status: 403 });
  const fd = await req.formData().catch(() => new FormData());
  if (!(await csrfValid(req, fd))) {
    return new Response('Formulario expirado. Vuelve atrás, recarga la página e inténtalo de nuevo.', { status: 403 });
  }

  const sub = await one(
    'SELECT s.*, c.points AS max_points, c.title FROM case_submissions s JOIN practical_cases c ON c.id=s.case_id WHERE s.id=$1',
    [numId],
  );
  if (!sub) return new Response('No encontrado.', { status: 404 });

  const scoreRaw = String(fd.get('score') ?? '');
  const maxPoints = Number(sub.max_points);
  const score = Number(scoreRaw);
  if (!scoreRaw.trim() || !Number.isFinite(score) || score < 0 || score > maxPoints) {
    await flash('danger', `La calificación debe ser un número entre 0 y ${maxPoints}.`);
    return redirectTo(req, `/admin/entregas/${numId}`);
  }
  const feedback = String(fd.get('feedback') ?? '').slice(0, 2000);

  await exec(
    "UPDATE case_submissions SET score=$1, feedback=$2, status='reviewed', reviewed_by=$3, reviewed_at=NOW(), updated_at=NOW() WHERE id=$4",
    [Math.round(score * 100) / 100, feedback || null, s.uid, numId],
  );
  await notify(
    Number(sub.student_id),
    'Tu entrega fue calificada',
    `${String(sub.title)}: ${Math.round(score * 10) / 10} / ${maxPoints} pts`,
    `casos/${sub.case_id}`,
  );
  await checkBadges(Number(sub.student_id));
  await activityLog('entrega_calificada', 'case_submissions', numId, `${String(sub.title)}: ${scoreRaw}`);
  await flash('success', 'Calificación guardada y estudiante notificado.');
  return redirectTo(req, '/admin/entregas');
}
