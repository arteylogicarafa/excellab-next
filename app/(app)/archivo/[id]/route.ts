import { getSession, redirectTo } from '@/lib/session';
import { one } from '@/lib/db';
import { isStaff } from '@/lib/session';
import { readUpload } from '@/lib/storage';

// GET /archivo/{id} — descarga protegida: solo el autor o el personal docente
// (réplica de PracticalCaseController::download).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  const s = await getSession();
  if (!s || s.uid === 0) return redirectTo(req, `/login?next=${encodeURIComponent(`/archivo/${numId}`)}`);

  const sub = await one('SELECT * FROM case_submissions WHERE id=$1', [numId]);
  if (!sub || !sub.file_path) return new Response('No encontrado.', { status: 404 });
  if (!isStaff(s) && Number(sub.student_id) !== s.uid) return new Response('No tienes permisos para ver esta sección.', { status: 403 });

  const buf = await readUpload(String(sub.file_path));
  if (!buf) return new Response('El archivo ya no está disponible.', { status: 404 });

  const filename = String(sub.original_name ?? 'entrega.xlsx').replace(/"/g, '');
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.length),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
