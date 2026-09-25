# Stops the backend, the admin website, the AI service and the Docker services started by dev-up.ps1.
# Data is kept (volumes are not removed).
#   powershell -ExecutionPolicy Bypass -File 6-infrastructure\scripts\dev-down.ps1
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'dist[\\/]main' } |
  ForEach-Object {
    Write-Host "Stopping backend (process $($_.ProcessId))"
    Stop-Process -Id $_.ProcessId -Force
  }

Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'vite' -and $_.CommandLine -match 'admin-panel-web' } |
  ForEach-Object {
    Write-Host "Stopping admin website (process $($_.ProcessId))"
    Stop-Process -Id $_.ProcessId -Force
  }

Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -match 'uvicorn' -and $_.CommandLine -match 'app\.main:app' } |
  ForEach-Object {
    Write-Host "Stopping AI service (process $($_.ProcessId))"
    Stop-Process -Id $_.ProcessId -Force
  }

$docker = 'docker'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  $docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
}
& $docker compose -f (Join-Path $root '6-infrastructure\docker\docker-compose.yml') --env-file (Join-Path $root '.env') stop
Write-Host 'Stopped. Your data is still saved.' -ForegroundColor Green
