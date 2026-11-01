import { notFound, redirect } from 'next/navigation';
import { guard } from '@/lib/session';
import { fmtDate, diffLabel, diffClass, typeLabel } from '@/lib/helpers';
import { getEntity, listRows, adminOnly } from '@/lib/services/crud';
import StatusBadge from '@/components/StatusBadge';

// Listado CRUD genérico (réplica de CrudController::index + admin/crud/index.php).
export async function generateMetadata({ params }: { params: Promise<{ any: string }> }) {
  const { any } = await params;
  const e = getEntity(any);
  return { title: e ? e.title : 'Panel' };
}

export default async function CrudIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ any: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { any } = await params;
  const sp = await searchParams;
  const s = await guard('staff', `/admin/${any}`);
  const e = getEntity(any);
  if (!e) notFound();
  if (adminOnly(e) && s.role !== 'admin') redirect('/403');

  const data = await listRows(e, sp);
  const states: [string, string, string][] = [
    ['active', 'bi-check-circle', 'Habilitar'],
    ['inactive', 'bi-pause-circle', 'Deshabilitar'],
    ['archived', 'bi-archive', 'Archivar'],
  ];
  const qs = (over: Record<string, string | number>) => {
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries(sp)) if (v !== undefined && v !== '') merged[k] = v;
    Object.assign(merged, Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])));
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v !== '') u.set(k, v);
    return u.toString();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <i className={`bi ${e.icon} text-success`} /> {e.title}
          </h1>
          <p>
            {data.total} registro{data.total === 1 ? '' : 's'}
          </p>
        </div>
        <a className="btn btn-primary" href={`/admin/${e.key}/nuevo`}>
          <i className="bi bi-plus-lg" /> Nuevo {e.singular}
        </a>
      </div>
      <form className="card-x p-3 mb-3" method="get" action={`/admin/${e.key}`}>
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <input className="form-control" type="search" name="q" defaultValue={data.q} placeholder="Buscar…" aria-label="Buscar" />
          </div>
          {data.filters.map((fl) => (
            <div className="col-6 col-md-2" key={fl.name}>
              <select className="form-select" name={fl.name} aria-label={fl.label}>
                <option value="">{fl.label}: todos</option>
                {Object.entries(fl.options).map(([k, label]) => (
                  <option key={k} value={k} selected={fl.value === String(k)}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="col-6 col-md-2">
            <select className="form-select" name="status" aria-label="Estado">
              <option value="">Activos e inactivos</option>
              <option value="active" selected={data.status === 'active'}>
                Solo activos
              </option>
              <option value="inactive" selected={data.status === 'inactive'}>
                Solo inactivos
              </option>
              <option value="archived" selected={data.status === 'archived'}>
                Archivados
              </option>
            </select>
          </div>
          <div className="col-auto d-flex gap-2">
            <button className="btn btn-primary">
              <i className="bi bi-funnel" /> Filtrar
            </button>
            <a className="btn btn-light" href={`/admin/${e.key}`}>
              Limpiar
            </a>
          </div>
        </div>
      </form>
      <div className="card-x">
        <div className="table-responsive">
          <table className="table table-x table-hover align-middle">
            <thead>
              <tr>
                {e.columns.map(([, label]) => (
                  <th key={label}>{label}</th>
                ))}
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!data.rows.length && (
                <tr>
                  <td colSpan={e.columns.length + 2}>
                    <div className="empty py-4">
                      <i className="bi bi-inbox" />No hay registros con estos filtros.
                    </div>
                  </td>
                </tr>
              )}
              {data.rows.map((r) => (
                <tr key={String(r.id)}>
                  {e.columns.map(([col, , kind]) => {
                    const v = r[col] ?? '';
                    let content: React.ReactNode;
                    if (kind === 'date') content = v ? fmtDate(String(v)) : 'Nunca';
                    else if (kind === 'diff') content = <span className={`chip ${diffClass(String(v))}`}>{diffLabel(String(v))}</span>;
                    else if (kind === 'type') content = typeLabel(String(v));
                    else if (kind === 'mode')
                      content =
                        v === 'file' ? (
                          <span className="chip warning">Archivo Excel</span>
                        ) : (
                          <span className="chip green">Plataforma</span>
                        );
                    else if (kind === 'pwd')
                      content = v ? <span className="chip warning">Inicial</span> : <span className="chip success">Propia</span>;
                    else if (col === 'title' || col === 'name') content = <strong>{String(v)}</strong>;
                    else content = String(v);
                    return <td key={col}>{content}</td>;
                  })}
                  <td>
                    <StatusBadge status={String(r.status)} />
                  </td>
                  <td className="text-end text-nowrap">
                    {e.preview && (
                      <a className="btn btn-sm btn-light" title="Ver como estudiante" href={e.preview.replace('{id}', String(r.id))}>
                        <i className="bi bi-eye" />
                      </a>
                    )}
                    {(e.extra_actions ?? []).map(([href, icon, title]) => (
                      <a
                        key={href}
                        className="btn btn-sm btn-light"
                        title={title}
                        href={href.replace('{id}', String(r.id))}
                      >
                        <i className={`bi ${icon}`} />
                      </a>
                    ))}
                    <a className="btn btn-sm btn-soft" title="Editar" href={`/admin/${e.key}/${r.id}/editar`}>
                      <i className="bi bi-pencil" />
                    </a>
                    <div className="dropdown d-inline-block">
                      <button className="btn btn-sm btn-light" data-bs-toggle="dropdown" aria-label="Cambiar estado">
                        <i className="bi bi-three-dots-vertical" />
                      </button>
                      <ul className="dropdown-menu dropdown-menu-end">
                        {states.map(([st, ic, lb]) =>
                          st === String(r.status) ? null : (
                            <li key={st}>
                              <form
                                method="post"
                                action={`/admin/${e.key}/${r.id}/estado`}
                                {...(st === 'archived'
                                  ? {
                                      'data-confirm':
                                        '¿Archivar este registro? Dejará de mostrarse a los estudiantes, pero se conserva su historial.',
                                    }
                                  : {})}
                              >
                                <input type="hidden" name="_csrf" value={s.csrf} />
                                <input type="hidden" name="status" value={st} />
                                <button className="dropdown-item">
                                  <i className={`bi ${ic} me-2`} />
                                  {lb}
                                </button>
                              </form>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.pages > 1 && (
          <nav className="p-3 d-flex justify-content-between align-items-center">
            <span className="small text-muted">
              Página {data.page} de {data.pages}
            </span>
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${data.page <= 1 ? 'disabled' : ''}`}>
                <a className="page-link" href={`?${qs({ page: data.page - 1 })}`}>
                  Anterior
                </a>
              </li>
              <li className={`page-item ${data.page >= data.pages ? 'disabled' : ''}`}>
                <a className="page-link" href={`?${qs({ page: data.page + 1 })}`}>
                  Siguiente
                </a>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </>
  );
}
