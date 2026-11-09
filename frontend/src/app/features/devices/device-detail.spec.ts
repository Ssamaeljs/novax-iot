import { Toast } from '../../shared/ui/toast.service';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DeviceDetailPage } from './device-detail.page';
import { ApiService } from '../../core/api/api.service';
import { AuthState } from '../../core/auth/auth-state.service';
import { testIdentity } from '../../../testing/auth-fixture';
import { MeasurementEntryPage } from '../operations/measurement-entry.page';
import { MonitoringPage } from '../monitoring/monitoring.page';

const deviceId = '11111111-1111-4111-8111-111111111111';
const sensorId = '22222222-2222-4222-8222-222222222222';
const device = { external_id: deviceId, name: 'ESP32 Secretaría', protocol: 'HTTPS', status: 'ONLINE', is_active: true };
const sensor = { external_id: sensorId, name: 'Humedad', key: 'humidity', metric: 'humidity', unit: '%', data_type: 'NUMBER', is_active: true, latest_measurement: { value: 0, observed_at: '2026-10-18T12:00:00Z', quality: 'GOOD' } };
describe('Device operational detail', () => {
  let api: { get: jasmine.Spy; list: jasmine.Spy; post: jasmine.Spy; patch: jasmine.Spy; options: jasmine.Spy };
  beforeEach(() => {
    api = {
      get: jasmine.createSpy().and.returnValue(of({ data: device })),
      list: jasmine.createSpy().and.returnValue(of({ data: [sensor], pagination: { total: 1, total_pages: 1 } })),
      post: jasmine.createSpy().and.returnValue(of({ data: sensor })), patch: jasmine.createSpy().and.returnValue(of({ data: sensor })),
      options: jasmine.createSpy().and.resolveTo([sensor]),
    };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ApiService, useValue: api }, { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ deviceId })), snapshot: { queryParamMap: convertToParamMap({ device: deviceId, sensor: sensorId }) } } }] });
    TestBed.inject(AuthState).identity.set({ ...testIdentity, permissions: ['devices.read', 'sensors.read', 'sensors.manage', 'measurements.read', 'measurements.write'] });
  });
  async function detail() {
    const fixture = TestBed.createComponent(DeviceDetailPage); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); return fixture;
  }
  it('loads a paginated device scope and shows zero rather than an empty value', async () => {
    const fixture = await detail();
    expect(api.list.calls.mostRecent().args[0]).toBe(`iot/devices/${deviceId}/sensors`);
    expect(api.list.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ include_latest: true, page_size: 12 }));
    expect(fixture.nativeElement.textContent).toContain('0 %');
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain(device.name);
    expect(fixture.componentInstance.value({ ...sensor, latest_measurement: { value: false } })).toBe('Falso');
    fixture.componentInstance.view.set('table'); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('.operational-table')).not.toBeNull(); fixture.destroy();
  });
  it('opens the sensor editor as a modal and closes with Escape', async () => {
    const fixture = await detail();
    fixture.componentInstance.start(sensor);
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBeTrue();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    fixture.destroy();
  });

  it('filters disabled channels and requests active-only pagination', async () => {
    api.list.and.returnValue(of({ data: [sensor, { ...sensor, external_id: 'inactive', name: 'Canal desactivado', is_active: false }], pagination: { total: 1, total_pages: 1 } }));
    const fixture = await detail();
    expect(api.list.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ is_active: true }));
    expect(fixture.componentInstance.sensors()).toEqual([sensor]);
    expect(fixture.nativeElement.textContent).not.toContain('Canal desactivado');
    fixture.destroy();
  });

  it('creates a sensor with the device fixed by route and no inventory code', async () => {
    const fixture = await detail(); const component = fixture.componentInstance; component.start();
    component.form.patchValue({ name: 'Temperatura', key: 'temp', metric: 'temperature', unit: '°C' });
    await component.save();
    expect(api.post.calls.mostRecent().args).toEqual([`iot/devices/${deviceId}/sensors`, jasmine.objectContaining({ key: 'temp', name: 'Temperatura', data_type: 'NUMBER' })]);
    expect(api.post.calls.mostRecent().args[1].device_external_id).toBeUndefined();
    expect(api.post.calls.mostRecent().args[1].code).toBeUndefined(); expect(component.editor()).toBeFalse(); fixture.destroy();
  });
  it('edits through the existing sensor endpoint without reassigning its device', async () => {
    const fixture = await detail(); fixture.componentInstance.start(sensor); fixture.componentInstance.form.controls.name.setValue('Humedad ambiente');
    await fixture.componentInstance.save();
    expect(api.patch.calls.mostRecent().args[0]).toBe(`iot/devices/${deviceId}/sensors/${sensorId}`); expect(api.patch.calls.mostRecent().args[1].device_external_id).toBeUndefined(); fixture.destroy();
  });
  it('preserves edits and exposes validation failures instead of closing the editor', async () => {
    const fixture = await detail(); const component = fixture.componentInstance; component.start(sensor);
    component.form.patchValue({ minimum_value: 10, maximum_value: 0 }); await component.save(); expect(api.patch).not.toHaveBeenCalled();
    component.form.patchValue({ minimum_value: null, maximum_value: null }); api.patch.and.returnValue(throwError(() => new Error('Sensor con histórico')));
    await component.save(); expect(component.editor()).toBeTrue(); expect(TestBed.inject(Toast).messages()).toContain(jasmine.objectContaining({ icon: 'error', text: 'Sensor con histórico' })); fixture.destroy();
  });
  it('does not request measurements or offer mutations to a sensor-only reader', async () => {
    TestBed.inject(AuthState).identity.set({ ...testIdentity, permissions: ['devices.read', 'sensors.read'] });
    const fixture = await detail(); expect(api.list.calls.mostRecent().args[1].include_latest).toBeUndefined();
    expect(fixture.nativeElement.textContent).not.toContain('Añadir sensor'); expect(fixture.nativeElement.textContent).not.toContain('Añadir medición manual');
    fixture.componentInstance.start(); await fixture.componentInstance.save(); expect(api.post).not.toHaveBeenCalled(); fixture.destroy();
  });
  it('asks before deactivating and retains historical measurements', async () => {
    const fixture = await detail(); const confirm = spyOn(window, 'confirm').and.returnValue(false);
    await fixture.componentInstance.toggle(sensor); expect(api.patch).not.toHaveBeenCalled(); confirm.and.returnValue(true);
    await fixture.componentInstance.toggle(sensor); expect(api.patch.calls.mostRecent().args).toEqual([`iot/devices/${deviceId}/sensors/${sensorId}`, { is_active: false }]); fixture.destroy();
  });
  it('protects dirty edits and synchronizes by reading rather than issuing a device command', async () => {
    const fixture = await detail(); const component = fixture.componentInstance; component.start(sensor); component.form.markAsDirty();
    spyOn(window, 'confirm').and.returnValue(false); expect(component.canLeave()).toBeFalse();
    await component.load(); expect(component.form.dirty).toBeTrue(); expect(api.post).not.toHaveBeenCalled(); fixture.destroy();
  });
  it('prefills a manual measurement with the selected sensor and scoped device', async () => {
    const fixture = TestBed.createComponent(MeasurementEntryPage); fixture.detectChanges(); await fixture.whenStable();
    expect(api.options).toHaveBeenCalledWith('iot/sensors', { is_active: true, device_external_id: deviceId });
    expect(fixture.componentInstance.selected()?.external_id).toBe(sensorId); fixture.destroy();
  });
  it('opens reports using both sensor and device filters', async () => {
    const fixture = TestBed.createComponent(MonitoringPage); fixture.detectChanges(); await fixture.whenStable();
    expect(api.list.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ sensor_external_id: sensorId, device_external_id: deviceId })); fixture.destroy();
  });
  it('does not show unrelated sensors if the scoped query fails', async () => {
    api.list.and.returnValue(throwError(() => new Error('Sin acceso')));
    const fixture = await detail(); expect(fixture.componentInstance.sensors()).toEqual([]); expect(fixture.componentInstance.sensorError()).toBe('Sin acceso'); fixture.destroy();
  });
  it('offers DHT11 channels independently while keeping their common device implicit', async () => {
    const fixture = await detail(); const component = fixture.componentInstance;
    component.start(); component.applyPreset('dht11-temperature');
    expect(component.form.getRawValue()).toEqual(jasmine.objectContaining({ key: 'dht11_temperature', metric: 'temperature', unit: '°C', data_type: 'NUMBER' }));
    expect(component.form.dirty).toBeTrue();
    await component.save();
    component.start(); component.applyPreset('dht11-humidity'); await component.save();
    expect(api.post.calls.allArgs().map((args) => args[0])).toEqual([`iot/devices/${deviceId}/sensors`, `iot/devices/${deviceId}/sensors`]);
    expect(api.post.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ key: 'dht11_humidity', metric: 'humidity', unit: '%' })); fixture.destroy();
  });
  it('does not replace existing readings or dirty form values through presets', async () => {
    const fixture = await detail(); const component = fixture.componentInstance;
    component.start(sensor); component.applyPreset('dht11-temperature'); expect(component.form.controls.key.value).toBe('humidity');
    component.cancel(); component.start(); component.form.controls.name.setValue('Mi sensor'); component.form.markAsDirty();
    spyOn(window, 'confirm').and.returnValue(false); component.applyPreset('dht11-humidity');
    expect(component.form.controls.name.value).toBe('Mi sensor'); expect(api.post).not.toHaveBeenCalled(); fixture.destroy();
  });
});
