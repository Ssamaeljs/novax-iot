import { Identity } from '../app/core/auth/auth-state.service';
export const testIdentity: Identity = {
  tenant: {
    external_id: 'tenant-public',
    name: 'Organización QA',
    slug: 'qa-test',
    timezone: 'America/Guayaquil',
  },
  account: {
    external_id: 'account-public',
    username: 'qa-user',
    email: 'qa@example.test',
  },
  user: {
    external_id: 'user-public',
    first_name: 'Prueba',
    last_name: 'Local',
    id_card: 'QA-TEST',
  },
  roles: [
    { external_id: 'role-public', code: 'TENANT_OWNER', name: 'Propietario' },
  ],
  permissions: [
    'devices.read',
    'devices.manage',
    'sensors.read',
    'sensors.manage',
    'users.read',
    'users.manage',
    'accounts.read',
    'accounts.manage',
    'roles.read',
    'roles.manage',
    'permissions.read',
    'api_tokens.read',
    'api_tokens.manage',
    'audit_logs.read',
    'measurements.read',
    'measurements.write',
    'tenants.manage',
  ],
};
