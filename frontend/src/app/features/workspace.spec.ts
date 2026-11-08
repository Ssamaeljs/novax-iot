import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ResourcePage } from './administration/resource.page';
import { WorkspaceLayoutComponent } from '../layouts/workspace-layout.component';
import { AuthState } from '../core/auth/auth-state.service';
import { testIdentity } from '../../testing/auth-fixture';
import { MeasurementChartComponent } from '../shared/ui/measurement-chart.component';
import { By } from '@angular/platform-browser';
import { NavigationComponent } from '../shared/layout/navigation.component';
const page = (rows: unknown[], total = rows.length) => ({
  data: rows,
  pagination: {
    page: 1,
    page_size: 20,
    total,
    total_pages: Math.ceil(total / 20),
  },
});
describe('Workspace components', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { data: of({ resource: 'devices' }) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthState).identity.set(testIdentity);
  });
  afterEach(() => http.verify());
  it('shares real router navigation and closes the mobile dialog after selection', async () => {
    const fixture = TestBed.createComponent(WorkspaceLayoutComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root
      .querySelector<HTMLButtonElement>('[aria-label="Abrir navegación"]')!
      .click();
    fixture.detectChanges();
    const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
    expect(dialog.open).toBeTrue();
    const link = dialog.querySelector<HTMLAnchorElement>(
      'a[href="/app/operations/devices"]',
    )!;
    // Prevent the empty test router from navigating, while checking the component's selection handler.
    link.addEventListener('click', (event) => event.preventDefault());
    expect(link.getAttribute('href')).toBe('/app/operations/devices');
    const mobileNav = fixture.debugElement.queryAll(
      By.directive(NavigationComponent),
    )[1].componentInstance as NavigationComponent;
    mobileNav.selected.emit();
    fixture.detectChanges();
    expect(dialog.open).toBeFalse();
    fixture.destroy();
  });
  it('only exposes advanced menu options to TENANT_OWNER', () => {
    const fixture = TestBed.createComponent(WorkspaceLayoutComponent);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('a[href="/app/advanced"]'),
    ).not.toBeNull();
    TestBed.inject(AuthState).identity.set({ ...testIdentity, roles: [] });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('a[href="/app/advanced"]'),
    ).toBeNull();
    fixture.destroy();
  });
  for (const theme of ['light', 'dark'])
    it(`${theme}: paginated CRUD uses backend data, public IDs and semantic table surfaces`, async () => {
      const original = document.documentElement.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', theme);
      const fixture = TestBed.createComponent(ResourcePage);
      fixture.detectChanges();
      const request = http.expectOne(
        (req) => req.url === '/v1/api/iot/devices',
      );
      expect(request.request.params.get('page_size')).toBe('20');
      request.flush(
        page([
          {
            external_id: 'device-public',
            name: 'ESP32 Secretaría',
            code: 'ESP-01',
            device_type: 'ESP32',
            protocol: 'MQTT',
            status: 'ONLINE',
            is_active: true,
          },
        ]),
      );
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).toContain('ESP32 Secretaría');
      expect(getComputedStyle(root.querySelector('th')!).position).toBe(
        'sticky',
      );
      await fixture.componentInstance.open(
        'edit',
        fixture.componentInstance.rows()[0],
      );
      fixture.detectChanges();
      fixture.componentInstance.form.controls['name'].setValue(
        'ESP32 actualizado',
      );
      const save = fixture.componentInstance.save();
      const update = http.expectOne('/v1/api/iot/devices/device-public');
      expect(update.request.method).toBe('PATCH');
      expect(update.request.body.id).toBeUndefined();
      update.flush({ data: { external_id: 'device-public' } });
      await save;
      http
        .expectOne((req) => req.url === '/v1/api/iot/devices')
        .flush(page([]));
      fixture.detectChanges();
      expect(root.textContent).toContain('Cambios guardados');
      fixture.destroy();
      if (original)
        document.documentElement.setAttribute('data-theme', original);
      else document.documentElement.removeAttribute('data-theme');
    });
  it('renders API failures as errors rather than fake empty data', () => {
    const fixture = TestBed.createComponent(ResourcePage);
    fixture.detectChanges();
    http
      .expectOne((req) => req.url === '/v1/api/iot/devices')
      .flush({}, { status: 503, statusText: 'Offline' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se pudo conectar');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Aún no hay registros',
    );
    fixture.destroy();
  });
  it('charts support negative values and physical units instead of fixed percentages', () => {
    const fixture = TestBed.createComponent(MeasurementChartComponent);
    fixture.componentRef.setInput('points', [
      { at: '10:00', value: -20 },
      { at: '10:05', value: 120 },
    ]);
    fixture.componentRef.setInput('unit', '°C');
    fixture.detectChanges();
    expect(fixture.componentInstance.domain().min).toBeLessThan(-20);
    expect(fixture.componentInstance.domain().max).toBeGreaterThan(120);
    expect(fixture.nativeElement.textContent).toContain('°C');
    fixture.destroy();
  });
});
