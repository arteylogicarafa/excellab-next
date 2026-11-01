'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { getSession, csrfValid, flash, saveSession, homeFor } from '@/lib/session';
import { one, exec } from '@/lib/db';
import { log as activityLog } from '@/lib/activity';

// Acciones del formulario de cuenta (réplica de AuthController::updateProfile y ::changePassword).

const DUMMY = new Request('http://localhost/');

function passwordError(p: string, p2: string): string | null {
  if (Buffer.byteLength(p, 'utf8') < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'La contraseña debe combinar letras y números.';
  if (p !== p2) return 'La confirmación no coincide con la nueva contraseña.';
  return null;
}

/** Actualizar perfil. */
export async function updateProfile(formData: FormData): Promise<void> {
  const s = await getSession();
  if (!s || s.uid === 0) redirect('/login?next=' + encodeURIComponent('/cuenta'));
  if (!(await csrfValid(DUMMY, formData))) redirect('/403');
  const name = String(formData.get('name') ?? '').trim();
  const len = [...name].length;
  if (len < 3 || len > 120) {
    await flash('danger', 'El nombre debe tener entre 3 y 120 caracteres.');
    redirect('/cuenta');
  }
  await exec('UPDATE users SET name=$1, updated_at=NOW() WHERE id=$2', [name, s.uid]);
  await saveSession({ name });
  await flash('success', 'Perfil actualizado.');
  redirect('/cuenta');
}

/** Cambiar contraseña (también resuelve el cambio obligatorio del primer acceso). */
export async function changePassword(formData: FormData): Promise<void> {
  const s = await getSession();
  if (!s || s.uid === 0) redirect('/login?next=' + encodeURIComponent('/cuenta/password'));
  if (!(await csrfValid(DUMMY, formData))) redirect('/403');
  const user = await one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id=$1', [s.uid]);
  const current = String(formData.get('current_password') ?? '');
  const newPass = String(formData.get('password') ?? '');
  const confirm = String(formData.get('password2') ?? '');
  if (!user || !bcrypt.compare(current, String(user.password_hash))) {
    await flash('danger', 'La contraseña actual no es correcta.');
    redirect('/cuenta/password');
  }
  if (newPass === current) {
    await flash('danger', 'La nueva contraseña debe ser distinta de la actual.');
    redirect('/cuenta/password');
  }
  const err = passwordError(newPass, confirm);
  if (err) {
    await flash('danger', err);
    redirect('/cuenta/password');
  }
  await exec('UPDATE users SET password_hash=$1, must_change_password=0, updated_at=NOW() WHERE id=$2', [
    bcrypt.hashSync(newPass, 10),
    s.uid,
  ]);
  await saveSession({ mustChange: false });
  await activityLog('contrasena_cambiada', 'users', s.uid, null, s.uid);
  await flash('success', 'Contraseña actualizada correctamente.');
  redirect(homeFor(s));
}
