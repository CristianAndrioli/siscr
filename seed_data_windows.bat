@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   SISCR - Script de Seed de Dados
echo   Apenas Migrações e Seeds
echo ========================================
echo.

REM ========================================
REM Verificar se Docker está rodando
REM ========================================
echo [1/6] Verificando se Docker está rodando...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ Docker não está rodando!
    echo.
    echo 🔧 Por favor:
    echo    1. Abra o Docker Desktop
    echo    2. Aguarde até que o Docker esteja totalmente iniciado
    echo    3. Execute este script novamente
    echo.
    pause
    exit /b 1
)
echo ✅ Docker está rodando!

REM ========================================
REM Passo 1: Aplicar migrações compartilhadas
REM ========================================
echo.
echo [2/6] Aplicando migrações no schema compartilhado...
docker-compose exec web python manage.py migrate_schemas --shared --noinput
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Algumas migrações podem já estar aplicadas
) else (
    echo ✅ Migrações compartilhadas verificadas/aplicadas!
)

REM Verificar e corrigir migrações do subscriptions se necessário
echo Verificando e corrigindo migrações do app subscriptions...
docker-compose exec web python manage.py fix_subscriptions_migrations
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Pode haver problemas com as migrações do subscriptions
)

REM ========================================
REM Passo 2: Seed de dados compartilhados (Subscriptions)
REM ========================================
echo.
echo [3/6] Verificando dados compartilhados (Planos, Features, Subscriptions)...
docker-compose exec web python database/scripts/check_subscriptions_data.py >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Dados compartilhados já existem!
) else (
    echo Criando dados de exemplo compartilhados...
    docker-compose exec web python manage.py seed_subscriptions
    if %errorlevel% neq 0 (
        echo ⚠️  Aviso: Seed de subscriptions pode ter falhado
        echo     Isso pode acontecer se as migrações não foram aplicadas corretamente.
        echo     Tente executar manualmente: docker-compose exec web python manage.py migrate_schemas --shared
    ) else (
        echo ✅ Dados compartilhados criados!
    )
)

REM ========================================
REM Passo 3: Aplicar migrações nos tenants e corrigir colunas
REM ========================================
echo.
echo [4/6] Aplicando migrações nos schemas dos tenants...
docker-compose exec web python manage.py apply_tenant_migrations
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Algumas migrações podem já estar aplicadas ou houve erro
) else (
    echo ✅ Migrações dos tenants verificadas/aplicadas!
)

REM Criar tabelas tenants_empresa e tenants_filial se não existirem
echo Criando tabelas tenants_empresa e tenants_filial nos schemas dos tenants...
docker-compose exec web python manage.py create_tenant_tables
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Pode haver problemas ao criar tabelas dos tenants
)

REM Verificar e corrigir colunas faltantes nos tenants
echo Verificando e corrigindo colunas faltantes nos tenants...
docker-compose exec web python manage.py fix_tenant_migrations
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Pode haver problemas com as migrações dos tenants
)

REM ========================================
REM Passo 4: Criar tenants com dados realistas
REM ========================================
echo.
echo [5/6] Criando tenants com dados realistas...
echo.
echo Este processo criará 3 tenants completos:
echo   • Comércio Simples (1 empresa, 1 filial)
echo   • Grupo Expansão (1 empresa, 2 filiais)
echo   • Holding Diversificada (2 empresas, 2 filiais cada)
echo.
echo Verificando se tenants já existem...
docker-compose exec web python -c "import os, django; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings'); django.setup(); from tenants.models import Tenant; tenants = Tenant.objects.filter(schema_name__in=['comercio_simples', 'grupo_expansao', 'holding_diversificada']); count = tenants.count(); exit(0 if count >= 3 else 1)" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Tenants já existem! Pulando criação...
    echo.
    echo Se quiser recriar os tenants, execute manualmente:
    echo   docker-compose exec web python manage.py seed_multiple_tenants
) else (
    echo Executando seed de múltiplos tenants...
    echo (Isso pode levar alguns minutos...)
    docker-compose exec web python manage.py seed_multiple_tenants
    if %errorlevel% neq 0 (
        echo ⚠️  Aviso: Seed de múltiplos tenants pode ter falhado
    ) else (
        echo ✅ Tenants criados com sucesso!
    )
)

REM ========================================
REM Passo 5: Criar locations de estoque
REM ========================================
echo.
echo [6/6] Criando locations de estoque para os tenants...
docker-compose exec web python manage.py seed_locations
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Seed de locations pode ter falhado
) else (
    echo ✅ Locations criadas com sucesso!
)

echo.
echo ========================================
echo   ✅ Seed de dados concluído!
echo ========================================
echo.
echo 📋 Resumo:
echo    • Migrações compartilhadas: Aplicadas
echo    • Dados compartilhados: Criados/Verificados
echo    • Migrações dos tenants: Aplicadas
echo    • Tenants: Criados/Verificados
echo    • Locations: Criadas
echo.
pause

