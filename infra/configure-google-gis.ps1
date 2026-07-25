# Configure Google for GIS / signInWithIdToken (Client ID + skip nonce check).
# Does NOT require Client Secret. Needs Supabase personal access token with Owner role.

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$projectRef = if ($env:SUPABASE_PROJECT_ID) { $env:SUPABASE_PROJECT_ID } else { "zjijihumvmijnijpkwpz" }
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

$token = $env:SUPABASE_ACCESS_TOKEN
$clientId = $env:GOOGLE_CLIENT_ID
if (-not $clientId) { $clientId = $env:VITE_GOOGLE_CLIENT_ID }

if (-not $token) {
  Write-Host "Missing SUPABASE_ACCESS_TOKEN." -ForegroundColor Red
  Write-Host "Create one at: https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
  exit 1
}
if (-not $clientId) {
  Write-Host "Missing GOOGLE_CLIENT_ID (Web OAuth client .apps.googleusercontent.com)." -ForegroundColor Red
  exit 1
}

$body = @{
  external_google_enabled                  = $true
  external_google_client_id                = $clientId
  external_google_additional_client_ids    = $clientId
  external_google_skip_nonce_check         = $true
} | ConvertTo-Json

Write-Host "Configuring Google GIS auth for $projectRef..." -ForegroundColor Cyan
try {
  Invoke-RestMethod `
    -Method Patch `
    -Uri "https://api.supabase.com/v1/projects/$projectRef/config/auth" `
    -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } `
    -Body $body | Out-Null
  Write-Host "Done. Google Client ID saved + Skip nonce check enabled." -ForegroundColor Green
  Write-Host "Also verify Google Cloud -> OAuth client -> Authorized JavaScript origins:" -ForegroundColor Yellow
  Write-Host "  https://upwatch.online" -ForegroundColor Cyan
  Write-Host "  https://www.upwatch.online" -ForegroundColor Cyan
} catch {
  Write-Host "Management API error (need project Owner/Administrator):" -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message -ForegroundColor Red }
  else { Write-Host $_.Exception.Message -ForegroundColor Red }
  Write-Host "`nManual fix: Supabase Dashboard -> Auth -> Providers -> Google" -ForegroundColor Yellow
  Write-Host "  1. Paste Client ID: $clientId" -ForegroundColor Yellow
  Write-Host "  2. Enable 'Skip nonce check'" -ForegroundColor Yellow
  exit 1
}
