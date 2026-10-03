Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$service = Join-Path $root "ml-service"
Set-Location $service

Write-Host "Starting AeroPulse prognostics API on http://127.0.0.1:8000"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

