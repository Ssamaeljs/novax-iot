const AppError = require("../../utils/handleError/AppError");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

class DynamicValidator {
  async validate(schema = {}, input = {}, options = {}) {
    const partial = options.partial === true;
    const payload = { ...input };
    const errors = [];

    for (const [field, rule] of Object.entries(schema)) {
      const exists = Object.prototype.hasOwnProperty.call(payload, field);
      let value = payload[field];

      if (!exists) {
        if (rule.required && !partial) {
          errors.push({ field, message: "El campo es requerido" });
        }
        continue;
      }

      if (value === null) {
        if (rule.allowNull !== true) {
          errors.push({ field, message: "El campo no admite null" });
        }
        continue;
      }

      if (typeof value === "string") {
        if (rule.trim !== false) value = value.trim();
        if (rule.lowercase) value = value.toLowerCase();
        if (rule.uppercase) value = value.toUpperCase();
        payload[field] = value;
      }

      if (rule.type && !this.#matchesType(value, rule.type)) {
        errors.push({ field, message: `Debe ser de tipo ${rule.type}` });
        continue;
      }

      if (typeof value === "string") {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          errors.push({ field, message: `Debe tener al menos ${rule.minLength} caracteres` });
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          errors.push({ field, message: `Debe tener máximo ${rule.maxLength} caracteres` });
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push({ field, message: rule.patternMessage || "Formato inválido" });
        }
        if (rule.format === "email" && !EMAIL_REGEX.test(value)) {
          errors.push({ field, message: "Debe ser un correo válido" });
        }
        if (rule.format === "uuid" && !UUID_REGEX.test(value)) {
          errors.push({ field, message: "Debe ser un UUID válido" });
        }
        if (rule.format === "slug" && !SLUG_REGEX.test(value)) {
          errors.push({ field, message: "Debe ser un slug válido" });
        }
        if (rule.format === "date" && Number.isNaN(Date.parse(value))) {
          errors.push({ field, message: "Debe ser una fecha válida" });
        }
      }

      if (typeof value === "number") {
        if (rule.min !== undefined && value < rule.min) {
          errors.push({ field, message: `Debe ser mayor o igual a ${rule.min}` });
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push({ field, message: `Debe ser menor o igual a ${rule.max}` });
        }
      }

      if (rule.oneOf && !rule.oneOf.includes(value)) {
        errors.push({ field, message: `Debe ser uno de: ${rule.oneOf.join(", ")}` });
      }

      if (typeof rule.validate === "function") {
        const result = await rule.validate(value, payload, options.context || {});
        if (result !== true && result !== undefined) {
          errors.push({ field, message: typeof result === "string" ? result : "Valor inválido" });
        }
      }
    }

    if (errors.length) {
      throw new AppError("Error de validación", 422, "VALIDATION_ERROR", errors);
    }

    return payload;
  }

  #matchesType(value, type) {
    if (type === "array") return Array.isArray(value);
    if (type === "object") return isPlainObject(value);
    if (type === "integer") return Number.isInteger(value);
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    return typeof value === type;
  }
}

module.exports = DynamicValidator;

