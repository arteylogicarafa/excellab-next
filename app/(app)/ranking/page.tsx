import { guard } from '@/lib/session';
import { all, setting } from '@/lib/db';
import * as stats from '@/lib/services/stats';

export const metadata = { title: 'Ranking' };

// Ranking de puntos (réplica de MiscController::ranking + misc/ranking.php).
export default async function RankingPage() {
  const s = await guard('student', '/ranking');
  const enabled = (await setting('ranking_enabled', '1')) === '1';
  let list: { id: number; name: string; points: number; pos: number; display: string }[] = [];
  let me: (typeof list)[number] | null = null;

  if (enabled) {
    const map = await stats.pointsMap();
    const students = await all("SELECT u.id, u.name FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='estudiante' AND u.status='active'");
    const built = students.map((st) => ({
      id: Number(st.id),
      name: String(st.name),
      points: Math.round(map[Number(st.id)] ?? 0),
    }));
    built.sort((a, b) => b.points - a.points || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    list = built.map((row, i) => {
      const parts = row.name.split(' ');
      const display =
        parts[0] + (parts.length > 1 ? ' ' + (parts[parts.length - 1][0] ?? '') + '.' : '');
      return { ...row, pos: i + 1, display };
    });
    me = list.find((r) => r.id === s.uid) ?? null;
    list = list.slice(0, 10);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ranking</h1>
          <p>Una referencia amistosa de puntos. No forma parte de tu evaluación.</p>
        </div>
      </div>
      {!enabled ? (
        <div className="card-x empty">
          <i className="bi bi-bar-chart" />El ranking está desactivado por tu docente.
        </div>
      ) : (
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="card-x">
              {!list.length && <div className="empty">Aún no hay estudiantes.</div>}
              {list.map((r) => (
                <div className={`rank-row ${r.id === s.uid ? 'me' : ''}`} key={r.id}>
                  <div className="rank-pos">{r.pos}</div>
                  <div className="avatar">{r.name.slice(0, 1).toUpperCase()}</div>
                  <div className="flex-grow-1 fw-semibold">
                    {r.display}
                    {r.id === s.uid && (
                      <>
                        {' '}
                        <span className="chip green">Tú</span>
                      </>
                    )}
                  </div>
                  <div className="fw-bold">
                    {r.points} <small className="text-muted fw-normal">pts</small>
                  </div>
                </div>
              ))}
            </div>
            {me && me.pos > 10 && (
              <div className="card-x mt-3">
                <div className="rank-row me border-0">
                  <div className="rank-pos">{me.pos}</div>
                  <div className="flex-grow-1 fw-semibold">Tu posición</div>
                  <div className="fw-bold">{me.points} pts</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
