<#
.SYNOPSIS
    Ejecuta las pruebas de los 4 servicios contra un PostgreSQL 16 LOCAL.

.DESCRIPTION
    Por defecto levanta un contenedor de prueba (docker-compose.test.yml,
    puerto 5433). Si ya tienes PostgreSQL instalado, pasa -DatabaseUrl y no
    se usa Docker. Las pruebas NUNCA se ejecutan contra Supabase.

.EXAMPLE
    .\run-tests.ps1
    .\run-tests.ps1 -DatabaseUrl "postgresql://postgres:clave@localhost:5432/postgres"
#>
param([string]$DatabaseUrl = "")
$ErrorActionPreference = "Stop"
$backend = $PSScriptRoot
$python = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) { throw "No existe backend\.venv. Ejecuta primero .\setup-dev.ps1" }

if (-not $DatabaseUrl) {
    docker compose -f (Join-Path $backend "docker-compose.test.yml") up -d --wait
    $DatabaseUrl = "postgresql://postgres:postgres@localhost:5433/postgres"
}
$env:TEST_DATABASE_URL = $DatabaseUrl

$failed = @()
Push-Location (Join-Path $backend "common")
& $python -m pytest -q tests
if ($LASTEXITCODE -ne 0) { $failed += "common" }
Pop-Location
foreach ($service in "auth_service", "restaurant_service", "reservation_service", "gateway") {
    Write-Host "`n=== $service ===" -ForegroundColor Cyan
    Push-Location (Join-Path $backend $service)
    & $python -m pytest
    if ($LASTEXITCODE -ne 0) { $failed += $service }
    Pop-Location
}
if ($failed.Count) { Write-Host "`nFallaron: $($failed -join ', ')" -ForegroundColor Red; exit 1 }
Write-Host "`nTodas las pruebas pasaron." -ForegroundColor Green
