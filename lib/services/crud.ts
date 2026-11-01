import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { all, one, val, insert, update, q } from '../db';
import { entities, type EntityDef } from '../entities';
import { cleanHtml } from '../helpers';
import { log as activityLog } from '../activity';

// CRUD genérico (réplica de app/Controllers/Admin/CrudController.php).

export interface EntityFull extends EntityDef {
  key: string;
  alias: string;
}

export function getEntity(key: string): EntityFull | null {
  const def = entities()[key];
  if (!def) return null;
  const matches = [...def.sql.matchAll(/FROM\s+\w+\s+(\w+)/gi)];
  const alias = matches.length ? matches[matches.length - 1][1] : 't';
  return { ...def, key, alias };
}

export function adminOnly(e: EntityFull): boolean {
  return Boolean(e.admin_only);
}

/** SELECT id, títulos (equivale a PDO::FETCH_KEY_PAIR). */
async function keyPair(sql: string): Promise<Record<string, string>> {
  const rows = await all(sql);
  const out: Record<string, string> = {};
  for (const r of rows) {
    const vals = Object.values(r);
    out[String(vals[0])] = String(vals[1] ?? '');
  }
  return out;
}

export interface FilterState {
  name: string;
  label: string;
  options: Record<string, string>;
  value: string;
}

export async function listRows(
  e: EntityFull,
  sp: { q?: string; status?: string; page?: string } & Record<string, string | undefined>,
): Promise<{
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pages: number;
  q: string;
  status: string;
  filters: FilterState[];
}> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (e.where) where.push(e.where);
  const q = sp.q ?? '';
  if (q !== '') {
    const like = '%' + q.replace(/([%_\\])/g, '\\$1') + '%';
    where.push('(' + e.search.map((c) => `${c} ILIKE ?`).join(' OR ') + ')');
    for (const _ of e.search) params.push(like);
  }
  const status = sp.status ?? '';
  if (status === '') where.push(`${e.alias}.status<>'archived'`);
  else if (['active', 'inactive', 'archived'].includes(status)) {
    where.push(`${e.alias}.status=?`);
    params.push(status);
  }
  const filters: FilterState[] = [];
  for (const [field, label, source, col] of e.filters ?? []) {
    const options = typeof source === 'string' ? await keyPair(source) : { ...source };
    const val = sp[`f_${field}`] ?? '';
    if (val !== '' && Object.keys(options).map(String).includes(val)) {
      where.push(`${col}=?`);
      params.push(val);
    }
    filters.push({ name: `f_${field}`, label, options, value: val });
  }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = Number(await val(`SELECT COUNT(*) FROM (${e.sql}${w}) cnt`, params));
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), pages);
  const rows = await all(`${e.sql}${w} ORDER BY ${e.order} LIMIT 20 OFFSET ${(page - 1) * 20}`, params);
  return { rows, total, page, pages, q, status, filters };
}

/** Fila visible para edición (mismo alcance que el PHP). */
export async function loadRow(e: EntityFull, id: number): Promise<Record<string, unknown> | null> {
  const visible = await val(
    `SELECT 1 FROM (${e.sql}${e.where ? ' WHERE ' + e.where : ''}) v WHERE v.id=?`,
    [id],
  );
  if (!visible) return null;
  const row = await one(`SELECT * FROM "${e.table}" WHERE id=?`, [id]);
  if (row) delete row.password_hash;
  return row;
}

export type SelectOptions = Record<string, Record<string, string>>;

export async function selectOptions(e: EntityFull): Promise<SelectOptions> {
  const out: SelectOptions = {};
  for (const f of e.fields) {
    if (f.type === 'select') {
      out[f.name] = f.options
        ? Object.fromEntries(Object.entries(f.options).map(([k, v]) => [String(k), v]))
        : f.sql
          ? await keyPair(f.sql)
          : {};
    }
  }
  return out;
}

/** Banco de preguntas (hook 'assessments'). */
export async function questionBank(): Promise<Record<string, unknown>[]> {
  return all(
    "SELECT e.id, e.title, e.type, e.difficulty, m.title AS module_title FROM exercises e JOIN modules m ON m.id=e.module_id WHERE e.status<>'archived' ORDER BY m.position, e.id",
  );
}

export interface SaveResult {
  errors: string[];
  id?: number;
  isNew?: boolean;
}

/** Guardado completo con validaciones y hooks (réplica de CrudController::save). */
export async function save(e: EntityFull, formData: FormData, id: number, userId: number): Promise<SaveResult> {
  const hook = e.hooks ?? '';
  const data: Record<string, unknown> = {};
  const errors: string[] = [];
  const opts = await selectOptions(e);

  for (const f of e.fields) {
    if (f.virtual) continue;
    const n = f.name;
    const got = formData.get(n);
    const raw = Array.isArray(got) ? '' : String(got ?? '').trim();
    const label = f.label;
    if (raw === '') {
      if (f.required) {
        errors.push(`El campo «${label}» es obligatorio.`);
        continue;
      }
      if (f.type === 'number') data[n] = f.default ?? 0;
      else if (f.type === 'select') data[n] = f.nullable ? null : (f.default ?? null);
      else data[n] = f.default ?? null;
      continue;
    }
    switch (f.type) {
      case 'text':
      case 'textarea':
      case 'email':
      case 'html': {
        if (f.max !== undefined && [...raw].length > f.max) {
          errors.push(`«${label}» no puede superar ${f.max} caracteres.`);
          continue;
        }
        if (f.min !== undefined && [...raw].length < f.min) {
          errors.push(`«${label}» debe tener al menos ${f.min} caracteres.`);
          continue;
        }
        if (f.type === 'email') {
          const low = raw.toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(low)) {
            errors.push(`«${label}» no es un correo válido.`);
            continue;
          }
          data[n] = low;
          break;
        }
        if (f.pattern && !new RegExp(`^(?:${f.pattern})$`).test(raw)) {
          errors.push(`«${label}» tiene un formato no válido.`);
          continue;
        }
        data[n] = f.type === 'html' ? cleanHtml(raw) : raw;
        break;
      }
      case 'number': {
        if (!/^[-+]?\d*\.?\d+$/.test(raw)) {
          errors.push(`«${label}» debe ser un número.`);
          continue;
        }
        const v = Number(raw);
        if ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)) {
          errors.push(`«${label}» está fuera del rango permitido.`);
          continue;
        }
        data[n] = v;
        break;
      }
      case 'select': {
        const o = opts[n] ?? {};
        if (!Object.keys(o).includes(raw)) {
          errors.push(`El valor de «${label}» no es válido.`);
          continue;
        }
        data[n] = raw;
        break;
      }
      case 'json': {
        try {
          data[n] = JSON.stringify(JSON.parse(raw));
        } catch {
          errors.push(`«${label}» no es un JSON válido.`);
          continue;
        }
        break;
      }
      default:
        data[n] = raw;
    }
  }

  errors.push(...(await validate(hook, e, data, id, formData, userId)));
  if (errors.length) return { errors };

  Object.assign(data, e.fixed ?? {});
  await beforeSave(hook, data, id, formData);
  const isNew = !id;
  if (id) {
    await update(e.table, data, id);
  } else {
    id = await insert(e.table, data);
  }
  await afterSave(hook, id, formData);
  await activityLog(isNew ? 'crear' : 'editar', e.table, id, (data.title as string) ?? (data.name as string) ?? null);
  return { errors: [], id, isNew };
}

function passwordProblem(p: string): string | null {
  if (Buffer.byteLength(p, 'utf8') < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) {
    return 'La contraseña debe tener al menos 8 caracteres e incluir letras y números.';
  }
  return null;
}

async function validate(
  hook: string,
  e: EntityFull,
  data: Record<string, unknown>,
  id: number,
  formData: FormData,
  userId: number,
): Promise<string[]> {
  const err: string[] = [];
  switch (hook) {
    case 'users': {
      if (data.email !== undefined && (await val('SELECT 1 FROM users WHERE email=$1 AND id<>$2', [data.email, id]))) {
        err.push('Ya existe un usuario con ese correo.');
      }
      const pass = String(formData.get('password') ?? '');
      if (!id && pass === '' && e.key !== 'estudiantes') err.push('Indica una contraseña inicial.');
      if (pass !== '') {
        const m = passwordProblem(pass);
        if (m) err.push(m);
      }
      if (id === userId && (data.status ?? 'active') !== 'active') err.push('No puedes deshabilitar tu propia cuenta.');
      if (id === userId && data.role_id !== undefined && Number(data.role_id) !== 1) {
        err.push('No puedes quitarte el rol de administrador a ti mismo.');
      }
      break;
    }
    case 'exercises': {
      if ((data.answer_kind ?? '') === 'option') {
        const lines = String(formData.get('options_text') ?? '')
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l !== '');
        const correct = lines.filter((l) => l.startsWith('*')).length;
        if (lines.length < 2) err.push('Agrega al menos dos alternativas (una por línea).');
        else if (correct !== 1) err.push('Marca exactamente una alternativa correcta con * al inicio de la línea.');
        data['correct_answer'] = null;
      } else {
        if (!data['correct_answer']) err.push('Indica la respuesta correcta.');
        else if (data['answer_kind'] === 'number') {
          for (const alt of String(data['correct_answer']).split('||')) {
            if (alt.trim() === '' || Number.isNaN(Number(alt.trim()))) err.push(`«${alt}» no es un número válido.`);
          }
        }
      }
      break;
    }
    case 'cases': {
      if ((data['mode'] ?? '') === 'platform') {
        let qs: unknown = null;
        try {
          qs = JSON.parse(String(data['questions_json'] ?? ''));
        } catch {
          qs = null;
        }
        if (!Array.isArray(qs) || !qs.length) err.push('Un caso en plataforma necesita preguntas con respuesta (JSON).');
        else {
          for (const raw of qs as Record<string, unknown>[]) {
            if (!raw || typeof raw !== 'object' || !raw['label'] || raw['answer'] === undefined) {
              err.push('Cada pregunta debe tener "label" y "answer".');
              break;
            }
          }
        }
      } else if (!data['data_json']) {
        err.push('Un caso con entrega de archivo necesita datos de trabajo (JSON) para generar la plantilla de Excel.');
      }
      break;
    }
    case 'assessments': {
      const ids = formData.getAll('question_ids[]').map(String).filter((x) => x !== '' && !Number.isNaN(Number(x)));
      if (!ids.length) err.push('Selecciona al menos una pregunta para el banco de la evaluación.');
      break;
    }
  }
  if (e.key === 'logros' && (await val('SELECT 1 FROM achievements WHERE code=$1 AND id<>$2', [data['code'] ?? '', id]))) {
    err.push('Ya existe una insignia con ese código.');
  }
  return err;
}

async function beforeSave(hook: string, data: Record<string, unknown>, id: number, formData: FormData): Promise<void> {
  if (hook === 'users') {
    const pass = String(formData.get('password') ?? '');
    if (pass !== '') {
      data['password_hash'] = bcrypt.hashSync(pass, 10);
      data['must_change_password'] = 1;
      data['failed_attempts'] = 0;
      data['locked_until'] = null;
    } else if (!id) {
      data['password_hash'] = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
      data['must_change_password'] = 0;
    }
  }
  if (hook === 'exercises' && !data['lesson_id']) data['lesson_id'] = null;
}

async function afterSave(hook: string, id: number, formData: FormData): Promise<void> {
  if (hook === 'exercises') {
    await q('DELETE FROM exercise_options WHERE exercise_id=$1', [id]);
    if (String(formData.get('answer_kind') ?? '') === 'option') {
      let pos = 1;
      for (let line of String(formData.get('options_text') ?? '').split(/\r?\n/)) {
        line = line.trim();
        if (line === '') continue;
        const ok = line.startsWith('*');
        await insert('exercise_options', {
          exercise_id: id,
          label: (ok ? line.slice(1) : line).trim().slice(0, 400),
          is_correct: ok ? 1 : 0,
          position: pos++,
        });
      }
    }
  }
  if (hook === 'assessments') {
    const ids = [...new Set(
      formData
        .getAll('question_ids[]')
        .map(String)
        .filter((x) => x !== '' && !Number.isNaN(Number(x)))
        .map(Number),
    )];
    await q('DELETE FROM assessment_questions WHERE assessment_id=$1', [id]);
    let p = 1;
    for (const exId of ids) {
      if (await val('SELECT 1 FROM exercises WHERE id=$1', [exId])) {
        await insert('assessment_questions', { assessment_id: id, exercise_id: exId, position: p++ });
      }
    }
  }
}

/** Cambio de estado (réplica de CrudController::status). */
export async function statusChange(
  e: EntityFull,
  id: number,
  newStatus: string,
  userId: number,
): Promise<'ok' | 'notfound' | 'self'> {
  const row = await loadRow(e, id);
  if (!row) return 'notfound';
  if (e.table === 'users' && id === userId) return 'self';
  await update(e.table, { status: newStatus }, id);
  await activityLog('estado_' + newStatus, e.table, id);
  return 'ok';
}

/** Etiqueta legible del estado (Entities::statusOptions). */
export function statusOptionsLabel(status: string): string {
  return { active: 'Activo', inactive: 'Inactivo', archived: 'Archivado' }[status] ?? status;
}
