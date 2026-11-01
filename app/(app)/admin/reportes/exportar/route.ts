import { getSession } from '@/lib/session';
import { all } from '@/lib/db';
import { log as activityLog } from '@/lib/activity';
import { nowSql } from '@/lib/helpers';
import { unionSql, REPORT_TYPES } from '@/lib/services/reports';

// GET /admin/reportes/exportar — exportación CSV (réplica de ReportsController con export=1).
// El navegador llega aquí mediante rewrite desde /admin/reportes?export=1 (proxy.ts).

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.uid === 0) return Response.redirect(new URL('/login', req.url), 303);
  if (s.role !== 'admin' && s.role !== 'docente') {
    return new Response('No tienes permisos para ver esta sección.', { status: 403 });
  }

  const url = new URL(req.url);
  const f = {
    student: url.searchParams.get('student') ?? '',
    module: url.searchParams.get('module') ?? '',
    type: url.searchParams.get('type') ?? '',
    from: url.searchParams.get('from') ?? '',
    to: url.searchParams.get('to') ?? '',
  };

  const where: string[] = [];
  const params: unknown[] = [];
  if (Number(f.student)) {
    where.push('x.student_id=?');
    params.push(Number(f.student));
  }
  if (Number(f.module)) {
    where.push('x.module_id=?');
    params.push(Number(f.module));
  }
  if (f.type in REPORT_TYPES) {
    where.push('x.kind=?');
    params.push(f.type);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.from)) {
    where.push('x.occurred_at >= ?');
    params.push(f.from + ' 00:00:00');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.to)) {
    where.push('x.occurred_at <= ?');
    params.push(f.to + ' 23:59:59');
  }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const base = 'FROM (' + unionSql() + ') x JOIN users u ON u.id=x.student_id LEFT JOIN modules m ON m.id=x.module_id' + w;

  const rows = await all(
    `SELECT x.occurred_at, u.name AS student, x.kind, x.activity, m.title AS module_title, x.result, x.score ${base} ORDER BY x.occurred_at DESC NULLS LAST LIMIT 20000`,
    params,
  );

  const lines: string[] = [];
  lines.push(['Fecha', 'Estudiante', 'Tipo', 'Actividad', 'Módulo', 'Resultado', 'Puntaje'].map(csvCell).join(';'));
  for (const r of rows) {
    const score =
      r.score !== null && r.score !== undefined
        ? String(Math.round(Number(r.score) * 100) / 100).replace('.', ',')
        : '';
    lines.push(
      [
        r.occurred_at,
        r.student,
        REPORT_TYPES[String(r.kind)] ?? String(r.kind),
        r.activity,
        r.module_title ?? '',
        r.result,
        score,
      ]
        .map(csvCell)
        .join(';'),
    );
  }
  await activityLog('reporte_exportado', 'reports', null, `${rows.length} filas`);

  const csv = '\uFEFF' + lines.join('\r\n') + '\r\n';
  const stamp = nowSql().replace(/[-:]/g, '').replace(' ', '_');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reporte_excellab_${stamp}.csv"`,
    },
  });
}
