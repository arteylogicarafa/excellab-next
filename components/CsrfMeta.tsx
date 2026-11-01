import { getSession } from '@/lib/session';

/** Meta CSRF para las peticiones AJAX de app.js (el PHP lo emitía en cada layout). */
export default async function CsrfMeta() {
  const s = await getSession();
  return <meta name="csrf-token" content={s?.csrf ?? ''} />;
}
