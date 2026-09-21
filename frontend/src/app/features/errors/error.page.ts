import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/ui/icon.component';
@Component({
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="error-page">
    <span class="device-icon"
      ><app-icon [name]="forbidden ? 'shield' : 'search'"
    /></span>
    <p class="code">{{ forbidden ? '403' : '404' }}</p>
    <h1>
      {{ forbidden ? 'Acceso restringido' : 'No encontramos esta página' }}
    </h1>
    <p>
      {{
        forbidden
          ? 'Tu cuenta no tiene los permisos necesarios. Solicita acceso al administrador de tu organización.'
          : 'La dirección puede haber cambiado o no existir. Puedes volver al inicio o a tu espacio de trabajo.'
      }}
    </p>
    <div class="cluster">
      <a class="button button--primary" routerLink="/app/overview"
        >Ir a mi workspace</a
      ><a class="button" routerLink="/">Volver al inicio</a>
    </div>
  </section>`,
  styles: `
    .error-page {
      display: grid;
      justify-items: center;
      text-align: center;
      gap: 1rem;
      padding: 5rem 1.5rem;
    }
    .code {
      font-size: 4rem;
      font-weight: 750;
      color: var(--primary);
      letter-spacing: -0.05em;
    }
    .error-page > p:not(.code) {
      color: var(--text-secondary);
      max-width: 500px;
    }
    .cluster {
      justify-content: center;
      margin-top: 1rem;
    }
  `,
})
export class ErrorPage {
  readonly forbidden =
    inject(ActivatedRoute).snapshot.data['forbidden'] === true;
}
