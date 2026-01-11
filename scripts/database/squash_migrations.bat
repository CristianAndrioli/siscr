@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   SQUASH DE MIGRAÇÕES
echo   Consolidar todas em migração única
echo ========================================
echo.
echo ⚠️  ATENÇÃO: Este script irá:
echo    1. Fazer backup de todas as migrações atuais
echo    2. Remover todas as migrações (exceto __init__.py)
echo    3. Gerar novas migrações iniciais usando makemigrations
echo.
echo ⚠️  Esta ação é IRREVERSÍVEL (mas tem backup)!
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
REM Passo 1: Verificar se Docker está rodando
REM ========================================
echo [1/5] Verificando Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker não está instalado ou não está no PATH!
    pause
    exit /b 1
)
echo ✅ Docker encontrado!

docker-compose ps | findstr "siscr_web" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Containers não estão rodando. Iniciando...
    docker-compose up -d
    if %errorlevel% neq 0 (
        echo ❌ Erro ao iniciar containers!
        pause
        exit /b 1
    )
    echo Aguardando containers ficarem prontos...
    timeout /t 5 /nobreak >nul
)
echo ✅ Containers estão rodando!

REM ========================================
REM Passo 2: Fazer backup das migrações
REM ========================================
echo.
echo [2/5] Fazendo backup das migrações atuais...
set BACKUP_DIR=database\migrations_backup
if exist "%BACKUP_DIR%" (
    echo Removendo backup antigo...
    rmdir /s /q "%BACKUP_DIR%"
)
mkdir "%BACKUP_DIR%"

for %%a in (accounts cadastros estoque faturamento financeiro payments public reports subscriptions tenants vendas) do (
    if exist "%%a\migrations" (
        echo   Fazendo backup de %%a\migrations...
        xcopy "%%a\migrations" "%BACKUP_DIR%\%%a\migrations\" /E /I /Y >nul 2>&1
        if !errorlevel! equ 0 (
            echo     ✅ Backup de %%a criado
        ) else (
            echo     ⚠️  Erro ao fazer backup de %%a
        )
    )
)
echo ✅ Backup completo em: %BACKUP_DIR%

REM ========================================
REM Passo 3: Remover migrações antigas
REM ========================================
echo.
echo [3/5] Removendo migrações antigas (exceto __init__.py)...
for %%a in (accounts cadastros estoque faturamento financeiro payments public reports subscriptions tenants vendas) do (
    if exist "%%a\migrations" (
        echo   Processando %%a\migrations...
        for %%f in ("%%a\migrations\*.py") do (
            if /i not "%%~nxf"=="__init__.py" (
                del "%%f" >nul 2>&1
                if !errorlevel! equ 0 (
                    echo     🗑️  Removido: %%~nxf
                )
            )
        )
    )
)
echo ✅ Migrações antigas removidas!

REM ========================================
REM Passo 4: Gerar novas migrações iniciais
REM ========================================
echo.
echo [4/5] Gerando novas migrações iniciais...
echo    Isso pode levar alguns minutos...
docker-compose exec web python manage.py makemigrations --noinput
if %errorlevel% neq 0 (
    echo ❌ Erro ao gerar migrações!
    echo.
    echo 💡 Tente executar manualmente:
    echo    docker-compose exec web python manage.py makemigrations
    pause
    exit /b 1
)
echo ✅ Novas migrações geradas!

REM ========================================
REM Passo 5: Verificar migrações criadas
REM ========================================
echo.
echo [5/5] Verificando migrações criadas...
set MIGRATIONS_FOUND=0
for %%a in (accounts cadastros estoque faturamento financeiro payments public reports subscriptions tenants vendas) do (
    if exist "%%a\migrations\0001_initial.py" (
        echo   ✅ %%a: 0001_initial.py encontrado
        set /a MIGRATIONS_FOUND+=1
    ) else (
        echo   ⚠️  %%a: Nenhuma migração inicial encontrada
    )
)
echo.
echo 📊 Resumo: %MIGRATIONS_FOUND% app(s) com migração inicial criada

echo.
echo ========================================
echo ✅ Squash de migrações concluído!
echo ========================================
echo.
echo 📦 Backup salvo em: %BACKUP_DIR%
echo.
echo 📋 Próximos passos:
echo    1. Teste as novas migrações em um banco limpo:
echo       reset_database_windows.bat
echo       start_dev_windows.bat
echo.
echo    2. Se tudo estiver OK, você pode remover o backup:
echo       rmdir /s /q "%BACKUP_DIR%"
echo.
pause

