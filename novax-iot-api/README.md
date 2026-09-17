# Novax IoT API

API modular para identidad, autorización y administración inicial de dispositivos IoT.

## Módulos

- `core`: tenants, usuarios y cuentas.
- `iam`: permisos, roles y tokens opacos de API.
- `iot`: dispositivos, sensores y mediciones.
- `helpers/autoCrud`: CRUD reutilizable con validación declarativa, tenant scope, búsqueda, filtros y paginación.

## Inicio local

1. Copia `.env.example` como `.env` y completa las credenciales.
2. Ejecuta `npm run db:prepare`.
3. Ejecuta `npm run db:migrate`.
4. Ejecuta `npm start`.

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
GET|PATCH                 /v1/api/core/tenants/:id
GET|POST|PATCH|DELETE     /v1/api/core/users
GET|POST|PATCH|DELETE     /v1/api/core/accounts
POST                      /v1/api/core/accounts/:id/roles
GET                       /v1/api/iam/permissions
GET|POST|PATCH|DELETE     /v1/api/iam/roles
PUT                       /v1/api/iam/roles/:id/permissions
GET|POST|PATCH|DELETE     /v1/api/iam/api-tokens
GET|POST|PATCH|DELETE     /v1/api/iot/devices
GET|POST|PATCH|DELETE     /v1/api/iot/sensors
GET|POST                  /v1/api/iot/measurements
POST                      /v1/api/iot/measurements/bulk
```

Listados aceptan `page`, `page_size`, `search`, `sort_by`, `sort_dir` y filtros permitidos por recurso. Las mediciones aceptan además `sensor_external_id`, `device_external_id`, `from`, `to` y `quality`.

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
- Redis quedará reservado para sesiones web opacas y caché de autorización; los tokens de integración permanecen persistentes en PostgreSQL.
