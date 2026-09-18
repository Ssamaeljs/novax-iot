// scripts/prepare-db.js
/**
 * Flujo:
 * - Si existe la BD de rama -> salir (usar la existente).
 * - Si NO existe:
 *   A) Si existe la BD base (DB_NAME + '_' + DB_BRANCH_BASE):
 *      1) Generar respaldo .dump de la BD base.
 *      2) Crear BD de rama (vacía).
 *      3) Restaurar el respaldo en la BD de rama.
 *   B) Si NO existe la BD base:
 *      1) Buscar semilla en database/seed (o DB_SEED_DIR).
 *      2) Crear BD base y restaurar desde semilla.
 *      3) Crear BD de rama a partir de la base (clon por TEMPLATE o restore del mismo dump).
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const child_process = require("child_process");

function getGitBranch() {
  try {
    return child_process
      .execSync("git rev-parse --abbrev-ref HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
      })
      .toString()
      .trim()
      .replace(/[^\w-]/g, "_");
  } catch {
    return "local";
  }
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function dbExists(client, dbName) {
  const { rows } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName]
  );
  return rows.length > 0;
}

async function killConnections(client, dbName) {
  await client.query(
    `
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = $1 AND pid <> pg_backend_pid();
  `,
    [dbName]
  );
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function run(cmd, args, opts = {}) {
  const res = child_process.spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      PGPASSWORD: process.env.DB_PASS,
    },
    ...opts,
  });
  if (res.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
}

function findSeedFile() {
  const seedDir = process.env.DB_SEED_DIR || path.resolve("database/seed");
  if (!fs.existsSync(seedDir)) return null;
  const files = fs
    .readdirSync(seedDir)
    .filter((f) => f.endsWith(".dump") || f.endsWith(".sql"))
    .map((f) => path.join(seedDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || null; // el más reciente
}

(async () => {
  const env = process.env.NODE_ENV || "development";
  const isProd = env === "production";

  const BRANCH = getGitBranch();

  const DB_HOST = process.env.DB_HOST || "127.0.0.1";
  const DB_PORT = Number(process.env.DB_PORT || 5432);
  const DB_USER = process.env.DB_USER || "postgres";
  const DB_PASS = process.env.DB_PASS || "";
  const DB_NAME = process.env.DB_NAME;
  const DB_BRANCH_BASE = process.env.DB_BRANCH_BASE || "main";
  const USE_BRANCH_DATABASES = process.env.DB_BRANCH_DATABASES === "true";
  const CLONE_STRATEGY = (
    process.env.DB_CLONE_STRATEGY || "TEMPLATE"
  ).toUpperCase();

  const baseDb = isProd
    ? process.env.DB_NAME_PROD
    : `${DB_NAME}_${DB_BRANCH_BASE}`;

  const targetDb = isProd
    ? process.env.DB_NAME_PROD
    : USE_BRANCH_DATABASES
      ? `${DB_NAME}_${BRANCH}`
      : DB_NAME;

  // Cliente contra 'postgres' para crear/chequear DBs
  const sysClient = new Client({
    user: DB_USER,
    password: DB_PASS,
    host: DB_HOST,
    port: DB_PORT,
    database: "postgres",
  });
  await sysClient.connect();

  // 0) Si ya existe la BD de la rama -> salir
  if (await dbExists(sysClient, targetDb)) {
    console.log(`[prepare-db] Using existing branch DB: ${targetDb}`);
    await sysClient.end();
    return;
  }

  console.log(`[prepare-db] Branch DB not found: ${targetDb}`);

  const baseExists = await dbExists(sysClient, baseDb);

  if (baseExists) {
    // A) Base existe: crear backup y restaurar en la rama
    console.log(`[prepare-db] Base DB found: ${baseDb} -> making backup...`);
    const backupDir = path.resolve("db", "backups");
    ensureDir(backupDir);
    const dumpPath = path.join(backupDir, `${baseDb}.${timestamp()}.dump`);

    // Backup (custom format) de la base
    run("pg_dump", [
      "-U",
      DB_USER,
      "-h",
      DB_HOST,
      "-p",
      String(DB_PORT),
      "-d",
      baseDb,
      "-Fc",
      "-f",
      dumpPath,
    ]);

    // Crear target vacía y restaurar el backup
    console.log(`[prepare-db] Creating and restoring branch DB from backup...`);
    await sysClient.query(
      `CREATE DATABASE "${targetDb}" WITH ENCODING 'UTF8' TEMPLATE template0`
    );
    // Restaurar SIN --clean en DB recién creada
    run("pg_restore", [
      "-U",
      DB_USER,
      "-h",
      DB_HOST,
      "-p",
      String(DB_PORT),
      "-d",
      targetDb,
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      dumpPath,
    ]);

    console.log(`[prepare-db] OK: ${baseDb} -> (backup) -> ${targetDb}`);
    await sysClient.end();
    return;
  }

  // B) Base NO existe: buscar semilla
  const seedFile = findSeedFile();

  if (!seedFile) {
    // Sin base y sin semilla: crear target vacía
    console.warn(
      `[prepare-db] Base DB not found and no seed in database/seed. Creating EMPTY DB: ${targetDb}`
    );
    await sysClient.query(
      `CREATE DATABASE "${targetDb}" WITH ENCODING 'UTF8' TEMPLATE template0`
    );
    await sysClient.end();
    return;
  }

  console.log(`[prepare-db] Base DB not found. Seeding base from: ${seedFile}`);
  // 1) Crear base y restaurar semilla
  await sysClient.query(
    `CREATE DATABASE "${baseDb}" WITH ENCODING 'UTF8' TEMPLATE template0`
  );
  await sysClient.end();

  if (seedFile.endsWith(".dump")) {
    run("pg_restore", [
      "-U",
      DB_USER,
      "-h",
      DB_HOST,
      "-p",
      String(DB_PORT),
      "-d",
      baseDb,
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      seedFile,
    ]);
  } else {
    run("psql", [
      "-U",
      DB_USER,
      "-h",
      DB_HOST,
      "-p",
      String(DB_PORT),
      "-d",
      baseDb,
      "-f",
      seedFile,
    ]);
  }

  // 2) Crear la BD de la rama desde la base recién restaurada
  const sysClient2 = new Client({
    user: DB_USER,
    password: DB_PASS,
    host: DB_HOST,
    port: DB_PORT,
    database: "postgres",
  });
  await sysClient2.connect();

  if (!isProd && CLONE_STRATEGY === "TEMPLATE") {
    await killConnections(sysClient2, baseDb);
    await sysClient2.query(
      `CREATE DATABASE "${targetDb}" TEMPLATE "${baseDb}"`
    );
    console.log(`[prepare-db] Cloned by TEMPLATE: ${baseDb} -> ${targetDb}`);
  } else {
    // Alternativa universal: crear vacía y restaurar el MISMO seed (o dump de base)
    await sysClient2.query(
      `CREATE DATABASE "${targetDb}" WITH ENCODING 'UTF8' TEMPLATE template0`
    );
    if (seedFile.endsWith(".dump")) {
      run("pg_restore", [
        "-U",
        DB_USER,
        "-h",
        DB_HOST,
        "-p",
        String(DB_PORT),
        "-d",
        targetDb,
        "--no-owner",
        "--no-privileges",
        "--exit-on-error",
        seedFile,
      ]);
    } else {
      run("psql", [
        "-U",
        DB_USER,
        "-h",
        DB_HOST,
        "-p",
        String(DB_PORT),
        "-d",
        targetDb,
        "-f",
        seedFile,
      ]);
    }
    console.log(`[prepare-db] Restored seed into: ${targetDb}`);
  }

  await sysClient2.end();
})().catch((err) => {
  console.error("[prepare-db] ERROR:", err.message);
  process.exit(1);
});
