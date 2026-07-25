#!/usr/bin/env bash
# Re-sync all active Kuma monitors onto the public "upwatch" status page.
# Run on the Kuma host after adding new demo monitors in the dashboard:
#   bash infra/uptime-kuma/create-upwatch-status-page.sh
# New HTTP monitors get send_url=1 so URLs appear on upwatch.online homepage demo.
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

if ! sqlite3 "$DB" "SELECT slug FROM status_page WHERE slug='upwatch';" | grep -q upwatch; then
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
SQL
  echo "Created status page slug: upwatch"
else
  echo "Status page upwatch already exists — syncing monitors"
fi

sqlite3 "$DB" <<'SQL'
INSERT INTO monitor_group (monitor_id, group_id, weight, send_url)
SELECT m.id, g.id, 1000, CASE WHEN m.type IN ('http', 'https') THEN 1 ELSE 0 END
FROM monitor m
CROSS JOIN "group" g
JOIN status_page sp ON sp.id = g.status_page_id
WHERE sp.slug = 'upwatch'
  AND m.active = 1
  AND m.type != 'push'
  AND NOT EXISTS (
    SELECT 1 FROM monitor_group mg WHERE mg.monitor_id = m.id AND mg.group_id = g.id
  );

UPDATE monitor_group
SET send_url = 1
WHERE group_id = (SELECT g.id FROM "group" g JOIN status_page sp ON sp.id = g.status_page_id WHERE sp.slug = 'upwatch')
  AND monitor_id IN (SELECT id FROM monitor WHERE type IN ('http', 'https') AND active = 1);
SQL

sqlite3 "$DB" "SELECT id, slug, title FROM status_page WHERE slug IN ('demo','upwatch');"
sqlite3 "$DB" "SELECT m.id, m.name, m.type FROM monitor m JOIN monitor_group mg ON mg.monitor_id = m.id JOIN \"group\" g ON g.id = mg.group_id JOIN status_page sp ON sp.id = g.status_page_id WHERE sp.slug = 'upwatch' ORDER BY m.name;"

if [ "$RESTART" = 1 ]; then
  docker start uptime-kuma >/dev/null
  echo "Restarted uptime-kuma"
fi
