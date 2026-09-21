import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AuthPage } from './features/auth/auth.page';
import { AuthState } from './core/auth/auth-state.service';
import { authInterceptor } from './core/auth/auth.interceptor';
import { testIdentity } from '../testing/auth-fixture';
import { ResourcePage } from './features/administration/resource.page';
import { ErrorPage } from './features/errors/error.page';
describe('Application routes and page contracts', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('has a real public landing and a router-driven 404', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Tu infraestructura.',
    );
    await harness.navigateByUrl('/unknown-page');
    expect(harness.routeNativeElement?.textContent).toContain(
      'No encontramos esta página',
    );
    expect(
      harness.routeNativeElement?.querySelector('a[href="/app/overview"]'),
    ).not.toBeNull();
  });
  it('shows disabled public registration explicitly instead of pretending signup succeeded', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/auth/register');
    http
      .expectOne('/v1/api/auth/capabilities')
      .flush({
        data: { registration_enabled: false, password_recovery_enabled: false },
      });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain(
      'registro público aún no está habilitado',
    );
    expect(
      harness.routeNativeElement?.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      )?.disabled,
    ).toBeTrue();
  });
  it('keeps invalid login visible and sends the exact backend contract', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/auth/login');
    http
      .expectOne('/v1/api/auth/capabilities')
      .flush({
        data: { registration_enabled: false, password_recovery_enabled: false },
      });
    const form = harness.routeNativeElement!.querySelector('form')!;
    const fill = (selector: string, value: string) => {
      const input = form.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    fill('[autocomplete="organization"]', 'qa-test');
    fill('[autocomplete="username"]', 'qa-user');
    fill('[autocomplete="current-password"]', 'test-only-password');
    form.dispatchEvent(new Event('submit'));
    const request = http.expectOne('/v1/api/auth/web/login');
    expect(request.request.body).toEqual({
      tenant_slug: 'qa-test',
      identifier: 'qa-user',
      password: 'test-only-password',
    });
    request.flush(
      { error: 'Credenciales inválidas' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain(
      'Credenciales inválidas',
    );
    expect(TestBed.inject(Router).url).toBe('/auth/login');
  });
  it('protects advanced routes even when a non-owner types the URL directly', async () => {
    TestBed.inject(AuthState).identity.set({ ...testIdentity, roles: [] });
    const harness = await RouterTestingHarness.create('/app/advanced');
    expect(TestBed.inject(Router).url).toBe('/app/forbidden');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Acceso restringido',
    );
  });
  for (const [key, endpoint] of [
    ['users', 'core/users'],
    ['accounts', 'core/accounts'],
    ['roles', 'iam/roles'],
    ['permissions', 'iam/permissions'],
    ['api-tokens', 'iam/api-tokens'],
    ['audit', 'audit/logs'],
  ]) {
    it(`loads ${key} from its scoped backend endpoint`, async () => {
      TestBed.inject(AuthState).identity.set(testIdentity);
      const harness = await RouterTestingHarness.create(
        `/app/administration/${key}`,
      );
      http
        .expectOne((request) => request.url === `/v1/api/${endpoint}`)
        .flush({
          data: [],
          pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
        });
      harness.detectChanges();
      expect(harness.routeNativeElement?.textContent).toContain(
        'Aún no hay registros',
      );
      expect(
        harness.routeNativeElement?.querySelector(
          '.sidebar a[aria-current="page"]',
        ),
      ).not.toBeNull();
    });
  }
});
