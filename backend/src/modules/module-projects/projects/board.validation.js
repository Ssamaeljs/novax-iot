const AppError = require("../../../utils/handleError/AppError");
const { validateRules } = require("./widgetRules.validation");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = ["THERMOMETER", "GAUGE", "TIMELINE", "HTML"];
const fail = (message, code = "INVALID_BOARD") => { throw new AppError(message, 422, code); };
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function keys(value, allowed) {
  if (!object(value) || Object.keys(value).some((key) => !allowed.includes(key))) fail("El tablero contiene campos no permitidos");
}
function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function validateBoard(input) {
  keys(input, ["version", "widgets"]);
  if (!Number.isSafeInteger(input.version) || input.version < 0) fail("La versión del tablero no es válida");
  if (!Array.isArray(input.widgets) || input.widgets.length > 30) fail("Un tablero admite hasta 30 widgets");
  const seen = new Set();
  const widgets = input.widgets.map((item) => {
    keys(item, ["external_id", "title", "type", "layout", "sensor_external_ids", "settings"]);
    if (item.external_id !== undefined) {
      if (typeof item.external_id !== "string" || !UUID.test(item.external_id) || seen.has(item.external_id)) fail("El identificador de widget no es válido o está duplicado");
      seen.add(item.external_id);
    }
    if (typeof item.title !== "string" || !item.title.trim() || item.title.trim().length > 120) fail("Cada widget requiere un título de hasta 120 caracteres");
    if (!TYPES.includes(item.type)) fail("El tipo de widget no es válido");
    keys(item.layout, ["x", "y", "width", "height", "locked"]);
    const { x, y, width, height, locked } = item.layout;
    if (![x, y, width, height].every(Number.isSafeInteger) || x < 0 || y < 0 || y > 200 || width < 3 || width > 12 || height < 3 || height > 16 || x + width > 12 || typeof locked !== "boolean") fail("La posición o el tamaño del widget no son válidos");
    const sensors = item.sensor_external_ids;
    const maximum = ["THERMOMETER", "GAUGE"].includes(item.type) ? 1 : 6;
    if (!Array.isArray(sensors) || sensors.length < 1 || sensors.length > maximum || sensors.some((id) => typeof id !== "string" || !UUID.test(id)) || new Set(sensors).size !== sensors.length) fail(`Este widget requiere entre 1 y ${maximum} sensores distintos`);
    const rawSettings = item.settings === undefined ? {} : item.settings;
    keys(rawSettings, ["color_rules", ...(item.type === "HTML" ? ["html", "css"] : item.type === "TIMELINE" ? [] : ["min", "max"])]);
    const settings = { ...rawSettings };
    const rules = validateRules(settings.color_rules, sensors);
    if (rules !== undefined) settings.color_rules = rules;
    if (item.type === "HTML") {
      if (typeof settings.html !== "string" || !settings.html.trim() || settings.html.length > 16000 || (settings.css !== undefined && (typeof settings.css !== "string" || settings.css.length > 8000))) fail("El HTML admite hasta 16000 caracteres y el CSS hasta 8000");
      if (/<\s*(?:script|iframe|object|embed|form|meta|link|base)\b|\bon\w+\s*=|\b(?:src|href|srcdoc)\s*=/i.test(settings.html) || /@import\b|url\s*\(/i.test(settings.css || "")) fail("El widget personalizado admite HTML y CSS sin scripts ni recursos externos", "UNSAFE_WIDGET_CONTENT");
    } else if (item.type !== "TIMELINE") {
      const min = settings.min ?? 0;
      const max = settings.max ?? 100;
      if (![min, max].every((value) => typeof value === "number" && Number.isFinite(value)) || min >= max) fail("El mínimo debe ser menor que el máximo");
      settings.min = min;
      settings.max = max;
    }
    return { ...item, title: item.title.trim(), settings: { ...settings }, layout: { ...item.layout }, sensor_external_ids: [...sensors] };
  });
  if (new Set(widgets.flatMap((widget) => widget.sensor_external_ids)).size > 40) fail("Un tablero admite hasta 40 sensores diferentes");
  for (let i = 0; i < widgets.length; i++) {
    for (let j = i + 1; j < widgets.length; j++) {
      if (overlaps(widgets[i].layout, widgets[j].layout)) fail("Los widgets no pueden superponerse", "WIDGET_OVERLAP");
    }
  }
  return { version: input.version, widgets };
}
function assertLockedLayout(current, next) {
  if (current.locked && next.locked && ["x", "y", "width", "height"].some((key) => current[key] !== next[key])) {
    throw new AppError("Desbloquea el widget antes de moverlo o redimensionarlo", 409, "WIDGET_LOCKED");
  }
}
module.exports = { validateBoard, assertLockedLayout, overlaps };
