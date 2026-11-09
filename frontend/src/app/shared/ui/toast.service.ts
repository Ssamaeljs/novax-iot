import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, NgZone, PLATFORM_ID, signal, WritableSignal } from '@angular/core';

type ToastIcon = 'success' | 'error' | 'info';
interface ToastOptions {
  icon: ToastIcon;
  text: string;
}
interface ToastMessage extends ToastOptions {
  id: number;
}

@Injectable({ providedIn: 'root' })
export class Toast {
  private readonly window = isPlatformBrowser(inject(PLATFORM_ID)) ? inject(DOCUMENT).defaultView : null;
  private readonly zone = inject(NgZone);
  private readonly queue = signal<ToastMessage[]>([]);
  readonly messages = this.queue.asReadonly();
  private nextId = 0;

  fire(options: ToastOptions) {
    const browser = this.window;
    if (!browser || !options.text || this.queue().some(({ icon, text }) => icon === options.icon && text === options.text)) return;
    const id = ++this.nextId;
    this.queue.update((items) => [...items.slice(-3), { ...options, id }]);
    if (options.icon !== 'error') this.zone.runOutsideAngular(() => browser.setTimeout(() => this.dismiss(id), 6000));
  }

  dismiss(id: number) {
    this.queue.update((items) => items.filter((item) => item.id !== id));
  }

  report(state: WritableSignal<string>, icon: ToastIcon, text: string) {
    state.set(text);
    this.fire({ icon, text });
  }
}
