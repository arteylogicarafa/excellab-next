import { getSession, csrfValid, flash, redirectTo, saveSession } from '@/lib/session';
import { exec } from '@/lib/db';

// POST /cuenta/perfil (réplica de AuthController::updateProfile).
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.uid === 0) return redirectTo(req, '/login?next=' + encodeURIComponent('/cuenta'));
  const fd = await req.formData().catch(() => new FormData());
  if (!(await csrfValid(req, fd))) {
    return new Response('Formulario expirado. Vuelve atrás, recarga la página e inténtalo de nuevo.', { status: 403 });
  }
  const name = String(fd.get('name') ?? '').trim();
  const len = [...name].length;
  if (len < 3 || len > 120) {
    await flash('danger', 'El nombre debe tener entre 3 y 120 caracteres.');
    return redirectTo(req, '/cuenta');
  }
  await exec('UPDATE users SET name=$1, updated_at=NOW() WHERE id=$2', [name, s.uid]);
  await saveSession({ name });
  await flash('success', 'Perfil actualizado.');
  return redirectTo(req, '/cuenta');
}
