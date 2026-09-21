import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  viewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../shared/layout/navbar.component';
import { FooterComponent } from '../shared/layout/footer.component';
import { NavigationComponent } from '../shared/layout/navigation.component';
import { IconComponent } from '../shared/ui/icon.component';
@Component({
  imports: [
    RouterOutlet,
    NavbarComponent,
    FooterComponent,
    NavigationComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button class="skip-link" (click)="content.focus()">
      Saltar al contenido
    </button>
    <aside class="sidebar"><app-navigation /></aside>
    <div class="workspace">
      <app-navbar [workspace]="true" (menu)="openNavigation()" />
      <main #content id="main-content" tabindex="-1"><router-outlet /></main>
      <app-footer />
    </div>
    <dialog
      #mobileNavigation
      class="mobile-navigation"
      aria-label="Navegación principal móvil"
    >
      <button
        class="button button--icon close-nav"
        aria-label="Cerrar navegación"
        (click)="closeNavigation()"
      >
        <app-icon name="close" /></button
      ><app-navigation (selected)="closeNavigation()" />
    </dialog>`,
  styles: `
    :host {
      display: block;
    }
    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      width: 244px;
      overflow: auto;
      z-index: 10;
    }
    .workspace {
      margin-left: 244px;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    app-navbar {
      position: sticky;
      top: 0;
      z-index: 5;
    }
    main {
      padding: 2rem;
      flex: 1;
      min-width: 0;
      outline: none;
    }
    .mobile-navigation {
      margin: 0;
      width: min(300px, 85vw);
      height: 100dvh;
      max-height: 100dvh;
      border: 0;
      border-radius: 0;
      background: var(--sidebar-bg);
    }
    .close-nav {
      position: absolute;
      top: 1rem;
      right: 0.7rem;
    }
    @media (max-width: 950px) {
      .sidebar {
        display: none;
      }
      .workspace {
        margin: 0;
      }
    }
    @media (max-width: 600px) {
      main {
        padding: 1.25rem 1rem;
      }
    }
  `,
})
export class WorkspaceLayoutComponent {
  private readonly mobileNavigation =
    viewChild.required<ElementRef<HTMLDialogElement>>('mobileNavigation');
  openNavigation() {
    this.mobileNavigation().nativeElement.showModal();
  }
  closeNavigation() {
    this.mobileNavigation().nativeElement.close();
  }
}
