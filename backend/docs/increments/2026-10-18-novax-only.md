# Operación exclusiva para NOVAX

Fecha: 18 de octubre de 2026.

## Funcionalidad y requisito

Decisión del Product Owner: operar únicamente para NOVAX conservando la estructura
interna de organización, los datos y el control de acceso existente. Este incremento
delimita el prototipo a una empresa; no implementa todavía los adaptadores MQTT,
la normalización heterogénea ni las alertas del TFM.

Los siguientes identificadores son propuestos para registrar este incremento en la
especificación; no se atribuyen a una matriz previa:

| Requisito propuesto | Criterio de aceptación | Evidencia |
| --- | --- | --- |
| RF-ORG-01 | La organización operativa se determina en el backend, no desde un selector del usuario. | Pruebas unitarias y login HTTP sin tenant_slug. |
| RF-ORG-02 | El registro público no puede crear organizaciones, incluso con la antigua variable habilitada. | 403 REGISTRATION_DISABLED y recuento de fixtures sin cambios. |
| RF-ACC-01 | Login y recuperación requieren solo credenciales personales de NOVAX. | Pruebas Angular de formularios y recuperación de integración. |
| RNF-SEG-ORG-01 | Credenciales y enlaces de recuperación de otra organización no permiten operar en esta instalación. | Sesión y token API rechazados; enlace de recuperación ajeno rechazado. |
| RNF-COMP-01 | Se conservan entidades, external_id, permisos, datos y consultas existentes. | Migraciones originales sin cambios y regresión de CRUD, roles, auditoría y mediciones. |

## Implementación y flujo

`src/config/organization.js` centraliza la selección. Si se configura
`NOVAX_TENANT_EXTERNAL_ID`, usa ese UUID; en caso contrario utiliza
`NOVAX_TENANT_SLUG`, cuyo valor predeterminado es `novax-iot`. La organización debe
existir y estar activa. No se toma el primer registro disponible ni se crea uno
automáticamente. La ausencia o configuración inválida genera un error explícito.

Login recibe identifier/password, resuelve NOVAX y consulta la cuenta dentro de su
contexto. El tenant_slug de clientes antiguos es opcional y solo se admite si coincide.
El middleware filtra las sesiones y tokens API mediante la misma selección de
organización. AutoCrud continúa recibiendo el tenant autenticado y aplicando sus filtros.

Recuperación recibe email y busca únicamente dentro de NOVAX. El restablecimiento
también verifica la organización del enlace, incluidos enlaces emitidos anteriormente.
El transporte SMTP real conserva su configuración y no se ha validado en este incremento.

El endpoint público de registro responde 403. Angular elimina los enlaces y formulario
de creación de organizaciones, y redirige la antigua ruta /auth/register a login.
Las altas se realizan desde administración: usuario, cuenta y asignación de roles.

TENANT_OWNER permanece como código interno. Su pantalla puede editar nombre y zona
horaria; el endpoint permite además metadata. El slug y la activación no se pueden
modificar mediante ese CRUD. El bootstrap queda limitado a una base sin organizaciones
ni tokens previos y no debe ejecutarse en la instalación existente.

## Archivos creados

- `src/config/organization.js`: selección y resolución central de NOVAX.
- `.env.example`: configuración reproducible sin secretos.
- `test/organization.test.js`: pruebas unitarias de selección y restricciones.
- `scripts/run-integration-isolated.js`: migraciones y pruebas en una base temporal.
- `docs/increments/2026-10-18-novax-only.md`: evidencia de este incremento.

## Archivos modificados

Rutas relativas a la raíz del repositorio:

- `backend/src/middleware/authentication.js`: limita las credenciales a NOVAX.
- `backend/src/modules/module-iam/auth/auth.service.js`: login y perfil del contexto fijo.
- `backend/src/modules/module-iam/auth/accountAccess.service.js`: cierre de registro y recuperación del contexto fijo.
- `backend/src/modules/bootstrap/bootstrap.service.js`: inicialización única de NOVAX.
- `backend/src/modules/module-core/tenants/tenants.service.js`: configuración editable sin cambiar identidad ni activación.
- `backend/test/webIntegration.test.js`: fixtures aislados y regresión de acceso y negocio.
- `backend/package.json`: comando test:integration.
- `backend/README.md` y `backend/docs/web-platform.md`: contratos, instalación y pruebas.
- `frontend/src/app/features/auth/auth.page.ts`, `.html` y `.css`: login/recuperación sin selector y retirada del registro.
- `frontend/src/app/app.routes.ts`: redirección de la antigua ruta de registro.
- `frontend/src/app/shared/layout/navbar.component.ts`: navegación de acceso a NOVAX.
- `frontend/src/app/features/landing/landing.page.ts` y `.html`: contenido y acciones del alcance de una empresa.
- `frontend/src/app/features/settings/advanced.page.ts`: configuración de NOVAX sin edición del slug.
- `frontend/src/app/core/auth/auth.spec.ts` y `frontend/src/app/app.routes.spec.ts`: contratos y navegación.
- `frontend/README.md`: comportamiento y alcance actuales.

## Decisiones técnicas

Se conservan las tablas, relaciones y migraciones. Una política operativa central permite
acotar el sistema sin una migración destructiva ni una reescritura de los servicios.
No se añaden dependencias. El despliegue determina la organización; ocultar únicamente
el selector del frontend no sería suficiente para restringir credenciales antiguas.

No se modifica el .env real. Se verificó mediante una transacción de solo lectura que
el selector configurado encuentra una organización activa. La aplicación debe reiniciarse
para cargar el nuevo código. No es necesario repetir bootstrap ni aplicar migraciones nuevas.

## Pruebas y resultados

- Backend: 24 pruebas unitarias aprobadas; la suite de base de datos permanece opt-in.
- Integración: siete escenarios aprobados, ocho elementos contabilizados por node:test
  al incluir la suite. Se aplicaron las once migraciones originales en una base temporal nueva.
- Angular: 33 pruebas aprobadas, incluyendo login sin organización, redirección del registro
  y recuperación mediante email.
- Temas: 11 pruebas aprobadas.
- Compilación de producción de Angular: correcta.
- Revisión de diferencias: sin errores de espacios detectados por git diff --check.

La primera ejecución ampliada de integración alcanzó el límite HTTP existente de ocho
solicitudes compartidas entre los flujos públicos. Se eliminó una solicitud redundante
de la prueba y la suite pasó sin alterar los límites de producción.

Las bases temporales creadas para la verificación se eliminaron al finalizar. No se
ejecutaron migraciones ni escrituras sobre la base de la aplicación. SMTP se sustituyó
dentro del proceso de prueba, por lo que no se enviaron correos reales.

Para repetir las verificaciones desde backend:

```text
npm test
npm run test:integration
```

La integración requiere PostgreSQL local y permiso para crear bases, y se niega a operar
si NODE_ENV=production. El nombre temporal se genera internamente y su limpieza solo
apunta a la base creada por esa ejecución. Una terminación forzada del proceso puede
interrumpir la limpieza; no utilizar este ejecutor contra infraestructura productiva.

## Deuda técnica y riesgos pendientes

- La estructura multitenant permanece en la base; la restricción implementada es operativa.
- Cambiar la selección del despliegue puede dejar credenciales existentes fuera del contexto;
  configurar el UUID correcto y comprobarlo antes de un cambio de entorno.
- La recuperación requiere SMTP real y conserva el envío asíncrono sin cola durable.
- Persisten las incidencias de la auditoría anterior ajenas a este alcance, incluida la
  protección integral de cuentas propietarias y la validación uniforme de contraseñas.
- La configuración de backups, el bloqueo de migraciones y los rangos de sensores siguen
  pendientes del incremento de correcciones correspondiente.
- No se añaden invitaciones, verificación de correo ni integración IoT nueva.

## Evidencia y defensa del TFM

Puede documentarse como una delimitación del alcance a una empresa, con conservación
de la arquitectura existente y comprobación de seguridad en el backend. Las pruebas
relacionan la decisión del Product Owner con contratos y resultados verificables.

Preguntas de defensa:

- ¿Por qué se conservó tenant_id si el prototipo atiende a una sola empresa?
- ¿Qué diferencia existe entre ocultar un selector y restringir el acceso en el servidor?
- ¿Cómo se comprueba que una credencial antigua de otra organización no obtiene acceso?
- ¿Cómo se incorporan personas a NOVAX y qué permisos recibe una cuenta nueva?
- ¿Cómo se ejecutan pruebas de integración sin alterar los datos de la aplicación?

La futura simplificación del esquema puede evaluarse como otro incremento. La siguiente
prioridad del TFM continúa siendo el contrato común y la integración HTTP/MQTT.
