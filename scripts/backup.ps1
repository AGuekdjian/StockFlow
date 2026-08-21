param(
  [Parameter(Mandatory = $true)][string]$MongoUri,
  [Parameter(Mandatory = $true)][string]$BackupPath
)
$ErrorActionPreference = 'Stop'
$resolvedRoot = [System.IO.Path]::GetFullPath($BackupPath)
New-Item -ItemType Directory -Force -Path $resolvedRoot | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$dailyPath = Join-Path $resolvedRoot "daily_$stamp.archive.gz"
& mongodump --uri=$MongoUri --archive=$dailyPath --gzip
if ($LASTEXITCODE -ne 0) { throw 'mongodump falló; no se modificó la retención.' }
Get-ChildItem -LiteralPath $resolvedRoot -Filter 'daily_*.archive.gz' -File | Sort-Object LastWriteTime -Descending | Select-Object -Skip 7 | Remove-Item -Force
if ((Get-Date).DayOfWeek -eq 'Sunday') {
  $weeklyPath = Join-Path $resolvedRoot "weekly_$stamp.archive.gz"
  Copy-Item -LiteralPath $dailyPath -Destination $weeklyPath
  Get-ChildItem -LiteralPath $resolvedRoot -Filter 'weekly_*.archive.gz' -File | Sort-Object LastWriteTime -Descending | Select-Object -Skip 4 | Remove-Item -Force
}
Write-Output "Backup verificado por mongodump: $dailyPath"
