import Link from 'next/link';

// 404 (réplica de app/Views/errors/error.php con code 404).
export default function NotFound() {
  return (
    <div className="text-center py-5">
      <div className="display-1 fw-bold text-success">404</div>
      <h1 className="h3 mb-2">Página no encontrada</h1>
      <p className="text-muted">La página que buscas no existe o fue movida.</p>
      <Link className="btn btn-primary mt-2" href="/login">
        <i className="bi bi-house" /> Volver al inicio
      </Link>
    </div>
  );
}
