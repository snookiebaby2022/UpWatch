# Updates Cloudflare DNS for status.upwatch.online (removes wrong Umami target).
# Requires: CLOUDFLARE_API_TOKEN with Zone.DNS Edit, and zone on upwatch.online
#
# Usage:
#   $env:CLOUDFLARE_API_TOKEN = "your-token"
#   $env:CLOUDFLARE_ZONE_ID = "optional-if-auto-lookup-fails"
#   .\fix-status-dns.ps1 -TargetIp "1.2.3.4"          # VPS A record
#   .\fix-status-dns.ps1 -CnameTarget "tunnel-id.cfargotunnel.com"  # Tunnel CNAME

param(
  [string]$Subdomain = "status",
  [string]$RootDomain = "upwatch.online",
  [string]$TargetIp = "",
  [string]$CnameTarget = ""
)

$ErrorActionPreference = "Stop"
$token = $env:CLOUDFLARE_API_TOKEN
if (-not $token) { throw "Set CLOUDFLARE_API_TOKEN environment variable." }

$headers = @{
  Authorization = "Bearer $token"
  "Content-Type" = "application/json"
}

function Invoke-CfApi($Method, $Uri, $Body = $null) {
  $params = @{ Method = $Method; Uri = $Uri; Headers = $headers }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json -Compress) }
  return Invoke-RestMethod @params
}

$zoneId = $env:CLOUDFLARE_ZONE_ID
if (-not $zoneId) {
  $zones = Invoke-CfApi GET "https://api.cloudflare.com/client/v4/zones?name=$RootDomain"
  if (-not $zones.success -or $zones.result.Count -eq 0) {
    throw "Could not find Cloudflare zone for $RootDomain. Set CLOUDFLARE_ZONE_ID."
  }
  $zoneId = $zones.result[0].id
  Write-Host "Zone ID: $zoneId"
}

$fqdn = "$Subdomain.$RootDomain"
$existing = Invoke-CfApi GET "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records?name=$fqdn"
foreach ($rec in $existing.result) {
  Write-Host "Deleting old record: $($rec.type) $($rec.name) -> $($rec.content)"
  Invoke-CfApi DELETE "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records/$($rec.id)" | Out-Null
}

if ($CnameTarget) {
  $body = @{
    type = "CNAME"
    name = $Subdomain
    content = $CnameTarget
    proxied = $true
    ttl = 1
  }
  Invoke-CfApi POST "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records" $body | Out-Null
  Write-Host "Created CNAME $fqdn -> $CnameTarget (proxied)"
} elseif ($TargetIp) {
  $body = @{
    type = "A"
    name = $Subdomain
    content = $TargetIp
    proxied = $true
    ttl = 1
  }
  Invoke-CfApi POST "https://api.cloudflare.com/client/v4/zones/$zoneId/dns_records" $body | Out-Null
  Write-Host "Created A $fqdn -> $TargetIp (proxied)"
} else {
  Write-Host "No TargetIp or CnameTarget given — old records removed only."
  Write-Host "For Cloudflare Tunnel, create the public hostname in Zero Trust (recommended)."
}

Write-Host "Done. Verify: curl -I https://$fqdn/"
