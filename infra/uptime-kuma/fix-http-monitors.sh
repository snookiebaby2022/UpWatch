#!/bin/bash
# Tune HTTP monitors in Uptime Kuma — retries + timeout so brief 502s don't flip DOWN.
# Run on the Pi/VPS hosting Kuma (or via deploy-kuma GitHub Action SSH step).
set -e

CONTAINER="${KUMA_CONTAINER:-upwatch-uptime-kuma}"
FALLBACK_CONTAINER="uptime-kuma"
MAX_RETRIES="${KUMA_HTTP_MAX_RETRIES:-2}"
RETRY_INTERVAL="${KUMA_HTTP_RETRY_INTERVAL:-20}"
TIMEOUT_MS="${KUMA_HTTP_TIMEOUT_MS:-30000}"
NEXLIFY_HOST="${NEXLIFY_HOST:-nexlify.live}"

DB_PATHS=(
  "/home/snookie/income-stack/uptime-kuma/data/kuma.db"
  "/home/snookie/upwatch-kuma/data/kuma.db"
  "/var/lib/docker/volumes/uptime-kuma_kuma-data/_data/kuma.db"
  "/var/lib/docker/volumes/upwatch-kuma_kuma-data/_data/kuma.db"
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
echo "HTTP monitors → maxretries=$MAX_RETRIES retry_interval=${RETRY_INTERVAL}s timeout=${TIMEOUT_MS}ms"

docker stop "$CONTAINER" 2>/dev/null || docker stop "$FALLBACK_CONTAINER" 2>/dev/null || true

SQL="
UPDATE monitor SET
  maxretries = ${MAX_RETRIES},
  retry_interval = ${RETRY_INTERVAL},
  timeout = ${TIMEOUT_MS}
WHERE type IN ('http', 'keyword', 'json-query')
  AND active = 1;

UPDATE monitor SET
  maxretries = ${MAX_RETRIES},
  retry_interval = ${RETRY_INTERVAL},
  timeout = ${TIMEOUT_MS}
WHERE (name LIKE '%Nexlify%' OR url LIKE '%${NEXLIFY_HOST}%')
  AND type NOT IN ('push');

SELECT id, name, type, url, interval, maxretries, retry_interval, timeout
FROM monitor
WHERE active = 1 AND type NOT IN ('push')
ORDER BY name;
"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 -header "$DB" "$SQL"
else
  docker run --rm -v "${DB}:/data/kuma.db" keinos/sqlite3 sqlite3 -header /data/kuma.db "$SQL"
fi

docker start "$CONTAINER" 2>/dev/null || docker start "$FALLBACK_CONTAINER" 2>/dev/null || true
echo "Done. Restart Kuma container if monitors don't pick up changes immediately."
