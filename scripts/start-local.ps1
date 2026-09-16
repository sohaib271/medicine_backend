$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$node = 'C:\nvm4w\nodejs\node.exe'

Set-Location $backend
$env:LOCAL_DESKTOP = 'true'
$env:NODE_ENV = 'production'

if (-not (Test-Path $node)) { throw "Node.js was not found: $node" }
if (-not (Test-Path 'dist\main.js')) { throw 'Build the backend first.' }
if (-not (Test-Path '..\medicine_frontend\dist\index.html')) {
    throw 'Build the frontend first.'
}

New-Item -ItemType Directory -Force '.data' | Out-Null

# Give MongoDB time to start after Windows boots.
for ($attempt = 1; $attempt -le 30; $attempt++) {
    & $node 'scripts\check-db.cjs' *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
}
if ($LASTEXITCODE -ne 0) { throw 'MongoDB did not become ready.' }

& $node 'dist\main.js' *>> '.data\app.log'
exit $LASTEXITCODE