# Optional host metrics sampler while k6 runs (CPU/RAM/Docker stats).
# Usage (PowerShell, from repo root while stack is up):
#   .\load-test\sample-metrics.ps1
# Or bash:
#   ./load-test/sample-metrics.sh

param(
  [int]$IntervalSec = 15,
  [int]$Samples = 40,
  [string]$Out = "load-test/results/host-metrics.jsonl"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path (Split-Path $Out) | Out-Null
if (Test-Path $Out) { Remove-Item $Out }

Write-Host "Sampling Docker stats every ${IntervalSec}s for $Samples samples → $Out"
for ($i = 1; $i -le $Samples; $i++) {
  $ts = (Get-Date).ToUniversalTime().ToString("o")
  $stats = docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}" 2>$null
  $line = (@{ ts = $ts; sample = $i; stats = @($stats) } | ConvertTo-Json -Compress)
  Add-Content -Path $Out -Value $line
  Write-Host "[$i/$Samples] $ts"
  if ($i -lt $Samples) { Start-Sleep -Seconds $IntervalSec }
}

Write-Host "Done. Correlate with k6 summary and Postgres: SELECT count(*) FROM pg_stat_activity;"
