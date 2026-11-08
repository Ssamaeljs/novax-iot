# Protocolo de evaluación de usabilidad y SUS — NOVAX

Estado: preparado; sin participantes, respuestas ni puntuación real todavía. Fecha de preparación: 18-10-2026.

## Propósito e instrumento

Evaluar si usuarios representativos pueden realizar las tareas de NOVAX y cómo perciben su facilidad de uso. SUS complementa la observación de tareas, no sustituye una evaluación de accesibilidad ni certifica el sistema.

Utilizar la versión española publicada por Sevilla-Gonzalez y colaboradores, **Spanish Version of the System Usability Scale for the Assessment of Electronic Tools: Development and Validation**, JMIR Human Factors 2020;7(4):e21161, DOI 10.2196/21161. El cuestionario está en **Multimedia Appendix 2** del [artículo original](https://humanfactors.jmir.org/2020/4/e21161/). Mantener exactamente sus diez ítems, orden y escala de respuesta; no traducirlos de nuevo ni reemplazarlos por preguntas creadas para NOVAX. Revisar los anclajes y la codificación antes de transcribir. La interfaz no incorpora un cuestionario propio ni afirma equivalencia de uno adaptado.

## Diseño propuesto para el TFM

- Ronda formativa inicial con 5–8 participantes representativos si la disponibilidad lo permite; es una propuesta práctica del proyecto, no un tamaño que garantice validez estadística o saturación. Registrar el número real y justificar limitaciones.
- Perfiles: operación/inventario, monitorización y administración. No exigir a un observador tareas para las que carece de permisos; indicar expresamente qué tareas se excluyen por rol.
- Separar los resultados por perfil o declarar qué alcance se evaluó. No confundir problemas de autorización con dificultad de uso.
- No usar la autoevaluación del desarrollador como evidencia principal. Registrar experiencia previa con NOVAX y conocimiento IoT.
- Definir versión/commit o identificador del incremento, navegador, tamaño de pantalla, modo de tema, rol y conjunto de datos antes de cada sesión. Congelar cambios durante una ronda.
- Duración orientativa 30–45 minutos. Usar un entorno de prueba y datos ficticios; nunca credenciales de producción.

## Consentimiento y privacidad

Explicar propósito académico, participación voluntaria y derecho a interrumpir sin consecuencias. Usar códigos P01, P02… en notas y respuestas; no guardar nombres, correos, contraseñas ni tokens en el repositorio. Solicitar consentimiento separado si se desea grabar pantalla/audio. No iniciar grabaciones por defecto. Acordar acceso, conservación y borrado de evidencias según los requisitos de UNIR y NOVAX. Esta propuesta no sustituye la revisión ética que corresponda al estudio.

## Guion del moderador

«Estamos evaluando el sistema, no tus habilidades. Intenta las tareas como lo harías en tu trabajo. Puedes pedir ayuda o detenerte. Describe lo que esperas encontrar. Anotaremos dificultades y acciones; no necesitamos conocer tus contraseñas».

Dar el objetivo de cada tarea, no instrucciones de clic. No enseñar la solución ni sugerir respuestas del cuestionario. Si el participante solicita ayuda, registrarla y facilitar solo la intervención necesaria para continuar. La guía integrada es parte del producto y puede consultarse; anotar su uso.

## Preparación

Crear cuentas de prueba con roles adecuados y comprobar previamente los permisos. Preparar un dispositivo de prueba con dos sensores numéricos de la misma métrica/unidad y mediciones conocidas. Para tareas de comparación usar ese par; no pedir comparar temperatura con humedad. Preparar un caso sin mediciones y un fallo controlado de red cuando sea seguro. No ejecutar desactivaciones contra equipos reales.

## Tareas y criterio de éxito

| ID | Objetivo que se presenta | Perfil | Éxito observable |
| --- | --- | --- | --- |
| T01 | Entrar en tu entorno NOVAX y encontrar dónde empezar | Todos | Acceso correcto y localización de la guía o flujo de trabajo, sin exponer credenciales |
| T02 | Registrar un equipo ESP32 de Secretaría | Operación | Equipo creado con nombre, tipo y protocolo; código generado sin pedirlo al usuario |
| T03 | Añadir su sensor de humedad con unidad % | Operación | Sensor vinculado al equipo correcto, métrica/tipo/unidad adecuados |
| T04 | Registrar una lectura de prueba y encontrarla en el histórico | Operación | Valor y sensor correctos, fecha comprendida y lectura localizada |
| T05 | Encontrar las lecturas de un sensor en un intervalo y volver a ver todas | Monitorización | Filtro aplicado y limpiado sin perder orientación |
| T06 | Crear un proyecto y mostrar humedad en un indicador y un histórico | Editor de proyectos | Tablero guardado; asociaciones correctas y persistencia tras recarga |
| T07 | Comparar dos sensores compatibles y fijar la posición de un widget | Editor de proyectos | Comparación legible, unidad común y geometría bloqueada |
| T08 | Señalar humedad ≥85 como crítica y ≥70 como advertencia | Editor de proyectos | Condiciones ordenadas, etiqueta y color correctos con mediciones preparadas |
| T09 | Corregir un formulario incompleto y cancelar una edición sin perderla accidentalmente | Editor | Identifica/corrige campo, entiende confirmación y conserva o descarta deliberadamente |
| T10 | Dar a una cuenta de prueba acceso de consulta sin permisos de edición | Administración | Asignación correcta verificada con la cuenta de consulta, sin alterar roles de sistema |

Antes de recoger datos, definir para cada perfil las tareas aplicables y un tiempo máximo de observación. No cambiarlo según el rendimiento del participante. No forzar todas las tareas dentro del mismo tiempo si se desea evaluar módulos distintos.

## Registro por tarea

Usar `docs/usability-task-record.csv` como cabecera de recogida, sin datos prellenados. Anotar inicio/fin, duración, resultado (`sin_ayuda`, `con_ayuda`, `fallo`, `no_aplicable`), errores observables, intervenciones y comentario. Definir un error como acción que impide o retrasa el objetivo, no como una preferencia estética del moderador. Evitar notas con información sensible.

Tras las tareas aplicables, pedir el cuestionario SUS completo una sola vez y sin explicar qué puntuación interesa obtener. Después, realizar preguntas abiertas: «¿Qué fue más difícil?», «¿Qué esperabas que ocurriera?» y «¿Qué cambiarías primero?». Mantener esas respuestas separadas de los diez ítems SUS.

## Puntuación y análisis

Codificar cada respuesta de 1 a 5 siguiendo los anclajes del instrumento. Para los ítems impares, contribución = respuesta − 1; para pares, contribución = 5 − respuesta. SUS individual = suma de contribuciones × 2,5, con rango 0–100. **No es un porcentaje de tareas correctas.** La fórmula y el instrumento se describen en el [artículo de referencia](https://humanfactors.jmir.org/2020/4/e21161/).

No calcular si faltan ítems, no imputar respuestas y no seleccionar únicamente participantes satisfechos. Documentar exclusiones y conservar su justificación. Registrar n, puntuaciones individuales, media, mediana, rango y dispersión. Con muestras pequeñas tratar resultados como descriptivos; no afirmar representatividad ni mejoras estadísticamente significativas sin análisis apropiado.

El calculador local validado no envía datos a ningún servidor:

`node tools/sus-score.cjs ruta-a-respuestas-anonimas.json`

Formato de entrada: un array JSON con un objeto por participante, claves `participant` (P01…) y `responses` (diez enteros de 1 a 5 en orden). No se suministra un fichero de respuestas rellenado para evitar confundir ejemplos sintéticos con resultados reales. El programa informa también tamaño muestral y desviación estándar muestral; para n=1 esta última no es estimable y se representa como `null`, no como cero. Se rechazan entradas incompletas o identificadores repetidos.

Propuesta de objetivo interno, pendiente de aceptación del PO: media SUS ≥75 y al menos 80 % de tareas aplicables completadas sin ayuda, sin errores críticos que expongan datos o impidan tareas esenciales. Son metas del proyecto, no umbrales de certificación SUS. Informar también fallos aunque se alcance la media. Calcular éxito de tareas excluyendo `no_aplicable` del denominador y separando éxito con ayuda del éxito independiente.

## Informe del TFM

Incluir contexto, selección de participantes, roles, versión evaluada, escenarios, tareas aplicables, método, instrumento citado, datos anonimizados, cálculo reproducible, dificultades, limitaciones y mejoras priorizadas. Guardar capturas sin secretos. Una comparación antes/después necesita una línea base realmente medida; no reconstruir una puntuación anterior a partir de una auditoría de código.

Estado de resultados a esta fecha: **NO EVALUADO CON USUARIOS**. La compilación y las pruebas automatizadas demuestran comportamientos del software, no una puntuación SUS.
