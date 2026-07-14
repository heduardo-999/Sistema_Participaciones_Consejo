import { Injectable } from '@angular/core';
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private client: AxiosInstance;
  private redirectingToLogin = false;

  constructor() {
    this.client = axios.create({
      baseURL: environment.apiUrl,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getToken();

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      }
    );

    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearSessionStorage();

          const currentPath = window.location.pathname;
          const requestUrl = String(error.config?.url || '');
          const isLoginRequest = requestUrl.includes('/login');

          if (
            !isLoginRequest &&
            !currentPath.startsWith('/login') &&
            !this.redirectingToLogin
          ) {
            this.redirectingToLogin = true;
            window.location.replace('/login');
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private getToken(): string | null {
    return (
      sessionStorage.getItem('token') ??
      localStorage.getItem('token')
    );
  }

  private clearSessionStorage(): void {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  private ruta(url: string): string {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    const limpia = url
      .replace(/^\/+/, '')
      .replace(/^api\//, '');

    return `/${limpia}`;
  }

  get<T>(url: string, params?: any): Promise<T> {
    return this.client
      .get<T>(this.ruta(url), { params })
      .then(response => response.data);
  }

  post<T>(url: string, data?: any): Promise<T> {
    return this.client
      .post<T>(this.ruta(url), data)
      .then(response => response.data);
  }

  put<T>(url: string, data?: any): Promise<T> {
    return this.client
      .put<T>(this.ruta(url), data)
      .then(response => response.data);
  }

  delete<T>(url: string): Promise<T> {
    return this.client
      .delete<T>(this.ruta(url))
      .then(response => response.data);
  }
}
