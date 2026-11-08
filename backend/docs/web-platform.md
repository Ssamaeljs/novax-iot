# Plataforma web: identidad y operación

## Conexión

La operación está restringida a NOVAX. La estructura de tenant se conserva internamente;
la organización se fija en el servidor con `NOVAX_TENANT_EXTERNAL_ID`, o con
`NOVAX_TENANT_SLUG=novax-iot` si no se fija UUID. Los formularios de login y recuperación
no solicitan organización. Las credenciales de otros tenants no son válidas en esta instalación.

El frontend Angular usa `/v1/api` bajo su mismo origen. En desarrollo, su proxy apunta al puerto 5000. En producción se necesita un proxy inverso HTTPS que enrute `/v1/api/` a este backend y el resto al frontend, preservando el prefijo, Origin, Cookie y Set-Cookie.

Los endpoints Bearer anteriores permanecen compatibles. La web usa una sesión opaca en cookie HttpOnly; el secreto se almacena como hash en PostgreSQL. No se añadió Redis: las sesiones actuales ya son persistentes y compartidas en la base. Redis puede incorporarse para límites distribuidos y caché cuando se desplieguen varias instancias.

## Migración

Ejecutar `npm run db:migrate`. La migración `2026.09.18T010000-create-password-resets.js` crea únicamente `iam.password_resets`, con identidad pública, hash único, expiración y marca de uso. No reiniciar ni recrear la base. Se aplicó esta migración en el entorno local durante la implementación.

## Configuración

Ver `.env.example`; conservar los secretos fuera del repositorio.

| Variable                      | Uso                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `NOVAX_TENANT_EXTERNAL_ID` | UUID público de la organización operativa existente. Tiene prioridad sobre el slug. |
| `NOVAX_TENANT_SLUG` | Slug utilizado si no se configura UUID. Valor predeterminado: `novax-iot`. |
| `WEB_ORIGIN`                  | Origen exacto del frontend. Por ejemplo `http://localhost:4200` en local; HTTPS obligatorio para recuperación en producción.          |
| `CORS_ORIGINS`                | Orígenes exactos separados por comas; no usar comodines.                                                                              |
| `SMTP_HOST` / `SMTP_PORT`     | Servidor SMTP; puerto predeterminado 587.                                                                                             |
| `SMTP_SECURE`                 | `true` para TLS implícito (habitualmente 465); `false` para STARTTLS. En producción STARTTLS es obligatorio si no hay TLS implícito.  |
| `SMTP_USER` / `SMTP_PASSWORD` | Credenciales del proveedor, solo en backend.                                                                                          |
| `SMTP_FROM`                   | Remitente autorizado por el proveedor.                                                                                                |
| `NODE_ENV`                    | `production` activa Secure en la cookie y elimina los orígenes locales implícitos.                                                    |

El registro público permanece cerrado por diseño; `PUBLIC_REGISTRATION_ENABLED` ya no lo habilita.
No se modificó el `.env` real ni se configuraron credenciales SMTP. Sin SMTP, capabilities informa
que recuperación no está disponible y la UI lo explica. No se devuelve ni se imprime un token
de recuperación como alternativa al correo.

## Endpoints nuevos (prefijo `/v1/api`)

| Método y ruta                | Comportamiento                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /auth/capabilities`     | Disponibilidad de registro y recuperación.                                                                                                                                                                                                                                                                             |
| `POST /auth/web/login`       | `identifier`, `password`; resuelve NOVAX en el servidor. Cookie HttpOnly y perfil sin secreto. Requiere Origin confiable y `X-Novax-CSRF: 1`. Un `tenant_slug` legado solo se admite si coincide con NOVAX. |
| `POST /auth/register`        | Responde 403 `REGISTRATION_DISABLED`. El alta de personas se realiza desde administración; no crea organizaciones. |
| `POST /auth/forgot-password` | `email`. Respuesta 202 genérica para identidad existente/inexistente. Un slug legado ajeno no genera un correo. |
| `POST /auth/reset-password`  | `token`, `password`. Token aleatorio de 32 bytes, expiración 30 minutos, hash en DB, consumo de un solo uso bajo bloqueo de cuenta. Revoca sesiones y enlaces restantes.                                                                                                                                               |
| `PATCH /auth/me`             | Sesión de usuario; modifica únicamente sus `first_name` y `last_name`.                                                                                                                                                                                                                                                 |
| `POST /auth/change-password` | Sesión de usuario; `current_password`, `password`. Verifica contraseña actual y revoca todas sus sesiones.                                                                                                                                                                                                             |

`GET /auth/me` y `POST /auth/logout` admiten la cookie. Las mutaciones con cookie requieren el encabezado CSRF y un Origin permitido. Las respuestas de API usan `Cache-Control: no-store`. Editar la configuración de NOVAX exige TENANT_OWNER y `tenants.manage`; solo se admiten nombre, timezone y metadata. El slug y la activación no se pueden cambiar desde esta API. Las asignaciones del rol propietario también requieren propietario.

## Flujo de administración

Para incorporar una persona a NOVAX: crear Usuario, crear Cuenta vinculada por `user_external_id`, y asignar uno o más roles. Una cuenta nueva sin roles no obtiene permisos automáticamente. El backend determina la organización y no acepta un tenant aportado por el usuario.

Dispositivo → sensor (métrica/unidad/tipo) → medición. Las pantallas consumen CRUD, consultas y auditoría existentes, sin reemplazar sus reglas de tenant ni exponer IDs numéricos. Auditoría incluye el username actual de la cuenta, más su identidad pública histórica; no se modifican los eventos existentes.

## Pruebas

`npm test` ejecuta pruebas unitarias. La integración usa una base temporal nueva:

```powershell
npm run test:integration
```

La integración inicia el app en un puerto efímero, crea organizaciones sintéticas directamente como fixtures y fija una de ellas como NOVAX mediante su external_id. Comprueba que sesiones, tokens y enlaces de recuperación de la otra organización no permiten acceso. Las consultas se envuelven en una transacción exterior que se revierte al terminar. Usar una base de pruebas aislada: las secuencias de PostgreSQL no se revierten con los fixtures. No toca cuentas existentes ni envía SMTP; el transporte se sustituye dentro del proceso de prueba. La prueba se niega a correr con NODE_ENV=production.

El ejecutor requiere un usuario local con permiso para crear bases. Aplica todas las migraciones
en una base de nombre aleatorio `novax_qa_single_org_...` y elimina únicamente esa base al terminar,
tanto si las pruebas pasan como si fallan. No ejecutarlo con configuración de producción.

## Antes de producción multi-instancia

- Configurar SMTP real y comprobar entrega, remitente, dominio y HTTPS; el transporte real no se ha probado sin esas credenciales.
- Los límites HTTP actuales son en memoria por proceso (30 intentos de login y 8 solicitudes de los flujos públicos por 15 minutos/IP); el bloqueo de login por cuenta y la cadencia de recuperación se conservan en DB. Añadir un store compartido, por ejemplo Redis, y configurar proxies de confianza de forma explícita antes de escalar horizontalmente.
- La búsqueda y envío de recuperación ocurren después de responder para no revelar existencia de cuentas por tiempo de respuesta. El envío es asíncrono en el mismo proceso, sin cola durable: un reinicio puede perder ese intento. Incorporar outbox/worker con reintentos para garantías de entrega; el usuario puede volver a solicitar el enlace pasado el límite.
- Definir retención/purga de sesiones y resets expirados. Añadir CSP/HSTS y cabeceras de despliegue en el proxy, backups, observabilidad y revisión de seguridad operacional.
- Las altas son administrativas. Las invitaciones y verificación de correo no están implementadas.

Referencias de diseño: [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Angular route guards](https://angular.dev/guide/routing/route-guards), [Nodemailer SMTP](https://nodemailer.com/smtp).
