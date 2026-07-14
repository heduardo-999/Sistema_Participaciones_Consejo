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

  //En esta caso, en modo producción, debe hacer caso al puerto 8080, que es el puerto donde corre el backend Laravel desde docker.
  if (frontendPort === '80') {
    return `${protocol}//${hostname}:8080/api`;
  }

  // Cuando lo subas a un servidor y frontend/backend estén bajo el mismo dominio,
  // se usará automáticamente el mismo dominio donde se abrió el frontend.
  return `${window.location.origin}:8080/api`;
}

export const environment = {
  production: false,
  apiUrl: limpiarBaseUrl(construirApiUrl()),
};
