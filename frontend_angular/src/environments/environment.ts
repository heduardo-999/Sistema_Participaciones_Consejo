// src/environments/environment.ts

function limpiarBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function construirApiUrl(): string {
  const hostname = window.location.hostname;
  const frontendPort = window.location.port;

  // Si estás corriendo en desarrollo local con ng serve (puerto 4200)
  if (frontendPort === "4200") {
    return `https://${hostname}:9443/api`;
  }

  // En producción (corriendo desde Docker / Nginx en el puerto 9443)
  // Usamos directamente el origin limpio o la ruta relativa "/api"
  return `${window.location.origin}/api`;
}

export const environment = {
  production: false,
  apiUrl: limpiarBaseUrl(construirApiUrl()),
};
