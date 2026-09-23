# Windows entry point for the quality gate. Delegates to the bash script (Git Bash ships with Git for Windows).
param([string]$Target = "all")
$bash = Join-Path $env:ProgramFiles "Git\bin\bash.exe"
if (-not (Test-Path $bash)) { $bash = "bash" }
& $bash (Join-Path $PSScriptRoot "quality-gate.sh") $Target
exit $LASTEXITCODE
