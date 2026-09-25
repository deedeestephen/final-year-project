# Starts everything the app needs on this PC, in one go:
#   1. Docker Desktop (if it is not running yet)
#   2. the databases (PostgreSQL, MongoDB, MinIO, Qdrant, Redis) in Docker
#   3. the backend API on http://localhost:3000 (in its own window)
#   4. the admin website on http://localhost:5173 (in its own window)
#   5. the AI service (development mock models) on http://127.0.0.1:8000 (in its own window)
#
# Usage (from the project folder, in PowerShell):
#   powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1
#
# Add -ResetDemoPasswords to put the demo accounts back to the password in .env.
param([switch]$ResetDemoPasswords)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$adminWeb = Join-Path $root 'admin-web'
$aiServices = Join-Path $root 'ai-services'

function Say($text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host "!! $text" -ForegroundColor Red; exit 1 }

if (-not (Test-Path (Join-Path $root '.env'))) {
  Fail "The .env file is missing. Run: node scripts\gen-keys.mjs --init-env"
}

# Docker
$docker = 'docker'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  $docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
}
& $docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Say 'Starting Docker Desktop (this can take a minute)...'
  Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 3
    & $docker info *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  }
  if (-not $ready) { Fail 'Docker Desktop did not start. Open it by hand, wait for "Engine running", then run this again.' }
}

Say 'Starting the databases in Docker...'
& $docker compose -f (Join-Path $root 'infrastructure\docker-compose.yml') --env-file (Join-Path $root '.env') up -d
if ($LASTEXITCODE -ne 0) { Fail 'docker compose failed (see the messages above).' }

# An old backend still running would block port 3000.
$old = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'dist[\\/]main' }
foreach ($p in $old) {
  Say "Stopping an old backend (process $($p.ProcessId))..."
  Stop-Process -Id $p.ProcessId -Force
}

Push-Location $backend
try {
  if (-not (Test-Path 'node_modules')) {
    Say 'Installing backend packages (first time only)...'
    npm ci
    if ($LASTEXITCODE -ne 0) { Fail 'npm ci failed.' }
  }
  Say 'Preparing the database (migrations and synthetic demo data)...'
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { Fail 'Database migration failed. Is Docker running?' }
  npm run -s db:seed
  if ($ResetDemoPasswords) { npm run -s db:reset-demo }
  Say 'Building the backend...'
  npm run -s build
  if ($LASTEXITCODE -ne 0) { Fail 'Backend build failed.' }
} finally {
  Pop-Location
}

Say 'Starting the backend in a new window (keep that window open)...'
Start-Process powershell -WorkingDirectory $backend -ArgumentList @(
  '-NoExit', '-Command',
  "`$Host.UI.RawUI.WindowTitle = 'PCa mHealth backend - close this window to stop'; npm run start:prod"
)

$ok = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/health' -TimeoutSec 2
    if ($r.status -eq 'ok') { $ok = $true; break }
  } catch { }
}
if (-not $ok) { Fail 'The backend did not answer on http://localhost:3000. Look at the backend window for errors.' }

if (-not (Test-Path (Join-Path $adminWeb 'node_modules'))) {
  Say 'Installing admin website packages (first time only)...'
  Push-Location $adminWeb
  try {
    npm ci
    if ($LASTEXITCODE -ne 0) { Fail 'npm ci failed for the admin website.' }
  } finally {
    Pop-Location
  }
}
$adminRunning = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'vite' -and $_.CommandLine -match 'admin-web' }
if (-not $adminRunning) {
  Say 'Starting the admin website in a new window (keep that window open)...'
  Start-Process powershell -WorkingDirectory $adminWeb -ArgumentList @(
    '-NoExit', '-Command',
    "`$Host.UI.RawUI.WindowTitle = 'PCa mHealth admin website - close this window to stop'; npm run dev"
  )
}

$aiPython = Join-Path $aiServices '.venv\Scripts\python.exe'
if (-not (Test-Path $aiPython)) {
  Write-Host '!! The AI service is not installed yet, so AI analysis will say it is unavailable.' -ForegroundColor Yellow
  Write-Host "   To install it once:  cd `"$aiServices`"; py -3 -m venv .venv; .venv\Scripts\python -m pip install -e `".[dev]`""
} else {
  $aiRunning = Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -match 'uvicorn' -and $_.CommandLine -match 'app\.main:app' }
  if (-not $aiRunning) {
    Say 'Starting the AI service in a new window (keep that window open)...'
    # The service reads AI_SERVICE_TOKEN from .env itself, so no secret is on a command line.
    Start-Process powershell -WorkingDirectory $aiServices -ArgumentList @(
      '-NoExit', '-Command',
      "`$Host.UI.RawUI.WindowTitle = 'PCa mHealth AI service (mock models) - close this window to stop'; .venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
    )
  }
}

Write-Host ''
Write-Host 'READY!' -ForegroundColor Green
Write-Host '  Backend health:  http://localhost:3000/api/v1/health'
Write-Host '  API explorer:    http://localhost:3000/api/docs'
Write-Host '  Admin website:   http://localhost:5173  (open it in Chrome or Edge on this PC)'
Write-Host '  AI service:      http://127.0.0.1:8000/v1/health  (development mock models only)'
Write-Host '  Next: open the "mobile" folder in Android Studio, pick the Galaxy S9+ emulator, press Run.'
