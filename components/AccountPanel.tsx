import { guard } from '@/lib/session';
import { one } from '@/lib/db';
import { isStaff } from '@/lib/session';
import { updateProfile, changePassword } from '@/app/(app)/cuenta/actions';

// Panel de cuenta (réplica de app/Views/auth/account.php; usado en /cuenta y /cuenta/password).
// $path: ruta actual (el guard del PHP excluye /cuenta/password del cambio obligatorio).
// $aviso='seguridad': muestra el aviso del guard de cambio obligatorio (por URL, sin cookies).
export default async function AccountPanel({ path, aviso }: { path: string; aviso?: string }) {
  const s = await guard('auth', path);
  const u = await one(
    'SELECT u.*, r.label AS role_label FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',
    [s.uid],
  );
  if (!u) return null;
  const staff = isStaff(s);
  const forced = s.mustChange;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mi cuenta</h1>
          <p>Administra tu perfil y tu contraseña.</p>
        </div>
      </div>
      {aviso === 'seguridad' && (
        <div className="alert alert-warning">
          <i className="bi bi-shield-exclamation" /> Por seguridad debes cambiar tu contraseña inicial antes de
          continuar.
        </div>
      )}
      {forced && (
        <div className="alert alert-warning">
          <i className="bi bi-shield-exclamation" /> Estás usando una contraseña inicial. Debes cambiarla para poder
          continuar.
        </div>
      )}
      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card-x">
            <div className="card-x-head">
              <h2>Perfil</h2>
            </div>
            <form className="card-x-body needs-validation" action={updateProfile} noValidate>
              <input type="hidden" name="_csrf" value={s.csrf} />
              <div className="mb-3">
                <label className="form-label" htmlFor="name">
                  Nombre completo
                </label>
                <input className="form-control" id="name" name="name" defaultValue={String(u.name)} required minLength={3} maxLength={120} />
              </div>
              <div className="mb-3">
                <label className="form-label">Correo</label>
                <input className="form-control" defaultValue={String(u.email)} disabled />
              </div>
              <div className="mb-3">
                <label className="form-label">Rol</label>
                <input className="form-control" defaultValue={String(u.role_label)} disabled />
              </div>
              <button className="btn btn-primary" type="submit">
                Guardar cambios
              </button>
            </form>
          </div>
        </div>
        {staff && (
          <div className="col-lg-6">
            <div className="card-x">
              <div className="card-x-head">
                <h2>Cambiar contraseña</h2>
              </div>
              <form className="card-x-body needs-validation" action={changePassword} noValidate>
                <input type="hidden" name="_csrf" value={s.csrf} />
                <div className="mb-3">
                  <label className="form-label" htmlFor="current_password">
                    Contraseña actual
                  </label>
                  <input
                    className="form-control"
                    type="password"
                    id="current_password"
                    name="current_password"
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="password">
                    Nueva contraseña
                  </label>
                  <input
                    className="form-control"
                    type="password"
                    id="password"
                    name="password"
                    required
                    minLength={8}
                    pattern="(?=.*[A-Za-z])(?=.*\d).{8,}"
                    autoComplete="new-password"
                  />
                  <div className="form-text">Mínimo 8 caracteres, con letras y números.</div>
                  <div className="invalid-feedback">Mínimo 8 caracteres con letras y números.</div>
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="password2">
                    Confirmar nueva contraseña
                  </label>
                  <input
                    className="form-control"
                    type="password"
                    id="password2"
                    name="password2"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <button className="btn btn-primary" type="submit">
                  Actualizar contraseña
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
