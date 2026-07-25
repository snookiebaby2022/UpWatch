# Tune HTTP monitors in Uptime Kuma (retries + 30s timeout).
param(
  [int]$MaxRetries = 2,
  [int]$RetryInterval = 20,
  [int]$TimeoutMs = 30000,
  [string]$NexlifyHost = "nexlify.live"
)

$ErrorActionPreference = "Stop"

$DbPaths = @(
  "/home/snookie/income-stack/uptime-kuma/data/kuma.db",
  "/home/snookie/upwatch-kuma/data/kuma.db",
  "/var/lib/docker/volumes/uptime-kuma_kuma-data/_data/kuma.db",
  "./data/kuma.db"
)

$db = $DbPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $db) {
  Write-Host "kuma.db not found. Run fix-http-monitors.sh on the Pi instead." -ForegroundColor Yellow
  exit 1
}

Write-Host "Using database: $db" -ForegroundColor Cyan
docker stop upwatch-uptime-kuma 2>$null
docker stop uptime-kuma 2>$null

$sql = @"
UPDATE monitor SET maxretries=$MaxRetries, retry_interval=$RetryInterval, timeout=$TimeoutMs
WHERE type IN ('http','keyword','json-query') AND active=1;
UPDATE monitor SET maxretries=$MaxRetries, retry_interval=$RetryInterval, timeout=$TimeoutMs
WHERE (name LIKE '%Nexlify%' OR url LIKE '%$NexlifyHost%') AND type NOT IN ('push');
SELECT id, name, type, url, maxretries, retry_interval, timeout FROM monitor WHERE active=1 AND type NOT IN ('push');
"@

if (Get-Command sqlite3 -ErrorAction SilentlyContinue) {
  $sql | sqlite3 -header $db
} else {
  docker run --rm -v "${db}:/data/kuma.db" keinos/sqlite3 sqlite3 -header /data/kuma.db ($sql -replace "`n", " ")
}

docker start upwatch-uptime-kuma 2>$null
docker start uptime-kuma 2>$null
Write-Host "Done." -ForegroundColor Green
