import { existsSync } from 'fs';
import path from 'path';
import { config } from './config';

// Funciones auxiliares (réplica de app/Core/helpers.php).

/** Escapa HTML (protección XSS). */
export function e(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Fecha/hora «d/m/Y H:i» (acepta string o Date de node-pg). */
export function fmtDate(d: string | Date | null | undefined, withTime = true): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d.replace(' ', 'T')) : d;
  if (isNaN(date.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  const fecha = `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()}`;
  if (!withTime) return fecha;
  // Muestra la hora tal cual viene de la base (ya está en la zona de la aplicación)
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(d)) {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}`;
  }
  return `${fecha} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

export function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d.replace(' ', 'T')) : d;
  const diff = Math.floor(Date.now() / 1000) - Math.floor(date.getTime() / 1000);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} d`;
  return fmtDate(d, false);
}

const DIFFS: Record<string, string> = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

export function diffLabel(d: string): string {
  return DIFFS[d] ?? d;
}

export function diffClass(d: string): string {
  return { basico: 'success', intermedio: 'warning', avanzado: 'danger' }[d] ?? 'secondary';
}

const TYPES: Record<string, string> = {
  multiple_choice: 'Selección múltiple',
  true_false: 'Verdadero o falso',
  complete_formula: 'Completar fórmula',
  identify_function: 'Identificar función',
  solve_operation: 'Resolver operación',
  analyze_table: 'Analizar tabla',
  practical: 'Situación práctica',
};

export function typeLabel(t: string): string {
  return TYPES[t] ?? t;
}

const STATUS: Record<string, [string, string]> = {
  active: ['success', 'Activo'],
  inactive: ['secondary', 'Inactivo'],
  archived: ['dark', 'Archivado'],
  submitted: ['warning', 'Pendiente de revisión'],
  reviewed: ['success', 'Revisado'],
};

export function statusBadge(s: string): string {
  const [c, l] = STATUS[s] ?? ['secondary', s];
  return `<span class="badge text-bg-${c}">${e(l)}</span>`;
}

/** Letra de columna de Excel (1 = A). */
export function colLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m - 1) / 26);
  }
  return s;
}

const ALLOWED_TAGS = new Set([
  'p','br','b','strong','i','em','u','ul','ol','li','h4','h5','h6','code','pre','kbd',
  'table','thead','tbody','tr','th','td','span','div','img','a','blockquote',
]);

/** Limpia HTML de contenido docente: solo etiquetas seguras y sin atributos de eventos. */
export function cleanHtml(html: string): string {
  // Elimina etiquetas no permitidas (conservando el texto, igual que strip_tags de PHP)
  let out = html.replace(/<\/?([a-zA-Z0-9]+)(\s[^<>]*)?>/g, (tag, name: string) =>
    ALLOWED_TAGS.has(name.toLowerCase()) ? tag : '',
  );
  // Quita atributos on*
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Neutraliza javascript:/data:/vbscript: en href y src
  out = out.replace(/\b(href|src)\s*=\s*(["'])\s*(javascript|data|vbscript):[^"']*\2/gi, '$1=$2$3$2');
  return out;
}

/** Logo de la marca: public/assets/img/logo.{png,webp,jpg,svg}. */
export function logoUrl(): string | null {
  const dir = path.join(process.cwd(), 'public', 'assets', 'img');
  for (const ext of ['png', 'webp', 'jpg', 'jpeg', 'svg']) {
    if (existsSync(path.join(dir, `logo.${ext}`))) return `/assets/img/logo.${ext}`;
  }
  return null;
}

export function isAjax(req: Request): boolean {
  return (
    req.headers.get('x-requested-with') === 'XMLHttpRequest' ||
    (req.headers.get('accept') ?? '').includes('application/json')
  );
}

/** Fecha «Y-m-d H:i:s» en la zona de la aplicación (para guardar en la base). */
export function nowSql(): string {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: config.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  return fmt.format(new Date());
}

/** Clave «Y-m-d» para columnas DATE (node-pg las devuelve como Date). */
export function dateKey(v: unknown): string {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v ?? '').slice(0, 10);
}

/** Hora actual (0-23) en la zona de la aplicación. */
export function hourNow(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, hour: 'numeric', hour12: false }).format(new Date()),
  ) % 24;
}

/** Texto escapado con saltos de línea a <br> (nl2br(e(...)) de PHP). */
export function nl2br(s: unknown): string {
  return e(s).replace(/\r\n|\r|\n/g, '<br>');
}

/** Ruta de imagen: URLs absolutas tal cual; el resto desde /assets. */
export function imageUrl(src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  return '/assets/' + src.replace(/^assets\//, '');
}

/** Formato numérico de las hojas (number_format de PHP: 4 decimales, coma decimal, punto miles). */
export function sheetNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  const [intPart, dec] = v.toFixed(4).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (grouped + ',' + dec).replace(/0+$/, '').replace(/,$/, '');
}
