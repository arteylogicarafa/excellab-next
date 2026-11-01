import { getSession, csrfValid, flash, redirectTo } from '@/lib/session';
import { one, insert } from '@/lib/db';
import { matches } from '@/lib/services/evaluator';
import { check as checkBadges } from '@/lib/services/badges';
import { log as activityLog } from '@/lib/activity';
import { staff as notifyStaff } from '@/lib/notifier';
import { saveUpload, validSpreadsheet, safeOriginalName } from '@/lib/storage';
import { config } from '@/lib/config';

// POST /casos/{id}/entregar (réplica de PracticalCaseController::submit / submitPlatform / submitFile).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const numId = Number(id);
  const back = `/casos/${numId}`;
  const s = await getSession();
  if (!s || s.uid === 0) return redirectTo(req, `/login?next=${encodeURIComponent(back)}`);
  if (s.role !== 'estudiante') return new Response('No tienes permisos para ver esta sección.', { status: 403 });
  const fd = await req.formData().catch(() => new FormData());
  if (!(await csrfValid(req, fd))) {
    return new Response('Formulario expirado. Vuelve atrás, recarga la página e inténtalo de nuevo.', { status: 403 });
  }

  const c = await one("SELECT * FROM practical_cases WHERE id=$1 AND status='active'", [numId]);
  if (!c) return new Response('No encontrado.', { status: 404 });

  if (c.mode === 'platform') {
    await submitPlatform(c, fd, s.uid, numId);
  } else {
    const fail = await submitFile(req, fd, s.name, s.uid, numId);
    if (fail) return fail;
  }

  const badges = await checkBadges(s.uid);
  for (const b of badges) await flash('info', 'Nuevo logro: ' + b.name);
  return redirectTo(req, `${back}?ok=1`);
}

async function submitPlatform(c: Record<string, unknown>, fd: FormData, uid: number, numId: number): Promise<void> {
  let qs: { label: string; answer: string; kind?: string; tolerance?: number }[] = [];
  try {
    qs = c.questions_json ? JSON.parse(String(c.questions_json)) ?? [] : [];
  } catch {
    qs = [];
  }
  const results: { answer: string; ok: boolean }[] = [];
  let correct = 0;
  qs.forEach((q, i) => {
    const a = String(fd.get(`answers[${i}]`) ?? '').trim().slice(0, 200);
    const ok = a !== '' && matches(q.kind ?? 'text', a, String(q.answer ?? ''), Number(q.tolerance ?? 0.01));
    results.push({ answer: a, ok });
    if (ok) correct++;
  });
  const score = qs.length ? Math.round((Number(c.points) * correct / qs.length) * 100) / 100 : 0;
  await insert('case_submissions', {
    case_id: numId,
    student_id: uid,
    answers_json: JSON.stringify(results),
    score,
    status: 'reviewed',
    feedback: `Calificación automática: ${correct} de ${qs.length} respuestas correctas.`,
  });
  await activityLog('caso_entregado', 'practical_cases', numId, `Auto: ${correct}/${qs.length}`);
  await flash(
    correct === qs.length ? 'success' : 'warning',
    `Caso calificado: ${correct} de ${qs.length} respuestas correctas (${score} pts).`,
  );
}

async function submitFile(
  req: Request,
  fd: FormData,
  userName: string,
  uid: number,
  numId: number,
): Promise<Response | null> {
  const back = `/casos/${numId}`;
  const raw = fd.get('file');
  if (!(raw instanceof File) || raw.size === 0) {
    await flash('danger', 'Selecciona el archivo de Excel que vas a entregar.');
    return redirectTo(req, back);
  }
  const maxBytes = config.upload.maxMb * 1024 * 1024;
  if (raw.size > maxBytes) {
    await flash('danger', `El archivo supera los ${config.upload.maxMb} MB permitidos.`);
    return redirectTo(req, back);
  }
  const ext = (raw.name.split('.').pop() ?? '').toLowerCase();
  if (!config.upload.extensions.includes(ext)) {
    await flash(
      'danger',
      'Solo se aceptan archivos ' + config.upload.extensions.map((e) => '.' + e).join(', ') + '.',
    );
    return redirectTo(req, back);
  }
  const buf = Buffer.from(await raw.arrayBuffer());
  if (!validSpreadsheet(ext, buf.subarray(0, 8), buf.subarray(0, 2048))) {
    await flash('danger', 'El contenido del archivo no corresponde a una hoja de cálculo válida.');
    return redirectTo(req, back);
  }

  let stored: string;
  try {
    stored = await saveUpload(raw, ext);
  } catch {
    await flash('danger', 'No se pudo guardar el archivo en el servidor.');
    return redirectTo(req, back);
  }
  const origName = safeOriginalName(raw.name, ext);
  const subId = await insert('case_submissions', {
    case_id: numId,
    student_id: uid,
    file_path: stored,
    original_name: origName,
    status: 'submitted',
  });
  const c = await one('SELECT title FROM practical_cases WHERE id=$1', [numId]);
  await activityLog('caso_entregado', 'practical_cases', numId, origName);
  await notifyStaff(
    `Nueva entrega: ${String(c?.title ?? '')}`,
    `${userName} entregó un archivo para revisar.`,
    `admin/entregas/${subId}`,
  );
  await flash('success', 'Archivo entregado correctamente. Tu docente lo revisará pronto.');
  return null;
}
