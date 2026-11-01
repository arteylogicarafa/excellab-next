import { notFound, redirect } from 'next/navigation';
import { guard, readFlashes } from '@/lib/session';
import { all } from '@/lib/db';
import { getEntity, adminOnly, loadRow, selectOptions, questionBank } from '@/lib/services/crud';
import CrudForm from '@/components/CrudForm';

// Editar registro (réplica de CrudController::form con id).
export async function generateMetadata({ params }: { params: Promise<{ any: string; id: string }> }) {
  const { any } = await params;
  const e = getEntity(any);
  return { title: e ? `Editar ${e.singular}` : 'Panel' };
}

export default async function CrudEditarPage({ params }: { params: Promise<{ any: string; id: string }> }) {
  const { any, id: idStr } = await params;
  const numId = Number(idStr);
  const s = await guard('staff', `/admin/${any}/${numId}/editar`);
  const e = getEntity(any);
  if (!e) notFound();
  if (adminOnly(e) && s.role !== 'admin') redirect('/403');

  const row = await loadRow(e, numId);
  if (!row) notFound();

  // Hook 'exercises' (igual que CrudController::form): reconstruye las alternativas.
  if (e.hooks === 'exercises') {
    const lines = await all(
      'SELECT label, is_correct FROM exercise_options WHERE exercise_id=$1 ORDER BY position, id',
      [numId],
    );
    row['options_text'] = lines.map((o) => `${Number(o.is_correct) ? '*' : ''}${String(o.label)}`).join('\n');
  }

  const flashes = await readFlashes();
  // como remember_input del PHP: prevalece el último formulario recordado
  const withOld = flashes.filter((f) => f.old);
  const old = withOld.length ? withOld[withOld.length - 1].old ?? null : null;
  const opts = await selectOptions(e);
  const bank = e.hooks === 'assessments' ? await questionBank() : [];

  let questionIds: string[] = [];
  if (e.hooks === 'assessments') {
    questionIds = (await all('SELECT exercise_id FROM assessment_questions WHERE assessment_id=$1', [numId])).map((r) =>
      String(r.exercise_id),
    );
  }
  if (old && old['question_ids']) {
    try {
      const parsed = JSON.parse(String(old['question_ids']));
      questionIds = Array.isArray(parsed) ? parsed.map(String) : questionIds;
    } catch {
      /* se conservan los de la base */
    }
  }

  return (
    <CrudForm
      e={e}
      values={row}
      old={old}
      id={numId}
      opts={opts}
      bank={bank}
      questionIds={questionIds}
      suggest=""
      csrf={s.csrf}
    />
  );
}
