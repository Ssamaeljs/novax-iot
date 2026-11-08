import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent, IconName } from '../ui/icon.component';
import { AuthState } from '../../core/auth/auth-state.service';
interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  permission?: string;
}
@Component({
  selector: 'app-navigation',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  readonly selected = output<void>();
  readonly state = inject(AuthState);
  readonly groups: { label: string; items: NavItem[] }[] = [
    {
      label: 'Espacio de trabajo',
      items: [
        { path: 'overview', label: 'Vista general', icon: 'grid' },
        { path: 'help', label: 'Guía de uso', icon: 'layers' },
        { path: 'projects', label: 'Proyectos', icon: 'layers', permission: 'projects.read' },
        {
          path: 'monitoring',
          label: 'Monitorización',
          icon: 'activity',
          permission: 'measurements.read',
        },
      ],
    },
    {
      label: 'Operación',
      items: [
        { path: 'integrations', label: 'Integraciones', icon: 'layers', permission: 'integrations.read' },
        {
          path: 'operations/devices',
          label: 'Dispositivos',
          icon: 'device',
          permission: 'devices.read',
        },
        {
          path: 'operations/sensors',
          label: 'Sensores',
          icon: 'sensor',
          permission: 'sensors.read',
        },
        {
          path: 'operations/measurements',
          label: 'Registrar medición',
          icon: 'plus',
          permission: 'measurements.write',
        },
      ],
    },
    {
      label: 'Administración',
      items: [
        {
          path: 'administration/users',
          label: 'Usuarios',
          icon: 'users',
          permission: 'users.read',
        },
        {
          path: 'administration/accounts',
          label: 'Cuentas',
          icon: 'shield',
          permission: 'accounts.read',
        },
        {
          path: 'administration/roles',
          label: 'Roles y permisos',
          icon: 'shield',
          permission: 'roles.read',
        },
        {
          path: 'administration/permissions',
          label: 'Catálogo de permisos',
          icon: 'layers',
          permission: 'permissions.read',
        },
        {
          path: 'administration/api-tokens',
          label: 'Tokens de API',
          icon: 'gateway',
          permission: 'api_tokens.read',
        },
        {
          path: 'administration/audit',
          label: 'Auditoría',
          icon: 'activity',
          permission: 'audit_logs.read',
        },
      ],
    },
  ];
  visible(item: NavItem) {
    return !item.permission || this.state.has(item.permission);
  }
  hasItems(items: NavItem[]) {
    return items.some((item) => this.visible(item));
  }
}
