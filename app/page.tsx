import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@/lib/session';

// Raíz: el PHP redirigía a /login o al inicio del rol (AuthController::root).
export default async function Home() {
  const s = await getSession();
  redirect(s && s.uid > 0 ? homeFor(s) : '/login');
}
