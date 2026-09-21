import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  provideRouter,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthState, Identity } from './auth-state.service';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import {
  authenticatedGuard,
  permissionGuard,
  safeReturnUrl,
} from './auth.guards';
import { ApiService } from '../api/api.service';
import { testIdentity } from '../../../testing/auth-fixture';
describe('Web authentication and authorization', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let state: AuthState;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    state = TestBed.inject(AuthState);
  });
  afterEach(() => http.verify());
  it('uses the cookie endpoint with CSRF header and no Authorization token', async () => {
    const storageWrite = spyOn(Storage.prototype, 'setItem');
    const pending = auth.login({
      tenant_slug: 'qa-test',
      identifier: 'qa',
      password: 'test-only-password',
    });
    const request = http.expectOne('/v1/api/auth/web/login');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.headers.get('X-Novax-CSRF')).toBe('1');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({ data: testIdentity });
    await pending;
    expect(state.identity()?.account.username).toBe('qa-user');
    expect(storageWrite).not.toHaveBeenCalled();
  });
  it('coalesces session restoration and does not turn connectivity failure into a valid session', async () => {
    const one = auth.restore();
    const two = auth.restore();
    http.expectOne('/v1/api/auth/me').flush({ data: testIdentity });
    expect(await one).toBeTrue();
    expect(await two).toBeTrue();
    state.identity.set(null);
    const offline = auth.restore();
    http.expectOne('/v1/api/auth/me').error(new ProgressEvent('error'));
    await expectAsync(offline).toBeRejected();
    expect(state.identity()).toBeNull();
  });
  it('redirects anonymous visitors to login with their internal return route', async () => {
    const result = TestBed.runInInjectionContext(() =>
      authenticatedGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/app/account' } as RouterStateSnapshot,
      ),
    );
    http
      .expectOne('/v1/api/auth/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(
      TestBed.inject(Router).serializeUrl((await result) as any),
    ).toContain('/auth/login?returnUrl=');
  });
  it('requires the owner role as well as a permission for advanced settings', () => {
    state.identity.set({ ...testIdentity, roles: [] });
    const snapshot = new ActivatedRouteSnapshot();
    snapshot.data = { owner: true, permission: 'tenants.manage' };
    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(snapshot, {} as RouterStateSnapshot),
    );
    expect(TestBed.inject(Router).serializeUrl(result as any)).toBe(
      '/app/forbidden',
    );
  });
  it('refuses external return URLs', () => {
    for (const value of [
      'https://attacker.test',
      '//attacker.test',
      '/app\\evil',
      '/application',
    ])
      expect(safeReturnUrl(value)).toBe('/app/overview');
    expect(safeReturnUrl('/app/monitoring')).toBe('/app/monitoring');
  });
  it('invalidates expired sessions and only applies headers to our API', () => {
    state.identity.set(testIdentity);
    TestBed.inject(ApiService)
      .get('auth/me')
      .subscribe({ error: () => {} });
    http
      .expectOne('/v1/api/auth/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(state.identity()).toBeNull();
    TestBed.inject(HttpClient)
      .get('https://other.example.test/resource')
      .subscribe();
    const external = http.expectOne('https://other.example.test/resource');
    expect(external.request.withCredentials).toBeFalse();
    expect(external.request.headers.has('X-Novax-CSRF')).toBeFalse();
    external.flush({});
  });
  it('keeps the identity if logout fails, avoiding a false logout message', async () => {
    state.identity.set(testIdentity);
    const pending = auth.logout();
    http
      .expectOne('/v1/api/auth/logout')
      .flush({}, { status: 500, statusText: 'Failure' });
    await expectAsync(pending).toBeRejected();
    expect(state.identity()).not.toBeNull();
  });
});
