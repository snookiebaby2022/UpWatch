# Sync Supabase + runtime secrets to the upwatch Cloudflare Worker.
# Reads from .env in repo root. Never prints secret values.

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

if (-not $env:SUPABASE_SERVICE_ROLE_KEY -and $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Fetching secret API key from Supabase Management API..." -ForegroundColor Cyan
  $headers = @{ Authorization = "Bearer $($env:SUPABASE_ACCESS_TOKEN)" }
  $ref = if ($env:SUPABASE_PROJECT_ID) { $env:SUPABASE_PROJECT_ID } else { "vepgivwmulpdacsfucmn" }
  $keys = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$ref/api-keys?reveal=true" -Headers $headers
  $secret = $keys | Where-Object { $_.type -eq "secret" -or $_.name -match "secret|service_role" } | Select-Object -First 1
  if ($secret.api_key) {
    $env:SUPABASE_SERVICE_ROLE_KEY = $secret.api_key
    Write-Host "  Got secret key from Management API" -ForegroundColor Green
  }
}

if (-not $env:SUPABASE_URL) { $env:SUPABASE_URL = $env:VITE_SUPABASE_URL }
if (-not $env:SUPABASE_PUBLISHABLE_KEY) { $env:SUPABASE_PUBLISHABLE_KEY = $env:VITE_SUPABASE_PUBLISHABLE_KEY }

if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
  Write-Host "Missing SUPABASE_SERVICE_ROLE_KEY." -ForegroundColor Red
  Write-Host "Add it to .env or set SUPABASE_ACCESS_TOKEN (Owner PAT) to fetch automatically." -ForegroundColor Yellow
  exit 1
}

$wranglerConfig = ".output/server/wrangler.json"
if (-not (Test-Path $wranglerConfig)) {
  Write-Host "Building first..." -ForegroundColor Cyan
  npm run build | Out-Null
  node -e "const fs=require('fs');const p='.output/server/wrangler.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.name='upwatch';if(j.assets?.directory) j.assets.directory=j.assets.directory.replace(/\\\\/g,'/');fs.writeFileSync(p,JSON.stringify(j,null,2));"
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
    $val | npx wrangler secret put $_ --config $wranglerConfig 2>&1 | Out-Null
    Write-Host "  $_ set" -ForegroundColor Green
  }
}

Write-Host "Done." -ForegroundColor Green
