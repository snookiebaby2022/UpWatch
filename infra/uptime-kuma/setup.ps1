# Uptime Kuma + optional Cloudflare Tunnel for status.upwatch.online
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env — set CLOUDFLARE_TUNNEL_TOKEN for automatic DNS via Cloudflare Tunnel."
}

$envContent = Get-Content ".env" -Raw
$hasToken = $envContent -match 'CLOUDFLARE_TUNNEL_TOKEN=\S'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker is required. Install Docker Desktop first."
}

if ($hasToken) {
  Write-Host "Starting Uptime Kuma + Cloudflare Tunnel…"
  docker compose --profile cloudflare up -d
} else {
  Write-Host "No tunnel token — starting Kuma on port 3001 only."
  docker compose up -d
}

Write-Host @"

Uptime Kuma admin: http://127.0.0.1:3001

One-time Kuma UI setup:
  1. Create admin account
  2. Status Pages → Add → slug: upwatch
  3. Add monitors (upwatch.online, API, Supabase)
  4. Open https://status.upwatch.online/status/upwatch

Set in Lovable / GitHub Actions secrets:
  KUMA_BASE_URL=https://status.upwatch.online
  KUMA_STATUS_PAGE_SLUG=upwatch
  VITE_KUMA_PUBLIC_URL=https://status.upwatch.online/status/upwatch
"@
