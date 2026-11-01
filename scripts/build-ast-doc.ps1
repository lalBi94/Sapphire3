$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$documentDirectory = Join-Path $projectRoot 'abstract'
$outputDirectory = Join-Path $projectRoot 'build\latex'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
Push-Location $documentDirectory
try {
    & pdflatex --disable-installer -interaction=nonstopmode -halt-on-error "-output-directory=$outputDirectory" ARCHITECTURE_AST.tex
    if ($LASTEXITCODE -ne 0) { throw 'La compilation LaTeX a échoué.' }
    Copy-Item (Join-Path $outputDirectory 'ARCHITECTURE_AST.pdf') (Join-Path $documentDirectory 'ARCHITECTURE_AST.pdf') -Force
} finally {
    Pop-Location
}
