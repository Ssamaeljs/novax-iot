export interface ResourceField {
  key: string;
  label: string;
  type?:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'select'
    | 'checkbox'
    | 'scopes';
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  options?: string[];
  relation?: string;
  createOnly?: boolean;
  editOnly?: boolean;
  default?: string | boolean;
  nullable?: boolean;
}
export interface ResourceDefinition {
  title: string;
  description: string;
  endpoint: string;
  permission: string;
  columns: { key: string; label: string }[];
  fields: ResourceField[];
  readOnly?: boolean;
  noSearch?: boolean;
}
const field = (
  key: string,
  label: string,
  options: Partial<ResourceField> = {},
): ResourceField => ({ key, label, ...options });
const active = field('is_active', 'Activo', {
  type: 'checkbox',
  default: true,
});
const name = field('name', 'Nombre', {
  required: true,
  minLength: 2,
  max: 120,
});
const code = field('code', 'Código', { required: true, minLength: 2, max: 80 });
export const resources: Record<string, ResourceDefinition> = {
  devices: {
    title: 'Dispositivos',
    description:
      'Inventario de equipos y su estado reportado. Registrar un equipo no establece una conexión automática.',
    endpoint: 'iot/devices',
    permission: 'devices',
    columns: [
      { key: 'name', label: 'Dispositivo' },
      { key: 'code', label: 'Código' },
      { key: 'device_type', label: 'Tipo' },
      { key: 'protocol', label: 'Protocolo' },
      { key: 'status', label: 'Estado' },
      { key: 'is_active', label: 'Activo' },
    ],
    fields: [
      code,
      name,
      field('device_type', 'Tipo de equipo', {
        required: true,
        minLength: 2,
        max: 60,
        default: 'ESP32',
      }),
      field('protocol', 'Protocolo', {
        type: 'select',
        options: ['MQTT', 'HTTP', 'HTTPS', 'ONVIF'],
        default: 'MQTT',
        required: true,
      }),
      field('status', 'Estado reportado', {
        type: 'select',
        options: ['UNKNOWN', 'ONLINE', 'OFFLINE', 'DEGRADED'],
        default: 'UNKNOWN',
        required: true,
      }),
      field('manufacturer', 'Fabricante', { max: 100, nullable: true }),
      field('model', 'Modelo', { max: 100, nullable: true }),
      field('serial_number', 'Número de serie', { max: 120, nullable: true }),
      field('firmware_version', 'Versión de firmware', {
        max: 60,
        nullable: true,
      }),
      active,
    ],
  },
  sensors: {
    title: 'Sensores',
    description:
      'Cada sensor pertenece a un dispositivo y define una métrica, un tipo de dato y una unidad.',
    endpoint: 'iot/sensors',
    permission: 'sensors',
    columns: [
      { key: 'name', label: 'Sensor' },
      { key: 'device.name', label: 'Dispositivo' },
      { key: 'metric', label: 'Métrica' },
      { key: 'unit', label: 'Unidad' },
      { key: 'data_type', label: 'Tipo de dato' },
      { key: 'is_active', label: 'Activo' },
    ],
    fields: [
      field('device_external_id', 'Dispositivo', {
        type: 'select',
        relation: 'iot/devices',
        required: true,
        createOnly: true,
      }),
      field('key', 'Clave del sensor', { required: true, max: 80 }),
      name,
      field('metric', 'Métrica (ej. humidity)', {
        required: true,
        minLength: 2,
        max: 100,
      }),
      field('unit', 'Unidad (ej. %)', { max: 30, nullable: true }),
      field('data_type', 'Tipo de dato', {
        type: 'select',
        required: true,
        options: ['NUMBER', 'TEXT', 'BOOLEAN', 'JSON'],
        default: 'NUMBER',
      }),
      field('minimum_value', 'Valor mínimo', {
        type: 'number',
        nullable: true,
      }),
      field('maximum_value', 'Valor máximo', {
        type: 'number',
        nullable: true,
      }),
      field('sampling_interval_seconds', 'Intervalo de muestreo (segundos)', {
        type: 'number',
        min: 1,
        nullable: true,
      }),
      active,
    ],
  },
  users: {
    title: 'Usuarios',
    description:
      'Identidad de las personas. Para habilitar el acceso, crea después su cuenta y asígnale un rol.',
    endpoint: 'core/users',
    permission: 'users',
    columns: [
      { key: 'first_name', label: 'Nombres' },
      { key: 'last_name', label: 'Apellidos' },
      { key: 'id_card', label: 'Documento' },
      { key: 'is_active', label: 'Activo' },
    ],
    fields: [
      field('first_name', 'Nombres', {
        required: true,
        minLength: 2,
        max: 120,
      }),
      field('last_name', 'Apellidos', {
        required: true,
        minLength: 1,
        max: 120,
      }),
      field('id_card', 'Documento de identidad', {
        required: true,
        minLength: 5,
        max: 30,
      }),
      active,
    ],
  },
  accounts: {
    title: 'Cuentas',
    description:
      'Credenciales de acceso vinculadas a un usuario. Los roles determinan qué acciones puede realizar.',
    endpoint: 'core/accounts',
    permission: 'accounts',
    columns: [
      { key: 'username', label: 'Cuenta' },
      { key: 'email', label: 'Correo' },
      { key: 'user.first_name', label: 'Usuario' },
      { key: 'roles', label: 'Roles' },
      { key: 'is_active', label: 'Activo' },
    ],
    fields: [
      field('user_external_id', 'Usuario', {
        required: true,
        relation: 'core/users',
        type: 'select',
        createOnly: true,
      }),
      field('username', 'Nombre de usuario', {
        required: true,
        minLength: 3,
        max: 80,
      }),
      field('email', 'Correo electrónico', {
        required: true,
        type: 'email',
        max: 160,
      }),
      field('password', 'Contraseña inicial (mínimo 12 caracteres)', {
        required: true,
        type: 'password',
        minLength: 12,
        max: 128,
        createOnly: true,
      }),
      active,
    ],
  },
  roles: {
    title: 'Roles y permisos',
    description:
      'Agrupa permisos según las responsabilidades del equipo. Los roles del sistema están protegidos.',
    endpoint: 'iam/roles',
    permission: 'roles',
    columns: [
      { key: 'name', label: 'Rol' },
      { key: 'code', label: 'Código' },
      { key: 'permissions', label: 'Permisos' },
      { key: 'is_system', label: 'Sistema' },
      { key: 'is_active', label: 'Activo' },
    ],
    fields: [
      { ...code, max: 60 },
      name,
      field('description', 'Descripción', { max: 255, nullable: true }),
      active,
    ],
  },
  permissions: {
    title: 'Catálogo de permisos',
    description:
      'Permisos que el backend reconoce. Asígnalos desde un rol; no se crean reglas arbitrarias desde el navegador.',
    endpoint: 'iam/permissions',
    permission: 'permissions',
    readOnly: true,
    columns: [
      { key: 'key', label: 'Permiso' },
      { key: 'name', label: 'Nombre' },
      { key: 'resource', label: 'Recurso' },
      { key: 'action', label: 'Acción' },
    ],
    fields: [],
  },
  'api-tokens': {
    title: 'Tokens de API',
    description:
      'Credenciales para integraciones. El secreto se muestra solo una vez; limita sus permisos a lo necesario.',
    endpoint: 'iam/api-tokens',
    permission: 'api_tokens',
    columns: [
      { key: 'name', label: 'Token' },
      { key: 'token_prefix', label: 'Prefijo' },
      { key: 'account.username', label: 'Cuenta' },
      { key: 'expires_at', label: 'Vencimiento' },
      { key: 'is_active', label: 'Activo' },
    ],
    fields: [
      name,
      field('scopes', 'Permisos de la integración', {
        type: 'scopes',
        required: true,
        createOnly: true,
      }),
      { ...active, editOnly: true },
    ],
  },
  audit: {
    title: 'Auditoría',
    description:
      'Registro inmutable de acciones del backend. Cada consulta y cambio conserva su contexto y su responsable.',
    endpoint: 'audit/logs',
    permission: 'audit_logs',
    readOnly: true,
    noSearch: true,
    columns: [
      { key: 'created_at', label: 'Fecha' },
      { key: 'action', label: 'Acción' },
      { key: 'resource', label: 'Recurso' },
      {
        key: 'actor_account.username',
        label: 'Cuenta responsable',
      },
      { key: 'outcome', label: 'Resultado' },
    ],
    fields: [],
  },
};
