param(
  [Parameter(Mandatory = $true)][string]$ZipUrl,
  [Parameter(Mandatory = $true)][string]$ExpectedSha256,
  [Parameter(Mandatory = $true)][long]$ExpectedSize,
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [int]$WaitPid = 0,
  [string]$ExeName = 'Sapphire3.exe'
)

# Helper de mise a jour embarque dans le paquet : telecharge l'archive, verifie taille et SHA-256,
# remplace les fichiers distribues puis relance l'application. Les donnees utilisateur ne sont pas touchees.
$ErrorActionPreference = 'Stop'
$logPath = Join-Path $env:TEMP 'sapphire3-update.log'

function Write-Log([string]$message) {
  try { Add-Content -Path $logPath -Value ("[{0}] {1}" -f (Get-Date -Format o), $message) -Encoding UTF8 } catch { }
}

function Assert-SafeUrl([string]$value) {
  $uri = [Uri]$value
  if ($uri.Scheme -ne 'https' -or $uri.Host -ne 'github.com' -or -not $uri.AbsolutePath.StartsWith('/lalBi94/Sapphire3/releases/download/')) {
    throw "URL de mise a jour refusee."
  }
}

$tempDir = Join-Path $env:TEMP ("sapphire3-update-" + [Guid]::NewGuid().ToString('N'))
try {
  Write-Log "debut pid=$WaitPid url=$ZipUrl"
  Assert-SafeUrl $ZipUrl

  # Attendre la fermeture complete de l'application.
  if ($WaitPid -gt 0) {
    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $deadline -and (Get-Process -Id $WaitPid -ErrorAction SilentlyContinue)) {
      Start-Sleep -Milliseconds 250
    }
    if (Get-Process -Id $WaitPid -ErrorAction SilentlyContinue) { throw "L'application ne s'est pas fermee." }
  }

  New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
  $zipPath = Join-Path $tempDir 'update.zip'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $ZipUrl -OutFile $zipPath -UseBasicParsing -MaximumRedirection 5

  $size = (Get-Item -LiteralPath $zipPath).Length
  if ($size -ne $ExpectedSize) { throw "Taille incorrecte : $size au lieu de $ExpectedSize." }
  $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $ExpectedSha256.ToLowerInvariant()) { throw "Empreinte SHA-256 incorrecte." }

  $extractDir = Join-Path $tempDir 'extract'
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
  if (-not (Test-Path -LiteralPath (Join-Path $extractDir $ExeName))) { throw "Executable absent de l'archive." }

  # Remplacer uniquement le contenu distribue ; updater.ps1 est remplace en dernier, au mieux.
  Get-ChildItem -LiteralPath $extractDir -Force | Where-Object { $_.Name -ne 'updater.ps1' } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $InstallDir -Recurse -Force
  }
  $newHelper = Join-Path $extractDir 'updater.ps1'
  if (Test-Path -LiteralPath $newHelper) {
    try { Copy-Item -LiteralPath $newHelper -Destination (Join-Path $InstallDir 'updater.ps1') -Force } catch { Write-Log ("updater.ps1 non remplace : " + $_.Exception.Message) }
  }

  Start-Process -FilePath (Join-Path $InstallDir $ExeName) -WorkingDirectory $InstallDir
  Write-Log 'mise a jour terminee'
} catch {
  Write-Log ("erreur : " + $_.Exception.Message)
} finally {
  Start-Sleep -Seconds 1
  Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
