# Orchestrates isolated Bidvera k6 phases and records real metrics.
# NEVER targets Neon/production.

param(
  [string]$BaseUrl = "http://127.0.0.1:3100",
  [string]$UsersFile = "",
  [string]$ResultsDir = "load-test/results"
)

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
$repoRoot = if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { Get-Location }
Set-Location $repoRoot
New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

# k6 open() is relative to the script file (load-test/k6/) — use absolute path.
if (-not $UsersFile) {
  $UsersFile = (Join-Path $repoRoot "load-test\fixtures\users.json")
}
$UsersFile = ((Resolve-Path $UsersFile).Path) -replace '\\', '/'

if ($BaseUrl -match 'neon\.tech|bidvera\.com|vercel\.app') { throw "Refusing remote/production BASE_URL=$BaseUrl" }
Write-Host "USERS_FILE=$UsersFile"

function Get-HostMetrics {
  $node = Get-Process -Name node -ErrorAction SilentlyContinue | Sort-Object WorkingSet64 -Descending | Select-Object -First 3
  $pg = docker stats bidvera-load-test-postgres-1 --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}" 2>$null
  $conn = docker exec bidvera-load-test-postgres-1 psql -U bidvera -d bidvera_load -t -A -c "SELECT count(*) FROM pg_stat_activity WHERE datname='bidvera_load';" 2>$null
  $appCpu = 0
  $appRamMb = 0
  if ($node) {
    $appRamMb = [math]::Round(($node | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 1)
    # CPU seconds cumulative — store WorkingSet peak proxy; sample Process % later via counter if available
  }
  return [pscustomobject]@{
    ts = (Get-Date).ToUniversalTime().ToString("o")
    pgStats = "$pg"
    dbConnections = ("$conn").Trim()
    appRamMb = $appRamMb
    nodePids = @($node | ForEach-Object { $_.Id })
  }
}

function Invoke-K6Phase {
  param(
    [string]$Name,
    [int]$MaxVus,
    [int]$HoldSeconds,
    [switch]$SkipIfLowMemory
  )

  $freeMb = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024, 0)
  Write-Host "`n=== PHASE $Name MAX_VUS=$MaxVus HOLD=${HoldSeconds}s freeRAM=${freeMb}MB ==="
  if ($SkipIfLowMemory -and $freeMb -lt 1500) {
    Write-Host "NOT_EXECUTED: free RAM ${freeMb}MB < 1500MB safety floor"
    $skip = @{
      test = $Name
      virtualUsers = $MaxVus
      result = "NOT_EXECUTED"
      reason = "Host free RAM ${freeMb}MB below 1500MB safety floor for this VU level"
    }
    $skip | ConvertTo-Json | Set-Content -Path (Join-Path $ResultsDir "$Name.json")
    return $skip
  }

  $before = Get-HostMetrics
  $summaryPath = Join-Path $ResultsDir "$Name-k6-summary.json"
  $rawPath = Join-Path $ResultsDir "$Name-k6-raw.json"
  $metricsPath = Join-Path $ResultsDir "$Name-host-metrics.jsonl"
  if (Test-Path $metricsPath) { Remove-Item $metricsPath }

  $sampleCount = [math]::Max(6, [int](($HoldSeconds + 120) / 10))
  $samplerScript = @'
param($Out, $Interval, $Count)
for ($i = 1; $i -le $Count; $i++) {
  $pg = docker stats bidvera-load-test-postgres-1 --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}" 2>$null
  $conn = docker exec bidvera-load-test-postgres-1 psql -U bidvera -d bidvera_load -t -A -c "SELECT count(*) FROM pg_stat_activity WHERE datname='bidvera_load';" 2>$null
  $nodes = Get-Process -Name node -ErrorAction SilentlyContinue
  $ram = if ($nodes) { [math]::Round(($nodes | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 1) } else { 0 }
  $line = (@{
    ts = (Get-Date).ToUniversalTime().ToString("o")
    sample = $i
    pg = "$pg"
    dbConnections = ("$conn").Trim()
    appRamMb = $ram
  } | ConvertTo-Json -Compress)
  Add-Content -Path $Out -Value $line
  Start-Sleep -Seconds $Interval
}
'@
  $samplerPs1 = Join-Path $ResultsDir "_sampler-$Name.ps1"
  Set-Content -Path $samplerPs1 -Value $samplerScript -Encoding UTF8
  $samplerProc = Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $samplerPs1, $metricsPath, "10", "$sampleCount"
  ) -WindowStyle Hidden -PassThru

  $reportOut = (Join-Path (Resolve-Path $ResultsDir) "$Name-report.json") -replace '\\', '/'
  $appReportOut = (Join-Path (Resolve-Path ".data/load-test") "latest-report.json") -replace '\\', '/'
  New-Item -ItemType Directory -Force -Path ".data/load-test" | Out-Null

  $k6Args = @(
    "run",
    "--summary-export", $summaryPath,
    "--out", "json=$rawPath",
    "-e", "BASE_URL=$BaseUrl",
    "-e", "USERS_FILE=$UsersFile",
    "-e", "MAX_VUS=$MaxVus",
    "-e", "HOLD_SECONDS=$HoldSeconds",
    "-e", "ERROR_RATE_THRESHOLD=0.01",
    "-e", "P95_MS=2000",
    "-e", "P99_MS=5000",
    "-e", "REPORT_OUT=$reportOut",
    "-e", "APP_REPORT_OUT=$appReportOut",
    "load-test/k6/journeys.js"
  )

  $sw = [Diagnostics.Stopwatch]::StartNew()
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & k6 @k6Args 2>&1 | ForEach-Object { "$_" }
  $k6Exit = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  $sw.Stop()

  if ($samplerProc -and -not $samplerProc.HasExited) {
    Stop-Process -Id $samplerProc.Id -Force -ErrorAction SilentlyContinue
  }

  $after = Get-HostMetrics
  $samples = @()
  if (Test-Path $metricsPath) {
    $samples = @(Get-Content $metricsPath | ForEach-Object { $_ | ConvertFrom-Json })
  }
  $peakDbConn = 0
  $peakAppRam = 0
  $peakPgCpu = 0
  if ($samples.Count -gt 0) {
    $peakDbConn = ($samples | ForEach-Object { [int]($_.dbConnections) } | Measure-Object -Maximum).Maximum
    $peakAppRam = ($samples | ForEach-Object { [double]($_.appRamMb) } | Measure-Object -Maximum).Maximum
    $peakPgCpu = ($samples | ForEach-Object {
      if ($_.pg -match '^([\d.]+)%') { [double]$Matches[1] } else { 0 }
    } | Measure-Object -Maximum).Maximum
  }

  $summary = $null
  if (Test-Path $summaryPath) {
    $summary = Get-Content $summaryPath -Raw | ConvertFrom-Json
  }

  $reqs = 0; $failedRate = 0; $p50 = 0; $p95 = 0; $p99 = 0; $durationMs = 0; $vusMax = 0; $rps = 0; $verdict = $null
  # Prefer journeys handleSummary report (stable schema) over k6 v2 summary-export shape.
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
  } elseif ($summary -and $summary.metrics) {
    $metrics = $summary.metrics
    $http = $metrics.http_reqs
    $reqs = [int]($(if ($http.values) { $http.values.count } else { $http.count }))
    $failed = $metrics.http_req_failed
    $failedRate = [double]($(if ($failed.values) { $failed.values.rate } elseif ($null -ne $failed.value) { $failed.value } else { 0 }))
    $page = $metrics.bidvera_page_latency
    $pageV = if ($page.values) { $page.values } else { $page }
    $dur = $metrics.http_req_duration
    $durV = if ($dur.values) { $dur.values } else { $dur }
    $p50 = [double]($(if ($pageV.'p(50)') { $pageV.'p(50)' } elseif ($pageV.med) { $pageV.med } elseif ($durV.med) { $durV.med } else { 0 }))
    $p95 = [double]($(if ($pageV.'p(95)') { $pageV.'p(95)' } elseif ($durV.'p(95)') { $durV.'p(95)' } else { 0 }))
    $p99 = [double]($(if ($pageV.'p(99)') { $pageV.'p(99)' } elseif ($durV.'p(99)') { $durV.'p(99)' } else { $p95 }))
    $durationMs = [double]$summary.state.testRunDurationMs
    $rps = if ($durationMs -gt 0) { [math]::Round($reqs / ($durationMs / 1000.0), 2) } else { 0 }
    $vus = $metrics.vus_max
    if (-not $vus) { $vus = $metrics.vus }
    $vusMax = if ($vus.values) { $vus.values.max } elseif ($vus.max) { $vus.max } else { $vus.value }
  }

  $result = "PASS"
  if ($verdict -eq "WARNING") { $result = "DEGRADED" }
  elseif ($verdict -eq "FAIL") { $result = "FAIL" }
  elseif ($k6Exit -ne 0 -or $reqs -lt 10) { $result = "FAIL" }
  elseif ($failedRate -gt 0.01) { $result = "FAIL" }
  elseif ($p95 -gt 2000 -or $p99 -gt 5000) { $result = "DEGRADED" }

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
    appRamPeakMb = $peakAppRam
    dbCpuPeakPct = $peakPgCpu
    before = $before
    after = $after
    k6Exit = $k6Exit
    workerStatus = "NOT_IN_STACK"
    result = $result
  }

  $row | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $ResultsDir "$Name.json")
  Write-Host ($row | ConvertTo-Json -Compress)
  return $row
}

# Warmup
Write-Host "Warming dashboard..."
try { Invoke-WebRequest -Uri "$BaseUrl/api/health" -UseBasicParsing -TimeoutSec 20 | Out-Null } catch {}

$phases = @()
$phases += Invoke-K6Phase -Name "baseline-5vu" -MaxVus 5 -HoldSeconds 45
Start-Sleep -Seconds 10
$phases += Invoke-K6Phase -Name "concurrency-50vu" -MaxVus 50 -HoldSeconds 60
Start-Sleep -Seconds 15
$phases += Invoke-K6Phase -Name "concurrency-100vu" -MaxVus 100 -HoldSeconds 60
Start-Sleep -Seconds 20
$phases += Invoke-K6Phase -Name "concurrency-250vu" -MaxVus 250 -HoldSeconds 60
Start-Sleep -Seconds 25
$phases += Invoke-K6Phase -Name "concurrency-500vu" -MaxVus 500 -HoldSeconds 60 -SkipIfLowMemory
Start-Sleep -Seconds 25
$phases += Invoke-K6Phase -Name "concurrency-1000vu" -MaxVus 1000 -HoldSeconds 60 -SkipIfLowMemory

$phases | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $ResultsDir "all-phases.json")
Write-Host "`nALL_PHASES_DONE count=$($phases.Count)"
