# Incremento: usabilidad transversal y preparación de evaluación SUS

Fecha: 18-10-2026. Estado: implementación y pruebas técnicas completadas; evaluación con usuarios pendiente. No se declara certificación ni puntuación SUS.

## Requisitos relacionados

- RNF-USAB-01 (propuesto): acciones contextualizadas, orientación y recuperación de errores.
- RNF-USAB-02 (propuesto): evitar pérdida accidental de ediciones de catálogos/tableros.
- RNF-ACC-01 (propuesto): foco de teclado, mensajes asociados y objetivos táctiles adecuados.
- RNF-EVAL-01 (propuesto): evaluar tareas y usabilidad percibida mediante SUS, conservando evidencia reproducible.

## Análisis, alcance y decisiones

Se inspeccionaron los componentes compartidos y páginas principales de la aplicación ya existente. La [auditoría detallada](../../../frontend/docs/usability-audit.md) relaciona área, diagnóstico, clasificación, corrección y verificación pendiente. No se sustituyó la arquitectura ni se añadieron dependencias.

Se priorizó intervenir en componentes compartidos porque afectan inventario, proyectos y administración de forma uniforme. Los errores de formularios se distinguen de fallos de red y de resultados vacíos. Las etiquetas de enums son presentación: se mantienen los valores originales en peticiones y en atributos semánticos de estado.

Se descartó crear un «modo SUS» o cuestionario propio dentro del producto: añadir controles no demuestra usabilidad. Se eligió protocolo externo con versión española publicada y calculador local sin telemetría de usuarios. Una ronda inicial pequeña proporciona evidencia formativa, no garantías poblacionales.

## Funcionalidad implementada

- Acciones y títulos CRUD identifican dispositivo, sensor, usuario, cuenta, rol, proyecto o token.
- Formularios muestran errores específicos y resumen enlazado; los campos indican obligatoriedad e identifican el mensaje asociado.
- Directiva compartida enfoca el primer campo inválido al enviar un formulario reactivo; no cambia validadores ni valores.
- Cierre/Escape y salida por router desde formularios CRUD requieren confirmar pérdida de cambios; se avisa al cerrar pestaña. Guardado en curso bloquea la navegación normal, pero no la salida tras cerrar o perder la sesión.
- Limpieza de filtros y acciones útiles desde estados vacíos; recuperación de páginas inexistentes tras cambios de resultados.
- Descripciones de proyectos multilínea y etiquetas legibles de estado/tipo/calidad sin cambiar contratos HTTP.
- Guía dentro del producto, con pasos, límites reales y enlaces filtrados por permisos.
- Foco en título al activar pantalla y controles táctiles más amplios; se preservan movimiento reducido, foco visible y temas.
- Protocolo de estudio, registro de tareas anónimo y puntuación SUS reproducible sin inventar participantes.

## Archivos nuevos

- `frontend/src/app/shared/ui/form-focus.directive.ts`: recuperación de foco en formularios reactivos.
- `frontend/src/app/shared/ui/field-error.ts`: mensajes coherentes según errores existentes de Angular.
- `frontend/src/app/shared/ui/enum-label.ts`: traducción de presentación, conservando valores técnicos.
- `frontend/src/app/features/help/help.page.ts`: ayuda accesible a usuarios autenticados según sus permisos.
- `frontend/src/app/features/usability.spec.ts`: diez regresiones de interacción/validación/navegación.
- `frontend/tools/sus-score.cjs`: cálculo local, validación de respuestas e indicadores descriptivos.
- `frontend/test/sus-score.test.cjs`: tres pruebas del cálculo con entradas sintéticas, no resultados del estudio.
- `frontend/docs/usability-audit.md`: hallazgos y backlog.
- `frontend/docs/usability-study.md`: instrumento de referencia, consentimiento, tareas, recogida, análisis y límites.
- `frontend/docs/usability-task-record.csv`: cabecera vacía para registrar sesiones sin datos personales.
- `backend/docs/increments/2026-10-18-usability-sus.md`: esta evidencia.

## Archivos modificados

- `frontend/src/app/app.routes.ts`: guardas de edición para catálogos y ruta de guía.
- `frontend/src/app/layouts/workspace-layout.component.ts`: foco tras activación de pantalla.
- `frontend/src/app/shared/layout/navigation.component.ts`: guía y terminología en español.
- `frontend/src/app/features/administration/resource.page.ts`: errores, filtros, paginación y control de borradores compartidos.
- `frontend/src/app/features/administration/resource.page.html`: acciones, resumen, asociación de errores, campos y estados vacíos.
- `frontend/src/app/features/administration/resource-definitions.ts`: tipo textarea y descripción del proyecto.
- `frontend/src/app/features/auth/auth.page.ts` y `.html`: título de acceso y foco compartido.
- `frontend/src/app/features/account/account.page.ts`: foco compartido y estado de proceso del perfil.
- `frontend/src/app/features/settings/advanced.page.ts`: foco y estado de guardado.
- `frontend/src/app/features/operations/measurement-entry.page.ts`: foco, estado de registro y etiquetas de calidad.
- `frontend/src/app/features/monitoring/monitoring.page.ts`: limpieza de filtros y calidad legible.
- `frontend/src/app/features/overview/overview.page.ts`: estados reportados en lenguaje comprensible.
- `frontend/src/styles.css`: tamaños mínimos bajo puntero grueso.
- `frontend/README.md`: acceso a guía y evidencias de usabilidad.

No se modificaron backend, modelos, endpoints, permisos, secretos ni base de datos en este incremento. Los incrementos anteriores del mismo directorio de trabajo se conservan.

## Flujo y pruebas

Formulario inválido → validación existente → mensajes específicos/resumen → foco al primer campo → corrección → petición original → aviso de éxito o error recuperable. Cancelación con cambios → confirmación → conservar o descartar explícitamente. Las redirecciones tras pérdida de sesión no quedan atrapadas por esa confirmación.

Resultados: 65 pruebas Angular aprobadas (10 nuevas); 11 de contrato de temas aprobadas y 3 del calculador SUS aprobadas. Se verifica foco, etiquetas, vacíos, filtros, paginación, descarte deliberado, referencias aria, rutas protegidas y salida tras sesión expirada. La compilación de producción/SSR pasa; persiste la advertencia previa del CSS del tablero (4,29 kB frente a presupuesto orientativo de 4 kB).

Comandos desde `frontend`: `node node_modules/@angular/cli/bin/ng.js test --watch=false --browsers=ChromeHeadless`, `node --test test/theme-contract.test.cjs test/sus-score.test.cjs`, `node node_modules/@angular/cli/bin/ng.js build`.

Prueba manual de aceptación: abrir un catálogo vacío, crear sin completar obligatorios, corregir desde el resumen, editar y rechazar descarte, limpiar búsqueda, consultar guía con rol limitado y repetir en Light/Dark y móvil. Las pruebas de DOM no sustituyen lector de pantalla, dispositivos físicos ni estudio con participantes.

## Deuda, riesgos y próximas mejoras

- No hay puntuación SUS ni línea base medida. Primero ejecutar el [protocolo](../../../frontend/docs/usability-study.md); no inventar mejora cuantitativa a partir de cambios de código.
- Protección de borradores en cuenta/organización/ingreso manual y propiedades de widget aún no uniforme; está identificada en la auditoría, no se declara resuelta.
- Confirmación nativa deliberada para no introducir un sistema de diálogos global nuevo; evaluar con usuarios si necesita una presentación más contextual.
- Catálogos grandes requieren búsqueda remota y estudio de eficiencia; no basta ocultar resultados o añadir más selectores.
- Pendiente validación visual física, teclado/lector de pantalla y zoom. No se declara cumplimiento WCAG integral.
- La guía aclara restricciones reales; no implementa capacidades faltantes de ingesta, vídeo, alertas o agregaciones.

## TFM y defensa

Se puede documentar inspección inicial, clasificación de hallazgos, priorización Kanban, extensión de componentes compartidos, matriz requisito-prueba, versión evaluada y protocolo reproducible. Tras sesiones reales añadir resultados, limitaciones de muestra y decisiones de mejora.

Preguntas de tribunal: ¿por qué SUS no es certificación? ¿Qué diferencia hay entre éxito de tarea y usabilidad percibida? ¿Por qué no cambiar los ítems de una escala validada? ¿Cómo se evita sesgo del desarrollador como moderador? ¿Qué evidencia demuestra que una mejora funciona? ¿Cómo se separan autorización, accesibilidad y usabilidad? ¿Por qué no se permite que el guard de borradores impida un cierre de sesión?
