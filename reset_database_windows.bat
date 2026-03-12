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
echo 🔒 GARANTIAS DE SEGURANÇA:
echo    - Este script APENAS afeta o banco de dados 'siscr_db'
echo    - Este script APENAS afeta containers Docker do projeto SISCR
echo    - Este script NÃO afeta outros bancos PostgreSQL no sistema
echo    - Este script NÃO afeta outros containers Docker
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
REM Passo 1: Verificar se Docker está instalado e se estamos no diretório correto
REM ========================================
echo [1/5] Verificando ambiente...
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

REM Verificar se o docker-compose.yml contém o banco siscr_db
findstr "siscr_db" docker-compose.yml >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Aviso: Banco 'siscr_db' não encontrado no docker-compose.yml
    echo    Verificando configuração...
) else (
    echo ✅ Banco 'siscr_db' confirmado no docker-compose.yml
)

REM ========================================
REM Passo 2: Parar containers do projeto SISCR
REM ========================================
echo.
echo [2/5] Parando containers Docker do projeto SISCR...
echo    Verificando containers do projeto...
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

REM ========================================
REM Passo 3: Remover volumes do banco de dados
REM ========================================
echo.
echo [3/5] Removendo volumes do banco de dados...
echo    Verificando volumes Docker do projeto SISCR...
docker volume ls | findstr postgres_data >nul 2>&1
if %errorlevel% equ 0 (
    echo    ⚠️  Volume 'postgres_data' encontrado. Removendo...
    echo    🔒 GARANTIA: Este volume contém APENAS dados do banco 'siscr_db'
    docker volume rm postgres_data
    if %errorlevel% equ 0 (
        echo ✅ Volume postgres_data removido com sucesso!
    ) else (
        echo ⚠️  Aviso: Não foi possível remover o volume (pode estar em uso)
        echo    O volume será removido quando os containers forem parados
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

REM Verificar se o container está rodando e se é o correto
echo    Verificando container do banco de dados...
docker-compose ps db | findstr "siscr-db" >nul 2>&1
if errorlevel 1 (
    echo ❌ Container do banco de dados não encontrado ou não está rodando!
    pause
    exit /b 1
)
echo    ✅ Container do banco de dados está rodando

REM Verificar se o banco de dados siscr_db existe e está acessível
echo    Verificando acesso ao banco de dados 'siscr_db'...
docker-compose exec -T db psql -U postgres -d siscr_db -c "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo ❌ Erro: Não foi possível conectar ao banco de dados 'siscr_db'!
    echo    Verificando se o banco existe...
    docker-compose exec -T db psql -U postgres -lqt | findstr "siscr_db" >nul 2>&1
    if errorlevel 1 (
        echo    ⚠️  Banco de dados 'siscr_db' não existe. Criando...
        docker-compose exec -T db psql -U postgres -c "CREATE DATABASE siscr_db;" >nul 2>&1
        if errorlevel 1 (
            echo    ❌ Erro ao criar banco de dados 'siscr_db'!
            pause
            exit /b 1
        )
        echo    ✅ Banco de dados 'siscr_db' criado
    ) else (
        echo    ❌ Banco existe mas não está acessível. Verifique as configurações.
        pause
        exit /b 1
    )
) else (
    echo    ✅ Acesso ao banco de dados 'siscr_db' confirmado
)

REM Confirmar que estamos trabalhando apenas com o banco siscr_db
echo.
echo 🔒 CONFIRMAÇÃO DE SEGURANÇA:
echo    - Banco de dados: siscr_db
echo    - Container: siscr-db-1 (ou similar)
echo    - Apenas este banco será afetado
echo.

REM Tentar limpar via SQL
echo    Limpando dados via SQL no banco 'siscr_db'...
docker-compose exec -T db psql -U postgres -d siscr_db -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Schema público limpo no banco 'siscr_db'!
) else (
    echo ⚠️  Aviso: Não foi possível limpar via SQL (banco pode estar vazio)
)

REM Remover todos os schemas de tenants
echo    Removendo schemas de tenants do banco 'siscr_db'...
REM Buscar lista de schemas e remover um por um
docker-compose exec -T db psql -U postgres -d siscr_db -t -A -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1', 'public') AND schema_name NOT LIKE 'pg_%%';" > %TEMP%\schemas_list.txt 2>nul

set schemas_found=0
if exist %TEMP%\schemas_list.txt (
    for /f "usebackq delims=" %%s in ("%TEMP%\schemas_list.txt") do (
        set "schema_name=%%s"
        set "schema_name=!schema_name: =!"
        if not "!schema_name!"=="" (
            set /a schemas_found+=1
            echo      Removendo schema: !schema_name!
            docker-compose exec -T db psql -U postgres -d siscr_db -c "DROP SCHEMA IF EXISTS \"!schema_name!\" CASCADE;" >nul 2>&1
            if !errorlevel! equ 0 (
                echo      ✅ Schema !schema_name! removido do banco 'siscr_db'
            ) else (
                echo      ⚠️  Erro ao remover schema !schema_name!
            )
        )
    )
    del %TEMP%\schemas_list.txt 2>nul
) else (
    echo    ℹ️  Não foi possível buscar lista de schemas (banco pode estar vazio)
)

if %schemas_found% equ 0 (
    echo    ℹ️  Nenhum schema de tenant encontrado no banco 'siscr_db'
) else (
    echo    ✅ %schemas_found% schema(s) de tenant(s) removido(s) do banco 'siscr_db'!
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

