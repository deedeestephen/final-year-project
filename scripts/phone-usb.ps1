# Lets a real Android phone plugged in by USB reach the backend on this PC.
# It tells the phone: "localhost:3000 means the PC's port 3000" (adb reverse),
# so no Wi-Fi setup or firewall change is needed. Run it again after
# unplugging and re-plugging the phone.
#   powershell -ExecutionPolicy Bypass -File scripts\phone-usb.ps1
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) { Write-Host 'adb not found. Install "Android SDK Platform-Tools" in Android Studio (SDK Manager).' -ForegroundColor Red; exit 1 }

$phones = & $adb devices | Select-String -Pattern '^(\S+)\s+device$' |
  ForEach-Object { $_.Matches[0].Groups[1].Value } |
  Where-Object { $_ -notlike 'emulator-*' }

if (-not $phones) {
  Write-Host 'No phone found. Check:' -ForegroundColor Yellow
  Write-Host '  1. The USB cable is plugged in (use a data cable, not charge-only).'
  Write-Host '  2. On the phone: Settings > Developer options > USB debugging is ON.'
  Write-Host '  3. On the phone: tap "Allow" on the "Allow USB debugging?" message.'
  $unauthorised = & $adb devices | Select-String 'unauthorized'
  if ($unauthorised) { Write-Host '  (A phone is connected but has not allowed this PC yet: look at the phone screen.)' }
  exit 1
}

foreach ($id in $phones) {
  $model = (& $adb -s $id shell getprop ro.product.model).Trim()
  & $adb -s $id reverse tcp:3000 tcp:3000 | Out-Null
  Write-Host "Connected $model ($id): the phone can now reach the backend at http://localhost:3000" -ForegroundColor Green
}
Write-Host 'In Android Studio, pick your phone and run the "App - USB phone" configuration.'
