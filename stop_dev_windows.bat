@echo off
chcp 65001 >nul
echo ========================================
echo   SISCR - Encerrando Aplicacao
echo ========================================
echo.

echo [1/2] Parando containers Docker...
docker-compose down
if %errorlevel% neq 0 (
    echo AVISO: Erro ao parar containers ou containers ja estao parados.
) else (
    echo OK: Containers Docker parados!
)

echo.
echo [2/2] Verificando processos do frontend...
echo.
echo IMPORTANTE: Se o frontend estiver rodando em uma janela separada,
echo    feche manualmente aquela janela do CMD.
echo.
echo Para verificar se ainda ha processos Node.js rodando na porta 5173:
echo    netstat -ano | findstr :5173
echo.

echo ========================================
echo   Aplicacao encerrada!
echo ========================================
echo.
pause

