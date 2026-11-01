import { notFound } from 'next/navigation';
import { guard } from '@/lib/session';
import { all, one } from '@/lib/db';
import { fmtDate, nl2br } from '@/lib/helpers';
import { config as appConfig } from '@/lib/config';
import Sheet from '@/components/Sheet';

// Detalle de caso (réplica de PracticalCaseController::show + cases/show.php).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await one("SELECT * FROM practical_cases WHERE id=$1 AND status='active'", [Number(id)]);
  return { title: c ? String(c.title) : 'Caso práctico' };
}

function statusBadge(status: string): React.ReactNode {
  if (status === 'reviewed') return <span className="badge text-bg-success">Revisado</span>;
  if (status === 'submitted') return <span className="badge text-bg-warning">Pendiente de revisión</span>;
  return <span className="badge text-bg-secondary">{status}</span>;
}

export default async function CasoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  const s = await guard('auth', `/casos/${numId}`);

  const c = await one("SELECT * FROM practical_cases WHERE id=$1 AND status='active'", [numId]);
  if (!c) notFound();
  const isStudent = s.role === 'estudiante';
  const subs = isStudent
    ? await all('SELECT * FROM case_submissions WHERE case_id=$1 AND student_id=$2 ORDER BY id DESC LIMIT 6', [numId, s.uid])
    : [];

  let sheet: { headers: unknown[]; rows?: unknown[][] } | null = null;
  try {
    sheet = c.data_json ? JSON.parse(String(c.data_json)) : null;
  } catch {
    sheet = null;
  }
  let questions: { label: string; kind?: string }[] = [];
  try {
    questions = c.questions_json ? JSON.parse(String(c.questions_json)) ?? [] : [];
  } catch {
    questions = [];
  }
  const section = { letterSpacing: '.06em' };

  return (
    <>
      <nav className="small mb-2">
        <a href="/casos">Casos prácticos</a> <span className="text-muted">›</span> {String(c.title)}
      </nav>
      <div className="page-head">
        <div>
          <h1>{String(c.title)}</h1>
          <div className="d-flex flex-wrap gap-2 mt-2">
            <span className="chip green">{String(c.category)}</span>
            <span className={`chip ${c.mode === 'file' ? 'warning' : 'green'}`}>
              {c.mode === 'file' ? 'Entrega en Excel' : 'Se resuelve en la plataforma'}
            </span>
            <span className="chip">
              <i className="bi bi-star-fill" /> {Number(c.points)} pts
            </span>
          </div>
        </div>
        {sheet && (
          <a className="btn btn-soft" href={`/casos/${numId}/plantilla`}>
            <i className="bi bi-file-earmark-excel" /> Descargar datos en Excel
          </a>
        )}
      </div>
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card-x mb-4">
            <div className="card-x-body">
              <h2 className="h6 text-success text-uppercase" style={section}>
                Contexto
              </h2>
              <p dangerouslySetInnerHTML={{ __html: nl2br(c.context) }} />
              <h2 className="h6 text-success text-uppercase" style={section}>
                Problema
              </h2>
              <p dangerouslySetInnerHTML={{ __html: nl2br(c.problem) }} />
              {sheet && <Sheet data={sheet} caption="Datos de trabajo" />}
              <h2 className="h6 text-success text-uppercase mt-3" style={section}>
                Instrucciones
              </h2>
              <p dangerouslySetInnerHTML={{ __html: nl2br(c.instructions ?? '') }} />
              <h2 className="h6 text-success text-uppercase" style={section}>
                Criterios de evaluación
              </h2>
              <p className="mb-0" dangerouslySetInnerHTML={{ __html: nl2br(c.criteria ?? '') }} />
            </div>
          </div>

          {isStudent && (
            <div className="card-x">
              <div className="card-x-head">
                <h2>{c.mode === 'file' ? 'Entregar archivo' : 'Tus respuestas'}</h2>
              </div>
              {c.mode === 'platform' ? (
                <form className="card-x-body needs-validation" method="post" action={`/casos/${numId}/entregar`} noValidate>
                  <input type="hidden" name="_csrf" value={s.csrf} />
                  {questions.map((q, i) => (
                    <div className="mb-3" key={i}>
                      <label className="form-label fw-semibold" htmlFor={`q${i}`}>
                        {i + 1}. {q.label}
                      </label>
                      <input
                        className="form-control"
                        id={`q${i}`}
                        name={`answers[${i}]`}
                        required
                        maxLength={200}
                        autoComplete="off"
                        placeholder={(q.kind ?? 'text') === 'number' ? 'Resultado numérico' : 'Respuesta'}
                      />
                    </div>
                  ))}
                  <button className="btn btn-primary" type="submit">
                    <i className="bi bi-send" /> Enviar respuestas
                  </button>
                </form>
              ) : (
                <form className="card-x-body needs-validation" method="post" action={`/casos/${numId}/entregar`} encType="multipart/form-data" noValidate>
                  <input type="hidden" name="_csrf" value={s.csrf} />
                  <div className="mb-3">
                    <label className="form-label fw-semibold" htmlFor="file">
                      Archivo de Excel (.xlsx, .xls o .csv)
                    </label>
                    <input className="form-control" type="file" id="file" name="file" accept=".xlsx,.xls,.csv" required />
                    <div className="form-text">
                      Tamaño máximo: {appConfig.upload.maxMb} MB. Puedes volver a entregar; el docente revisa la entrega más reciente.
                    </div>
                  </div>
                  <button className="btn btn-primary" type="submit">
                    <i className="bi bi-upload" /> Entregar
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
        <div className="col-lg-4">
          <div className="card-x">
            <div className="card-x-head">
              <h2>Mis entregas</h2>
            </div>
            {!isStudent ? (
              <div className="empty py-4">Modo previsualización.</div>
            ) : !subs.length ? (
              <div className="empty py-4">Aún no has entregado este caso.</div>
            ) : null}
            {subs.map((sub, k) => {
              let res: { answer?: string; ok?: boolean }[] = [];
              if (c.mode === 'platform') {
                try {
                  const parsed = sub.answers_json ? JSON.parse(String(sub.answers_json)) : [];
                  res = (Array.isArray(parsed) ? parsed : []).filter((x) => x && typeof x === 'object') as {
                    answer?: string;
                    ok?: boolean;
                  }[];
                } catch {
                  res = [];
                }
              }
              return (
                <div className="item-row d-block" key={String(sub.id)}>
                  <div className="d-flex justify-content-between">
                    <strong className="small">{fmtDate(String(sub.created_at))}</strong>
                    {statusBadge(String(sub.status))}
                  </div>
                  {sub.original_name && (
                    <div className="small text-muted">
                      <i className="bi bi-paperclip" /> {String(sub.original_name)}
                    </div>
                  )}
                  {sub.score !== null && sub.score !== undefined && (
                    <div className="mt-1">
                      <span className="chip green">
                        {Math.round(Number(sub.score) * 10) / 10} / {Number(c.points)} pts
                      </span>
                    </div>
                  )}
                  {res.length > 0 &&
                    k === 0 &&
                    res.map((r, i) => (
                      <div className="small mt-1" key={i}>
                        <i className={`bi ${r.ok ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}`} />{' '}
                        Pregunta {i + 1}
                      </div>
                    ))}
                  {sub.feedback && <div className="small mt-1 text-muted">{String(sub.feedback)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
