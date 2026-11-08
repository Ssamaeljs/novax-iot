const AppError = require("../../../utils/handleError/AppError");
const { createHash } = require("node:crypto");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const blocked = new Set(["__proto__", "prototype", "constructor"]);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function fail(message, code = "INVALID_INTEGRATION_MESSAGE") { throw new AppError(message, 422, code); }
function onlyKeys(value, keys) { if (!object(value) || Object.keys(value).some((key) => !keys.includes(key))) fail("Hay campos no permitidos"); }
function validPath(path) { return typeof path === "string" && path.length <= 120 && path.split(".").every((part) => /^[a-zA-Z_][a-zA-Z0-9_-]{0,39}$/.test(part) && !blocked.has(part)); }
function readPath(value, path) {
  if (!validPath(path)) fail("La ruta de origen no es válida", "INVALID_PROFILE");
  return path.split(".").reduce((current, part) => object(current) && Object.hasOwn(current, part) ? current[part] : undefined, value);
}
function validateMappings(mappings) {
  if (!Array.isArray(mappings) || !mappings.length || mappings.length > 32) fail("Define entre 1 y 32 campos", "INVALID_PROFILE");
  const keys = new Set();
  return mappings.map((field) => {
    onlyKeys(field, ["path", "sensor_key", "metric", "unit", "source_unit", "data_type", "scale", "offset", "required"]);
    if (!validPath(field.path) || typeof field.sensor_key !== "string" || !/^[a-z][a-z0-9_.-]{0,79}$/.test(field.sensor_key) || keys.has(field.sensor_key)) fail("Revisa rutas y claves de sensores", "INVALID_PROFILE");
    keys.add(field.sensor_key);
    if (typeof field.metric !== "string" || !/^[a-z][a-z0-9_.-]{1,99}$/.test(field.metric) || !["NUMBER", "TEXT", "BOOLEAN", "JSON"].includes(field.data_type)) fail("Revisa la magnitud y el tipo de dato", "INVALID_PROFILE");
    for (const unit of [field.unit, field.source_unit]) if (unit !== undefined && unit !== null && (typeof unit !== "string" || unit.length > 30)) fail("La unidad admite hasta 30 caracteres", "INVALID_PROFILE");
    if (field.required !== undefined && typeof field.required !== "boolean") fail("required debe ser booleano", "INVALID_PROFILE");
    const scale = field.scale === undefined ? 1 : field.scale, offset = field.offset === undefined ? 0 : field.offset;
    if (![scale, offset].every((value) => typeof value === "number" && Number.isFinite(value)) || (field.data_type !== "NUMBER" && (scale !== 1 || offset !== 0))) fail("Solo los números admiten escala y desplazamiento finitos", "INVALID_PROFILE");
    return { path: field.path, sensor_key: field.sensor_key, metric: field.metric, unit: field.unit || null, source_unit: field.source_unit || null, data_type: field.data_type, scale, offset, required: field.required !== false };
  });
}
function canonicalString(value, depth = 0) {
  if (depth > 8) fail("El mensaje supera la profundidad admitida");
  if (Array.isArray(value)) return `[${value.map((item) => canonicalString(item, depth + 1)).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalString(value[key], depth + 1)}`).join(",")}}`;
  if (value !== null && !["number", "boolean", "string"].includes(typeof value)) fail("El mensaje debe contener JSON válido");
  if (typeof value === "number" && !Number.isFinite(value)) fail("No se admiten números no finitos");
  return JSON.stringify(value);
}
function validateEnvelope(input) {
  onlyKeys(input, ["schema_version", "message_id", "observed_at", "quality", "payload"]);
  if (input.schema_version !== 1 || typeof input.message_id !== "string" || !UUID.test(input.message_id) || !object(input.payload)) fail("Se requieren schema_version=1, message_id UUID y payload objeto");
  if (input.quality !== undefined && !["GOOD", "UNCERTAIN", "BAD"].includes(input.quality)) fail("La calidad no es válida");
  const normalized = { ...input, message_id: input.message_id.toLowerCase() };
  const serialized = canonicalString(normalized);
  if (Buffer.byteLength(serialized, "utf8") > 65536) fail("El mensaje admite hasta 64 KiB");
  const digest = createHash("sha256").update(serialized).digest("hex");
  return { envelope: normalized, digest };
}
function normalize(profile, envelope, sensors, receivedAt) {
  let observedAt = receivedAt, estimated = true;
  if (envelope.observed_at !== undefined) {
    if (typeof envelope.observed_at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(envelope.observed_at) || Number.isNaN(Date.parse(envelope.observed_at))) fail("La fecha debe ser ISO 8601 con zona horaria");
    const [year, month, day] = envelope.observed_at.slice(0, 10).split("-").map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) fail("La fecha de observación no existe en el calendario");
    observedAt = new Date(envelope.observed_at);
    if (observedAt.getTime() > receivedAt.getTime() + 300000) fail("La fecha supera el margen de cinco minutos en el futuro");
    estimated = false;
  }
  const result = [];
  for (const field of validateMappings(profile.mappings)) {
    const raw = readPath(envelope.payload, field.path);
    if (raw === undefined && !field.required) continue;
    const sensor = sensors.find((item) => item.key === field.sensor_key);
    if (!sensor || sensor.metric !== field.metric || (sensor.unit || null) !== field.unit || sensor.data_type !== field.data_type) fail(`El sensor ${field.sensor_key} no coincide con el modelo publicado`, "SENSOR_PROFILE_MISMATCH");
    let value = raw;
    if (field.data_type === "NUMBER") {
      if (typeof raw !== "number" || !Number.isFinite(raw)) fail(`El campo ${field.path} requiere un número`, "MEASUREMENT_TYPE_MISMATCH");
      value = raw * field.scale + field.offset;
      if (!Number.isFinite(value)) fail("La conversión produce un número fuera de rango");
    } else if ((field.data_type === "TEXT" && (typeof raw !== "string" || raw.length > 4000)) || (field.data_type === "BOOLEAN" && typeof raw !== "boolean") || (field.data_type === "JSON" && (!object(raw) && !Array.isArray(raw)))) fail(`El campo ${field.path} no coincide con su tipo`, "MEASUREMENT_TYPE_MISMATCH");
    let quality = envelope.quality || "GOOD";
    const outside = typeof value === "number" && ((sensor.minimum_value !== null && sensor.minimum_value !== undefined && value < Number(sensor.minimum_value)) || (sensor.maximum_value !== null && sensor.maximum_value !== undefined && value > Number(sensor.maximum_value)));
    if ((estimated || outside) && quality === "GOOD") quality = "UNCERTAIN";
    result.push({ sensor_external_id: sensor.external_id, metric: field.metric, unit: field.unit, data_type: field.data_type, value, observed_at: observedAt.toISOString(), quality, timestamp_source: estimated ? "SERVER" : "DEVICE" });
  }
  if (!result.length) fail("El mensaje no contiene lecturas utilizables");
  return result;
}
module.exports = { UUID, onlyKeys, validateMappings, validateEnvelope, normalize, readPath };
