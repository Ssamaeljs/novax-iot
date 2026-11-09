import { Toast } from '../../shared/ui/toast.service';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ApiService, errorMessage } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { safeReturnUrl } from '../../core/auth/auth.guards';
import { IconComponent } from '../../shared/ui/icon.component';
import { FormFocusDirective } from '../../shared/ui/form-focus.directive';
type Mode = 'login' | 'forgot-password' | 'reset-password';
interface AuthField {
  key: string;
  label: string;
  type: string;
  autocomplete: string;
  min?: number;
  max: number;
  value?: string;
  pattern?: string;
  help?: string;
}
@Component({
  imports: [ReactiveFormsModule, RouterLink, IconComponent, FormFocusDirective],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage implements OnInit {
  private readonly toast = inject(Toast);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly ready = signal(false);
  readonly capabilities = signal({
    registration_enabled: false,
    password_recovery_enabled: false,
  });
  mode: Mode = 'login';
  fields: AuthField[] = [];
  form = new FormGroup<Record<string, FormControl<string>>>({});
  private token = '';
  private returnUrl = '/app/overview';
  readonly headings = {
    login: 'Inicia sesión en NOVAX',
    'forgot-password': 'Recupera tu acceso',
    'reset-password': 'Una nueva contraseña',
  };
  readonly labels = {
    login: 'Ingresar',
    'forgot-password': 'Enviar enlace de recuperación',
    'reset-password': 'Restablecer contraseña',
  };
  ngOnInit() {
    this.route.data
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        this.mode = data['mode'];
        this.configure();
      });
    this.api
      .get<{
        registration_enabled: boolean;
        password_recovery_enabled: boolean;
      }>('auth/capabilities')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          this.capabilities.set(data);
          this.ready.set(true);
        },
        error: (error) => {
          this.toast.fire({ icon: 'error', text: errorMessage(error) });
          this.ready.set(true);
        },
      });
  }
  private configure() {
    this.token = '';
    this.returnUrl = safeReturnUrl(
      this.route.snapshot.queryParamMap.get('returnUrl'),
    );
    const secret: AuthField = {
      key: 'password',
      label: 'Contraseña',
      type: 'password',
      autocomplete: this.mode === 'login' ? 'current-password' : 'new-password',
      min: this.mode === 'login' ? 1 : 12,
      max: 128,
      help:
        this.mode === 'login'
          ? undefined
          : 'Al menos 12 caracteres; máximo 72 bytes UTF-8.',
    };
    const email: AuthField = {
      key: 'email',
      label: 'Correo electrónico',
      type: 'email',
      autocomplete: 'email',
      max: 160,
    };
    if (this.mode === 'login') {
      this.fields = [
        {
          key: 'identifier',
          label: 'Usuario o correo electrónico',
          type: 'text',
          autocomplete: 'username',
          min: 3,
          max: 160,
        },
        secret,
      ];
      if (this.route.snapshot.queryParamMap.has('expired'))
        this.toast.fire({ icon: 'info', text: 'Tu sesión ha expirado. Ingresa nuevamente.' });
      if (this.route.snapshot.queryParamMap.has('unavailable'))
        this.toast.fire({ icon: 'error', text: 'No pudimos verificar la sesión. Comprueba que el backend esté disponible.' });
    } else if (this.mode === 'forgot-password') this.fields = [email];
    else {
      this.fields = [secret];
      this.token =
        new URLSearchParams(this.route.snapshot.fragment || '').get('token') ||
        '';
      void this.router.navigate([], {
        relativeTo: this.route,
        fragment: undefined,
        replaceUrl: true,
      });
      if (!this.token)
        this.toast.fire({ icon: 'error', text: 'Abre el enlace del correo para restablecer tu contraseña.' });
    }
    if (this.mode === 'reset-password')
      this.fields.push({
        key: 'confirmation',
        label: 'Confirmar contraseña',
        type: 'password',
        autocomplete: 'new-password',
        min: 12,
        max: 128,
      });
    const controls: Record<string, FormControl<string>> = {};
    for (const field of this.fields)
      controls[field.key] = new FormControl(field.value || '', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.maxLength(field.max),
          ...(field.min ? [Validators.minLength(field.min)] : []),
          ...(field.type === 'email' ? [Validators.email] : []),
          ...(field.pattern ? [Validators.pattern(field.pattern)] : []),
        ],
      });
    this.form = new FormGroup(controls);
  }
  unavailable() {
    return (
      (this.mode === 'forgot-password' &&
        !this.capabilities().password_recovery_enabled) ||
      (this.mode === 'reset-password' && !this.token)
    );
  }
  async submit() {
    if (this.busy() || this.unavailable()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const values = this.form.getRawValue();
    if (
      values['confirmation'] !== undefined &&
      values['confirmation'] !== values['password']
    ) {
      this.toast.fire({ icon: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }
    if (
      this.mode !== 'login' &&
      values['password'] &&
      new TextEncoder().encode(values['password']).length > 72
    ) {
      this.toast.fire({ icon: 'error', text: 'La contraseña supera el máximo de 72 bytes UTF-8.' });
      return;
    }
    delete values['confirmation'];
    this.busy.set(true);
    try {
      if (this.mode === 'login') {
        await this.auth.login(values);
        this.toast.fire({ icon: 'success', text: 'Sesión iniciada.' });
        await this.router.navigateByUrl(this.returnUrl);
      } else {
        const result = await firstValueFrom(
          this.api.post<{ message?: string }>(
            `auth/${this.mode}`,
            this.mode === 'reset-password'
              ? { password: values['password'], token: this.token }
              : values,
          ),
        );
        this.toast.fire({ icon: 'success', text: result.data.message || 'Solicitud completada.' });
        this.form.reset();
        if (this.mode === 'reset-password') this.token = '';
      }
    } catch (error) {
      this.toast.fire({ icon: 'error', text: errorMessage(error) });
    } finally {
      this.busy.set(false);
    }
  }
}
