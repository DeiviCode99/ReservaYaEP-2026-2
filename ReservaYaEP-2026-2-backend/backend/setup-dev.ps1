<#
.SYNOPSIS
    Prepara el entorno de desarrollo: entorno virtual de Python del backend y
    dependencias del frontend. Se ejecuta una sola vez (o al cambiar dependencias).

.EXAMPLE
    .\setup-dev.ps1
#>
$ErrorActionPreference = "Stop"
$backend = $PSScriptRoot
$frontend = Join-Path (Split-Path $backend -Parent) "frontend"

if (-not (Test-Path (Join-Path $backend ".venv"))) {
    Write-Host "Creando backend\.venv ..."
    py -3.12 -m venv (Join-Path $backend ".venv") 2>$null
    if ($LASTEXITCODE -ne 0) { python -m venv (Join-Path $backend ".venv") }
}
$python = Join-Path $backend ".venv\Scripts\python.exe"
& $python -m pip install --upgrade pip
& $python -m pip install -r (Join-Path $backend "requirements-dev.txt")

if (-not (Test-Path (Join-Path $backend ".env"))) {
    Copy-Item (Join-Path $backend ".env.example") (Join-Path $backend ".env")
    Write-Host "Se creo backend\.env a partir de .env.example: rellena los valores reales." -ForegroundColor Yellow
}

Push-Location $frontend
npm install
Pop-Location
Write-Host "Listo. Arranca todo con: .\run-dev.ps1 -Frontend" -ForegroundColor Green
