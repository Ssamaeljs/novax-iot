import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BreadcrumbsComponent } from './breadcrumbs.component';
import { AuthState } from '../../core/auth/auth-state.service';
import { testIdentity } from '../../../testing/auth-fixture';
import { routes } from '../../app.routes';

@Component({ selector: 'test-breadcrumb-page', template: '<h1>Página de prueba</h1>' })
class Page {}
@Component({ selector: 'test-breadcrumb-shell', imports: [BreadcrumbsComponent, RouterOutlet], template: '<app-breadcrumbs /><router-outlet />' })
class Shell {}

describe('Shared workspace breadcrumbs', () => {
  const device = '11111111-1111-4111-8111-111111111111';
  beforeEach(() => {
    const pages: Routes = routes.find((route) => route.path === 'app')!.children!
      .filter((route) => !route.redirectTo)
      .map((route) => ({ path: route.path, data: route.data, component: Page }));
    pages.unshift({ path: 'draft', data: { breadcrumb: { label: 'Edición' } }, component: Page, canDeactivate: [() => false] });
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'app', component: Shell, children: pages }])] });
    TestBed.inject(AuthState).identity.set({ ...testIdentity, permissions: ['devices.read', 'projects.read'] });
  });
  function crumbs(harness: RouterTestingHarness) {
    return harness.fixture.nativeElement.querySelector('nav[aria-label="Ruta de navegación"]') as HTMLElement;
  }
  it('defines breadcrumb labels for every existing workspace page', () => {
    for (const route of routes.find((item) => item.path === 'app')!.children!) {
      if (route.redirectTo || route.path === '**') continue;
      expect(route.data?.['breadcrumb']?.label).withContext(route.path || '').toBeTruthy();
    }
  });
  it('shows a current page and working ancestor links from the device detail', async () => {
    const harness = await RouterTestingHarness.create(`/app/device/${device}`); harness.detectChanges();
    const nav = crumbs(harness);
    expect(nav.querySelectorAll('a').length).toBe(2);
    expect(nav.querySelector('a[href="/app/operations/devices"]')?.textContent).toBe('Dispositivos');
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Dispositivo');
    nav.querySelector<HTMLAnchorElement>('a[href="/app/operations/devices"]')!.click();
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/app/operations/devices');
    expect(crumbs(harness).querySelector('[aria-current="page"]')?.textContent).toBe('Dispositivos');
  });
  it('retains the originating device for reports and manual readings without printing UUIDs as labels', async () => {
    const harness = await RouterTestingHarness.create(`/app/monitoring?device=${device}&sensor=${device}`); harness.detectChanges();
    expect(crumbs(harness).querySelector(`a[href="/app/device/${device}"]`)).not.toBeNull();
    expect(crumbs(harness).textContent).not.toContain(device);
    await harness.navigateByUrl(`/app/operations/measurements?device=${device}`); harness.detectChanges();
    expect(crumbs(harness).querySelector('[aria-current="page"]')?.textContent).toBe('Medición manual');
    expect(crumbs(harness).querySelector(`a[href="/app/device/${device}"]`)).not.toBeNull();
  });
  it('does not expose inaccessible parent links or build paths from invalid context parameters', async () => {
    TestBed.inject(AuthState).identity.set({ ...testIdentity, permissions: [] });
    const harness = await RouterTestingHarness.create(`/app/monitoring?device=${device}`); harness.detectChanges();
    expect(crumbs(harness).querySelectorAll('a').length).toBe(1);
    await harness.navigateByUrl('/app/monitoring?device=https://example.test'); harness.detectChanges();
    expect(crumbs(harness).textContent).not.toContain('Dispositivo');
    expect(crumbs(harness).querySelectorAll('a').length).toBe(1);
  });
  it('covers project boards, administration, settings and not-found routes without dead group links', async () => {
    const harness = await RouterTestingHarness.create(`/app/projects/${device}`); harness.detectChanges();
    expect(crumbs(harness).querySelector('a[href="/app/projects"]')).not.toBeNull();
    for (const [path, label] of [['administration/roles', 'Roles'], ['integrations', 'Integraciones'], ['account', 'Mi cuenta'], ['settings', 'Configuración'], ['help', 'Guía de uso'], ['unknown', 'No encontrado']]) {
      await harness.navigateByUrl(`/app/${path}`); harness.detectChanges();
      expect(crumbs(harness).querySelector('[aria-current="page"]')?.textContent).toBe(label);
    }
    await harness.navigateByUrl('/app/advanced'); harness.detectChanges();
    expect(crumbs(harness).querySelector('a[href="/app/settings"]')).not.toBeNull();
    await harness.navigateByUrl('/app/overview'); harness.detectChanges();
    expect(crumbs(harness).querySelectorAll('a').length).toBe(0);
    expect(crumbs(harness).querySelectorAll('[aria-current="page"]').length).toBe(1);
  });
  it('uses router navigation so an unsaved-changes guard can cancel returning to a parent', async () => {
    const harness = await RouterTestingHarness.create('/app/draft'); harness.detectChanges();
    crumbs(harness).querySelector<HTMLAnchorElement>('a')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/app/draft');
  });
});
