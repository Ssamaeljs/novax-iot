import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ThemeService } from '../../../core/theme/theme.service';
import { SensorTelemetry, WidgetSettings } from '../project.models';
import { customDocument, interpolate, sanitizeMarkup } from './custom-html';
@Component({
  selector: 'app-custom-widget', changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<iframe sandbox="" referrerpolicy="no-referrer" [title]="title()" [srcdoc]="content()"></iframe>`,
  styles: `:host{display:block;height:100%;min-height:100px}iframe{display:block;width:100%;height:100%;min-height:100px;border:0;background:var(--bg-surface)}`,
})
export class CustomWidgetComponent {
  readonly settings = input.required<WidgetSettings>();
  readonly series = input.required<SensorTelemetry[]>();
  readonly title = input('Widget personalizado');
  readonly color = input('var(--primary)');
  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly theme = inject(ThemeService);
  private readonly ready = signal(false);
  constructor() { afterNextRender(() => this.ready.set(true)); }
  readonly content = computed(() => {
    this.theme.resolved();
    if (!this.ready()) return '';
    const style = this.document.defaultView!.getComputedStyle(this.document.documentElement);
    const tokens = ['--bg-surface', '--bg-surface-secondary', '--text-primary', '--text-secondary', '--text-muted', '--primary', '--accent', '--border-default', '--success', '--warning', '--danger', '--info', '--maintenance', '--offline'];
    const themeCss = `:root{${tokens.map((token) => `${token}:${style.getPropertyValue(token)};`).join('')}--widget-color:${this.color()};}body{margin:0;padding:12px;box-sizing:border-box;background:var(--bg-surface);color:var(--text-primary);font:14px system-ui}*{box-sizing:border-box}`;
    const markup = sanitizeMarkup(this.document, interpolate(this.settings().html || '', this.series()));
    // Only this generated document, sanitized markup and restrictive sandbox/CSP are trusted.
    return this.sanitizer.bypassSecurityTrustHtml(customDocument(markup, this.settings().css || '', themeCss));
  });
}
