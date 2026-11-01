// Configuración de ExcelLab (réplica de config/config.php).
// La conexión a PostgreSQL (Neon) se lee de DATABASE_URL (variable de entorno en Vercel y .env.local en local).

export const config = {
  appName: 'ExcelLab',
  debug: process.env.APP_DEBUG === '1', // en producción: false
  timezone: process.env.APP_TIMEZONE || 'America/Caracas',
  dbUrl: process.env.DATABASE_URL || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  upload: {
    maxMb: 5,
    extensions: ['xlsx', 'xls', 'csv'],
    mimes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/zip',
      'application/octet-stream',
      'application/x-ole-storage',
      'application/CDFV2',
      'text/csv',
      'text/plain',
      'application/csv',
    ],
  },
  mailDev: true,
  showDemoCredentials: process.env.APP_DEMO_CREDENTIALS !== '0',
  sessionIdleMin: 720,
  maxFailedLogins: 5,
  lockMinutes: 10,
};

export function isVercel(): boolean {
  return process.env.VERCEL === '1';
}
