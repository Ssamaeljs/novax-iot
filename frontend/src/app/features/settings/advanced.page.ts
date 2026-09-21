import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService, errorMessage } from '../../core/api/api.service';
import { AuthState } from '../../core/auth/auth-state.service';
@Component({
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="section-title">
      <div>
        <h1>Opciones avanzadas</h1>
        <p>Administración de la organización · Solo TENANT_OWNER</p>
      </div>
    </header>
    <section class="card card-body stack advanced">
      <p class="alert" data-status="WARNING">
        Estos cambios afectan a todos los miembros. Si modificas el
        identificador, deberán usar el nuevo al iniciar sesión.
      </p>
      @if (error()) {
        <p class="alert" data-status="CRITICAL" role="alert">{{ error() }}</p>
      }
      @if (message()) {
        <p class="alert" data-status="SUCCESS" role="status">{{ message() }}</p>
      }
      <form class="stack" [formGroup]="form" (ngSubmit)="save()">
        <label class="field"
          >Nombre de la organización<input formControlName="name" /></label
        ><label class="field"
          >Identificador de acceso<input formControlName="slug" /></label
        ><label class="field"
          >Zona horaria IANA<input formControlName="timezone" /><small
            >Por ejemplo: America/Guayaquil.</small
          ></label
        >
        @if (form.touched && form.invalid) {
          <small class="field-error"
            >Revisa los campos obligatorios y el formato del
            identificador.</small
          >
        }
        <button
          class="button button--primary"
          [disabled]="busy() || !state.has('tenants.manage')"
          type="submit"
        >
          {{ busy() ? 'Guardando…' : 'Guardar organización' }}
        </button>
      </form>
    </section>`,
  styles: `
    .advanced {
      max-width: 680px;
    }
  `,
})
export class AdvancedPage {
  readonly state = inject(AuthState);
  private readonly api = inject(ApiService);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly form = new FormGroup({
    name: new FormControl(this.state.identity()!.tenant.name, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(120),
      ],
    }),
    slug: new FormControl(this.state.identity()!.tenant.slug, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(80),
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ],
    }),
    timezone: new FormControl(this.state.identity()!.tenant.timezone, {
      nonNullable: true,
      validators: Validators.required,
    }),
  });
  async save() {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.error.set('');
    this.message.set('');
    const payload = this.form.getRawValue();
    try {
      new Intl.DateTimeFormat('es', { timeZone: payload.timezone });
    } catch {
      this.error.set('Zona horaria no válida.');
      return;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.api.patch(
          `core/tenants/${this.state.identity()!.tenant.external_id}`,
          payload,
        ),
      );
      this.state.identity.update((identity) =>
        identity
          ? { ...identity, tenant: { ...identity.tenant, ...payload } }
          : null,
      );
      this.message.set('Organización actualizada.');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
