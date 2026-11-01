import { getSession, csrfValid, flash, flashMany, redirectTo } from '@/lib/session';
import { getEntity, adminOnly, loadRow, save } from '@/lib/services/crud';

// POST /admin/{entidad}/guardar (réplica de CrudController::save).
export async function POST(req: Request, ctx: { params: Promise<{ any: string }> }) {
  const { any } = await ctx.params;
  const s = await getSession();
  if (!s || s.uid === 0) return redirectTo(req, `/login?next=${encodeURIComponent(`/admin/${any}/nuevo`)}`);
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

  const id = Number(fd.get('id') ?? 0) || 0;
  if (id) {
    const row = await loadRow(e, id);
    if (!row) return new Response('No encontrado.', { status: 404 });
  }

  const result = await save(e, fd, id, s.uid);
  const back = id ? `/admin/${e.key}/${id}/editar` : `/admin/${e.key}/nuevo`;

  if (result.errors.length) {
    // Equivale a los flashes + remember_input del PHP (los valores vuelven al formulario).
    const old: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (typeof v === 'string' && !['_csrf', 'password', 'password2', 'current_password'].includes(k)) old[k] = v;
    });
    const qids = fd.getAll('question_ids[]').map(String);
    if (qids.length) old['question_ids'] = JSON.stringify(qids);
    await flashMany('danger', result.errors, old);
    return redirectTo(req, back);
  }

  const label = e.singular;
  await flash('success', `${label.charAt(0).toUpperCase() + label.slice(1)} guardado correctamente.`);
  return redirectTo(req, `/admin/${e.key}`);
}
