import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';
export interface ThemeState {
  preference: ThemePreference;
  resolved: Theme;
}
interface ThemeRuntime {
  eventName: string;
  getState(): ThemeState;
  setPreference(preference: ThemePreference): void;
}
declare global {
  interface Window {
    novaxTheme?: ThemeRuntime;
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly state = signal<ThemeState>({
    preference: 'system',
    resolved: 'light',
  });
  readonly preference = computed(() => this.state().preference);
  readonly resolved = computed(() => this.state().resolved);
  private readonly initialized = signal(false);
  readonly ready = this.initialized.asReadonly();

  constructor() {
    // SSR and the first hydration render share the same state. CSS is already themed by theme-init.js.
    afterNextRender(() => {
      const browser = this.document.defaultView;
      const runtime = browser?.novaxTheme;
      if (!browser || !runtime) return;
      const sync = () => this.state.set(runtime.getState());
      sync();
      this.initialized.set(true);
      browser.addEventListener(runtime.eventName, sync);
      this.destroyRef.onDestroy(() =>
        browser.removeEventListener(runtime.eventName, sync),
      );
    });
  }

  setPreference(preference: ThemePreference): void {
    this.document.defaultView?.novaxTheme?.setPreference(preference);
  }
}
