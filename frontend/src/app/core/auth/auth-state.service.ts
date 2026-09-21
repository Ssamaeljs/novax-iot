import { computed, Injectable, signal } from '@angular/core';
export interface Identity {
  tenant: { external_id: string; name: string; slug: string; timezone: string };
  account: { external_id: string; username: string; email: string };
  user: {
    external_id: string;
    first_name: string;
    last_name: string;
    id_card: string;
  };
  roles: { external_id: string; code: string; name: string }[];
  permissions: string[];
}
@Injectable({ providedIn: 'root' })
export class AuthState {
  readonly identity = signal<Identity | null>(null);
  readonly owner = computed(
    () =>
      this.identity()?.roles.some((role) => role.code === 'TENANT_OWNER') ??
      false,
  );
  has(permission: string): boolean {
    return (
      this.identity()?.permissions.some(
        (key) => key === permission || key === '*',
      ) ?? false
    );
  }
}
