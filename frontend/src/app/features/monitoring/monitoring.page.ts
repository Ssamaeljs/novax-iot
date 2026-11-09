import { Toast } from '../../shared/ui/toast.service';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ApiService, Entity, errorMessage } from '../../core/api/api.service';
import { AuthState } from '../../core/auth/auth-state.service';
import { enumLabel } from '../../shared/ui/enum-label';
import {
  MeasurementChartComponent,
  MeasurementPoint,
} from '../../shared/ui/measurement-chart.component';
@Component({
  imports: [FormsModule, MeasurementChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="section-title">
      <div>
        <p class="eyebrow">MONITORIZACIÓN</p>
        <h1>Mediciones</h1>
        <p>
          Historial recibido por el backend. Fechas mostradas en
          {{ state.identity()?.tenant?.timezone }}.
        </p>
      </div>
    </header>
    <form class="panel card-body filters" (ngSubmit)="load(true)">
      <label class="field"
        >Sensor<select name="sensor" [(ngModel)]="sensor">
          <option value="">Todos los sensores</option>
          @for (item of sensors(); track item.external_id) {
            <option [value]="item.external_id">
              {{ item['name'] }} · {{ item['device']?.name }} ({{
                item['unit'] || 'sin unidad'
              }})
            </option>
          }
        </select></label
      ><label class="field"
        >Desde (hora local)<input
          type="datetime-local"
          name="from"
          [(ngModel)]="from" /></label
      ><label class="field"
        >Hasta (hora local)<input
          type="datetime-local"
          name="to"
          [(ngModel)]="to" /></label
      ><label class="field"
        >Calidad<select name="quality" [(ngModel)]="quality">
          <option value="">Todas</option>
          <option value="GOOD">Buena</option>
          <option value="UNCERTAIN">Incierta</option>
          <option value="BAD">Mala</option>
        </select></label
      ><button
        class="button button--primary"
        type="submit"
        [disabled]="loading()"
      >
        Consultar
      </button>
      <button class="button" type="button" [disabled]="loading()" (click)="clearFilters()">Limpiar filtros</button>
    </form>
    @if (chart().length) {
      <section class="panel">
        <app-measurement-chart
          [points]="chart()"
          [label]="chartLabel()"
          [unit]="chartUnit()"
        />
      </section>
    } @else if (!sensor) {
      <p class="chart-hint">
        Selecciona un sensor numérico para visualizar su evolución. No se
        mezclan métricas ni unidades distintas.
      </p>
    }
    <section class="panel">
      <div class="panel-heading">
        <h2>Lecturas registradas</h2>
        <small>{{ total() }} resultados</small>
      </div>
      @if (loading()) {
        <p class="empty-state" role="status">Cargando mediciones…</p>
      } @else if (error()) {
        <div class="empty-state">
          <p>No se pudo cargar el historial.</p>
          <button class="button" (click)="load()">Reintentar</button>
        </div>
      } @else if (!rows().length) {
        <div class="empty-state">
          <h2>Sin mediciones en este periodo</h2>
          <p>
            Amplía el intervalo o comprueba que tus dispositivos estén enviando
            lecturas.
          </p>
        </div>
      } @else {
        <div
          class="table-scroll"
          tabindex="0"
          aria-label="Historial de mediciones"
        >
          <table class="operational-table" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col">Fecha</th>
                <th scope="col">Dispositivo / sensor</th>
                <th scope="col">Valor</th>
                <th scope="col">Calidad</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              @for (row of rows(); track row.external_id) {
                <tr role="row">
                  <td data-label="Fecha" role="cell">{{ date(row['observed_at']) }}</td>
                  <td data-label="Dispositivo / sensor" role="cell">
                    <div><strong>{{ row['sensor']?.name }}</strong
                    ><br /><small>{{ row['device']?.name }}</small>
                    </div>
                  </td>
                  <td class="reading" data-label="Valor" role="cell">
                    {{ value(row['value']) }} {{ row['sensor']?.unit }}
                  </td>
                  <td data-label="Calidad" role="cell">
                    <span
                      class="badge"
                      [attr.data-status]="
                        row['quality'] === 'GOOD'
                          ? 'SUCCESS'
                          : row['quality'] === 'BAD'
                            ? 'BAD'
                            : 'WARNING'
                      "
                      >{{ enumLabel(row['quality']) }}</span
                    >
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <div class="table-footer">
        <span
          >Página {{ page }} de {{ pages() || 1 }} ·
          {{ rows().length }} muestras</span
        >
        <div class="pagination">
          <button
            class="button"
            [disabled]="loading() || page <= 1"
            (click)="page = page - 1; load()"
          >
            Anterior</button
          ><button
            class="button"
            [disabled]="loading() || page >= pages()"
            (click)="page = page + 1; load()"
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
    <p class="chart-hint">
      Esta vista presenta muestras, no promedios diarios o mensuales. La
      actualización es manual.
    </p>`,
  styles: `
    .eyebrow {
      font-size: 0.62rem;
      letter-spacing: 0.12em;
      color: var(--primary);
      margin-bottom: 0.5rem;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: end;
      margin-bottom: 1.25rem;
    }
    .filters .field {
      flex: 1;
      min-width: 170px;
    }
    .panel {
      margin-bottom: 1rem;
    }
    .chart-hint {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin: 1rem 0;
    }
    .reading {
      max-width: 320px;
      overflow-wrap: anywhere;
    }
    .table-scroll {
      max-height: 60vh;
    }
    .alert {
      margin-bottom: 1rem;
    }
    @media (max-width: 600px) {
      .filters { display: grid; grid-template-columns: minmax(0, 1fr); gap: .75rem; }
      .filters .field { min-width: 0; }
      .table-scroll { max-height: none; }
    }
  `,
})
export class MonitoringPage implements OnInit {
  private readonly toast = inject(Toast);
  readonly enumLabel = enumLabel;
  private readonly api = inject(ApiService);
  readonly state = inject(AuthState);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly sensors = signal<Entity[]>([]);
  readonly rows = signal<Entity[]>([]);
  readonly chart = signal<MeasurementPoint[]>([]);
  readonly chartUnit = signal('');
  readonly chartLabel = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly total = signal(0);
  readonly pages = signal(0);
  sensor = '';
  private readonly route = inject(ActivatedRoute);
  readonly deviceId = this.route.snapshot?.queryParamMap?.get('device') || '';
  from = '';
  to = '';
  quality = '';
  page = 1;
  clearFilters() { this.sensor = ''; this.from = ''; this.to = ''; this.quality = ''; this.load(true); }
  ngOnInit() {
    this.sensor = this.route.snapshot?.queryParamMap?.get('sensor') || '';
    if (this.state.has('sensors.read'))
      void this.api
        .options('iot/sensors', { is_active: true, ...(this.deviceId ? { device_external_id: this.deviceId } : {}) })
        .then((rows) => this.sensors.set(rows.filter((sensor) => sensor['is_active'] !== false)))
        .catch((error) => this.toast.fire({ icon: 'error', text: errorMessage(error) }));
    else
      this.toast.fire({ icon: 'error', text: 'Sin permiso para consultar el catálogo de sensores. Puedes consultar el historial completo.' });
    this.load();
  }
  date(value: string) {
    return new Date(value).toLocaleString('es', {
      timeZone: this.state.identity()?.tenant.timezone,
    });
  }
  value(value: unknown) {
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  load(reset = false) {
    if (reset) this.page = 1;
    this.error.set('');
    if (this.from && this.to && new Date(this.from) > new Date(this.to)) {
      this.toast.report(this.error, 'error', 'La fecha inicial debe ser anterior a la fecha final.');
      return;
    }
    this.request?.unsubscribe();
    this.loading.set(true);
    this.rows.set([]);
    this.chart.set([]);
    const query: Record<string, string | number> = {
      page: this.page,
      page_size: 50,
    };
    if (this.sensor) query['sensor_external_id'] = this.sensor;
    if (this.deviceId) query['device_external_id'] = this.deviceId;
    if (this.from) query['from'] = new Date(this.from).toISOString();
    if (this.to) query['to'] = new Date(this.to).toISOString();
    if (this.quality) query['quality'] = this.quality;
    this.request = this.api
      .list('iot/measurements', query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.rows.set(result.data);
          this.total.set(result.pagination.total);
          this.pages.set(result.pagination.total_pages);
          this.loading.set(false);
          if (this.sensor) {
            const points = [...result.data]
              .reverse()
              .filter(
                (row) =>
                  typeof row['value'] === 'number' &&
                  Number.isFinite(row['value']),
              );
            this.chart.set(
              points.map((row) => ({
                at: this.date(row['observed_at']),
                value: row['value'],
                timestamp: new Date(row['observed_at']).getTime(),
              })),
            );
            this.chartUnit.set(result.data[0]?.['sensor']?.unit || '');
            this.chartLabel.set(
              result.data[0]?.['sensor']?.name || 'Mediciones',
            );
          }
        },
        error: (error) => {
          this.loading.set(false);
          this.total.set(0);
          this.pages.set(0);
          this.toast.report(this.error, 'error', errorMessage(error));
        },
      });
  }
}
