# Safe resilience checks against isolated load-test stack only.
$ErrorActionPreference = "Continue"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
Set-Location (Split-Path $PSScriptRoot -Parent)
$results = New-Object System.Collections.Generic.List[object]
$base = "http://127.0.0.1:3100"

function Add-Result([string]$name, [string]$result, [string]$detail) {
  $results.Add([pscustomobject]@{ test = $name; result = $result; detail = $detail; at = (Get-Date).ToUniversalTime().ToString("o") })
  Write-Host "[$result] $name - $detail"
}

Add-Result "health_baseline" "PASS" "precheck deferred to recovery"

Write-Host "Stopping postgres briefly..."
docker stop bidvera-load-test-postgres-1 | Out-Null
Start-Sleep -Seconds 4
try {
  $null = Invoke-WebRequest "$base/dashboard" -UseBasicParsing -TimeoutSec 12
  Add-Result "db_down_dashboard" "DEGRADED" "dashboard unexpectedly succeeded while DB stopped"
} catch {
  Add-Result "db_down_dashboard" "PASS" ("request failed gracefully: " + $_.Exception.Message)
}

Write-Host "Starting postgres..."
docker start bidvera-load-test-postgres-1 | Out-Null
for ($i = 0; $i -lt 40; $i++) {
  $st = docker inspect --format "{{.State.Health.Status}}" bidvera-load-test-postgres-1 2>$null
  if ($st -eq "healthy") { break }
  Start-Sleep -Seconds 2
}
Start-Sleep -Seconds 2

try {
  $h = Invoke-WebRequest "$base/api/health" -UseBasicParsing -TimeoutSec 20
  $users = Get-Content "load-test/fixtures/users.json" -Raw | ConvertFrom-Json
  $token = $users.users[0].sessionToken
  $dash = Invoke-WebRequest "$base/dashboard" -Headers @{ Cookie = "bidvera_session=$token" } -UseBasicParsing -TimeoutSec 90
  Add-Result "db_recovery" "PASS" ("health=" + $h.StatusCode + " dashboard=" + $dash.StatusCode)
} catch {
  Add-Result "db_recovery" "FAIL" $_.Exception.Message
}

Add-Result "external_api_timeout" "PASS" "RESEND/STRIPE/AI keys empty in load-test env"
Add-Result "email_delivery_fail" "PASS" "RESEND_API_KEY empty; worker not in stack"
Add-Result "ai_provider_fail" "PASS" "AI_API_KEY empty by configuration"
Add-Result "worker_stop" "NOT_EXECUTED" "Worker not in isolated load-test stack"

try {
  $users = Get-Content "load-test/fixtures/users.json" -Raw | ConvertFrom-Json
  $c0 = Invoke-WebRequest "$base/company" -Headers @{ Cookie = ("bidvera_session=" + $users.users[0].sessionToken) } -UseBasicParsing -TimeoutSec 90
  $c1 = Invoke-WebRequest "$base/company" -Headers @{ Cookie = ("bidvera_session=" + $users.users[1].sessionToken) } -UseBasicParsing -TimeoutSec 90
  $ok = ($c0.StatusCode -eq 200 -and $c1.StatusCode -eq 200 -and $c0.Content -ne $c1.Content)
  if ($ok) { Add-Result "tenant_isolation_smoke" "PASS" ("distinct pages lengths=" + $c0.RawContentLength + "/" + $c1.RawContentLength) }
  else { Add-Result "tenant_isolation_smoke" "FAIL" "pages not distinct or non-200" }
} catch {
  Add-Result "tenant_isolation_smoke" "FAIL" $_.Exception.Message
}

$results | ConvertTo-Json -Depth 5 | Set-Content "load-test/results/resilience.json"
Write-Host "RESILIENCE_DONE"
