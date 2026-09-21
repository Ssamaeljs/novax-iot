import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const paths = {
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  moon: 'M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z',
  monitor: 'M3 4h18v13H3ZM8 21h8m-4-4v4',
  grid: 'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
  device:
    'M6 6h12v12H6ZM9 9h6v6H9ZM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',
  sensor:
    'M12 3v8m-4 6a4 4 0 1 0 8 0c0-1.5-.8-2.8-2-3.5V5a2 2 0 0 0-4 0v8.5c-1.2.7-2 2-2 3.5ZM12 17v.01',
  camera: 'M3 6h12v12H3Zm12 4 6-3v10l-6-3',
  gateway:
    'M3 15h18v6H3ZM7 18h.01M5 7a10 10 0 0 1 14 0M8 10a6 6 0 0 1 8 0m-4 2v3',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
  users:
    'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM2 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3m1-17a4 4 0 0 1 0 7m2 3a5 5 0 0 1 3 4v3',
  shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7Zm-4 9 3 3 5-6',
  activity: 'M2 12h5l3-8 4 16 3-8h5',
  check: 'm5 12 4 4L19 6',
  offline:
    'm3 3 18 18M5 7a11 11 0 0 0-2 2m6-4a11 11 0 0 1 12 4M8 12l-2 2m7-3a7 7 0 0 1 5 3m-9 3a4 4 0 0 1 6 0m-3 3v.01',
  warning: 'M12 3 2 21h20ZM12 9v5m0 3v.01',
  critical: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3 7 6 6m0-6-6 6',
  tool: 'M14 6a5 5 0 0 0-6 6l-6 6 4 4 6-6a5 5 0 0 0 6-6l-3 3-4-4Z',
  help: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 4v.01',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 10v7m0-10v.01',
  chevron: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  menu: 'M3 6h18M3 12h18M3 18h18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  filter: 'M3 5h18M6 12h12M10 19h4',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  layers: 'm12 2 10 6-10 6L2 8Zm-10 10 10 6 10-6M2 16l10 6 10-6',
  signal: 'M4 20v-3m5 3v-7m5 7V9m5 11V4',
  drop: 'M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z',
} as const;
export type IconName = keyof typeof paths;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path [attr.d]="paths[name()]" />
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      width: 1.15em;
      height: 1.15em;
      flex: 0 0 auto;
      vertical-align: middle;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class IconComponent {
  readonly name = input<IconName>('device');
  protected readonly paths = paths;
}
