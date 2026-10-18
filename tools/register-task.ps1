param([int]$IntervalMinutes = 0)
# Default (0): on-demand only. Registered without a trigger; run it with Start-ScheduledTask when you want to print.
# Pass 1 or more to poll automatically at that interval (the old behaviour).
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
& node "$repo\tools\process-print-requests.mjs" --init-ledger
if ($LASTEXITCODE -ne 0) { Write-Error 'init-ledger failed; task not registered'; exit 1 }
$poll = "$repo\tools\print-request-poll.ps1"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$poll`""
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
if ($IntervalMinutes -gt 0) {
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
  Register-ScheduledTask -TaskName DailySummaryPrintPoll -Action $action -Trigger $trigger -Settings $settings -Force
} else {
  Register-ScheduledTask -TaskName DailySummaryPrintPoll -Action $action -Settings $settings -Force
}
