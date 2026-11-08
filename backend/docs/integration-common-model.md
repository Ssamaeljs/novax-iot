# Integración HTTPS / MQTT y modelo común v1

## Estado y alcance

Implementado dentro del monolito existente. Se reutilizan dispositivos, sensores, mediciones, permisos, auditoría y frontend. El alcance de nuevas integraciones es **HTTPS y MQTT**; ONVIF/vídeo no se desarrolla. Los registros HTTP/ONVIF existentes se conservan y pueden editar sus metadatos sin volver a ofrecer esos protocolos en nuevas altas.

La migración `2026.10.18T020000-create-integration.js` es aditiva: perfiles, fuentes, mensajes y snapshots de magnitud/unidad en mediciones. Está aplicada a la base local; no se reinicializó ninguna cuenta ni dato previo.

MQTT.js 5.16.1 se incorporó como única dependencia funcional nueva. No se instala ni configura un broker externo automáticamente. La variable `MQTT_ENABLED` está desactivada por defecto y el `.env` real no se ha modificado para inventar conexiones o secretos.

## Uso administrativo

1. Reiniciar el backend y recargar la sesión web para obtener los nuevos permisos. La migración los asigna a `TENANT_OWNER`; otro rol administrativo puede recibir `integrations.read` y `integrations.manage` desde Roles.
2. En **Integraciones → Modelos de datos → Nuevo perfil**, indicar nombre y campos. Cada campo relaciona ruta del payload con clave de sensor, magnitud, tipo, unidad final y conversión numérica explícita.
3. Registrar los sensores correspondientes en el dispositivo. Sus claves, magnitudes, tipos y unidades deben coincidir con el perfil; no se crean sensores automáticamente por recibir mensajes.
4. Probar el formato con **Validar y normalizar**. No guarda telemetría ni cambia presencia; sí deja auditoría de la consulta.
5. En **Fuentes**, vincular dispositivo, versión del perfil, transporte y tiempo sin telemetría. Guardar la credencial, mostrada una sola vez. Los destinos HTTPS y MQTT aparecen en «Destino del dispositivo».
6. Configurar el emisor y enviar. Consultar los mensajes aceptados, histórico, estado y widgets existentes.

El modelo administrativo no permite alterar SQL, ejecutar scripts ni incorporar protocolos arbitrarios. Una nueva versión conserva el código de familia, obtiene otro `external_id` y aumenta su versión. Las fuentes siguen vinculadas a su versión original; para migrarlas se crea otra fuente y se desactiva deliberadamente la anterior. Nombre y descripción son metadatos editables por API; mappings y número de versión no se sobrescriben.

## Entidades y responsabilidades

- **Perfil**: formato declarado, mappings y versión inmutable de interpretación.
- **Fuente**: dispositivo + versión + transporte + credencial propia + timeout. Las asociaciones son inmutables; nombre, timeout y habilitación pueden cambiarse.
- **Mensaje**: recepción aceptada, hash del sobre, identificador del productor y resultado normalizado. No guarda la credencial ni el payload original completo.
- **Medición**: entidad existente, con valor tipado, fecha observada/recibida y calidad. Nuevas lecturas guardan snapshots de magnitud y unidad y referencia interna al mensaje cuando procede.
- **Presencia**: estado operativo derivado de telemetría válida reciente, no prueba de socket abierto ni disponibilidad física absoluta.

Flujo: adaptador HTTPS/MQTT → autenticar fuente → validar sobre → deduplicar → cargar perfil/sensores → normalizar → transacción de mensaje, mediciones, presencia y auditoría → respuesta/confirmación.

Las respuestas públicas solo exponen UUID de recursos, referencias externas y datos declarados. `message_id` es un UUID público **del productor para idempotencia**, no una PK interna. `external_id` identifica el registro aceptado por NOVAX.

## Contrato de entrada común

Ejemplo ficticio; utilizar un `message_id` nuevo para cada observación y conservar **el mismo sobre completo** al reintentar:

```json
{
  "schema_version": 1,
  "message_id": "06c5607a-7a1f-44fb-91f3-4848be7601f2",
  "observed_at": "2026-10-18T18:00:00Z",
  "quality": "GOOD",
  "payload": { "hum": 72.4 }
}
```

Obligatorios: versión 1, UUID del productor y payload objeto. Fecha y calidad son opcionales. No se acepta un identificador de dispositivo desde el cuerpo: lo determina la fuente autenticada. `received_at` siempre lo genera el servidor.

La fecha debe ser ISO 8601 con zona explícita y calendario válido; se normaliza a UTC. Se rechazan fechas más de cinco minutos en el futuro. Sin fecha se utiliza recepción y calidad, como mínimo, `UNCERTAIN`. El límite v1 es 64 KiB, profundidad ocho y hasta 32 campos por perfil. Cada sobre representa una observación compartida por sus campos; no hay todavía arrays de observaciones con fechas distintas dentro del mismo sobre.

## Ejemplo de heterogeneidad

Dos perfiles diferentes pueden definir:

| Origen | Ruta en payload | Clave del sensor | Magnitud | Unidad de origen | Unidad final | Escala / desplazamiento |
| --- | --- | --- | --- | --- | --- | --- |
| Dispositivo HTTPS | `hum` | `humidity` | `humidity` | `%` | `%` | 1 / 0 |
| Dispositivo MQTT | `env.rh` | `humidity` | `humidity` | `ratio` | `%` | 100 / 0 |

`72.4` y `0.724` se convierten a valores equivalentes de humedad relativa en porcentaje, dentro de la precisión de punto flotante. No se redondea silenciosamente el dato almacenado.

Las rutas son nombres separados por puntos; no expresiones JSONPath, índices de array ni JavaScript. Tipos admitidos: NUMBER, TEXT, BOOLEAN y JSON. No se convierte automáticamente una cadena `"72.4"` en número. Las conversiones numéricas son `valor × escala + desplazamiento`, con valores finitos. `source_unit` describe el origen; no activa conversiones automáticas ni constituye un catálogo UCUM/ontología.

Un campo obligatorio ausente, tipo incorrecto o sensor incompatible rechaza todo el mensaje. Un campo opcional ausente se omite; cero y falso se conservan. Valores numéricos fuera de los límites configurados del sensor se conservan con calidad al menos incierta. No hay un motor de alertas implícito.

## HTTPS

`POST /v1/api/ingest/https/{source_external_id}`

Cabecera: `Authorization: Bearer {credencial_de_la_fuente}`. El cuerpo es el sobre anterior. No usar una cookie de navegador ni un token IAM genérico en su lugar.

Respuesta 201 para recepción nueva; 200 con `duplicate:true` para reenvío idéntico. Incluye identificador público de recepción, cantidad y contrato normalizado. Un ID reutilizado con contenido distinto devuelve 409 `MESSAGE_ID_CONFLICT`. El orden de las claves JSON no afecta el hash; cambios en otros contenidos del sobre sí.

En producción se exige `req.secure`. Desplegar detrás de un proxy HTTPS con certificados válidos, puerto interno restringido y `TRUST_PROXY` configurado solo con las direcciones/redes reales de ese proxy. No se confía por defecto en `X-Forwarded-Proto`; una cabecera falsificada no convierte HTTP en HTTPS. La API no instala certificados ni ofrece TLS nativo por sí misma. En desarrollo/test se permite HTTP local para verificar el adaptador; esto no se presenta como una conexión cifrada.

Existe límite de 1200 solicitudes/minuto por IP para esta entrada, con almacenamiento en memoria adecuado al proceso único actual. Revisar límites, NAT, proxy y protección perimetral antes de escalar.

## MQTT

Configurar en el entorno del backend, sin guardar secretos en Git:

```text
MQTT_ENABLED=true
MQTT_URL=mqtts://broker-de-novax:8883
MQTT_CLIENT_ID=novax-ingestion-v1
MQTT_USERNAME=<cuenta-suscriptora-del-backend>
MQTT_PASSWORD=<secreto-del-broker>
```

La URL no admite credenciales, query ni rutas. En producción solo se permite `mqtts://` y credenciales del broker. Se verifica el certificado; no hay opción para desactivar esa verificación. Si se usa una CA privada, configurar la confianza de Node al lanzar el proceso, por ejemplo `NODE_EXTRA_CA_CERTS`, y verificar la cadena real. Cada instancia necesita un client ID propio y estable.

Topic de entrada: `novax/v1/sources/{source_external_id}/telemetry`.

Payload:

```json
{
  "token": "<credencial-de-esta-fuente>",
  "message": {
    "schema_version": 1,
    "message_id": "45a90777-1972-4c35-b775-38a747c12178",
    "observed_at": "2026-10-18T18:00:00Z",
    "payload": { "env": { "rh": 0.724 } }
  }
}
```

El broker no transmite al suscriptor una identidad verificable del publicador en el mensaje estándar. Por ello esta versión verifica también una credencial de fuente en el sobre MQTT, independiente de la autenticación del broker. **El broker es parte de la frontera de confianza**: TLS, usuarios de publicación separados, ACL por topic, sin acceso anónimo ni lectores generales de telemetría. No registrar payloads ni activar depuración de paquetes en producción; contienen la credencial. No publicar con `retain`; las entregas marcadas como retenidas se rechazan. Configurar tamaño máximo y cuotas también en el broker.

Ejemplo conceptual de ACL: cada dispositivo publica solo su topic `/telemetry` y lee solo su `/ack`; el backend lee `novax/v1/sources/+/telemetry` y publica en `novax/v1/sources/+/ack`. Crear usuarios/ACL del broker no está automatizado desde la pantalla de fuentes.

El backend usa MQTT 3.1.1, sesión persistente, suscripción QoS 1 y reconexión. Publicar con QoS 1 si se requiere reentrega; QoS 0 es best effort. La confirmación de recepción del suscriptor espera a la transacción; no confundir el PUBACK que el broker entrega al productor con una confirmación de aplicación.

Confirmación de aplicación en `novax/v1/sources/{source_external_id}/ack`: `ACCEPTED`, `DUPLICATE` o, para errores de una fuente autenticada con ID reconocible, `REJECTED` con código seguro. No devuelve secretos. Entradas sin autenticación o sin identificador seguro no obtienen confirmación de aplicación. Errores operativos se descartan para no bloquear el flujo; errores transitorios de persistencia interrumpen la conexión y permiten reentrega según sesión y configuración del broker. El emisor debe gestionar espera, reintento con backoff y conservar el ID/contenido original.

No se afirma entrega exactamente una vez extremo a extremo. La deduplicación es por fuente e ID del productor, respaldada por índice único y transacción. Cambiar de fuente establece otro contexto de idempotencia.

## Protección del histórico y presencia

Los snapshots se generan también para nuevas lecturas recibidas por los endpoints anteriores. No se inventan unidades históricas para registros previos: sus columnas nuevas quedan nulas. Cambiar clave, magnitud, unidad o tipo de un sensor con histórico devuelve 409 `SENSOR_SCHEMA_IN_USE`; cambiar nombre sigue permitido. La consulta de mediciones utiliza los snapshots cuando existen.

Cada recepción nueva aceptada actualiza fuente y dispositivo a ONLINE con hora del servidor, aunque la observación sea antigua. Un replay duplicado no refresca presencia. Cada 30 segundos el proceso revisa los timeouts y marca OFFLINE sin inventar mediciones. Con varias fuentes efectivas se usa el mayor timeout; sin fuentes efectivas se conservan sus timeouts como referencia de expiración, evitando que la desactivación deje ONLINE indefinidamente. No se añade un protocolo independiente de heartbeat en este incremento.

## API administrativa

Prefijo `/v1/api/integrations`. Lecturas exigen `integrations.read`; escrituras y preview, `integrations.manage`. Los tokens de integración de fuentes no sirven para administrar.

| Ruta | Operación |
| --- | --- |
| `GET /status` | Estado real del consumidor en este proceso, sin URL ni credenciales |
| `GET/POST /profiles` | Listar/publicar perfil inicial |
| `GET/PATCH/DELETE /profiles/:external_id` | Consultar/metadatos/desactivar; no sobrescribir mappings |
| `POST /profiles/:external_id/versions` | Publicar otra versión de la familia |
| `POST /profiles/:external_id/preview` | `{device_external_id,message}` → normalizar sin telemetría |
| `GET/POST /sources` | Listar/crear fuente y entregar secreto una vez |
| `GET/PATCH/DELETE /sources/:external_id` | Consultar/metadatos/desactivar |
| `POST /sources/:external_id/rotate` | Sustituir credencial y mostrar la nueva una vez |
| `GET /messages` y `/messages/:external_id` | Historial público de recepciones aceptadas |

Cada fuente tiene credencial aleatoria de 256 bits; solo hash SHA-256 y prefijo permanecen en base. Rotar invalida la anterior. Las credenciales pertenecen a la fuente de NOVAX, no a la sesión de un empleado; desactivar una cuenta no las revoca automáticamente. Desactivar fuente/dispositivo/perfil sí impide ingesta nueva. Actualmente no tienen vencimiento automático: gestionar rotación y baja explícitamente.

La auditoría de ingesta identifica `DEVICE_SOURCE`, referencia pública de la fuente y resultado; la de presencia identifica `SYSTEM`. No atribuye falsamente acciones automáticas a una cuenta humana ni conserva cuerpos o credenciales. Fallos autenticados se registran fuera de la transacción revertida.

## Verificación y límites

`node --test` ejecuta unitarias sin base/broker. `node scripts/run-integration-isolated.js` crea solo una base temporal con prefijo controlado, ejecuta migraciones, HTTP/PostgreSQL y MQTT por TCP con un broker mínimo de pruebas, y elimina únicamente esa base. No utilizar el broker de pruebas como servicio operativo.

Quedan por validar broker real/TLS/ACL, dos dispositivos físicos o simuladores representativos, carga, recuperación tras caídas reales y operación móvil física. La prueba TCP verifica transporte y backpressure; la integración PostgreSQL verifica persistencia del adaptador y normalizador. No sustituye evidencia de hardware de NOVAX.

Otros límites: sin DLQ ni re-procesamiento de cargas crudas, sin política automática de retención, sin colas adicionales, sin actualización automática de fuentes al publicar versiones, sin conversiones de texto libre ni timestamps por campo. Se almacena resultado normalizado más mediciones; dimensionar retención y coste antes de producción. Los brokers, certificados y secretos reales requieren configuración del responsable de infraestructura.

Referencia de implementación del cliente y semántica de `handleMessage`: [documentación oficial MQTT.js](https://github.com/mqttjs/MQTT.js). El formato de datos de NOVAX es propio y versionado; no se presenta como conformidad NGSI-LD, Sparkplug u otro estándar de información.
