param([int]$IntervalMinutes = 10)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
& node "$repo\tools\process-print-requests.mjs" --init-ledger
$poll = "$repo\tools\print-request-poll.ps1"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$poll`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName DailySummaryPrintPoll -Action $action -Trigger $trigger -Settings $settings -Force
