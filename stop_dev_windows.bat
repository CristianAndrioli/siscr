@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM Verificar se foi passado o parâmetro --reset
set RESET_MODE=0
if "%1"=="--reset" set RESET_MODE=1
if "%1"=="-r" set RESET_MODE=1
if "%1"=="reset" set RESET_MODE=1

if %RESET_MODE%==1 (
    goto :reset_mode
) else (
    goto :normal_stop
)

:reset_mode
echo ========================================
echo   SISCR - Encerrando e Resetando Banco de Dados
echo   ATENÇÃO: Isso apagará TODOS os dados!
echo ========================================
echo.
echo ⚠️  AVISO: Este script irá:
echo    - Parar todos os containers Docker
echo    - Remover o volume do banco de dados PostgreSQL (apaga TUDO)
echo.
echo ⚠️  Esta ação é IRREVERSÍVEL!
echo.
echo 🔒 GARANTIAS DE SEGURANÇA:
echo    - Este script APENAS afeta o banco de dados 'siscr_db'
echo    - Este script APENAS afeta containers Docker do projeto SISCR
echo    - Este script NÃO afeta outros bancos PostgreSQL no sistema
echo    - Este script NÃO afeta outros containers Docker
echo.
set /p confirm="Deseja continuar? (digite 'SIM' para confirmar): "
if /i not "!confirm!"=="SIM" (
    echo.
    echo ❌ Operação cancelada pelo usuário.
    pause
    exit /b 0
)
echo.

REM Verificar se Docker está instalado
echo [1/4] Verificando ambiente...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker não está instalado ou não está no PATH!
    pause
    exit /b 1
)
echo ✅ Docker encontrado!

REM Verificar se estamos no diretório do projeto SISCR
if not exist docker-compose.yml (
    echo ❌ Arquivo docker-compose.yml não encontrado!
    echo    Certifique-se de executar este script no diretório raiz do projeto SISCR.
    pause
    exit /b 1
)
echo ✅ Arquivo docker-compose.yml encontrado (projeto SISCR confirmado)

REM Parar containers
echo.
echo [2/4] Parando containers Docker do projeto SISCR...
docker-compose ps | findstr "siscr" >nul 2>&1
if errorlevel 1 (
    echo    ℹ️  Nenhum container do projeto SISCR está rodando
) else (
    echo    ✅ Containers do projeto SISCR encontrados
)
docker-compose down
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Erro ao parar containers (pode não estar rodando)
) else (
    echo ✅ Containers do projeto SISCR parados
)

REM Remover volumes do banco de dados
echo.
echo [3/4] Removendo volumes do banco de dados...
docker volume ls | findstr postgres_data >nul 2>&1
if %errorlevel% equ 0 (
    echo    ⚠️  Volume 'postgres_data' encontrado. Removendo...
    echo    🔒 GARANTIA: Este volume contém APENAS dados do banco 'siscr_db'
    docker volume rm postgres_data
    if %errorlevel% equ 0 (
        echo ✅ Volume postgres_data removido com sucesso!
    ) else (
        echo ⚠️  Aviso: Não foi possível remover o volume (pode estar em uso)
        echo    Tentando forçar remoção...
        docker-compose down -v
        if %errorlevel% equ 0 (
            echo ✅ Volumes removidos com sucesso!
        ) else (
            echo ⚠️  Aviso: Não foi possível remover os volumes
        )
    )
) else (
    echo ℹ️  Volume postgres_data não encontrado (já foi removido ou não existe)
)

REM Finalização
echo.
echo [4/4] Reset concluído!
echo.
echo ========================================
echo ✅ Reset do banco de dados concluído!
echo ========================================
echo.
echo 📋 Próximos passos:
echo    - Execute start_dev_windows.bat para recriar o banco do zero
echo    - Ou execute docker-compose up para iniciar os containers
echo.
echo ⚠️  IMPORTANTE: O volume do banco foi removido completamente.
echo    Todos os dados foram apagados permanentemente.
echo.
goto :end

:normal_stop
echo ========================================
echo   SISCR - Encerrando Aplicacao
echo ========================================
echo.

echo [1/2] Parando containers Docker...
docker-compose down
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Erro ao parar containers ou containers já estão parados.
) else (
    echo ✅ Containers Docker parados!
)

echo.
echo [2/2] Verificando processos do frontend...
echo.
echo ℹ️  IMPORTANTE: Se o frontend estiver rodando em uma janela separada,
echo    feche manualmente aquela janela do CMD.
echo.
echo 💡 Para verificar se ainda há processos Node.js rodando na porta 5173:
echo    netstat -ano | findstr :5173
echo.

echo ========================================
echo ✅ Aplicacao encerrada!
echo ========================================
echo.
echo 💡 Dica: Use 'stop_dev_windows.bat --reset' para também apagar o banco de dados
echo.

:end
pause

