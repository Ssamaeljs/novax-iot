import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';

export interface TelemetryPoint {
  label: string;
  value: number;
  reference: number;
}
@Component({
  selector: 'app-telemetry-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" (mouseleave)="active.set(null)">
      <svg
        viewBox="0 0 680 210"
        role="img"
        aria-label="Humedad relativa y referencia por hora, en porcentaje"
      >
        @for (tick of ticks; track tick) {
          <line
            x1="42"
            x2="656"
            [attr.y1]="y(tick)"
            [attr.y2]="y(tick)"
            class="grid"
          />
          <text x="30" [attr.y]="y(tick) + 4" text-anchor="end">
            {{ tick }}%
          </text>
        }
        <path [attr.d]="area()" class="area" />
        <polyline [attr.points]="referenceLine()" class="reference" />
        <polyline [attr.points]="valueLine()" class="value" />
        @for (point of points(); track point.label; let i = $index) {
          <text [attr.x]="x(i)" y="202" text-anchor="middle">
            {{ point.label }}
          </text>
          <circle
            [attr.cx]="x(i)"
            [attr.cy]="y(point.value)"
            r="4"
            class="point"
          />
          <circle
            [attr.cx]="x(i)"
            [attr.cy]="y(point.value)"
            r="12"
            class="target"
            tabindex="0"
            [attr.aria-label]="
              point.label +
              ': humedad ' +
              point.value +
              '%, referencia ' +
              point.reference +
              '%'
            "
            (focus)="active.set(point)"
            (blur)="active.set(null)"
            (mouseenter)="active.set(point)"
            (keydown.escape)="active.set(null)"
          />
        }
      </svg>
      @if (active(); as point) {
        <div class="chart-tooltip" role="status">
          {{ point.label }} · Humedad <strong>{{ point.value }}%</strong> ·
          Referencia {{ point.reference }}%
        </div>
      }
    </div>
    <div class="legend">
      <span><i class="line-one"></i>Humedad relativa</span
      ><span><i class="line-two"></i>Referencia</span>
    </div>
    <details class="chart-data">
      <summary>Ver datos del gráfico</summary>
      <div class="table-scroll">
        <table>
          <caption class="sr-only">
            Valores del gráfico
          </caption>
          <thead>
            <tr>
              <th scope="col">Hora</th>
              <th scope="col">Humedad</th>
              <th scope="col">Referencia</th>
            </tr>
          </thead>
          <tbody>
            @for (point of points(); track point.label) {
              <tr>
                <td>{{ point.label }}</td>
                <td>{{ point.value }}%</td>
                <td>{{ point.reference }}%</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </details>
  `,
  styles: `
    :host {
      display: block;
    }
    .chart {
      position: relative;
      padding-top: 1rem;
    }
    svg {
      width: 100%;
      overflow: visible;
    }
    text {
      fill: var(--chart-label);
      font: 11px var(--font-sans);
    }
    .grid {
      stroke: var(--chart-grid);
      stroke-width: 1;
    }
    .area {
      fill: var(--chart-fill);
    }
    .value,
    .reference {
      fill: none;
      stroke-width: 2.5;
      stroke-linejoin: round;
    }
    .value {
      stroke: var(--chart-series-1);
    }
    .reference {
      stroke: var(--chart-series-2);
      stroke-dasharray: 6 5;
    }
    .point {
      fill: var(--bg-surface);
      stroke: var(--chart-series-1);
      stroke-width: 2;
    }
    .target {
      fill: transparent;
    }
    .target:focus-visible {
      outline: none;
      stroke: var(--focus-ring);
      stroke-width: 2;
    }
    .legend {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 1.5rem;
      color: var(--text-secondary);
      font-size: 0.75rem;
    }
    .legend span {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .legend i {
      width: 20px;
      border-top: 3px solid var(--chart-series-1);
    }
    .legend .line-two {
      border-color: var(--chart-series-2);
      border-top-style: dashed;
    }
    .chart-tooltip {
      position: absolute;
      top: 0;
      right: 0;
      padding: 0.5rem;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--chart-tooltip-bg);
      color: var(--text-primary);
      font-size: 0.75rem;
      box-shadow: var(--shadow-sm);
      pointer-events: none;
    }
    .chart-data {
      margin-top: 0.75rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    summary {
      width: fit-content;
    }
    @media (max-width: 500px) {
      text {
        font-size: 13px;
      }
    }
  `,
})
export class TelemetryChartComponent {
  readonly points = input.required<readonly TelemetryPoint[]>();
  protected readonly active = signal<TelemetryPoint | null>(null);
  protected readonly ticks = [20, 40, 60, 80, 100];
  protected x(index: number): number {
    return 48 + index * (600 / Math.max(this.points().length - 1, 1));
  }
  protected y(value: number): number {
    return 180 - Math.max(0, Math.min(100, value)) * 1.6;
  }
  protected readonly valueLine = computed(() =>
    this.points()
      .map((p, i) => `${this.x(i)},${this.y(p.value)}`)
      .join(' '),
  );
  protected readonly referenceLine = computed(() =>
    this.points()
      .map((p, i) => `${this.x(i)},${this.y(p.reference)}`)
      .join(' '),
  );
  protected readonly area = computed(() =>
    this.points().length
      ? `M48,180 L${this.valueLine().replaceAll(' ', ' L')} L${this.x(this.points().length - 1)},180 Z`
      : '',
  );
}
