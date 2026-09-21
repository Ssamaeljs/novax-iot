import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../shared/layout/navbar.component';
import { FooterComponent } from '../shared/layout/footer.component';
@Component({
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  template: `<app-navbar />
    <main id="main-content"><router-outlet /></main>
    <app-footer />`,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }
    main {
      flex: 1;
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicLayoutComponent {}
