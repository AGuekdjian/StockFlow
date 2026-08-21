param(
  [switch]$PurgeData
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerExecutable = if ($dockerCommand) {
  $dockerCommand.Source
} else {
  Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'
}
if (-not (Test-Path -LiteralPath $dockerExecutable -PathType Leaf)) {
  throw 'Docker no está instalado o no pudo localizarse.'
}

& $dockerExecutable info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker no está en ejecución; no es posible limpiar sus recursos.' }

Push-Location $projectRoot
try {
  $arguments = @('compose', 'down', '--rmi', 'local', '--remove-orphans')
  if ($PurgeData) {
    Write-Warning 'PurgeData eliminará los volúmenes SQLite y logs de Docker. Los backups del host se conservan.'
    $arguments += '--volumes'
  }
  & $dockerExecutable @arguments
  if ($LASTEXITCODE -ne 0) { throw 'Docker no pudo eliminar todos los recursos del proyecto.' }
  Write-Output 'Contenedores, red e imágenes locales del proyecto eliminados.'
  if ($PurgeData) { Write-Output 'Volúmenes Docker del proyecto eliminados. Los backups del host no se tocaron.' }
  else { Write-Output 'Los volúmenes persistentes y backups se conservaron.' }
} finally {
  Pop-Location
}
