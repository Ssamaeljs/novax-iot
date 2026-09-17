// scripts/migrate.js
/*
 * Umzug runner mejorado (Windows-proof):
 * - Ordena migraciones por timestamp del basename (no por carpetas).
 * - Mantiene basename como "name" (compatible con SequelizeMeta).
 * - Soporta: up | down | down --count=N | down:all | down:to <file> | status | pending | executed | help
 * - DEBUG_MIG=1 para ver archivos encontrados y orden final.
 */
const { Umzug, SequelizeStorage } = require("umzug");
const path = require("path");
const glob = require("glob");
const sequelize = require("../src/config/database");
const SequelizeLib = require("sequelize");

const cwd = path.join(__dirname, "..");
const pattern = "src/**/migrations/*.js";

// === utilidades de orden ===
const TS_REGEX = /^(\d{4}\.\d{2}\.\d{2}T\d{6})/i;
function tsKeyFromBasename(bn) {
  const m = bn.match(TS_REGEX);
  if (!m) return bn;
  const raw = m[1]; // ej. 2025.09.11T164819
  return raw.replace(/[^\d]/g, ""); // "20250911164819"
}

// === buscar archivos y ordenar ===
let files = glob.sync(pattern, { cwd, absolute: true, nodir: true });
files = files
  .map((f) => ({
    file: f,
    bn: path.basename(f),
    key: tsKeyFromBasename(path.basename(f)),
  }))
  .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  .map((x) => x.file);

// === debug ===
if (process.env.DEBUG_MIG === "1") {
  console.log("[migrate] CWD:", cwd);
  console.log("[migrate] Pattern:", pattern);
  console.log(
    "[migrate] Final order:",
    files.map((f) => path.basename(f))
  );
}

// === chequear duplicados ===
const seen = {};
files.forEach((f) => {
  const bn = path.basename(f);
  seen[bn] = (seen[bn] || 0) + 1;
});
Object.entries(seen)
  .filter(([bn, c]) => c > 1)
  .forEach(([bn]) => {
    console.warn("[migrate][WARN] basename duplicado:", bn);
  });

// === cargar migraciones ===
const migrations = files.map((file) => {
  const mod = require(file);
  if (typeof mod.up !== "function" || typeof mod.down !== "function") {
    throw new Error(`Migration file must export { up, down }: ${file}`);
  }
  return {
    name: path.basename(file),
    up: async () => mod.up(sequelize.getQueryInterface(), SequelizeLib),
    down: async () => mod.down(sequelize.getQueryInterface(), SequelizeLib),
  };
});

const umzug = new Umzug({
  migrations,
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, modelName: "SequelizeMeta" }),
  logger: console,
});

// === helpers ===

async function withPgAdvisoryLock(sequelize, lockKeyBigint, fn) {
  const qi = sequelize.getQueryInterface();
  try {
    await qi.sequelize.query("SELECT pg_advisory_lock(:k);", {
      replacements: { k: lockKeyBigint },
    });
    return await fn();
  } finally {
    await qi.sequelize.query("SELECT pg_advisory_unlock(:k);", {
      replacements: { k: lockKeyBigint },
    });
  }
}

async function printStatus() {
  const executed = await umzug.executed();
  const pending = await umzug.pending();
  console.log("Executed migrations:");
  executed.forEach((m) => console.log(`  ✔ ${m.name}`));
  console.log("Pending migrations:");
  pending.forEach((m) => console.log(`  ☐ ${m.name}`));
}

function printHelp() {
  console.log(`
Usage: node scripts/migrate.js <command> [args]

Commands:
  up                         Ejecuta todas las migraciones pendientes.
  down                       Revierte la última migración (use --count=N para varias).
  down --count=3             Revierte las 3 últimas migraciones.
  down:all                   Revierte todas las migraciones (hasta 0).
  down:to <filename>         Revierte hasta dejar sin aplicar <filename>.
  status                     Lista ejecutadas y pendientes.
  pending                    Lista solo las pendientes.
  executed                   Lista solo las ejecutadas.
  help                       Muestra esta ayuda.

Ejemplos:
  node scripts/migrate.js up
  node scripts/migrate.js down
  node scripts/migrate.js down --count=2
  node scripts/migrate.js down:to 2025.09.11T164819-create-rq_product_fulfillment.js
  node scripts/migrate.js status

DEBUG_MIG=1 para ver archivos detectados y orden final.
`);
}

// === runner ===
async function run() {
  const cmd = (process.argv[2] || "up").toLowerCase();

  if (cmd === "help") return printHelp();

  if (cmd === "up") {
    const LOCK_KEY = 4815162342n; // valor constante para todos tus servicios
    const res = await withPgAdvisoryLock(sequelize, LOCK_KEY, () => umzug.up());
    console.log(
      "Applied migrations:",
      res.map((m) => m.name)
    );
    return;
  }

  if (cmd === "down") {
    const countArg = (
      process.argv.find((a) => a.startsWith("--count=")) || ""
    ).split("=")[1];
    if (countArg) {
      const n = parseInt(countArg, 10);
      const executed = await umzug.executed();
      const target =
        executed.length >= n ? executed[executed.length - n].name : 0;
      const res = await umzug.down({ to: target });
      console.log(
        `Reverted last ${n} migration(s):`,
        res.map((m) => m.name)
      );
      return;
    }
    const res = await umzug.down();
    console.log("Reverted migration:", res?.map?.((m) => m.name) || res);
    return;
  }

  if (cmd === "down:all") {
    const res = await umzug.down({ to: 0 });
    console.log(
      "Reverted all migrations:",
      res.map((m) => m.name)
    );
    return;
  }

  if (cmd === "down:to") {
    const target = process.argv[3];
    if (!target) {
      console.error("You must provide the target migration filename.");
      process.exit(1);
    }
    const res = await umzug.down({ to: target });
    console.log(
      `Reverted migrations down to "${target}":`,
      res.map((m) => m.name)
    );
    return;
  }

  if (cmd === "status") return printStatus();
  if (cmd === "pending")
    return console.log((await umzug.pending()).map((m) => m.name));
  if (cmd === "executed")
    return console.log((await umzug.executed()).map((m) => m.name));

  printHelp();
}

(async () => {
  try {
    await run();
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    await sequelize.close();
    process.exit(1);
  }
})();
