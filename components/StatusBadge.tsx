// Insignia de estado (réplica de status_badge() de helpers.php).
const MAP: Record<string, [string, string]> = {
  active: ['success', 'Activo'],
  inactive: ['secondary', 'Inactivo'],
  archived: ['dark', 'Archivado'],
  submitted: ['warning', 'Pendiente de revisión'],
  reviewed: ['success', 'Revisado'],
};

export default function StatusBadge({ status }: { status: string }) {
  const [c, l] = MAP[status] ?? ['secondary', status];
  return <span className={`badge text-bg-${c}`}>{l}</span>;
}
