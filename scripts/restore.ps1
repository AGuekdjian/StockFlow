param(
  [Parameter(Mandatory = $true)][string]$MongoUri,
  [Parameter(Mandatory = $true)][string]$ArchivePath,
  [switch]$DropExisting
)
$ErrorActionPreference = 'Stop'
$mongoRestoreCommand = Get-Command mongorestore -ErrorAction SilentlyContinue
$mongoRestoreExecutable = if ($mongoRestoreCommand) {
  $mongoRestoreCommand.Source
} else {
  Join-Path $env:ProgramFiles 'MongoDB\Tools\100\bin\mongorestore.exe'
}
if (-not (Test-Path -LiteralPath $mongoRestoreExecutable -PathType Leaf)) {
  throw 'mongorestore no está instalado o no pudo localizarse.'
}
$resolvedArchive = [System.IO.Path]::GetFullPath($ArchivePath)
if (-not (Test-Path -LiteralPath $resolvedArchive -PathType Leaf)) { throw "No existe el archivo: $resolvedArchive" }
$arguments = @("--uri=$MongoUri", "--archive=$resolvedArchive", '--gzip')
if ($DropExisting) { $arguments += '--drop' }
& $mongoRestoreExecutable @arguments
if ($LASTEXITCODE -ne 0) { throw 'mongorestore falló.' }
Write-Output 'Restauración finalizada. Verifique /api/health y el inventario antes de habilitar operaciones.'
