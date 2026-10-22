@echo off
rem ============================================================
rem  LogiFlow - correr os testes automaticos (duplo clique)
rem ============================================================
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" goto :nao_instalado
".venv\Scripts\python.exe" -m pip install -r requirements-dev.txt >nul
if errorlevel 1 goto :erro_pip
".venv\Scripts\python.exe" -m pytest
echo.
pause
exit /b 0

:nao_instalado
echo Faca primeiro duplo clique em instalar.bat
pause
exit /b 1

:erro_pip
echo [ERRO] Nao foi possivel instalar o pytest. Confirme a ligacao a internet.
pause
exit /b 1
