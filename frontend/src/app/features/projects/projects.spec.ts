import { Toast } from '../../shared/ui/toast.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ProjectBoardPage } from './project-board.page';
import { ApiService } from '../../core/api/api.service';
import { ProjectApi } from './project-api.service';
import { AuthState } from '../../core/auth/auth-state.service';
import { testIdentity } from '../../../testing/auth-fixture';
import { Board, ProjectSensor, SensorTelemetry, WidgetDraft } from './project.models';
import { freePosition, validLayout } from './board-layout';
import { customDocument, interpolate, sanitizeMarkup } from './widgets/custom-html';
import { CustomWidgetComponent } from './widgets/custom-widget.component';
import { ComparisonChartComponent } from './widgets/comparison-chart.component';
import { WidgetViewComponent } from './widgets/widget-view.component';

const projectId = '11111111-1111-4111-8111-111111111111';
const sensorId = '22222222-2222-4222-8222-222222222222';
const widgetId = '33333333-3333-4333-8333-333333333333';
const sensor: ProjectSensor = { external_id: sensorId, name: 'Temperatura Secretaría', key: 'temp', metric: 'temperature', unit: '°C', data_type: 'NUMBER', is_active: true };
const reading: SensorTelemetry = { sensor, latest: { value: -10, observed_at: '2026-10-18T10:00:00Z', received_at: '2026-10-18T10:00:01Z', quality: 'GOOD' }, points: [{ observed_at: '2026-10-18T10:00:00Z', value: -10, quality: 'GOOD' }, { observed_at: '2026-10-18T11:00:00Z', value: 30, quality: 'GOOD' }] };
function draft(): WidgetDraft { return { key: widgetId, external_id: widgetId, title: 'Temperatura', type: 'GAUGE', layout: { x: 0, y: 0, width: 4, height: 5, locked: false }, sensor_external_ids: [sensorId], sensors: [sensor], settings: { min: -20, max: 100 } }; }
function board(): Board { const { key: _key, ...widget } = draft(); return { project: { external_id: projectId, code: 'SECRETARIA', title: 'Secretaría', description: 'Sensores de oficina', version: 1, is_active: true }, version: 1, widgets: [widget] }; }

describe('Project layout and custom HTML security', () => {
  it('finds free positions and rejects overlap or invalid geometry', () => {
    const widget = draft();
    expect(freePosition([widget])).toEqual({ x: 4, y: 0, width: 4, height: 5, locked: false });
    expect(validLayout({ ...widget.layout, x: 1 }, [widget], 'another')).toBeFalse();
    expect(validLayout({ ...widget.layout, width: 13 }, [], widget.key)).toBeFalse();
    expect(validLayout({ ...widget.layout, x: 1 }, [widget], widget.key)).toBeTrue();
  });
  it('escapes sensor content and addresses each selected series explicitly', () => {
    const hostile = { ...reading, sensor: { ...sensor, name: '<img src=x onerror=alert(1)>' }, latest: { ...reading.latest!, value: '<script>bad()</script>' } };
    const result = interpolate('<p>{{sensor_1.name}} {{value}} {{sensor_2.value}}</p>', [hostile]);
    expect(result).not.toContain('<img'); expect(result).not.toContain('<script>'); expect(result).toContain('&lt;script&gt;'); expect(result).toContain('—');
  });
  it('removes active elements, navigation and event handlers from inert content', () => {
    const safe = sanitizeMarkup(document, '<div class="reading" onclick="bad()"><strong>25</strong><script>bad()</script><iframe srcdoc="bad"></iframe><img src="https://example.test"><a href="https://example.test">link</a><form>submit</form></div>');
    expect(safe).toContain('<strong>25</strong>'); expect(safe).toContain('class="reading"');
    for (const forbidden of ['onclick', '<script', '<iframe', '<img', 'href=', '<form']) expect(safe).not.toContain(forbidden);
  });
  it('prevents CSS from terminating the trusted style element and installs a restrictive CSP', () => {
    const html = customDocument('<p>25</p>', '</style><script>bad()</script>', '');
    expect(html).not.toContain('<script>'); expect(html).toContain("script-src 'none'"); expect(html).toContain("connect-src 'none'"); expect(html).toContain("form-action 'none'");
  });
});

describe('Project API contracts', () => {
  let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('sends only public widget references, geometry, settings and the board version', async () => {
    const pending = TestBed.inject(ProjectApi).save(projectId, 1, [draft()]);
    const request = http.expectOne(`/v1/api/projects/${projectId}/board`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.version).toBe(1);
    const widget = request.request.body.widgets[0];
    expect(widget.external_id).toBe(widgetId); expect(widget.sensor_external_ids).toEqual([sensorId]); expect(widget.key).toBeUndefined(); expect(widget.sensors).toBeUndefined(); expect(widget.id).toBeUndefined();
    request.flush({ data: { ...board(), version: 2 } }); expect((await pending).version).toBe(2);
  });
});

describe('Project board editor', () => {
  let fixture: ComponentFixture<ProjectBoardPage>;
  let projects: jasmine.SpyObj<ProjectApi>;
  beforeEach(async () => {
    projects = jasmine.createSpyObj<ProjectApi>('ProjectApi', ['board', 'save', 'telemetry']);
    projects.board.and.callFake(async () => board());
    projects.telemetry.and.resolveTo({ from: '', to: '', sample_limit: 200, series: [reading] });
    projects.save.and.callFake(async (_id, version, widgets) => ({ ...board(), version: version + 1, widgets }));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ external_id: projectId })) } }, { provide: ProjectApi, useValue: projects }, { provide: ApiService, useValue: { options: async () => [sensor] } }] });
    TestBed.inject(AuthState).identity.set({ ...testIdentity, permissions: [...testIdentity.permissions, 'projects.read', 'projects.manage', 'sensors.read', 'measurements.read'] });
    fixture = TestBed.createComponent(ProjectBoardPage); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  });
  afterEach(() => fixture.destroy());
  it('loads saved widgets and fetches real telemetry independently of edit mode', () => {
    expect(fixture.nativeElement.textContent).toContain('Secretaría'); expect(fixture.nativeElement.textContent).toContain('-10');
    expect(projects.board).toHaveBeenCalledWith(projectId); expect(projects.telemetry).toHaveBeenCalledWith(projectId, '24h');
    expect(fixture.componentInstance.dirty()).toBeFalse(); expect(fixture.componentInstance.editing()).toBeFalse();
  });
  it('opens the right panel, adds a predefined widget and persists its position', async () => {
    const component = fixture.componentInstance; component.toggleEditing(); component.add('THERMOMETER'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#widget-sidebar')).not.toBeNull();
    expect(component.widgets().length).toBe(2); expect(component.widgets()[1].layout.x).toBe(4); expect(component.dirty()).toBeTrue();
    await component.save(); expect(projects.save).toHaveBeenCalled(); expect(component.dirty()).toBeFalse(); expect(TestBed.inject(Toast).messages()).toContain(jasmine.objectContaining({ icon: 'success', text: 'Tablero guardado.' }));
  });
  it('moves and resizes using keyboard controls and respects a locked position', () => {
    const component = fixture.componentInstance; component.toggleEditing();
    component.keyInteraction(new KeyboardEvent('keydown', { key: 'ArrowRight' }), component.widgets()[0]);
    expect(component.widgets()[0].layout.x).toBe(1);
    component.keyInteraction(new KeyboardEvent('keydown', { key: 'ArrowRight' }), component.widgets()[0], true);
    expect(component.widgets()[0].layout.width).toBe(5);
    component.lock(component.widgets()[0]);
    component.keyInteraction(new KeyboardEvent('keydown', { key: 'ArrowRight' }), component.widgets()[0]);
    expect(component.widgets()[0].layout.x).toBe(1); expect(component.widgets()[0].layout.locked).toBeTrue();
  });
  it('moves a widget through pointer events on its drag handle', () => {
    const component = fixture.componentInstance; component.toggleEditing(); fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('.board-canvas') as HTMLElement;
    spyOn(canvas, 'getBoundingClientRect').and.returnValue({ width: 708 } as DOMRect);
    const handle = fixture.nativeElement.querySelector('.move-handle') as HTMLElement;
    spyOn(handle, 'setPointerCapture').and.stub();
    handle.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 100, clientY: 100 }));
    handle.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 160, clientY: 160 }));
    handle.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    expect(component.widgets()[0].layout.x).toBe(1); expect(component.widgets()[0].layout.y).toBe(1);
  });
  it('keeps unsaved changes when the server reports a concurrent edit', async () => {
    const component = fixture.componentInstance; component.toggleEditing(); component.lock(component.widgets()[0]);
    projects.save.and.rejectWith(new Error('Otra persona modificó el tablero.'));
    await component.save(); expect(component.dirty()).toBeTrue(); expect(component.error()).toContain('Otra persona');
  });
  it('prevents viewers from editing, adding widgets or persisting layout changes', async () => {
    TestBed.inject(AuthState).identity.set({ ...testIdentity, permissions: ['projects.read'] });
    const component = fixture.componentInstance; component.toggleEditing(); component.add('HTML'); await component.save();
    expect(component.editing()).toBeFalse(); expect(component.widgets().length).toBe(1); expect(projects.save).not.toHaveBeenCalled();
  });
  it('guards navigation when edits are pending and lets a viewer leave normally', () => {
    const component = fixture.componentInstance; expect(component.canLeave()).toBeTrue();
    component.toggleEditing(); component.lock(component.widgets()[0]); spyOn(window, 'confirm').and.returnValue(false);
    expect(component.canLeave()).toBeFalse();
  });
});

describe('Project widget rendering', () => {
  it('renders HTML inside an opaque sandbox without JavaScript or same-origin permissions', async () => {
    const fixture = TestBed.createComponent(CustomWidgetComponent);
    fixture.componentRef.setInput('settings', { html: '<strong>{{value}}</strong>', css: 'strong{color:var(--primary)}' }); fixture.componentRef.setInput('series', [reading]);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const frame = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.getAttribute('sandbox')).toBe(''); expect(frame.srcdoc).toContain('<strong>-10</strong>'); expect(frame.srcdoc).toContain("script-src 'none'"); fixture.destroy();
  });
  it('keeps series colors stable when an earlier comparison sensor has no history', () => {
    const fixture = TestBed.createComponent(ComparisonChartComponent);
    fixture.componentRef.setInput('series', [{ ...reading, points: [] }, { ...reading, sensor: { ...sensor, external_id: projectId, name: 'Second' } }]); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('polyline').getAttribute('class')).toContain('s1'); fixture.destroy();
  });
  it('displays zero readings and clamps a numeric indicator without hiding out-of-range values', () => {
    const fixture = TestBed.createComponent(WidgetViewComponent);
    fixture.componentRef.setInput('widget', { ...draft(), settings: { min: 0, max: 10 } }); fixture.componentRef.setInput('telemetry', [{ ...reading, latest: { ...reading.latest!, value: 0 } }]); fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(0); expect(fixture.componentInstance.percent()).toBe(0);
    fixture.componentRef.setInput('telemetry', [{ ...reading, latest: { ...reading.latest!, value: 15 } }]); fixture.detectChanges();
    expect(fixture.componentInstance.percent()).toBe(100); expect(fixture.nativeElement.textContent).toContain('Fuera de la escala'); fixture.destroy();
  });
});
