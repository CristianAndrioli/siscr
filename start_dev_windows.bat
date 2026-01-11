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
        echo.
        echo ⚠️  Build com cache falhou. Tentando sem cache...
        echo (Isso pode levar mais tempo, mas resolve problemas de cache corrompido)
        docker-compose build --no-cache
        if %errorlevel% neq 0 (
            echo.
            echo ❌ Erro ao construir imagens mesmo sem cache!
            echo.
            echo 💡 Tente executar manualmente:
            echo    docker system prune -a
            echo    docker-compose build --no-cache
            pause
            exit /b 1
        )
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

REM Verificar e corrigir migrações do subscriptions se necessário
echo Verificando e corrigindo migrações do app subscriptions...
docker-compose exec web python manage.py shell -c "exec(open('/app/scripts/database/fix_subscriptions_migrations.py').read())"
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Pode haver problemas com as migrações do subscriptions
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
        echo     Isso pode acontecer se as migrações não foram aplicadas corretamente.
        echo     Tente executar manualmente: docker-compose exec web python manage.py migrate_schemas --shared
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
    ) else (
        echo ✅ Tenants criados com sucesso!
    )
)

REM ========================================
REM Passo 6.5: Aplicar migrações nos tenants
REM ========================================
echo.
echo [6.5/9] Aplicando migrações nos schemas dos tenants...
REM Aplicar migrações apenas nos tenants existentes e válidos usando script Python
docker-compose exec web python manage.py shell -c "exec(open('/app/scripts/database/apply_tenant_migrations.py').read())"
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Algumas migrações podem já estar aplicadas ou houve erro
) else (
    echo ✅ Migrações dos tenants verificadas/aplicadas!
)

REM Verificar e corrigir colunas faltantes nos tenants
echo Verificando e corrigindo colunas faltantes nos tenants...
docker-compose exec web python manage.py shell -c "exec(open('/app/scripts/database/fix_tenant_migrations.py').read())"
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Pode haver problemas com as migrações dos tenants
)

REM ========================================
REM Passo 6.6: Criar locations de estoque
REM ========================================
echo.
echo [6.6/9] Criando locations de estoque para os tenants...
docker-compose exec web python manage.py seed_locations
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Seed de locations pode ter falhado
) else (
    echo ✅ Locations criadas com sucesso!
)

REM ========================================
REM Passo 7: Verificar Node.js e instalar dependencias do frontend
REM ========================================
echo.
echo [7/10] Verificando Node.js e dependencias do frontend...
node --version >nul 2>&1
if errorlevel 1 goto :nodejs_not_found
echo OK: Node.js encontrado!
if not exist "frontend" goto :frontend_not_found
pushd frontend
if not exist "node_modules" (
    echo Executando npm install pode levar alguns minutos...
    call npm install
    if errorlevel 1 (
        echo ERRO: Falha ao instalar dependencias do frontend!
        echo AVISO: Continuando sem iniciar o frontend...
        popd
        goto :continue_after_step7
    )
    echo OK: Dependencias instaladas!
) else (
    echo OK: Dependencias ja instaladas!
)
popd
goto :continue_after_step7

:nodejs_not_found
echo.
echo ERRO: Node.js nao esta instalado ou nao esta no PATH!
echo.
echo Por favor, baixe e instale o Node.js versao 16 ou superior:
echo    https://nodejs.org/
echo.
echo Apos instalar, reinicie este script.
echo.
echo AVISO: Continuando sem iniciar o frontend...
goto :continue_after_step7

:frontend_not_found
echo ERRO: Pasta frontend nao encontrada!
echo AVISO: Continuando sem iniciar o frontend...

:continue_after_step7

REM ========================================
REM Passo 8: Iniciar servidor de desenvolvimento do frontend
REM ========================================
echo.
echo [8/10] Iniciando servidor de desenvolvimento do frontend...
node --version >nul 2>&1
if errorlevel 1 goto :skip_frontend_start
if not exist "frontend" goto :skip_frontend_start
echo.
echo IMPORTANTE: O servidor do frontend sera iniciado em uma nova janela.
echo    Esta janela pode ser fechada apos o frontend iniciar.
echo.
pushd frontend
start "SISCR Frontend" cmd /k "npm run dev"
popd
echo OK: Servidor do frontend iniciado!
goto :continue_after_step8

:skip_frontend_start
echo AVISO: Frontend nao sera iniciado.

:continue_after_step8

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
start http://localhost:8000/api/docs/
timeout /t 1 /nobreak >nul
start http://localhost:8000/api/observability/
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
echo    • Swagger/API Docs:    http://localhost:8000/api/docs/
echo    • Dashboard Observabilidade: http://localhost:8000/api/observability/
echo    • Frontend (React): http://localhost:5173
echo.
echo 🔐 Credenciais de teste:
echo    • Username: (varia por tenant, formato: nome.sobrenome.codigo)
echo    • Password: senha123
echo    • Tenants disponíveis:
echo      - Comércio Simples: http://comercio_simples.localhost:8000
echo      - Grupo Expansão: http://grupo_expansao.localhost:8000
echo      - Holding Diversificada: http://holding_diversificada.localhost:8000
echo.
echo 🗑️  Gerenciamento de Tenants:
echo    • Para excluir tenants, use o painel admin: http://localhost:8000/admin/tenants/tenant/
echo    • Para limpar completamente o banco: docker-compose exec web python manage.py cleanup_database --confirm
echo.
echo 💡 Dica: O servidor do frontend está rodando em uma janela separada.
echo    Para parar os containers, execute: docker-compose down
echo.
pause

