#!/usr/bin/env bash
# Creates status page slug "upwatch" in Kuma by cloning the demo page config.
# Run on the Kuma host (stop the container first if the DB is root-owned).
set -euo pipefail

DB="${1:-/home/snookie/income-stack/uptime-kuma/data/kuma.db}"

if ! command -v sqlite3 >/dev/null; then
  echo "sqlite3 is required"
  exit 1
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx uptime-kuma; then
  echo "Stopping uptime-kuma so the SQLite DB can be updated..."
  docker stop uptime-kuma >/dev/null
  RESTART=1
else
  RESTART=0
fi

if sqlite3 "$DB" "SELECT slug FROM status_page WHERE slug='upwatch';" | grep -q upwatch; then
  echo "Status page upwatch already exists"
else
  sqlite3 "$DB" <<'SQL'
INSERT INTO status_page (slug, title, description, icon, theme, published, search_engine_index, show_tags, show_powered_by, custom_css)
SELECT 'upwatch', 'UpWatch', 'Public status for upwatch.online', icon, theme, 1, 1, show_tags, show_powered_by, custom_css
FROM status_page WHERE slug='demo';

INSERT INTO "group" (name, weight, status_page_id, public)
SELECT 'UpWatch Services', 1000, (SELECT id FROM status_page WHERE slug='upwatch'), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "group" g
  JOIN status_page sp ON sp.id = g.status_page_id
  WHERE sp.slug = 'upwatch'
);

INSERT INTO monitor_group (monitor_id, group_id, weight, send_url)
SELECT m.id, g.id, 1000, 0
FROM monitor m
CROSS JOIN "group" g
JOIN status_page sp ON sp.id = g.status_page_id
WHERE sp.slug = 'upwatch'
  AND m.active = 1
  AND NOT EXISTS (
    SELECT 1 FROM monitor_group mg WHERE mg.monitor_id = m.id AND mg.group_id = g.id
  );
SQL
  echo "Created status page slug: upwatch"
fi

sqlite3 "$DB" "SELECT id, slug, title FROM status_page WHERE slug IN ('demo','upwatch');"

if [ "$RESTART" = 1 ]; then
  docker start uptime-kuma >/dev/null
  echo "Restarted uptime-kuma"
fi
