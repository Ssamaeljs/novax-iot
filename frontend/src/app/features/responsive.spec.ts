import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api/api.service';
import { AuthState } from '../core/auth/auth-state.service';
import { testIdentity } from '../../testing/auth-fixture';
import { AuthService } from '../core/auth/auth.service';
import { ResourcePage } from './administration/resource.page';
import { MonitoringPage } from './monitoring/monitoring.page';
import { OverviewPage } from './overview/overview.page';
import { NavbarComponent } from '../shared/layout/navbar.component';
import { ProjectBoardPage } from './projects/project-board.page';
import { ProjectApi } from './projects/project-api.service';
import { IntegrationsPage } from './integrations/integrations.page';
import { DeviceDetailPage } from './devices/device-detail.page';
import { BreadcrumbsComponent } from '../shared/layout/breadcrumbs.component';

const page = (data: unknown[] = []) => ({ data, pagination: { page: 1, page_size: 20, total: data.length, total_pages: data.length ? 1 : 0 } });
const sensorId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const sensor = { external_id: sensorId, name: 'Humedad Secretaría', metric: 'humidity', unit: '%', data_type: 'NUMBER', is_active: true };

// Real browser layout in same-origin frames: media queries use each requested viewport.
// Not a simulation via classes and not a substitute for physical-device acceptance.
async function viewport(fixture: ComponentFixture<unknown>, width: number, theme = 'light') {
  const frame = document.createElement('iframe'); frame.className = 'responsive-test-frame';
  frame.style.cssText = `position:fixed;inset:0 auto auto 0;width:${width}px;height:900px;border:0;z-index:9999`;
  document.body.append(frame);
  const doc = frame.contentDocument!;
  doc.documentElement.setAttribute('data-theme', theme);
  const loaded: Promise<void>[] = [];
  for (const source of Array.from(document.head.querySelectorAll('style,link[rel="stylesheet"]'))) {
    const clone = source.cloneNode(true) as HTMLStyleElement | HTMLLinkElement;
    if (clone instanceof HTMLLinkElement) loaded.push(new Promise((resolve, reject) => { clone.onload = () => resolve(); clone.onerror = () => reject(new Error('No se pudo cargar CSS en la prueba responsive')); }));
    doc.head.append(clone);
  }
  doc.body.append(fixture.nativeElement);
  await Promise.all(loaded);
  await new Promise<void>((resolve) => frame.contentWindow!.requestAnimationFrame(() => resolve()));
  return { doc, window: frame.contentWindow!, frame };
}

describe('Responsive operational screens', () => {
  let api: { list: jasmine.Spy; options: jasmine.Spy; get: jasmine.Spy };
  let projects: { board: jasmine.Spy; telemetry: jasmine.Spy };
  beforeEach(() => {
    api = { list: jasmine.createSpy().and.returnValue(of(page([{ external_id: 'public', name: 'Equipo Secretaría', code: 'DEV-' + 'A'.repeat(32), device_type: 'ESP32', protocol: 'MQTT', status: 'ONLINE', is_active: true }]))), options: jasmine.createSpy().and.resolveTo([sensor]), get: jasmine.createSpy().and.returnValue(of({ data: { enabled: false } })) };
    projects = { board: jasmine.createSpy(), telemetry: jasmine.createSpy().and.resolveTo({ series: [] }) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ApiService, useValue: api }, { provide: ProjectApi, useValue: projects }, { provide: AuthService, useValue: { logout: async () => {} } }, { provide: ActivatedRoute, useValue: { data: of({ resource: 'devices' }), paramMap: of(convertToParamMap({ external_id: projectId })) } }] });
    TestBed.inject(AuthState).identity.set({ ...testIdentity, permissions: [...testIdentity.permissions, 'devices.read', 'devices.manage', 'sensors.read', 'measurements.read', 'projects.read'] });
  });
  afterEach(() => document.querySelectorAll('.responsive-test-frame').forEach((frame) => frame.remove()));
  for (const theme of ['light', 'dark']) it(`320px ${theme}: contextual breadcrumbs wrap and retain the device return link`, async () => {
    const router = TestBed.inject(Router);
    router.resetConfig([{ path: 'app/operations/measurements', component: OverviewPage, data: { breadcrumb: { label: 'Medición manual', deviceContext: true } } }]);
    await router.navigateByUrl(`/app/operations/measurements?device=${projectId}`);
    const fixture = TestBed.createComponent(BreadcrumbsComponent); fixture.detectChanges();
    const view = await viewport(fixture, 320, theme);
    expect(view.doc.documentElement.scrollWidth).toBeLessThanOrEqual(321);
    expect(view.doc.querySelector(`a[href="/app/device/${projectId}"]`)).not.toBeNull();
    expect(view.doc.querySelectorAll('[aria-current="page"]').length).toBe(1); fixture.destroy();
  });
  for (const theme of ['light', 'dark']) for (const mode of ['table', 'cards'] as const) it(`360px ${theme}: device ${mode} view and sensor editor remain usable`, async () => {
    api.get.and.returnValue(of({ data: { external_id: projectId, name: 'Secretaría ESP32', protocol: 'HTTPS', is_active: true, status: 'ONLINE' } }));
    api.list.and.returnValue(of(page([{ ...sensor, latest_measurement: { value: 0, quality: 'GOOD', observed_at: '2026-10-18T12:00:00Z' } }])));
    TestBed.inject(AuthState).identity.set({ ...testIdentity, permissions: ['devices.read', 'sensors.read', 'sensors.manage', 'measurements.read', 'measurements.write'] });
    const fixture = TestBed.createComponent(DeviceDetailPage); fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.view.set(mode); fixture.componentInstance.start(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const view = await viewport(fixture, 360, theme);
    expect(view.doc.documentElement.scrollWidth).toBeLessThanOrEqual(361);
    expect(view.window.getComputedStyle(view.doc.querySelector('.device-layout')!).gridTemplateColumns.split(' ').length).toBe(1);
    expect(view.doc.querySelector('button[type="submit"]')?.textContent).toContain('Guardar sensor');
    expect(view.doc.body.textContent).toContain('0 %'); fixture.destroy();
  });
  for (const theme of ['light', 'dark']) for (const mode of ['profiles', 'sources']) it(`360px ${theme}: integration ${mode} editor stays operable without page overflow`, async () => {
    api.options.and.callFake(async (path: string) => path === 'iot/devices' ? [{ external_id: projectId, name: 'ESP32', protocol: 'HTTPS' }] : []);
    api.list.and.returnValue(of(page()));
    TestBed.inject(AuthState).identity.set({ ...testIdentity, permissions: ['integrations.read', 'integrations.manage', 'devices.read'] });
    const fixture = TestBed.createComponent(IntegrationsPage); fixture.detectChanges(); await fixture.whenStable();
    if (mode === 'profiles') fixture.componentInstance.startProfile(); else fixture.componentInstance.startSource();
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const view = await viewport(fixture, 360, theme);
    expect(view.doc.documentElement.scrollWidth).toBeLessThanOrEqual(361);
    expect(view.doc.querySelector('form .button--primary')).not.toBeNull();
    if (mode === 'profiles') expect(view.window.getComputedStyle(view.doc.querySelector('.mapping-fields')!).gridTemplateColumns.split(' ').length).toBe(1);
    fixture.destroy();
  });

  for (const theme of ['light', 'dark']) for (const width of [320, 360, 390, 768, 1280]) {
    it(`${theme} ${width}px: catalog keeps data, labels and actions without page overflow`, async () => {
      const fixture = TestBed.createComponent(ResourcePage); fixture.detectChanges();
      const view = await viewport(fixture, width, theme);
      expect(view.doc.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
      const table = view.doc.querySelector('table')!;
      expect(view.window.getComputedStyle(table).display).toBe(width <= 600 ? 'block' : 'table');
      for (const cell of Array.from(table.querySelectorAll('td'))) expect(cell.getAttribute('data-label')).toBeTruthy();
      const actions = view.doc.querySelector('.row-actions') as HTMLElement;
      expect(actions.textContent).toContain('Editar'); expect(actions.getBoundingClientRect().right).toBeLessThanOrEqual(width + 1);
      if (width <= 600) expect(view.window.getComputedStyle(view.doc.querySelector('.table-scroll')!).maxHeight).toBe('none');
      fixture.destroy();
    });
  }
  it('360px: modal actions remain sticky and inputs avoid automatic focus zoom', async () => {
    const fixture = TestBed.createComponent(ResourcePage); fixture.detectChanges();
    const view = await viewport(fixture, 360); await fixture.componentInstance.open('create'); fixture.detectChanges();
    const dialog = view.doc.querySelector('dialog')!;
    expect(dialog.open).toBeTrue(); expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(360);
    expect(view.window.getComputedStyle(view.doc.querySelector('.dialog-actions')!).position).toBe('sticky');
    expect(parseFloat(view.window.getComputedStyle(view.doc.querySelector('#resource-name')!).fontSize)).toBeGreaterThanOrEqual(16);
    fixture.destroy();
  });
  it('320px: header keeps user and theme controls reachable in one compact row', async () => {
    const fixture = TestBed.createComponent(NavbarComponent); fixture.componentRef.setInput('workspace', true); fixture.detectChanges();
    const view = await viewport(fixture, 320);
    expect(view.doc.documentElement.scrollWidth).toBeLessThanOrEqual(321);
    expect(view.doc.querySelector('header')!.getBoundingClientRect().height).toBeLessThan(100);
    expect(view.doc.querySelector('[aria-label="Opciones de usuario"]')).not.toBeNull();
    expect(view.doc.querySelectorAll('[data-preference]').length).toBe(3); fixture.destroy();
  });
  it('360px: measurement filters stack and every reading keeps all four labels', async () => {
    api.list.and.returnValue(of(page([{ external_id: 'measurement', sensor, device: { name: 'ESP32' }, observed_at: '2026-10-18T12:00:00Z', value: 70, quality: 'GOOD' }])));
    const fixture = TestBed.createComponent(MonitoringPage); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const view = await viewport(fixture, 360);
    expect(view.doc.documentElement.scrollWidth).toBeLessThanOrEqual(361);
    expect(view.window.getComputedStyle(view.doc.querySelector('.filters')!).display).toBe('grid');
    expect(Array.from(view.doc.querySelectorAll('td')).map((cell) => cell.getAttribute('data-label'))).toEqual(['Fecha', 'Dispositivo / sensor', 'Valor', 'Calidad']); fixture.destroy();
  });
  it('360px: overview places operational shortcuts before metrics and guidance', async () => {
    const fixture = TestBed.createComponent(OverviewPage); fixture.detectChanges();
    const view = await viewport(fixture, 360);
    const actions = view.doc.querySelector('.operational-actions')!;
    expect(actions.compareDocumentPosition(view.doc.querySelector('.metrics')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(view.doc.documentElement.scrollWidth).toBeLessThanOrEqual(361); fixture.destroy();
  });
  for (const width of [360, 768]) it(`${width}px: board presents readings before configuration and preserves stored geometry`, async () => {
    const layout = { x: 0, y: 0, width: 4, height: 5, locked: true };
    projects.board.and.resolveTo({ project: { external_id: projectId, title: 'Secretaría', code: 'PRJ-TEST', version: 0, is_active: true }, version: 0, widgets: [{ external_id: sensorId, title: 'Humedad', type: 'GAUGE', layout, settings: {}, sensors: [sensor], sensor_external_ids: [sensorId] }] });
    const fixture = TestBed.createComponent(ProjectBoardPage); fixture.detectChanges(); await fixture.whenStable(); fixture.componentInstance.sidebar.set(true); fixture.detectChanges();
    const view = await viewport(fixture, width);
    const canvas = view.doc.querySelector('.board-canvas')!; const panel = view.doc.querySelector('.widget-sidebar')!;
    expect(view.window.getComputedStyle(canvas).display).toBe('flex');
    expect(panel.getBoundingClientRect().top).toBeGreaterThanOrEqual(canvas.getBoundingClientRect().bottom);
    expect(fixture.componentInstance.widgets()[0].layout).toEqual(layout); expect(fixture.componentInstance.dirty()).toBeFalse();
    expect(view.doc.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1); fixture.destroy();
  });
});
