# Plataforma web: identidad y operación

## Conexión

El frontend Angular usa `/v1/api` bajo su mismo origen. En desarrollo, su proxy apunta al puerto 5000. En producción se necesita un proxy inverso HTTPS que enrute `/v1/api/` a este backend y el resto al frontend, preservando el prefijo, Origin, Cookie y Set-Cookie.

Los endpoints Bearer anteriores permanecen compatibles. La web usa una sesión opaca en cookie HttpOnly; el secreto se almacena como hash en PostgreSQL. No se añadió Redis: las sesiones actuales ya son persistentes y compartidas en la base. Redis puede incorporarse para límites distribuidos y caché cuando se desplieguen varias instancias.

## Migración

Ejecutar `npm run db:migrate`. La migración `2026.09.18T010000-create-password-resets.js` crea únicamente `iam.password_resets`, con identidad pública, hash único, expiración y marca de uso. No reiniciar ni recrear la base. Se aplicó esta migración en el entorno local durante la implementación.

## Configuración

Ver `.env.example`; conservar los secretos fuera del repositorio.

| Variable                      | Uso                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_REGISTRATION_ENABLED` | `false` por defecto. `true` permite crear organizaciones independientes con su primer TENANT_OWNER. Reiniciar backend tras cambiarla. |
| `WEB_ORIGIN`                  | Origen exacto del frontend. Por ejemplo `http://localhost:4200` en local; HTTPS obligatorio para recuperación en producción.          |
| `CORS_ORIGINS`                | Orígenes exactos separados por comas; no usar comodines.                                                                              |
| `SMTP_HOST` / `SMTP_PORT`     | Servidor SMTP; puerto predeterminado 587.                                                                                             |
| `SMTP_SECURE`                 | `true` para TLS implícito (habitualmente 465); `false` para STARTTLS. En producción STARTTLS es obligatorio si no hay TLS implícito.  |
| `SMTP_USER` / `SMTP_PASSWORD` | Credenciales del proveedor, solo en backend.                                                                                          |
| `SMTP_FROM`                   | Remitente autorizado por el proveedor.                                                                                                |
| `NODE_ENV`                    | `production` activa Secure en la cookie y elimina los orígenes locales implícitos.                                                    |

No se modificó el `.env` real, no se habilitó el registro público y no se configuraron credenciales SMTP. Sin SMTP, capabilities informa que recuperación no está disponible y la UI lo explica. No se devuelve ni se imprime un token de recuperación como alternativa al correo.

## Endpoints nuevos (prefijo `/v1/api`)

| Método y ruta                | Comportamiento                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /auth/capabilities`     | Disponibilidad de registro y recuperación.                                                                                                                                                                                                                                                                             |
| `POST /auth/web/login`       | Mismo payload que login (`tenant_slug`, `identifier`, `password`); cookie HttpOnly y perfil sin secreto. Requiere Origin confiable y `X-Novax-CSRF: 1`.                                                                                                                                                                |
| `POST /auth/register`        | Crea tenant, usuario, cuenta y TENANT_OWNER en una transacción. Campos: `tenant_name`, `tenant_slug`, `timezone`, `first_name`, `last_name`, `id_card`, `username`, `email`, `password`. No admite roles, permisos ni IDs internos aportados por el cliente. No crea un token de API ni inicia sesión automáticamente. |
| `POST /auth/forgot-password` | `tenant_slug`, `email`. Respuesta 202 genérica para identidad existente/inexistente.                                                                                                                                                                                                                                   |
| `POST /auth/reset-password`  | `token`, `password`. Token aleatorio de 32 bytes, expiración 30 minutos, hash en DB, consumo de un solo uso bajo bloqueo de cuenta. Revoca sesiones y enlaces restantes.                                                                                                                                               |
| `PATCH /auth/me`             | Sesión de usuario; modifica únicamente sus `first_name` y `last_name`.                                                                                                                                                                                                                                                 |
| `POST /auth/change-password` | Sesión de usuario; `current_password`, `password`. Verifica contraseña actual y revoca todas sus sesiones.                                                                                                                                                                                                             |

`GET /auth/me` y `POST /auth/logout` ahora también admiten la cookie. Las mutaciones con cookie requieren el encabezado CSRF y un Origin permitido. Las respuestas de API usan `Cache-Control: no-store`. Cambiar tenant exige rol TENANT_OWNER además de `tenants.manage`; las asignaciones del rol propietario también requieren propietario.

## Flujo de administración

Para incorporar una persona al tenant existente: crear Usuario, crear Cuenta vinculada por `user_external_id`, y asignar uno o más roles. Una cuenta nueva sin roles no obtiene permisos automáticamente. El registro público no sirve para incorporarse a una organización existente.

Dispositivo → sensor (métrica/unidad/tipo) → medición. Las pantallas consumen CRUD, consultas y auditoría existentes, sin reemplazar sus reglas de tenant ni exponer IDs numéricos. Auditoría incluye el username actual de la cuenta, más su identidad pública histórica; no se modifican los eventos existentes.

## Pruebas

`npm test` ejecuta pruebas unitarias. Integración real de desarrollo (PowerShell):

```powershell
$env:RUN_DATABASE_TESTS='1'
node --test
Remove-Item Env:RUN_DATABASE_TESTS
```

La integración inicia el app en un puerto efímero, envuelve las consultas en una transacción exterior y revierte todos sus fixtures al terminar. No toca cuentas existentes ni envía SMTP: el transporte de correo se sustituye dentro del proceso de prueba. La prueba se niega a correr con NODE_ENV=production. No habilitarla contra un despliegue compartido de producción.

## Antes de producción multi-instancia

- Configurar SMTP real y comprobar entrega, remitente, dominio y HTTPS; el transporte real no se ha probado sin esas credenciales.
- Los límites HTTP actuales son en memoria por proceso (30 intentos de login y 8 solicitudes de los flujos públicos por 15 minutos/IP); el bloqueo de login por cuenta y la cadencia de recuperación se conservan en DB. Añadir un store compartido, por ejemplo Redis, y configurar proxies de confianza de forma explícita antes de escalar horizontalmente.
- La búsqueda y envío de recuperación ocurren después de responder para no revelar existencia de cuentas por tiempo de respuesta. El envío es asíncrono en el mismo proceso, sin cola durable: un reinicio puede perder ese intento. Incorporar outbox/worker con reintentos para garantías de entrega; el usuario puede volver a solicitar el enlace pasado el límite.
- Definir retención/purga de sesiones y resets expirados. Añadir CSP/HSTS y cabeceras de despliegue en el proxy, backups, observabilidad y revisión de seguridad operacional.
- El registro no verifica correo ni incorpora invitaciones. Mantenerlo cerrado si se requiere onboarding aprobado; no abrirlo indiscriminadamente en Internet.

Referencias de diseño: [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Angular route guards](https://angular.dev/guide/routing/route-guards), [Nodemailer SMTP](https://nodemailer.com/smtp).
