import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeSelectorComponent } from '../../shared/ui/theme-selector.component';
import { AuthState } from '../../core/auth/auth-state.service';
@Component({
  imports: [ThemeSelectorComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="section-title">
      <div>
        <h1>Configuración</h1>
        <p>Personaliza tu experiencia de trabajo.</p>
      </div>
    </header>
    <div class="stack settings">
      <section class="card card-body stack">
        <h2>Apariencia</h2>
        <p class="muted">
          Elige Light, Dark o System. La preferencia se guarda en este navegador
          y se aplica a toda la plataforma.
        </p>
        <app-theme-selector />
      </section>
      <section class="card card-body stack">
        <h2>Contexto de la organización</h2>
        <dl>
          <dt>Organización</dt>
          <dd>{{ state.identity()?.tenant?.name }}</dd>
          <dt>Identificador</dt>
          <dd>{{ state.identity()?.tenant?.slug }}</dd>
          <dt>Zona horaria</dt>
          <dd>{{ state.identity()?.tenant?.timezone }}</dd>
        </dl>
        <p class="muted">
          Las lecturas se almacenan con su instante original y se presentan en
          la zona horaria de tu organización.
        </p>
        @if (state.owner()) {
          <a class="button" routerLink="/app/advanced"
            >Opciones avanzadas de la organización</a
          >
        }
      </section>
    </div>`,
  styles: `
    .settings {
      max-width: 750px;
    }
    .muted {
      font-size: 0.83rem;
    }
    dl {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 0.75rem;
      font-size: 0.83rem;
    }
    dt {
      color: var(--text-muted);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class SettingsPage {
  readonly state = inject(AuthState);
}
