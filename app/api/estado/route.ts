// Diagnóstico temporal: solo confirma si las variables de entorno existen (sin valores).
export function GET() {
  return Response.json({
    database_url: Boolean(process.env.DATABASE_URL),
    session_secret: Boolean(process.env.SESSION_SECRET),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    vercel: Boolean(process.env.VERCEL),
    node: process.version,
  });
}
