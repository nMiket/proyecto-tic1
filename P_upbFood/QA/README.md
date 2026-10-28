# Plan de pruebas automático — UPB Food

Ejecuta los **198 criterios que estaban en PENDIENTE** en `Plan_de_Pruebas_UPB.xlsx` (HU001–HU031) contra la aplicación real y llena las columnas *Resultado obtenido* y *Estado*.

## Requisitos

- Docker Desktop con la aplicación levantada: desde `P_upbFood`, `docker compose up --build -d`.
- Si tu base de datos ya existía, aplica una vez la columna nueva de horario (si no, el backend no arranca):
  ```powershell
  cd P_upbFood
  Get-Content DataBase\migrations\20261028_horario_restaurante.sql | docker exec -i upbfood-db psql -U upbfood -d upbfood
  docker compose restart backend
  ```
- Node.js 18 o superior.
- En `P_upbFood/.env`, la variable `APP_UPB_REVISOR_CLAVE` con un valor (la usan las pruebas del panel UPB, HU031).

## Ejecutar

```powershell
cd P_upbFood\QA
npm install        # instala Playwright, pg y exceljs, y descarga Chromium
npm test
```

Tarda entre 3 y 6 minutos. Al final verás el conteo de OK / ERROR / PENDIENTE y se generan:

- `resultados/Plan_de_Pruebas_UPB_resultados.xlsx`: el plan con cada criterio diligenciado (la hoja *Resumen* se recalcula al abrirlo).
- `resultados/reporte.md`: tabla con el resultado de cada criterio.
- `resultados/capturas/`: capturas de pantalla como evidencia.
- `resultados/maven.log`: salida de las pruebas JUnit (HU024 y HU026).

## Qué hace

- Lee la configuración de `P_upbFood/.env` (base de datos, clave UPB, puerto del frontend).
- Usa las cuentas sembradas `admin@upb.edu.co` y `admin2@upb.edu.co`. Si las cambiaste, define `QA_OWNER1_EMAIL`, `QA_OWNER1_PASSWORD`, `QA_OWNER2_EMAIL` y `QA_OWNER2_PASSWORD`.
- Crea datos de prueba con el prefijo **QA** (productos, extras, pedidos, un administrador de cocina, solicitudes de registro) y al final restaura la configuración de la cafetería 1, desactiva los productos QA y retira los accesos creados. Los pedidos QA quedan en el historial.
- Respeta los límites de peticiones del backend: si hace falta espera unos segundos.
- Ejecuta `AdminAuthorizationServiceTest` y `ProductControllerTest` con `mvnw`; si no tienes Java 21, los corre dentro de Docker (`maven:3.9-eclipse-temurin-21`). Usa `QA_SKIP_MAVEN=1` para omitirlos.

## Variables opcionales

| Variable | Uso | Valor por defecto |
|---|---|---|
| `QA_FRONT_URL` | URL del frontend | `http://localhost` (o el `FRONTEND_PORT` del `.env`) |
| `QA_API_URL` | URL del backend | `http://localhost:8080` |
| `QA_HEADLESS` | `false` para ver el navegador mientras prueba | `true` |
| `QA_SKIP_MAVEN` | `1` para no correr JUnit | — |

El registro de cafeterías tiene un límite de 5 solicitudes cada 15 minutos por IP; si ejecutas la suite dos veces seguidas, espera 15 minutos entre corridas.
