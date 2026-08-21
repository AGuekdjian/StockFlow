param(
  [switch]$NoBuild,
  [ValidateRange(30, 600)][int]$TimeoutSeconds = 180
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$envFile = Join-Path $projectRoot '.env'

function Resolve-Executable {
  param([string]$Name, [string]$Fallback)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  if ($Fallback -and (Test-Path -LiteralPath $Fallback -PathType Leaf)) { return $Fallback }
  throw "$Name no está instalado o no pudo localizarse."
}

function Assert-EnvConfiguration {
  if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    throw 'Falta .env. Copie .env.example y configure valores reales antes de iniciar.'
  }
  $values = @{}
  foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $name, $value = $line -split '=', 2
    $values[$name.Trim()] = $value.Trim()
  }
  foreach ($required in @('MONGODB_URI', 'SESSION_SECRET', 'FRONTEND_ORIGIN')) {
    if (-not $values[$required]) { throw "La variable $required falta en .env." }
  }
  if ($values.MONGODB_URI -match 'user:password|cluster\.example|<db_password>') {
    throw 'MONGODB_URI todavía contiene un valor de ejemplo.'
  }
  if ($values.SESSION_SECRET.Length -lt 32 -or $values.SESSION_SECRET -match '^replace-') {
    throw 'SESSION_SECRET debe ser real y tener al menos 32 caracteres.'
  }
  try { [uri]$values.FRONTEND_ORIGIN | Out-Null } catch { throw 'FRONTEND_ORIGIN no es una URL válida.' }
}

Write-Output 'Validando configuración...'
Assert-EnvConfiguration

$wslExecutable = Resolve-Executable 'wsl.exe' (Join-Path $env:SystemRoot 'System32\wsl.exe')
& $wslExecutable --status *> $null
if ($LASTEXITCODE -ne 0) { throw 'WSL 2 no está correctamente instalado o configurado.' }

$dockerExecutable = Resolve-Executable 'docker' (Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe')
& $dockerExecutable compose version *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose no está disponible.' }

# Estas herramientas son necesarias para el procedimiento de backup/restore del proyecto.
Resolve-Executable 'mongodump' (Join-Path $env:ProgramFiles 'MongoDB\Tools\100\bin\mongodump.exe') | Out-Null
Resolve-Executable 'mongorestore' (Join-Path $env:ProgramFiles 'MongoDB\Tools\100\bin\mongorestore.exe') | Out-Null

& $dockerExecutable info *> $null
if ($LASTEXITCODE -ne 0) {
  $dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (-not (Test-Path -LiteralPath $dockerDesktop -PathType Leaf)) { throw 'Docker Desktop no está instalado.' }
  Write-Output 'Iniciando Docker Desktop...'
  Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
  $dockerDeadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    Start-Sleep -Seconds 3
    & $dockerExecutable info *> $null
    $dockerReady = $LASTEXITCODE -eq 0
  } while (-not $dockerReady -and (Get-Date) -lt $dockerDeadline)
  if (-not $dockerReady) { throw "Docker no quedó operativo en $TimeoutSeconds segundos." }
}

Push-Location $projectRoot
try {
  & $dockerExecutable compose config --quiet
  if ($LASTEXITCODE -ne 0) { throw 'La configuración de Docker Compose no es válida.' }

  $composeArguments = @('compose', 'up', '-d')
  if (-not $NoBuild) { $composeArguments += '--build' }
  & $dockerExecutable @composeArguments
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo levantar el proyecto.' }

  $healthUri = 'http://localhost:8080/api/health'
  $healthDeadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    Start-Sleep -Seconds 3
    try { $health = Invoke-RestMethod -Uri $healthUri -TimeoutSec 5 } catch { $health = $null }
  } while ($health.data.status -ne 'healthy' -and (Get-Date) -lt $healthDeadline)
  if ($health.data.status -ne 'healthy') {
    & $dockerExecutable compose ps
    throw "El sistema no alcanzó estado healthy en $TimeoutSeconds segundos."
  }

  & $dockerExecutable compose ps
  Write-Output 'Sistema iniciado y saludable: http://localhost:8080'
} finally {
  Pop-Location
}
