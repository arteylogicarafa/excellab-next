import { getSession, redirectTo } from '@/lib/session';
import { one, exec } from '@/lib/db';

// GET /notificaciones/ir/{id} (réplica de MiscController::go): marca leída y abre el enlace.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  const s = await getSession();
  if (!s || s.uid === 0) return redirectTo(req, `/login?next=${encodeURIComponent(`/notificaciones/ir/${numId}`)}`);

  const n = await one('SELECT * FROM notifications WHERE id=$1 AND user_id=$2', [numId, s.uid]);
  if (!n) return new Response('No encontrado.', { status: 404 });
  await exec('UPDATE notifications SET is_read=1 WHERE id=$1', [numId]);
  const link = String(n.link ?? '');
  const target = link ? (link.startsWith('/') ? link : '/' + link) : '/notificaciones';
  return redirectTo(req, target);
}
