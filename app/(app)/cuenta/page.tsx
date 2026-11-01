import AccountPanel from '@/components/AccountPanel';

export const metadata = { title: 'Mi cuenta' };

// Mi cuenta (réplica de AuthController::account en la ruta /cuenta).
export default function CuentaPage() {
  return <AccountPanel path="/cuenta" />;
}
