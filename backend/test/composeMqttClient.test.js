const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { publishAndWait } = require('../scripts/compose-mqtt-client');

const topic = 'novax/v1/sources/11111111-1111-4111-8111-111111111111/telemetry';
const ack = topic.replace(/telemetry$/, 'ack');
const wrapper = { token: 'fixture', message: { message_id: 'sample', payload: { hum: 72.4 } } };

test('Compose publisher subscribes before publishing and waits for the correlated application ACK', async () => {
  const client = new EventEmitter();
  const calls = [];
  client.subscribeAsync = async (name, options) => { calls.push(name); assert.equal(options.qos, 1); return [{ qos: 1 }]; };
  client.publish = (name, payload, options, callback) => {
    calls.push(name);
    assert.deepEqual(JSON.parse(payload), wrapper);
    assert.deepEqual(options, { qos: 1, retain: false });
    callback();
    queueMicrotask(() => {
      client.emit('message', ack, Buffer.from('{"message_id":"different","status":"ACCEPTED"}'));
      client.emit('message', ack, Buffer.from('{"message_id":"sample","status":"ACCEPTED","reading_count":1}'));
    });
  };
  assert.equal((await publishAndWait(client, topic, wrapper)).reading_count, 1);
  assert.deepEqual(calls, [ack, topic]);
  assert.equal(client.listenerCount('message'), 0);
});

test('Compose publisher refuses denied subscription and reports a disconnected broker', async () => {
  const client = new EventEmitter();
  client.subscribeAsync = async () => [{ qos: 128 }];
  client.publish = () => assert.fail('must not publish without ACK subscription');
  await assert.rejects(publishAndWait(client, topic, wrapper), /no autorizó/);
  client.subscribeAsync = async () => [{ qos: 1 }];
  client.publish = () => queueMicrotask(() => client.emit('close'));
  await assert.rejects(publishAndWait(client, topic, wrapper), /cerró la conexión/);
  assert.equal(client.listenerCount('message'), 0);
});
