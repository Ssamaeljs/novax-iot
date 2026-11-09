import { Toast } from '../../shared/ui/toast.service';
import { TestBed } from '@angular/core/testing';
import { matchingRule, ruleAppearance } from './widget-colors';
import { SensorTelemetry, WidgetColorRule, WidgetDraft } from './project.models';
import { WidgetViewComponent } from './widgets/widget-view.component';
import { WidgetEditorComponent } from './widget-editor.component';
import { WidgetRulesEditorComponent } from './widget-rules-editor.component';
import { resources } from '../administration/resource-definitions';

const sensorId = '11111111-1111-4111-8111-111111111111';
const sensor: SensorTelemetry['sensor'] = { external_id: sensorId, name: 'Humedad', key: 'humidity', metric: 'humidity', unit: '%', data_type: 'NUMBER', is_active: true };
const rule = (patch: Partial<WidgetColorRule> = {}): WidgetColorRule => ({ sensor_external_id: sensorId, operator: 'gte', value: 30, tone: 'danger', label: 'Humedad alta', ...patch });
const telemetry = (value: unknown, quality = 'GOOD'): SensorTelemetry[] => [{ sensor, latest: { value, quality, observed_at: '2026-10-18T12:00:00Z', received_at: '2026-10-18T12:00:01Z' }, points: [] }];
const widget = (): WidgetDraft => ({ key: 'local', title: 'Humedad', type: 'GAUGE', layout: { x: 0, y: 0, width: 4, height: 5, locked: false }, sensors: [sensor], sensor_external_ids: [sensorId], settings: { min: 0, max: 100, color_rules: [rule()] } });

describe('Conditional widget colors', () => {
  it('evaluates exact limits for every operator including zero and negative values', () => {
    const cases: [WidgetColorRule['operator'], number, boolean][] = [['gt', 30, false], ['gt', 31, true], ['gte', 30, true], ['lt', 29, true], ['lte', 30, true], ['eq', 30, true], ['neq', 30, false], ['neq', 0, true]];
    for (const [operator, value, matches] of cases) expect(!!matchingRule([rule({ operator })], telemetry(value))).withContext(operator).toBe(matches);
    for (const value of [-10, 0]) expect(matchingRule([rule({ operator: 'between', value: -10, upper: 0 })], telemetry(value))).toBeDefined();
    expect(matchingRule([rule({ operator: 'between', value: -10, upper: 0 })], telemetry(1))).toBeUndefined();
  });
  it('uses the first match and only the selected numeric sensor reading', () => {
    const first = rule({ tone: 'warning' });
    expect(matchingRule([first, rule()], telemetry(40))).toBe(first);
    expect(matchingRule([rule({ sensor_external_id: 'another' })], telemetry(40))).toBeUndefined();
    for (const value of [null, '40', false, NaN, Infinity]) expect(matchingRule([rule()], telemetry(value))).toBeUndefined();
    expect(matchingRule([rule()], telemetry(40, 'BAD'))).toBeUndefined();
    expect(matchingRule([rule()], [])).toBeUndefined();
  });
  it('uses semantic theme tokens and falls back without accepting arbitrary styles', () => {
    expect(ruleAppearance(rule()).color).toBe('var(--danger)');
    expect(ruleAppearance(undefined).color).toBe('var(--primary)');
    expect(ruleAppearance(rule({ tone: 'url(bad)' as never })).color).toBe('var(--primary)');
  });
  it('updates the numeric indicator and visible label when telemetry crosses a condition', () => {
    const fixture = TestBed.createComponent(WidgetViewComponent);
    fixture.componentRef.setInput('widget', widget()); fixture.componentRef.setInput('telemetry', telemetry(20)); fixture.detectChanges();
    expect(fixture.componentInstance.rule()).toBeUndefined();
    fixture.componentRef.setInput('telemetry', telemetry(40)); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Humedad alta');
    expect(fixture.nativeElement.querySelector('.progress').style.stroke).toBe('var(--danger)');
    expect(fixture.nativeElement.style.background).toBe('var(--danger-soft)');
    fixture.destroy();
  });
  it('preserves rules through the widget properties editor and rejects detached sensors', () => {
    const fixture = TestBed.createComponent(WidgetEditorComponent);
    fixture.componentRef.setInput('widget', widget()); fixture.componentRef.setInput('sensors', [sensor]); fixture.detectChanges();
    const emit = spyOn(fixture.componentInstance.applied, 'emit');
    fixture.componentInstance.apply();
    expect(emit.calls.mostRecent().args[0].settings.color_rules).toEqual([rule()]);
    fixture.componentInstance.colorRules = [rule({ sensor_external_id: 'another' })]; fixture.componentInstance.apply();
    expect(emit.calls.count()).toBe(1); expect(TestBed.inject(Toast).messages()).toContain(jasmine.objectContaining({ icon: 'error', text: jasmine.stringMatching('condiciones de color') })); fixture.destroy();
  });
  it('adds, reorders and removes conditions without mutating the original list', () => {
    const fixture = TestBed.createComponent(WidgetRulesEditorComponent);
    const initial = [rule(), rule({ tone: 'warning' })];
    fixture.componentRef.setInput('rules', initial); fixture.componentRef.setInput('sensors', [sensor]); fixture.detectChanges();
    const emit = spyOn(fixture.componentInstance.changed, 'emit');
    fixture.componentInstance.move(1,-1); expect(emit.calls.mostRecent().args[0][0].tone).toBe('warning'); expect(initial[0].tone).toBe('danger');
    fixture.componentInstance.remove(0); expect(emit.calls.mostRecent().args[0].length).toBe(1);
    fixture.componentInstance.add(); expect(emit.calls.mostRecent().args[0].length).toBe(3); fixture.destroy();
  });
  it('never requests a code in any administration form', () => {
    for (const resource of Object.values(resources)) expect(resource.fields.some((field) => field.key === 'code')).withContext(resource.endpoint).toBeFalse();
  });
});
