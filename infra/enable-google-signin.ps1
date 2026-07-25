# Paste your Supabase secret (service role) key, sync to Cloudflare Worker, rebuild, deploy.
# Get the key: Supabase Dashboard -> Project Settings -> API Keys -> Secret key (sb_secret_...)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$key = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $key) {
  $key = Read-Host "Paste SUPABASE_SERVICE_ROLE_KEY (sb_secret_...)"
}
if (-not $key) {
  Write-Host "Cancelled — no key provided." -ForegroundColor Red
  exit 1
}

$envFile = Join-Path $PWD ".env"
$lines = @()
if (Test-Path $envFile) { $lines = Get-Content $envFile }
$filtered = $lines | Where-Object { $_ -notmatch '^\s*SUPABASE_SERVICE_ROLE_KEY=' }
$filtered += "SUPABASE_SERVICE_ROLE_KEY=`"$key`""
Set-Content -Path $envFile -Value $filtered -Encoding UTF8
Write-Host "Saved SUPABASE_SERVICE_ROLE_KEY to .env" -ForegroundColor Green

$env:SUPABASE_SERVICE_ROLE_KEY = $key
& (Join-Path $PSScriptRoot "sync-worker-secrets.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:VITE_BUILD_SHA = (git rev-parse HEAD 2>$null)
if (-not $env:VITE_BUILD_SHA) { $env:VITE_BUILD_SHA = "local" }
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node -e "const fs=require('fs');const p='.output/server/wrangler.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.name='upwatch';if(j.assets?.directory) j.assets.directory=j.assets.directory.replace(/\\\\/g,'/');fs.writeFileSync(p,JSON.stringify(j,null,2));"
npx wrangler deploy --config .output/server/wrangler.json
Write-Host "Deployed. Try Google sign-in at https://upwatch.online/auth" -ForegroundColor Green
