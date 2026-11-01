import { getSession, csrfValid, flash, redirectTo } from '@/lib/session';
import { one } from '@/lib/db';
import { completeLesson } from '@/lib/services/progress';
import { check as checkBadges } from '@/lib/services/badges';

// POST /aprender/leccion/{id}/completar (réplica de LearnController::complete).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  const path = `/aprender/leccion/${numId}/completar`;
  const s = await getSession();
  if (!s || s.uid === 0) return redirectTo(req, `/login?next=${encodeURIComponent(path)}`);
  if (s.role !== 'estudiante') return redirectTo(req, '/403');
  const fd = await req.formData().catch(() => new FormData());
  if (!(await csrfValid(req, fd))) {
    return new Response('Formulario expirado. Vuelve atrás, recarga la página e inténtalo de nuevo.', { status: 403 });
  }
  const lesson = await one('SELECT id, module_id FROM lessons WHERE id=$1 AND status=\'active\'', [numId]);
  if (!lesson) return new Response('No encontrado.', { status: 404 });

  await completeLesson(s.uid, numId);
  const badges = await checkBadges(s.uid);
  await flash('success', '¡Lección completada!');
  for (const b of badges) await flash('info', 'Nuevo logro: ' + b.name);

  const next = await one(
    `SELECT id FROM lessons WHERE module_id=$1 AND status='active'
      AND (position>(SELECT position FROM lessons WHERE id=$2) OR (position=(SELECT position FROM lessons WHERE id=$2) AND id>$3))
      ORDER BY position, id LIMIT 1`,
    [Number(lesson.module_id), numId, numId],
  );
  return redirectTo(req, next ? `/aprender/leccion/${next.id}` : `/aprender/modulo/${lesson.module_id}`);
}
