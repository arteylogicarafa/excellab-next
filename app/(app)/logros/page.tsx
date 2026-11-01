import { guard } from '@/lib/session';
import { all } from '@/lib/db';
import { fmtDate } from '@/lib/helpers';
import * as stats from '@/lib/services/stats';

export const metadata = { title: 'Mis logros' };

// Insignias del estudiante (réplica de MiscController::achievements + misc/achievements.php).
export default async function LogrosPage() {
  const s = await guard('student', '/logros');
  const rows = await all(
    "SELECT a.*, sa.awarded_at FROM achievements a LEFT JOIN student_achievements sa ON sa.achievement_id=a.id AND sa.student_id=$1 WHERE a.status='active' ORDER BY (sa.awarded_at IS NULL), a.threshold",
    [s.uid],
  );
  const counts = await stats.counts(s.uid);
  const earned = rows.filter((r) => r.awarded_at).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mis logros</h1>
          <p>
            Has desbloqueado <strong>{earned}</strong> de {rows.length} insignias.
          </p>
        </div>
      </div>
      <div className="row g-3">
        {rows.map((a) => {
          const awarded = Boolean(a.awarded_at);
          const threshold = Number(a.threshold);
          const cur = Math.min(Number(counts[String(a.metric)] ?? 0), threshold);
          return (
            <div className="col-6 col-md-4 col-xl-3" key={String(a.id)}>
              <div className={`card-x achv ${awarded ? '' : 'locked'}`}>
                <div className="icon">
                  <i className={`bi ${a.icon}`} />
                </div>
                <h3>{String(a.name)}</h3>
                <p>{String(a.description)}</p>
                {awarded ? (
                  <div className="chip success mt-2">{fmtDate(String(a.awarded_at), false)}</div>
                ) : (
                  <>
                    <div className="progress mt-3" style={{ height: '.4rem' }}>
                      <div
                        className="progress-bar"
                        style={{ width: `${threshold ? Math.round((cur / threshold) * 100) : 0}%` }}
                      />
                    </div>
                    <div className="small text-muted mt-1">
                      {cur} / {threshold}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
