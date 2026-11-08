const { randomUUID } = require('node:crypto');
const { prompts } = require('./compose-prompts');
const { withPublisher, publishAndWait } = require('./compose-mqtt-client');
const { UUID } = require('../src/modules/module-integration/normalization/contract');

async function main() {
  const input = prompts();
  let source, token, payload;
  try {
    source = await input.text('UUID de la fuente MQTT (el UUID del tópico, no el del dispositivo)');
    token = await input.secret('Credencial de la fuente (no se muestra)');
    payload = JSON.parse(await input.text('Payload JSON de una línea (ejemplo {"hum":72.4})'));
  } finally { input.close(); }
  if (!UUID.test(source) || !/^nvx_ingest_[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('UUID o credencial de fuente inválidos.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('El payload debe ser un objeto JSON.');
  const message = { schema_version: 1, message_id: randomUUID(), observed_at: new Date().toISOString(), payload };
  const ack = await withPublisher((client) => publishAndWait(client, `novax/v1/sources/${source}/telemetry`, { token, message }));
  if (ack.status !== 'ACCEPTED') throw new Error(`NOVAX no aceptó la nueva lectura: ${ack.status || 'SIN_ESTADO'} ${ack.code || ''}`);
  console.log(`ACCEPTED · ${ack.reading_count} lectura(s) · recepción ${ack.external_id}`);
  console.log('Comprueba la lectura en el histórico del sensor.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
