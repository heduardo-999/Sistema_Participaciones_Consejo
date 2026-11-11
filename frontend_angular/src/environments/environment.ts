// src/environments/environment.ts
import configData from "../assets/config.json";

function limpiarBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function construirApiUrl(): string {
  const hostname = window.location.hostname;
  const frontendPort = window.location.port;

  // Si estás corriendo en desarrollo local con ng serve (puerto 4200)
  // if (frontendPort === "4200") {
  return configData[0];
  // return `https://${hostname}:9443/api`;
  // }

  // En producción (corriendo desde Docker / Nginx en el puerto 9443)
  // Usamos directamente el origin limpio o la ruta relativa "/api"
  return `${window.location.origin}/api`;
}

export const environment = {
  production: false,
  apiUrl: limpiarBaseUrl(construirApiUrl()),
};

// cd frontend_angular && rm -rf dist && cd ../../turnos-consejo-production && find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.htaccess' -exec rm -rf {} + && cd ../Sistema_Participaciones_Consejo/frontend_angular && ng build --configuration production && cp -r dist/sistemas-participaciones-front/browser/* ../../consejo_backend/turnos-consejo-production && cp -r dist/sistemas-participaciones-front/browser/* ../../turnos-consejo-production && cd ../frontend_angular && cd ..

//  && cp -r dist/sistema-participaciones-front/browser/* ../turnos-consejo-production && cd ../turnos-consejo-production  && cd ../frontend_angular
// && git status && git add . && git commit -m "mejora conteo horas y descarga excel" && git push origin main && cd ../frontend_angular
