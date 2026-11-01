import AccountPanel from '@/components/AccountPanel';

export const metadata = { title: 'Cambiar contraseña' };

// Cambio de contraseña obligatorio / voluntario (misma vista que /cuenta en el PHP).
export default async function CuentaPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const sp = await searchParams;
  return <AccountPanel path="/cuenta/password" aviso={sp.aviso} />;
}
