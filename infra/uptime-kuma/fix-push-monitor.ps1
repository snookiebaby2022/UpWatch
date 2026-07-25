# Fix Uptime Kuma push monitor URL when the UI won't save it.
# Run on the machine hosting Kuma (Pi/VPS), or via SSH:
#   ssh snookie@your-pi "bash -s" < infra/uptime-kuma/fix-push-monitor.sh

$ErrorActionPreference = "Stop"

$PushUrl = "https://status.upwatch.online/api/push/5pyQgQR1m8"
$DbPaths = @(
  "/home/snookie/income-stack/uptime-kuma/data/kuma.db",
  "/var/lib/docker/volumes/uptime-kuma_kuma-data/_data/kuma.db",
  "./data/kuma.db"
)

$db = $DbPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $db) {
  Write-Host "kuma.db not found. Run fix-push-monitor.sh on the Pi instead:" -ForegroundColor Yellow
  Write-Host "  bash infra/uptime-kuma/fix-push-monitor.sh" -ForegroundColor Yellow
  exit 1
}

Write-Host "Using database: $db" -ForegroundColor Cyan
docker stop upwatch-uptime-kuma 2>$null
docker stop uptime-kuma 2>$null

$sql = @"
UPDATE monitor SET url='$PushUrl' WHERE type='push' OR push_token IS NOT NULL OR url LIKE '%/api/push/%';
SELECT id, name, type, url, push_token FROM monitor WHERE type='push' OR push_token IS NOT NULL;
"@

if (Get-Command sqlite3 -ErrorAction SilentlyContinue) {
  $sql | sqlite3 $db
} else {
  docker run --rm -v "${db}:/data/kuma.db" keinos/sqlite3 sqlite3 /data/kuma.db $sql.Replace("`n", " ")
}

docker start upwatch-uptime-kuma 2>$null
docker start uptime-kuma 2>$null
Write-Host "Done. Push URL set to: $PushUrl" -ForegroundColor Green
