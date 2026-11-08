export interface Mapping {
  path: string; sensor_key: string; metric: string; unit: string | null; source_unit: string | null;
  data_type: 'NUMBER' | 'TEXT' | 'BOOLEAN' | 'JSON'; scale: number; offset: number; required: boolean;
}
export interface Profile {
  external_id: string; code: string; name: string; description?: string; version: number; mappings: Mapping[]; is_active: boolean;
}
export interface ProfileInput { name: string; description: string; mappings: Mapping[]; }
