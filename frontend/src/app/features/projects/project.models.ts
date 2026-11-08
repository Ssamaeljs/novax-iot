export type WidgetType = 'THERMOMETER' | 'GAUGE' | 'TIMELINE' | 'HTML';
export interface WidgetLayout { x: number; y: number; width: number; height: number; locked: boolean; }
export type WidgetTone = 'success' | 'warning' | 'danger' | 'info' | 'maintenance' | 'offline';
export type RuleOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'between';
export interface WidgetColorRule { sensor_external_id: string; operator: RuleOperator; value: number; upper?: number; tone: WidgetTone; label: string; }
export interface WidgetSettings { min?: number; max?: number; html?: string; css?: string; color_rules?: WidgetColorRule[]; }
export interface ProjectSensor {
  external_id: string; name: string; key: string; metric: string; unit: string | null;
  data_type: 'NUMBER' | 'TEXT' | 'BOOLEAN' | 'JSON'; is_active: boolean;
}
export interface ProjectWidget {
  external_id?: string; title: string; type: WidgetType; layout: WidgetLayout;
  sensor_external_ids: string[]; settings: WidgetSettings; sensors: ProjectSensor[];
}
export interface WidgetDraft extends ProjectWidget { key: string; }
export interface Project {
  external_id: string; code: string; title: string; description: string | null;
  version: number; is_active: boolean;
}
export interface Board { project: Project; version: number; widgets: ProjectWidget[]; }
export interface TelemetryPoint { observed_at: string; value: number; quality: string; }
export interface SensorTelemetry {
  sensor: ProjectSensor;
  latest: { value: unknown; observed_at: string; received_at: string; quality: string } | null;
  points: TelemetryPoint[];
}
export interface BoardTelemetry { from: string; to: string; sample_limit: number; series: SensorTelemetry[]; }
