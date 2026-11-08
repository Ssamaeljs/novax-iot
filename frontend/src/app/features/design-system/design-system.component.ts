import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent, IconName } from '../../shared/ui/icon.component';
import {
  IotStatus,
  StatusBadgeComponent,
} from '../../shared/ui/status-badge.component';
import { MonitoringOverviewComponent } from './monitoring-overview.component';
import { DevicePanelsComponent } from './device-panels.component';

interface SampleDevice {
  name: string;
  code: string;
  type: string;
  icon: IconName;
  protocol: string;
  location: string;
  status: IotStatus;
  reading: string;
}
const devices: readonly SampleDevice[] = [
  {
    name: 'Sensor ambiental',
    code: 'ESP32-SEC-01',
    type: 'Sensor',
    icon: 'sensor',
    protocol: 'MQTT',
    location: 'Secretaría · Planta 1',
    status: 'ONLINE',
    reading: '64.5 % HR',
  },
  {
    name: 'Cámara de acceso',
    code: 'CAM-ACC-01',
    type: 'Cámara',
    icon: 'camera',
    protocol: 'ONVIF',
    location: 'Acceso principal',
    status: 'ONLINE',
    reading: '1080p',
  },
  {
    name: 'Gateway principal',
    code: 'GW-CORE-01',
    type: 'Gateway',
    icon: 'gateway',
    protocol: 'HTTPS',
    location: 'Sala de servidores',
    status: 'ONLINE',
    reading: '24 ms',
  },
  {
    name: 'Sensor de temperatura',
    code: 'TEMP-LAB-02',
    type: 'Sensor',
    icon: 'sensor',
    protocol: 'MQTT',
    location: 'Laboratorio · Planta 2',
    status: 'WARNING',
    reading: '32.8 °C',
  },
  {
    name: 'Cámara de estacionamiento',
    code: 'CAM-PAR-03',
    type: 'Cámara',
    icon: 'camera',
    protocol: 'ONVIF',
    location: 'Estacionamiento',
    status: 'OFFLINE',
    reading: '—',
  },
  {
    name: 'Controlador de energía',
    code: 'PWR-SRV-01',
    type: 'Controlador',
    icon: 'device',
    protocol: 'HTTP',
    location: 'Sala de servidores',
    status: 'CRITICAL',
    reading: '246 V',
  },
  {
    name: 'Gateway de laboratorio',
    code: 'GW-LAB-02',
    type: 'Gateway',
    icon: 'gateway',
    protocol: 'HTTPS',
    location: 'Laboratorio',
    status: 'MAINTENANCE',
    reading: '—',
  },
  {
    name: 'Nodo de reserva',
    code: 'NODE-RES-01',
    type: 'Sensor',
    icon: 'device',
    protocol: 'MQTT',
    location: 'Bodega',
    status: 'UNKNOWN',
    reading: '—',
  },
];

@Component({
  selector: 'app-design-system',
  imports: [
    FormsModule,
    IconComponent,
    StatusBadgeComponent,
    MonitoringOverviewComponent,
    DevicePanelsComponent,
  ],
  templateUrl: './design-system.component.html',
  styleUrl: './design-system.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignSystemComponent {
  protected readonly statuses: IotStatus[] = [
    'ONLINE',
    'OFFLINE',
    'WARNING',
    'CRITICAL',
    'MAINTENANCE',
    'UNKNOWN',
  ];
  protected readonly search = signal('');
  protected readonly statusFilter = signal('');
  protected readonly page = signal(1);
  protected readonly tab = signal<'settings' | 'permissions'>('settings');
  protected readonly toast = signal('');
  protected readonly dialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('previewDialog');
  protected readonly filtered = computed(() =>
    devices.filter(
      (device) =>
        `${device.name} ${device.code} ${device.location}`
          .toLocaleLowerCase('es')
          .includes(this.search().toLocaleLowerCase('es')) &&
        (!this.statusFilter() || device.status === this.statusFilter()),
    ),
  );
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / 5)),
  );
  protected readonly visibleDevices = computed(() =>
    this.filtered().slice((this.page() - 1) * 5, this.page() * 5),
  );

  protected filterSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }
  protected filterStatus(value: string): void {
    this.statusFilter.set(value);
    this.page.set(1);
  }
  protected openDialog(): void {
    this.dialog().nativeElement.showModal();
  }
  protected closeDialog(): void {
    this.dialog().nativeElement.close();
  }
  protected closeDropdown(menu: HTMLDetailsElement): void {
    menu.open = false;
    menu.querySelector('summary')?.focus();
  }
  protected submitPreview(event: SubmitEvent): void {
    event.preventDefault();
    this.toast.set(
      'Validación completada. Esta vista utiliza datos de ejemplo.',
    );
  }
  protected changeTab(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    this.tab.set(
      event.key === 'Home'
        ? 'settings'
        : event.key === 'End'
          ? 'permissions'
          : this.tab() === 'settings'
            ? 'permissions'
            : 'settings',
    );
    const group = (event.target as HTMLElement).parentElement;
    group
      ?.querySelector<HTMLButtonElement>(`[id='tab-${this.tab()}']`)
      ?.focus();
  }
}
