import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthState } from './auth-state.service';
import { API_BASE } from '../api/api.service';
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const state = inject(AuthState);
  const router = inject(Router);
  if (!request.url.startsWith(`${API_BASE}/`)) return next(request);
  const secured = request.clone({
    withCredentials: true,
    setHeaders: { 'X-Novax-CSRF': '1' },
  });
  return next(secured).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !request.url.endsWith('/login')) {
        state.identity.set(null);
        if (router.url.startsWith('/app'))
          void router.navigate(['/auth/login'], {
            queryParams: { returnUrl: router.url, expired: '1' },
          });
      }
      return throwError(() => error);
    }),
  );
};
