<#
.SYNOPSIS
    Levanta los microservicios Django de ReservaYa en modo desarrollo.

.DESCRIPTION
    Abre una ventana de PowerShell por servicio con "python manage.py runserver".
    Cada servicio lee backend\.env por su cuenta. Usa el entorno virtual
    backend\.venv (crealo con .\setup-dev.ps1).

.PARAMETER Services
    Servicios a levantar. Por defecto los cuatro.

.PARAMETER Frontend
    Ademas del backend, arranca el frontend React (npm run dev, puerto 3000).

.EXAMPLE
    .\run-dev.ps1 -Frontend
#>
[CmdletBinding()]
param(
    [ValidateSet("auth_service", "restaurant_service", "reservation_service", "gateway")]
    [string[]]$Services = @("auth_service", "restaurant_service", "reservation_service", "gateway"),
    [switch]$Frontend
)
$ErrorActionPreference = "Stop"
$backend = $PSScriptRoot
$python = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) { throw "No existe backend\.venv. Ejecuta primero .\setup-dev.ps1" }
if (-not (Test-Path (Join-Path $backend ".env"))) { throw "Falta backend\.env (copia .env.example y rellenalo)." }

$ports = @{ auth_service = 8081; restaurant_service = 8082; reservation_service = 8083; gateway = 8080 }
foreach ($service in $Services) {
    $port = $ports[$service]
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        Write-Host "$service ya esta corriendo en el puerto $port (se omite)." -ForegroundColor Yellow
        continue
    }
    $dir = Join-Path $backend $service
    $title = "$service :$port"
    Start-Process powershell -ArgumentList "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location '$dir'; & '$python' manage.py runserver 0.0.0.0:$port"
    Write-Host "$service -> http://localhost:$port"
}

if ($Frontend) {
    $frontendDir = Join-Path (Split-Path $backend -Parent) "frontend"
    Start-Process powershell -ArgumentList "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle = 'frontend :3000'; Set-Location '$frontendDir'; npm run dev"
    Write-Host "frontend -> http://localhost:3000"
}
