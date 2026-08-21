$ErrorActionPreference = 'Stop'
$scripts = Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1' -File
foreach ($script in $scripts) {
  $tokens = $null
  $parseErrors = $null
  [Management.Automation.Language.Parser]::ParseFile($script.FullName, [ref]$tokens, [ref]$parseErrors) | Out-Null
  if ($parseErrors.Count) {
    $messages = ($parseErrors | ForEach-Object { $_.Message }) -join '; '
    throw "$($script.Name) contiene errores de sintaxis: $messages"
  }
}
Write-Output "$($scripts.Count) scripts PowerShell validados."
