import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '../../shared/ui/icon.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';

@Component({
  selector: 'app-device-panels',
  imports: [IconComponent, StatusBadgeComponent],
  templateUrl: './device-panels.component.html',
  styleUrl: './device-panels.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevicePanelsComponent {}
