const { readFileSync, writeFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const secrets = ['NOVAX_DB_PASSWORD', 'NOVAX_BOOTSTRAP_SECRET', 'MQTT_PASSWORD', 'MQTT_TEST_PASSWORD'];
const template = readFileSync(resolve(root, '.env.example'), 'utf8');
let contents = template;
for (const key of secrets) {
  const entry = new RegExp(`^${key}=\\r?$`, 'm');
  if (!entry.test(contents)) throw new Error(`Falta el marcador vacío ${key} en .env.example`);
  contents = contents.replace(entry, `${key}=${randomBytes(24).toString('hex')}`);
}
try {
  writeFileSync(resolve(root, '.env'), contents, { flag: 'wx', mode: 0o600 });
  console.log('Creado .env de laboratorio con credenciales aleatorias. No se modificó backend/.env.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Ya existe .env; se conserva sin cambios.');
}
