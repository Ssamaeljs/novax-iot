/**
 * Safe PostgreSQL backup runner:
 * - Creates a compressed dump (.dump) in /tmp with timestamp.
 * - Uses env vars (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, PG_BIN).
 * - Fails fast if pg_dump is not available or connection fails.
 * - Never prints the password.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}${m}${day}_${hh}${mm}${ss}`;
}

function resolveBin(binName) {
  const pgBin = process.env.PG_BIN;
  if (pgBin && fs.existsSync(pgBin)) {
    // If PG_BIN points to a directory, append binName; if it points to the binary, just use it.
    const stat = fs.statSync(pgBin);
    if (stat.isDirectory()) {
      const candidate = path.join(
        pgBin,
        binName + (process.platform === "win32" ? ".exe" : "")
      );
      if (fs.existsSync(candidate)) return candidate;
      throw new Error(`Binary not found in PG_BIN: ${candidate}`);
    }
    return pgBin; // assume it is the binary path itself
  }
  // Otherwise rely on PATH
  return binName + (process.platform === "win32" ? ".exe" : "");
}

function assertPgDumpAvailable(cmd) {
  const res = spawnSync(cmd, ["--version"], { encoding: "utf8" });
  if (res.error || res.status !== 0) {
    throw new Error(
      `pg_dump unavailable. Checked command: ${cmd}\n` +
        `Status: ${res.status}\n` +
        `Error: ${res.error ? res.error.message : res.stderr}`
    );
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

(async () => {
  try {
    const DB_HOST = requireEnv("DB_HOST");
    const DB_PORT = requireEnv("DB_PORT");
    const DB_NAME = requireEnv("DB_NAME");
    const DB_USER = requireEnv("DB_USER");
    const DB_PASSWORD = requireEnv("DB_PASSWORD");

    const pgDumpCmd = resolveBin("pg_dump");
    assertPgDumpAvailable(pgDumpCmd);

    const stamp = nowStamp();
    const outFile = `/tmp/${DB_NAME}_${stamp}.dump`;

    console.log(`[backup-db] Creating dump: ${outFile}`);
    const env = { ...process.env, PGPASSWORD: DB_PASSWORD };

    // We use custom format (-Fc) for faster restore and flexible options.
    const args = [
      "-h",
      DB_HOST,
      "-p",
      String(DB_PORT),
      "-U",
      DB_USER,
      "-d",
      DB_NAME,
      "-Fc", // custom compressed format
      "--no-owner",
      "--no-privileges",
      "-f",
      outFile,
    ];

    const res = spawnSync(pgDumpCmd, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });

    if (res.status !== 0) {
      console.error(res.stdout);
      console.error(res.stderr);
      throw new Error(`pg_dump failed with status ${res.status}`);
    }

    // Basic integrity check: file exists and > 0 bytes
    const stat = fs.statSync(outFile);
    if (!stat || stat.size === 0) {
      throw new Error("Dump file is empty or missing.");
    }

    console.log(`[backup-db] OK (${Math.round(stat.size / 1024)} KB).`);
    console.log(outFile); // print path for pipelines
    process.exit(0);
  } catch (err) {
    console.error("[backup-db][ERROR]", err.message);
    process.exit(1);
  }
})();
