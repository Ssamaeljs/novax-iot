# Auditoría de usabilidad y plan de mejora NOVAX

Fecha: 18-10-2026. Método: inspección de código, recorridos de flujos en plantillas/rutas y pruebas automatizadas de componentes. No es una evaluación con participantes ni una certificación SUS/WCAG.

## Alcance y criterios

Se revisaron la entrada pública y acceso, layout y navegación, catálogos compartidos, usuarios/cuentas/roles/permisos/tokens/auditoría, inventario, sensores, monitorización, ingreso de lecturas, proyectos/widgets, cuenta, configuración y pantallas de error. Los módulos que usan ResourcePage comparten sus mejoras sin duplicarlas.

Criterios: claridad de acciones, visibilidad del estado, prevención y recuperación de errores, consistencia, orientación, control del usuario, teclado, legibilidad, permisos y límites explícitos del producto. Estos criterios orientan la intervención; no se presentan como una lista normativa de SUS.

| Área | Evidencia y diagnóstico | Clasificación | Resultado de este incremento |
| --- | --- | --- | --- |
| Catálogos de dispositivos, sensores y administración | Acciones genéricas «Crear registro» sin contexto | Mejora recomendable UX | «Crear dispositivo», «Crear sensor», etc.; títulos de editor contextualizados |
| Formularios CRUD | Mensaje genérico de valor incorrecto; sin resumen enlazado | Mejora recomendable/accesibilidad | Errores concretos, resumen con botones que enfocan campos, asociación aria y límites visibles en controles |
| Formularios reactivos | No enfocaban el primer campo inválido al enviar | Mejora recomendable/accesibilidad | Directiva compartida en acceso, CRUD, cuenta, organización y registro de mediciones |
| Editores CRUD | Cancelar, Escape o navegar podía perder trabajo | Riesgo de pérdida de cambios | Confirmación de descarte en cierre/navegación; aviso de cierre de pestaña; guard no bloquea salida tras logout/sesión expirada |
| Búsqueda/auditoría | No existía limpieza rápida de filtros | Mejora recomendable UX | Limpiar filtros y «Mostrar todos» en estado vacío filtrado |
| Paginación CRUD | Una página podía quedar vacía tras reducirse el conjunto | Error de navegación de resultados | Retrocede a página existente; no oculta los errores de red |
| Vacíos | No orientaban a la siguiente acción | Mejora recomendable UX | Alta contextual cuando existe permiso y enlace de guía en inventario/proyectos |
| Etiquetas técnicas | Estado, tipo y calidad aparecían como enums ingleses | Mejora recomendable UX | Texto comprensible en español; valores enviados y data-status originales se conservan |
| Proyectos | Descripción extensa en campo de una línea | Mejora recomendable UX | Campo multilínea, con máximo existente de 4000 caracteres |
| Monitorización | Filtros sin limpieza rápida y calidad sin traducir | Mejora recomendable UX | Limpieza en un paso y calidad legible, manteniendo contratos |
| Navegación | Foco no se trasladaba al contenido recién abierto | Mejora recomendable/accesibilidad | Foco en encabezado principal al activar ruta del espacio de trabajo; salto al contenido conservado |
| Ayuda | No había guía central dentro del espacio de trabajo | Mejora recomendable UX | `/app/help`, pasos operativos, enlaces según permisos y preguntas frecuentes |
| Móvil/táctil | Acciones compactas en dispositivos de puntero grueso | Mejora recomendable/accesibilidad | Objetivos mínimos de 44 px para botones principales/compactos y controles de selección de 24 px en esa modalidad |
| Temas | Tokens, contraste y foco ya implementados | Mantener | Se preservan Light/Dark/System, movimiento reducido y colores forzados; pruebas de contrato repetidas |
| Acceso/recuperación | Capacidades reales, errores y recuperación deshabilitada sin correo | Mantener | Título más claro y foco de errores; no se habilita SMTP ni registro público |
| Roles/permisos | Acciones condicionadas por permisos y protección del propietario | Mantener | Guía no ofrece enlaces operativos no autorizados; no cambia autorización en servidor |
| Auditoría/tokens | Secretos solo una vez y detalles técnicos bajo despliegue progresivo | Mantener | No se añade telemetría UX de datos personales ni captura de formularios |
| Tableros | Edición explícita, teclado, bloqueo, conflicto y condiciones ya implementados | Mantener y evaluar con usuarios | Guía aclara aplicar/guardar, comparaciones, 200 muestras y alcance visual de colores |
| Cuenta/organización | Validación y mensajes presentes; no hay protección uniforme de borradores al navegar | Deuda UX restante | Foco de errores añadido; confirmar comportamiento deseado antes de extender guard a contraseñas/redirecciones |
| Landing/404/403 | Rutas reales, retorno y estados existentes | Mantener y comprobar visualmente | No se reescriben componentes funcionales |

No se han encontrado motivos para reemplazar Angular, AutoCrud, autenticación o el sistema de temas. La terminología y las mejoras de interacción no alteran los endpoints ni los modelos de negocio.

## Comprobaciones manuales pendientes

- Usuario nuevo: orientarse desde la guía sin instrucciones verbales del desarrollador.
- Teclado: Tab/Shift+Tab, Escape con cambios, foco tras navegación, lectura del resumen y retorno del foco al cerrar diálogo.
- Lectores de pantalla: anuncios de carga, error, éxito y cambios de pantalla con NVDA/VoiceOver; las pruebas de DOM no validan su experiencia completa.
- Tamaños 360/768/1280 px, zoom 200 %, orientación y puntero táctil; tablas con desplazamiento horizontal deliberado, sin pérdida de acciones.
- Light/Dark/System, contraste percibido y legibilidad de gráficos con datos reales.
- Sesión expirada durante edición, recuperación sin correo, ausencia de permisos, conexión lenta y fallo de red.
- Widget con borrador de propiedades aún sin aplicar: evaluar si hace falta advertir también antes de cambiar su selección.

## Prioridad posterior a la primera ronda

1. Resolver bloqueos de tareas observados con usuarios, antes de añadir controles o complejidad.
2. Revisar conjuntamente borradores de cuenta/organización/medición y edición de propiedades de widgets.
3. Evaluar buscadores remotos cuando los selectores de sensores/usuarios superen un tamaño manejable.
4. Validar accesibilidad completa y dispositivos físicos; no asumir cumplimiento por pasar pruebas de contraste.
5. Repetir tareas y SUS en una nueva versión, documentando muestra, experiencia previa y límites de comparación.

## Evidencia

Ver `docs/usability-study.md` para protocolo, instrumento español validado, tareas y método de puntuación; `src/app/features/usability.spec.ts` para regresiones. Una puntuación SUS solo se informará tras recoger respuestas reales; los datos sintéticos de pruebas del calculador no son resultados del producto.
