import { Routes } from '@angular/router';
import { authenticatedGuard, permissionGuard } from './core/auth/auth.guards';
const resourcePage = () =>
  import('./features/administration/resource.page').then(
    (module) => module.ResourcePage,
  );
const confirmResourceChanges = (component: { canLeave(): boolean }) => component.canLeave();
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
        path: 'projects', title: 'Proyectos · Novax IoT',
        data: { resource: 'projects', permission: 'projects.read', breadcrumb: { label: 'Proyectos' } }, loadComponent: resourcePage, canDeactivate: [confirmResourceChanges],
      },
      {
        path: 'projects/:external_id', title: 'Tablero · Novax IoT',
        data: { permission: 'projects.read', breadcrumb: { label: 'Tablero', parents: [{ label: 'Proyectos', commands: ['/app/projects'], permission: 'projects.read' }] } },
        canDeactivate: [(component: { canLeave(): boolean }) => component.canLeave()],
        loadComponent: () => import('./features/projects/project-board.page').then((module) => module.ProjectBoardPage),
      },
      {
        path: 'overview',
        data: { breadcrumb: { label: 'Inicio' } },
        title: 'Vista general · Novax IoT',
        loadComponent: () =>
          import('./features/overview/overview.page').then(
            (module) => module.OverviewPage,
          ),
      },
      {
        path: 'monitoring',
        title: 'Monitorización · Novax IoT',
        data: { permission: 'measurements.read', breadcrumb: { label: 'Reportes de mediciones', deviceContext: true } },
        loadComponent: () =>
          import('./features/monitoring/monitoring.page').then(
            (module) => module.MonitoringPage,
          ),
      },
      {
        path: 'operations/devices',
        title: 'Dispositivos · Novax IoT',
        data: { resource: 'devices', permission: 'devices.read', breadcrumb: { label: 'Dispositivos' } },
        canDeactivate: [confirmResourceChanges],
        loadComponent: resourcePage,
      },
      {
        path: 'device/:deviceId', title: 'Dispositivo · Novax IoT',
        data: { permission: 'devices.read', breadcrumb: { label: 'Dispositivo', parents: [{ label: 'Dispositivos', commands: ['/app/operations/devices'], permission: 'devices.read' }] } }, canDeactivate: [confirmResourceChanges],
        loadComponent: () => import('./features/devices/device-detail.page').then((module) => module.DeviceDetailPage),
      },
      {
        path: 'operations/sensors',
        title: 'Sensores · Novax IoT',
        data: { resource: 'sensors', permission: 'sensors.read', breadcrumb: { label: 'Sensores' } },
        canDeactivate: [confirmResourceChanges],
        loadComponent: resourcePage,
      },
      {
        path: 'operations/measurements',
        title: 'Registrar medición · Novax IoT',
        data: { permission: 'measurements.write', breadcrumb: { label: 'Medición manual', deviceContext: true } },
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
          breadcrumb: { label: ({ users: 'Usuarios', accounts: 'Cuentas', roles: 'Roles', permissions: 'Permisos', 'api-tokens': 'Tokens de API', audit: 'Auditoría' } as Record<string, string>)[resource] },
          permission: `${resource === 'audit' ? 'audit_logs' : resource.replace('-', '_')}.read`,
        },
        loadComponent: resourcePage,
        canDeactivate: [confirmResourceChanges],
      })),
      { path: 'help', title: 'Guía de uso · Novax IoT', data: { breadcrumb: { label: 'Guía de uso' } }, loadComponent: () => import('./features/help/help.page').then((module) => module.HelpPage) },
      { path: 'integrations', title: 'Integraciones · Novax IoT', data: { permission: 'integrations.read', breadcrumb: { label: 'Integraciones' } }, canDeactivate: [(component: { canLeave(): boolean }) => component.canLeave()], loadComponent: () => import('./features/integrations/integrations.page').then((module) => module.IntegrationsPage) },
      {
        path: 'account',
        data: { breadcrumb: { label: 'Mi cuenta' } },
        title: 'Mi cuenta · Novax IoT',
        loadComponent: () =>
          import('./features/account/account.page').then(
            (module) => module.AccountPage,
          ),
      },
      {
        path: 'settings',
        data: { breadcrumb: { label: 'Configuración' } },
        title: 'Configuración · Novax IoT',
        loadComponent: () =>
          import('./features/settings/settings.page').then(
            (module) => module.SettingsPage,
          ),
      },
      {
        path: 'advanced',
        title: 'Opciones avanzadas · Novax IoT',
        data: { owner: true, permission: 'tenants.manage', breadcrumb: { label: 'Opciones avanzadas', parents: [{ label: 'Configuración', commands: ['/app/settings'] }] } },
        loadComponent: () =>
          import('./features/settings/advanced.page').then(
            (module) => module.AdvancedPage,
          ),
      },
      {
        path: 'forbidden',
        title: 'Acceso restringido · Novax IoT',
        data: { forbidden: true, breadcrumb: { label: 'Acceso restringido' } },
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
      { path: 'auth/register', pathMatch: 'full', redirectTo: '/auth/login' },
      ...['login', 'forgot-password', 'reset-password'].map(
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
