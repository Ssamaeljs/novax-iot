import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectSensor, WidgetColorRule } from './project.models';
import { ruleOperators, widgetTones } from './widget-colors';

@Component({
  selector: 'app-widget-rules-editor', imports: [FormsModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="stack" aria-label="Colores según condiciones">
    <h3>Colores según condiciones</h3>
    <p>Se aplica la primera coincidencia, de arriba hacia abajo, sobre la última lectura numérica. No genera alertas.</p>
    @for (rule of rules(); track $index; let index = $index) {
      <fieldset><legend>Condición {{ index + 1 }}</legend>
        <label class="field">Sensor<select [ngModel]="rule.sensor_external_id" [ngModelOptions]="{standalone:true}" (ngModelChange)="change(index, {sensor_external_id:$event})"><option value="">Selecciona un sensor</option>@for (sensor of sensors(); track sensor.external_id) {<option [value]="sensor.external_id">{{ sensor.name }} · {{ sensor.unit }}</option>}</select></label>
        <label class="field">Condición<select [ngModel]="rule.operator" [ngModelOptions]="{standalone:true}" (ngModelChange)="change(index, {operator:$event})">@for (op of operators; track op.value) {<option [value]="op.value">{{ op.label }}</option>}</select></label>
        <label class="field">Umbral<input type="number" step="any" [ngModel]="rule.value" [ngModelOptions]="{standalone:true}" (ngModelChange)="change(index, {value:$event})" /></label>
        @if (rule.operator === 'between') { <label class="field">Límite superior<input type="number" step="any" [ngModel]="rule.upper" [ngModelOptions]="{standalone:true}" (ngModelChange)="change(index, {upper:$event})" /></label> }
        <label class="field">Color<select [ngModel]="rule.tone" [ngModelOptions]="{standalone:true}" (ngModelChange)="change(index, {tone:$event})">@for (tone of tones; track tone.value) {<option [value]="tone.value">{{ tone.label }}</option>}</select></label>
        <label class="field">Etiqueta visible<input maxlength="80" [ngModel]="rule.label" [ngModelOptions]="{standalone:true}" (ngModelChange)="change(index, {label:$event})" /></label>
        <div class="cluster"><button class="button" type="button" [disabled]="index === 0" (click)="move(index,-1)" aria-label="Subir condición">↑</button><button class="button" type="button" [disabled]="index === rules().length-1" (click)="move(index,1)" aria-label="Bajar condición">↓</button><button class="button" type="button" (click)="remove(index)">Quitar condición</button></div>
      </fieldset>
    }
    <button class="button" type="button" [disabled]="rules().length >= 10 || !sensors().length" (click)="add()">Añadir condición</button>
    <small>Sin coincidencia o sin dato válido se conserva el color del tema. Máximo 10 condiciones.</small>
  </section>`,
  styles: `h3{font-size:.9rem}p,small{font-size:.72rem;line-height:1.6;color:var(--text-muted)}fieldset{min-width:0;display:grid;gap:.6rem;border:1px solid var(--border-default);border-radius:var(--radius-sm);padding:.75rem}legend{font-size:.75rem;color:var(--text-secondary)}`,
})
export class WidgetRulesEditorComponent {
  readonly rules = input.required<WidgetColorRule[]>();
  readonly sensors = input.required<ProjectSensor[]>();
  readonly changed = output<WidgetColorRule[]>();
  readonly operators = ruleOperators;
  readonly tones = widgetTones;
  change(index: number, patch: Partial<WidgetColorRule>) {
    this.changed.emit(this.rules().map((rule, position) => {
      if (position !== index) return rule;
      const next = { ...rule, ...patch };
      if (next.operator !== 'between') delete next.upper;
      return next;
    }));
  }
  add() {
    if (this.rules().length >= 10 || !this.sensors().length) return;
    this.changed.emit([...this.rules(), { sensor_external_id: this.sensors()[0].external_id, operator: 'gte', value: 0, tone: 'warning', label: 'Advertencia' }]);
  }
  remove(index: number) { this.changed.emit(this.rules().filter((_, position) => position !== index)); }
  move(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= this.rules().length) return;
    const rules = [...this.rules()]; [rules[index], rules[target]] = [rules[target], rules[index]];
    this.changed.emit(rules);
  }
}
