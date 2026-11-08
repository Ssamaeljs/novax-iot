const AppError = require("../../../utils/handleError/AppError");
const operators = ["gt", "gte", "lt", "lte", "eq", "neq", "between"];
const tones = ["success", "warning", "danger", "info", "maintenance", "offline"];
function validateRules(rules, sensorIds) {
  if (rules === undefined) return undefined;
  const fail = () => { throw new AppError("Revisa las condiciones de color del widget", 422, "INVALID_WIDGET_RULES"); };
  if (!Array.isArray(rules) || rules.length > 10) fail();
  return rules.map((rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule) || Object.keys(rule).some((key) => !["sensor_external_id", "operator", "value", "upper", "tone", "label"].includes(key))) fail();
    if (!sensorIds.includes(rule.sensor_external_id) || !operators.includes(rule.operator) || !tones.includes(rule.tone)) fail();
    if (typeof rule.value !== "number" || !Number.isFinite(rule.value) || typeof rule.label !== "string" || !rule.label.trim() || rule.label.trim().length > 80) fail();
    if (rule.operator === "between") {
      if (typeof rule.upper !== "number" || !Number.isFinite(rule.upper) || rule.upper < rule.value) fail();
    } else if (rule.upper !== undefined) fail();
    return { sensor_external_id: rule.sensor_external_id, operator: rule.operator, value: rule.value, ...(rule.operator === "between" ? { upper: rule.upper } : {}), tone: rule.tone, label: rule.label.trim() };
  });
}
module.exports = { validateRules };
