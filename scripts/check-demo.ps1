Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$ml = Join-Path $root "ml-service"
$artifact = Join-Path $ml "models\rul_fd001_v1.joblib"
$metadata = Join-Path $ml "models\rul_fd001_v1.metadata.json"
$api = $env:NEXT_PUBLIC_PROGNOSTICS_API_URL
if ([string]::IsNullOrWhiteSpace($api)) {
  $api = "http://127.0.0.1:8000"
}
$api = $api.TrimEnd("/")

$checks = [ordered]@{}
$checks["model_artifact"] = Test-Path -LiteralPath $artifact
$checks["model_metadata"] = Test-Path -LiteralPath $metadata

try {
  $health = Invoke-RestMethod -Uri "$api/health" -TimeoutSec 5
  $models = Invoke-RestMethod -Uri "$api/models" -TimeoutSec 5
  $checks["api_reachable"] = $true
  $checks["trained_provider"] = ($health.trained_model_available -eq $true -and $models.active.prediction_mode -eq "TRAINED_MODEL")
  $checks["fallback_provider"] = ($health.fallback_available -eq $true -and $models.fallback.prediction_mode -eq "DETERMINISTIC_FALLBACK")
} catch {
  $checks["api_reachable"] = $false
  $checks["trained_provider"] = $false
  $checks["fallback_provider"] = $checks["model_artifact"] -and $checks["model_metadata"]
}

if (-not $checks["model_artifact"] -or -not $checks["model_metadata"]) {
  $status = "BLOCKED"
} elseif (-not $checks["api_reachable"]) {
  $status = "DEGRADED - FALLBACK AVAILABLE"
} elseif ($checks["trained_provider"] -and $checks["fallback_provider"]) {
  $status = "READY"
} else {
  $status = "DEGRADED - FALLBACK AVAILABLE"
}

[pscustomobject]@{
  status = $status
  prognosticsApi = $api
  checks = $checks
} | ConvertTo-Json -Depth 5

if ($status -eq "BLOCKED") {
  exit 1
}
