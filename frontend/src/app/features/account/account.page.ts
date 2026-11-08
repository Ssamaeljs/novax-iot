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
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, errorMessage } from '../../core/api/api.service';
import { AuthState, Identity } from '../../core/auth/auth-state.service';
import { FormFocusDirective } from '../../shared/ui/form-focus.directive';
@Component({
  imports: [ReactiveFormsModule, FormFocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="section-title">
      <div>
        <h1>Mi cuenta</h1>
        <p>Tu identidad y la seguridad de tu acceso.</p>
      </div>
    </header>
    @if (error()) {
      <p class="alert" data-status="CRITICAL" role="alert">{{ error() }}</p>
    }
    @if (message()) {
      <p class="alert" data-status="SUCCESS" role="status">{{ message() }}</p>
    }
    <div class="account-grid">
      <section class="card card-body stack">
        <h2>Información personal</h2>
        <p class="muted">
          {{ state.identity()?.account?.email }}<br />{{
            state.identity()?.account?.username
          }}
        </p>
        <form appFormFocus [formGroup]="profile" class="stack" (ngSubmit)="saveProfile()" [attr.aria-busy]="busy()">
          <label class="field"
            >Nombres<input
              formControlName="first_name"
              autocomplete="given-name" /></label
          ><label class="field"
            >Apellidos<input
              formControlName="last_name"
              autocomplete="family-name"
          /></label>
          @if (profile.touched && profile.invalid) {
            <small class="field-error"
              >Completa tus nombres (mínimo 2 caracteres) y apellidos.</small
            >
          }
          <button
            class="button button--primary"
            [disabled]="busy()"
            type="submit"
          >
            Guardar información
          </button>
        </form>
        <small
          >El documento, correo y usuario son administrados por tu
          organización.</small
        >
      </section>
      <section class="card card-body stack">
        <h2>Cambiar contraseña</h2>
        <p class="muted">
          Esta acción cerrará todas tus sesiones. Deberás volver a ingresar.
        </p>
        <form appFormFocus
          [formGroup]="password"
          class="stack"
          (ngSubmit)="changePassword()"
        >
          <label class="field"
            >Contraseña actual<input
              type="password"
              autocomplete="current-password"
              formControlName="current_password" /></label
          ><label class="field"
            >Nueva contraseña<input
              type="password"
              autocomplete="new-password"
              formControlName="password"
            /><small>Mínimo 12 caracteres, máximo 72 bytes UTF-8.</small></label
          ><label class="field"
            >Confirmar nueva contraseña<input
              type="password"
              autocomplete="new-password"
              formControlName="confirmation"
          /></label>
          @if (password.touched && password.invalid) {
            <small class="field-error"
              >Completa los campos y revisa la longitud de la nueva
              contraseña.</small
            >
          }
          <button class="button" [disabled]="busy()" type="submit">
            Actualizar contraseña
          </button>
        </form>
      </section>
    </div>`,
  styles: `
    .account-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      max-width: 1000px;
    }
    .muted {
      font-size: 0.82rem;
    }
    .alert {
      margin-bottom: 1rem;
    }
    @media (max-width: 750px) {
      .account-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class AccountPage {
  readonly state = inject(AuthState);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly profile = new FormGroup({
    first_name: new FormControl(this.state.identity()!.user.first_name, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(120),
      ],
    }),
    last_name: new FormControl(this.state.identity()!.user.last_name, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
    }),
  });
  readonly password = new FormGroup({
    current_password: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(12),
        Validators.maxLength(128),
      ],
    }),
    confirmation: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
  });
  async saveProfile() {
    this.profile.markAllAsTouched();
    if (this.profile.invalid || this.busy()) return;
    await this.run(async () => {
      const { data } = await firstValueFrom(
        this.api.patch<Identity>('auth/me', this.profile.getRawValue()),
      );
      this.state.identity.set(data);
      this.message.set('Información actualizada.');
    });
  }
  async changePassword() {
    this.password.markAllAsTouched();
    if (this.password.invalid || this.busy()) return;
    const payload = this.password.getRawValue();
    if (payload.password !== payload.confirmation) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    await this.run(async () => {
      await firstValueFrom(
        this.api.post('auth/change-password', {
          current_password: payload.current_password,
          password: payload.password,
        }),
      );
      this.password.reset();
      this.state.identity.set(null);
      await this.router.navigate(['/auth/login']);
    });
  }
  private async run(action: () => Promise<void>) {
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
