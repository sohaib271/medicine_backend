$ErrorActionPreference = 'Stop'
$backupDir = 'D:\ZainabBackups'
$uri = 'mongodb://127.0.0.1:27017/?replicaSet=rs0'
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$partial = Join-Path $backupDir "mongo-$stamp.partial"
$finished = Join-Path $backupDir "mongo-$stamp.archive.gz"

& mongodump.exe --uri=$uri --oplog --gzip --archive=$partial
if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $partial -ErrorAction SilentlyContinue
    throw "MongoDB backup failed with exit code $LASTEXITCODE"
}

Move-Item -LiteralPath $partial -Destination $finished
Write-Output "Backup completed: $finished"