import { redirect } from 'next/navigation';
import { attempt, afterLogin, flash, loginTarget, getSession, homeFor } from '@/lib/session';
import { config } from '@/lib/config';

export const metadata = { title: 'Acceso docentes' };

// Acceso de docentes y administradores (réplica de auth/staff.php + AuthController::login).
async function staffLogin(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '').toLowerCase().trim();
  const pass = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');
  const back = `/docentes?email=${encodeURIComponent(email)}`;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 150 || pass === '') {
    await flash('danger', 'Escribe un correo válido y tu contraseña.');
    redirect(back);
  }
  const r = await attempt(email, pass);
  if (!r.ok) {
    await flash('danger', r.message);
    redirect(back);
  }
  await afterLogin(r.user!);
  redirect(loginTarget(await getSession(), next));
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ email?: string; next?: string }> }) {
  const s = await getSession();
  if (s && s.uid > 0) redirect(homeFor(s));
  const sp = await searchParams;
  const oldEmail = sp.email ?? '';
  const next = sp.next ?? '';

  return (
    <>
      <h1 className="h3 mb-1">Acceso docentes</h1>
      <p className="text-muted mb-4">Para docentes y administradores.</p>
      <form action={staffLogin} className="needs-validation" noValidate>
        <input type="hidden" name="next" value={next} />
        <div className="mb-3">
          <label className="form-label" htmlFor="email">
            Correo electrónico
          </label>
          <input
            className="form-control"
            type="email"
            id="email"
            name="email"
            defaultValue={oldEmail}
            required
            autoFocus
            autoComplete="username"
            maxLength={150}
          />
          <div className="invalid-feedback">Escribe un correo válido.</div>
        </div>
        <div className="mb-3">
          <label className="form-label d-flex justify-content-between" htmlFor="password">
            Contraseña{' '}
            <a className="small" href="/recuperar">
              ¿Olvidaste tu contraseña?
            </a>
          </label>
          <div className="input-group">
            <input
              className="form-control"
              type="password"
              id="password"
              name="password"
              required
              autoComplete="current-password"
            />
            <button
              className="btn btn-outline-secondary"
              type="button"
              data-toggle-pass="#password"
              aria-label="Mostrar contraseña"
            >
              <i className="bi bi-eye" />
            </button>
            <div className="invalid-feedback">Escribe tu contraseña.</div>
          </div>
        </div>
        <button className="btn btn-primary w-100 py-2" type="submit">
          Iniciar sesión
        </button>
      </form>
      {config.showDemoCredentials && (
        <div className="card-x mt-4 p-3 small">
          <div className="fw-semibold mb-2">
            <i className="bi bi-info-circle text-success" /> Cuentas de demostración
          </div>
          <table className="table table-sm table-borderless mb-1">
            <tbody>
              <tr>
                <td className="text-muted">Administrador</td>
                <td>
                  <code>admin@excellab.test</code>
                </td>
                <td>
                  <code>Admin#2026</code>
                </td>
              </tr>
              <tr>
                <td className="text-muted">Docente</td>
                <td>
                  <code>docente@excellab.test</code>
                </td>
                <td>
                  <code>Docente#2026</code>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="text-muted">En el primer acceso se pedirá cambiar la contraseña.</div>
        </div>
      )}
      <p className="text-center mt-4 mb-0">
        <a href="/login">
          <i className="bi bi-arrow-left" /> Entrada de estudiantes
        </a>
      </p>
    </>
  );
}
