import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FormFocusDirective } from '../shared/ui/form-focus.directive';
import { fieldError } from '../shared/ui/field-error';
import { enumLabel } from '../shared/ui/enum-label';
import { ResourcePage } from './administration/resource.page';
import { HelpPage } from './help/help.page';
import { ApiService } from '../core/api/api.service';
import { AuthState } from '../core/auth/auth-state.service';
import { testIdentity } from '../../testing/auth-fixture';
import { routes } from '../app.routes';

@Component({ imports: [ReactiveFormsModule, FormFocusDirective], template: `<form appFormFocus [formGroup]="form" (ngSubmit)="submitted = true"><input aria-label="Nombre" formControlName="name" /><input formControlName="email" /><button>Guardar</button></form>` })
class FormHost {
  submitted = false;
  form = new FormGroup({ name: new FormControl('', Validators.required), email: new FormControl('', Validators.email) });
}
const page = (data: unknown[] = [], total = data.length) => ({ data, pagination: { page: 1, page_size: 20, total, total_pages: Math.ceil(total / 20) } });

describe('Usability: shared forms and understandable labels', () => {
  it('focuses the first invalid field without replacing validation or submission', async () => {
    const fixture = TestBed.createComponent(FormHost); fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.name.touched).toBeTrue();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('input'));
    expect(fixture.componentInstance.submitted).toBeTrue(); fixture.destroy();
  });
  it('provides concrete validation errors and preserves technical API enum values', () => {
    const required = new FormControl('', Validators.required); expect(fieldError(required)).toContain('obligatorio');
    const email = new FormControl('not-email', Validators.email); expect(fieldError(email)).toContain('correo válido');
    const length = new FormControl('A', Validators.minLength(2)); expect(fieldError(length)).toContain('2 caracteres');
    expect(enumLabel('ONLINE')).toBe('Conectado'); expect(enumLabel('MQTT')).toBe('MQTT'); expect(enumLabel('GOOD')).toBe('Buena');
  });
});

describe('Usability: administration and operation catalogs', () => {
  let api: { list: jasmine.Spy; options: jasmine.Spy; post: jasmine.Spy };
  beforeEach(() => {
    api = { list: jasmine.createSpy().and.returnValue(of(page())), options: jasmine.createSpy().and.resolveTo([]), post: jasmine.createSpy() };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ApiService, useValue: api }, { provide: ActivatedRoute, useValue: { data: of({ resource: 'devices' }) } }] });
    TestBed.inject(AuthState).identity.set(testIdentity);
  });
  it('offers a named action and guide from an empty catalog', () => {
    const fixture = TestBed.createComponent(ResourcePage); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Crear dispositivo');
    expect(fixture.nativeElement.querySelector('a[href="/app/help"]')).not.toBeNull(); fixture.destroy();
  });
  it('clears all filters and returns to the first page', () => {
    const fixture = TestBed.createComponent(ResourcePage); fixture.detectChanges();
    const component = fixture.componentInstance; component.search = 'missing'; component.auditAction = 'READ'; component.auditOutcome = 'FAILURE'; component.page = 4;
    component.clearFilters(); expect(component.page).toBe(1); expect(component.hasFilters()).toBeFalse();
    expect(api.list.calls.mostRecent().args[1].search).toBeUndefined(); fixture.destroy();
  });
  it('returns to an existing page when the last page becomes empty', () => {
    const fixture = TestBed.createComponent(ResourcePage); fixture.detectChanges();
    api.list.and.returnValues(of(page([], 1)), of(page([{ external_id: 'public', name: 'Device' }], 1)));
    fixture.componentInstance.page = 2; fixture.componentInstance.load();
    expect(fixture.componentInstance.page).toBe(1); expect(fixture.componentInstance.rows().length).toBe(1); fixture.destroy();
  });
  it('keeps an edited modal open when discarding is declined and closes on approval', async () => {
    const fixture = TestBed.createComponent(ResourcePage); fixture.detectChanges();
    const component = fixture.componentInstance; await component.open('create'); fixture.detectChanges();
    component.form.controls['name'].setValue('Nuevo equipo'); component.form.markAsDirty();
    const confirm = spyOn(window, 'confirm').and.returnValue(false); component.close();
    expect(fixture.nativeElement.querySelector('dialog').open).toBeTrue(); expect(component.form.controls['name'].value).toBe('Nuevo equipo');
    expect(component.canLeave()).toBeFalse(); confirm.and.returnValue(true); component.close();
    expect(fixture.nativeElement.querySelector('dialog').open).toBeFalse(); fixture.destroy();
  });
  it('links an error summary to invalid fields and does not send invalid forms', async () => {
    const fixture = TestBed.createComponent(ResourcePage); fixture.detectChanges();
    const component = fixture.componentInstance; await component.open('create'); await component.save(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('antes de guardar');
    expect(fixture.nativeElement.querySelector('#resource-name').getAttribute('aria-describedby')).toBe('resource-name-error');
    component.focusField('name'); expect(document.activeElement?.id).toBe('resource-name'); expect(api.post).not.toHaveBeenCalled(); fixture.destroy();
  });
  it('does not allow navigation while saving and guards every resource route', () => {
    const fixture = TestBed.createComponent(ResourcePage); fixture.detectChanges(); fixture.componentInstance.saving.set(true);
    expect(fixture.componentInstance.canLeave()).toBeFalse();
    for (const route of routes[0].children!.filter((route) => route.data?.['resource'])) expect(route.canDeactivate?.length).toBeGreaterThan(0);
    fixture.destroy();
  });
  it('keeps help useful without offering unauthorized operation links', () => {
    TestBed.inject(AuthState).identity.set({ ...testIdentity, permissions: [] });
    const fixture = TestBed.createComponent(HelpPage); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('details').length).toBeGreaterThan(4);
    expect(fixture.nativeElement.querySelector('a[href="/app/operations/devices"]')).toBeNull(); fixture.destroy();
  });
  it('does not trap logout or expired sessions behind an unsaved-change confirmation', async () => {
    const fixture = TestBed.createComponent(ResourcePage); fixture.detectChanges();
    await fixture.componentInstance.open('create'); fixture.componentInstance.form.markAsDirty();
    TestBed.inject(AuthState).identity.set(null); const confirm = spyOn(window, 'confirm').and.returnValue(false);
    expect(fixture.componentInstance.canLeave()).toBeTrue(); expect(confirm).not.toHaveBeenCalled(); fixture.destroy();
  });
});
