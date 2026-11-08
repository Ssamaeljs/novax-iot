import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemePreference, ThemeService } from '../../core/theme/theme.service';
import { IconComponent, IconName } from './icon.component';

@Component({
  selector: 'app-theme-selector',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="theme-selector" role="group" aria-label="Tema de la interfaz">
      @for (option of options; track option.value) {
        <button
          type="button"
          [attr.aria-label]="option.label"
          [attr.title]="option.label"
          [attr.aria-pressed]="theme.preference() === option.value"
          [disabled]="!theme.ready()"
          [attr.data-preference]="option.value"
          (click)="theme.setPreference(option.value)"
        >
          <app-icon [name]="option.icon" /><span>{{ option.text }}</span>
        </button>
      }
    </div>
    <span class="sr-only" aria-live="polite"
      >Tema {{ theme.resolved() === 'dark' ? 'oscuro' : 'claro'
      }}{{ theme.preference() === 'system' ? ', según el sistema' : '' }}</span
    >
  `,
  styles: `
    .theme-selector {
      display: inline-flex;
      padding: 3px;
      gap: 2px;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      background: var(--bg-surface-secondary);
    }
    button {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      border: 1px solid transparent;
      border-radius: 4px;
      padding: 0.4rem 0.55rem;
      min-height: 32px;
      color: var(--text-secondary);
      background: transparent;
      font-size: 0.75rem;
    }
    button:hover {
      color: var(--primary);
    }
    button[aria-pressed='true'] {
      color: var(--primary);
      background: var(--bg-elevated);
      border-color: var(--border-strong);
      box-shadow: var(--shadow-sm);
    }
    button:disabled {
      cursor: progress;
    }
    @media (max-width: 650px) {
      button span {
        display: none;
      }
      button {
        padding: 0.5rem;
        min-width: 44px;
        min-height: 44px;
      }
    }
  `,
})
export class ThemeSelectorComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly options: {
    value: ThemePreference;
    text: string;
    label: string;
    icon: IconName;
  }[] = [
    { value: 'light', text: 'Light', label: 'Light: tema claro', icon: 'sun' },
    { value: 'dark', text: 'Dark', label: 'Dark: tema oscuro', icon: 'moon' },
    {
      value: 'system',
      text: 'System',
      label: 'System: usar tema del sistema',
      icon: 'monitor',
    },
  ];
}
