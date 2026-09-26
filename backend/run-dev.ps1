<#
.SYNOPSIS
    Levanta los microservicios de ReservaYa en modo desarrollo.

.DESCRIPTION
    Carga backend/.env en el entorno de esta sesion (Spring Boot no lo lee
    solo) y abre una ventana de PowerShell por servicio con
    "mvnw.cmd spring-boot:run". Los procesos hijos heredan las variables.

.PARAMETER Services
    Servicios a levantar. Por defecto los cuatro, en el orden recomendado.

.PARAMETER Frontend
    Ademas del backend, arranca el servidor estatico del frontend (puerto 3000).

.PARAMETER DelaySeconds
    Pausa entre arranques para que los logs no se mezclen. 0 los lanza de golpe.

.EXAMPLE
    .\run-dev.ps1
    Levanta los cuatro servicios.

.EXAMPLE
    .\run-dev.ps1 -Services auth-service, api-gateway -Frontend
    Solo lo necesario para registro y login, mas el frontend.
#>
[CmdletBinding()]
param(
    [ValidateSet("auth-service", "restaurant-service", "reservation-service", "api-gateway")]
    [string[]]$Services = @("auth-service", "restaurant-service", "reservation-service", "api-gateway"),

    [switch]$Frontend,

    [ValidateRange(0, 120)]
    [int]$DelaySeconds = 5
)

$ErrorActionPreference = "Stop"

$backendRoot = $PSScriptRoot
$projectRoot = Split-Path $backendRoot -Parent
$envFile = Join-Path $backendRoot ".env"

# Orden de arranque recomendado (ver README): el gateway va de ultimo.
$startupOrder = @("auth-service", "restaurant-service", "reservation-service", "api-gateway")
$ports = @{
    "auth-service"        = 8081
    "restaurant-service"  = 8082
    "reservation-service" = 8083
    "api-gateway"         = 8080
}

# ---------------------------------------------------------------------
# 1. Comprobaciones previas
# ---------------------------------------------------------------------
if (-not (Test-Path $envFile)) {
    Write-Host "No existe $envFile." -ForegroundColor Red
    Write-Host "Copia .env.example como .env y rellena los valores reales." -ForegroundColor Red
    exit 1
}

# Maven compila con el JDK de JAVA_HOME, no con el "java" del PATH. Si JAVA_HOME
# apunta a un JDK viejo, el build muere con "release version 21 not supported".
function Get-JavacMajor([string]$javaHome) {
    $javac = Join-Path $javaHome "bin\javac.exe"
    if (-not (Test-Path $javac)) { return 0 }
    $salida = (& $javac -version 2>&1 | Out-String)
    if ($salida -match "javac (\d+)") { return [int]$Matches[1] }
    return 0
}

function Resolve-Jdk21 {
    if ($env:JAVA_HOME -and (Get-JavacMajor $env:JAVA_HOME) -ge 21) { return $env:JAVA_HOME }

    $candidatos = Get-ChildItem "C:\Program Files\Java" -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending
    foreach ($c in $candidatos) {
        if ((Get-JavacMajor $c.FullName) -ge 21) { return $c.FullName }
    }
    return $null
}

$jdk = Resolve-Jdk21
if (-not $jdk) {
    Write-Host "No se encontro un JDK 21+. Spring Boot 4 no compila con JDK 17 ni con 11." -ForegroundColor Red
    Write-Host "Instala JDK 21 o apunta JAVA_HOME a uno existente." -ForegroundColor Red
    exit 1
}

if ($env:JAVA_HOME -ne $jdk) {
    Write-Host "JAVA_HOME apuntaba a un JDK sin soporte para 21; se usa $jdk" -ForegroundColor Yellow
    $env:JAVA_HOME = $jdk
}

# ---------------------------------------------------------------------
# 2. Cargar el .env en esta sesion
# ---------------------------------------------------------------------
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }

    $pair = $line -split "=", 2
    if ($pair.Count -ne 2) { return }

    $name = $pair[0].Trim()
    $value = $pair[1].Trim().Trim('"')
    Set-Item -Path "env:$name" -Value $value
}

$required = @("SUPABASE_DB_URL", "SUPABASE_DB_USER", "SUPABASE_DB_PASSWORD", "JWT_SECRET")
$missing = $required | Where-Object { -not (Get-Item "env:$_" -ErrorAction SilentlyContinue).Value }

if ($missing) {
    Write-Host "Faltan variables en .env: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

Write-Host "Variables cargadas desde .env" -ForegroundColor Green

# ---------------------------------------------------------------------
# 3. Arrancar los servicios
# ---------------------------------------------------------------------
function Start-InNewWindow([string]$title, [string]$workingDirectory, [string]$commandLine) {
    $inner = "`$host.UI.RawUI.WindowTitle = '$title'; Set-Location '$workingDirectory'; $commandLine"
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $inner
}

function Test-PortInUse([int]$port) {
    $null -ne (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

$toRun = $startupOrder | Where-Object { $Services -contains $_ }
$launched = 0

foreach ($service in $toRun) {
    $port = $ports[$service]

    if (Test-PortInUse $port) {
        Write-Host "  $service omitido: el puerto $port ya esta en uso." -ForegroundColor Yellow
        continue
    }

    if ($launched -gt 0 -and $DelaySeconds -gt 0) {
        Start-Sleep -Seconds $DelaySeconds
    }

    Write-Host "  Arrancando $service en el puerto $port..." -ForegroundColor Cyan
    Start-InNewWindow "ReservaYa - $service" (Join-Path $backendRoot $service) ".\mvnw.cmd spring-boot:run"
    $launched++
}

# ---------------------------------------------------------------------
# 4. Frontend (opcional)
# ---------------------------------------------------------------------
if ($Frontend) {
    if (Test-PortInUse 3000) {
        Write-Host "  frontend omitido: el puerto 3000 ya esta en uso." -ForegroundColor Yellow
    }
    else {
        Write-Host "  Arrancando el frontend en el puerto 3000..." -ForegroundColor Cyan
        Start-InNewWindow "ReservaYa - frontend" (Join-Path $projectRoot "frontend") "npm start"
    }
}

if ($launched -eq 0 -and -not $Frontend) {
    Write-Host "No se arranco ningun servicio." -ForegroundColor Yellow
    return
}

Write-Host ""
Write-Host "Cada servicio abrio su propia ventana. El primer arranque tarda" -ForegroundColor Gray
Write-Host "mas porque Maven descarga dependencias. Ctrl+C en cada ventana para parar." -ForegroundColor Gray
