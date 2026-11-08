const { startMqtt } = require("./adapters/mqtt.adapter");
const { ingest } = require("./ingestion/ingestion.service");
const { expire } = require("./presence/presence.service");
let runtime = null;
function startRuntime() {
  const mqtt = startMqtt({ ingest });
  let check = null;
  const timer = setInterval(() => {
    if (check) return;
    check = expire().catch(() => console.error({ component: "integration-presence", code: "PRESENCE_CHECK_FAILED" })).finally(() => { check = null; });
  }, 30000);
  timer.unref();
  runtime = { status: mqtt.status, stop: async () => { clearInterval(timer); await mqtt.stop(); await check; } };
  return runtime;
}
function status() { return runtime?.status() || { enabled: false, connected: false, subscription_ready: false }; }
module.exports = { startRuntime, status };
