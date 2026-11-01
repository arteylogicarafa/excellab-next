import { guard } from '@/lib/session';
import { all } from '@/lib/db';
import { log as activityLog } from '@/lib/activity';

export const metadata = { title: 'Buscar' };

const LINKS: Record<string, string> = {
  Lecciones: '/aprender/leccion/',
  Ejercicios: '/laboratorio/',
  Retos: '/retos/',
  'Casos prácticos': '/casos/',
  Evaluaciones: '/evaluaciones/',
};
const ICONS: Record<string, string> = {
  Lecciones: 'bi-book',
  Ejercicios: 'bi-pencil-square',
  Retos: 'bi-trophy',
  'Casos prácticos': 'bi-briefcase',
  Evaluaciones: 'bi-clipboard-check',
};

// Búsqueda global (réplica de MiscController::search + misc/search.php).
export default async function BuscarPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const q = sp.q ?? '';
  await guard('auth', '/buscar');

  const results: Record<string, Record<string, unknown>[]> = {};
  if (q.length >= 2) {
    const like = '%' + q.replace(/([%_\\])/g, '\\$1') + '%';
    results['Lecciones'] = await all(
      "SELECT l.id, l.title, l.description AS extra, m.title AS ctx FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.status='active' AND m.status='active' AND (l.title ILIKE ? OR l.description ILIKE ? OR l.theory ILIKE ?) LIMIT 15",
      [like, like, like],
    );
    results['Ejercicios'] = await all(
      "SELECT e.id, e.title, e.topic AS extra, m.title AS ctx FROM exercises e JOIN modules m ON m.id=e.module_id WHERE e.status='active' AND (e.title ILIKE ? OR e.statement ILIKE ? OR e.topic ILIKE ?) LIMIT 15",
      [like, like, like],
    );
    results['Retos'] = await all(
      "SELECT id, title, objective AS extra, difficulty AS ctx FROM challenges WHERE status='active' AND (title ILIKE ? OR situation ILIKE ? OR objective ILIKE ?) LIMIT 10",
      [like, like, like],
    );
    results['Casos prácticos'] = await all(
      "SELECT id, title, category AS extra, mode AS ctx FROM practical_cases WHERE status='active' AND (title ILIKE ? OR context ILIKE ?) LIMIT 10",
      [like, like],
    );
    results['Evaluaciones'] = await all(
      "SELECT id, title, description AS extra, '' AS ctx FROM assessments WHERE status='active' AND (title ILIKE ? OR description ILIKE ?) LIMIT 10",
      [like, like],
    );
    await activityLog('busqueda', 'search', null, q);
  }

  const total = Object.values(results).reduce((acc, items) => acc + items.length, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Buscar contenidos</h1>
          <p>Lecciones, ejercicios, retos, casos y evaluaciones.</p>
        </div>
      </div>
      <form className="mb-4" method="get" action="/buscar">
        <div className="input-group input-group-lg">
          <input
            className="form-control"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Por ejemplo: BUSCARV, porcentaje, inventario…"
            minLength={2}
            autoFocus
          />
          <button className="btn btn-primary">
            <i className="bi bi-search" /> Buscar
          </button>
        </div>
      </form>
      {q !== '' && q.length < 2 && <div className="alert alert-warning">Escribe al menos 2 caracteres.</div>}
      {q.length >= 2 && (
        <>
          <p className="text-muted">
            {total} resultado{total === 1 ? '' : 's'} para “{q}”
          </p>
          {!total && (
            <div className="card-x empty">
              <i className="bi bi-search" />No encontramos coincidencias. Prueba con otra palabra.
            </div>
          )}
          {Object.entries(results).map(([group, items]) =>
            items.length ? (
              <div key={group}>
                <h2 className="h6 text-uppercase text-muted mt-4 mb-2" style={{ letterSpacing: '.06em' }}>
                  {group}
                </h2>
                <div className="card-x">
                  {items.map((r) => (
                    <a className="item-row" key={String(r.id)} href={`${LINKS[group]}${r.id}`}>
                      <div className="feed-icon">
                        <i className={`bi ${ICONS[group]}`} />
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{String(r.title)}</div>
                        <div className="small text-muted">
                          {strim(String(r.extra ?? ''), 110)}
                          {r.ctx ? ` · ${String(r.ctx)}` : ''}
                        </div>
                      </div>
                      <i className="bi bi-chevron-right text-muted" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </>
      )}
    </>
  );
}

function strim(s: string, width: number): string {
  return [...s].length > width ? [...s].slice(0, width).join('') + '…' : s;
}
