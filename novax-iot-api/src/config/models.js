/**
 * Combined models exporter:
 * - Carga legacy (manual) + autoloader (auto)
 * - Prefiere legacy si hay colisión de nombres
 * - Ejecuta associate(models) UNA VEZ con el registro combinado
 */
const omit = (obj, keys) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

const legacy = require("./sequelize.models");

const sequelize = legacy.sequelize;
const Sequelize = legacy.Sequelize;

const META_KEYS = ["sequelize", "Sequelize"];
const models = { ...omit(legacy, META_KEYS) };

// agrega los auto solo si no existen en legacy
for (const [name, model] of Object.entries(omit(legacy, META_KEYS))) {
  if (models[name]) {
    if (process.env.DEBUG_MODELS === "1") {
      console.warn(
        `[models] Skipping auto-loaded "${name}" (legacy already provides it)`
      );
    }
    continue;
  }
  models[name] = model;
}

// Ejecutar asociaciones con el REGISTRO COMBINADO
for (const model of Object.values(models)) {
  if (typeof model.associate === "function" && !model._associated) {
    try {
      model.associate(models);
      model._associated = true; // flag para evitar dobles asociaciones
    } catch (err) {
      console.error(
        `[models] associate() failed for "${model.name}":`,
        err.message
      );
      throw err;
    }
  }
}

module.exports = { sequelize, Sequelize, ...models };

// Si necesitas importar modelos específicos:
//const { sequelize, Producto, StockReserve, Usuario } = require('../config/models');
//SET DEBUG_MODELS=1 & node -e "const m=require('./src/config/models'); console.log(Object.keys(m).filter(k=>!['sequelize','Sequelize'].includes(k)).slice(0,50));"
