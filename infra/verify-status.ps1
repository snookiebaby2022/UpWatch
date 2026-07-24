# Quick health check for status.upwatch.online + UpWatch /status
$ErrorActionPreference = "Continue"

Write-Host "Checking status.upwatch.online ..."
try {
  $r = Invoke-WebRequest -Uri "https://status.upwatch.online/" -UseBasicParsing -TimeoutSec 10
  $title = if ($r.Content -match "<title>([^<]+)</title>") { $Matches[1] } else { "?" }
  Write-Host "  HTTP $($r.StatusCode) title: $title"
  if ($title -match "Umami") {
    Write-Host "  FAIL: still Umami - run infra/uptime-kuma setup + Cloudflare Tunnel" -ForegroundColor Red
  } elseif ($title -match "Uptime Kuma|Dashboard") {
    Write-Host "  OK: Uptime Kuma" -ForegroundColor Green
  }
} catch {
  Write-Host "  ERROR: $_" -ForegroundColor Red
}

Write-Host "Checking Kuma API ..."
try {
  $api = Invoke-WebRequest -Uri "https://status.upwatch.online/api/status-page/upwatch" -UseBasicParsing -TimeoutSec 10
  Write-Host "  API HTTP $($api.StatusCode) - status page slug upwatch exists" -ForegroundColor Green
} catch {
  Write-Host "  API not ready (create status page slug upwatch in Kuma UI)" -ForegroundColor Yellow
}

Write-Host "Checking upwatch.online/status ..."
try {
  $s = Invoke-WebRequest -Uri "https://upwatch.online/status" -UseBasicParsing -TimeoutSec 15
  Write-Host "  HTTP $($s.StatusCode)"
} catch {
  Write-Host "  ERROR: $_" -ForegroundColor Red
}

Write-Host "Checking upwatch.online admin ..."
try {
  $admin = Invoke-WebRequest -Uri "https://upwatch.online/admin" -UseBasicParsing -TimeoutSec 15
  if ($admin.Content -match "Admin Console v2") {
    Write-Host "  OK: Admin Console v2 deployed" -ForegroundColor Green
  } elseif ($admin.Content -match "Admin Dashboard") {
    Write-Host "  STALE: old admin - Lovable Publish then Update, or enable GitHub deploy" -ForegroundColor Red
  }
} catch {
  Write-Host "  ERROR: $_" -ForegroundColor Red
}
