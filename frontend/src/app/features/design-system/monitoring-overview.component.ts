import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '../../shared/ui/icon.component';
import { TelemetryChartComponent } from '../../shared/ui/telemetry-chart.component';

@Component({
  selector: 'app-monitoring-overview',
  imports: [IconComponent, TelemetryChartComponent],
  templateUrl: './monitoring-overview.component.html',
  styleUrl: './monitoring-overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitoringOverviewComponent {
  protected readonly telemetry = [
    { label: '00:00', value: 42, reference: 60 },
    { label: '04:00', value: 47, reference: 60 },
    { label: '08:00', value: 44, reference: 60 },
    { label: '12:00', value: 65, reference: 60 },
    { label: '16:00', value: 57, reference: 60 },
    { label: '20:00', value: 72, reference: 60 },
    { label: '23:00', value: 64.5, reference: 60 },
  ];
}
