import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class CrudService {
  constructor(private api: ApiService) {}

  list<T>(path: string, params?: any) {
    return this.api.get<T>(path, params);
  }

  create<T>(path: string, data: any) {
    return this.api.post<T>(path, data);
  }

  update<T>(path: string, id: number, data: any) {
    return this.api.put<T>(`${path}/${id}`, data);
  }

  remove<T>(path: string, id: number) {
    return this.api.delete<T>(`${path}/${id}`);
  }

  delete<T>(path: string) {
    return this.api.delete<T>(path);
  }
}