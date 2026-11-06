param(
  [Parameter(Mandatory = $true)][string[]]$Path,
  [string]$PfxPath = $env:SAPPHIRE_SIGN_PFX,
  [string]$PfxPassword = $env:SAPPHIRE_SIGN_PASSWORD,
  [string]$Thumbprint = $env:SAPPHIRE_SIGN_THUMBPRINT,
  [string]$TimestampUrl = $(if ($env:SAPPHIRE_TIMESTAMP_URL) { $env:SAPPHIRE_TIMESTAMP_URL } else { 'http://timestamp.digicert.com' }),
  [string]$Description = 'Sapphire 3',
  [string]$ProductUrl = 'https://github.com/lalBi94/Sapphire3',
  [switch]$SkipTimestamp
)

$ErrorActionPreference = 'Stop'

# Finds signtool.exe in the installed Windows SDK, or through SIGTOOL_PATH.
function Find-SignTool {
  if ($env:SIGTOOL_PATH -and (Test-Path $env:SIGTOOL_PATH)) { return $env:SIGTOOL_PATH }
  $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $kits = 'C:\Program Files (x86)\Windows Kits\10\bin'
  if (Test-Path $kits) {
    $candidate = Get-ChildItem $kits -Directory |
      Sort-Object Name -Descending |
      ForEach-Object { Join-Path $_.FullName 'x64\signtool.exe' } |
      Where-Object { Test-Path $_ } |
      Select-Object -First 1
    if ($candidate) { return $candidate }
  }
  throw 'signtool.exe not found. Install the Windows SDK or set SIGTOOL_PATH.'
}

# Fails explicitly on an incomplete configuration instead of producing an unsigned package silently.
if (-not $PfxPath -and -not $Thumbprint) {
  throw 'No certificate configured. Set SAPPHIRE_SIGN_PFX (+ SAPPHIRE_SIGN_PASSWORD) or SAPPHIRE_SIGN_THUMBPRINT.'
}
if ($PfxPath -and -not (Test-Path $PfxPath)) {
  throw "PFX file not found: $PfxPath"
}

$signTool = Find-SignTool
$arguments = @('sign', '/fd', 'SHA256', '/d', $Description, '/du', $ProductUrl)
if ($SkipTimestamp) {
  $arguments += @('/t', $TimestampUrl)
} else {
  $arguments += @('/tr', $TimestampUrl, '/td', 'SHA256')
}
if ($PfxPath) {
  $arguments += @('/f', $PfxPath)
  if ($PfxPassword) { $arguments += @('/p', $PfxPassword) }
} else {
  $arguments += @('/sha1', $Thumbprint)
}

foreach ($file in $Path) {
  if (-not (Test-Path $file)) { throw "File to sign not found: $file" }
  Write-Host "Signing: $file"
  & $signTool @arguments $file
  if ($LASTEXITCODE -ne 0) { throw "signtool failed for $file (exit code $LASTEXITCODE)." }
}

# Verifies the result with the same API Windows uses, and fails when the chain is not valid.
$failed = @()
foreach ($file in $Path) {
  $signature = Get-AuthenticodeSignature -FilePath $file
  if ($signature.Status -ne 'Valid') {
    $failed += "$file : $($signature.Status) - $($signature.StatusMessage)"
  } else {
    Write-Host "Signature verified: $($signature.SignerCertificate.Subject)"
  }
}
if ($failed.Count -gt 0) {
  throw ("Invalid signature:`n" + ($failed -join "`n"))
}

Write-Host 'All requested files are signed and verified.'
