import { SensorTelemetry } from '../project.models';

export function escapeText(value: unknown): string {
  const text = value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function interpolate(html: string, series: SensorTelemetry[]): string {
  return html.replace(/\{\{\s*(?:sensor_(\d+)\.)?(value|name|unit|observed_at|quality)\s*\}\}/g, (_match, position: string | undefined, field: string) => {
    const item = series[position ? Number(position) - 1 : 0];
    if (!item) return '—';
    return escapeText(field === 'name' || field === 'unit' ? item.sensor[field] : item.latest?.[field as 'value' | 'observed_at' | 'quality']);
  });
}

const allowedTags = new Set(['DIV', 'SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SMALL', 'STRONG', 'EM', 'B', 'I', 'U', 'BR', 'HR', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'CAPTION', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER']);
const allowedAttributes = new Set(['class', 'id', 'title', 'aria-label', 'role', 'colspan', 'rowspan']);

// Work only in inert template content. User nodes are never attached to the application.
export function sanitizeMarkup(document: Document, html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const element of Array.from(template.content.querySelectorAll('*'))) {
    if (!allowedTags.has(element.tagName)) { element.remove(); continue; }
    for (const attribute of Array.from(element.attributes)) {
      if (!allowedAttributes.has(attribute.name)) element.removeAttribute(attribute.name);
    }
  }
  return template.innerHTML;
}

export function customDocument(markup: string, css: string, themeCss: string): string {
  // Escaping '<' prevents a CSS value from terminating the generated style element.
  const safeCss = (themeCss + css).replace(/</g, '\\3C ');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"><style>${safeCss}</style></head><body>${markup}</body></html>`;
}
