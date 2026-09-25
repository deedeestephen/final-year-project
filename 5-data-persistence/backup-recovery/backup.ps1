# Backs up the development PostgreSQL and MongoDB databases (read-only for the databases).
#   powershell -ExecutionPolicy Bypass -File 5-data-persistence\backup-recovery\backup.ps1
# Output: var\backups\<date-time>\ in the repository (git-ignored). Backups contain
# patient data (synthetic in development) and must be kept as carefully as the database.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) { Write-Host '!! .env not found.' -ForegroundColor Red; exit 1 }

# Read only the values this script needs from .env.
$config = @{}
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*(POSTGRES_USER|POSTGRES_DB|MONGO_USER|MONGO_PASSWORD)\s*=\s*(.*)$') {
    $config[$Matches[1]] = $Matches[2].Trim()
  }
}

$docker = 'docker'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  $docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $root "var\backups\$stamp"
New-Item -ItemType Directory -Force $target | Out-Null

Write-Host '==> PostgreSQL (pg_dump, custom format)...' -ForegroundColor Cyan
& $docker exec pca-mhealth-postgres-1 pg_dump -U $config.POSTGRES_USER -d $config.POSTGRES_DB -Fc -f /tmp/pca-backup.dump
if ($LASTEXITCODE -ne 0) { Write-Host '!! pg_dump failed. Is Docker running?' -ForegroundColor Red; exit 1 }
& $docker cp pca-mhealth-postgres-1:/tmp/pca-backup.dump (Join-Path $target 'postgres.dump')
& $docker exec pca-mhealth-postgres-1 rm -f /tmp/pca-backup.dump

Write-Host '==> MongoDB (mongodump, gzip archive)...' -ForegroundColor Cyan
& $docker exec pca-mhealth-mongo-1 mongodump --quiet --username $config.MONGO_USER --password $config.MONGO_PASSWORD --authenticationDatabase admin --archive=/tmp/pca-backup.archive --gzip
if ($LASTEXITCODE -ne 0) { Write-Host '!! mongodump failed.' -ForegroundColor Red; exit 1 }
& $docker cp pca-mhealth-mongo-1:/tmp/pca-backup.archive (Join-Path $target 'mongo.archive.gz')
& $docker exec pca-mhealth-mongo-1 rm -f /tmp/pca-backup.archive

Get-ChildItem $target | ForEach-Object { '{0,-20} {1,10:N0} bytes' -f $_.Name, $_.Length }
Write-Host "Backup saved in $target" -ForegroundColor Green
