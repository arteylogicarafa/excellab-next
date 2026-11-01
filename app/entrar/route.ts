import { enterByEmail, originOk, flash, getSession, loginTarget, redirectTo } from '@/lib/session';

// POST /entrar — entrada de estudiantes solo con correo (AuthController::enter).
export async function POST(req: Request) {
  if (!originOk(req)) {
    return new Response('Solicitud no válida.', { status: 403 });
  }
  const fd = await req.formData();
  const email = String(fd.get('email') ?? '');
  const next = String(fd.get('next') ?? '');

  const r = await enterByEmail(email);
  if (!r.ok) {
    await flash(r.type, r.message);
    return redirectTo(req, r.redirect ?? '/login');
  }
  const s = await getSession();
  return redirectTo(req, loginTarget(s, next));
}
