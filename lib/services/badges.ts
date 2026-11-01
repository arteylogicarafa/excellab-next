import { all, insert } from '../db';
import { counts } from './stats';
import { send as notify } from '../notifier';
import { log as activityLog } from '../activity';

// Otorga insignias cuando el estudiante alcanza las metas definidas (réplica de app/Services/BadgeService.php).

export async function check(sid: number): Promise<{ name: string; icon: string }[]> {
  const c = await counts(sid);
  const awarded: { name: string; icon: string }[] = [];
  const pending = await all(
    "SELECT a.* FROM achievements a WHERE a.status='active' AND a.id NOT IN (SELECT achievement_id FROM student_achievements WHERE student_id=$1)",
    [sid],
  );
  for (const a of pending) {
    const metric = String(a.metric);
    if ((c[metric] ?? 0) >= Number(a.threshold)) {
      try {
        await insert('student_achievements', { student_id: sid, achievement_id: Number(a.id) });
      } catch {
        continue; // ya otorgado en una petición simultánea
      }
      await notify(sid, `¡Nuevo logro: ${a.name}!`, String(a.description), 'logros');
      await activityLog('logro', 'achievements', Number(a.id), String(a.name), sid);
      awarded.push({ name: String(a.name), icon: String(a.icon) });
    }
  }
  return awarded;
}
