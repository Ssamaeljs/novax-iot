import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SensorTelemetry } from '../project.models';
@Component({
  selector: 'app-comparison-chart', changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (plotted().length) {
    <svg viewBox="0 0 640 230" role="img" [attr.aria-label]="'Evolución de ' + series().length + ' sensores, unidad ' + unit()">
      @for (y of [20, 100, 180]; track y) { <line x1="58" [attr.y1]="y" x2="620" [attr.y2]="y" class="grid" /> }
      <text x="50" y="25" text-anchor="end">{{ domain().max.toFixed(1) }}</text>
      <text x="50" y="185" text-anchor="end">{{ domain().min.toFixed(1) }}</text>
      @for (line of plotted(); track line.id; let index = $index) {
        <polyline [attr.points]="line.points" [attr.class]="'series s' + line.color" />
        <circle [attr.cx]="line.lastX" [attr.cy]="line.lastY" r="4" [attr.class]="'point s' + line.color"><title>{{ line.name }}: {{ line.value }} {{ unit() }}</title></circle>
      }
      <text x="58" y="213">{{ time(domain().start) }}</text><text x="620" y="213" text-anchor="end">{{ time(domain().end) }}</text>
    </svg>
  } @else { <p class="empty">Sin muestras numéricas en este periodo.</p> }
  <ul aria-label="Series del gráfico">@for (series of series(); track series.sensor.external_id; let index = $index) {
    <li><span [attr.class]="'legend s' + index" aria-hidden="true"></span>{{ series.sensor.name }} <strong>{{ numeric(series.latest?.value) }} {{ series.sensor.unit }}</strong></li>
  }</ul>`,
  styles: `:host{display:block;min-width:0}svg{width:100%;max-height:270px}text{font:11px var(--font-sans);fill:var(--text-muted)}.grid{stroke:var(--chart-grid)}.series{fill:none;stroke:var(--series-color);stroke-width:2}.point{fill:var(--series-color)}.s0{--series-color:var(--chart-series-1)}.s1{--series-color:var(--chart-series-2)}.s2{--series-color:var(--chart-series-3)}.s3{--series-color:var(--chart-series-4)}.s4{--series-color:var(--chart-series-5)}.s5{--series-color:var(--chart-series-6)}ul{padding:0;margin:.5rem 0;list-style:none;display:grid;gap:.45rem}li{display:flex;gap:.5rem;align-items:center;font-size:.73rem;overflow-wrap:anywhere}li strong{margin-left:auto;white-space:nowrap}.legend{width:10px;height:10px;flex-shrink:0;border-radius:50%;background:var(--series-color)}.empty{padding:1rem;color:var(--text-muted);font-size:.8rem}`,
})
export class ComparisonChartComponent {
  readonly series = input.required<SensorTelemetry[]>();
  readonly timezone = input('America/Guayaquil');
  readonly unit = computed(() => this.series()[0]?.sensor.unit || 'sin unidad');
  readonly domain = computed(() => {
    const points = this.series().flatMap((series) => series.points).filter((point) => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.observed_at)));
    if (!points.length) return { min: 0, max: 1, start: 0, end: 1 };
    const min = Math.min(...points.map((point) => point.value));
    const max = Math.max(...points.map((point) => point.value));
    const pad = Math.max((max - min) * .1, max === min ? Math.max(1, Math.abs(min) * .1) : .01);
    const times = points.map((point) => Date.parse(point.observed_at));
    return { min: min - pad, max: max + pad, start: Math.min(...times), end: Math.max(...times) };
  });
  readonly plotted = computed(() => {
    const domain = this.domain();
    return this.series().flatMap((series, color) => {
      const points = series.points.filter((point) => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.observed_at))).map((point) => ({
        x: domain.start === domain.end ? 339 : 58 + (Date.parse(point.observed_at) - domain.start) / (domain.end - domain.start) * 562,
        y: 180 - (point.value - domain.min) / (domain.max - domain.min) * 160, value: point.value,
      }));
      return points.length ? [{ id: series.sensor.external_id, name: series.sensor.name, color, points: points.map((point) => `${point.x},${point.y}`).join(' '), lastX: points.at(-1)!.x, lastY: points.at(-1)!.y, value: points.at(-1)!.value }] : [];
    });
  });
  numeric(value: unknown): string { return typeof value === 'number' ? value.toLocaleString('es', { maximumFractionDigits: 2 }) : '—'; }
  time(timestamp: number): string { return new Date(timestamp).toLocaleString('es', { timeZone: this.timezone(), month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
}
