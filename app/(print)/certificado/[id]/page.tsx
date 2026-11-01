import { notFound, redirect } from 'next/navigation';
import { guard } from '@/lib/session';
import { one } from '@/lib/db';
import { fmtDate } from '@/lib/helpers';

// Certificado del módulo (réplica de MiscController::certificate + student/certificate.php).
// Layout mínimo (sin barra lateral), como el layout "print" del PHP.

export default async function CertificadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numId = Number(id);
  const s = await guard('student', `/certificado/${numId}`);

  const p = await one(
    'SELECT sp.*, m.title AS module_title, u.name AS student_name FROM student_progress sp JOIN modules m ON m.id=sp.module_id JOIN users u ON u.id=sp.student_id WHERE sp.student_id=$1 AND sp.module_id=$2 AND sp.completed_at IS NOT NULL',
    [s.uid, numId],
  );
  if (!p) {
    // Sin cookies en Server Components: el aviso viaja por la URL (texto idéntico al PHP).
    redirect(`/aprender/modulo/${numId}?cert=0`);
  }

  return (
    <>
      <div className="no-print text-center pt-3">
        <a className="btn btn-light" href={`/aprender/modulo/${p.module_id}`}>
          <i className="bi bi-arrow-left" /> Volver
        </a>
        <button className="btn btn-primary" onClick={undefined} suppressHydrationWarning>
          {/* el onclick se registra con un pequeño script (JSX no acepta onClick en servidor) */}
          <i className="bi bi-printer" /> Imprimir / Guardar como PDF
        </button>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.addEventListener('DOMContentLoaded',function(){var b=document.querySelectorAll('.no-print button');b.forEach(function(x){x.onclick=function(){window.print();};});});",
          }}
        />
      </div>
      <div className="certificate">
        <div className="seal">
          <i className="bi bi-patch-check-fill" />
        </div>
        <div className="text-uppercase text-muted fw-semibold" style={{ letterSpacing: '.2em' }}>
          ExcelLab · Paquetes Informáticos
        </div>
        <h1>Certificado de finalización</h1>
        <p className="fs-5 mb-1">Se certifica que</p>
        <div className="student">{String(p.student_name)}</div>
        <p className="fs-5 mt-3">ha completado satisfactoriamente el módulo</p>
        <h2 className="text-success mb-3">“{String(p.module_title)}”</h2>
        <p className="text-muted">
          Completado el {fmtDate(String(p.completed_at), false)} · {Number(p.lessons_total)} lecciones
        </p>
        <div className="d-flex justify-content-between align-items-end mt-5 pt-3">
          <div className="text-start small text-muted">
            Código de verificación
            <br />
            <strong className="text-dark fs-6">{String(p.certificate_code ?? '')}</strong>
          </div>
          <div className="text-center small text-muted">
            <div style={{ borderTop: '1px solid #6b7280', paddingTop: '.3rem', minWidth: 220 }}>
              Docente de la unidad curricular
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
