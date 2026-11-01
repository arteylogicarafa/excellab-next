// Diagnóstico temporal: variables (booleans) + prueba real de conexión (solo el mensaje de error).
export async function GET() {
  const out: Record<string, unknown> = {
    database_url: Boolean(process.env.DATABASE_URL),
    session_secret: Boolean(process.env.SESSION_SECRET),
    vercel: Boolean(process.env.VERCEL),
  };
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
      const t0 = Date.now();
      const r = await pool.query('SELECT 1 AS ok');
      out.db_ping = `ok en ${Date.now() - t0}ms fila=${JSON.stringify(r.rows[0])}`;
      await pool.end();
    } catch (e) {
      out.db_ping = 'ERROR: ' + (e instanceof Error ? e.message.slice(0, 200) : String(e));
    }
  } else {
    out.db_ping = 'sin DATABASE_URL';
  }
  return Response.json(out);
}
