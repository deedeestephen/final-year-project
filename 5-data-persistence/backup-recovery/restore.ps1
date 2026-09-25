# Restores a backup made by backup.ps1. THIS REPLACES THE CURRENT DATA.
#   powershell -ExecutionPolicy Bypass -File 5-data-persistence\backup-recovery\restore.ps1 -Backup 20260925-101500
# You must type RESTORE to confirm. Stop the backend first (6-infrastructure\scripts\dev-down.ps1
# stops everything; then start only the databases with docker compose).
param([Parameter(Mandatory = $true)][string]$Backup)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$source = Join-Path $root "var\backups\$Backup"
foreach ($file in 'postgres.dump', 'mongo.archive.gz') {
  if (-not (Test-Path (Join-Path $source $file))) {
    Write-Host "!! $file not found in $source" -ForegroundColor Red; exit 1
  }
}

$config = @{}
foreach ($line in Get-Content (Join-Path $root '.env')) {
  if ($line -match '^\s*(POSTGRES_USER|POSTGRES_DB|MONGO_USER|MONGO_PASSWORD)\s*=\s*(.*)$') {
    $config[$Matches[1]] = $Matches[2].Trim()
  }
}

Write-Host "This will REPLACE the current PostgreSQL and MongoDB data with backup $Backup." -ForegroundColor Yellow
$answer = Read-Host 'Type RESTORE to continue'
if ($answer -cne 'RESTORE') { Write-Host 'Cancelled. Nothing was changed.'; exit 0 }

$docker = 'docker'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  $docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
}

Write-Host '==> PostgreSQL...' -ForegroundColor Cyan
& $docker cp (Join-Path $source 'postgres.dump') pca-mhealth-postgres-1:/tmp/pca-restore.dump
& $docker exec pca-mhealth-postgres-1 pg_restore -U $config.POSTGRES_USER -d $config.POSTGRES_DB --clean --if-exists --no-owner /tmp/pca-restore.dump
$pgExit = $LASTEXITCODE
& $docker exec pca-mhealth-postgres-1 rm -f /tmp/pca-restore.dump

Write-Host '==> MongoDB...' -ForegroundColor Cyan
& $docker cp (Join-Path $source 'mongo.archive.gz') pca-mhealth-mongo-1:/tmp/pca-restore.archive
& $docker exec pca-mhealth-mongo-1 mongorestore --quiet --drop --username $config.MONGO_USER --password $config.MONGO_PASSWORD --authenticationDatabase admin --archive=/tmp/pca-restore.archive --gzip
$mongoExit = $LASTEXITCODE
& $docker exec pca-mhealth-mongo-1 rm -f /tmp/pca-restore.archive

if ($pgExit -ne 0 -or $mongoExit -ne 0) {
  Write-Host '!! The restore reported problems (see above).' -ForegroundColor Red; exit 1
}
Write-Host 'Restore finished. Start the backend again with dev-up.ps1.' -ForegroundColor Green
