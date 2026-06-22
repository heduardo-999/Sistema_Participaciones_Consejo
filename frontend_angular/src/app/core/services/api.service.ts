import { Injectable } from '@angular/core';
import axios, { AxiosInstance } from 'axios';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: environment.apiUrl,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(config => {
      const token = localStorage.getItem('token');

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    });
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

  get<T>(url: string, params?: any) {
    return this.client.get<T>(this.ruta(url), { params }).then(r => r.data);
  }

  post<T>(url: string, data?: any) {
    return this.client.post<T>(this.ruta(url), data).then(r => r.data);
  }

  put<T>(url: string, data?: any) {
    return this.client.put<T>(this.ruta(url), data).then(r => r.data);
  }

  delete<T>(url: string) {
    return this.client.delete<T>(this.ruta(url)).then(r => r.data);
  }
}
