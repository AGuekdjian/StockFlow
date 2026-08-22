param(
  [ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+$')][string]$Version = '1.0.0',
  [ValidateRange(30, 600)][int]$TimeoutSeconds = 180
)
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$statePath = Join-Path $projectRoot '.stockflow-version'
$previousVersion = if (Test-Path -LiteralPath $statePath) {
  (Get-Content -LiteralPath $statePath -Raw).Trim()
} else { '1.0.0' }
$dockerCommand = Get-Command docker -ErrorAction Stop

Push-Location $projectRoot
try {
  $env:STOCKFLOW_VERSION = $Version
  & $dockerCommand.Source compose -f docker-compose.production.yml pull
  if ($LASTEXITCODE -ne 0) { throw "No se pudo descargar StockFlow $Version." }
  & $dockerCommand.Source compose -f docker-compose.production.yml up -d
  if ($LASTEXITCODE -ne 0) { throw "No se pudo iniciar StockFlow $Version." }
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    Start-Sleep -Seconds 3
    try { $health = Invoke-RestMethod -Uri 'http://localhost:8080/api/health' -TimeoutSec 5 } catch { $health = $null }
  } while ($health.data.status -ne 'healthy' -and (Get-Date) -lt $deadline)
  if ($health.data.status -ne 'healthy') { throw "StockFlow $Version no alcanzó estado saludable." }
  Set-Content -LiteralPath $statePath -Value $Version -NoNewline
  Write-Output "StockFlow $Version actualizado y saludable."
} catch {
  if ($previousVersion -and $previousVersion -ne $Version) {
    Write-Warning "La actualización falló. Restaurando StockFlow $previousVersion..."
    $env:STOCKFLOW_VERSION = $previousVersion
    & $dockerCommand.Source compose -f docker-compose.production.yml up -d
  }
  throw
} finally {
  Remove-Item Env:STOCKFLOW_VERSION -ErrorAction SilentlyContinue
  Pop-Location
}
