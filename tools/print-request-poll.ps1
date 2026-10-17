$ErrorActionPreference = 'Continue'
$log = Join-Path $PSScriptRoot 'state\print-log.txt'
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
$out = & node "$PSScriptRoot\process-print-requests.mjs" 2>&1 | Out-String
if ($out.Trim()) { Add-Content -Path $log -Value $out.TrimEnd() -Encoding UTF8 }
