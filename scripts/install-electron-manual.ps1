param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$MirrorBase = "https://npmmirror.com/mirrors/electron",
  [int]$ChunkSizeMB = 8,
  [int]$RetriesPerChunk = 5
)

$ErrorActionPreference = "Stop"

if ($ChunkSizeMB -lt 1) {
  throw "ChunkSizeMB must be at least 1."
}

if ($RetriesPerChunk -lt 1) {
  throw "RetriesPerChunk must be at least 1."
}

$electronPkgPath = Join-Path $ProjectRoot "node_modules/electron/package.json"
if (!(Test-Path $electronPkgPath)) {
  throw "Missing node_modules/electron/package.json. Run: npm install --ignore-scripts"
}

$electronPkg = Get-Content $electronPkgPath | ConvertFrom-Json
$version = $electronPkg.version
if ([string]::IsNullOrWhiteSpace($version)) {
  throw "Could not determine Electron version from package.json"
}

$zipUrl = "$MirrorBase/v$version/electron-v$version-win32-x64.zip"
$zipPath = Join-Path $env:TEMP "electron-v$version-win32-x64.zip"
$partPath = "$zipPath.part"
$chunkBytes = $ChunkSizeMB * 1024 * 1024

Write-Host "Electron version: $version"
Write-Host "Downloading from: $zipUrl"

$head = Invoke-WebRequest -Uri $zipUrl -Method Head -UseBasicParsing -TimeoutSec 30
$totalBytes = [int64]$head.Headers["Content-Length"]
if ($totalBytes -le 0) {
  throw "Could not read Content-Length from $zipUrl"
}

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}
if (Test-Path $partPath) {
  Remove-Item $partPath -Force
}

$stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)

try {
  $offset = 0L
  while ($offset -lt $totalBytes) {
    $end = [Math]::Min($offset + $chunkBytes - 1, $totalBytes - 1)
    $expected = $end - $offset + 1

    $ok = $false
    for ($attempt = 1; $attempt -le $RetriesPerChunk; $attempt++) {
      if (Test-Path $partPath) {
        Remove-Item $partPath -Force
      }

      & curl.exe -L --fail --silent --show-error --range "$offset-$end" "$zipUrl" -o "$partPath"
      $exitCode = $LASTEXITCODE

      if ($exitCode -eq 0 -and (Test-Path $partPath)) {
        $size = (Get-Item $partPath).Length
        if ($size -eq $expected) {
          $ok = $true
          break
        }
      }

      Start-Sleep -Seconds 1
    }

    if (-not $ok) {
      throw "Failed to download chunk $offset-$end after $RetriesPerChunk attempts"
    }

    $bytes = [System.IO.File]::ReadAllBytes($partPath)
    $stream.Write($bytes, 0, $bytes.Length)
    Remove-Item $partPath -Force

    $offset = $end + 1
    $pct = [int](($offset * 100) / $totalBytes)
    Write-Progress -Activity "Downloading Electron" -Status "$offset / $totalBytes bytes" -PercentComplete $pct
  }
}
finally {
  $stream.Dispose()
}

$actualBytes = (Get-Item $zipPath).Length
if ($actualBytes -ne $totalBytes) {
  throw "Downloaded size mismatch. Expected $totalBytes, got $actualBytes"
}

$distPath = Join-Path $ProjectRoot "node_modules/electron/dist"
if (Test-Path $distPath) {
  Remove-Item -Recurse -Force $distPath
}
New-Item -ItemType Directory -Path $distPath | Out-Null

Expand-Archive -Path $zipPath -DestinationPath $distPath -Force
Set-Content -Path (Join-Path $ProjectRoot "node_modules/electron/path.txt") -Value "electron.exe" -NoNewline

$typedefInDist = Join-Path $distPath "electron.d.ts"
if (Test-Path $typedefInDist) {
  Move-Item $typedefInDist (Join-Path $ProjectRoot "node_modules/electron/electron.d.ts") -Force
}

Write-Host "Electron binary installed successfully."
Write-Host "You can now run: npm start"
