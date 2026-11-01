import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Renderizado dinámico clásico (como el PHP): las páginas leen cookies/sesión
  // en cada petición. Cache Components no hace falta para esta aplicación.
  cacheComponents: false,
};

export default nextConfig;
