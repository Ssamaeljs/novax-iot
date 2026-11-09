import { EditorModal } from '../../shared/ui/editor-modal.component';
import { Toast } from '../../shared/ui/toast.service';
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
import { FormFocusDirective } from '../../shared/ui/form-focus.directive';
@Component({
  imports: [EditorModal, ReactiveFormsModule, FormFocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="section-title">
      <div>
        <h1>Opciones avanzadas</h1>
        <p>Administración de NOVAX · Acceso restringido al propietario</p>
      </div>
    </header>
    <section class="card card-body stack advanced">
      <p class="alert" data-status="WARNING">
        Estos cambios afectan a todos los integrantes de NOVAX.
      </p>
      <dl><dt>Organización</dt><dd>{{ state.identity()?.tenant?.name }}</dd><dt>Zona horaria</dt><dd>{{ state.identity()?.tenant?.timezone }}</dd></dl>
      <button class="button" type="button" [disabled]="!state.has('tenants.manage')" (click)="open()">Editar organización</button>
      @if (editing()) {
      <app-editor-modal title="Editar organización" [busy]="busy()" (dismissed)="close()">
      <form appFormFocus class="stack" [formGroup]="form" (ngSubmit)="save()" [attr.aria-busy]="busy()">
        <label class="field"
          >Nombre de la organización<input formControlName="name" /></label
        ><label class="field"
          >Zona horaria IANA<input formControlName="timezone" /><small
            >Por ejemplo: America/Guayaquil.</small
          ></label
        >
        @if (form.touched && form.invalid) {
          <small class="field-error"
            >Revisa el nombre y la zona horaria.</small
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
      </app-editor-modal>
      }
    </section>`,
  styles: `
    .advanced {
      max-width: 680px;
    }
  `,
})
export class AdvancedPage {
  private readonly toast = inject(Toast);
  readonly state = inject(AuthState);
  private readonly api = inject(ApiService);
  readonly busy = signal(false);
  readonly editing = signal(false);
  readonly form = new FormGroup({
    name: new FormControl(this.state.identity()!.tenant.name, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(120),
      ],
    }),
    timezone: new FormControl(this.state.identity()!.tenant.timezone, {
      nonNullable: true,
      validators: Validators.required,
    }),
  });
  open() {
    const tenant = this.state.identity()?.tenant;
    if (!tenant || !this.state.has('tenants.manage')) return;
    this.form.reset({ name: tenant.name, timezone: tenant.timezone });
    this.editing.set(true);
  }
  close() {
    if (this.busy() || (this.form.dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'))) return;
    this.editing.set(false);
  }
  async save() {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const payload = this.form.getRawValue();
    try {
      new Intl.DateTimeFormat('es', { timeZone: payload.timezone });
    } catch {
      this.toast.fire({ icon: 'error', text: 'Zona horaria no válida.' });
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
      this.editing.set(false);
      this.toast.fire({ icon: 'success', text: 'Organización actualizada.' });
    } catch (error) {
      this.toast.fire({ icon: 'error', text: errorMessage(error) });
    } finally {
      this.busy.set(false);
    }
  }
}
