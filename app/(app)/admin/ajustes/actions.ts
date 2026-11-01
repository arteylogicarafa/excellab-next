'use server';

import { redirect } from 'next/navigation';
import { getSession, csrfValid, flash } from '@/lib/session';
import { q } from '@/lib/db';
import { log as activityLog } from '@/lib/activity';

/** Guardar ajustes (réplica de SettingsController::save; acceso solo admin). */
export async function saveSettings(formData: FormData): Promise<void> {
  const s = await getSession();
  if (!s || s.uid === 0) redirect('/login?next=' + encodeURIComponent('/admin/ajustes'));
  if (s.role !== 'admin') redirect('/403');
  if (!(await csrfValid(new Request('http://localhost/'), formData))) redirect('/403');

  const on = formData.get('ranking_enabled') === '1' ? '1' : '0';
  await q('INSERT INTO settings (skey, svalue) VALUES ($1, $2) ON CONFLICT (skey) DO UPDATE SET svalue=EXCLUDED.svalue', [
    'ranking_enabled',
    on,
  ]);
  await activityLog('ajustes_actualizados', 'settings', null, 'ranking=' + on);
  await flash('success', 'Ajustes guardados.');
  redirect('/admin/ajustes');
}
