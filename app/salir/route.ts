import { getSession, csrfValid, logout, flash, redirectTo } from '@/lib/session';
import { log as activityLog } from '@/lib/activity';

// POST /salir — cierre de sesión (AuthController::logout).
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.uid === 0) {
    return redirectTo(req, '/login');
  }
  const fd = await req.formData().catch(() => new FormData());
  if (!(await csrfValid(req, fd))) {
    return new Response('Formulario expirado. Vuelve atrás, recarga la página e inténtalo de nuevo.', { status: 403 });
  }
  await activityLog('cierre_sesion', 'users', s.uid, null, s.uid);
  await logout();
  await flash('success', 'Cerraste sesión correctamente.');
  return redirectTo(req, '/login');
}
