import { getSession, redirectTo } from '@/lib/session';
import { one } from '@/lib/db';
import { build } from '@/lib/services/xlsx';

// GET /casos/{id}/plantilla — genera el .xlsx descargable (réplica de PracticalCaseController::template).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  const s = await getSession();
  if (!s || s.uid === 0) return redirectTo(req, `/login?next=${encodeURIComponent(`/casos/${numId}`)}`);

  const c = await one("SELECT * FROM practical_cases WHERE id=$1 AND status='active'", [numId]);
  if (!c) return new Response('No encontrado.', { status: 404 });
  let sheet: { headers: unknown[]; rows?: unknown[][] } | null = null;
  try {
    sheet = c.data_json ? JSON.parse(String(c.data_json)) : null;
  } catch {
    sheet = null;
  }
  if (!sheet) return new Response('No encontrado.', { status: 404 });

  const bin = await build(sheet.headers, (sheet.rows ?? []) as unknown[][], String(c.title).slice(0, 28));
  const name = `ExcelLab_caso_${numId}.xlsx`;
  return new Response(Buffer.from(bin), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(bin.byteLength),
    },
  });
}
