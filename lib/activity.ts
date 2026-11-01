import { insert } from './db';
import { getSession } from './session';

/** Registro de actividades relevantes (réplica de app/Core/Activity.php). */
export async function log(
  action: string,
  entity = '',
  entityId: number | null = null,
  detail: string | null = null,
  userId: number | null = null,
): Promise<void> {
  try {
    let uid = userId;
    if (uid === null) {
      const s = await getSession();
      uid = s?.uid ?? null;
    }
    await insert('activity_log', {
      user_id: uid ?? null,
      action,
      entity,
      entity_id: entityId,
      detail: detail !== null ? detail.slice(0, 500) : null,
      ip: null,
    });
  } catch (err) {
    console.error('Activity::log', err);
  }
}
