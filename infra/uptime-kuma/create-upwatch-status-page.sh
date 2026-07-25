#!/usr/bin/env bash
# Re-sync all active Kuma monitors onto the public "upwatch" status page.
# Run on the Kuma host after adding new demo monitors in the dashboard:
#   bash infra/uptime-kuma/create-upwatch-status-page.sh
# New HTTP monitors get send_url=1 so URLs appear on upwatch.online homepage demo.
set -euo pipefail

CONTAINER="${KUMA_CONTAINER:-upwatch-uptime-kuma}"
FALLBACK_CONTAINER="uptime-kuma"

DB_PATHS=(
  "${KUMA_DB:-${1:-}}"
  "/home/snookie/income-stack/uptime-kuma/data/kuma.db"
  "/home/snookie/upwatch-kuma/data/kuma.db"
  "/var/lib/docker/volumes/upwatch-kuma_kuma-data/_data/kuma.db"
  "/var/lib/docker/volumes/uptime-kuma_kuma-data/_data/kuma.db"
  "$(dirname "$0")/data/kuma.db"
)

DB=""
for p in "${DB_PATHS[@]}"; do
  [ -n "$p" ] || continue
  if [ -f "$p" ]; then DB="$p"; break; fi
done

if [ -z "$DB" ]; then
  echo "kuma.db not found. Pass the path as the first argument or set KUMA_DB=/path/to/kuma.db"
  exit 1
fi

DATA_DIR="$(dirname "$DB")"
DB_FILE="$(basename "$DB")"

echo "Using database: $DB"

if ! command -v sqlite3 >/dev/null 2>&1 && ! command -v docker >/dev/null 2>&1; then
  echo "Install sqlite3 or Docker to update the Kuma database."
  exit 1
fi

stop_kuma() {
  docker stop "$CONTAINER" 2>/dev/null || docker stop "$FALLBACK_CONTAINER" 2>/dev/null || true
}

start_kuma() {
  docker start "$CONTAINER" 2>/dev/null || docker start "$FALLBACK_CONTAINER" 2>/dev/null || true
}

# SQLite also needs the data directory writable (journal/WAL files).
ensure_writable() {
  if [ -w "$DB" ] && [ -w "$DATA_DIR" ]; then
    return 0
  fi

  echo "Kuma data is not writable by $(whoami) — fixing ownership on $DATA_DIR"
  if command -v sudo >/dev/null 2>&1; then
    sudo chown -R "$(whoami):$(id -gn)" "$DATA_DIR"
  else
    echo "Cannot write to $DATA_DIR. Run: sudo chown -R \$USER \"$DATA_DIR\""
    exit 1
  fi
}

run_sql() {
  local sql="$1"

  if [ -w "$DB" ] && [ -w "$DATA_DIR" ]; then
    sqlite3 "$DB" "$sql"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo sqlite3 "$DB" "$sql"
    return
  fi

  # Mount the whole data directory — a file-only mount cannot create journal files.
  if command -v docker >/dev/null 2>&1; then
    docker run --rm -v "${DATA_DIR}:/data:rw" keinos/sqlite3 sqlite3 "/data/${DB_FILE}" "$sql"
    return
  fi

  echo "Cannot write to $DB. Run: sudo chown -R \$USER \"$DATA_DIR\""
  exit 1
}

stop_kuma
ensure_writable

if ! run_sql "SELECT slug FROM status_page WHERE slug='upwatch';" | grep -q upwatch; then
  run_sql "
INSERT INTO status_page (slug, title, description, icon, theme, published, search_engine_index, show_tags, show_powered_by, custom_css)
SELECT 'upwatch', 'UpWatch', 'Public status for upwatch.online', icon, theme, 1, 1, show_tags, show_powered_by, custom_css
FROM status_page WHERE slug='demo';

INSERT INTO \"group\" (name, weight, status_page_id, public)
SELECT 'UpWatch Services', 1000, (SELECT id FROM status_page WHERE slug='upwatch'), 1
WHERE NOT EXISTS (
  SELECT 1 FROM \"group\" g
  JOIN status_page sp ON sp.id = g.status_page_id
  WHERE sp.slug = 'upwatch'
);
"
  echo "Created status page slug: upwatch"
else
  echo "Status page upwatch already exists — syncing monitors"
fi

run_sql "
INSERT INTO monitor_group (monitor_id, group_id, weight, send_url)
SELECT m.id, g.id, 1000, CASE WHEN m.type IN ('http', 'https') THEN 1 ELSE 0 END
FROM monitor m
CROSS JOIN \"group\" g
JOIN status_page sp ON sp.id = g.status_page_id
WHERE sp.slug = 'upwatch'
  AND m.active = 1
  AND m.type != 'push'
  AND NOT EXISTS (
    SELECT 1 FROM monitor_group mg WHERE mg.monitor_id = m.id AND mg.group_id = g.id
  );

UPDATE monitor_group
SET send_url = 1
WHERE group_id = (SELECT g.id FROM \"group\" g JOIN status_page sp ON sp.id = g.status_page_id WHERE sp.slug = 'upwatch')
  AND monitor_id IN (SELECT id FROM monitor WHERE type IN ('http', 'https') AND active = 1);
"

run_sql "SELECT id, slug, title FROM status_page WHERE slug IN ('demo','upwatch');"
run_sql "SELECT m.id, m.name, m.type FROM monitor m JOIN monitor_group mg ON mg.monitor_id = m.id JOIN \"group\" g ON g.id = mg.group_id JOIN status_page sp ON sp.id = g.status_page_id WHERE sp.slug = 'upwatch' ORDER BY m.name;"

start_kuma
echo "Done. Refresh https://upwatch.online in ~30s to see demo monitors."
