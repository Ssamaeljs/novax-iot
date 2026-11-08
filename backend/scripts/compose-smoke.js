const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { withPublisher, publishAndWait } = require('./compose-mqtt-client');

async function main() {
  if (process.env.NOVAX_SMOKE_ALLOWED !== 'true') throw new Error('La prueba requiere la configuración aislada docker/qa.env. Consulta el README.');
  const origin = process.env.WEB_ORIGIN;
  const base = 'http://frontend:8080';
  let cookie;
  async function request(path, { method = 'GET', body, headers = {}, expect = 200 } = {}) {
    const response = await fetch(`${base}/v1/api/${path}`, {
      method, signal: AbortSignal.timeout(10000),
      headers: { Origin: origin, 'X-Novax-CSRF': '1', ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (response.status === 409 && path === 'bootstrap') throw new Error('La base QA ya fue inicializada. Usa un proyecto Compose de prueba nuevo; no se modificó la base existente.');
    assert.equal(response.status, expect, `${method} ${path}: ${result.code || response.status}`);
    return { data: result.data, response };
  }
  const html = await fetch(`${base}/app/operations/devices`, { signal: AbortSignal.timeout(10000) });
  assert.equal(html.status, 200);
  assert.match(await html.text(), /<app-root[\s>]/);
  const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(10000) });
  assert.equal(health.status, 200);
  console.log('OK Nginx: ruta profunda Angular y proxy de salud');

  const password = randomBytes(24).toString('hex');
  await request('bootstrap', { method: 'POST', expect: 201, headers: { 'X-Bootstrap-Secret': process.env.BOOTSTRAP_SECRET }, body: { first_name: 'QA', last_name: 'Compose', id_card: 'QA-COMPOSE', username: 'qa-compose', email: 'qa-compose@example.test', password } });
  const login = await request('auth/web/login', { method: 'POST', expect: 201, body: { identifier: 'qa-compose', password } });
  cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('novax_session='), 'No se recibió la cookie web');
  await request('auth/me');
  console.log('OK Migraciones, bootstrap, sesión web y cookie a través del proxy');

  let ready = false;
  for (let i = 0; i < 20 && !ready; i++) {
    ready = (await request('integrations/status')).data.subscription_ready === true;
    if (!ready) await delay(500);
  }
  assert.ok(ready, 'El backend no confirmó suscripción MQTT');
  const create = async (path, body) => (await request(path, { method: 'POST', body, expect: 201 })).data;
  async function fixture(transport, path, scale) {
    const device = await create('iot/devices', { name: `Simulador ${transport}`, device_type: 'SIMULATOR', protocol: transport });
    const sensor = await create(`iot/devices/${device.external_id}/sensors`, { name: 'Humedad', key: 'humidity', metric: 'humidity', unit: '%', data_type: 'NUMBER' });
    const profile = await create('integrations/profiles', { name: `Humedad ${transport}`, mappings: [{ path, sensor_key: 'humidity', metric: 'humidity', unit: '%', data_type: 'NUMBER', scale }] });
    const source = await create('integrations/sources', { name: `Fuente ${transport}`, device_external_id: device.external_id, profile_external_id: profile.external_id, transport });
    return { sensor, source };
  }
  const envelope = (payload) => ({ schema_version: 1, message_id: randomUUID(), observed_at: new Date().toISOString(), payload });
  const mqtt = await fixture('MQTT', 'env.rh', 100);
  await withPublisher(async (client) => {
    const wrapper = { token: mqtt.source.token, message: envelope({ env: { rh: 0.724 } }) };
    const first = await publishAndWait(client, mqtt.source.mqtt_topic, wrapper);
    assert.equal(first.status, 'ACCEPTED');
    const repeat = await publishAndWait(client, mqtt.source.mqtt_topic, wrapper);
    assert.equal(repeat.status, 'DUPLICATE');
    assert.equal(repeat.external_id, first.external_id);
  });
  const http = await fixture('HTTPS', 'hum', 1);
  await request(`ingest/https/${http.source.external_id}`, { method: 'POST', expect: 201, headers: { Authorization: `Bearer ${http.source.token}` }, body: envelope({ hum: 72.4 }) });
  for (const { sensor } of [mqtt, http]) {
    const result = await request(`iot/measurements?sensor_external_id=${sensor.external_id}`);
    assert.equal(result.data.length, 1);
    assert.ok(Math.abs(result.data[0].value - 72.4) < 1e-9, 'Valor normalizado inesperado');
  }
  console.log('OK Mosquitto real, ACK ACCEPTED/DUPLICATE y lecturas equivalentes en PostgreSQL');
  console.log('El adaptador HTTPS se comprobó con HTTP local de laboratorio, no con TLS.');
}

main().catch((error) => { console.error(`Smoke falló: ${error.message}`); process.exitCode = 1; });
