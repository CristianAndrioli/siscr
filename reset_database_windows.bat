@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   SISCR - Reset Completo do Banco de Dados
echo   ATENÇÃO: Isso apagará TODOS os dados!
echo ========================================
echo.
echo ⚠️  AVISO: Este script irá:
echo    - Parar todos os containers Docker
echo    - Remover o volume do banco de dados PostgreSQL
echo    - Apagar TODOS os tenants e dados do schema público
echo.
echo ⚠️  Esta ação é IRREVERSÍVEL!
echo.
set /p confirm="Deseja continuar? (digite 'SIM' para confirmar): "
if /i not "%confirm%"=="SIM" (
    echo.
    echo ❌ Operação cancelada pelo usuário.
    pause
    exit /b 0
)
echo.

REM ========================================
REM Passo 1: Verificar se Docker está instalado
REM ========================================
echo [1/5] Verificando Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker não está instalado ou não está no PATH!
    pause
    exit /b 1
)
echo ✅ Docker encontrado!

REM ========================================
REM Passo 2: Parar containers
REM ========================================
echo.
echo [2/5] Parando containers Docker...
docker-compose down
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Erro ao parar containers (pode não estar rodando)
)

REM ========================================
REM Passo 3: Remover volumes do banco de dados
REM ========================================
echo.
echo [3/5] Removendo volumes do banco de dados...
docker volume ls | findstr postgres_data >nul 2>&1
if %errorlevel% equ 0 (
    docker volume rm postgres_data
    if %errorlevel% equ 0 (
        echo ✅ Volume postgres_data removido com sucesso!
    ) else (
        echo ⚠️  Aviso: Não foi possível remover o volume (pode não existir)
    )
) else (
    echo ℹ️  Volume postgres_data não encontrado (já foi removido ou não existe)
)

REM ========================================
REM Passo 4: Limpar via SQL (caso o volume não tenha sido removido)
REM ========================================
echo.
echo [4/5] Iniciando containers para limpeza via SQL...
docker-compose up -d db
if %errorlevel% neq 0 (
    echo ❌ Erro ao iniciar container do banco de dados
    pause
    exit /b 1
)

REM Aguardar banco ficar pronto
echo    Aguardando banco de dados ficar pronto...
timeout /t 5 /nobreak >nul

REM Tentar limpar via SQL
echo    Limpando dados via SQL...
docker-compose exec -T db psql -U postgres -d siscr_db -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Schema público limpo!
) else (
    echo ⚠️  Aviso: Não foi possível limpar via SQL (banco pode estar vazio)
)

REM Remover todos os schemas de tenants
echo    Removendo schemas de tenants...
REM Criar arquivo SQL temporário
echo DO $$ > %TEMP%\drop_tenants.sql
echo DECLARE r RECORD; >> %TEMP%\drop_tenants.sql
echo BEGIN >> %TEMP%\drop_tenants.sql
echo   FOR r IN (SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1', 'public') AND schema_name NOT LIKE 'pg_%%') >> %TEMP%\drop_tenants.sql
echo   LOOP >> %TEMP%\drop_tenants.sql
echo     EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(r.schema_name) || ' CASCADE'; >> %TEMP%\drop_tenants.sql
echo   END LOOP; >> %TEMP%\drop_tenants.sql
echo END $$; >> %TEMP%\drop_tenants.sql

docker-compose exec -T db psql -U postgres -d siscr_db -f %TEMP%\drop_tenants.sql 2>nul
if %errorlevel% equ 0 (
    echo ✅ Schemas de tenants removidos!
    del %TEMP%\drop_tenants.sql 2>nul
) else (
    echo ⚠️  Aviso: Não foi possível remover schemas de tenants (pode não haver tenants)
    del %TEMP%\drop_tenants.sql 2>nul
)

REM ========================================
REM Passo 5: Parar containers novamente
REM ========================================
echo.
echo [5/5] Parando containers...
docker-compose down
if %errorlevel% equ 0 (
    echo ✅ Containers parados!
) else (
    echo ⚠️  Aviso: Erro ao parar containers
)

echo.
echo ========================================
echo ✅ Reset do banco de dados concluído!
echo ========================================
echo.
echo 📋 Próximos passos:
echo    1. Execute start_dev_windows.bat para recriar o banco
echo    2. Ou execute docker-compose up para iniciar os containers
echo.
pause

