// Explicitly invoked: this runner is not part of Node's automatic test discovery.
require("dotenv").config({ quiet: true });
const { Client } = require("pg");
const { randomBytes } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

async function run() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Integration database creation is forbidden in production");
  }
  const database = `novax_qa_single_org_${randomBytes(6).toString("hex")}`;
  if (!/^novax_qa_single_org_[a-f0-9]{12}$/.test(database)) {
    throw new Error("Invalid isolated test database name");
  }
  const admin = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: "postgres",
    connectionTimeoutMillis: 5000,
  });
  let created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
    created = true;
    console.log("Created an isolated test database. Application data is unchanged.");
    const env = { ...process.env, DB_NAME: database, NODE_ENV: "test", DB_LOGGING: "false", RUN_DATABASE_TESTS: "1", RUN_MQTT_WIRE_TESTS: "1", MQTT_ENABLED: "false", TRUST_PROXY: "" };
    const cwd = path.resolve(__dirname, "..");
    for (const args of [["scripts/migrate.js", "up"], ["--test", "test/webIntegration.test.js", "test/projectsIntegration.test.js", "test/ingestionIntegration.test.js", "test/mqttWire.test.js"]]) {
      const result = spawnSync(process.execPath, args, { cwd, env, encoding: "utf8", timeout: 90000 });
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      if (result.status !== 0) {
        throw new Error(`Isolated verification failed (${result.error?.code || result.status})`);
      }
    }
  } finally {
    if (created) {
      await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()", [database]);
      await admin.query(`DROP DATABASE "${database}"`);
      console.log("Removed only the temporary database created by this verification.");
    }
    await admin.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
