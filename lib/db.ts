import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { config } from './config';

// Acceso a datos con node-postgres (réplica de app/Core/DB.php).

let pool: Pool | null = null;
const columnsCache = new Map<string, string[]>();

function getPool(): Pool {
  if (!pool) {
    if (!config.dbUrl) throw new Error('Falta la variable de entorno DATABASE_URL con la conexión de Neon.');
    pool = new Pool({ connectionString: config.dbUrl, max: 5, statement_timeout: 30000 });
    // Como hacía DB.php: la sesión de PostgreSQL usa la zona de la aplicación (NOW() en hora local).
    const tz = config.timezone.replace(/'/g, "''");
    pool.on('connect', (client) => {
      client.query(`SET TIME ZONE '${tz}'`).catch(() => undefined);
    });
  }
  return pool;
}

/** Convierte los `?` posicionales de las consultas PHP a parámetros $1..$n de PostgreSQL. */
function toDollar(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export interface Queryable {
  query(text: string, params?: unknown[]): Promise<QueryResultRow[]>;
}

/** Consulta simple con parámetros posicionales estilo PDO (`?`). */
export async function q<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query<T>(toDollar(sql), params);
  return res.rows;
}

export async function all<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  return q<T>(sql, params);
}

export async function one<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

/** Devuelve la primera columna de la primera fila (fetchColumn de PDO). */
export async function val<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q(sql, params);
  if (!rows.length) return null;
  const first = Object.values(rows[0]);
  return (first[0] ?? null) as T;
}

export async function exec(sql: string, params: unknown[] = []): Promise<number> {
  const res = await getPool().query(toDollar(sql), params);
  return res.rowCount ?? 0;
}

/** Columnas de una tabla desde information_schema (cacheadas por tabla). */
async function tableColumns(table: string): Promise<string[]> {
  const cached = columnsCache.get(table);
  if (cached) return cached;
  const rows = await q<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1",
    [table],
  );
  const cols = rows.map((r) => String(r.column_name));
  columnsCache.set(table, cols);
  return cols;
}

/** INSERT ... RETURNING id (PostgreSQL no tiene lastInsertId). */
export async function insert(table: string, data: Record<string, unknown>): Promise<number> {
  const cols = Object.keys(data);
  const quoted = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
  let sql = `INSERT INTO "${table}" (${quoted}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`;
  const hasId = (await tableColumns(table)).includes('id');
  if (hasId) sql += ' RETURNING id';
  const res = await getPool().query(sql, cols.map((c) => data[c]));
  if (!hasId) return 0;
  return Number(res.rows[0]?.id ?? 0);
}

/** UPDATE; si la tabla tiene updated_at se actualiza (como hacía ON UPDATE CURRENT_TIMESTAMP). */
export async function update(table: string, data: Record<string, unknown>, id: number): Promise<void> {
  const cols = Object.keys(data);
  let set = cols.map((c, i) => `"${c.replace(/"/g, '""')}"=$${i + 1}`).join(',');
  const tableCols = await tableColumns(table);
  const params: unknown[] = cols.map((c) => data[c]);
  if (tableCols.includes('updated_at') && !('updated_at' in data)) {
    set += ',"updated_at"=NOW()';
  }
  params.push(id);
  await getPool().query(`UPDATE "${table}" SET ${set} WHERE id=$${params.length}`, params);
}

/** Ajuste global del sistema (tabla settings). */
export async function setting(key: string, def = ''): Promise<string> {
  const v = await val<string>('SELECT svalue FROM settings WHERE skey=$1', [key]);
  return v === null || v === undefined ? def : String(v);
}

/** Para transacciones (entregas, calificaciones que notifican). */
export async function withTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
