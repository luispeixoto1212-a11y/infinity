@echo off
rem ============================================================
rem  LogiFlow - iniciar a aplicacao (duplo clique)
rem  Abre o navegador em http://localhost:8501
rem ============================================================
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" goto :nao_instalado

echo.
echo  LogiFlow a iniciar ... o navegador vai abrir sozinho.
echo  Se nao abrir, use o endereco indicado abaixo em "Local URL".
echo  Mantenha esta janela aberta enquanto usa a aplicacao.
echo  Para fechar a aplicacao, feche esta janela ou carregue Ctrl+C.
echo.
".venv\Scripts\python.exe" -m streamlit run app.py
if errorlevel 1 goto :erro
exit /b 0

:nao_instalado
echo A aplicacao ainda nao esta instalada.
echo Faca primeiro duplo clique em instalar.bat
echo.
pause
exit /b 1

:erro
echo.
echo [ERRO] A aplicacao terminou com um erro. Veja as mensagens acima.
echo Se o problema persistir, feche outras janelas do LogiFlow e tente de novo.
pause
exit /b 1
