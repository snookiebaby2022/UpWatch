# Force-configure Google OAuth on hosted Supabase when the dashboard save does not stick.
# Requires a Supabase personal access token (NOT the service role key).

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$projectRef = "vepgivwmulpdacsfucmn"
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
$clientSecret = $env:GOOGLE_CLIENT_SECRET

if (-not $token) {
  Write-Host "Missing SUPABASE_ACCESS_TOKEN." -ForegroundColor Red
  Write-Host "Create one at: https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
  Write-Host 'Then: $env:SUPABASE_ACCESS_TOKEN="sbp_..."; $env:GOOGLE_CLIENT_ID="....apps.googleusercontent.com"; $env:GOOGLE_CLIENT_SECRET="GOCSPX-..."; .\infra\configure-google-oauth.ps1' -ForegroundColor Yellow
  exit 1
}
if (-not $clientId -or -not $clientSecret) {
  Write-Host "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET." -ForegroundColor Red
  Write-Host "Get them from Google Cloud -> APIs & Services -> Credentials -> OAuth 2.0 Client (Web application)." -ForegroundColor Yellow
  Write-Host "Authorized redirect URI in Google must be:" -ForegroundColor Yellow
  Write-Host "  https://$projectRef.supabase.co/auth/v1/callback" -ForegroundColor Cyan
  exit 1
}

$body = @{
  external_google_enabled   = $true
  external_google_client_id = $clientId
  external_google_secret    = $clientSecret
} | ConvertTo-Json

Write-Host "Patching Supabase auth config for project $projectRef..." -ForegroundColor Cyan
try {
  $resp = Invoke-RestMethod `
    -Method Patch `
    -Uri "https://api.supabase.com/v1/projects/$projectRef/config/auth" `
    -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } `
    -Body $body
  Write-Host "Management API accepted the update." -ForegroundColor Green
} catch {
  Write-Host "Management API error:" -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message -ForegroundColor Red }
  else { Write-Host $_.Exception.Message -ForegroundColor Red }
  exit 1
}

Start-Sleep -Seconds 2

Write-Host "`nVerifying Google authorize endpoint..." -ForegroundColor Cyan
$publishable = $env:SUPABASE_PUBLISHABLE_KEY
if (-not $publishable) { $publishable = "sb_publishable_DN7TI6X612A8S8FwSLw2qA_PEQTMHHW" }

$verify = curl.exe -s -o NUL -w "%{http_code}" `
  "https://$projectRef.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fupwatch.online%2Fdashboard" `
  -H "apikey: $publishable"

if ($verify -eq "302" -or $verify -eq "303") {
  Write-Host "Google OAuth is configured (authorize returns redirect $verify)." -ForegroundColor Green
  Write-Host "Try https://upwatch.online/auth -> Continue with Google" -ForegroundColor Green
  exit 0
}

Write-Host "Still failing (HTTP $verify). Response body:" -ForegroundColor Red
curl.exe -s `
  "https://$projectRef.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fupwatch.online%2Fdashboard" `
  -H "apikey: $publishable"
Write-Host ""
Write-Host "Double-check Client ID/Secret and that Google redirect URI matches Supabase callback." -ForegroundColor Yellow
exit 1
