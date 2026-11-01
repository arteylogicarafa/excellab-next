import { getSession, csrfValid, redirectTo } from '@/lib/session';
import { exec } from '@/lib/db';

// POST /notificaciones/leer (réplica de MiscController::readAll).
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.uid === 0) return redirectTo(req, '/login?next=' + encodeURIComponent('/notificaciones'));
  const fd = await req.formData().catch(() => new FormData());
  if (!(await csrfValid(req, fd))) {
    return new Response('Formulario expirado. Vuelve atrás, recarga la página e inténtalo de nuevo.', { status: 403 });
  }
  await exec('UPDATE notifications SET is_read=1 WHERE user_id=$1', [s.uid]);
  return redirectTo(req, '/notificaciones');
}
