param(
  [switch]$Reconfigure,
  [switch]$RestartNow,
  [switch]$SkipFirewall
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$envFile = Join-Path $projectRoot '.env'

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-Elevated {
  $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
  if ($Reconfigure) { $arguments += '-Reconfigure' }
  if ($RestartNow) { $arguments += '-RestartNow' }
  if ($SkipFirewall) { $arguments += '-SkipFirewall' }
  Write-Output 'Se solicitará permiso de administrador para preparar Windows.'
  $process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments -Wait -PassThru
  return $process.ExitCode
}

function Install-WingetPackage {
  param([string]$Id, [string]$DisplayName)
  & winget.exe list --id $Id --exact --accept-source-agreements *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Output "$DisplayName ya está instalado."
    return
  }
  Write-Output "Instalando $DisplayName..."
  & winget.exe install --id $Id --exact --accept-package-agreements --accept-source-agreements --silent --disable-interactivity
  if ($LASTEXITCODE -ne 0) { throw "No se pudo instalar $DisplayName (código $LASTEXITCODE)." }
}

function Enable-RequiredFeature {
  param([string]$Name, [string]$DisplayName)
  $feature = Get-WindowsOptionalFeature -Online -FeatureName $Name
  if ($feature.State -eq 'Enabled') {
    Write-Output "$DisplayName ya está habilitado."
    return $false
  }
  Write-Output "Habilitando $DisplayName..."
  $result = Enable-WindowsOptionalFeature -Online -FeatureName $Name -All -NoRestart
  return [bool]$result.RestartNeeded
}

function Read-SecurePlainText {
  param([string]$Prompt)
  $secureValue = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function New-SessionSecret {
  $bytes = New-Object byte[] 48
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($bytes)
}

function Get-SuggestedOrigin {
  $address = Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
    Sort-Object InterfaceMetric |
    Select-Object -First 1 -ExpandProperty IPAddress
  if ($address) { return "http://${address}:8080" }
  return 'http://localhost:8080'
}

function Set-ApplicationEnvironment {
  if ((Test-Path -LiteralPath $envFile -PathType Leaf) -and -not $Reconfigure) {
    Write-Output '.env ya existe; se conserva. Use -Reconfigure para reemplazarlo.'
    return
  }

  Write-Output 'Configurando la aplicación. La URI de Atlas no se mostrará en pantalla.'
  $mongoUri = Read-SecurePlainText 'URI completa de MongoDB Atlas'
  if ($mongoUri -notmatch '^mongodb(\+srv)?://') { throw 'La URI de MongoDB no tiene un formato válido.' }

  $suggestedOrigin = Get-SuggestedOrigin
  $origin = Read-Host "Origen para acceder desde la LAN [$suggestedOrigin]"
  if ([string]::IsNullOrWhiteSpace($origin)) { $origin = $suggestedOrigin }
  try { [uri]$origin | Out-Null } catch { throw 'El origen indicado no es una URL válida.' }

  $lines = @(
    'NODE_ENV=production',
    'PORT=3000',
    'BACKEND_PORT=3000',
    'FRONTEND_PORT=8080',
    "FRONTEND_ORIGIN=$origin",
    "MONGODB_URI=$mongoUri",
    "SESSION_SECRET=$(New-SessionSecret)",
    'SQLITE_PATH=./data/outbox.sqlite',
    'LOG_LEVEL=info',
    'LOG_PATH=./logs',
    'BACKUP_PATH=./backups',
    'HOST_BACKUP_PATH=./backups',
    'MONGODB_CONNECT_ON_START=true',
    'COOKIE_SECURE=false',
    'SESSION_HOURS=8',
    'SYNC_INTERVAL_MS=5000'
  )
  [IO.File]::WriteAllLines($envFile, $lines, [Text.UTF8Encoding]::new($false))
  $mongoUri = $null
  Write-Output '.env creado y excluido de Git.'
}

if (-not (Test-IsAdministrator)) {
  exit (Invoke-Elevated)
}

if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
  throw 'winget no está disponible. Instale App Installer desde Microsoft Store y vuelva a ejecutar.'
}

Write-Output 'Preparando el equipo para StockFlow...'
$restartRequired = $false
$restartRequired = (Enable-RequiredFeature 'Microsoft-Windows-Subsystem-Linux' 'Windows Subsystem for Linux') -or $restartRequired
$restartRequired = (Enable-RequiredFeature 'VirtualMachinePlatform' 'Virtual Machine Platform') -or $restartRequired

Install-WingetPackage 'Microsoft.WSL' 'WSL 2'
Install-WingetPackage 'Docker.DockerDesktop' 'Docker Desktop'
Install-WingetPackage 'MongoDB.DatabaseTools' 'MongoDB Database Tools'
Install-WingetPackage 'Git.Git' 'Git'

if (-not $restartRequired) {
  & wsl.exe --set-default-version 2
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo configurar WSL 2 como versión predeterminada.' }
}

Set-ApplicationEnvironment

if (-not $SkipFirewall) {
  $ruleName = 'StockFlow Frontend (Private LAN)'
  if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -Profile Private | Out-Null
    Write-Output 'Firewall configurado para permitir el puerto 8080 sólo en redes privadas.'
  } else { Write-Output 'La regla de firewall de StockFlow ya existe.' }
}

Write-Output 'Preparación terminada.'
if ($restartRequired) {
  Write-Warning 'Windows debe reiniciarse antes de ejecutar start.ps1.'
  if ($RestartNow) { Restart-Computer -Force }
  else { Write-Output 'Reinicie Windows y luego ejecute: .\scripts\start.ps1' }
} else {
  Write-Output 'Ya puede ejecutar: .\scripts\start.ps1'
}
