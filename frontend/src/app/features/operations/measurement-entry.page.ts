import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, Entity, errorMessage } from '../../core/api/api.service';
import { AuthState } from '../../core/auth/auth-state.service';
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="section-title">
      <div>
        <p class="eyebrow">OPERACIÓN</p>
        <h1>Registrar medición</h1>
        <p>
          Ingreso manual de una lectura. El dispositivo se determina a partir
          del sensor seleccionado.
        </p>
      </div>
    </header>
    <section class="card card-body entry">
      <p class="alert">
        Útil para pruebas y carga manual. La ingestión automatizada utiliza la
        API de mediciones con un token de permisos limitados.
      </p>
      @if (error()) {
        <p class="alert" data-status="CRITICAL" role="alert">{{ error() }}</p>
      }
      @if (message()) {
        <p class="alert" data-status="SUCCESS" role="status">{{ message() }}</p>
      }
      <form [formGroup]="form" class="stack" (ngSubmit)="submit()">
        <label class="field"
          >Sensor<select
            formControlName="sensor_external_id"
            (change)="form.controls.value.reset('')"
          >
            <option value="">Seleccionar sensor…</option>
            @for (sensor of sensors(); track sensor.external_id) {
              <option [value]="sensor.external_id">
                {{ sensor['name'] }} · {{ sensor['device']?.name }} ·
                {{ sensor['data_type'] }}
              </option>
            }
          </select></label
        ><label class="field"
          >Fecha y hora observada (hora local)<input
            type="datetime-local"
            formControlName="observed_at" /></label
        ><label class="field"
          >Valor
          {{ selected()?.['unit'] ? '(' + selected()?.['unit'] + ')' : '' }}
          @if (selected()?.['data_type'] === 'BOOLEAN') {
            <select formControlName="value">
              <option value="">Seleccionar…</option>
              <option value="true">Verdadero</option>
              <option value="false">Falso</option>
            </select>
          } @else if (selected()?.['data_type'] === 'JSON') {
            <textarea
              formControlName="value"
              placeholder='{"valor": 1}'
            ></textarea>
          } @else {
            <input
              [type]="
                selected()?.['data_type'] === 'NUMBER' ? 'number' : 'text'
              "
              step="any"
              formControlName="value"
            />
          }</label
        ><label class="field"
          >Calidad<select formControlName="quality">
            <option>GOOD</option>
            <option>UNCERTAIN</option>
            <option>BAD</option>
          </select></label
        >
        @if (form.touched && form.invalid) {
          <p class="field-error">Completa el sensor, la fecha y el valor.</p>
        }
        <div class="cluster">
          <button
            class="button button--primary"
            [disabled]="busy() || !sensors().length"
            type="submit"
          >
            {{ busy() ? 'Registrando…' : 'Registrar lectura' }}
          </button>
          @if (state.has('measurements.read')) {
            <a class="button" routerLink="/app/monitoring"
              >Consultar historial</a
            >
          }
        </div>
      </form>
    </section>`,
  styles: `
    .entry {
      max-width: 680px;
      display: grid;
      gap: 1.5rem;
    }
    .eyebrow {
      font-size: 0.62rem;
      letter-spacing: 0.12em;
      color: var(--primary);
      margin-bottom: 0.5rem;
    }
  `,
})
export class MeasurementEntryPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly state = inject(AuthState);
  readonly sensors = signal<Entity[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly form = new FormGroup({
    sensor_external_id: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    observed_at: new FormControl(this.localNow(), {
      nonNullable: true,
      validators: Validators.required,
    }),
    value: new FormControl<any>('', Validators.required),
    quality: new FormControl('GOOD', {
      nonNullable: true,
      validators: Validators.required,
    }),
  });
  ngOnInit() {
    if (!this.state.has('sensors.read')) {
      this.error.set(
        'Necesitas sensors.read para seleccionar un sensor y registrar mediciones desde esta pantalla.',
      );
      return;
    }
    void this.api
      .options('iot/sensors', { is_active: true })
      .then((rows) => this.sensors.set(rows))
      .catch((error) => this.error.set(errorMessage(error)));
  }
  selected() {
    return this.sensors().find(
      (sensor) =>
        sensor.external_id === this.form.controls.sensor_external_id.value,
    );
  }
  private localNow() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  async submit() {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.selected()) return;
    this.error.set('');
    this.message.set('');
    this.busy.set(true);
    try {
      const payload = this.form.getRawValue();
      const type = this.selected()!['data_type'];
      if (type === 'NUMBER') {
        payload.value = Number(payload.value);
        if (!Number.isFinite(payload.value))
          throw new Error('Introduce un número válido.');
      } else if (type === 'BOOLEAN') payload.value = payload.value === 'true';
      else if (type === 'JSON') {
        try {
          payload.value = JSON.parse(payload.value);
        } catch {
          throw new Error('El valor no es un JSON válido.');
        }
      }
      await firstValueFrom(
        this.api.post('iot/measurements', {
          ...payload,
          observed_at: new Date(payload.observed_at).toISOString(),
        }),
      );
      this.message.set('Medición registrada correctamente.');
      this.form.controls.value.reset('');
      this.form.controls.observed_at.setValue(this.localNow());
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
