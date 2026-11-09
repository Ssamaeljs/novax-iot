import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { ToastOutlet } from './toast-outlet.component';

@Component({
  selector: 'app-editor-modal',
  imports: [ToastOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialog class="editor-modal" [attr.aria-label]="title()" (cancel)="$event.preventDefault(); dismissed.emit()">
      <div class="dialog-content stack">
        <header class="section-title">
          <h2>{{ title() }}</h2>
          <button type="button" class="button button--ghost button--icon" aria-label="Cerrar modal" [disabled]="busy()" (click)="dismissed.emit()">×</button>
        </header>
        <ng-content />
      </div>
      <app-toasts />
    </dialog>
  `,
})
export class EditorModal {
  readonly title = input.required<string>();
  readonly busy = input(false);
  readonly dismissed = output<void>();
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog()?.nativeElement.showModal());
  }

  ngOnDestroy() {
    const dialog = this.dialog()?.nativeElement;
    if (dialog?.open) dialog.close();
  }
}
