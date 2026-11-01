import { notFound, redirect } from 'next/navigation';
import { guard, readFlashes } from '@/lib/session';
import { getEntity, adminOnly, selectOptions, questionBank } from '@/lib/services/crud';
import CrudForm from '@/components/CrudForm';

// Nuevo registro (réplica de CrudController::form con id=0).
export async function generateMetadata({ params }: { params: Promise<{ any: string }> }) {
  const { any } = await params;
  const e = getEntity(any);
  return { title: e ? `Nuevo ${e.singular}` : 'Panel' };
}

export default async function CrudNuevoPage({ params }: { params: Promise<{ any: string }> }) {
  const { any } = await params;
  const s = await guard('staff', `/admin/${any}/nuevo`);
  const e = getEntity(any);
  if (!e) notFound();
  if (adminOnly(e) && s.role !== 'admin') redirect('/403');

  const flashes = await readFlashes();
  // como remember_input del PHP: prevalece el último formulario recordado
  const withOld = flashes.filter((f) => f.old);
  const old = withOld.length ? withOld[withOld.length - 1].old ?? null : null;
  const opts = await selectOptions(e);
  const bank = e.hooks === 'assessments' ? await questionBank() : [];
  const suggest = e.hooks === 'users' ? `Excel${1000 + Math.floor(Math.random() * 9000)}#` : '';

  const values: Record<string, unknown> = {};
  for (const f of e.fields) if (!f.virtual && f.default !== undefined) values[f.name] = f.default;

  return (
    <CrudForm e={e} values={values} old={old} id={0} opts={opts} bank={bank} questionIds={[]} suggest={suggest} csrf={s.csrf} />
  );
}
