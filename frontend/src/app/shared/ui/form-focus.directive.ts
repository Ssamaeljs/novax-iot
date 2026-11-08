import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { FormGroupDirective } from '@angular/forms';

/** Shared keyboard recovery for reactive forms; never changes values or validators. */
@Directive({ selector: 'form[appFormFocus]' })
export class FormFocusDirective {
  private readonly element = inject<ElementRef<HTMLFormElement>>(ElementRef);
  private readonly group = inject(FormGroupDirective, { self: true });
  @HostListener('submit') onSubmit() {
    if (!this.group.form.invalid) return;
    this.group.form.markAllAsTouched();
    queueMicrotask(() => this.element.nativeElement.querySelector<HTMLElement>(
      'input.ng-invalid:not(:disabled), select.ng-invalid:not(:disabled), textarea.ng-invalid:not(:disabled)',
    )?.focus());
  }
}
