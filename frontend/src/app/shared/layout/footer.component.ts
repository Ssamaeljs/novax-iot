import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<footer>
    <a routerLink="/" class="brand">Novax<span>IoT</span></a
    ><span>Infraestructura conectada. Control centralizado.</span
    ><a routerLink="/design-system">Sistema visual</a>
  </footer>`,
  styles: `
    footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.5rem 2rem;
      border-top: 1px solid var(--border-default);
      color: var(--text-muted);
      font-size: 0.75rem;
    }
    a {
      text-decoration: none;
    }
    .brand {
      font-weight: 750;
      color: var(--text-primary);
      font-size: 1rem;
    }
    .brand span {
      color: var(--primary);
      margin-left: 0.25rem;
    }
  `,
})
export class FooterComponent {}
