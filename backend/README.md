# Novax IoT API

API modular para identidad, autorización y administración inicial de dispositivos IoT.

## Módulos

- `core`: tenants, usuarios y cuentas.
- `iam`: permisos, roles y tokens opacos de API.
- `iot`: dispositivos, sensores y mediciones.
- `audit`: historial inmutable y multi-tenant de operaciones administrativas.
- `helpers/autoCrud`: CRUD reutilizable con validación declarativa, tenant scope, búsqueda, filtros y paginación.

## Inicio local

1. Copia `.env.example` como `.env` y completa las credenciales.
2. Ejecuta `npm run db:prepare`.
3. Ejecuta `npm run db:migrate`.
4. Ejecuta `npm start`.

### Login de usuarios

El login requiere el tenant porque un mismo correo o nombre de usuario puede existir en tenants diferentes:

```http
POST /v1/api/auth/login
Content-Type: application/json

{
  "tenant_slug": "novax-iot",
  "identifier": "admin-novax",
  "password": "<password>"
}
```

La respuesta entrega una sesión opaca `nvx_session_...` una sola vez. No es un JWT y la base
solo almacena su hash SHA-256. La sesión se usa con `Authorization: Bearer <token>`.

```text
GET  /v1/api/auth/me
POST /v1/api/auth/logout
```

`SESSION_TTL_MINUTES` controla la duración (8 horas por defecto). Después de
`LOGIN_MAX_ATTEMPTS` intentos fallidos, la cuenta se bloquea durante
`LOGIN_LOCK_MINUTES`. Cambiar la contraseña o desactivar la cuenta revoca sus sesiones.

### Bootstrap de un solo uso

Configura un `BOOTSTRAP_SECRET` de al menos 32 caracteres y llama:

```http
POST /v1/api/bootstrap
X-Bootstrap-Secret: <secret>
Content-Type: application/json

{
  "tenant_name": "Novax Demo",
  "tenant_slug": "novax-demo",
  "timezone": "America/Guayaquil",
  "first_name": "Admin",
  "last_name": "Novax",
  "id_card": "ADMIN-001",
  "username": "admin",
  "email": "admin@example.com",
  "password": "replace-with-a-strong-password"
}
```

La respuesta muestra el token completo una sola vez. Los demás endpoints usan:

```http
Authorization: Bearer nvx_live_...
```

## Endpoints iniciales

```text
GET|PATCH                 /v1/api/core/tenants/:external_id
GET|POST|PATCH|DELETE     /v1/api/core/users
GET|POST|PATCH|DELETE     /v1/api/core/accounts
POST                      /v1/api/core/accounts/:external_id/roles
GET                       /v1/api/iam/permissions
GET|POST|PATCH|DELETE     /v1/api/iam/roles
PUT                       /v1/api/iam/roles/:external_id/permissions
GET|POST|PATCH|DELETE     /v1/api/iam/api-tokens
POST                      /v1/api/auth/login
GET                       /v1/api/auth/me
POST                      /v1/api/auth/logout
GET                       /v1/api/audit/logs
GET                       /v1/api/audit/logs/:external_id
GET|POST|PATCH|DELETE     /v1/api/iot/devices
GET|POST|PATCH|DELETE     /v1/api/iot/sensors
GET|POST                  /v1/api/iot/measurements
POST                      /v1/api/iot/measurements/bulk
```

Listados aceptan `page`, `page_size`, `search`, `sort_by`, `sort_dir` y filtros permitidos por recurso. Las mediciones aceptan además `sensor_external_id`, `device_external_id`, `from`, `to` y `quality`.

Los eventos de auditoría aceptan `page`, `page_size`, `action`, `resource`, `resource_external_id`,
`actor_account_external_id`, `outcome`, `status_code`, `from` y `to`. Requieren el permiso
`audit_logs.read`; no existen endpoints para modificarlos o eliminarlos.

## AutoCrud

Un recurso básico se expone declarando el modelo y sus reglas:

```js
const service = new AutoCrudService({
  model: Device,
  writableFields: ["code", "name", "status"],
  filterableFields: ["status", "is_active"],
  searchableFields: ["code", "name"],
  schemas: {
    create: {
      code: { required: true, type: "string", uppercase: true },
      name: { required: true, type: "string", minLength: 2 },
    },
    update: {
      name: { type: "string", minLength: 2 },
    },
  },
});
```

Las reglas soportan `required`, `type`, `allowNull`, `minLength`, `maxLength`, `min`, `max`, `oneOf`, `format`, `pattern`, normalización y validadores asíncronos. Los hooks permiten resolver UUID externos, transformar datos y agregar reglas de dominio sin duplicar el CRUD.

## Seguridad

- Los tokens de API son aleatorios y la base guarda únicamente SHA-256.
- Cada consulta tenant-aware recibe automáticamente `tenant_id` desde el token.
- Los campos desconocidos o internos son rechazados.
- Los tokens pueden limitarse con `scopes`, sin superar los permisos de la cuenta.
- Las sesiones web y los tokens de integración son opacos; solo sus hashes persisten en PostgreSQL. Redis puede añadirse como caché distribuida cuando el volumen lo justifique, sin cambiar el contrato HTTP.
- Todas las entidades y relaciones poseen `external_id`; los identificadores y claves foráneas internos se eliminan recursivamente de las respuestas.
- La auditoría registra actor, token, acción, recurso, request ID, IP, agente y resultado. Solo conserva nombres de campos y tamaños de lote; nunca cuerpos, contraseñas, secretos ni tokens.
- Los eventos de creación, actualización, eliminación y asignación se escriben en la misma transacción que el cambio. PostgreSQL bloquea `UPDATE` y `DELETE` sobre `audit.audit_logs`.
