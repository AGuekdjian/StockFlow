param(
  [Parameter(Mandatory = $true)][string]$MongoUri,
  [Parameter(Mandatory = $true)][string]$ArchivePath,
  [switch]$DropExisting
)
$ErrorActionPreference = 'Stop'
$resolvedArchive = [System.IO.Path]::GetFullPath($ArchivePath)
if (-not (Test-Path -LiteralPath $resolvedArchive -PathType Leaf)) { throw "No existe el archivo: $resolvedArchive" }
$arguments = @("--uri=$MongoUri", "--archive=$resolvedArchive", '--gzip')
if ($DropExisting) { $arguments += '--drop' }
& mongorestore @arguments
if ($LASTEXITCODE -ne 0) { throw 'mongorestore falló.' }
Write-Output 'Restauración finalizada. Verifique /api/health y el inventario antes de habilitar operaciones.'
