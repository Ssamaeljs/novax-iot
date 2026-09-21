import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
export interface MeasurementPoint {
  at: string;
  value: number;
  timestamp?: number;
}
@Component({
  selector: 'app-measurement-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<figure>
    <figcaption>
      {{ label() }}
      <small
        >({{ unit() || 'sin unidad' }}) · {{ points().length }} muestras de la
        página actual</small
      >
    </figcaption>
    <svg
      viewBox="0 0 720 230"
      role="img"
      [attr.aria-label]="
        'Evolución de ' + label() + '. Valores detallados en la tabla inferior.'
      "
    >
      <line x1="65" y1="25" x2="695" y2="25" class="grid" />
      <line x1="65" y1="105" x2="695" y2="105" class="grid" />
      <line x1="65" y1="185" x2="695" y2="185" class="grid" />
      <text x="55" y="30" text-anchor="end">{{ domain().max.toFixed(1) }}</text>
      <text x="55" y="190" text-anchor="end">
        {{ domain().min.toFixed(1) }}
      </text>
      <polyline [attr.points]="coordinates()" class="series" />
      @for (point of plotted(); track $index) {
        <circle
          [attr.cx]="point.x"
          [attr.cy]="point.y"
          r="3"
          tabindex="0"
          [attr.aria-label]="point.at + ': ' + point.value + ' ' + unit()"
        >
          <title>{{ point.at }}: {{ point.value }} {{ unit() }}</title>
        </circle>
      }
      <text x="65" y="218">{{ first() }}</text>
      <text x="695" y="218" text-anchor="end">{{ last() }}</text>
    </svg>
  </figure>`,
  styles: `
    figure {
      margin: 0;
      padding: 1.25rem;
    }
    figcaption {
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.8rem;
    }
    small {
      font-weight: 400;
    }
    svg {
      width: 100%;
      max-height: 300px;
      overflow: visible;
    }
    text {
      font: 11px var(--font-sans);
      fill: var(--text-muted);
    }
    .grid {
      stroke: var(--chart-grid);
      stroke-width: 1;
    }
    .series {
      fill: none;
      stroke: var(--chart-series-1);
      stroke-width: 2;
    }
    circle {
      fill: var(--chart-series-1);
      stroke: var(--bg-surface);
      stroke-width: 1;
    }
    circle:focus {
      stroke: var(--focus-ring);
      stroke-width: 4;
    }
  `,
})
export class MeasurementChartComponent {
  readonly points = input.required<MeasurementPoint[]>();
  readonly label = input('Mediciones');
  readonly unit = input('');
  readonly domain = computed(() => {
    const values = this.points().map((point) => point.value);
    if (!values.length) return { min: 0, max: 1 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad =
      max === min ? Math.max(Math.abs(min) * 0.1, 1) : (max - min) * 0.1;
    return { min: min - pad, max: max + pad };
  });
  readonly plotted = computed(() => {
    const domain = this.domain();
    const points = this.points();
    const start = points[0]?.timestamp;
    const end = points.at(-1)?.timestamp;
    const useTime =
      start !== undefined &&
      end !== undefined &&
      end > start &&
      points.every((point) => Number.isFinite(point.timestamp));
    return this.points().map((point, index, values) => ({
      ...point,
      x:
        65 +
        (useTime
          ? (point.timestamp! - start!) / (end! - start!)
          : index / Math.max(1, values.length - 1)) *
          630,
      y: 185 - ((point.value - domain.min) / (domain.max - domain.min)) * 160,
    }));
  });
  readonly coordinates = computed(() =>
    this.plotted()
      .map((point) => `${point.x},${point.y}`)
      .join(' '),
  );
  readonly first = computed(() => this.points()[0]?.at || '');
  readonly last = computed(() => this.points().at(-1)?.at || '');
}
