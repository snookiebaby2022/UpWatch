# Verify UpWatch production APIs and integrations
# Usage: .\infra\verify-apis.ps1

$ErrorActionPreference = "Continue"
$fail = 0

function Test-Endpoint {
    param([string]$Name, [string]$Url, [string]$Expect = "")
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15 -MaximumRedirection 5
        $body = $r.Content
        if ($Expect -and $body -notmatch $Expect) {
            Write-Host "  FAIL: $Name - HTTP $($r.StatusCode) but body missing '$Expect'" -ForegroundColor Red
            $script:fail++
            return
        }
        Write-Host "  OK:   $Name - HTTP $($r.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: $Name - $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
    }
}

Write-Host "`n=== UpWatch API / integration checks ===`n" -ForegroundColor Cyan

Test-Endpoint -Name "Kuma push API" -Url 'https://status.upwatch.online/api/push/5pyQgQR1m8?status=up&msg=OK&ping=' -Expect '"ok":true'
Test-Endpoint -Name "Kuma status page API" -Url "https://status.upwatch.online/api/status-page/upwatch" -Expect "publicGroupList"
Test-Endpoint -Name "UpWatch /status" -Url "https://upwatch.online/status" -Expect "UpWatch"

try {
    $admin = Invoke-WebRequest -Uri "https://upwatch.online/admin" -UseBasicParsing -TimeoutSec 15
    if ($admin.Content -match "admin-CSNh4NuS") {
        Write-Host "  STALE: Admin page - still old Lovable bundle (admin-CSNh4NuS.js)" -ForegroundColor Red
        Write-Host "         Deploy via GitHub Actions (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)" -ForegroundColor Yellow
        $fail++
    } elseif ($admin.Content -match "admin-") {
        Write-Host "  OK:   Admin page bundle present (check Admin Console v2 in browser)" -ForegroundColor Green
    } else {
        Write-Host "  WARN: Admin page - could not detect bundle hash" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  FAIL: Admin page - $($_.Exception.Message)" -ForegroundColor Red
    $fail++
}

try {
    $headers = @{ "Content-Type" = "application/json"; "apikey" = "sb_publishable_DN7TI6X612A8S8FwSLw2qA_PEQTMHHW" }
    $r = Invoke-RestMethod -Uri "https://upwatch.online/api/public/hooks/run-monitors" -Method POST -Headers $headers -Body "{}" -TimeoutSec 30
    if ($r.ok) {
        Write-Host "  OK:   run-monitors cron hook - checked $($r.checked) monitors" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: run-monitors - unexpected response" -ForegroundColor Red
        $fail++
    }
} catch {
    $msg = $_.Exception.Message
    if ($msg -match "401|unauthorized") {
        Write-Host "  STALE: run-monitors - unauthorized (production not deployed from GitHub)" -ForegroundColor Red
        $fail++
    } else {
        Write-Host "  FAIL: run-monitors - $msg" -ForegroundColor Red
        $fail++
    }
}

Write-Host ""
if ($fail -eq 0) {
    Write-Host "All checks passed." -ForegroundColor Green
    exit 0
} else {
    Write-Host "$fail check(s) failed - see above." -ForegroundColor Red
    exit 1
}
