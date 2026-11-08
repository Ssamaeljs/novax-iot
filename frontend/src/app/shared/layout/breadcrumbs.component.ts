import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, startWith } from 'rxjs';
import { AuthState } from '../../core/auth/auth-state.service';

interface Breadcrumb {
  label: string;
  commands?: string[];
  permission?: string;
}
export interface BreadcrumbDefinition {
  label: string;
  parents?: Breadcrumb[];
  deviceContext?: boolean;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav aria-label="Ruta de navegación">
    <ol>
      @for (item of items(); track $index; let last = $last) {
        <li>
          @if (!$first) { <span class="separator" aria-hidden="true">/</span> }
          @if (!last && item.commands && (!item.permission || state.has(item.permission))) {
            <a [routerLink]="item.commands">{{ item.label }}</a>
          } @else {
            <span [attr.aria-current]="last ? 'page' : null">{{ item.label }}</span>
          }
        </li>
      }
    </ol>
  </nav>`,
  styles: `
    :host { display: block; margin-bottom: 1.25rem; min-width: 0; }
    ol { display: flex; flex-wrap: wrap; gap: .4rem .6rem; list-style: none; padding: 0; margin: 0; }
    li { display: flex; align-items: baseline; gap: .6rem; min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
    a { color: var(--primary); text-underline-offset: .2em; }
    a:hover { color: var(--primary-hover); text-decoration: underline; }
    .separator { color: var(--text-muted); }
    [aria-current='page'] { color: var(--text-primary); font-weight: 600; }
    @media (max-width: 600px) { :host { font-size: .875rem; margin-bottom: 1rem; } }
  `,
})
export class BreadcrumbsComponent {
  private readonly router = inject(Router);
  readonly state = inject(AuthState);
  private readonly navigation = toSignal(this.router.events.pipe(
    filter((event) => event instanceof NavigationEnd), startWith(null),
  ));
  readonly items = computed<Breadcrumb[]>(() => {
    this.navigation();
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    const definition = route.data['breadcrumb'] as BreadcrumbDefinition | undefined;
    const label = definition?.label || 'No encontrado';
    const items: Breadcrumb[] = [{ label: 'Inicio', commands: ['/app/overview'] }];
    if (route.routeConfig?.path === 'overview') return [{ label: 'Inicio' }];
    items.push(...(definition?.parents || []));
    const device = route.queryParamMap.get('device');
    if (definition?.deviceContext && device && UUID.test(device)) {
      items.push(
        { label: 'Dispositivos', commands: ['/app/operations/devices'], permission: 'devices.read' },
        { label: 'Dispositivo', commands: ['/app/device', device], permission: 'devices.read' },
      );
    }
    items.push({ label });
    return items;
  });
}
