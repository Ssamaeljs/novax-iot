# Incremento: breadcrumbs del espacio de trabajo

## Funcionalidad y requisito

Orientación y regreso a pantallas anteriores dentro de la jerarquía funcional. Antes existían enlaces locales en el detalle del dispositivo, medición manual, monitorización y tablero; el resto del espacio de trabajo no tenía breadcrumbs consistentes.

Se centraliza un componente reutilizable en el layout autenticado, sin modificar endpoints, datos, formularios ni permisos. No se añade historial artificial del navegador ni se utilizan enlaces externos para volver.

Ejemplos:

- Inicio → Dispositivos → Dispositivo.
- Inicio → Dispositivos → Dispositivo → Medición manual.
- Inicio → Dispositivos → Dispositivo → Reportes de mediciones.
- Inicio → Proyectos → Tablero.
- Inicio → Configuración → Opciones avanzadas.
- Inicio → Usuarios / Cuentas / Roles / Permisos / Auditoría / Integraciones, según la página.

## Arquitectura y decisiones

- `shared/layout/breadcrumbs.component.ts` lee la ruta activa y sus datos declarativos. Reacciona a NavigationEnd mediante signal, compatible con navegación cliente y renderizado de servidor.
- `app.routes.ts` define `data.breadcrumb`: `label`, `parents` opcionales (etiqueta, comandos y permiso) y `deviceContext` para páginas que reciben un dispositivo de origen.
- `layouts/workspace-layout.component.ts` presenta una sola instancia antes del contenido de la ruta. Se retiran breadcrumbs locales y el enlace duplicado del tablero.
- El contexto `?device=<UUID>` conserva el enlace al dispositivo al abrir reportes o registro manual. Solo se construye ese enlace con UUID válido. Los UUID no se muestran como etiquetas.
- Los antecesores usan RouterLink; las guardas de cambios pendientes siguen aplicándose. No se usa `history.back()` porque una visita directa puede provenir de una página externa o no tener una pantalla previa de la aplicación.
- El elemento actual no es un enlace y usa `aria-current="page"`. El contenedor usa `nav` con nombre accesible y una lista ordenada; separadores ocultos a tecnologías de asistencia.
- Los padres que requieren un permiso no ofrecen enlaces cuando el usuario carece de él. Las guardas de rutas siguen siendo la protección de acceso; los breadcrumbs no la sustituyen.
- Los enlaces apuntan a páginas existentes, no a grupos ficticios como `/app/administration` o `/app/operations`.
- Los estilos utilizan tokens semánticos y se ajustan mediante wrapping a pantallas pequeñas. Se mantienen los estilos globales de foco.
- Desde Medición manual, Consultar historial también conserva dispositivo y sensor.

## Archivos creados

- `frontend/src/app/shared/layout/breadcrumbs.component.ts`: presentación y lectura centralizada del contexto de ruta.
- `frontend/src/app/shared/layout/breadcrumbs.spec.ts`: navegación, metadatos, permisos, validación de contexto y respeto de guardas.
- Este documento de evidencia.

## Archivos modificados

- `frontend/src/app/app.routes.ts`: etiquetas y antecesores declarativos.
- `frontend/src/app/layouts/workspace-layout.component.ts`: ubicación común de los breadcrumbs.
- `frontend/src/app/features/devices/device-detail.page.html` y `.css`: eliminación del breadcrumb local y sus estilos obsoletos.
- `frontend/src/app/features/devices/device-detail.spec.ts`: evita comprobar una navegación que ahora corresponde al layout.
- `frontend/src/app/features/monitoring/monitoring.page.ts`: retira navegación local e importación obsoleta.
- `frontend/src/app/features/operations/measurement-entry.page.ts`: retira breadcrumb local y conserva contexto al consultar historial.
- `frontend/src/app/features/projects/project-board.page.html` y `.css`: retira enlace duplicado de regreso y sus estilos.
- `frontend/src/app/features/responsive.spec.ts`: verifica breadcrumbs contextuales a 320 px en ambos temas.
- `frontend/README.md`: referencia de mantenimiento.

## Pruebas y resultado

- 116 pruebas Angular correctas: seis pruebas del componente, dos nuevas de responsive y las pruebas existentes.
- Navegación real con RouterTestingHarness: regreso a Dispositivos, tablero a Proyectos, retorno contextual desde reportes/medición, UUID inválido, padres sin permisos, etiquetas administrativas, inicio, 404 y cancelación de navegación con una guarda.
- Comprobación de todos los metadatos de páginas existentes para evitar rutas sin etiqueta.
- Responsive a 320 px Light/Dark sin desbordamiento y con enlace al dispositivo accesible.
- Compilación de producción correcta. Persiste la advertencia previa del CSS del tablero de proyectos (aproximadamente 4,45 kB frente a presupuesto de 4 kB).
- No hay cambios backend, migraciones, nuevas dependencias ni cambios de datos.

## Cómo probar y mantener

Abrir un dispositivo, crear una medición o consultar reportes desde un sensor y utilizar el enlace Dispositivo del breadcrumb. Abrir un tablero y volver a Proyectos. Revisar administración y configuración en escritorio/móvil, con teclado y en ambos temas. Modificar un formulario protegido y comprobar que el enlace de regreso no omite la confirmación de cambios pendientes.

Para una nueva página, añadir `data.breadcrumb.label` a la ruta; declarar padres solo si tienen una pantalla real. Especificar su permiso y usar comandos RouterLink. La prueba de cobertura de metadatos detecta páginas existentes sin etiqueta.

## Límites y posibles mejoras

Los breadcrumbs expresan jerarquía, no el historial exacto de visitas. El detalle se etiqueta Dispositivo/Tablero; su nombre específico permanece en el encabezado. La landing y autenticación conservan su layout público sin añadir una jerarquía innecesaria. No se restauran filtros/paginación de listados al volver; sería un requisito adicional. La comprobación automatizada no sustituye aceptación con usuarios ni certificación SUS/accesibilidad.

## TFM y defensa

Documentar reutilización del componente, navegación declarativa, consistencia y orientación operativa, accesibilidad y pruebas. Preguntas posibles: ¿por qué jerarquía y no history.back()?, ¿cómo se conserva el dispositivo de origen?, ¿qué ocurre sin permisos?, ¿por qué los enlaces respetan las guardas?, ¿cómo se evita duplicar lógica en cada pantalla?
