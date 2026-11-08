import { WidgetDraft, WidgetLayout } from './project.models';
export function overlaps(a: WidgetLayout, b: WidgetLayout): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export function validLayout(layout: WidgetLayout, widgets: WidgetDraft[], key: string): boolean {
  return [layout.x, layout.y, layout.width, layout.height].every(Number.isInteger) &&
    layout.x >= 0 && layout.y >= 0 && layout.y <= 200 && layout.width >= 3 && layout.width <= 12 &&
    layout.height >= 3 && layout.height <= 16 && layout.x + layout.width <= 12 &&
    !widgets.some((widget) => widget.key !== key && overlaps(widget.layout, layout));
}
export function freePosition(widgets: WidgetDraft[], width = 4, height = 5): WidgetLayout | null {
  for (let y = 0; y <= 200; y++) {
    for (let x = 0; x + width <= 12; x++) {
      const layout = { x, y, width, height, locked: false };
      if (validLayout(layout, widgets, '')) return layout;
    }
  }
  return null;
}
