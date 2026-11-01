import { guard } from '@/lib/session';
import { all } from '@/lib/db';
import { diffLabel, diffClass, typeLabel } from '@/lib/helpers';
import { studentStatus } from '@/lib/models/exercise';

export const metadata = { title: 'Laboratorio de ejercicios' };

const TYPES = ['multiple_choice', 'true_false', 'complete_formula', 'identify_function', 'solve_operation', 'analyze_table', 'practical'];

// Laboratorio (réplica de LabController::index + lab/index.php).
export default async function LaboratorioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; module?: string; difficulty?: string; type?: string; topic?: string; state?: string }>;
}) {
  const sp = await searchParams;
  const s = await guard('auth', '/laboratorio');
  const f = {
    q: sp.q ?? '',
    module: sp.module ?? '',
    difficulty: sp.difficulty ?? '',
    type: sp.type ?? '',
    topic: sp.topic ?? '',
    state: sp.state ?? '',
  };

  const where: string[] = ["e.status='active'", "m.status='active'"];
  const params: unknown[] = [];
  if (Number(f.module)) {
    where.push('e.module_id=?');
    params.push(Number(f.module));
  }
  if (['basico', 'intermedio', 'avanzado'].includes(f.difficulty)) {
    where.push('e.difficulty=?');
    params.push(f.difficulty);
  }
  if (TYPES.includes(f.type)) {
    where.push('e.type=?');
    params.push(f.type);
  }
  if (f.topic !== '') {
    where.push('e.topic=?');
    params.push(f.topic);
  }
  if (f.q !== '') {
    where.push('(e.title ILIKE ? OR e.statement ILIKE ?)');
    const like = '%' + f.q.replace(/([%_])/g, '\\$1') + '%';
    params.push(like, like);
  }

  let rows = await all(
    'SELECT e.id, e.title, e.topic, e.difficulty, e.type, e.points, m.title AS module_title FROM exercises e JOIN modules m ON m.id=e.module_id WHERE ' +
      where.join(' AND ') +
      " ORDER BY m.position, CASE e.difficulty WHEN 'basico' THEN 1 WHEN 'intermedio' THEN 2 WHEN 'avanzado' THEN 3 END, e.id",
    params,
  );
  const status = s.role === 'estudiante' ? await studentStatus(s.uid) : {};
  if (f.state === 'solved') rows = rows.filter((r) => !emptySolved(status[String(r.id)]));
  if (f.state === 'pending') rows = rows.filter((r) => emptySolved(status[String(r.id)]));

  const modules = await all("SELECT id, title FROM modules WHERE status='active' ORDER BY position");
  const topics = (await all("SELECT DISTINCT topic FROM exercises WHERE status='active' ORDER BY topic")).map((r) => String(r.topic));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Laboratorio de ejercicios</h1>
          <p>Practica con ejercicios de distintos tipos y recibe retroalimentación al instante.</p>
        </div>
        <div className="text-muted small">{rows.length} ejercicios</div>
      </div>
      <form className="card-x p-3 mb-4" method="get" action="/laboratorio">
        <div className="row g-2">
          <div className="col-md-4">
            <input className="form-control" type="search" name="q" defaultValue={f.q} placeholder="Buscar ejercicio…" />
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select" name="module" aria-label="Módulo">
              <option value="">Todos los módulos</option>
              {modules.map((m, i) => (
                <option key={String(m.id)} value={String(m.id)} selected={f.module === String(m.id)}>
                  M{i + 1} · {String(m.title)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select" name="difficulty" aria-label="Dificultad">
              <option value="">Toda dificultad</option>
              {['basico', 'intermedio', 'avanzado'].map((d) => (
                <option key={d} value={d} selected={f.difficulty === d}>
                  {diffLabel(d)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select" name="type" aria-label="Tipo">
              <option value="">Todo tipo</option>
              {TYPES.map((t) => (
                <option key={t} value={t} selected={f.type === t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select className="form-select" name="state" aria-label="Estado">
              <option value="">Todos</option>
              <option value="pending" selected={f.state === 'pending'}>
                Pendientes
              </option>
              <option value="solved" selected={f.state === 'solved'}>
                Resueltos
              </option>
            </select>
          </div>
          <div className="col-md-4">
            <select className="form-select" name="topic" aria-label="Tema">
              <option value="">Todos los temas</option>
              {topics.map((t) => (
                <option key={t} selected={f.topic === t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-8 d-flex gap-2">
            <button className="btn btn-primary">
              <i className="bi bi-funnel" /> Filtrar
            </button>
            <a className="btn btn-light" href="/laboratorio">
              Limpiar
            </a>
          </div>
        </div>
      </form>
      {!rows.length && (
        <div className="card-x empty">
          <i className="bi bi-search" />No hay ejercicios con esos filtros.
        </div>
      )}
      <div className="card-x">
        {rows.map((r) => {
          const st = status[String(r.id)];
          const solved = !emptySolved(st);
          return (
            <a className="item-row" key={String(r.id)} href={`/laboratorio/${r.id}`}>
              <div className={`item-check ${solved ? 'done' : ''}`}>
                {solved ? (
                  <i className="bi bi-check-lg" />
                ) : st ? (
                  <i className="bi bi-arrow-repeat text-muted" />
                ) : (
                  ''
                )}
              </div>
              <div className="flex-grow-1">
                <div className="fw-semibold">{String(r.title)}</div>
                <div className="small text-muted">
                  {String(r.module_title)} · {String(r.topic)}
                </div>
              </div>
              <span className="chip d-none d-md-inline-flex">{typeLabel(String(r.type))}</span>
              <span className={`chip ${diffClass(String(r.difficulty))}`}>{diffLabel(String(r.difficulty))}</span>
              <span className="chip green">{Number(r.points)} pts</span>
            </a>
          );
        })}
      </div>
    </>
  );
}

function emptySolved(s: { solved: number } | undefined): boolean {
  return !s || !Number(s.solved);
}
