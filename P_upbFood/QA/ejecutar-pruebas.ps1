# Levanta UPB Food con Docker y ejecuta el plan de pruebas automático.
# Todo lo que pasa queda en QA\resultados\ejecucion.log
# -RecrearBD borra el volumen de PostgreSQL y lo crea de nuevo desde DataBase\init.sql.
param([switch]$RecrearBD)
$ErrorActionPreference = 'Continue'
$qa = $PSScriptRoot
$raiz = Split-Path $qa -Parent
New-Item -ItemType Directory -Force -Path (Join-Path $qa 'resultados') | Out-Null
$log = Join-Path $qa 'resultados\ejecucion.log'
Start-Transcript -Path $log -Force | Out-Null

function Paso($texto) { Write-Host "`n=== $texto ===" -ForegroundColor Cyan }
function Fallar($texto) {
    Write-Host "`nERROR: $texto" -ForegroundColor Red
    Write-Host 'FIN_EJECUCION: ERROR'
    Stop-Transcript | Out-Null
    Read-Host 'Presiona Enter para cerrar'
    exit 1
}
function Aleatorio([int]$n) { -join ((48..57) + (65..90) + (97..122) | Get-Random -Count $n | ForEach-Object { [char]$_ }) }

Set-Location $raiz

Paso '1. Verificando Docker y Node.js'
docker info --format '{{.ServerVersion}}' 2>$null
if ($LASTEXITCODE -ne 0) { Fallar 'Docker Desktop no está corriendo. Ábrelo, espera la ballena en verde y vuelve a ejecutar.' }
node -v
if ($LASTEXITCODE -ne 0) { Fallar 'No se encontró Node.js. Instálalo desde https://nodejs.org (versión LTS) y vuelve a ejecutar.' }

Paso '2. Configuración (.env)'
$envFile = Join-Path $raiz '.env'
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $raiz '.env.example') $envFile
    $c = Get-Content $envFile -Raw
    $c = $c -replace 'POSTGRES_PASSWORD=.*', 'POSTGRES_PASSWORD=upbfood123'
    $c = $c -replace 'APP_JWT_SECRET=.*', "APP_JWT_SECRET=$(Aleatorio 48)"
    $c = $c -replace 'MAIL_USERNAME=.*', 'MAIL_USERNAME='
    $c = $c -replace 'MAIL_PASSWORD=.*', 'MAIL_PASSWORD='
    $c = $c -replace 'APP_NOTIFICACIONES_CORREO_DESTINO=.*', 'APP_NOTIFICACIONES_CORREO_DESTINO='
    $c = $c -replace 'STRIPE_SECRET_KEY=.*', 'STRIPE_SECRET_KEY='
    $c = $c -replace 'STRIPE_PUBLISHABLE_KEY=.*', 'STRIPE_PUBLISHABLE_KEY='
    Set-Content -Path $envFile -Value $c -NoNewline
    Write-Host 'Se creó P_upbFood\.env a partir de .env.example.'
}
$c = Get-Content $envFile -Raw
if ($c -notmatch '(?m)^APP_UPB_REVISOR_CLAVE=\S+') {
    if ($c -match '(?m)^APP_UPB_REVISOR_CLAVE=') {
        $c = $c -replace '(?m)^APP_UPB_REVISOR_CLAVE=.*', "APP_UPB_REVISOR_CLAVE=$(Aleatorio 32)"
    } else {
        $c = $c.TrimEnd() + "`r`nAPP_UPB_REVISOR_CLAVE=$(Aleatorio 32)`r`n"
    }
    Set-Content -Path $envFile -Value $c -NoNewline
    Write-Host 'Se agregó APP_UPB_REVISOR_CLAVE al .env.'
}
if ($c -match '(?m)^APP_UPB_REVISOR_CLAVE=cambia-esta-clave-institucional') {
    $c = $c -replace '(?m)^APP_UPB_REVISOR_CLAVE=.*', "APP_UPB_REVISOR_CLAVE=$(Aleatorio 32)"
    Set-Content -Path $envFile -Value $c -NoNewline
}

if ($RecrearBD) {
    Paso '3a. Recreando la base de datos desde init.sql (se borran los datos locales)'
    docker compose down -v
}

Paso '3. Base de datos y migración de horario'
docker compose up -d db
if ($LASTEXITCODE -ne 0) { Fallar 'No se pudo iniciar el contenedor de PostgreSQL.' }
$listo = $false
for ($i = 0; $i -lt 40; $i++) {
    docker exec upbfood-db pg_isready -U upbfood -d upbfood 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $listo = $true; break }
    Start-Sleep -Seconds 3
}
if (-not $listo) { Fallar 'PostgreSQL no quedó listo a tiempo.' }
Start-Sleep -Seconds 3
Get-Content (Join-Path $raiz 'DataBase\migrations\20261028_horario_restaurante.sql') -Raw |
    docker exec -i upbfood-db psql -U upbfood -d upbfood

# Si el volumen de PostgreSQL ya existía, su contraseña puede no coincidir con la del .env.
$claveDb = ((Get-Content $envFile) | Where-Object { $_ -match '^POSTGRES_PASSWORD=' }) -replace '^POSTGRES_PASSWORD=', ''
docker exec upbfood-db psql -U upbfood -d upbfood -c "ALTER USER upbfood WITH PASSWORD '$claveDb';"

Paso '4. Construyendo y levantando backend y frontend (puede tardar varios minutos)'
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { Fallar 'docker compose up --build falló (ver arriba).' }

Write-Host 'Esperando a que el backend responda en http://localhost:8080 ...'
$arriba = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:8080/api/restaurantes' -TimeoutSec 5
        if ($r.StatusCode -eq 200) { $arriba = $true; break }
    } catch { }
    Start-Sleep -Seconds 5
}
if (-not $arriba) {
    $logBackend = Join-Path $qa 'resultados\backend.log'
    cmd /c "docker compose logs --no-color --tail=300 backend > `"$logBackend`" 2>&1"
    Write-Host "Log del backend guardado en $logBackend"
    Fallar 'El backend no respondió en 5 minutos (ver logs arriba).'
}
Write-Host 'Backend listo.'
cmd /c "docker compose ps > `"$(Join-Path $qa 'resultados\servicios.log')`" 2>&1"

Paso '5. Instalando dependencias de la suite de pruebas'
Set-Location $qa
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fallar 'npm install falló.' }

Paso '6. Ejecutando el plan de pruebas'
npm test
$codigo = $LASTEXITCODE

Paso 'Resultado'
Write-Host "Código de salida: $codigo (0 = todo OK, 2 = hay criterios en ERROR)"
Write-Host 'FIN_EJECUCION: COMPLETA'
Stop-Transcript | Out-Null
Read-Host 'Listo. Presiona Enter para cerrar'
