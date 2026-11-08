import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthState } from './auth-state.service';
export function safeReturnUrl(value: string | null): string {
  return value && /^\/app(?:\/|\?|$)/.test(value) && !value.includes('\\')
    ? value
    : '/app/overview';
}
export const authenticatedGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    return (
      (await auth.restore()) ||
      router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url },
      })
    );
  } catch {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { unavailable: '1', returnUrl: state.url },
    });
  }
};
export const permissionGuard: CanActivateFn = (route) => {
  const state = inject(AuthState);
  const router = inject(Router);
  return (
    ((!route.data['permission'] || state.has(route.data['permission'])) &&
      (!route.data['owner'] || state.owner())) ||
    router.createUrlTree(['/app/forbidden'])
  );
};
