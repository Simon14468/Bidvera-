# Multi-instance staging validation orchestrator.
# Targets ONLY load-test/docker-compose.multi.yml (Nginx → 3 apps → Postgres + worker).
# NEVER points at Neon / production.

param(
  [string]$BaseUrl = "http://127.0.0.1:3100",
  [string]$ComposeFile = "load-test/docker-compose.multi.yml",
  [string]$ResultsDir = "load-test/results/multi",
  [string]$ProjectName = "bidvera-load-multi"
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
$repoRoot = if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { Get-Location }
Set-Location $repoRoot
New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

if ($BaseUrl -match 'neon\.tech|bidvera\.com|vercel\.app') { throw "Refusing remote/production BASE_URL=$BaseUrl" }

function Invoke-Compose {
  # Do not use ValueFromRemainingArguments — PowerShell steals -e as -ErrorAction.
  param([string[]]$ComposeArgs)
  & docker.exe compose -p $ProjectName -f $ComposeFile @ComposeArgs
  return $LASTEXITCODE
}

function Get-PgContainer {
  $id = (docker ps -qf "name=${ProjectName}-postgres" | Select-Object -First 1)
  if (-not $id) { throw "Postgres container not found for project $ProjectName" }
  return $id
}

function Get-MultiMetrics {
  $pgId = Get-PgContainer
  $pg = docker stats $pgId --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}" 2>$null
  $conn = docker exec $pgId psql -U bidvera -d bidvera_load -t -A -c "SELECT count(*) FROM pg_stat_activity WHERE datname='bidvera_load';" 2>$null
  $apps = @("app1","app2","app3") | ForEach-Object {
    $cid = docker ps -qf "name=${ProjectName}-$_" | Select-Object -First 1
    if ($cid) {
      $s = docker stats $cid --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}" 2>$null
      $s
    }
  }
  $workerCid = docker ps -qf "name=${ProjectName}-worker" | Select-Object -First 1
  $worker = if ($workerCid) { docker stats $workerCid --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}" 2>$null } else { "DOWN" }
  return [pscustomobject]@{
    ts = (Get-Date).ToUniversalTime().ToString("o")
    pgStats = "$pg"
    dbConnections = ("$conn").Trim()
    appStats = @($apps)
    workerStats = "$worker"
  }
}

function Get-FreeRamMb {
  return [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024, 0)
}

function Invoke-MultiK6 {
  param(
    [string]$Name,
    [int]$MaxVus,
    [int]$HoldSeconds,
    [int]$MinFreeMb = 1200,
    [string]$Script = "journeys.js"
  )

  $freeMb = Get-FreeRamMb
  Write-Host "`n=== MULTI $Name MAX_VUS=$MaxVus HOLD=${HoldSeconds}s freeRAM=${freeMb}MB ==="
  if ($freeMb -lt $MinFreeMb) {
    $skip = @{
      test = $Name
      virtualUsers = $MaxVus
      result = "NOT_EXECUTED"
      reason = "Host free RAM ${freeMb}MB below ${MinFreeMb}MB safety floor"
    }
    $skip | ConvertTo-Json | Set-Content -Path (Join-Path $ResultsDir "$Name.json")
    Write-Host ($skip | ConvertTo-Json -Compress)
    return $skip
  }

  $before = Get-MultiMetrics
  $summaryPath = Join-Path $ResultsDir "$Name-k6-summary.json"
  $rawPath = Join-Path $ResultsDir "$Name-k6-raw.json"
  $metricsPath = Join-Path $ResultsDir "$Name-host-metrics.jsonl"
  if (Test-Path $metricsPath) { Remove-Item $metricsPath }

  $sampleCount = [math]::Max(6, [int](($HoldSeconds + 180) / 10))
  $samplerScript = @'
param($Out,$Interval,$Count,$Project)
for ($i = 1; $i -le $Count; $i++) {
  $pgId = docker ps -qf "name=$Project-postgres" | Select-Object -First 1
  $pg = if ($pgId) { docker stats $pgId --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}" 2>$null } else { "" }
  $conn = if ($pgId) { docker exec $pgId psql -U bidvera -d bidvera_load -t -A -c "SELECT count(*) FROM pg_stat_activity WHERE datname='bidvera_load';" 2>$null } else { "0" }
  $appRam = 0.0
  foreach ($a in @("app1","app2","app3","worker")) {
    $cid = docker ps -qf "name=$Project-$a" | Select-Object -First 1
    if ($cid) {
      $mem = docker stats $cid --no-stream --format "{{.MemUsage}}" 2>$null
      if ($mem -match '^([\d.]+)MiB') { $appRam += [double]$Matches[1] }
      elseif ($mem -match '^([\d.]+)GiB') { $appRam += [double]$Matches[1] * 1024 }
    }
  }
  $cpuSum = 0.0
  foreach ($a in @("app1","app2","app3")) {
    $cid = docker ps -qf "name=$Project-$a" | Select-Object -First 1
    if ($cid) {
      $c = docker stats $cid --no-stream --format "{{.CPUPerc}}" 2>$null
      if ("$c" -match '([\d.]+)%') { $cpuSum += [double]$Matches[1] }
    }
  }
  $line = (@{
    ts = (Get-Date).ToUniversalTime().ToString("o")
    sample = $i
    pg = "$pg"
    dbConnections = ("$conn").Trim()
    appRamMb = [math]::Round($appRam,1)
    appCpuPct = [math]::Round($cpuSum,1)
  } | ConvertTo-Json -Compress)
  Add-Content -Path $Out -Value $line
  Start-Sleep -Seconds $Interval
}
'@
  $samplerPs1 = Join-Path $ResultsDir "_sampler-$Name.ps1"
  Set-Content -Path $samplerPs1 -Value $samplerScript -Encoding UTF8
  $samplerProc = Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoProfile","-ExecutionPolicy","Bypass","-File",$samplerPs1,$metricsPath,"10","$sampleCount",$ProjectName
  ) -WindowStyle Hidden -PassThru

  $reportOut = ((Join-Path (Resolve-Path $ResultsDir) "$Name-report.json") -replace '\\','/')
  $env:MAX_VUS = "$MaxVus"
  $env:HOLD_SECONDS = "$HoldSeconds"
  $env:ERROR_RATE_THRESHOLD = "0.05"
  $env:P95_MS = "15000"
  $env:P99_MS = "45000"

  $sw = [Diagnostics.Stopwatch]::StartNew()
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  # Run k6 via compose so BASE_URL hits nginx service on the compose network.
  $composeArgs = @(
    "--profile", "run-k6", "run", "--rm",
    "-e", "MAX_VUS=$MaxVus",
    "-e", "HOLD_SECONDS=$HoldSeconds",
    "-e", "ERROR_RATE_THRESHOLD=0.05",
    "-e", "P95_MS=15000",
    "-e", "P99_MS=45000",
    "-e", "REPORT_OUT=/results/multi/$Name-report.json",
    "-e", "APP_REPORT_OUT=/app-data/load-test/latest-report.json",
    "k6", "run",
    "--summary-export", "/results/multi/$Name-k6-summary.json",
    "--out", "json=/results/multi/$Name-k6-raw.json",
    "/scripts/$Script"
  )
  & docker.exe compose -p $ProjectName -f $ComposeFile @composeArgs 2>&1 | ForEach-Object { "$_" }
  $k6Exit = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  $sw.Stop()

  if ($samplerProc -and -not $samplerProc.HasExited) {
    Stop-Process -Id $samplerProc.Id -Force -ErrorAction SilentlyContinue
  }

  $after = Get-MultiMetrics
  $samples = @()
  if (Test-Path $metricsPath) {
    $samples = @(Get-Content $metricsPath | ForEach-Object { $_ | ConvertFrom-Json })
  }
  $peakDbConn = 0; $peakAppRam = 0; $peakAppCpu = 0; $peakPgCpu = 0
  if ($samples.Count -gt 0) {
    $peakDbConn = ($samples | ForEach-Object { [int]($_.dbConnections) } | Measure-Object -Maximum).Maximum
    $peakAppRam = ($samples | ForEach-Object { [double]($_.appRamMb) } | Measure-Object -Maximum).Maximum
    $peakAppCpu = ($samples | ForEach-Object { [double]($_.appCpuPct) } | Measure-Object -Maximum).Maximum
    $peakPgCpu = ($samples | ForEach-Object {
      if ($_.pg -match '^([\d.]+)%') { [double]$Matches[1] } else { 0 }
    } | Measure-Object -Maximum).Maximum
  }

  $reqs = 0; $failedRate = 0; $p50 = 0; $p95 = 0; $p99 = 0; $durationMs = 0; $vusMax = 0; $rps = 0; $verdict = $null
  $reportPath = Join-Path $ResultsDir "$Name-report.json"
  if (Test-Path $reportPath) {
    $report = Get-Content $reportPath -Raw | ConvertFrom-Json
    $reqs = [int]$report.http.requests
    $failedRate = [double]$report.http.errorRate
    $p50 = [double]$report.http.p50Ms
    $p95 = [double]$report.http.p95Ms
    $p99 = [double]$report.http.p99Ms
    $durationMs = [double]$report.durationMs
    $rps = [math]::Round([double]$report.http.rpsAvg, 2)
    $vusMax = [int]$report.concurrentUsersReached
    $verdict = $report.verdict
  } elseif (Test-Path $summaryPath) {
    $summary = Get-Content $summaryPath -Raw | ConvertFrom-Json
    if ($summary.metrics) {
      $metrics = $summary.metrics
      $http = $metrics.http_reqs
      $reqs = [int]($(if ($http.values) { $http.values.count } else { $http.count }))
      $failed = $metrics.http_req_failed
      $failedRate = [double]($(if ($failed.values) { $failed.values.rate } elseif ($null -ne $failed.value) { $failed.value } else { 0 }))
      $dur = $metrics.http_req_duration
      $durV = if ($dur.values) { $dur.values } else { $dur }
      $p50 = [double]($(if ($durV.med) { $durV.med } elseif ($durV.'p(50)') { $durV.'p(50)' } else { 0 }))
      $p95 = [double]($(if ($durV.'p(95)') { $durV.'p(95)' } else { 0 }))
      $p99 = [double]($(if ($durV.'p(99)') { $durV.'p(99)' } else { $p95 }))
      $durationMs = [double]$summary.state.testRunDurationMs
      $rps = if ($durationMs -gt 0) { [math]::Round($reqs / ($durationMs / 1000.0), 2) } else { 0 }
      $vus = $metrics.vus_max
      if (-not $vus) { $vus = $metrics.vus }
      $vusMax = if ($vus.values) { $vus.values.max } elseif ($vus.max) { $vus.max } else { $vus.value }
    }
  }

  $result = "PASS"
  if ($verdict -eq "WARNING") { $result = "DEGRADED" }
  elseif ($verdict -eq "FAIL") { $result = "FAIL" }
  elseif ($k6Exit -ne 0 -or $reqs -lt 10) { $result = "FAIL" }
  elseif ($failedRate -gt 0.05) { $result = "FAIL" }
  elseif ($p95 -gt 15000) { $result = "DEGRADED" }

  $workerCid = docker ps -qf "name=${ProjectName}-worker" | Select-Object -First 1
  $workerStatus = if ($workerCid) { "UP" } else { "DOWN" }

  $row = [ordered]@{
    test = $Name
    virtualUsers = $MaxVus
    vusReached = $vusMax
    durationSec = [math]::Round($durationMs / 1000.0, 1)
    requests = $reqs
    requestsPerSec = $rps
    p50Ms = [math]::Round($p50, 1)
    p95Ms = [math]::Round($p95, 1)
    p99Ms = [math]::Round($p99, 1)
    errorRate = [math]::Round($failedRate, 5)
    dbConnectionPeak = $peakDbConn
    appCpuPeakPct = $peakAppCpu
    appRamPeakMb = $peakAppRam
    dbCpuPeakPct = $peakPgCpu
    before = $before
    after = $after
    k6Exit = $k6Exit
    workerStatus = $workerStatus
    elapsedWallSec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    result = $result
  }
  $row | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $ResultsDir "$Name.json")
  Write-Host ($row | ConvertTo-Json -Compress)
  return $row
}

Write-Host "Warming nginx /api/health ..."
try { Invoke-WebRequest -Uri "$BaseUrl/api/health" -UseBasicParsing -TimeoutSec 30 | Out-Null } catch { Write-Host "warmup warn: $_" }

# Instance identity probe (least_conn should rotate)
$instances = [System.Collections.Generic.HashSet[string]]::new()
for ($i = 0; $i -lt 30; $i++) {
  try {
    $h = Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 10
    if ($h.instance) { [void]$instances.Add([string]$h.instance) }
  } catch {}
}
$instanceProbe = @{
  test = "instance-identity"
  distinctInstances = @($instances)
  count = $instances.Count
  result = if ($instances.Count -ge 2) { "PASS" } else { "FAIL" }
}
$instanceProbe | ConvertTo-Json | Set-Content (Join-Path $ResultsDir "instance-identity.json")
Write-Host ($instanceProbe | ConvertTo-Json -Compress)

# Host free-RAM floors are advisory: Docker Desktop already reserves ~7.4GiB VM RAM.
# After db-scale + image rebuild, Windows free RAM often sits <1GiB even though the
# compose stack has headroom. Workload (journeys.js, VUs, hold) is unchanged.
$phases = @()
$phases += Invoke-MultiK6 -Name "multi-baseline-5vu" -MaxVus 5 -HoldSeconds 45 -MinFreeMb 400
Start-Sleep -Seconds 10
$phases += Invoke-MultiK6 -Name "multi-50vu" -MaxVus 50 -HoldSeconds 60 -MinFreeMb 400
Start-Sleep -Seconds 15
$phases += Invoke-MultiK6 -Name "multi-100vu" -MaxVus 100 -HoldSeconds 60 -MinFreeMb 400
Start-Sleep -Seconds 20
$phases += Invoke-MultiK6 -Name "multi-250vu" -MaxVus 250 -HoldSeconds 60 -MinFreeMb 400
Start-Sleep -Seconds 25
$phases += Invoke-MultiK6 -Name "multi-500vu" -MaxVus 500 -HoldSeconds 60 -MinFreeMb 500
Start-Sleep -Seconds 25
$phases += Invoke-MultiK6 -Name "multi-1000vu" -MaxVus 1000 -HoldSeconds 60 -MinFreeMb 600

$phases | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $ResultsDir "all-phases.json")
Write-Host "`nMULTI_PHASES_DONE count=$($phases.Count)"
