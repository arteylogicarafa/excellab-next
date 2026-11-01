import { readFlashes } from '@/lib/session';
import { logoUrl } from '@/lib/helpers';
import Splash from '@/components/Splash';
import CsrfMeta from '@/components/CsrfMeta';
import FlashScript from '@/components/FlashScript';

// Layout de acceso (réplica de app/Views/layouts/auth.php).
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const f = await readFlashes();
  const logo = logoUrl();

  return (
    <>
      <CsrfMeta />
      <Splash />
      <div className="auth-wrap">
      <section className="auth-side">
        <a className="d-flex align-items-center gap-2 text-white fs-4 fw-bold" href="/">
          <span className="brand-mark bg-white text-success" style={{ background: '#fff' }}>
            <i className="bi bi-grid-3x3-gap-fill" style={{ color: '#217346' }} />
          </span>{' '}
          ExcelLab
        </a>
        <div>
          <h2 className="mb-4">
            Aprende Excel practicando,
            <br />a tu propio ritmo.
          </h2>
          <ul className="list-unstyled">
            <li>
              <i className="bi bi-check-circle-fill" /> Lecciones claras con ejemplos reales
            </li>
            <li>
              <i className="bi bi-check-circle-fill" /> Laboratorio de ejercicios con corrección automática
            </li>
            <li>
              <i className="bi bi-check-circle-fill" /> Retos, casos prácticos y evaluaciones
            </li>
            <li>
              <i className="bi bi-check-circle-fill" /> Seguimiento de tu progreso y certificados
            </li>
          </ul>
        </div>
        <small className="opacity-75">Unidad curricular: Paquetes Informáticos</small>
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <div className={`d-lg-none text-center mb-3 ${logo ? 'd-none' : ''}`}>
            <span className="brand-mark d-inline-grid">
              <i className="bi bi-grid-3x3-gap-fill" />
            </span>{' '}
            <span className="fw-bold fs-4 align-middle">ExcelLab</span>
          </div>
          {f.length > 0 && (
            <>
              {f.map((m, i) => (
                <div key={i} className={`alert alert-${m.type}`} role="alert">
                  {m.msg}
                </div>
              ))}
              <FlashScript />
            </>
          )}
          {children}
        </div>
      </section>
      </div>
    </>
  );
}
