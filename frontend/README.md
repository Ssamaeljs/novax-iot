# Novax IoT · frontend

Angular 19 standalone, signals, formularios reactivos, HttpClient, Router y carga diferida por funcionalidad. Light, Dark y System comparten tokens semánticos. No se añadieron dependencias de ejecución al frontend.

## Estado y alcance

El frontend anterior era un catálogo visual sin autenticación ni consumo de API. Ahora la landing es pública, el workspace está protegido y los catálogos consumen los endpoints Express/Sequelize existentes. El catálogo de ejemplo se conserva únicamente en `/design-system`, claramente separado de los datos reales.

Implementado:

- Landing, navbar/footer reutilizables; navegación de escritorio/móvil con RouterLink.
- Login web exclusivo para NOVAX, recuperación y restablecimiento por correo. Las altas son administrativas.
- Menú de usuario: Cuenta, Configuración y Opciones avanzadas para TENANT_OWNER.
- Administración: usuarios, cuentas, roles, asignación de permisos, catálogo de permisos, tokens y auditoría.
- Operación: CRUD de dispositivos/sensores y registro manual de mediciones tipadas.
- Monitorización: historial paginado, sensor, intervalo, calidad y gráfico numérico con unidades.
- 403/404, estados vacíos, errores de API y reconexión manual.
- Las rutas, botones y menús consideran permisos; el backend sigue siendo la autoridad.

## Ejecutar localmente

1. En `../backend`: instalar dependencias y ejecutar `npm run db:migrate`; luego `npm start`.
2. En esta carpeta: `npm install` y `npm start`.
3. Abrir `http://localhost:4200` o `http://127.0.0.1:4200`. No alternar ambos hosts durante una sesión: las cookies son propias de cada host.

`proxy.conf.json` dirige `/v1/api/**` al backend local en el puerto 5000. El frontend usa URLs relativas centralizadas en `core/api/api.service.ts`; no contiene credenciales ni direcciones de servidor repartidas por componentes. Si cambia el puerto backend, ajustar el proxy y reiniciar Angular.

El login solicita usuario/correo y contraseña; la recuperación solo solicita correo. El backend
resuelve NOVAX y rechaza credenciales de otras organizaciones. El registro de empresas está
cerrado y `/auth/register` redirige a login; ya no se muestran formularios ni enlaces para crear
organizaciones. La estructura de tenant y el rol `TENANT_OWNER` se conservan internamente.
Consultar `../backend/docs/web-platform.md`. Sin SMTP, la interfaz explica que el envío de
correos no está disponible.

## Organización Angular

```text
src/app/
  core/
    api/          cliente HTTP, envelopes, paginación y errores
    auth/         identidad en memoria, sesión, interceptor y guards
    theme/        servicio central de tema
  shared/
    layout/       navbar, footer, navegación
    ui/           iconos, selector de tema, badges, gráficos
  layouts/        estructura pública y workspace privado
  features/
    landing/      entrada pública
    auth/         login NOVAX, recuperación y reset
    overview/     resumen real por permisos
    administration/ definiciones de recursos y CRUD declarativo
    operations/   ingreso de mediciones
    monitoring/   consultas y visualización de lecturas
    account/      perfil y contraseña
    settings/     preferencias y organización (propietario)
    errors/       403/404
    design-system/ catálogo ilustrativo, sin llamadas de negocio
  app.routes.ts   rutas lazy y sus permisos
src/testing/      identidades sintéticas para pruebas
```

`ResourcePage` comparte tabla, búsqueda, paginación, detalle, editor, confirmación y asignaciones. `resource-definitions.ts` declara endpoint, permiso, columnas y campos de cada catálogo. No infiere columnas escribibles desde respuestas del servidor. Se envían únicamente los campos configurados y siempre se direcciona con `external_id`.

Para agregar un recurso: definir su contrato y campos, registrar ruta con permiso y añadir navegación. Cuando un proceso requiera comportamiento especializado (por ejemplo, plano de instalación o comandos remotos), crear una feature específica; no convertir el CRUD genérico en una capa de negocio universal.

## Autenticación y seguridad

- `POST /auth/web/login` emite una cookie HttpOnly, SameSite=Lax y Secure en producción. La respuesta no contiene el secreto de sesión.
- No se almacenan tokens, contraseñas ni permisos en localStorage. Solo la preferencia visual usa localStorage.
- `AuthService.restore()` recupera identidad y permisos mediante `/auth/me`. Las solicitudes simultáneas comparten la restauración pendiente.
- El interceptor aplica credenciales y `X-Novax-CSRF` únicamente a la API relativa. Un 401 invalida la identidad; un fallo de logout no se presenta como cierre exitoso.
- El backend verifica Origin y el encabezado CSRF en las mutaciones autenticadas por cookie. La API Bearer existente sigue disponible para integraciones.
- El retorno tras login se limita a rutas internas `/app`; no se aceptan URLs externas.
- El token de recuperación va en el fragmento del enlace, se elimina de la URL al abrir el formulario y no se almacena en el navegador. Al recargar esa página hay que volver a abrir el enlace del correo.
- El token de integración generado se muestra una única vez y se elimina del estado al cerrar su diálogo. Nunca es la credencial de autenticación del frontend.

## Despliegue

Servir frontend y `/v1/api` bajo el mismo origen HTTPS con un proxy inverso. Angular dev proxy no forma parte del build de producción. El proxy debe enviar `/v1/api/` al backend conservando el prefijo; el resto al servidor Angular. No habilitar CORS con comodines.

Configurar el backend con `NODE_ENV=production`, `WEB_ORIGIN=https://dominio-real` y `CORS_ORIGINS=https://dominio-real`. Conservar Origin, Cookie y Set-Cookie. Configurar correctamente IPs/proxies de confianza antes de escalar los límites por IP.

La landing está prerenderizada. Las rutas privadas y de autenticación son client-rendered: no se cachea HTML personalizado ni se introducen secretos en el prerender.

## Arquitectura del tema

1. `src/index.html` carga `public/theme-init.js` de manera síncrona en el head, antes del primer pintado. No añadir `async` ni `defer` a este script.
2. Ese pequeño runtime es el único responsable de resolver preferencias, acceder a `localStorage`, escuchar el sistema y aplicar `data-theme` al elemento `html`.
3. `ThemeService` proporciona `preference()`, `resolved()`, `ready()` y `setPreference()`. Conecta el runtime con signals después del primer renderizado. No duplica las reglas de persistencia ni accede a APIs del navegador durante SSR.
4. El selector utiliza el servicio; los componentes se adaptan mediante tokens CSS, sin condicionales Light/Dark locales.

Preferencia almacenada: `novax.theme = light | dark | system`. Por defecto se usa System. Una selección explícita tiene prioridad sobre el sistema operativo. System escucha `prefers-color-scheme` en tiempo real. Se sincronizan cambios entre pestañas; si el almacenamiento está bloqueado, el selector continúa funcionando durante la sesión.

El estado inicial de Angular es idéntico en servidor y cliente para evitar diferencias de hidratación. Los colores ya están aplicados por el script inicial. El selector se habilita cuando el servicio está conectado.

Para servir el resultado de producción con SSR, configurar `NG_ALLOWED_HOSTS` con los hostnames explícitos del despliegue. En una prueba local puede usarse `localhost,127.0.0.1`; en producción indicar los dominios reales, sin comodines. La versión instalada de Angular aplica esta protección contra SSRF y, sin la configuración, puede devolver la versión de renderizado cliente. La comprobación local con esos hosts autorizados devolvió el HTML prerenderizado correctamente.

`src/main.server.ts` transmite el `BootstrapContext` requerido por la versión instalada de Angular. El servidor SSR revalida `theme-init.js` en vez de conservarlo un año en caché, porque este recurso no tiene nombre con hash. Si se sirve detrás de otro servidor/CDN, conservar esta excepción de caché y permitir el script local en la política CSP. No se necesita un script inline de inicialización.

## Design Tokens

- `src/styles/palette.css`: valores primitivos de identidad Primary, Accent y estados.
- `src/styles/tokens.css`: asignación semántica completa por tema y aliases compartidos.
- `src/styles/primitives.css`: patrones visuales reutilizables.
- `src/styles.css`: punto de entrada, tipografía, foco, reduced motion y forced colors.

Las familias incluyen superficies, texto, bordes, acciones, sidebar, tablas, campos, overlays, tooltips, skeletons, estados IoT y seis series para gráficos. Los colores literales pertenecen exclusivamente a palette/tokens; los componentes consumen nombres semánticos.

El color Primary de uso textual en Light se ajustó ligeramente respecto de la paleta primitiva para alcanzar contraste AA en las superficies previstas. También se ajustaron textos de acento y estados. La paleta original permanece disponible como identidad; no utilizar sus primitivas directamente en componentes.

Ejemplo de consumo:

```css
.device-panel {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}
```

No usar `--accent` como texto pequeño: utilizar `--accent-text`. Los botones sólidos usan pares de fondo y texto `--primary / --on-primary`, `--accent / --on-accent` y `--danger / --on-danger`. Los aliases compartidos se resuelven en el elemento raíz; los temas se aplican a `html`, no a subárboles arbitrarios.

## Agregar un tercer tema

1. Añadir un bloque `[data-theme='nuevo']` después de Dark en `tokens.css`, con todos los tokens de Light y la propiedad `color-scheme` apropiada. No modificar los estilos de cada componente.
2. Registrar `nuevo` en el arreglo `themes` de `public/theme-init.js`. System seguirá resolviendo Light o Dark.
3. Ampliar el tipo `Theme` en `theme.service.ts`.
4. Añadir su opción, icono y anuncio accesible al selector.
5. Ampliar las pruebas de persistencia, paridad de tokens, contraste e integración para el nuevo tema.

## Pruebas

```sh
npm run test:theme
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

Alternativa si el shim npm no funciona: `node node_modules/@angular/cli/bin/ng.js` seguido de `test`, `build` o `serve`. Para el contrato visual: `node --test test/theme-contract.test.cjs`.

Pruebas Angular cubren tema, tablas, modales, validación, menú por rol, guards, sesión, rutas públicas/privadas, 404 y endpoints de catálogos. El contrato visual comprueba arranque temprano, persistencia, contraste de pares semánticos, paridad de tokens y ausencia de colores literales fuera de tokens/paleta. El backend dispone de pruebas de integración PostgreSQL con rollback, documentadas en su guía.

## Proyectos y tableros

En **Proyectos** se crean agrupaciones visuales con código, título y descripción. **Abrir tablero** permite visualizar sensores; **Editar tablero** abre la biblioteca derecha con termómetro, gauge, línea temporal comparativa y HTML/CSS sin JavaScript. Posición, tamaño y bloqueo se guardan explícitamente. Los manejadores admiten puntero y teclado; las propiedades permiten edición alternativa en móvil.

La página se carga de forma diferida desde `features/projects`; reutiliza autenticación, permisos, API, temas y administración existentes. Histórico: hasta 200 muestras por sensor de 1 h, 6 h, 24 h o 7 días, sin agregaciones; refresco cada 30 segundos. Consulte [contrato y seguridad](../backend/docs/project-boards.md) y [evidencia TFM](../backend/docs/increments/2026-10-18-project-boards.md).

## Usabilidad y evaluación SUS

La **Guía de uso** está disponible dentro de la plataforma en `/app/help`, con enlaces según permisos. Los formularios reactivos comparten foco al primer campo inválido; los catálogos añaden errores concretos, recuperación de filtros y protección de cambios sin guardar. Se conservan temas, contratos y lógica de negocio.

La [auditoría](docs/usability-audit.md) distingue correcciones y aspectos pendientes. El [protocolo de evaluación](docs/usability-study.md) prepara tareas y el instrumento SUS español validado, sin atribuir una puntuación no medida. El registro de tareas está en `docs/usability-task-record.csv`.

Pruebas del calculador: `node --test test/sus-score.test.cjs`. Con respuestas reales anonimizadas: `node tools/sus-score.cjs ruta-a-respuestas.json`. El calculador no forma parte del frontend publicado ni envía información a la API.

## Alcance funcional actual

Los breadcrumbs del espacio autenticado se definen en `data.breadcrumb` de las rutas y se presentan desde un componente compartido en el layout. Permiten volver a listados y al dispositivo de origen desde reportes/medición manual, mediante RouterLink y respetando permisos/guardas. Véase [navegación breadcrumb](docs/breadcrumb-navigation.md).

**Detalle operativo del dispositivo** (`/app/device/:deviceId`, UUID público) se abre desde Dispositivos → Abrir. Incluye breadcrumb, ficha lateral, sensores paginados en tarjetas/tabla y última lectura por sensor. Permite crear, editar y activar/desactivar sensores según permisos; Reportes y Medición manual conservan el contexto del dispositivo/sensor. Sincronizar vuelve a consultar el servidor, no envía comandos al hardware. Véase [evidencia del incremento](../backend/docs/increments/2026-10-18-device-operational-detail.md).

La gestión contextual utiliza `/iot/devices/:device_external_id/sensors`: el dispositivo se fija por la ruta y el servidor verifica la pertenencia de cada canal. Para un DHT11 conectado al ESP32, registra dos canales mediante las plantillas Temperatura y Humedad; sus claves deben coincidir con el perfil HTTPS/MQTT. El catálogo de sensores enlaza al dispositivo asociado. No hay autodescubrimiento de hardware ni una entidad separada de componente físico. Véase [vínculo dispositivo–sensor](../backend/docs/increments/2026-10-18-device-sensor-link.md).

**Integraciones** (`/app/integrations`) permite a roles con `integrations.manage` publicar modelos de datos declarativos/versionados, probar normalización sin guardar telemetría y gestionar fuentes vinculadas a dispositivos. Las credenciales se muestran una vez y no se guardan en el navegador. El acceso de consulta usa `integrations.read`. Véase [guía HTTPS/MQTT](../backend/docs/integration-common-model.md).

El criterio de interfaz es **móvil y operación primero**: acciones y datos de trabajo antes de ayuda/configuración secundaria. Véase [diseño responsive operativo](docs/mobile-operational-design.md) para comportamiento, tamaños probados y aceptación pendiente en dispositivos físicos. Los listados usan fichas etiquetadas en móvil sin eliminar columnas ni acciones; los widgets conservan su geometría guardada al apilarse.

- La ingesta HTTPS/MQTT se configura mediante fuentes y modelos versionados en Integraciones. Registrar un dispositivo por sí solo no establece comunicación. El broker MQTT debe habilitarse en servidor; la interfaz no constituye streaming en vivo.
- Las gráficas muestran las muestras de la página consultada, respetan tiempo y unidades y no mezclan sensores. No son agregaciones diarias/mensuales ni resúmenes de todo el histórico.
- El alcance de nuevas integraciones es HTTPS y MQTT. Los registros HTTP/ONVIF anteriores se conservan como legado; no se implementa vídeo ni una integración ONVIF.
- Los selectores de relaciones recorren la paginación hasta 5.000 registros y muestran error si se supera ese límite; para catálogos mayores corresponde un buscador remoto.
- No hay invitaciones ni verificación de correo. Los usuarios se incorporan a NOVAX desde administración mediante usuario, cuenta y roles.
- Las pruebas de contraste no sustituyen una auditoría integral de accesibilidad ni pruebas en dispositivos físicos.
