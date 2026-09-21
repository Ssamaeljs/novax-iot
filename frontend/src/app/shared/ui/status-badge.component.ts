import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconComponent, IconName } from './icon.component';

export type IotStatus =
  | 'ONLINE'
  | 'OFFLINE'
  | 'WARNING'
  | 'CRITICAL'
  | 'MAINTENANCE'
  | 'UNKNOWN';
const statuses: Record<IotStatus, { label: string; icon: IconName }> = {
  ONLINE: { label: 'En línea', icon: 'check' },
  OFFLINE: { label: 'Sin conexión', icon: 'offline' },
  WARNING: { label: 'Advertencia', icon: 'warning' },
  CRITICAL: { label: 'Crítico', icon: 'critical' },
  MAINTENANCE: { label: 'Mantenimiento', icon: 'tool' },
  UNKNOWN: { label: 'Desconocido', icon: 'help' },
};
@Component({
  selector: 'app-status-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="badge"
    [attr.data-status]="status()"
    [attr.title]="status()"
    ><app-icon [name]="definition().icon" />{{ definition().label }}</span
  >`,
})
export class StatusBadgeComponent {
  readonly status = input<IotStatus>('UNKNOWN');
  protected readonly definition = computed(
    () => statuses[this.status()] ?? statuses.UNKNOWN,
  );
}
