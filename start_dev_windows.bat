@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   SISCR - Script de Inicialização
echo   Ambiente de Desenvolvimento
echo ========================================
echo.

REM ========================================
REM Passo 1: Verificar se Docker está instalado
REM ========================================
echo [1/9] Verificando se Docker está instalado...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ Docker não está instalado ou não está no PATH!
    echo.
    echo 📥 Por favor, baixe e instale o Docker Desktop:
    echo    https://www.docker.com/products/docker-desktop/
    echo.
    echo Após instalar, reinicie este script.
    pause
    exit /b 1
)
echo ✅ Docker encontrado!

REM ========================================
REM Passo 2: Verificar se Docker está rodando
REM ========================================
echo.
echo [2/9] Verificando se Docker está rodando...
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
REM Passo 3: Subir ou iniciar containers
REM ========================================
echo.
echo [3/9] Verificando containers...
docker-compose ps | findstr "siscr_web" >nul 2>&1
if %errorlevel% equ 0 (
    echo Containers existem. Verificando se estão rodando...
    docker-compose ps | findstr "Up" >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ Containers já estão rodando!
    ) else (
        echo Iniciando containers existentes...
        docker-compose start
        if %errorlevel% neq 0 (
            echo ❌ Erro ao iniciar containers!
            pause
            exit /b 1
        )
        echo ✅ Containers iniciados!
    )
) else (
    echo Construindo imagens e subindo containers pela primeira vez...
    echo (Isso pode levar alguns minutos na primeira execução)
    docker-compose build
    if %errorlevel% neq 0 (
        echo ❌ Erro ao construir imagens!
        pause
        exit /b 1
    )
    docker-compose up -d
    if %errorlevel% neq 0 (
        echo ❌ Erro ao subir containers!
        pause
        exit /b 1
    )
    echo ✅ Containers criados e iniciados!
)

REM Aguardar containers ficarem prontos
echo Aguardando containers ficarem prontos...
timeout /t 5 /nobreak >nul

REM ========================================
REM Passo 4: Aplicar migrações compartilhadas
REM ========================================
echo.
echo [4/9] Aplicando migrações no schema compartilhado...
docker-compose exec web python manage.py migrate_schemas --shared --noinput
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Algumas migrações podem já estar aplicadas
) else (
    echo ✅ Migrações compartilhadas verificadas/aplicadas!
)

REM ========================================
REM Passo 5: Seed de dados compartilhados (Subscriptions)
REM ========================================
echo.
echo [5/9] Verificando dados compartilhados (Planos, Features, Subscriptions)...
docker-compose exec web python database/scripts/check_subscriptions_data.py >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Dados compartilhados já existem!
) else (
    echo Criando dados de exemplo compartilhados...
    docker-compose exec web python manage.py seed_subscriptions
    if %errorlevel% neq 0 (
        echo ⚠️  Aviso: Seed de subscriptions pode ter falhado
    ) else (
        echo ✅ Dados compartilhados criados!
    )
)

REM ========================================
REM Passo 6: Criar tenants com dados realistas
REM ========================================
echo.
echo [6/9] Criando tenants com dados realistas...
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
        echo Tentando criar apenas tenant de teste como fallback...
        docker-compose exec web python manage.py create_test_tenant
    ) else (
        echo ✅ Tenants criados com sucesso!
    )
)

REM ========================================
REM Passo 7: Criar tenant de teste (fallback/opcional)
REM ========================================
echo.
echo [7/9] Verificando tenant de teste (opcional)...
docker-compose exec web python manage.py create_test_tenant >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Tenant de teste criado/verificado!
) else (
    echo ℹ️  Tenant de teste já existe ou não foi necessário criar
)

@REM REM ========================================
@REM REM Passo 8: Instalar dependências do frontend
@REM REM ========================================
@REM echo.
@REM echo [8/9] Instalando dependências do frontend...
@REM if not exist "frontend" (
@REM     echo ❌ Pasta frontend não encontrada!
@REM     pause
@REM     exit /b 1
@REM )
@REM pushd frontend
@REM if not exist "node_modules" (
@REM     echo Executando npm install (pode levar alguns minutos)...
@REM     call npm install
@REM     set INSTALL_ERROR=!errorlevel!
@REM     if !INSTALL_ERROR! neq 0 (
@REM         echo ❌ Erro ao instalar dependências do frontend!
@REM         popd
@REM         pause
@REM         exit /b 1
@REM     )
@REM     echo ✅ Dependências instaladas!
@REM ) else (
@REM     echo ✅ Dependências já instaladas!
@REM )
@REM popd

@REM REM ========================================
@REM REM Passo 9: Iniciar servidor de desenvolvimento do frontend
@REM REM ========================================
@REM echo.
@REM echo [9/9] Iniciando servidor de desenvolvimento do frontend...
@REM echo.
@REM echo ⚠️  IMPORTANTE: O servidor do frontend será iniciado em uma nova janela.
@REM echo    Esta janela pode ser fechada após o frontend iniciar.
@REM echo.
@REM pushd frontend
@REM start "SISCR Frontend" cmd /k "npm run dev"
@REM popd

REM Aguardar um pouco para o servidor iniciar
timeout /t 3 /nobreak >nul

REM ========================================
REM Abrir navegador
REM ========================================
echo.
echo 🌐 Abrindo páginas no navegador...
timeout /t 2 /nobreak >nul
start http://localhost:8000/admin/
timeout /t 1 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================
echo   ✅ Inicialização concluída!
echo ========================================
echo.
echo 📋 Serviços disponíveis:
echo    • Backend (Django): http://localhost:8000
echo    • Admin Django:     http://localhost:8000/admin/
echo    • Frontend (React): http://localhost:5173
echo.
echo 🔐 Credenciais de teste:
echo    • Username: (varia por tenant, formato: nome.sobrenome.codigo)
echo    • Password: senha123
echo    • Tenants disponíveis:
echo      - Comércio Simples: http://comercio_simples.localhost:8000
echo      - Grupo Expansão: http://grupo_expansao.localhost:8000
echo      - Holding Diversificada: http://holding_diversificada.localhost:8000
echo      - Teste (se criado): http://teste-tenant.localhost:8000
echo.
echo 💡 Dica: O servidor do frontend está rodando em uma janela separada.
echo    Para parar os containers, execute: docker-compose down
echo.
pause

