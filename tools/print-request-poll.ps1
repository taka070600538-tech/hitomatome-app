$ErrorActionPreference = 'Continue'
$log = Join-Path $PSScriptRoot 'state\print-log.txt'
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
$out = & node "$PSScriptRoot\process-print-requests.mjs" 2>&1 | Out-String
# node itself appends its log lines; only keep the captured output when node failed to run or crashed
if ($LASTEXITCODE -ne 0 -and $out.Trim()) { Add-Content -Path $log -Value ("[poll] exit=$LASTEXITCODE " + $out.TrimEnd()) -Encoding UTF8 }
