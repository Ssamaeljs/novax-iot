import { Routes } from '@angular/router';
import { authenticatedGuard, permissionGuard } from './core/auth/auth.guards';
const resourcePage = () =>
  import('./features/administration/resource.page').then(
    (module) => module.ResourcePage,
  );
export const routes: Routes = [
  {
    path: 'app',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('./layouts/workspace-layout.component').then(
        (module) => module.WorkspaceLayoutComponent,
      ),
    canActivateChild: [permissionGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        title: 'Vista general · Novax IoT',
        loadComponent: () =>
          import('./features/overview/overview.page').then(
            (module) => module.OverviewPage,
          ),
      },
      {
        path: 'monitoring',
        title: 'Monitorización · Novax IoT',
        data: { permission: 'measurements.read' },
        loadComponent: () =>
          import('./features/monitoring/monitoring.page').then(
            (module) => module.MonitoringPage,
          ),
      },
      {
        path: 'operations/devices',
        title: 'Dispositivos · Novax IoT',
        data: { resource: 'devices', permission: 'devices.read' },
        loadComponent: resourcePage,
      },
      {
        path: 'operations/sensors',
        title: 'Sensores · Novax IoT',
        data: { resource: 'sensors', permission: 'sensors.read' },
        loadComponent: resourcePage,
      },
      {
        path: 'operations/measurements',
        title: 'Registrar medición · Novax IoT',
        data: { permission: 'measurements.write' },
        loadComponent: () =>
          import('./features/operations/measurement-entry.page').then(
            (module) => module.MeasurementEntryPage,
          ),
      },
      ...[
        'users',
        'accounts',
        'roles',
        'permissions',
        'api-tokens',
        'audit',
      ].map((resource) => ({
        path: `administration/${resource}`,
        title: 'Administración · Novax IoT',
        data: {
          resource,
          permission: `${resource === 'audit' ? 'audit_logs' : resource.replace('-', '_')}.read`,
        },
        loadComponent: resourcePage,
      })),
      {
        path: 'account',
        title: 'Mi cuenta · Novax IoT',
        loadComponent: () =>
          import('./features/account/account.page').then(
            (module) => module.AccountPage,
          ),
      },
      {
        path: 'settings',
        title: 'Configuración · Novax IoT',
        loadComponent: () =>
          import('./features/settings/settings.page').then(
            (module) => module.SettingsPage,
          ),
      },
      {
        path: 'advanced',
        title: 'Opciones avanzadas · Novax IoT',
        data: { owner: true, permission: 'tenants.manage' },
        loadComponent: () =>
          import('./features/settings/advanced.page').then(
            (module) => module.AdvancedPage,
          ),
      },
      {
        path: 'forbidden',
        title: 'Acceso restringido · Novax IoT',
        data: { forbidden: true },
        loadComponent: () =>
          import('./features/errors/error.page').then(
            (module) => module.ErrorPage,
          ),
      },
      {
        path: '**',
        title: 'No encontrado · Novax IoT',
        loadComponent: () =>
          import('./features/errors/error.page').then(
            (module) => module.ErrorPage,
          ),
      },
    ],
  },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout.component').then(
        (module) => module.PublicLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Novax IoT · Infraestructura conectada',
        loadComponent: () =>
          import('./features/landing/landing.page').then(
            (module) => module.LandingPage,
          ),
      },
      ...['login', 'register', 'forgot-password', 'reset-password'].map(
        (mode) => ({
          path: `auth/${mode}`,
          title: 'Acceso · Novax IoT',
          data: { mode },
          loadComponent: () =>
            import('./features/auth/auth.page').then(
              (module) => module.AuthPage,
            ),
        }),
      ),
      {
        path: 'design-system',
        title: 'Catálogo visual · Novax IoT',
        loadComponent: () =>
          import('./features/design-system/design-system.component').then(
            (module) => module.DesignSystemComponent,
          ),
      },
      {
        path: '**',
        title: 'No encontrado · Novax IoT',
        loadComponent: () =>
          import('./features/errors/error.page').then(
            (module) => module.ErrorPage,
          ),
      },
    ],
  },
];
