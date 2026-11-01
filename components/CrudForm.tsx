import type { EntityDef, EntityField } from '@/lib/entities';
import type { EntityFull } from '@/lib/services/crud';
import { typeLabel, diffLabel } from '@/lib/helpers';

// Formulario CRUD (réplica de admin/crud/form.php). Valores ya resueltos (fila + old + defaults).
export default function CrudForm({
  e,
  values,
  old,
  id,
  opts,
  bank,
  questionIds,
  suggest,
  csrf,
}: {
  e: EntityFull;
  values: Record<string, unknown>;
  old: Record<string, string | null> | null;
  id: number;
  opts: Record<string, Record<string, string>>;
  bank: Record<string, unknown>[];
  questionIds: string[];
  suggest: string;
  csrf: string;
}) {
  const title = (id ? 'Editar ' : 'Nuevo ') + e.singular;
  const val = (f: EntityField): unknown => (old && f.name in old ? old[f.name] : (values[f.name] ?? f.default ?? ''));

  return (
    <>
      <nav className="small mb-2">
        <a href={`/admin/${e.key}`}>{e.title}</a> <span className="text-muted">›</span> {id ? 'Editar' : 'Nuevo'}
      </nav>
      <div className="page-head">
        <div>
          <h1>{title.charAt(0).toUpperCase() + title.slice(1)}</h1>
        </div>
      </div>
      <form className="card-x needs-validation" method="post" action={`/admin/${e.key}/guardar`} noValidate>
        <input type="hidden" name="_csrf" value={csrf} />
        <input type="hidden" name="id" value={id} />
        <div className="card-x-body">
          <div className="row g-3">
            {e.fields.map((f) => {
              const n = f.name;
              const t = f.type;
              const col = f.col ?? 12;
              const req = Boolean(f.required);
              const v = val(f);
              return (
                <div className={`col-md-${col}`} key={n}>
                  <label className="form-label fw-semibold" htmlFor={`f-${n}`}>
                    {f.label}
                    {req && <span className="text-danger"> *</span>}
                  </label>
                  {(t === 'text' || t === 'email') && (
                    <input
                      className="form-control"
                      type={t}
                      id={`f-${n}`}
                      name={n}
                      defaultValue={String(v ?? '')}
                      {...(req ? { required: true } : {})}
                      {...(f.max !== undefined ? { maxLength: f.max } : {})}
                      {...(f.min !== undefined ? { minLength: f.min } : {})}
                      {...(f.pattern ? { pattern: f.pattern } : {})}
                    />
                  )}
                  {t === 'password' && (
                    <input
                      className="form-control"
                      type={id ? 'password' : 'text'}
                      id={`f-${n}`}
                      name={n}
                      defaultValue={id ? '' : suggest}
                      autoComplete="new-password"
                      minLength={8}
                      {...(id ? {} : { required: true })}
                      placeholder={id ? 'Dejar vacío para no cambiarla' : ''}
                    />
                  )}
                  {t === 'number' && (
                    <input
                      className="form-control"
                      type="number"
                      id={`f-${n}`}
                      name={n}
                      defaultValue={String(v ?? '')}
                      {...(f.min !== undefined ? { min: f.min } : {})}
                      {...(f.max !== undefined ? { max: f.max } : {})}
                      step={f.step ?? '1'}
                      {...(req ? { required: true } : {})}
                    />
                  )}
                  {t === 'select' && (
                    <select className="form-select" id={`f-${n}`} name={n} {...(req ? { required: true } : {})}>
                      {!req || f.nullable ? <option value="">— Ninguno —</option> : null}
                      {Object.entries(opts[n] ?? {}).map(([k, label]) => (
                        <option key={k} value={k} selected={String(v ?? '') === String(k)}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                  {(t === 'textarea' || t === 'html' || t === 'json') && (
                    <textarea
                      className={`form-control ${t !== 'textarea' ? 'font-monospace small' : ''}`}
                      id={`f-${n}`}
                      name={n}
                      rows={f.rows ?? 3}
                      {...(req ? { required: true } : {})}
                      defaultValue={(() => {
                        const raw = v === null || v === undefined ? '' : String(v);
                        if (t === 'json' && raw !== '' && !(old && n in old)) {
                          try {
                            return JSON.stringify(JSON.parse(raw), null, 2);
                          } catch {
                            return raw;
                          }
                        }
                        return raw;
                      })()}
                    />
                  )}
                  {t === 'checks' && (
                    <div className="border rounded p-2" style={{ maxHeight: 340, overflow: 'auto' }}>
                      {(() => {
                        let grp: string | null = null;
                        return bank.map((c) => {
                          const showGroup = grp !== String(c.module_title);
                          grp = String(c.module_title);
                          const checked = questionIds.includes(String(c.id));
                          return (
                            <div key={String(c.id)}>
                              {showGroup && (
                                <div className="small fw-bold text-success mt-2">{grp}</div>
                              )}
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`q${c.id}`}
                                  name={`${n}[]`}
                                  value={String(c.id)}
                                  defaultChecked={checked}
                                />
                                <label className="form-check-label small" htmlFor={`q${c.id}`}>
                                  {String(c.title)}{' '}
                                  <span className="text-muted">
                                    · {typeLabel(String(c.type))} · {diffLabel(String(c.difficulty))}
                                  </span>
                                </label>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                  {f.help && <div className="form-text">{f.help}</div>}
                  <div className="invalid-feedback">Revisa este campo.</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card-x-body border-top d-flex gap-2">
          <button className="btn btn-primary" type="submit">
            <i className="bi bi-check2" /> Guardar
          </button>
          <a className="btn btn-light" href={`/admin/${e.key}`}>
            Cancelar
          </a>
        </div>
      </form>
    </>
  );
}
