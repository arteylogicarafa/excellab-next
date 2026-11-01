import { getSession, homeFor } from '@/lib/session';

// Error 403 (réplica de app/Views/errors/error.php con code 403).
export default async function ForbiddenPage() {
  const s = await getSession();
  const home = s && s.uid > 0 ? homeFor(s) : '/login';
  return (
    <div className="text-center py-5">
      <div className="display-1 fw-bold text-success">403</div>
      <h1 className="h3 mb-2">Acceso restringido</h1>
      <p className="text-muted">No tienes permisos para ver esta sección.</p>
      <a className="btn btn-primary mt-2" href={home}>
        <i className="bi bi-house" /> Volver al inicio
      </a>
    </div>
  );
}
