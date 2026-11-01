import { guard } from '@/lib/session';
import { all } from '@/lib/db';
import { timeAgo } from '@/lib/helpers';

export const metadata = { title: 'Notificaciones' };

// Notificaciones (réplica de MiscController::notifications + misc/notifications.php).
export default async function NotificacionesPage() {
  const s = await guard('auth', '/notificaciones');
  const rows = await all('SELECT * FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 60', [s.uid]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notificaciones</h1>
          <p>Avisos sobre tus logros, entregas y evaluaciones.</p>
        </div>
        <form method="post" action="/notificaciones/leer">
          <input type="hidden" name="_csrf" value={s.csrf} />
          <button className="btn btn-soft">
            <i className="bi bi-check2-all" /> Marcar todas como leídas
          </button>
        </form>
      </div>
      <div className="card-x">
        {!rows.length && (
          <div className="empty">
            <i className="bi bi-bell-slash" />No tienes notificaciones.
          </div>
        )}
        {rows.map((n) => (
          <a
            className={`item-row ${Number(n.is_read) ? '' : 'bg-light'}`}
            key={String(n.id)}
            href={`/notificaciones/ir/${n.id}`}
          >
            <div className="feed-icon">
              <i className={`bi ${Number(n.is_read) ? 'bi-bell' : 'bi-bell-fill'}`} />
            </div>
            <div className="flex-grow-1">
              <div className="fw-semibold">{String(n.title)}</div>
              <div className="small text-muted">{String(n.message ?? '')}</div>
            </div>
            <div className="small text-muted">{timeAgo(String(n.created_at))}</div>
          </a>
        ))}
      </div>
    </>
  );
}
