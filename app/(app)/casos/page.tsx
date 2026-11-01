import { guard } from '@/lib/session';
import { all } from '@/lib/db';

export const metadata = { title: 'Casos prácticos' };

const ICONS: Record<string, string> = {
  Administración: 'bi-building',
  Ventas: 'bi-cart3',
  Inventario: 'bi-box-seam',
  'Recursos Humanos': 'bi-people',
  Educación: 'bi-mortarboard',
};

// Casos prácticos (réplica de PracticalCaseController::index + cases/index.php).
export default async function CasosPage() {
  const s = await guard('auth', '/casos');
  const rows = await all(
    `SELECT c.id, c.category, c.title, c.context, c.mode, c.points,
        (SELECT MAX(score) FROM case_submissions s WHERE s.case_id=c.id AND s.student_id=$1) AS best,
        (SELECT COUNT(*) FROM case_submissions s WHERE s.case_id=c.id AND s.student_id=$1) AS subs
      FROM practical_cases c WHERE c.status='active' ORDER BY CASE c.category WHEN 'Administración' THEN 1 WHEN 'Ventas' THEN 2 WHEN 'Inventario' THEN 3 WHEN 'Recursos Humanos' THEN 4 WHEN 'Educación' THEN 5 END, c.id`,
    [s.uid],
  );

  const grouped: Record<string, Record<string, unknown>[]> = {};
  for (const r of rows) {
    (grouped[String(r.category)] ??= []).push(r);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Casos prácticos</h1>
          <p>Situaciones inspiradas en actividades reales: resuélvelas aquí o entrega tu archivo de Excel.</p>
        </div>
      </div>
      {!rows.length && (
        <div className="card-x empty">
          <i className="bi bi-briefcase" />No hay casos disponibles.
        </div>
      )}
      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat}>
          <h2 className="h5 mt-4 mb-3">
            <i className={`bi ${ICONS[cat] ?? 'bi-briefcase'} text-success`} /> {cat}
          </h2>
          <div className="row g-3">
            {list.map((c) => (
              <div className="col-md-6 col-xl-4" key={String(c.id)}>
                <a className="card-x module-card" href={`/casos/${c.id}`}>
                  <div className="d-flex justify-content-between mb-2">
                    <span className={`chip ${c.mode === 'file' ? 'warning' : 'green'}`}>
                      <i className={`bi ${c.mode === 'file' ? 'bi-file-earmark-excel' : 'bi-pc-display'}`} />{' '}
                      {c.mode === 'file' ? 'Entrega en Excel' : 'En la plataforma'}
                    </span>
                    {Number(c.subs) ? (
                      <span className="chip success">
                        {c.best !== null && c.best !== undefined ? `${Math.round(Number(c.best) * 10) / 10} pts` : 'Entregado'}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="h6 mb-1">{String(c.title)}</h3>
                  <p className="small text-muted mb-2">{strim(String(c.context ?? ''), 130)}</p>
                  <div className="small text-muted">
                    <i className="bi bi-star" /> {Number(c.points)} pts
                  </div>
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/** mb_strimwidth($s, 0, 130, '…'). */
function strim(s: string, width: number): string {
  return [...s].length > width ? [...s].slice(0, width).join('') + '…' : s;
}
