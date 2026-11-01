import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { config } from './config';
import { one, insert, exec } from './db';
import { log as activityLog } from './activity';
import { send as notify } from './notifier';

// Sesión, autenticación y CSRF (réplica de app/Core/Auth.php y del CSRF de helpers.php).

const SID_COOKIE = 'excellab_sid';
const CSRF_COOKIE = 'excellab_csrf';
const FLASH_COOKIE = 'excellab_flash';

export interface SessionUser {
  uid: number; // 0 = sesión anónima creada solo para el token CSRF (como en el PHP)
  role: string; // admin | docente | estudiante
  name: string;
  email: string;
  mustChange: boolean;
  la: number; // última actividad (epoch s)
  csrf: string;
  na?: number; // contador de altas automáticas por sesión (límite anti-masivo)
}

export interface DbUser {
  id: number | string;
  role_id?: number | string;
  name: string;
  email: string;
  password_hash: string;
  status: string;
  must_change_password: number | string;
  failed_attempts?: number | string;
  locked_until?: string | Date | null;
  role?: string;
}

function sign(payload: SessionUser): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const mac = crypto.createHmac('sha256', config.sessionSecret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function unsign(value: string | undefined): SessionUser | null {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot < 0) return null;
  const body = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = crypto.createHmac('sha256', config.sessionSecret).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionUser;
    if (typeof payload.uid !== 'number' || payload.uid < 0 || !payload.csrf) return null;
    // Expiración por inactividad (como Auth::check)
    if (Date.now() / 1000 - (payload.la || 0) > config.sessionIdleMin * 60) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Lee la sesión actual de la cookie (null si no hay o expiró). */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return unsign(jar.get(SID_COOKIE)?.value);
}

function cookieBase(maxAge = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.VERCEL === '1',
    maxAge,
  };
}

/** Crea la sesión al entrar (equivale a session_regenerate_id + $_SESSION). */
export async function login(u: { id: number | string; role: string; name: string; email: string; must_change?: boolean }): Promise<void> {
  const payload: SessionUser = {
    uid: Number(u.id),
    role: u.role,
    name: u.name,
    email: u.email,
    mustChange: Boolean(u.must_change),
    la: Math.floor(Date.now() / 1000),
    csrf: crypto.randomBytes(32).toString('hex'),
  };
  const jar = await cookies();
  jar.set(SID_COOKIE, sign(payload), cookieBase());
  // Cookie legible por JavaScript para las peticiones AJAX (el PHP exponía el token en la vista)
  jar.set(CSRF_COOKIE, payload.csrf, { ...cookieBase(), httpOnly: false });
}

/** Vuelve a firmar la sesión (p. ej. al cambiar la contraseña obligatoria). */
export async function saveSession(patch: Partial<SessionUser>): Promise<void> {
  const s = await getSession();
  if (!s) return;
  const payload: SessionUser = { ...s, ...patch, la: Math.floor(Date.now() / 1000) };
  const jar = await cookies();
  jar.set(SID_COOKIE, sign(payload), cookieBase());
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(SID_COOKIE);
  jar.delete(CSRF_COOKIE);
  // El mensaje flash no se borra aquí: se pone justo después del cierre de sesión.
}

export function isStaff(s: SessionUser | null): boolean {
  return !!s && (s.role === 'admin' || s.role === 'docente');
}

export function homeFor(s: SessionUser | null): string {
  return isStaff(s) ? '/admin' : '/inicio';
}

/** Mensaje flash (se acumulan varios, como el array de $_SESSION['flash']).
 *  Opcionalmente arrastra valores de formulario (equivale a remember_input del PHP). */
export async function flash(type: string, msg: string, old?: Record<string, string | null>): Promise<void> {
  const jar = await cookies();
  let items: { type: string; msg: string; old?: Record<string, string | null> }[] = [];
  try {
    const raw = jar.get(FLASH_COOKIE)?.value;
    if (raw) {
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed : [parsed];
    }
  } catch {
    items = [];
  }
  items.push(old ? { type, msg, old } : { type, msg });
  jar.set(FLASH_COOKIE, JSON.stringify(items), { ...cookieBase(60 * 60 * 8), httpOnly: false });
}

/** Varios mensajes a la vez (errores de validación del CRUD). */
export async function flashMany(type: string, msgs: string[], old?: Record<string, string | null>): Promise<void> {
  for (let i = 0; i < msgs.length; i++) {
    await flash(type, msgs[i], i === msgs.length - 1 ? old : undefined);
  }
}

/** Mensajes flash pendientes de la petición actual. */
export async function readFlashes(): Promise<{ type: string; msg: string; old?: Record<string, string | null> }[]> {
  const jar = await cookies();
  const raw = jar.get(FLASH_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

/** Primer mensaje flash (compatibilidad). */
export async function readFlash(): Promise<{ type: string; msg: string } | null> {
  const allF = await readFlashes();
  return allF[0] ?? null;
}

/**
 * Guard de acceso por ruta (réplica de Router::guard):
 * redirige al login recordando la ruta original (next), o al cambio de contraseña obligatorio.
 */
export async function guard(access: 'auth' | 'student' | 'staff' | 'admin', path: string): Promise<SessionUser> {
  const s = await getSession();
  if (!s || s.uid === 0) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (s!.mustChange && path !== '/cuenta/password') {
    // En Server Components no se pueden escribir cookies: el aviso viaja por la URL
    // (mensaje idéntico al flash del PHP, lo muestra el panel de cuenta).
    redirect('/cuenta/password?aviso=seguridad');
  }
  const ok =
    access === 'auth' ||
    (access === 'student' && s!.role === 'estudiante') ||
    (access === 'staff' && isStaff(s!)) ||
    (access === 'admin' && s!.role === 'admin');
  if (!ok) {
    redirect('/403');
  }
  return s!;
}

/**
 * Protección CSRF de los POST previos al inicio de sesión (entrar, docentes, recuperar…):
 * el navegador envía Origin/Referer y debe coincidir con el dominio propio (cabecera Host).
 */
export function originOk(req: Request): boolean {
  const origin = req.headers.get('origin') || req.headers.get('referer');
  const host = req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Redirección 303 conservando el dominio que usó el cliente (Host + x-forwarded-proto). */
export function redirectTo(req: Request, path: string): Response {
  const host = req.headers.get('host') ?? 'localhost';
  const proto = req.headers.get('x-forwarded-proto') ?? (host.endsWith(':443') ? 'https' : 'http');
  return Response.redirect(`${proto}://${host}${path.startsWith('/') ? path : '/' + path}`, 303);
}

/** Validación CSRF (token de sesión en el formulario o en la cabecera). */
export async function csrfValid(req: Request, formData?: FormData): Promise<boolean> {
  const s = await getSession();
  if (!s) return false;
  const given =
    (formData?.get('_csrf') as string | null) ||
    req.headers.get('x-csrf-token') ||
    '';
  if (!given || given.length !== s.csrf.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(s.csrf));
}

/** Contraseña incorrecta en tiempo constante (como el password_verify falso del PHP). */
export function dummyVerify(): void {
  bcrypt.compareSync('tiempo-constante', '$2y$10$abcdefghijklmnopqrstuuAbCdEfGhIjKlMnOpQrStUvWxYz012345');
}

interface AttemptResult {
  ok: boolean;
  message: string;
  user?: DbUser;
}

/** Intento de acceso docente/administrador (réplica de Auth::attempt). */
export async function attempt(email: string, password: string): Promise<AttemptResult> {
  const u = await one<DbUser>(
    'SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.email=$1',
    [email],
  );
  if (!u) {
    dummyVerify();
    return { ok: false, message: 'Correo o contraseña incorrectos.' };
  }
  const lockedUntil = u.locked_until ? new Date(u.locked_until).getTime() / 1000 : 0;
  if (u.locked_until && lockedUntil > Date.now() / 1000) {
    const min = Math.ceil((lockedUntil - Date.now() / 1000) / 60);
    return { ok: false, message: `Cuenta bloqueada temporalmente por intentos fallidos. Inténtalo en ${min} min.` };
  }
  const valid = await bcrypt.compare(password, String(u.password_hash));
  if (!valid) {
    let fails = Number(u.failed_attempts ?? 0) + 1;
    let lock: string | null = null;
    if (fails >= config.maxFailedLogins) {
      const d = new Date(Date.now() + config.lockMinutes * 60000);
      const p = (n: number) => String(n).padStart(2, '0');
      lock = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
      fails = 0;
    }
    await exec('UPDATE users SET failed_attempts=$1, locked_until=$2, updated_at=NOW() WHERE id=$3', [fails, lock, u.id]);
    await activityLog('login_fallido', 'users', Number(u.id), email, Number(u.id));
    return { ok: false, message: 'Correo o contraseña incorrectos.' };
  }
  if (u.status !== 'active') {
    return { ok: false, message: 'Tu cuenta está deshabilitada. Contacta con tu docente.' };
  }
  return { ok: true, message: '', user: u };
}

/** Efectos del inicio de sesión (réplica de Auth::login). */
export async function afterLogin(u: DbUser): Promise<void> {
  await exec(
    'UPDATE users SET failed_attempts=0, locked_until=NULL, last_login_at=NOW(), updated_at=NOW() WHERE id=$1',
    [u.id],
  );
  await login({
    id: u.id,
    role: String(u.role),
    name: u.name,
    email: u.email,
    must_change: Boolean(Number(u.must_change_password)),
  });
  await activityLog('inicio_sesion', 'users', Number(u.id), null, Number(u.id));
}

/**
 * Entrada de estudiantes solo con correo (réplica de AuthController::enter).
 * Si el correo no existe, se crea la cuenta automáticamente.
 */
export async function enterByEmail(rawEmail: string): Promise<
  { ok: true } | { ok: false; type: string; message: string; redirect?: string }
> {
  const email = rawEmail.toLowerCase().trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 150;
  if (!valid) {
    return { ok: false, type: 'danger', message: 'Escribe un correo electrónico válido.', redirect: '/login' };
  }
  let u = await one<DbUser>(
    'SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.email=$1',
    [email],
  );
  if (u && u.role !== 'estudiante') {
    return { ok: false, type: 'warning', message: 'Ese correo pertenece a un docente. Usa el enlace «Acceso docentes».', redirect: '/login' };
  }
  if (u && u.status !== 'active') {
    return { ok: false, type: 'danger', message: 'Tu acceso está deshabilitado. Consulta con tu docente.', redirect: '/login' };
  }
  if (!u) {
    // Límite sencillo contra altas masivas desde una misma sesión
    const s = await getSession();
    const na = (s?.na ?? 0) + 1;
    if (na > 5) {
      return { ok: false, type: 'danger', message: 'Demasiados intentos. Inténtalo más tarde.', redirect: '/login' };
    }
    const local = email.split('@')[0].replace(/[._\-+]+/g, ' ').replace(/\d+/g, '').trim();
    const name = local
      ? local.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
      : 'Estudiante';
    const id = await insert('users', {
      role_id: 3,
      name: name.slice(0, 120) || 'Estudiante',
      email,
      password_hash: bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10),
      status: 'active',
      must_change_password: 0,
    });
    await notify(id, 'Bienvenido a ExcelLab', 'Empieza por el módulo 1 "Introducción a Excel". Tu avance se guarda con tu correo.', 'aprender');
    await activityLog('alta_automatica', 'users', id, email, id);
    const nuevo = await one<DbUser>(
      'SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',
      [id],
    );
    if (nuevo) {
      await afterLogin({ ...nuevo, must_change_password: 0 });
      // el contador de altas vive en la sesión (se reinicia en cada login, igual que el PHP)
      await saveSession({ na });
      return { ok: true };
    }
    return { ok: false, type: 'danger', message: 'No se pudo crear la cuenta.', redirect: '/login' };
  }
  await afterLogin({ ...u, must_change_password: 0 });
  return { ok: true };
}

/** Destino tras iniciar sesión (next válido, cambio obligatorio o inicio del rol). */
export function loginTarget(s: SessionUser | null, next: string | null): string {
  if (s?.mustChange) return '/cuenta/password';
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    if (!(next.startsWith('/admin') && !isStaff(s))) return next;
  }
  return homeFor(s);
}

/** Tras iniciar sesión: redirige al destino final. */
export async function redirectAfterLogin(next: string | null): Promise<never> {
  redirect(loginTarget(await getSession(), next));
}
