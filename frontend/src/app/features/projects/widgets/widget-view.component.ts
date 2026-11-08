import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ProjectWidget, SensorTelemetry } from '../project.models';
import { ComparisonChartComponent } from './comparison-chart.component';
import { CustomWidgetComponent } from './custom-widget.component';
import { matchingRule, ruleAppearance } from '../widget-colors';
@Component({
  selector: 'app-widget-view', imports: [ComparisonChartComponent, CustomWidgetComponent], changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.background]': 'appearance().background', '[style.border-color]': 'appearance().border', 'style': 'border-style:solid;border-width:1px;border-radius:var(--radius-sm);padding:8px;box-sizing:border-box;' },
  template: `@if (rule(); as activeRule) { <p class="badge" [style.color]="appearance().color" [style.background]="appearance().background" [style.border-color]="appearance().border" role="status">● {{ activeRule.label }}</p> }
  @switch (widget().type) {
    @case ('TIMELINE') { <app-comparison-chart [series]="selectedSeries()" [timezone]="timezone()" /> }
    @case ('HTML') { <app-custom-widget [settings]="widget().settings" [series]="selectedSeries()" [title]="widget().title" [color]="appearance().color" /> }
    @default {
      @if (value() !== null) {
        @if (widget().type === 'GAUGE') {
          <svg class="gauge" viewBox="0 0 220 145" role="img" [attr.aria-label]="widget().title + ': ' + formatted() + ' ' + unit()">
            <path class="track" d="M30 110 A80 80 0 0 1 190 110" pathLength="100" />
            <path class="progress" [style.stroke]="appearance().color" d="M30 110 A80 80 0 0 1 190 110" pathLength="100" [attr.stroke-dasharray]="percent() + ' 100'" />
            <text class="number" x="110" y="90" text-anchor="middle">{{ formatted() }}</text>
            <text x="110" y="112" text-anchor="middle">{{ unit() }}</text>
            <text x="30" y="139" text-anchor="middle">{{ minimum() }}</text><text x="190" y="139" text-anchor="middle">{{ maximum() }}</text>
          </svg>
        } @else {
          <div class="thermometer" role="img" [attr.aria-label]="widget().title + ': ' + formatted() + ' ' + unit()">
            <div class="tube"><div class="fill" [style.background]="appearance().color" [style.height.%]="percent()"></div></div><div class="bulb"></div>
            <div class="temperature"><strong>{{ formatted() }} <small>{{ unit() }}</small></strong><span>{{ minimum() }} a {{ maximum() }} {{ unit() }}</span></div>
          </div>
        }
        @if (outOfRange()) { <p class="outside">Fuera de la escala configurada</p> }
        <p class="reading-meta">{{ selectedSeries().at(0)?.sensor?.name }}<br />{{ date() }} · {{ selectedSeries().at(0)?.latest?.quality }}</p>
      } @else { <p class="empty">Sin lecturas numéricas. El widget mostrará la próxima medición recibida.</p> }
    }
  }`,
  styles: `:host{display:block;height:100%;min-width:0;overflow:auto}.gauge{display:block;width:100%;height:calc(100% - 60px);min-height:120px;max-height:230px}.track,.progress{fill:none;stroke-width:15;stroke-linecap:round}.track{stroke:var(--bg-surface-secondary)}.progress{stroke:var(--primary)}text{fill:var(--text-muted);font:12px var(--font-sans)}.number{font-size:28px;font-weight:650;fill:var(--text-primary)}.reading-meta{font-size:.7rem;color:var(--text-muted);text-align:center;line-height:1.7;margin:.5rem 0}.thermometer{min-height:140px;height:calc(100% - 60px);max-height:240px;display:flex;align-items:center;justify-content:center;gap:1.5rem;position:relative;padding:15px}.tube{position:relative;width:25px;height:100%;min-height:110px;background:var(--bg-surface-secondary);border:2px solid var(--border-strong);border-radius:20px;overflow:hidden}.fill{position:absolute;bottom:0;width:100%;background:var(--primary);transition:height .2s}.bulb{display:none}.temperature{display:grid;gap:.6rem}.temperature strong{font-size:1.6rem}.temperature small{font-size:.8rem}.temperature span{font-size:.75rem;color:var(--text-muted)}.empty{font-size:.8rem;color:var(--text-muted);padding:1.5rem;text-align:center}.outside{color:var(--warning);font-size:.73rem;text-align:center;margin:.25rem 0}`,
})
export class WidgetViewComponent {
  readonly widget = input.required<ProjectWidget>();
  readonly telemetry = input.required<SensorTelemetry[]>();
  readonly timezone = input('America/Guayaquil');
  readonly selectedSeries = computed(() => this.widget().sensor_external_ids.map((id) => this.telemetry().find((item) => item.sensor.external_id === id)).filter((item): item is SensorTelemetry => !!item));
  readonly rule = computed(() => matchingRule(this.widget().settings.color_rules || [], this.selectedSeries()));
  readonly appearance = computed(() => ruleAppearance(this.rule()));
  readonly value = computed(() => { const value = this.selectedSeries()[0]?.latest?.value; return typeof value === 'number' && Number.isFinite(value) ? value : null; });
  readonly unit = computed(() => this.widget().sensors[0]?.unit || this.selectedSeries()[0]?.sensor.unit || '');
  readonly minimum = computed(() => this.widget().settings.min ?? 0);
  readonly maximum = computed(() => this.widget().settings.max ?? 100);
  readonly percent = computed(() => Math.max(0, Math.min(100, ((this.value() ?? this.minimum()) - this.minimum()) / (this.maximum() - this.minimum()) * 100)));
  readonly outOfRange = computed(() => this.value() !== null && (this.value()! < this.minimum() || this.value()! > this.maximum()));
  formatted(): string { return this.value()?.toLocaleString('es', { maximumFractionDigits: 2 }) || '0'; }
  date(): string { const date = this.selectedSeries()[0]?.latest?.observed_at; return date ? new Date(date).toLocaleString('es', { timeZone: this.timezone() }) : 'Sin fecha'; }
}
