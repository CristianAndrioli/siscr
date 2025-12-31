@echo off
REM Script genérico para aplicar migrations de um app específico
REM Uso: scripts\database\apply_migrations.bat [app_name] [--seed]
REM Exemplo: scripts\database\apply_migrations.bat payments
REM Exemplo: scripts\database\apply_migrations.bat subscriptions --seed

setlocal enabledelayedexpansion

if "%1"=="" (
    echo ❌ Erro: Nome do app não fornecido
    echo.
    echo Uso: apply_migrations.bat [app_name] [--seed]
    echo.
    echo Exemplos:
    echo   apply_migrations.bat payments
    echo   apply_migrations.bat subscriptions --seed
    exit /b 1
)

set APP_NAME=%1
set SEED_FLAG=%2

echo 🔄 Aplicando migrations do app: %APP_NAME%...

REM Verificar se o container está rodando
docker-compose ps | findstr /C:"web" | findstr /C:"Up" >nul
if %errorlevel% neq 0 (
    echo ❌ Container 'web' não está rodando. Inicie com: docker-compose up -d
    exit /b 1
)

echo 📦 Criando migrations...
docker-compose exec web python manage.py makemigrations %APP_NAME%

if %errorlevel% neq 0 (
    echo ❌ Erro ao criar migrations
    exit /b 1
)

echo ✅ Migrations criadas com sucesso!

echo 🗄️ Aplicando migrations no schema público (shared)...
docker-compose exec web python manage.py migrate_schemas --shared

if %errorlevel% neq 0 (
    echo ❌ Erro ao aplicar migrations no schema público
    exit /b 1
)

echo ✅ Migrations aplicadas no schema público!

REM Executar seed se solicitado
if "%SEED_FLAG%"=="--seed" (
    echo.
    echo 🌱 Executando seed de dados...
    docker-compose exec web python manage.py seed_%APP_NAME%
    if %errorlevel% equ 0 (
        echo ✅ Seed executado com sucesso!
    ) else (
        echo ⚠️  Aviso: Seed pode ter falhado ou não existe para este app
    )
)

echo.
echo 🎉 Concluído! O app %APP_NAME% está pronto para uso.
echo.
echo 📝 Próximos passos:
echo    1. Verificar no admin: http://localhost:8000/admin/%APP_NAME%/
echo    2. Testar API: http://localhost:8000/api/%APP_NAME%/

pause

