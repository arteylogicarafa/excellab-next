import { NextResponse, type NextRequest } from 'next/server';

// Deslizamiento de la sesión por inactividad y limpieza del mensaje flash.
// Autocontenido y compatible con el runtime edge del proxy/middleware de Next.
// (Réplica del "$_SESSION['last_activity']" y del borrado de flashes del PHP.)

const IDLE_MIN = 720;
const SLIDE_AFTER = 300; // re-firmar si la última actividad tiene más de 5 min
const SID = 'excellab_sid';

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return b64url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Devuelve la cookie firmada con last_activity actualizado, o null si no hace falta tocarla. */
async function slide(value: string, secret: string): Promise<string | null> {
  const dot = value.lastIndexOf('.');
  if (dot < 0) return null;
  const body = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  if (!(safeEqual(mac, await hmac(body, secret)))) return null;
  let payload: Record<string, unknown>;
  try {
    const bin = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
    payload = JSON.parse(bin);
  } catch {
    return null;
  }
  const la = Number(payload.la || 0);
  const now = Math.floor(Date.now() / 1000);
  if (now - la > IDLE_MIN * 60) return null; // expirada: la página se encarga de tratarla como no sesión
  if (now - la <= SLIDE_AFTER) return null;
  payload.la = now;
  const nuevoBody = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${nuevoBody}.${await hmac(nuevoBody, secret)}`;
}

export default async function proxy(req: NextRequest): Promise<NextResponse> {
  // Exportación CSV: /admin/reportes?export=1 se resuelve internamente en /admin/reportes/exportar
  // (en Next un route handler y una página no pueden compartir ruta).
  if (req.nextUrl.pathname === '/admin/reportes' && req.nextUrl.searchParams.get('export') === '1') {
    const sp = new URLSearchParams(req.nextUrl.search);
    sp.delete('export');
    const q = sp.toString();
    const reqHeaders = new Headers(req.headers);
    reqHeaders.set('x-pathname', req.nextUrl.pathname);
    reqHeaders.set('x-search', req.nextUrl.search);
    return NextResponse.rewrite(new URL('/admin/reportes/exportar' + (q ? '?' + q : ''), req.url), { request: { headers: reqHeaders } });
  }

  // La ruta y la query actuales se pasan como cabeceras al render (para el menú lateral).
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-pathname', req.nextUrl.pathname);
  reqHeaders.set('x-search', req.nextUrl.search);
  const res = NextResponse.next({ request: { headers: reqHeaders } });

  const secret = process.env.SESSION_SECRET || '';
  const sid = req.cookies.get(SID)?.value;

  if (secret && sid) {
    const nuevo = await slide(sid, secret);
    if (nuevo) {
      res.cookies.set(SID, nuevo, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.VERCEL === '1',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }

  // Nota: el mensaje flash y la pantalla de consumo la gestiona el cliente
  // (en Next 16 las cookies que se modifican aquí también se ven desde el render).
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/).*)'],
};
