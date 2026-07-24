# One-shot: apply Supabase SQL + bootstrap admin user on live worker.
# Requires: wrangler logged in, SUPABASE_SERVICE_ROLE_KEY in .env or env var.

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$envFile = Join-Path $PWD ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim().Trim('"')
      if (-not [string]::IsNullOrWhiteSpace($name)) { Set-Item -Path "env:$name" -Value $value }
    }
  }
}

if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
  Write-Host "Missing SUPABASE_SERVICE_ROLE_KEY." -ForegroundColor Red
  Write-Host "Get it from Supabase -> Project Settings -> API -> service_role (secret)" -ForegroundColor Yellow
  Write-Host "Then: `$env:SUPABASE_SERVICE_ROLE_KEY='sb_secret_...'; .\infra\bootstrap-supabase.ps1" -ForegroundColor Yellow
  exit 1
}

Write-Host "Setting Worker secrets on upwatch..." -ForegroundColor Cyan
@(
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "KUMA_BASE_URL",
  "KUMA_STATUS_PAGE_SLUG"
) | ForEach-Object {
  $val = (Get-Item "env:$_" -ErrorAction SilentlyContinue).Value
  if ($val) {
    $val | npx wrangler secret put $_ --name upwatch 2>&1 | Out-Null
    Write-Host "  $_ set" -ForegroundColor Green
  }
}

Write-Host "`nBuilding and deploying..." -ForegroundColor Cyan
$env:VITE_BUILD_SHA = (git rev-parse HEAD 2>$null)
if (-not $env:VITE_BUILD_SHA) { $env:VITE_BUILD_SHA = "bootstrap" }
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node -e "const fs=require('fs');const p='.output/server/wrangler.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.name='upwatch';j.routes=[{pattern:'upwatch.online/*',zone_name:'upwatch.online'},{pattern:'www.upwatch.online/*',zone_name:'upwatch.online'}];if(j.assets?.directory) j.assets.directory=j.assets.directory.replace(/\\\\/g,'/');fs.writeFileSync(p,JSON.stringify(j,null,2));"

npx wrangler deploy --config .output/server/wrangler.json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nCalling bootstrap API..." -ForegroundColor Cyan
$resp = curl.exe -s -X POST "https://upwatch.online/api/public/setup/bootstrap?token=upwatch-fix-2026"
Write-Host $resp

Write-Host "`nDone. Sign in: https://upwatch.online/auth" -ForegroundColor Green
Write-Host "Email: snookiebaby2022@gmail.com" -ForegroundColor Green
Write-Host "Password: UpWatch2026!Admin (change after login)" -ForegroundColor Green
