import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { IntegrationsPage } from './integrations.page';
import { ProfileEditorComponent } from './profile-editor.component';
import { ApiService } from '../../core/api/api.service';
import { AuthState } from '../../core/auth/auth-state.service';
import { testIdentity } from '../../../testing/auth-fixture';
import { Profile } from './integration.models';
const profile: Profile = { external_id: '11111111-1111-4111-8111-111111111111', name: 'ESP humidity', code: 'PRF-TEST', version: 1, is_active: true, mappings: [{ path: 'rh', sensor_key: 'humidity', metric: 'humidity', unit: '%', source_unit: 'ratio', data_type: 'NUMBER', scale: 100, offset: 0, required: true }] };
const source = { external_id: '22222222-2222-4222-8222-222222222222', name: 'Secretaría', is_active: true, transport: 'HTTPS', device: { external_id: 'device', name: 'ESP32' }, profile, https_path: '/v1/api/ingest/https/source' };

describe('Integration administration', () => {
  let api: { options: jasmine.Spy; list: jasmine.Spy; get: jasmine.Spy; post: jasmine.Spy; patch: jasmine.Spy };
  beforeEach(() => {
    api = {
      options: jasmine.createSpy().and.callFake(async (path: string) => path.endsWith('profiles') ? [profile] : path.endsWith('sources') ? [source] : [{ external_id: 'device', name: 'ESP32', protocol: 'HTTPS' }]),
      list: jasmine.createSpy().and.returnValue(of({ data: [], pagination: { total_pages: 0 } })),
      get: jasmine.createSpy().and.returnValue(of({ data: { enabled: false, connected: false, subscription_ready: false } })),
      post: jasmine.createSpy().and.returnValue(of({ data: {} })), patch: jasmine.createSpy().and.returnValue(of({ data: {} })),
    };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ApiService, useValue: api }] });
    TestBed.inject(AuthState).identity.set({ ...testIdentity, permissions: [...testIdentity.permissions, 'integrations.read', 'integrations.manage', 'devices.read'] });
  });
  it('loads operational sources and reports disabled MQTT without pretending it is connected', async () => {
    const fixture = TestBed.createComponent(IntegrationsPage); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Secretaría'); expect(fixture.nativeElement.textContent).toContain('Deshabilitado en servidor');
    expect(fixture.nativeElement.textContent).not.toContain('Suscrito al broker'); fixture.destroy();
  });
  it('publishes a new version through the dedicated endpoint without overwriting the original profile', async () => {
    const fixture = TestBed.createComponent(IntegrationsPage); fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.startProfile(profile); fixture.detectChanges(); await fixture.whenStable();
    await fixture.componentInstance.publish({ name: 'Version 2', description: '', mappings: profile.mappings });
    expect(api.post.calls.mostRecent().args[0]).toBe(`integrations/profiles/${profile.external_id}/versions`);
    expect(profile.version).toBe(1); expect(api.patch).not.toHaveBeenCalled(); fixture.destroy();
  });
  it('keeps a generated source credential only in memory and labels the owning source', async () => {
    const fixture = TestBed.createComponent(IntegrationsPage); fixture.detectChanges(); await fixture.whenStable();
    const component = fixture.componentInstance; component.startSource(); fixture.detectChanges(); await fixture.whenStable();
    component.sourceName = 'Nueva fuente'; component.deviceId = 'device'; component.profileId = profile.external_id; fixture.detectChanges(); await fixture.whenStable();
    api.post.and.returnValue(of({ data: { ...source, token: 'nvx_ingest_test_fixture' } }));
    const storage = spyOn(localStorage, 'setItem'); await component.saveSource(); fixture.detectChanges();
    expect(component.secret()).toBe('nvx_ingest_test_fixture'); expect(component.secretSource()).toBe('Nueva fuente'); expect(storage).not.toHaveBeenCalled();
    expect(api.post.calls.mostRecent().args[1].device_external_id).toBe('device'); expect(api.post.calls.mostRecent().args[1].token).toBeUndefined();
    spyOn(window, 'confirm').and.returnValue(false); expect(component.canLeave()).toBeFalse(); fixture.destroy();
  });
  it('previews a sample without calling either production ingestion endpoint', async () => {
    const fixture = TestBed.createComponent(IntegrationsPage); fixture.detectChanges(); await fixture.whenStable();
    const component = fixture.componentInstance; component.previewProfileId = profile.external_id; component.previewDeviceId = 'device';
    api.post.and.returnValue(of({ data: { readings: [{ value: 72.4 }] } })); await component.simulate();
    expect(api.post.calls.mostRecent().args[0]).toBe(`integrations/profiles/${profile.external_id}/preview`); expect(component.preview()).toEqual({ readings: [{ value: 72.4 }] }); fixture.destroy();
  });
  it('hides management actions from readers and refuses programmatic writes', async () => {
    TestBed.inject(AuthState).identity.set({ ...testIdentity, permissions: ['integrations.read'] });
    const fixture = TestBed.createComponent(IntegrationsPage); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Nueva fuente');
    await fixture.componentInstance.publish({ name: 'Denied', description: '', mappings: profile.mappings }); expect(api.post).not.toHaveBeenCalled(); fixture.destroy();
  });
  it('keeps transport-specific device selection and requires an explicit credential rotation', async () => {
    const fixture = TestBed.createComponent(IntegrationsPage); fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.transport = 'MQTT'; expect(fixture.componentInstance.compatibleDevices().length).toBe(0);
    spyOn(window, 'confirm').and.returnValue(false); await fixture.componentInstance.rotate(source); expect(api.post).not.toHaveBeenCalled(); fixture.destroy();
  });
  it('edits a deep copy of mappings and preserves zero-valued transformations', async () => {
    const fixture = TestBed.createComponent(ProfileEditorComponent); fixture.componentRef.setInput('base', profile); fixture.detectChanges(); await fixture.whenStable();
    const component = fixture.componentInstance; component.mappings[0].scale = 0; const emit = spyOn(component.published, 'emit'); component.submit();
    expect(emit).toHaveBeenCalled(); expect(emit.calls.mostRecent().args[0].mappings[0].scale).toBe(0); expect(profile.mappings[0].scale).toBe(100); fixture.destroy();
  });
});
