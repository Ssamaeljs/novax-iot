// src/config/sequelize.index.js
/**
 * Auto-loader de modelos por submódulo (Windows-proof)
 * - Busca: src/modules/.model.js
 * - Inicializa cada modelo con (sequelize, DataTypes)
 * - Ejecuta associate(models) si existe
 * Activa debug con: $env:DEBUG_MODELS="1"
 */

// src/config/sequelize.index.js
/**
 * Auto-loader de modelos por submódulo (Windows-proof)
 * - Busca: src/modules/.model.js
 * - Inicializa cada modelo con (sequelize, DataTypes)
 * - NO ejecuta associate aquí (lo haremos en el registro combinado)
 */
const path = require('path');
const glob = require('glob');
const { DataTypes, Sequelize } = require('sequelize');
const sequelize  = require('./database');

const ROOT = path.join(__dirname, '..', '..');
const PATTERN = 'src/modules/**/*.model.js';

function loadModels() {
  const files = glob.sync(PATTERN, { cwd: ROOT, absolute: true, nodir: true }).sort();

  if (process.env.DEBUG_MODELS === '1') {
    console.log('[models:auto] ROOT:', ROOT);
    console.log('[models:auto] PATTERN:', PATTERN);
    console.log('[models:auto] FILES:', files);
  }

  const models = {};
  for (const file of files) {
    const factory = require(file);
    if (typeof factory !== 'function') {
      if (process.env.DEBUG_MODELS === '1') {
        console.warn(`[models:auto] Skipped (not a function): ${file}`);
      }
      continue;
    }
    const model = factory(sequelize, DataTypes);
    if (!model || !model.name) {
      throw new Error(`Model factory did not return a named model: ${file}`);
    }
    if (models[model.name]) {
      console.warn(`[models:auto] Duplicate model name "${model.name}" from file: ${file}`);
    }
    models[model.name] = model;
  }

  if (process.env.DEBUG_MODELS === '1') {
    console.log('[models:auto] Loaded models:', Object.keys(models));
  }

  return { models, sequelize, Sequelize };
}

const registry = loadModels();
module.exports = { ...registry.models, sequelize: registry.sequelize, Sequelize: registry.Sequelize };

// Si necesitas importar modelos específicos:
//const { sequelize, Producto, StockReserve, Usuario } = require('./sequelize.index');
//SET DEBUG_MODELS=1 & node -e "const m=require('./src/config/sequelize.index'); console.log(Object.keys(m).filter(k=>!['sequelize','Sequelize'].includes(k)).slice(0,50));"
