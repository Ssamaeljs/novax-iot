#!/usr/bin/env bash
# Production deploy helper: chmod +x scripts/prod-deploy.sh #da permisoss de ejecucion

# 1) Loads .env.production
# 2) Creates a timestamped PG dump to /tmp
# 3) Runs DB migrations (node scripts/migrate.js up)
# 4) (Optional) Seeds
# 5) Restarts PM2/systemd if configured

set -euo pipefail

# --- run from repo root ---
cd "$(dirname "$0")/.."  # -> raíz del proyecto

# --- Load env file ---
ENV_FILE="${ENV_FILE:-.env.production}"

# si no existe, usar .env si está presente
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f ".env" ]]; then
    echo "[prod-deploy] $ENV_FILE not found. Using .env"
    ENV_FILE=".env"
  else
    echo "[prod-deploy] Missing $ENV_FILE and .env"
    exit 1
  fi
fi

set -o allexport
# shellcheck source=/dev/null
source "$ENV_FILE"
set +o allexport


export NODE_ENV=production
echo "[prod-deploy] NODE_ENV=${NODE_ENV}"
echo "[prod-deploy] App: ${APP_NAME:-construapp}  DB: ${DB_NAME}  Host: ${DB_HOST}"

# --- Basic checks ---
req=(DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD)
for v in "${req[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "[prod-deploy] Missing env var: $v"
    exit 1
  fi
done

# Git info (opcional)
if command -v git >/dev/null 2>&1; then
  GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "no-git")
  echo "[prod-deploy] Commit: ${GIT_SHA}"
fi

# --- Disk space check for /tmp (needs ~200MB; ajusta si tu BD es grande) ---
if command -v df >/dev/null 2>&1; then
  KB_FREE=$(df -Pk /tmp | awk 'NR==2{print $4}')
  MB_FREE=$(( KB_FREE / 1024 ))
  echo "[prod-deploy] /tmp free space: ${MB_FREE} MB"
  if (( MB_FREE < 200 )); then
    echo "[prod-deploy] Not enough free space in /tmp (need >=200MB)."
    exit 1
  fi
fi

# --- Step 1/5: Backup ---
echo "[prod-deploy] Step 1/5: Backup database -> /tmp"
DUMP_PATH=$(node scripts/backup-db.js)
echo "$DUMP_PATH" > .last-prod-dump      # guardamos el path por si se pierde el contexto
echo "[prod-deploy] Dump created at: $DUMP_PATH"

# --- Step 2/5: Install deps ---
echo "[prod-deploy] Step 2/5: Install dependencies"
# Si construyes frontend aquí, quita --omit=dev
npm ci --omit=dev

# --- (Opcional) Build frontend aquí si tu server sirve el build ---
# npm run build

# --- Step 3/5: Pre-migration status (visibilidad) ---
echo "[prod-deploy] Step 3/5: DB status (before)"
node scripts/migrate.js status || true

# --- Step 4/5: Run migrations (asegúrate de tener advisory lock en migrate.js) ---
echo "[prod-deploy] Step 4/5: Run migrations"
node scripts/migrate.js up

echo "[prod-deploy] DB status (after)"
node scripts/migrate.js status || true

# --- Step 5/5: Seeds opcionales ---
if [[ "${RUN_SEEDS:-0}" == "1" ]]; then
  echo "[prod-deploy] Running seeds..."
  # node scripts/seed.js
else
  echo "[prod-deploy] Skip seeds."
fi

# --- Restart app (PM2 or systemd) ---
if command -v pm2 >/dev/null 2>&1; then
  if [[ -f ecosystem.config.js ]]; then
    echo "[prod-deploy] Reloading PM2 via ecosystem.config.js"
    pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js
  else
    # Fallback por nombre de app si no hay ecosystem
    APP_PM2="${APP_PM2_NAME:-construapp}"
    echo "[prod-deploy] Reloading PM2 app: $APP_PM2"
    pm2 reload "$APP_PM2" || pm2 start index.js --name "$APP_PM2"
  fi
else
  echo "[prod-deploy] No PM2 found. Ensure your service is restarted (systemd?)."
fi

echo "[prod-deploy] DONE      Dump: $DUMP_PATH  Commit: ${GIT_SHA:-no-git}"



#Si algo anda mal, puedes restaurar la base de datos con el dump creado en /tmp con lo siguiente script:

#D=$(cat .last-prod-dump); echo "Último dump: $D"

# export $(grep -v '^#' .env.production | xargs)

# # Terminar conexiones (con cuidado)
# psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"

# # Borrar y recrear vacía (si es aceptable) o usar --clean
# dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
# createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" --template=template0 --encoding=UTF8

# # Restaurar dump (custom -Fc)
# pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges --exit-on-error /tmp/construapp_prod_YYYYMMDD_HHMMSS.dump

