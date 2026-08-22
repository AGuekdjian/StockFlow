param(
  [Parameter(Mandatory = $true)][string]$ArchivePath,
  [switch]$Production,
  [ValidateRange(30, 600)][int]$TimeoutSeconds = 180
)
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$resolvedArchive = [System.IO.Path]::GetFullPath($ArchivePath)
if (-not (Test-Path -LiteralPath $resolvedArchive -PathType Leaf)) {
  throw "No existe el archivo SQLite: $resolvedArchive"
}
$leaf = [System.IO.Path]::GetFileName($resolvedArchive)
$dockerCommand = Get-Command docker -ErrorAction Stop
$composePrefix = @('compose')
if ($Production) { $composePrefix += @('-f', 'docker-compose.production.yml') }

Push-Location $projectRoot
try {
  Write-Warning 'Se detendrá brevemente el backend para restaurar SQLite de forma consistente.'
  & $dockerCommand.Source @composePrefix stop backend
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo detener el backend.' }
  & $dockerCommand.Source @composePrefix run --rm --no-deps backend node backend/scripts/restore-sqlite.js "/app/backups/$leaf"
  if ($LASTEXITCODE -ne 0) { throw 'La restauración SQLite falló; se conservó una copia previa.' }
  & $dockerCommand.Source @composePrefix up -d backend frontend
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo reiniciar StockFlow.' }
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    Start-Sleep -Seconds 3
    try { $health = Invoke-RestMethod -Uri 'http://localhost:8080/api/health/live' -TimeoutSec 5 } catch { $health = $null }
  } while ($health.data.status -ne 'alive' -and (Get-Date) -lt $deadline)
  if ($health.data.status -ne 'alive') { throw 'StockFlow no quedó vivo después de restaurar SQLite.' }
  Write-Output 'SQLite restaurado y StockFlow operativo. Verifique outbox, conflictos y sesiones.'
} finally {
  Pop-Location
}
