import type { Metadata, Viewport } from 'next';

// Raíz pura (sin cookies) para poder prerenderizar el 404.
// CSS comunes y scripts globales con defer (como el <head> de los layouts PHP);
// las páginas añaden sus scripts inline envueltos en DOMContentLoaded.

export const metadata: Metadata = {
  title: { template: '%s · ExcelLab', default: 'ExcelLab' },
  icons: { icon: [{ url: '/assets/img/favicon.svg', type: 'image/svg+xml' }] },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg" />
        <link rel="stylesheet" href="/assets/vendor/bootstrap/bootstrap.min.css" />
        <link rel="stylesheet" href="/assets/vendor/icons/bootstrap-icons.min.css" />
        <link rel="stylesheet" href="/assets/css/app.css" />
        <script src="/assets/vendor/bootstrap/bootstrap.bundle.min.js" defer />
        <script src="/assets/vendor/chartjs/chart.umd.min.js" defer />
        <script src="/assets/js/app.js" defer />
        {children}
      </body>
    </html>
  );
}
