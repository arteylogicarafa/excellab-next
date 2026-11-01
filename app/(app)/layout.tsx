import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSession, readFlashes, isStaff } from '@/lib/session';
import { unread, latest } from '@/lib/notifier';
import { setting } from '@/lib/db';
import { timeAgo } from '@/lib/helpers';
import Splash from '@/components/Splash';
import CsrfMeta from '@/components/CsrfMeta';
import FlashScript from '@/components/FlashScript';

// Layout de la zona con sesión (réplica de app/Views/layouts/app.php).

type NavItem = [key: string, icon: string, text: string, href: string];
type NavSection = [label: string, items: NavItem[]];

const ROLE_LABEL: Record<string, string> = { admin: 'Administrador', docente: 'Docente', estudiante: 'Estudiante' };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const path = hdrs.get('x-pathname') ?? '/';
  const search = new URLSearchParams(hdrs.get('x-search') ?? '');
  const s = await getSession();
  if (!s || s.uid === 0) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  const user = s!;
  const staff = isStaff(user);
  const [unreadN, latestN, rankingOn, f] = await Promise.all([
    unread(user.uid),
    latest(user.uid, 5),
    setting('ranking_enabled', '1'),
    readFlashes(),
  ]);

  let nav: NavSection[];
  if (staff) {
    nav = [
      ['Principal', [['admin', 'bi-speedometer2', 'Panel', '/admin']]],
      [
        'Gestión académica',
        [
          ['admin/estudiantes', 'bi-people', 'Estudiantes', '/admin/estudiantes'],
          ...(user.role === 'admin'
            ? ([['admin/usuarios', 'bi-person-gear', 'Docentes y admins', '/admin/usuarios']] as NavItem[])
            : []),
          ['admin/modulos', 'bi-collection', 'Módulos', '/admin/modulos'],
          ['admin/lecciones', 'bi-journal-text', 'Lecciones', '/admin/lecciones'],
          ['admin/ejercicios', 'bi-pencil-square', 'Ejercicios', '/admin/ejercicios'],
          ['admin/retos', 'bi-trophy', 'Retos', '/admin/retos'],
          ['admin/casos', 'bi-briefcase', 'Casos prácticos', '/admin/casos'],
          ['admin/evaluaciones', 'bi-clipboard-check', 'Evaluaciones', '/admin/evaluaciones'],
          ['admin/logros', 'bi-award', 'Insignias', '/admin/logros'],
        ],
      ],
      [
        'Seguimiento',
        [
          ['admin/seguimiento', 'bi-graph-up-arrow', 'Progreso individual', '/admin/seguimiento'],
          ['admin/entregas', 'bi-inbox', 'Entregas de archivos', '/admin/entregas'],
          ['admin/reportes', 'bi-file-earmark-bar-graph', 'Reportes', '/admin/reportes'],
        ],
      ],
      [
        'Vista de estudiante',
        [
          ['aprender', 'bi-eye', 'Previsualizar contenidos', '/aprender'],
          ...(user.role === 'admin' ? ([['admin/ajustes', 'bi-gear', 'Ajustes', '/admin/ajustes']] as NavItem[]) : []),
        ],
      ],
    ];
  } else {
    nav = [
      ['Principal', [['inicio', 'bi-house-door', 'Inicio', '/inicio']]],
      [
        'Aprendizaje',
        [
          ['aprender', 'bi-book', 'Aprender Excel', '/aprender'],
          ['laboratorio', 'bi-journal-check', 'Laboratorio', '/laboratorio'],
          ['retos', 'bi-trophy', 'Excel Challenge', '/retos'],
          ['casos', 'bi-briefcase', 'Casos prácticos', '/casos'],
          ['evaluaciones', 'bi-clipboard-check', 'Evaluaciones', '/evaluaciones'],
        ],
      ],
      [
        'Mi progreso',
        [
          ['logros', 'bi-award', 'Mis logros', '/logros'],
          ...(rankingOn === '1' ? ([['ranking', 'bi-bar-chart', 'Ranking', '/ranking']] as NavItem[]) : []),
        ],
      ],
    ];
  }

  const isActive = (key: string): boolean => {
    const p = '/' + key;
    if (key === 'admin') return path === '/admin';
    return path === p || path.startsWith(p + '/');
  };
  const initials = user.name.slice(0, 1).toUpperCase();
  const q = search.get('q') ?? '';

  return (
    <>
      <CsrfMeta />
      <Splash />
      <aside className="sidebar" id="sidebar">
        <a className="brand" href={staff ? '/admin' : '/inicio'}>
          <span className="brand-mark">
            <i className="bi bi-grid-3x3-gap-fill" />
          </span>{' '}
          ExcelLab
        </a>
        <nav>
          {nav.map(([label, items]) => (
            <div key={label}>
              <div className="nav-label">{label}</div>
              {items.map(([key, icon, text, href]) => (
                <a key={key} className={`nav-link-x ${isActive(key) ? 'active' : ''}`} href={href}>
                  <i className={`bi ${icon}`} />
                  {text}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          Paquetes Informáticos
          <br />
          Plataforma educativa de Excel
        </div>
      </aside>
      <div className="sidebar-backdrop" id="sidebarBackdrop" />

      <div className="main">
        <header className="topbar">
          <button className="btn btn-light d-lg-none" data-toggle-sidebar aria-label="Abrir menú">
            <i className="bi bi-list fs-5" />
          </button>
          <form className="search d-none d-sm-block" action="/buscar" method="get" role="search">
            <i className="bi bi-search" />
            <input
              className="form-control"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar lecciones, ejercicios, retos…"
              minLength={2}
              aria-label="Buscar"
            />
          </form>
          <div className="ms-auto d-flex align-items-center gap-2">
            <a className="btn btn-light d-sm-none" href="/buscar" aria-label="Buscar">
              <i className="bi bi-search" />
            </a>
            <div className="dropdown">
              <button
                className="btn btn-light position-relative"
                data-bs-toggle="dropdown"
                aria-label="Notificaciones"
                data-bs-auto-close="outside"
              >
                <i className="bi bi-bell" />
                {unreadN > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                    {unreadN > 9 ? '9+' : unreadN}
                  </span>
                )}
              </button>
              <div className="dropdown-menu dropdown-menu-end p-0" style={{ width: 340, maxWidth: '92vw' }}>
                <div className="px-3 py-2 border-bottom fw-semibold d-flex justify-content-between">
                  Notificaciones{' '}
                  <a className="small fw-normal" href="/notificaciones">
                    Ver todas
                  </a>
                </div>
                {!latestN.length && <div className="empty py-4">Sin notificaciones</div>}
                {latestN.map((n) => (
                  <a
                    key={String(n.id)}
                    className={`dropdown-item py-2 ${Number(n.is_read) ? '' : 'bg-light'}`}
                    href={`/notificaciones/ir/${n.id}`}
                    style={{ whiteSpace: 'normal' }}
                  >
                    <div className="fw-semibold small">{String(n.title ?? '')}</div>
                    <div className="small text-muted">{String(n.message ?? '')}</div>
                    <div className="small text-muted">{timeAgo(String(n.created_at))}</div>
                  </a>
                ))}
              </div>
            </div>
            <div className="dropdown">
              <button className="btn btn-light d-flex align-items-center gap-2" data-bs-toggle="dropdown">
                <span className="avatar">{initials}</span>
                <span className="d-none d-md-inline text-start lh-sm">
                  <span className="d-block small fw-semibold">{user.name}</span>
                  <span className="d-block text-muted" style={{ fontSize: '.72rem' }}>
                    {ROLE_LABEL[user.role] ?? user.role}
                  </span>
                </span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li>
                  <a className="dropdown-item" href="/cuenta">
                    <i className="bi bi-person me-2" />
                    Mi cuenta
                  </a>
                </li>
                <li>
                  <a className="dropdown-item" href="/cuenta/password">
                    <i className="bi bi-key me-2" />
                    Cambiar contraseña
                  </a>
                </li>
                <li>
                  <hr className="dropdown-divider" />
                </li>
                <li>
                  <form method="post" action="/salir">
                    <input type="hidden" name="_csrf" value={user.csrf} />
                    <button className="dropdown-item text-danger">
                      <i className="bi bi-box-arrow-right me-2" />
                      Cerrar sesión
                    </button>
                  </form>
                </li>
              </ul>
            </div>
          </div>
        </header>
        <main className="content">
          {f.length > 0 && (
            <>
              {f.map((m, i) => (
                <div key={i} className={`alert alert-${m.type} alert-dismissible fade show`} role="alert">
                  {m.msg}
                  <button type="button" className="btn-close" data-bs-dismiss="alert" aria-label="Cerrar" />
                </div>
              ))}
              <FlashScript />
            </>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
