import { redirect } from 'next/navigation';
import { logoUrl } from '@/lib/helpers';
import { getSession, homeFor } from '@/lib/session';

export const metadata = { title: 'Entrar' };

// Entrada de estudiantes (réplica de app/Views/auth/login.php).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const s = await getSession();
  if (s && s.uid > 0) redirect(homeFor(s));
  const sp = await searchParams;
  const oldEmail = sp.email ?? '';
  const next = sp.next ?? '';
  const logo = logoUrl();

  return (
    <>
      {logo && (
        <img
          className="d-block mx-auto mb-2"
          src={logo}
          alt="ExcelLab by Rafa Guerrero"
          style={{ maxWidth: 300, width: '100%' }}
        />
      )}
      <h1 className="h3 mb-1">Bienvenido a ExcelLab</h1>
      <p className="text-muted mb-4">Escribe tu correo para entrar. Lo usamos solo para guardar tu avance.</p>
      <form method="post" action="/entrar" className="needs-validation" noValidate>
        <input type="hidden" name="next" value={next} />
        <div className="mb-3">
          <label className="form-label" htmlFor="email">
            Correo electrónico
          </label>
          <input
            className="form-control form-control-lg"
            type="email"
            id="email"
            name="email"
            defaultValue={oldEmail}
            required
            autoFocus
            autoComplete="email"
            maxLength={150}
            placeholder="tucorreo@ejemplo.com"
          />
          <div className="invalid-feedback">Escribe un correo válido.</div>
        </div>
        <button className="btn btn-primary btn-lg w-100" type="submit">
          Entrar <i className="bi bi-arrow-right" />
        </button>
      </form>
      <p className="text-center small text-muted mt-4 mb-0">
        Usa siempre el mismo correo para conservar tu progreso.
        <br />
        <a href="/docentes">Acceso docentes</a>
      </p>
    </>
  );
}
