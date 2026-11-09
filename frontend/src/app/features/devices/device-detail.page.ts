import { EditorModal } from '../../shared/ui/editor-modal.component';
import { Toast } from '../../shared/ui/toast.service';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiService, Entity, errorMessage } from '../../core/api/api.service';
import { AuthState } from '../../core/auth/auth-state.service';
import { enumLabel } from '../../shared/ui/enum-label';
import { FormFocusDirective } from '../../shared/ui/form-focus.directive';
import { sensorPresets } from './sensor-presets';

@Component({
  imports: [EditorModal, RouterLink, ReactiveFormsModule, FormFocusDirective],
  templateUrl: './device-detail.page.html', styleUrl: './device-detail.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceDetailPage implements OnInit {
  private readonly toast = inject(Toast);
  private readonly api = inject(ApiService);
  readonly state = inject(AuthState);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private generation = 0;
  deviceId = '';
  readonly device = signal<Entity | null>(null);
  readonly sensors = signal<Entity[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly sensorError = signal('');
  readonly view = signal<'table' | 'cards'>('cards');
  readonly editor = signal(false);
  readonly selected = signal<Entity | null>(null);
  readonly total = signal(0);
  readonly pages = signal(0);
  readonly refreshed = signal<Date | null>(null);
  readonly enumLabel = enumLabel;
  readonly presets = sensorPresets;
  readonly preset = signal('');
  private sensorPath(sensor?: Entity) {
    const path = `iot/devices/${this.deviceId}/sensors`;
    return sensor ? `${path}/${sensor.external_id}` : path;
  }
  readonly labels: Record<string, string> = { code: 'Código', protocol: 'Protocolo', device_type: 'Tipo', manufacturer: 'Fabricante', model: 'Modelo', serial_number: 'Serie', firmware_version: 'Firmware' };
  page = 1;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)] }),
    key: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    metric: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)] }),
    unit: new FormControl('', { nonNullable: true, validators: Validators.maxLength(30) }),
    data_type: new FormControl('NUMBER', { nonNullable: true, validators: Validators.required }),
    minimum_value: new FormControl<number | null>(null),
    maximum_value: new FormControl<number | null>(null),
    sampling_interval_seconds: new FormControl<number | null>(null, [Validators.min(1), Validators.pattern(/^\d+$/)]),
  });
  ngOnInit() {
    this.destroy.onDestroy(() => this.generation++);
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      this.deviceId = params.get('deviceId') || '';
      this.page = 1; this.device.set(null); this.sensors.set([]); this.editor.set(false);
      this.form.reset(); void this.load();
    });
  }
  async load() {
    const generation = ++this.generation;
    this.loading.set(true); this.error.set(''); this.sensorError.set('');
    try {
      const device = await firstValueFrom(this.api.get(`iot/devices/${this.deviceId}`));
      if (generation !== this.generation) return;
      if (device.data['is_active'] === false) throw new Error('Dispositivo no disponible.');
      this.device.set(device.data);
      if (this.state.has('sensors.read')) {
        try {
          const result = await firstValueFrom(this.api.list(this.sensorPath(), {
            page: this.page, page_size: 12, is_active: true,
            sort_by: 'name', sort_dir: 'ASC',
            ...(this.state.has('measurements.read') ? { include_latest: true } : {}),
          }));
          if (generation !== this.generation) return;
          if (!result.data.length && this.page > 1 && result.pagination.total_pages < this.page) {
            this.page = Math.max(1, result.pagination.total_pages); await this.load(); return;
          }
          this.sensors.set(result.data.filter((sensor) => sensor['is_active'] !== false)); this.total.set(result.pagination.total); this.pages.set(result.pagination.total_pages);
          this.refreshed.set(new Date());
        } catch (error) { if (generation === this.generation) { this.sensors.set([]); this.toast.report(this.sensorError, 'error', errorMessage(error)); } }
      }
    } catch (error) { if (generation === this.generation) { this.device.set(null); this.toast.report(this.error, 'error', errorMessage(error)); } }
    finally { if (generation === this.generation) this.loading.set(false); }
  }
  canManage() { return this.state.has('sensors.manage') && !!this.device()?.['is_active']; }
  start(sensor: Entity | null = null) {
    if (!this.canManage() || !this.canLeave()) return;
    this.selected.set(sensor);
    this.preset.set('');
    this.form.reset({ name: sensor?.['name'] || '', key: sensor?.['key'] || '', metric: sensor?.['metric'] || '',
      unit: sensor?.['unit'] || '', data_type: sensor?.['data_type'] || 'NUMBER',
      minimum_value: sensor?.['minimum_value'] == null ? null : Number(sensor['minimum_value']),
      maximum_value: sensor?.['maximum_value'] == null ? null : Number(sensor['maximum_value']),
      sampling_interval_seconds: sensor?.['sampling_interval_seconds'] ?? null });
    this.editor.set(true);
  }
  applyPreset(id: string) {
    if (this.selected() || !this.canManage() || this.busy()) return;
    const preset = this.presets.find((item) => item.id === id);
    this.preset.set(preset ? id : '');
    if (!preset) return;
    if (this.form.dirty && !window.confirm('Aplicar esta plantilla reemplazará los campos del canal. ¿Continuar?')) {
      this.preset.set(''); return;
    }
    this.form.reset({ name: preset.name, key: preset.key, metric: preset.metric, unit: preset.unit, data_type: preset.data_type, minimum_value: null, maximum_value: null, sampling_interval_seconds: null });
    this.form.markAsDirty();
  }
  cancel() { if (this.canLeave()) { this.editor.set(false); this.form.markAsPristine(); } }
  async save() {
    if (!this.canManage() || this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    if (value.minimum_value != null && value.maximum_value != null && value.minimum_value > value.maximum_value) {
      this.toast.fire({ icon: 'error', text: 'El mínimo no puede superar al máximo.' }); return;
    }
    this.busy.set(true);
    const payload = { ...value, name: value.name.trim(), key: value.key.trim().toLowerCase(), metric: value.metric.trim().toLowerCase(), unit: value.unit.trim() || null };
    try {
      const sensor = this.selected();
      await firstValueFrom(sensor ? this.api.patch(this.sensorPath(sensor), payload) : this.api.post(this.sensorPath(), payload));
      this.form.markAsPristine(); this.editor.set(false); this.toast.fire({ icon: 'success', text: sensor ? 'Sensor actualizado.' : 'Sensor registrado en este dispositivo.' });
      await this.load();
    } catch (error) { this.toast.fire({ icon: 'error', text: errorMessage(error) }); }
    finally { this.busy.set(false); }
  }
  async toggle(sensor: Entity) {
    if (!this.canManage() || this.busy() || !this.canLeave() || !window.confirm(`Desactivar «${sensor['name']}»? El histórico se conserva.`)) return;
    this.busy.set(true); this.sensorError.set('');
    try {
      await firstValueFrom(this.api.patch(this.sensorPath(sensor), { is_active: false }));
      this.toast.fire({ icon: 'success', text: 'Estado del sensor actualizado.' }); await this.load();
    } catch (error) { this.toast.fire({ icon: 'error', text: errorMessage(error) }); }
    finally { this.busy.set(false); }
  }
  changePage(delta: number) { this.page += delta; void this.load(); }
  value(sensor: Entity) {
    const reading = sensor['latest_measurement'];
    if (!reading) return 'Sin mediciones';
    const value = reading.value;
    if (typeof value === 'boolean') return value ? 'Verdadero' : 'Falso';
    return typeof value === 'object' ? JSON.stringify(value) : `${value} ${reading.unit_snapshot ?? sensor['unit'] ?? ''}`.trim();
  }
  date(value: string | Date | null | undefined) {
    return value ? new Date(value).toLocaleString('es', { timeZone: this.state.identity()?.tenant?.timezone }) : 'Sin comunicación registrada';
  }
  canLeave() { return !this.state.identity() || (!this.busy() && (!this.editor() || !this.form.dirty || window.confirm('Hay cambios sin guardar en el sensor. ¿Quieres descartarlos?'))); }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.busy() || (this.editor() && this.form.dirty)) event.preventDefault();
  }
}
