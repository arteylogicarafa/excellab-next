import { one, q, insert } from './db';

// Notificaciones internas (réplica de app/Services/Notifier.php).

export async function send(userId: number, title: string, message?: string | null, link?: string | null): Promise<void> {
  await insert('notifications', {
    user_id: userId,
    title: title.slice(0, 150),
    message: message ? message.slice(0, 400) : null,
    link: link ?? null,
  });
}

export async function unread(userId: number): Promise<number> {
  const v = await one<{ n: string }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id=$1 AND is_read=0', [userId]);
  return Number(v?.n ?? 0);
}

export async function latest(userId: number, limit = 6): Promise<Record<string, unknown>[]> {
  return q(`SELECT * FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT ${Number(limit)}`, [userId]);
}

/** Avisa a todos los docentes y administradores activos. */
export async function staff(title: string, message?: string | null, link?: string | null): Promise<void> {
  const users = await q<{ id: string | number }>(
    "SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name IN ('admin','docente') AND u.status='active'",
  );
  for (const u of users) {
    await send(Number(u.id), title, message, link);
  }
}
