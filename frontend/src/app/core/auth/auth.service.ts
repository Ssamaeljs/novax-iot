import { inject, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../api/api.service';
import { AuthState, Identity } from './auth-state.service';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  readonly state = inject(AuthState);
  private pending: Promise<boolean> | null = null;
  async restore(): Promise<boolean> {
    if (this.state.identity()) return true;
    if (this.pending) return this.pending;
    this.pending = firstValueFrom(this.api.get<Identity>('auth/me'))
      .then(({ data }) => {
        this.state.identity.set(data);
        return true;
      })
      .catch((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401)
          return false;
        throw error;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }
  async login(payload: unknown) {
    const { data } = await firstValueFrom(
      this.api.post<Identity>('auth/web/login', payload),
    );
    this.state.identity.set(data);
  }
  async logout() {
    try {
      await firstValueFrom(this.api.post('auth/logout', {}));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401)
        throw error;
    }
    this.state.identity.set(null);
  }
}
