const labels: Record<string, string> = {
  ONLINE: 'Conectado', OFFLINE: 'Desconectado', UNKNOWN: 'Desconocido', DEGRADED: 'Degradado',
  GOOD: 'Buena', UNCERTAIN: 'Incierta', BAD: 'Mala',
  NUMBER: 'Número', TEXT: 'Texto', BOOLEAN: 'Verdadero / falso', JSON: 'JSON (datos estructurados)',
  SUCCESS: 'Correcto', FAILURE: 'Fallido',
  LIST: 'Consulta de listado', READ: 'Consulta de detalle', CREATE: 'Creación', UPDATE: 'Actualización', DELETE: 'Desactivación o eliminación', ASSIGN: 'Asignación',
  LOGIN: 'Inicio de sesión', LOGOUT: 'Cierre de sesión', PASSWORD_RESET: 'Restablecimiento de contraseña', PASSWORD_CHANGE: 'Cambio de contraseña', PASSWORD_RECOVERY: 'Solicitud de recuperación',
  INGEST: 'Recepción de telemetría',
};
export function enumLabel(value: string): string { return labels[value] || value; }
