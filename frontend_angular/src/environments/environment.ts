// src/environments/environment.ts

function limpiarBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function construirApiUrl(): string {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const frontendPort = window.location.port;

  // Cuando corres Angular con ng serve normalmente estás en el puerto 4200.
  // En ese caso el backend Laravel se toma en la misma IP/dominio, pero puerto 8000.
  if (frontendPort === '4200') {
    return `${protocol}//${hostname}:8000/api`;
  }

  
  // Cuando lo subas a un servidor y frontend/backend estén bajo el mismo dominio,
  // se usará automáticamente el mismo dominio donde se abrió el frontend.

  //En esta caso, en modo producción, debe hacer caso al puerto 8000, que es el puerto donde corre el backend Laravel desde docker.
  return `${window.location.origin}:8000/api`;
}

export const environment = {
  production: false,
  apiUrl: limpiarBaseUrl(construirApiUrl()),
};
