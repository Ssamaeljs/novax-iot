import { ChangeDetectionStrategy, Component, input, OnChanges, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectSensor, WidgetDraft, WidgetColorRule } from './project.models';
import { WidgetRulesEditorComponent } from './widget-rules-editor.component';
@Component({
  selector: 'app-widget-editor', imports: [FormsModule, WidgetRulesEditorComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<form class="stack" (ngSubmit)="apply()">
    <h3>Propiedades del widget</h3>
    <label class="field">Título<input name="title" [(ngModel)]="title" maxlength="120" required /></label>
    <fieldset><legend>Sensores {{ numericSingle() ? '(uno)' : '(hasta seis)' }}</legend>
      <input class="sensor-search" name="search" aria-label="Buscar sensores" placeholder="Buscar sensor…" [(ngModel)]="search" />
      <div class="sensor-options">@for (sensor of available(); track sensor.external_id) {
        <label class="sensor-option"><input type="checkbox" [checked]="sensorIds.includes(sensor.external_id)" (change)="toggle(sensor.external_id, $any($event.target).checked)" />
          <span>{{ sensor.name }}<small>{{ sensor.metric }} · {{ sensor.unit || 'sin unidad' }}</small></span>
        </label>
      }</div><small>Seleccionados: {{ sensorIds.length }}. El orden de selección define las series.</small>
    </fieldset>
    @if (numericSingle()) {
      <div class="two-fields"><label class="field">Mínimo<input type="number" name="min" [(ngModel)]="minimum" step="any" required /></label><label class="field">Máximo<input type="number" name="max" [(ngModel)]="maximum" step="any" required /></label></div>
    }
    @if (widget().type === 'HTML') {
      <label class="field">HTML<textarea name="html" [(ngModel)]="html" rows="7" maxlength="16000" spellcheck="false" required></textarea></label>
      <label class="field">CSS<textarea name="css" [(ngModel)]="css" rows="5" maxlength="8000" spellcheck="false"></textarea></label>
      <p class="template-help">{{ templateHelp }}</p>
      <small>HTML y CSS de presentación. Sin JavaScript, enlaces ni recursos externos.</small>
    }
    <app-widget-rules-editor [rules]="colorRules" [sensors]="ruleSensors()" (changed)="colorRules = $event" />
    <fieldset><legend>Posición y tamaño</legend>
      <div class="two-fields"><label class="field">Columna<input type="number" name="x" [(ngModel)]="x" min="0" max="9" [disabled]="widget().layout.locked" /></label><label class="field">Fila<input type="number" name="y" [(ngModel)]="y" min="0" max="200" [disabled]="widget().layout.locked" /></label>
      <label class="field">Ancho<input type="number" name="width" [(ngModel)]="width" min="3" max="12" [disabled]="widget().layout.locked" /></label><label class="field">Alto<input type="number" name="height" [(ngModel)]="height" min="3" max="16" [disabled]="widget().layout.locked" /></label></div>
      <small>Cuadrícula de 12 columnas. Desbloquea el widget desde su encabezado para cambiar su geometría.</small>
    </fieldset>
    @if (error) { <p class="field-error" role="alert">{{ error }}</p> }
    <button class="button button--primary" type="submit">Aplicar al tablero</button>
    <small>Después pulsa «Guardar tablero» para conservar los cambios.</small>
  </form>`,
  styles: `h3{font-size:.9rem}fieldset{min-width:0;border:1px solid var(--border-default);border-radius:var(--radius-sm);padding:.75rem;display:grid;gap:.6rem}legend{font-size:.75rem;color:var(--text-secondary)}.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}.sensor-options{max-height:190px;overflow:auto;display:grid;gap:.5rem}.sensor-option{display:flex;align-items:start;gap:.5rem;font-size:.75rem}.sensor-option span{display:grid;gap:.15rem}.sensor-option small{font-size:.65rem;color:var(--text-muted)}.template-help{font-family:monospace;font-size:.7rem;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--text-secondary)}small{font-size:.7rem;color:var(--text-muted)}textarea{font-family:monospace;font-size:.75rem}`,
})
export class WidgetEditorComponent implements OnChanges {
  readonly widget = input.required<WidgetDraft>();
  readonly sensors = input.required<ProjectSensor[]>();
  readonly applied = output<WidgetDraft>();
  readonly templateHelp = 'Campos: {{value}}, {{name}}, {{unit}}, {{observed_at}}, {{quality}}.\nComparaciones: {{sensor_1.value}}, {{sensor_2.value}}, {{sensor_2.name}}…';
  title = ''; sensorIds: string[] = []; minimum: number | null = 0; maximum: number | null = 100;
  html = ''; css = ''; x = 0; y = 0; width = 4; height = 5; search = ''; error = '';
  colorRules: WidgetColorRule[] = [];
  ngOnChanges() {
    const widget = this.widget();
    this.title = widget.title; this.sensorIds = [...widget.sensor_external_ids];
    this.minimum = widget.settings.min ?? 0; this.maximum = widget.settings.max ?? 100;
    this.html = widget.settings.html || ''; this.css = widget.settings.css || '';
    this.colorRules = (widget.settings.color_rules || []).map((rule) => ({ ...rule }));
    ({ x: this.x, y: this.y, width: this.width, height: this.height } = widget.layout);
    this.error = '';
  }
  numericSingle(): boolean { return ['GAUGE', 'THERMOMETER'].includes(this.widget().type); }
  ruleSensors(): ProjectSensor[] { return this.sensors().filter((sensor) => this.sensorIds.includes(sensor.external_id) && sensor.is_active && sensor.data_type === 'NUMBER'); }
  available(): ProjectSensor[] {
    const search = this.search.toLowerCase();
    return this.sensors().filter((sensor) => sensor.is_active && (this.widget().type === 'HTML' || sensor.data_type === 'NUMBER') && `${sensor.name} ${sensor.metric} ${sensor.unit}`.toLowerCase().includes(search));
  }
  toggle(id: string, checked: boolean) {
    this.error = '';
    this.sensorIds = checked ? this.numericSingle() ? [id] : [...this.sensorIds, id] : this.sensorIds.filter((value) => value !== id);
  }
  apply() {
    this.error = '';
    if (!this.title.trim() || !this.sensorIds.length || this.sensorIds.length > 6) { this.error = 'Indica un título y selecciona los sensores.'; return; }
    const selected = this.sensorIds.map((id) => this.sensors().find((sensor) => sensor.external_id === id));
    if (selected.some((sensor) => !sensor?.is_active)) { this.error = 'Selecciona sensores activos disponibles.'; return; }
    if (this.numericSingle() && (this.minimum === null || this.maximum === null || !Number.isFinite(this.minimum) || !Number.isFinite(this.maximum) || this.minimum >= this.maximum)) { this.error = 'Revisa los límites de la escala.'; return; }
    if (this.widget().type === 'TIMELINE' && selected.some((sensor) => sensor!.metric !== selected[0]!.metric || sensor!.unit !== selected[0]!.unit)) { this.error = 'Compara sensores de la misma métrica y unidad.'; return; }
    if (this.widget().type === 'HTML' && !this.html.trim()) { this.error = 'Escribe el contenido HTML del widget.'; return; }
    if (this.colorRules.some((rule) => !this.ruleSensors().some((sensor) => sensor.external_id === rule.sensor_external_id) || !rule.label.trim() || !Number.isFinite(rule.value) || (rule.operator === 'between' && (!Number.isFinite(rule.upper) || rule.upper! < rule.value)))) { this.error = 'Revisa los sensores, etiquetas y umbrales de las condiciones de color.'; return; }
    const colorSettings = this.colorRules.length ? { color_rules: this.colorRules.map((rule) => ({ ...rule })) } : {};
    this.applied.emit({ ...this.widget(), title: this.title.trim(), sensor_external_ids: [...this.sensorIds], sensors: selected as ProjectSensor[],
      layout: { ...this.widget().layout, x: this.x, y: this.y, width: this.width, height: this.height },
      settings: { ...(this.widget().type === 'HTML' ? { html: this.html, css: this.css } : this.numericSingle() ? { min: this.minimum!, max: this.maximum! } : {}), ...colorSettings },
    });
  }
}
