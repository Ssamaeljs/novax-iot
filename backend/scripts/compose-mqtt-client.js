const { connectAsync } = require('mqtt');

async function withPublisher(task, env = process.env) {
  if (!env.MQTT_URL || !env.MQTT_TEST_USERNAME || !env.MQTT_TEST_PASSWORD) throw new Error('Falta configurar el emisor MQTT del laboratorio.');
  const client = await connectAsync(env.MQTT_URL, {
    username: env.MQTT_TEST_USERNAME, password: env.MQTT_TEST_PASSWORD,
    protocolVersion: 4, connectTimeout: 8000, reconnectPeriod: 0,
  });
  try { return await task(client); }
  finally { await client.endAsync(true); }
}

async function publishAndWait(client, topic, wrapper) {
  const ackTopic = topic.replace(/\/telemetry$/, '/ack');
  const subscriptions = await client.subscribeAsync(ackTopic, { qos: 1 });
  if (!subscriptions.length || subscriptions.some(({ qos }) => qos >= 128)) throw new Error('El broker no autorizó la suscripción a /ack.');
  return new Promise((resolve, reject) => {
    const finish = (error, result) => {
      clearTimeout(timer);
      client.off('message', receive);
      client.off('error', fail);
      client.off('close', closed);
      if (error) reject(error); else resolve(result);
    };
    const fail = () => finish(new Error('Falló la conexión MQTT.'));
    const closed = () => finish(new Error('Se cerró la conexión MQTT antes del ACK.'));
    const receive = (name, data) => {
      if (name !== ackTopic) return;
      let ack;
      try { ack = JSON.parse(data.toString('utf8')); } catch { return; }
      if (ack.message_id === wrapper.message.message_id) finish(null, ack);
    };
    const timer = setTimeout(() => finish(new Error('Sin ACK de NOVAX tras 12 s. Comprueba suscripción, fuente activa, credencial y perfil.')), 12000);
    client.on('message', receive);
    client.once('error', fail);
    client.once('close', closed);
    client.publish(topic, JSON.stringify(wrapper), { qos: 1, retain: false }, (error) => { if (error) fail(); });
  });
}

module.exports = { withPublisher, publishAndWait };
