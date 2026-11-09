import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Toast } from './toast.service';

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack">
      @for (message of toast.messages(); track message.id) {
        <div class="toast alert" [attr.data-status]="message.icon === 'error' ? 'CRITICAL' : message.icon === 'success' ? 'SUCCESS' : 'INFO'">
          <div [attr.role]="message.icon === 'error' ? 'alert' : 'status'">
            <strong>{{ message.icon === 'error' ? 'Error' : message.icon === 'success' ? 'Completado' : 'Información' }}</strong>
            <p>{{ message.text }}</p>
          </div>
          <button type="button" class="button button--ghost button--icon" aria-label="Cerrar notificación" (click)="toast.dismiss(message.id)">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-stack {
      position: fixed;
      z-index: 1000;
      inset-block-end: max(.75rem, env(safe-area-inset-bottom));
      inset-inline-end: .75rem;
      width: min(26rem, calc(100vw - 1.5rem));
      max-height: min(45dvh, 24rem);
      overflow: auto;
      display: grid;
      gap: .5rem;
    }
    .toast { display: flex; justify-content: space-between; gap: .5rem; align-items: start; box-shadow: var(--shadow-overlay); }
    .toast p { margin: 0; overflow-wrap: anywhere; }
    .toast .button { flex: none; }
  `,
})
export class ToastOutlet {
  readonly toast = inject(Toast);
}
