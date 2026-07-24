# Deploy upwatch.online from your machine (when GitHub secrets are not set yet).
# Requires: Node 22+, Cloudflare account with upwatch.online zone.

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "`n=== UpWatch local deploy ===`n" -ForegroundColor Cyan

if (-not (Test-Path .env)) {
    Write-Host "Copy .env.example to .env and fill Supabase + optional Cloudflare vars." -ForegroundColor Yellow
    exit 1
}

Write-Host "Building..." -ForegroundColor Cyan
$env:VITE_BUILD_SHA = (git rev-parse HEAD 2>$null)
if (-not $env:VITE_BUILD_SHA) { $env:VITE_BUILD_SHA = "local" }
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$wranglerConfig = ".output/server/wrangler.json"
if (-not (Test-Path $wranglerConfig)) {
    Write-Host "Build output missing $wranglerConfig" -ForegroundColor Red
    exit 1
}

node -e "const fs=require('fs');const p='.output/server/wrangler.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.name='upwatch';if(j.assets?.directory) j.assets.directory=j.assets.directory.replace(/\\\\/g,'/');fs.writeFileSync(p,JSON.stringify(j,null,2));"

if ($env:CLOUDFLARE_API_TOKEN -and $env:CLOUDFLARE_ACCOUNT_ID) {
    Write-Host "Deploying with CLOUDFLARE_* env vars..." -ForegroundColor Cyan
    npx wrangler deploy --config $wranglerConfig
    exit $LASTEXITCODE
}

Write-Host "No CLOUDFLARE_API_TOKEN in environment." -ForegroundColor Yellow
Write-Host "Run: npx wrangler login" -ForegroundColor Yellow
Write-Host "Then: npx wrangler deploy --config $wranglerConfig" -ForegroundColor Yellow
Write-Host "`nOr add secrets to GitHub — see DEPLOY.md`n" -ForegroundColor Cyan
