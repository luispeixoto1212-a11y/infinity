@echo off
rem ============================================================
rem  LogiFlow - instalacao (correr uma vez; duplo clique)
rem  Cria um ambiente Python isolado na pasta .venv e instala
rem  as dependencias indicadas em requirements.txt.
rem ============================================================
setlocal
cd /d "%~dp0"
echo.
echo  LogiFlow - Instalacao
echo  ---------------------
echo.

rem 1. Encontrar o Python. O "py" e instalado com o Python oficial de python.org.
rem    Procuram-se primeiro as versoes testadas, pela ordem de preferencia.
set "PYTHON="
for %%v in (3.13 3.12 3.14 3.11) do (
    if not defined PYTHON py -%%v -c "import sys" >nul 2>nul && set "PYTHON=py -%%v"
)
if not defined PYTHON where python >nul 2>nul && set "PYTHON=python"
if not defined PYTHON goto :sem_python

rem 2. Confirmar que a versao e 3.11 ou superior.
%PYTHON% -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul
if errorlevel 1 goto :python_antigo
for /f "delims=" %%v in ('%PYTHON% --version') do echo Encontrado: %%v

rem 3. Criar o ambiente virtual, se ainda nao existir.
if exist ".venv\Scripts\python.exe" goto :dependencias
echo A criar o ambiente virtual na pasta .venv ...
%PYTHON% -m venv .venv
if errorlevel 1 goto :erro_venv

:dependencias
echo A instalar as dependencias. Na primeira vez pode demorar alguns minutos ...
".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :erro_pip

echo.
echo  Instalacao concluida.
echo  Para abrir a aplicacao, faca duplo clique em iniciar.bat
echo.
pause
exit /b 0

:sem_python
echo [ERRO] O Python nao foi encontrado neste computador.
echo Instale o Python 3.13 a partir de https://www.python.org/downloads/
echo e, no primeiro ecra do instalador, marque "Add python.exe to PATH".
echo Depois feche esta janela e volte a correr instalar.bat
goto :falhou

:python_antigo
echo [ERRO] O Python encontrado nao funciona ou e anterior a versao 3.11.
echo Se o Windows abrir a Microsoft Store, isso significa que o Python nao esta instalado.
echo Instale o Python 3.13 a partir de https://www.python.org/downloads/
goto :falhou

:erro_venv
echo [ERRO] Nao foi possivel criar o ambiente virtual na pasta .venv
echo Confirme que tem permissao de escrita nesta pasta.
goto :falhou

:erro_pip
echo [ERRO] A instalacao das dependencias falhou. Veja as mensagens acima.
echo Confirme que tem ligacao a internet e volte a correr instalar.bat
goto :falhou

:falhou
echo.
pause
exit /b 1
