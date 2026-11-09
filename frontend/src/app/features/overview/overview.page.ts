import { Toast } from '../../shared/ui/toast.service';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, errorMessage } from '../../core/api/api.service';
import { AuthState } from '../../core/auth/auth-state.service';
import { IconComponent, IconName } from '../../shared/ui/icon.component';
interface Metric {
  label: string;
  path: string;
  icon: IconName;
  permission: string;
  query?: Record<string, string | boolean>;
  target: string;
  count?: number;
  error?: string;
}
@Component({
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="section-title">
      <div>
        <p class="eyebrow">VISTA GENERAL</p>
        <h1>Centro de operaciones</h1>
        <p>
          Este es el estado registrado de tu organización.
          {{ updated() ? 'Actualizado: ' + updated() : '' }}
        </p>
      </div>
      <button class="button" [disabled]="loading()" (click)="load()">
        <app-icon name="activity" />Actualizar
      </button>
    </header>
    <nav class="cluster operational-actions" aria-label="Acciones operativas">
      @if (state.has('measurements.write')) { <a class="button button--primary" routerLink="/app/operations/measurements">Registrar lectura</a> }
      @if (state.has('measurements.read')) { <a class="button" routerLink="/app/monitoring">Consultar mediciones</a> }
      @if (state.has('devices.read')) { <a class="button" routerLink="/app/operations/devices">Gestionar dispositivos</a> }
      @if (state.has('projects.read')) { <a class="button" routerLink="/app/projects">Abrir tableros</a> }
    </nav>
    <div class="metrics">
      @for (metric of metrics(); track metric.label) {
        <a class="card card-body metric" [routerLink]="metric.target"
          ><div class="cluster">
            <span class="device-icon"><app-icon [name]="metric.icon" /></span
            ><span>{{ metric.label }}</span>
          </div>
          <strong>{{ loading() ? '…' : (metric.count ?? '—') }}</strong
          ><small>{{ metric.error || 'Ver catálogo' }}</small></a
        >
      }
    </div>
    <div class="workspace-panels">
      <section class="card card-body stack">
        <p class="eyebrow">TU RUTA DE TRABAJO</p>
        <h2>De la configuración a las mediciones</h2>
        <ol class="steps">
          @if (state.has('devices.read')) {
            <li>
              <a routerLink="/app/operations/devices"
                >Registra tus dispositivos</a
              >
              <p>Identifica el tipo, protocolo y nombre de cada equipo.</p>
            </li>
          }
          @if (state.has('sensors.read')) {
            <li>
              <a routerLink="/app/operations/sensors"
                >Define sensores y métricas</a
              >
              <p>Asocia cada sensor a su dispositivo, unidad y tipo de dato.</p>
            </li>
          }
          @if (state.has('measurements.read')) {
            <li>
              <a routerLink="/app/monitoring">Consulta las mediciones</a>
              <p>
                Filtra por sensor, revisa la calidad y consulta el historial.
              </p>
            </li>
          }
        </ol>
      </section>
      <section class="card card-body stack">
        <p class="eyebrow">IDENTIDAD Y CONTROL</p>
        <h2>{{ state.identity()?.tenant?.name }}</h2>
        <p class="muted">Organización: {{ state.identity()?.tenant?.slug }}</p>
        <p class="muted">
          Zona horaria: {{ state.identity()?.tenant?.timezone }}
        </p>
        <div class="cluster">
          @for (role of state.identity()?.roles; track role.external_id) {
            <span class="badge" data-status="INFO">{{ role.name }}</span>
          }
        </div>
        <a class="button" routerLink="/app/account">Administrar mi cuenta</a>
        @if (state.has('audit_logs.read')) {
          <a class="button button--ghost" routerLink="/app/administration/audit"
            >Consultar auditoría</a
          >
        }
      </section>
    </div>
    <p class="scope-note">
      <app-icon name="info" /> La ingesta admite HTTPS y MQTT mediante fuentes configuradas.
      La conexión al broker y los tiempos de presencia se consultan en Integraciones.
    </p>`,
  styles: `
    .eyebrow {
      font-size: 0.62rem;
      color: var(--primary);
      letter-spacing: 0.12em;
      margin-bottom: 0.5rem;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin: 1.5rem 0;
    }
    .metric {
      text-decoration: none;
      color: var(--text-primary);
      display: grid;
      gap: 1rem;
    }
    .metric .cluster {
      font-size: 0.78rem;
    }
    .metric > strong {
      font-size: 2.2rem;
      font-weight: 650;
    }
    .metric small {
      font-size: 0.7rem;
    }
    .workspace-panels {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 1.25rem;
    }
    .steps {
      padding-left: 1.2rem;
      margin: 0;
      display: grid;
      gap: 1.5rem;
    }
    .steps a {
      font-size: 0.87rem;
      font-weight: 600;
    }
    .steps p {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 0.4rem;
    }
    .scope-note {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
      color: var(--text-muted);
      font-size: 0.75rem;
      margin-top: 1.5rem;
    }
    @media (max-width: 750px) {
      .workspace-panels {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 600px) {
      .operational-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
      .operational-actions .button { padding: .6rem .45rem; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .65rem; }
      .metric { gap: .65rem; }
      .metric .cluster { overflow-wrap: anywhere; }
    }
  `,
})
export class OverviewPage implements OnInit {
  private readonly toast = inject(Toast);
  readonly state = inject(AuthState);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(false);
  readonly updated = signal('');
  readonly metrics = signal<Metric[]>([]);
  private readonly definitions: Metric[] = [
    {
      label: 'Dispositivos activos',
      path: 'iot/devices',
      permission: 'devices.read',
      icon: 'device',
      query: { is_active: true },
      target: '/app/operations/devices',
    },
    {
      label: 'Conectados (estado reportado)',
      path: 'iot/devices',
      permission: 'devices.read',
      icon: 'signal',
      query: { status: 'ONLINE', is_active: true },
      target: '/app/operations/devices',
    },
    {
      label: 'Desconectados (estado reportado)',
      path: 'iot/devices',
      permission: 'devices.read',
      icon: 'offline',
      query: { status: 'OFFLINE', is_active: true },
      target: '/app/operations/devices',
    },
    {
      label: 'Sensores activos',
      path: 'iot/sensors',
      permission: 'sensors.read',
      icon: 'sensor',
      query: { is_active: true },
      target: '/app/operations/sensors',
    },
  ];
  ngOnInit() {
    this.load();
  }
  load() {
    if (this.loading()) return;
    const available = this.definitions.filter((item) =>
      this.state.has(item.permission),
    );
    this.metrics.set(available);
    if (!available.length) return;
    this.loading.set(true);
    forkJoin(
      available.map((item) =>
        this.api.list(item.path, { page_size: 1, ...item.query }).pipe(
          map((result) => ({ ...item, count: result.pagination.total })),
          catchError((error) => {
            const message = errorMessage(error);
            this.toast.fire({ icon: 'error', text: message });
            return of({ ...item, error: message });
          }),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rows) => {
        this.metrics.set(rows);
        this.loading.set(false);
        this.updated.set(new Date().toLocaleTimeString('es'));
      });
  }
}
