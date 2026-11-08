# Incremento: vínculo explícito dispositivo–sensor

## Requisito y análisis previo

Gestionar sensores desde el dispositivo ESP32 al que están conectados. La relación ya existía en Sequelize (`Device.hasMany(Sensor)`, `Sensor.belongsTo(Device)`) y en la migración IoT: `iot.sensors.device_id` es obligatorio y referencia a `iot.devices.id`. No se necesita otra tabla de unión para una relación uno a muchos ni una migración que duplique el vínculo.

El detalle `/app/device/:deviceId` ya permitía operar sensores, pero usaba rutas generales con el identificador del dispositivo en el cuerpo/filtro. Este incremento hace explícita la pertenencia en las rutas y en el formulario, conservando los servicios de validación, histórico y auditoría existentes.

Modelo conservado:

```text
ESP32 Secretaría (dispositivo)
├── Temperatura DHT11 (canal NUMBER, °C)
│   └── Mediciones con fecha y calidad
├── Humedad DHT11 (canal NUMBER, %)
│   └── Mediciones con fecha y calidad
└── Presencia PIR (canal BOOLEAN)
    └── Mediciones con fecha y calidad
```

Un registro en `sensors` sigue siendo un canal de medición. No se introduce una entidad separada de componente físico DHT11 ni se agrupan dos magnitudes en una misma columna/valor. La necesidad de inventariar piezas físicas, GPIO y sustituciones requeriría otro incremento aprobado.

## Cambios y flujo

Rutas nuevas, bajo `/v1/api`:

| Método | Ruta | Permisos |
| --- | --- | --- |
| GET | `/iot/devices/:device_external_id/sensors` | devices.read + sensors.read |
| GET | `/iot/devices/:device_external_id/sensors/:sensor_external_id` | devices.read + sensors.read |
| POST | `/iot/devices/:device_external_id/sensors` | devices.read + sensors.manage |
| PATCH | `/iot/devices/:device_external_id/sensors/:sensor_external_id` | devices.read + sensors.manage |
| DELETE | `/iot/devices/:device_external_id/sensors/:sensor_external_id` | devices.read + sensors.manage |

1. Se resuelve el UUID del dispositivo dentro de la organización autenticada.
2. Las operaciones del sensor quedan acotadas por el identificador interno del padre, sin exponerlo.
3. POST fija el dispositivo desde la ruta. Un dispositivo contradictorio en el cuerpo o consulta se rechaza (422). PATCH mantiene la prohibición de reasignar sensores para no alterar el histórico.
4. Un UUID de sensor perteneciente a otro equipo devuelve 404, aunque ambos equipos sean de la misma organización.
5. Las escrituras se realizan en una transacción con bloqueo compartido sobre el dispositivo y requieren que esté activo. La creación general de sensores también mantiene el bloqueo del dispositivo durante su transacción.
6. DELETE conserva el comportamiento existente: desactivación lógica, sin borrar histórico.
7. El listado reutiliza paginación y últimas lecturas. `include_latest=true` exige además measurements.read. Se reutilizan validaciones y auditoría de AutoCrud.

Los endpoints generales `/iot/sensors` permanecen compatibles para catálogos, integraciones y clientes existentes.

Angular utiliza estas rutas desde el detalle del dispositivo. El editor muestra el equipo asociado y no permite escoger otro padre. Incluye plantillas individuales de temperatura DHT11, humedad DHT11 y presencia PIR; también admite canales personalizados. Las claves propuestas son editables, deben ser únicas dentro del dispositivo y coincidir con el perfil de normalización. Cambiar una plantilla solicita confirmación si sobrescribe cambios pendientes.

El catálogo global permite abrir el dispositivo desde su nombre mediante RouterLink, condicionado a devices.read. El layout de tarjetas/tabla y los tokens de ambos temas se mantienen.

## Archivos

Creados:

- `backend/src/modules/module-iot/devices/deviceSensors.routes.js`: rutas anidadas, autorización y transacción de pertenencia; delega la lógica del sensor al servicio existente.
- `frontend/src/app/features/devices/sensor-presets.ts`: definiciones reutilizables de canales, sin nuevas dependencias.
- Este documento de evidencia.

Modificados:

- `backend/src/modules/module-iot/devices/devices.routes.js`: monta las rutas de sensores bajo su dispositivo.
- `backend/src/modules/module-iot/sensors/sensors.service.js`: bloqueo compartido del padre durante la creación.
- `backend/test/ingestionIntegration.test.js`: dos escenarios nuevos con CRUD anidado, restricciones y permisos.
- `frontend/src/app/features/devices/device-detail.page.ts`: consume las rutas anidadas y aplica plantillas.
- `frontend/src/app/features/devices/device-detail.page.html`: dispositivo fijo, selector de plantilla y aclaración canal/componente físico.
- `frontend/src/app/features/devices/device-detail.spec.ts`: contratos de rutas y dos pruebas de plantillas/protección de cambios.
- `frontend/src/app/features/administration/resource.page.html`: enlace del sensor a su dispositivo.
- `frontend/src/app/features/administration/resource-definitions.ts`: descripción del modelo de canales.
- `frontend/README.md`: instrucciones de vinculación y alcance.

## Pruebas y resultados

- 28 pruebas de integración correctas (incluidos grupos padre), en PostgreSQL temporal. Incluyen creación con padre implícito, lectura/edición/desactivación/reactivación, duplicación de clave por dispositivo, aislamiento de organizaciones y dispositivos, padre desactivado, UUID inválido, permisos y rechazo de reasignación. La base temporal se elimina al terminar; no se alteran datos funcionales.
- 108 pruebas Angular correctas: plantillas, mismos endpoints padre para ambos canales DHT11, formularios pendientes, lectura de valores 0/false, vistas y responsive Light/Dark existentes.
- 43 pruebas de backend correctas en la ejecución estándar; cuatro escenarios opt-in se omiten allí y se ejecutan mediante el verificador de integración.
- Compilación de producción correcta; permanece la advertencia previa del CSS de proyectos (4,53 kB frente a presupuesto de 4 kB).
- Sin migraciones, dependencias nuevas, cambios de credenciales ni configuración de entorno.

## Cómo comprobarlo

1. Crear o abrir un ESP32 en Dispositivos → Abrir.
2. Añadir sensor → plantilla DHT11 · Temperatura → guardar.
3. Añadir sensor → plantilla DHT11 · Humedad → guardar.
4. Ambos canales aparecen dentro del mismo ESP32, con claves distintas.
5. Registrar mediciones manuales o configurar una fuente HTTPS/MQTT y mapear sus campos hacia esas claves.
6. Sincronizar la vista y consultar Reportes para cada canal.
7. En el catálogo Sensores, abrir el nombre del dispositivo y comprobar el retorno al mismo detalle.

Registrar canales no configura el firmware ni el cableado físico. Sincronizar sigue siendo una consulta al servidor, no una orden para que el DHT11 mida.

## Riesgos, deuda y mejoras futuras

- No hay autodescubrimiento ni registro automático de sensores desconocidos desde la telemetría. Se exige configuración explícita para evitar inventario no autorizado o magnitudes ambiguas.
- Un DHT11 no tiene una entidad física propia: sus canales se identifican por nombre y clave. Si se requiere inventario de componentes, se debe diseñar una relación adicional sin sustituir las mediciones actuales.
- Las plantillas no detectan sensores conectados ni configuran sus límites; son ayudas de captura editables. Para varios DHT11 en un ESP32 deben emplearse claves distintas.
- La validación móvil automatizada no sustituye pruebas de aceptación en dispositivos físicos ni una evaluación SUS con usuarios.

## Evidencia para el TFM y defensa

Documentar relación uno a muchos, claves externas internas frente a UUID públicos, rutas de recursos dependientes, validación de pertenencia en backend, atomicidad y pruebas de acceso cruzado. Capturar el mismo ESP32 con dos canales DHT11 y los históricos separados.

Preguntas posibles: ¿por qué no se necesita una tabla intermedia?, ¿qué diferencia un sensor físico de un canal?, ¿cómo se evita editar un sensor desde otro equipo?, ¿por qué se impide reasignarlo?, ¿qué protegen los permisos y las claves foráneas?, ¿por qué crear el canal no conecta automáticamente el hardware?
