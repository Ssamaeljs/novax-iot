import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
export interface Entity {
  external_id: string;
  [key: string]: any;
}
export interface Page<T> {
  data: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}
export interface Envelope<T> {
  data: T;
}
export const API_BASE = '/v1/api';
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (!error.status || error.status >= 502)
      return 'No se pudo conectar con el servidor. Comprueba la conexión e inténtalo de nuevo.';
    const message = error.error?.error || 'No se pudo completar la operación.';
    const details = Array.isArray(error.error?.details)
      ? error.error.details
          .filter(
            (item: unknown): item is { field: string; message: string } =>
              !!item &&
              typeof item === 'object' &&
              'field' in item &&
              'message' in item &&
              typeof item.field === 'string' &&
              typeof item.message === 'string',
          )
          .slice(0, 4)
          .map(
            (item: { field: string; message: string }) =>
              `${item.field}: ${item.message}`,
          )
          .join('. ')
      : '';
    return details ? `${message}. ${details}` : message;
  }
  return error instanceof Error
    ? error.message
    : 'No se pudo completar la operación.';
}
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  list<T = Entity>(
    path: string,
    query: Record<string, string | number | boolean> = {},
  ) {
    return this.http.get<Page<T>>(`${API_BASE}/${path}`, {
      params: new HttpParams({ fromObject: query }),
    });
  }
  get<T = Entity>(path: string) {
    return this.http.get<Envelope<T>>(`${API_BASE}/${path}`);
  }
  post<T = Entity>(path: string, body: unknown) {
    return this.http.post<Envelope<T>>(`${API_BASE}/${path}`, body);
  }
  patch<T = Entity>(path: string, body: unknown) {
    return this.http.patch<Envelope<T>>(`${API_BASE}/${path}`, body);
  }
  put<T = Entity>(path: string, body: unknown) {
    return this.http.put<Envelope<T>>(`${API_BASE}/${path}`, body);
  }
  delete(path: string) {
    return this.http.delete<void>(`${API_BASE}/${path}`);
  }
  // Relation pickers must not silently omit records beyond the first API page.
  async options(
    path: string,
    query: Record<string, string | number | boolean> = {},
  ): Promise<Entity[]> {
    const rows: Entity[] = [];
    let page = 1;
    for (;;) {
      const result = await firstValueFrom(
        this.list(path, { ...query, page, page_size: 100 }),
      );
      rows.push(...result.data);
      if (page >= result.pagination.total_pages) return rows;
      if (page >= 50)
        throw new Error(
          'Demasiadas opciones. Reduce el catálogo antes de realizar esta asignación.',
        );
      page++;
    }
  }
}
