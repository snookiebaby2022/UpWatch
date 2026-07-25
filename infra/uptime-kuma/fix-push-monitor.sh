#!/bin/bash
# Fix push monitor URL when Uptime Kuma UI won't save it (common with locked/read-only monitors).
set -e

PUSH_URL="https://status.upwatch.online/api/push/5pyQgQR1m8"
CONTAINER="${KUMA_CONTAINER:-upwatch-uptime-kuma}"
FALLBACK_CONTAINER="uptime-kuma"

DB_PATHS=(
  "/home/snookie/income-stack/uptime-kuma/data/kuma.db"
  "/var/lib/docker/volumes/uptime-kuma_kuma-data/_data/kuma.db"
  "$(dirname "$0")/data/kuma.db"
)

DB=""
for p in "${DB_PATHS[@]}"; do
  if [ -f "$p" ]; then DB="$p"; break; fi
done

if [ -z "$DB" ]; then
  echo "kuma.db not found. Set KUMA_DB=/path/to/kuma.db and re-run."
  exit 1
fi

echo "Using database: $DB"

stop_container() {
  docker stop "$CONTAINER" 2>/dev/null || docker stop "$FALLBACK_CONTAINER" 2>/dev/null || true
}

start_container() {
  docker start "$CONTAINER" 2>/dev/null || docker start "$FALLBACK_CONTAINER" 2>/dev/null || true
}

stop_container

SQL="UPDATE monitor SET url='${PUSH_URL}' WHERE type='push' OR push_token IS NOT NULL OR url LIKE '%/api/push/%';"
SQL="${SQL} SELECT id, name, type, url, push_token FROM monitor WHERE type='push' OR push_token IS NOT NULL;"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" "$SQL"
else
  docker run --rm -v "${DB}:/data/kuma.db" keinos/sqlite3 sqlite3 /data/kuma.db "$SQL"
fi

start_container
echo "Done. Push URL set to: $PUSH_URL"
