import { getSession, csrfValid, flash, redirectTo } from '@/lib/session';
import { getEntity, adminOnly, statusChange, statusOptionsLabel } from '@/lib/services/crud';

// POST /admin/{entidad}/{id}/estado (réplica de CrudController::status).
export async function POST(req: Request, ctx: { params: Promise<{ any: string; id: string }> }) {
  const { any, id: idStr } = await ctx.params;
  const numId = Number(idStr);
  const s = await getSession();
  if (!s || s.uid === 0) return redirectTo(req, `/login?next=${encodeURIComponent(`/admin/${any}`)}`);
  if (s.role !== 'admin' && s.role !== 'docente') {
    return new Response('No tienes permisos para ver esta sección.', { status: 403 });
  }
  const fd = await req.formData().catch(() => new FormData());
  if (!(await csrfValid(req, fd))) {
    return new Response('Formulario expirado. Vuelve atrás, recarga la página e inténtalo de nuevo.', { status: 403 });
  }

  const e = getEntity(any);
  if (!e) return new Response('No encontrado.', { status: 404 });
  if (adminOnly(e) && s.role !== 'admin') return new Response('No tienes permisos para ver esta sección.', { status: 403 });

  const status = String(fd.get('status') ?? '');
  if (!['active', 'inactive', 'archived'].includes(status)) return new Response('No encontrado.', { status: 404 });

  const r = await statusChange(e, numId, status, s.uid);
  if (r === 'notfound') return new Response('No encontrado.', { status: 404 });
  if (r === 'self') {
    await flash('danger', 'No puedes cambiar el estado de tu propia cuenta.');
    return redirectTo(req, `/admin/${e.key}`);
  }
  await flash('success', `Estado actualizado: ${statusOptionsLabel(status)}.`);
  return redirectTo(req, `/admin/${e.key}`);
}
