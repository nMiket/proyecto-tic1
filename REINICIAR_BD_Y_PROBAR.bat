@echo off
rem Borra la base de datos local de Docker, la recrea desde init.sql y ejecuta el plan de pruebas.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0P_upbFood\QA\ejecutar-pruebas.ps1" -RecrearBD
