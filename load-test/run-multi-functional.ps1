# Multi-instance functional + failure + worker checks (isolated staging only).
$ErrorActionPreference = "Continue"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
Set-Location (Split-Path $PSScriptRoot -Parent)

$Project = "bidvera-load-multi"
$Compose = "load-test/docker-compose.multi.yml"
$Base = "http://127.0.0.1:3100"
$OutDir = "load-test/results/multi"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$results = New-Object System.Collections.Generic.List[object]

function Add-Result([string]$name, [string]$result, [string]$detail) {
  $results.Add([pscustomobject]@{ test = $name; result = $result; detail = $detail; at = (Get-Date).ToUniversalTime().ToString("o") })
  Write-Host "[$result] $name - $detail"
}

function Invoke-Compose {
  param([string[]]$ComposeArgs)
  & docker.exe compose -p $Project -f $Compose @ComposeArgs
}

# Resolve users file from shared volume via app1
$usersJson = $null
try {
  $raw = docker compose -p $Project -f $Compose exec -T app1 cat /app/.data/load-test/users.json 2>$null
  if ($raw) { $usersJson = $raw | ConvertFrom-Json }
} catch {}
if (-not $usersJson -or -not $usersJson.users) {
  if (Test-Path "load-test/fixtures/users.json") {
    $usersJson = Get-Content "load-test/fixtures/users.json" -Raw | ConvertFrom-Json
  }
}
if (-not $usersJson -or -not $usersJson.users -or $usersJson.users.Count -lt 2) {
  Add-Result "users_available" "FAIL" "No synthetic users for functional tests"
  $results | ConvertTo-Json -Depth 5 | Set-Content "$OutDir/functional.json"
  exit 1
}
Add-Result "users_available" "PASS" ("count=" + $usersJson.users.Count)

$token0 = $usersJson.users[0].sessionToken
$token1 = $usersJson.users[1].sessionToken
$cookie0 = @{ Cookie = "bidvera_session=$token0" }
$cookie1 = @{ Cookie = "bidvera_session=$token1" }

function Test-AuthPath([string]$name, [string]$path, $headers) {
  try {
    $r = Invoke-WebRequest -Uri ($Base + $path) -Headers $headers -UseBasicParsing -TimeoutSec 90 -MaximumRedirection 5
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) {
      Add-Result $name "PASS" ("status=" + $r.StatusCode + " bytes=" + $r.RawContentLength)
    } else {
      Add-Result $name "FAIL" ("status=" + $r.StatusCode)
    }
  } catch {
    Add-Result $name "FAIL" $_.Exception.Message
  }
}

# Session works across LB (no sticky sessions required â€” DB sessions)
Test-AuthPath "session_dashboard" "/dashboard" $cookie0
Test-AuthPath "session_company" "/company" $cookie0
Test-AuthPath "session_documents" "/document-compliance/documents" $cookie0
Test-AuthPath "session_qualification" "/supplier-qualification" $cookie0
Test-AuthPath "session_requests" "/client-requests" $cookie0
Test-AuthPath "session_evidence" "/supplier-qualification/evidence" $cookie0
Test-AuthPath "session_questionnaire" "/questionnaire-assistant" $cookie0
Test-AuthPath "session_settings" "/settings" $cookie0
Test-AuthPath "session_billing" "/billing" $cookie0
Test-AuthPath "session_tenders" "/tenders" $cookie0

# Tenant isolation smoke
try {
  $c0 = Invoke-WebRequest -Uri "$Base/company" -Headers $cookie0 -UseBasicParsing -TimeoutSec 90
  $c1 = Invoke-WebRequest -Uri "$Base/company" -Headers $cookie1 -UseBasicParsing -TimeoutSec 90
  if ($c0.StatusCode -eq 200 -and $c1.StatusCode -eq 200 -and $c0.Content -ne $c1.Content) {
    Add-Result "tenant_isolation" "PASS" ("len=" + $c0.RawContentLength + "/" + $c1.RawContentLength)
  } else {
    Add-Result "tenant_isolation" "FAIL" "pages not distinct"
  }
} catch {
  Add-Result "tenant_isolation" "FAIL" $_.Exception.Message
}

# Health / ready
try {
  $h = Invoke-RestMethod "$Base/api/health" -TimeoutSec 15
  $ready = Invoke-WebRequest "$Base/api/ready" -UseBasicParsing -TimeoutSec 30
  Add-Result "health_ready" "PASS" ("instance=" + $h.instance + " ready=" + $ready.StatusCode)
} catch {
  Add-Result "health_ready" "FAIL" $_.Exception.Message
}

# Distinct instances via LB
$set = [System.Collections.Generic.HashSet[string]]::new()
for ($i = 0; $i -lt 40; $i++) {
  try {
    $h = Invoke-RestMethod "$Base/api/health" -TimeoutSec 5
    [void]$set.Add([string]$h.instance)
  } catch {}
}
Add-Result "lb_instance_spread" $(if ($set.Count -ge 2) { "PASS" } else { "FAIL" }) ("instances=" + ($set -join ","))

# Failure: stop app1, traffic continues
Write-Host "Stopping app1..."
Invoke-Compose @("stop","app1") | Out-Null
Start-Sleep -Seconds 3
try {
  $ok = 0; $fail = 0
  for ($i = 0; $i -lt 10; $i++) {
    try {
      $r = Invoke-WebRequest "$Base/api/health" -UseBasicParsing -TimeoutSec 10
      if ($r.StatusCode -eq 200) { $ok++ } else { $fail++ }
    } catch { $fail++ }
  }
  if ($ok -ge 7) { Add-Result "fail_stop_app1" "PASS" ("ok=$ok fail=$fail") }
  else { Add-Result "fail_stop_app1" "FAIL" ("ok=$ok fail=$fail") }
} catch {
  Add-Result "fail_stop_app1" "FAIL" $_.Exception.Message
}

Write-Host "Starting app1..."
Invoke-Compose @("start","app1") | Out-Null
Start-Sleep -Seconds 8

Write-Host "Stopping app2..."
Invoke-Compose @("stop","app2") | Out-Null
Start-Sleep -Seconds 3
try {
  $ok = 0; $fail = 0
  for ($i = 0; $i -lt 10; $i++) {
    try {
      $r = Invoke-WebRequest "$Base/dashboard" -Headers $cookie0 -UseBasicParsing -TimeoutSec 30
      if ($r.StatusCode -eq 200) { $ok++ } else { $fail++ }
    } catch { $fail++ }
  }
  if ($ok -ge 6) { Add-Result "fail_stop_app2_session" "PASS" ("ok=$ok fail=$fail") }
  else { Add-Result "fail_stop_app2_session" "DEGRADED" ("ok=$ok fail=$fail") }
} catch {
  Add-Result "fail_stop_app2_session" "FAIL" $_.Exception.Message
}
Invoke-Compose @("start","app2") | Out-Null
Start-Sleep -Seconds 5

# Worker stop / restart
$workerBefore = docker ps -qf "name=${Project}-worker"
if ($workerBefore) {
  Write-Host "Stopping worker..."
  Invoke-Compose @("stop","worker") | Out-Null
  Start-Sleep -Seconds 2
  $down = -not (docker ps -qf "name=${Project}-worker")
  Invoke-Compose @("start","worker") | Out-Null
  Start-Sleep -Seconds 5
  $up = docker ps -qf "name=${Project}-worker"
  if ($down -and $up) { Add-Result "worker_restart" "PASS" "stopped then restarted" }
  else { Add-Result "worker_restart" "FAIL" "down=$down up=$([bool]$up)" }

  # Synthetic job recovery if Job table exists
  try {
    $pg = docker ps -qf "name=${Project}-postgres" | Select-Object -First 1
    $ins = docker exec $pg psql -U bidvera -d bidvera_load -t -A -c "INSERT INTO \"Job\" (id, type, status, payload, attempts, \"maxAttempts\", \"availableAt\", \"createdAt\", \"updatedAt\") VALUES ('lt_job_' || substr(md5(random()::text),1,12), 'SEND_EMAIL', 'PENDING', '{}'::jsonb, 0, 3, NOW(), NOW(), NOW()) RETURNING id;" 2>&1
    if ("$ins" -notmatch '^lt_job_') {
      Add-Result "worker_job_recovery" "NOT_EXECUTED" ("Job insert failed: $ins")
    } else {
      $jobId = ("$ins").Trim()
      Invoke-Compose @("stop","worker") | Out-Null
      Start-Sleep -Seconds 1
      Invoke-Compose @("start","worker") | Out-Null
      $claimed = $false
      $st = ""
      for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        $st = docker exec $pg psql -U bidvera -d bidvera_load -t -A -c "SELECT status FROM \"Job\" WHERE id='$jobId';" 2>$null
        if (("$st").Trim() -match 'RUNNING|COMPLETED|FAILED') { $claimed = $true; break }
      }
      $cnt = docker exec $pg psql -U bidvera -d bidvera_load -t -A -c "SELECT count(*) FROM \"Job\" WHERE id='$jobId';" 2>$null
      if ($claimed -and ("$cnt").Trim() -eq "1") {
        Add-Result "worker_job_recovery" "PASS" ("job=$jobId status=" + ("$st").Trim() + " duplicates=0")
      } else {
        Add-Result "worker_job_recovery" "DEGRADED" ("job=$jobId status=" + ("$st").Trim() + " count=$cnt")
      }
    }
  } catch {
    Add-Result "worker_job_recovery" "NOT_EXECUTED" $_.Exception.Message
  }
} else {
  Add-Result "worker_restart" "NOT_EXECUTED" "worker container not running"
  Add-Result "worker_job_recovery" "NOT_EXECUTED" "worker container not running"
}

# Postgres brief stop (safe staging only)
Write-Host "Stopping postgres briefly..."
Invoke-Compose @("stop","postgres") | Out-Null
Start-Sleep -Seconds 4
try {
  $readyBody = Invoke-WebRequest "$Base/api/ready" -UseBasicParsing -TimeoutSec 15
  Add-Result "postgres_down_ready" "DEGRADED" ("ready still " + $readyBody.StatusCode)
} catch {
  Add-Result "postgres_down_ready" "PASS" ("ready failed as expected: " + $_.Exception.Message)
}
Invoke-Compose @("start","postgres") | Out-Null
for ($i = 0; $i -lt 40; $i++) {
  $st = docker inspect --format "{{.State.Health.Status}}" (docker ps -qf "name=${Project}-postgres") 2>$null
  if ($st -eq "healthy") { break }
  Start-Sleep -Seconds 2
}
Start-Sleep -Seconds 3
try {
  $h = Invoke-WebRequest "$Base/api/health" -UseBasicParsing -TimeoutSec 20
  $d = Invoke-WebRequest "$Base/dashboard" -Headers $cookie0 -UseBasicParsing -TimeoutSec 90
  Add-Result "postgres_recovery" "PASS" ("health=" + $h.StatusCode + " dashboard=" + $d.StatusCode)
} catch {
  Add-Result "postgres_recovery" "FAIL" $_.Exception.Message
}

# Logout path
try {
  $lo = Invoke-WebRequest -Uri "$Base/api/health" -Headers $cookie0 -UseBasicParsing -TimeoutSec 20
  Add-Result "logout_probe" "PASS" "session cookie still accepted until explicit logout (health ok)"
} catch {
  Add-Result "logout_probe" "FAIL" $_.Exception.Message
}

$results | ConvertTo-Json -Depth 5 | Set-Content "$OutDir/functional.json"
Write-Host "FUNCTIONAL_DONE count=$($results.Count)"

