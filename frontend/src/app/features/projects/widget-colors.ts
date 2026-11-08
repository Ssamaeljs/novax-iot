import { SensorTelemetry, WidgetColorRule, WidgetTone } from './project.models';

export const widgetTones: { value: WidgetTone; label: string }[] = [
  { value: 'success', label: 'Verde · correcto' },
  { value: 'warning', label: 'Ámbar · advertencia' },
  { value: 'danger', label: 'Rojo · crítico' },
  { value: 'info', label: 'Azul · información' },
  { value: 'maintenance', label: 'Violeta · mantenimiento' },
  { value: 'offline', label: 'Gris · inactivo' },
];
export const ruleOperators = [
  { value: 'gt', label: 'Mayor que' }, { value: 'gte', label: 'Mayor o igual' },
  { value: 'lt', label: 'Menor que' }, { value: 'lte', label: 'Menor o igual' },
  { value: 'eq', label: 'Igual a' }, { value: 'neq', label: 'Distinto de' },
  { value: 'between', label: 'Entre (incluye límites)' },
];
export function matchingRule(rules: WidgetColorRule[], series: SensorTelemetry[]): WidgetColorRule | undefined {
  return rules.find((rule) => {
    const reading = series.find((item) => item.sensor.external_id === rule.sensor_external_id)?.latest;
    const value = reading?.value;
    if (reading?.quality === 'BAD' || typeof value !== 'number' || !Number.isFinite(value)) return false;
    switch (rule.operator) {
      case 'gt': return value > rule.value;
      case 'gte': return value >= rule.value;
      case 'lt': return value < rule.value;
      case 'lte': return value <= rule.value;
      case 'eq': return value === rule.value;
      case 'neq': return value !== rule.value;
      case 'between': return value >= rule.value && rule.upper !== undefined && value <= rule.upper;
      default: return false;
    }
  });
}
export function ruleAppearance(rule: WidgetColorRule | undefined) {
  // Never turn stored strings into CSS: only this closed semantic palette is accepted.
  const tone = widgetTones.some((item) => item.value === rule?.tone) ? rule!.tone : null;
  return {
    color: tone ? `var(--${tone})` : 'var(--primary)',
    background: tone ? `var(--${tone}-soft)` : 'var(--bg-surface)',
    border: tone ? `var(--${tone}-border)` : 'var(--border-default)',
  };
}
