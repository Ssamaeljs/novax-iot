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
type Mode = 'login' | 'register' | 'forgot-password' | 'reset-password';
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
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
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
    login: 'Bienvenido a tu workspace',
    register: 'Crea tu organización',
    'forgot-password': 'Recupera tu acceso',
    'reset-password': 'Una nueva contraseña',
  };
  readonly labels = {
    login: 'Ingresar',
    register: 'Crear organización',
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
          this.error.set(errorMessage(error));
          this.ready.set(true);
        },
      });
  }
  private configure() {
    this.error.set('');
    this.message.set('');
    this.token = '';
    this.returnUrl = safeReturnUrl(
      this.route.snapshot.queryParamMap.get('returnUrl'),
    );
    const tenant: AuthField = {
      key: 'tenant_slug',
      label: 'Identificador de organización',
      type: 'text',
      autocomplete: 'organization',
      min: 2,
      max: 80,
      pattern: '[a-z0-9]+(?:-[a-z0-9]+)*',
      value: this.route.snapshot.queryParamMap.get('tenant') || '',
      help: 'Por ejemplo: novax-iot. Tu administrador puede proporcionártelo.',
    };
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
        tenant,
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
        this.message.set('Tu sesión ha expirado. Ingresa nuevamente.');
      if (this.route.snapshot.queryParamMap.has('registered'))
        this.message.set('Organización creada. Ya puedes iniciar sesión.');
      if (this.route.snapshot.queryParamMap.has('unavailable'))
        this.error.set(
          'No pudimos verificar la sesión. Comprueba que el backend esté disponible.',
        );
    } else if (this.mode === 'register') {
      this.fields = [
        {
          key: 'tenant_name',
          label: 'Nombre de la organización',
          type: 'text',
          autocomplete: 'organization',
          min: 2,
          max: 120,
        },
        tenant,
        {
          key: 'timezone',
          label: 'Zona horaria IANA',
          type: 'text',
          autocomplete: 'off',
          max: 64,
          value:
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            'America/Guayaquil',
        },
        {
          key: 'first_name',
          label: 'Nombres',
          type: 'text',
          autocomplete: 'given-name',
          min: 2,
          max: 120,
        },
        {
          key: 'last_name',
          label: 'Apellidos',
          type: 'text',
          autocomplete: 'family-name',
          min: 1,
          max: 120,
        },
        {
          key: 'id_card',
          label: 'Documento de identidad',
          type: 'text',
          autocomplete: 'off',
          min: 5,
          max: 30,
          pattern: '[A-Za-z0-9-]+',
        },
        {
          key: 'username',
          label: 'Nombre de usuario',
          type: 'text',
          autocomplete: 'username',
          min: 3,
          max: 80,
        },
        email,
        secret,
      ];
    } else if (this.mode === 'forgot-password') this.fields = [tenant, email];
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
        this.error.set(
          'Abre el enlace del correo para restablecer tu contraseña.',
        );
    }
    if (this.mode === 'register' || this.mode === 'reset-password')
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
      (this.mode === 'register' && !this.capabilities().registration_enabled) ||
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
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    if (
      this.mode !== 'login' &&
      values['password'] &&
      new TextEncoder().encode(values['password']).length > 72
    ) {
      this.error.set('La contraseña supera el máximo de 72 bytes UTF-8.');
      return;
    }
    delete values['confirmation'];
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      if (this.mode === 'login') {
        await this.auth.login(values);
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
        if (this.mode === 'register') {
          await this.router.navigate(['/auth/login'], {
            queryParams: { tenant: values['tenant_slug'], registered: '1' },
          });
          this.message.set('Organización creada. Ya puedes iniciar sesión.');
        } else {
          this.message.set(result.data.message || 'Solicitud completada.');
          this.form.reset();
          if (this.mode === 'reset-password') this.token = '';
        }
      }
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
