# Rebuilds the operations manual's pictures, PDF and web page (README.md).
#   powershell -ExecutionPolicy Bypass -File docs\report\tools\report.ps1 <step> [<step> ...]
# The first run makes a Python environment in docs\report\tools\.venv and
# installs the three packages in requirements.txt (this needs the internet once).
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Steps)

$here = $PSScriptRoot
$venv = Join-Path $here '.venv'
$python = Join-Path $venv 'Scripts\python.exe'
$requirements = Join-Path $here 'requirements.txt'
$installed = Join-Path $venv 'installed.txt'

if (-not (Test-Path $python)) {
  Write-Host 'Making the Python environment (once) ...'
  if (Get-Command py -ErrorAction SilentlyContinue) { py -3 -m venv $venv } else { python -m venv $venv }
  if (-not (Test-Path $python)) { Write-Host 'Python 3.10 or newer is needed: https://www.python.org/downloads/'; exit 1 }
}

# Install the packages when requirements.txt is new or has changed.
$wanted = (Get-FileHash $requirements).Hash
$have = if (Test-Path $installed) { Get-Content $installed } else { '' }
if ($wanted -ne $have) {
  Write-Host 'Installing the Python packages ...'
  & $python -m pip install --quiet --disable-pip-version-check -r $requirements
  if ($LASTEXITCODE -ne 0) { Write-Host 'pip could not install the packages (is the internet on?)'; exit 1 }
  Set-Content -Path $installed -Value $wanted
}

& $python (Join-Path $here 'report.py') @Steps
exit $LASTEXITCODE
