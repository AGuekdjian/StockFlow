param(
  [Parameter(Mandatory = $true)][string]$MongoUri,
  [Parameter(Mandatory = $true)][string]$BackupPath
)
$ErrorActionPreference = 'Stop'
$mongoDumpCommand = Get-Command mongodump -ErrorAction SilentlyContinue
$mongoDumpExecutable = if ($mongoDumpCommand) {
  $mongoDumpCommand.Source
} else {
  Join-Path $env:ProgramFiles 'MongoDB\Tools\100\bin\mongodump.exe'
}
if (-not (Test-Path -LiteralPath $mongoDumpExecutable -PathType Leaf)) {
  throw 'mongodump no está instalado o no pudo localizarse.'
}
$resolvedRoot = [System.IO.Path]::GetFullPath($BackupPath)
New-Item -ItemType Directory -Force -Path $resolvedRoot | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$dailyPath = Join-Path $resolvedRoot "daily_$stamp.archive.gz"
& $mongoDumpExecutable --uri=$MongoUri --archive=$dailyPath --gzip
if ($LASTEXITCODE -ne 0) { throw 'mongodump falló; no se modificó la retención.' }

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCommand) { throw 'Docker es obligatorio para respaldar la outbox SQLite activa.' }
Push-Location $projectRoot
try {
  & $dockerCommand.Source compose exec -T backend node backend/scripts/backup-sqlite.js
  if ($LASTEXITCODE -ne 0) { throw 'El backup consistente de SQLite falló.' }
} finally {
  Pop-Location
}
if (-not (Get-ChildItem -LiteralPath $resolvedRoot -Filter 'sqlite_*.sqlite' -File | Select-Object -First 1)) {
  throw 'Docker creó el backup SQLite fuera de BackupPath. Verifique HOST_BACKUP_PATH y BACKUP_PATH.'
}
Get-ChildItem -LiteralPath $resolvedRoot -Filter 'daily_*.archive.gz' -File | Sort-Object LastWriteTime -Descending | Select-Object -Skip 7 | Remove-Item -Force
Get-ChildItem -LiteralPath $resolvedRoot -Filter 'sqlite_*.sqlite' -File | Sort-Object LastWriteTime -Descending | Select-Object -Skip 7 | Remove-Item -Force
if ((Get-Date).DayOfWeek -eq 'Sunday') {
  $weeklyPath = Join-Path $resolvedRoot "weekly_$stamp.archive.gz"
  Copy-Item -LiteralPath $dailyPath -Destination $weeklyPath
  Get-ChildItem -LiteralPath $resolvedRoot -Filter 'weekly_*.archive.gz' -File | Sort-Object LastWriteTime -Descending | Select-Object -Skip 4 | Remove-Item -Force
}
Write-Output "Backup verificado por mongodump: $dailyPath"
