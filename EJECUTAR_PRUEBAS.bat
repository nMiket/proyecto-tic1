@echo off
rem Doble clic para levantar UPB Food con Docker y ejecutar el plan de pruebas.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0P_upbFood\QA\ejecutar-pruebas.ps1"
