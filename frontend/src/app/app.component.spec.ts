import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { DesignSystemComponent } from './features/design-system/design-system.component';
import { ThemeSelectorComponent } from './shared/ui/theme-selector.component';
@Component({
  imports: [DesignSystemComponent, ThemeSelectorComponent],
  template: '<app-theme-selector /><app-design-system />',
})
class ThemeTestHost {}
import {
  ThemePreference,
  ThemeService,
  ThemeState,
} from './core/theme/theme.service';

describe('Novax themed interface', () => {
  let fixture: ComponentFixture<ThemeTestHost>;
  let root: HTMLElement;
  let service: ThemeService;
  let state: ThemeState;
  const originalRuntime = window.novaxTheme;
  const originalTheme = document.documentElement.getAttribute('data-theme');

  const query = <T extends Element = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const click = (selector: string) => {
    query<HTMLButtonElement>(selector).click();
    fixture.detectChanges();
  };
  const choose = (preference: ThemePreference) =>
    click(`[data-preference='${preference}']`);

  beforeEach(async () => {
    state = { preference: 'system', resolved: 'light' };
    document.documentElement.setAttribute('data-theme', 'light');
    window.novaxTheme = {
      eventName: 'novax:theme-change',
      getState: () => ({ ...state }),
      setPreference: (preference) => {
        state = {
          preference,
          resolved: preference === 'system' ? 'light' : preference,
        };
        document.documentElement.setAttribute('data-theme', state.resolved);
        window.dispatchEvent(new CustomEvent('novax:theme-change'));
      },
    };
    await TestBed.configureTestingModule({
      imports: [ThemeTestHost],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ThemeTestHost);
    root = fixture.nativeElement;
    service = TestBed.inject(ThemeService);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    root
      .querySelectorAll('dialog[open]')
      .forEach((dialog) => (dialog as HTMLDialogElement).close());
    fixture.destroy();
    window.novaxTheme = originalRuntime;
    if (originalTheme)
      document.documentElement.setAttribute('data-theme', originalTheme);
    else document.documentElement.removeAttribute('data-theme');
  });

  it('connects the centralized service and accessible selector after rendering', () => {
    expect(service.ready()).toBeTrue();
    expect(
      query('[data-preference="system"]').getAttribute('aria-pressed'),
    ).toBe('true');
    choose('dark');
    expect(service.resolved()).toBe('dark');
    expect(query('[data-preference="dark"]').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(
      query('[data-preference="system"]').getAttribute('aria-pressed'),
    ).toBe('false');
    choose('light');
    expect(service.resolved()).toBe('light');
    choose('system');
    expect(service.preference()).toBe('system');
  });

  it('tracks external runtime changes and detaches the listener on destruction', () => {
    state = { preference: 'system', resolved: 'dark' };
    window.dispatchEvent(new CustomEvent('novax:theme-change'));
    fixture.detectChanges();
    expect(service.resolved()).toBe('dark');
    fixture.destroy();
    TestBed.resetTestingModule();
    window.novaxTheme!.setPreference('light');
    expect(service.resolved()).toBe('dark');
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`${theme}: themes surfaces, sticky headers, inputs, charts, states and dialogs`, () => {
      choose(theme);
      const surface = getComputedStyle(query('.card')).backgroundColor;
      const secondary = getComputedStyle(query('.log-panel')).backgroundColor;
      expect(surface).not.toBe(secondary);
      const header = getComputedStyle(query('#devices th'));
      expect(header.position).toBe('sticky');
      expect(header.backgroundColor).toBe(secondary);
      expect(getComputedStyle(query('#devices td')).backgroundColor).toBe(
        surface,
      );
      expect(
        getComputedStyle(query('input[type="search"]')).backgroundColor,
      ).toBe(surface);
      expect(
        getComputedStyle(query('[aria-invalid="true"]')).borderTopColor,
      ).toBe(getComputedStyle(query('.field-error')).color);
      expect(
        getComputedStyle(query('app-telemetry-chart .value')).stroke,
      ).not.toBe('none');
      expect(
        getComputedStyle(query('app-telemetry-chart .reference'))
          .strokeDasharray,
      ).not.toBe('none');
      expect(root.querySelectorAll('#states app-status-badge').length).toBe(6);
      for (const badge of root.querySelectorAll('#states .badge')) {
        expect(badge.textContent!.trim().length).toBeGreaterThan(0);
        expect(badge.querySelector('app-icon')).not.toBeNull();
        expect(getComputedStyle(badge).backgroundColor).not.toBe(
          'rgba(0, 0, 0, 0)',
        );
      }
      click('#devices .section-title button');
      expect(
        query<HTMLDialogElement>('dialog[aria-labelledby="dialog-title"]').open,
      ).toBeTrue();
      expect(getComputedStyle(query('.dialog-content')).color).toBe(
        getComputedStyle(query('h1')).color,
      );
      click('[aria-label="Cerrar detalle"]');
      expect(
        query<HTMLDialogElement>('dialog[aria-labelledby="dialog-title"]').open,
      ).toBeFalse();
    });
  }

  it('preserves table search, empty state, filtering and pagination', async () => {
    expect(root.querySelectorAll('#devices tbody tr').length).toBe(5);
    click('[aria-label="Página siguiente"]');
    expect(root.querySelectorAll('#devices tbody tr').length).toBe(3);
    const search = query<HTMLInputElement>('input[type="search"]');
    search.value = 'no-such-device';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(query('#devices .empty-state').textContent).toContain(
      'No hay coincidencias',
    );
    click('#devices .empty-state button');
    expect(root.querySelectorAll('#devices tbody tr').length).toBe(5);
    const filter = query<HTMLSelectElement>('.filter-field select');
    filter.value = 'MAINTENANCE';
    filter.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelectorAll('#devices tbody tr').length).toBe(1);
    expect(query('#devices tbody').textContent).toContain(
      'Gateway de laboratorio',
    );
  });

  it('supports arrow navigation between tabs and preserves native form validation', () => {
    const firstTab = query<HTMLButtonElement>('#tab-settings');
    firstTab.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();
    expect(query('#tab-permissions').getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(query<HTMLElement>('#settings-panel').hidden).toBeTrue();
    expect(document.activeElement).toBe(query('#tab-permissions'));
    click('#tab-settings');
    const name = query<HTMLInputElement>('[name="deviceName"]');
    name.value = '';
    expect(query<HTMLFormElement>('form').checkValidity()).toBeFalse();
    name.value = 'Secretaría';
    expect(query<HTMLFormElement>('form').checkValidity()).toBeTrue();
    click('button[type="submit"]');
    expect(query('.toast').textContent).toContain('Validación completada');
  });

  it('opens and dismisses notifications without modifying application data', () => {
    click('#states .section-title button');
    expect(query('.toast').textContent).toContain('Notificación de ejemplo');
    click('[aria-label="Cerrar notificación"]');
    expect(root.querySelector('.toast')).toBeNull();
  });

  it('restores focus when dismissing the options disclosure', () => {
    click('.dropdown summary');
    expect(query<HTMLDetailsElement>('.dropdown').open).toBeTrue();
    query('.dropdown-panel button').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    expect(query<HTMLDetailsElement>('.dropdown').open).toBeFalse();
    expect(document.activeElement).toBe(query('.dropdown summary'));
  });

  it('exposes chart values to keyboard users and provides a tabular alternative', () => {
    query<SVGElement>('app-telemetry-chart .target').dispatchEvent(
      new FocusEvent('focus'),
    );
    fixture.detectChanges();
    expect(query('.chart-tooltip').textContent).toContain('42%');
    query('app-telemetry-chart .target').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape' }),
    );
    fixture.detectChanges();
    expect(root.querySelector('.chart-tooltip')).toBeNull();
    expect(root.querySelectorAll('.chart-data tbody tr').length).toBe(7);
  });
});
