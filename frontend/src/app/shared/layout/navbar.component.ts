import { Toast } from '../ui/toast.service';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthState } from '../../core/auth/auth-state.service';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeSelectorComponent } from '../ui/theme-selector.component';
import { IconComponent } from '../ui/icon.component';
import { errorMessage } from '../../core/api/api.service';
@Component({
  selector: 'app-navbar',
  imports: [RouterLink, ThemeSelectorComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="navbar" [class.navbar--workspace]="workspace()">
      <div class="cluster">
        @if (workspace()) {
          <button
            class="button button--ghost button--icon mobile-menu"
            aria-label="Abrir navegación"
            (click)="menu.emit()"
          >
            <app-icon name="menu" />
          </button>
          <div class="tenant">
            <small>ESPACIO DE TRABAJO</small
            ><strong [title]="state.identity()?.tenant?.name || ''">{{ state.identity()?.tenant?.name }}</strong>
          </div>
        } @else {
          <a routerLink="/" class="brand"
            ><app-icon name="layers" />Novax<span>IoT</span></a
          >
        }
      </div>
      <div class="cluster actions">
        <app-theme-selector />
        @if (state.identity(); as identity) {
          <details
            #profile
            class="dropdown"
            (keydown.escape)="profile.open = false; trigger.focus()"
            (focusout)="closeOnBlur($event, profile)"
          >
            <summary
              #trigger
              class="button button--ghost"
              aria-label="Opciones de usuario"
            >
              <span class="avatar"
                >{{ identity.user.first_name.charAt(0)
                }}{{ identity.user.last_name.charAt(0) }}</span
              ><span class="user-name">{{ identity.user.first_name }}</span
              ><app-icon name="down" />
            </summary>
            <nav
              class="dropdown-panel"
              aria-label="Opciones de usuario"
              (click)="profile.open = false"
            >
              <small class="identity">{{ identity.account.email }}</small
              ><a class="button button--ghost" routerLink="/app/overview"
                >Panel de trabajo</a
              ><a class="button button--ghost" routerLink="/app/account"
                >Cuenta</a
              ><a class="button button--ghost" routerLink="/app/settings"
                >Configuración</a
              >
              @if (state.owner()) {
                <a class="button button--ghost" routerLink="/app/advanced"
                  >Opciones avanzadas</a
                >
              }
              <button
                class="button button--ghost"
                [disabled]="busy()"
                (click)="logout()"
              >
                Cerrar sesión
              </button>
            </nav>
          </details>
        } @else {
          <a class="button button--primary" routerLink="/auth/login">Ingresar</a>
        }
      </div>
    </header>`,
  styles: `
    .navbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      min-height: 78px;
      padding: 1rem 2rem;
      border-bottom: 1px solid var(--border-default);
      background: var(--bg-surface);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--text-primary);
      font-size: 1.25rem;
      font-weight: 750;
      text-decoration: none;
    }
    .brand app-icon,
    .brand span {
      color: var(--primary);
    }
    .tenant {
      display: grid;
      gap: 0.1rem;
    }
    .tenant small {
      font-size: 0.6rem;
      letter-spacing: 0.1em;
    }
    .tenant strong {
      font-size: 0.85rem;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      color: var(--primary);
      background: var(--primary-soft);
      font-size: 0.72rem;
    }
    .identity {
      display: block;
      padding: 0.5rem;
      overflow-wrap: anywhere;
    }
    .dropdown-panel {
      width: 250px;
    }
    .mobile-menu {
      display: none;
    }
    @media (max-width: 950px) {
      .mobile-menu {
        display: inline-flex;
      }
    }
    @media (max-width: 650px) {
      .navbar {
        padding: 0.75rem 1rem;
        flex-wrap: wrap;
      }
      .actions {
        gap: 0.3rem;
      }
      .user-name {
        display: none;
      }
      .tenant {
        max-width: 180px;
      }
    }
    @media (max-width: 600px) {
      .navbar--workspace { flex-wrap: nowrap; padding: .6rem .75rem; gap: .5rem; min-height: 64px; }
      .navbar--workspace > .cluster { min-width: 0; flex-wrap: nowrap; gap: .35rem; }
      .navbar--workspace .tenant { max-width: 100px; }
      .tenant strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
    @media (max-width: 420px) { .navbar--workspace .tenant { display: none; } }
  `,
})
export class NavbarComponent {
  private readonly toast = inject(Toast);
  readonly workspace = input(false);
  readonly menu = output<void>();
  readonly state = inject(AuthState);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  closeOnBlur(event: FocusEvent, details: HTMLDetailsElement) {
    if (!details.contains(event.relatedTarget as Node)) details.open = false;
  }
  async logout() {
    this.busy.set(true);
    try {
      await this.auth.logout();
      this.toast.fire({ icon: 'success', text: 'Sesión cerrada.' });
      await this.router.navigate(['/auth/login']);
    } catch (error) {
      this.toast.fire({ icon: 'error', text: errorMessage(error) });
    } finally {
      this.busy.set(false);
    }
  }
}
