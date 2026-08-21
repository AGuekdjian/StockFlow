$ErrorActionPreference = 'Stop'
& npm.cmd run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& npm.cmd run test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& npm.cmd run test:integration
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& npm.cmd run test:e2e
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker no está instalado; no puede verificarse la Definition of Done de Compose.' }
& docker compose config
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& docker compose up --build -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& docker compose ps
