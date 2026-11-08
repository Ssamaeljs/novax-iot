# Incremento: colores condicionales y códigos automáticos

Fecha: 18-10-2026. Implementación sobre los módulos existentes, sin dependencias nuevas ni migraciones de datos.

## Requisitos

- RF-WIDGET-04 (propuesto): configurar y persistir colores de widgets según condiciones numéricas de sensores asociados.
- RF-CODE-01 (propuesto): crear automáticamente los códigos de recursos; no solicitarlos en formularios ni permitir su edición mediante API.
- RNF-SEC-01: validación en servidor y condiciones sin ejecución de código arbitrario.
- RNF-UX-01: colores semánticos compatibles con Light/Dark y etiquetas legibles.

## Situación anterior y clasificación

- Los tres recursos con `code` editable eran proyectos, dispositivos y roles. Solicitarlo era una decisión de experiencia de usuario que se cambia por requisito del PO, no un defecto de Sequelize.
- Los widgets ya tenían `settings` JSONB validado. Añadir condiciones extiende esa configuración, sin reemplazar modelos, rutas, permisos ni la telemetría.
- `key` de sensores y permisos no es un código administrativo: identifica canales/magnitudes o capacidades de autorización. Se conserva. No se inventan nuevos campos `code` en tablas que no los tenían.

## Decisiones y alternativas

Códigos: generador central con prefijos `PRJ`, `DEV`, `ROL` y UUID completo sin guiones. No usa contador `MAX+1`, que introduce carreras concurrentes, ni depende del nombre editable. Se mantienen índices únicos existentes como última garantía. Los códigos no son secretos ni sustituyen `external_id`. No son consecutivos ni su unicidad se afirma como garantía matemática: se usa entropía UUID y restricción de base.

La opción optativa `automaticCodePrefix` en AutoCrud aplica generación durante el alta; solo se activa en los tres servicios correspondientes. Sus esquemas rechazan `code` en POST/PATCH. Las filas existentes y los roles reservados de sistema no se renumeran. Bootstrap conserva explícitamente `TENANT_OWNER` como identificador reservado.

Colores: reglas estructuradas y ordenadas, hasta diez, operadores numéricos cerrados y paleta semántica. Alternativa descartada: fórmulas/JavaScript y colores CSS libres, porque amplían superficie de ataque y dificultan garantizar accesibilidad. No se modifica la arquitectura para crear un motor de alertas: la evaluación es local, pura y de presentación. El servidor valida antes de persistir.

## Archivos nuevos y responsabilidades

- `backend/src/utils/automaticCode.js`: generación centralizada de códigos.
- `backend/src/modules/module-projects/projects/widgetRules.validation.js`: contrato y normalización de condiciones.
- `backend/test/widgetRules.test.js`: generación, unicidad de muestra, validación, límites y compatibilidad con tipos de widget.
- `frontend/src/app/features/projects/widget-colors.ts`: evaluador puro, prioridades y tokens de apariencia.
- `frontend/src/app/features/projects/widget-rules-editor.component.ts`: editor reutilizable de condiciones, altas, orden y eliminación.
- `frontend/src/app/features/projects/widget-colors.spec.ts`: evaluación, presentación, edición y formularios sin códigos.
- `backend/docs/increments/2026-10-18-widget-colors-automatic-codes.md`: evidencia del incremento.

## Archivos modificados y responsabilidades

- `backend/src/helpers/autoCrud/AutoCrudService.js`: opción de código automático durante creación.
- `backend/src/modules/module-projects/projects/projects.service.js`: prefijo PRJ, eliminación de código del contrato de escritura.
- `backend/src/modules/module-iot/devices/devices.service.js`: prefijo DEV y código no editable.
- `backend/src/modules/module-iam/roles/roles.service.js`: prefijo ROL, conservando protecciones de roles del sistema.
- `backend/src/modules/module-projects/projects/board.validation.js`: admite y valida `color_rules` en settings de los cuatro tipos.
- `backend/src/modules/module-projects/projects/board.service.js`: exige sensores numéricos para las condiciones.
- `backend/test/projectsIntegration.test.js`: persistencia, referencia de sensores, código automático e inmutabilidad.
- `backend/test/webIntegration.test.js`: altas de dispositivos/roles sin código e inmutabilidad mediante HTTP.
- `frontend/src/app/features/administration/resource-definitions.ts`: elimina solicitud de códigos de todos los formularios actuales; se conserva visualización en tablas.
- `frontend/src/app/features/projects/project.models.ts`: contratos tipados de reglas.
- `frontend/src/app/features/projects/widget-editor.component.ts`: integra el editor, valida y conserva reglas al aplicar propiedades.
- `frontend/src/app/features/projects/widgets/widget-view.component.ts`: evaluación reactiva, colores y etiqueta visible.
- `frontend/src/app/features/projects/widgets/custom-widget.component.ts`: tokens semánticos y `--widget-color` dentro del aislamiento existente.
- `backend/docs/project-boards.md`: uso y contrato actualizados.
- `backend/README.md`: ejemplo AutoCrud con generación automática.

## Flujos

Alta: formulario sin código → validación API → generación en servidor → creación y auditoría transaccional → respuesta con código y UUID público. Actualizar nombre no cambia el código. Enviar código manual devuelve `422 UNKNOWN_FIELDS`.

Colores: editor → reglas en settings → validación API de referencias, tipos y umbrales → guardado transaccional/versionado existente → lectura de telemetría → primera regla coincidente → tokens semánticos + etiqueta. No se evalúan condiciones con lecturas no numéricas, ausentes o calidad `BAD`; cero y negativos sí son válidos. No hay inferencia de conectividad ni control de antigüedad.

## Pruebas y resultados

- Backend: 35 unitarias aprobadas; dos grupos de integración omitidos en la ejecución ordinaria, ejecutados aparte.
- PostgreSQL/HTTP: 13 escenarios aprobados en base temporal aislada (15 resultados contando los grupos padre); sin cambios a datos de aplicación.
- Angular/Chrome Headless: 55 pruebas aprobadas, siete nuevas en este incremento.
- Contrato de temas: 11 pruebas aprobadas, incluyendo ausencia de colores literales relevantes y contraste de los tokens existentes.
- Build de producción/SSR aprobado. Persiste la advertencia previa del CSS del tablero: 4,29 kB frente al presupuesto orientativo de 4 kB; no se amplió el presupuesto.
- La aceptación visual en equipos físicos y con mediciones reales sigue pendiente del PO; las pruebas de componentes no la sustituyen.

Reproducción: los comandos están en `docs/project-boards.md`. Para probar manualmente: crear un dispositivo, rol y proyecto sin código; verificar códigos generados; añadir condiciones ≥85 rojo y ≥70 ámbar en ese orden; aplicar/guardar, recargar y observar datos por debajo y por encima de límites. Comprobar Light/Dark, cambio de prioridad, dato cero, ausencia de dato y HTML con `color:var(--widget-color)`.

## Riesgos, deuda y mejoras

- Cambio intencionado de contrato: clientes antiguos que envían `code` al crear o modificar deben dejar de enviarlo. No se silencian campos rechazados.
- Códigos largos por preservar entropía completa; si el PO necesita referencias cortas/consecutivas, diseñar un esquema con garantías y migración explícita, no truncar UUID sin analizar colisiones.
- Color se evalúa al refrescar el tablero, no al recibir cada medición. No es un motor de alarmas, no guarda eventos ni envía avisos.
- Las condiciones numéricas no cubren booleanos/texto ni transformaciones de unidades. No se aceptan sensores ajenos al widget ni inferencias entre unidades.
- No se añade caducidad del dato ni histéresis. Son mejoras futuras antes de utilizar estas condiciones para automatizar decisiones operativas.
- Una muestra sin datos válidos usa apariencia por defecto, no debe interpretarse como estado seguro.

## Evidencia para TFM y preguntas de defensa

Documentar trazabilidad requisito-prueba, extensión de AutoCrud sin duplicación, separación entre código y UUID público, modelo declarativo de condiciones y separación visualización/alertas. Capturar un widget con valores y etiquetas a ambos lados de un umbral y una creación sin campo de código.

Preguntas: ¿cómo se evita una carrera al asignar códigos? ¿Por qué no renumerar los existentes? ¿Qué representa `TENANT_OWNER`? ¿Por qué la autorización no usa el código generado? ¿Qué pasa si coinciden dos condiciones? ¿Cómo se evita que un dato ausente active una alerta falsa? ¿Por qué un widget rojo no constituye un sistema de alertas? ¿Por qué rangos en vez de igualdad con valores decimales? ¿Cómo conserva contraste el mismo estado en Light y Dark?
