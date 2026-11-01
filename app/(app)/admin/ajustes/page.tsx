import { guard } from '@/lib/session';
import { setting } from '@/lib/db';
import { saveSettings } from './actions';

export const metadata = { title: 'Ajustes' };

// Ajustes (réplica de SettingsController::index + admin/settings.php; acceso admin).
export default async function AjustesPage() {
  const s = await guard('admin', '/admin/ajustes');
  const ranking = (await setting('ranking_enabled', '1')) === '1';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <i className="bi bi-gear text-success" /> Ajustes
          </h1>
          <p>Opciones generales de la plataforma.</p>
        </div>
      </div>
      <div className="card-x" style={{ maxWidth: 640 }}>
        <form className="card-x-body" action={saveSettings}>
          <input type="hidden" name="_csrf" value={s.csrf} />
          <div className="form-check form-switch mb-1">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="rk"
              name="ranking_enabled"
              value="1"
              defaultChecked={ranking}
            />
            <label className="form-check-label fw-semibold" htmlFor="rk">
              Mostrar ranking de estudiantes
            </label>
          </div>
          <div className="form-text mb-4">
            El ranking es complementario: solo muestra puntos y nunca forma parte de la evaluación.
          </div>
          <button className="btn btn-primary">
            <i className="bi bi-check2" /> Guardar
          </button>
        </form>
      </div>
    </>
  );
}
