@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ========================================
REM Verificar parâmetros de seed
REM ========================================
set SEED_MODE=
if "%1"=="--seed-dev" set SEED_MODE=dev
if "%1"=="-s" set SEED_MODE=dev
if "%1"=="seed-dev" set SEED_MODE=dev
if "%1"=="--seed-prod" set SEED_MODE=prod
if "%1"=="seed-prod" set SEED_MODE=prod

echo ========================================
echo   SISCR - Script de Inicialização
echo   Ambiente de Desenvolvimento
if not "!SEED_MODE!"=="" (
    echo   Modo de Seed: !SEED_MODE!
)
echo ========================================
echo.

REM ========================================
REM Passo 1: Verificar se Docker está instalado
REM ========================================
echo [1/10] Verificando se Docker está instalado...
docker --version >nul 2>&1
if errorlevel 1 (
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
echo [2/10] Verificando se Docker está rodando...
docker ps >nul 2>&1
if errorlevel 1 (
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
REM Passo 2.5: Verificar portas disponíveis
REM ========================================
echo.
echo [2.5/10] Verificando portas disponíveis...
set DB_PORT=5432
set REDIS_PORT=6379
set WEB_PORT=8000
set PORT_CHANGED=0

REM Verificar porta do PostgreSQL
echo Verificando porta PostgreSQL...
netstat -an | findstr ":5432" >nul 2>&1
if errorlevel 1 goto :db_port_ok
echo ⚠️  Porta 5432 (PostgreSQL) está em uso. Procurando porta alternativa...
set DB_PORT=5433
:check_db_port
netstat -an | findstr ":!DB_PORT!" >nul 2>&1
if errorlevel 1 goto :db_port_found
set /a DB_PORT+=1
goto check_db_port
:db_port_found
echo ✅ Usando porta !DB_PORT! para PostgreSQL
set PORT_CHANGED=1
goto :redis_check
:db_port_ok
echo ✅ Porta 5432 (PostgreSQL) está disponível

:redis_check
REM Verificar porta do Redis
echo Verificando porta Redis...
netstat -an | findstr ":6379" >nul 2>&1
if errorlevel 1 goto :redis_port_ok
echo ⚠️  Porta 6379 (Redis) está em uso. Procurando porta alternativa...
set REDIS_PORT=6380
:check_redis_port
netstat -an | findstr ":!REDIS_PORT!" >nul 2>&1
if errorlevel 1 goto :redis_port_found
set /a REDIS_PORT+=1
goto check_redis_port
:redis_port_found
echo ✅ Usando porta !REDIS_PORT! para Redis
set PORT_CHANGED=1
goto :web_check
:redis_port_ok
echo ✅ Porta 6379 (Redis) está disponível

:web_check
REM Verificar porta do Django
echo Verificando porta Django...
netstat -an | findstr ":8000" >nul 2>&1
if errorlevel 1 goto :web_port_ok
echo ⚠️  Porta 8000 (Django) está em uso. Procurando porta alternativa...
set WEB_PORT=8001
:check_web_port
netstat -an | findstr ":!WEB_PORT!" >nul 2>&1
if errorlevel 1 goto :web_port_found
set /a WEB_PORT+=1
goto check_web_port
:web_port_found
echo ✅ Usando porta !WEB_PORT! para Django
set PORT_CHANGED=1
goto :create_override
:web_port_ok
echo ✅ Porta 8000 (Django) está disponível

:create_override
REM Criar arquivo docker-compose.override.yml se as portas forem diferentes
set NEEDS_RECREATE=0
if not "!PORT_CHANGED!"=="1" goto :skip_override
echo.
echo 📝 Criando docker-compose.override.yml com portas alternativas...

REM Verificar se containers já estão rodando
docker-compose ps | findstr "siscr_web" >nul 2>&1
if errorlevel 1 goto :no_containers

REM Containers estão rodando - verificar se já existe override com portas diferentes
if exist docker-compose.override.yml (
    echo ⚠️  Arquivo docker-compose.override.yml já existe. Verificando se precisa atualizar...
    findstr "!DB_PORT!:5432" docker-compose.override.yml >nul 2>&1
    if errorlevel 1 (
        echo ⚠️  Portas no override são diferentes. Será necessário recriar containers.
        set NEEDS_RECREATE=1
    ) else (
        echo ℹ️  Portas no override já estão corretas.
        set NEEDS_RECREATE=0
    )
) else (
    echo ⚠️  Containers já estão rodando. Será necessário recriá-los para aplicar novas portas.
    set NEEDS_RECREATE=1
)
goto :create_override_file

:no_containers
echo ℹ️  Containers não estão rodando. Serão criados com as novas portas.

:create_override_file
(
    echo services:
    echo   db:
    echo     ports:
    echo       - "!DB_PORT!:5432"
    echo   redis:
    echo     ports:
    echo       - "!REDIS_PORT!:6379"
    echo   web:
    echo     ports:
    echo       - "!WEB_PORT!:8000"
) > docker-compose.override.yml
echo ✅ Arquivo docker-compose.override.yml criado
echo    PostgreSQL (externo): localhost:!DB_PORT!
echo    Redis (externo): localhost:!REDIS_PORT!
echo    Django: http://localhost:!WEB_PORT!
echo.
echo ℹ️  Nota: A aplicação Django dentro do container sempre usa a porta interna 5432
echo    A porta externa !DB_PORT! é apenas para conexões de fora do Docker (ex: DBeaver)

:skip_override

REM ========================================
REM Passo 3: Subir ou iniciar containers
REM ========================================
echo.
echo [3/10] Verificando containers...
docker-compose ps | findstr "siscr_web" >nul 2>&1
if errorlevel 1 goto :create_containers

REM Containers existem
if not "!NEEDS_RECREATE!"=="1" goto :check_running

REM Precisa recriar
echo ⚠️  Recriando containers para aplicar novas portas...
docker-compose down
docker-compose up -d
if errorlevel 1 (
    echo ❌ Erro ao recriar containers!
    pause
    exit /b 1
)
echo ✅ Containers recriados com novas portas!
goto :containers_ready

:check_running
echo Containers existem. Verificando se estão rodando...
docker-compose ps | findstr "Up" >nul 2>&1
if errorlevel 1 goto :start_containers
echo ✅ Containers já estão rodando!
goto :containers_ready

:start_containers
echo Iniciando containers existentes...
docker-compose start
if errorlevel 1 (
    echo ❌ Erro ao iniciar containers!
    pause
    exit /b 1
)
echo ✅ Containers iniciados!
goto :containers_ready

:create_containers
echo Construindo imagens e subindo containers pela primeira vez...
echo (Isso pode levar alguns minutos na primeira execução)
docker-compose build
if errorlevel 1 goto :build_no_cache
goto :start_containers_up

:build_no_cache
echo.
echo ⚠️  Build com cache falhou. Tentando sem cache...
echo (Isso pode levar mais tempo, mas resolve problemas de cache corrompido)
docker-compose build --no-cache
if errorlevel 1 (
    echo.
    echo ❌ Erro ao construir imagens mesmo sem cache!
    echo.
    echo 💡 Tente executar manualmente:
    echo    docker system prune -a
    echo    docker-compose build --no-cache
    pause
    exit /b 1
)

:start_containers_up
docker-compose up -d
if errorlevel 1 (
    echo ❌ Erro ao subir containers!
    pause
    exit /b 1
)
echo ✅ Containers criados e iniciados!

:containers_ready

REM Aguardar containers ficarem prontos
echo Aguardando containers ficarem prontos...
timeout /t 5 /nobreak >nul

REM ========================================
REM Passo 4: Aplicar migrações compartilhadas
REM ========================================
echo.
echo [4/10] Aplicando migrações no schema compartilhado...

REM Primeiro, corrigir migrações do guardian se necessário (antes de aplicar)
echo Verificando e corrigindo migrações do app guardian...
docker-compose exec web python manage.py fix_guardian_migrations
if errorlevel 1 (
    echo ⚠️  Aviso: Pode haver problemas com as migrações do guardian
)

REM Marcar todas as migrações do guardian como aplicadas antes de tentar aplicar outras migrações
echo Marcando migrações do guardian como aplicadas (se necessário)...
docker-compose exec web python manage.py migrate guardian --fake --noinput
if errorlevel 1 (
    echo ⚠️  Aviso: Pode haver problemas ao marcar migrações do guardian como aplicadas
)

REM Usar --fake-initial para evitar erros de tabelas que já existem
docker-compose exec web python manage.py migrate_schemas --shared --fake-initial --noinput
if errorlevel 1 (
    echo ⚠️  Aviso: Erro ao aplicar migrações com --fake-initial
    echo    Tentando corrigir migrações do guardian novamente...
    docker-compose exec web python manage.py fix_guardian_migrations
    echo    Marcando migrações do guardian como aplicadas novamente...
    docker-compose exec web python manage.py migrate guardian --fake --noinput
    echo    Tentando aplicar migrações sem --fake-initial...
    docker-compose exec web python manage.py migrate_schemas --shared --noinput
    if errorlevel 1 (
        echo ⚠️  Aviso: Erro ao aplicar migrações ^(pode ser normal se já estiverem aplicadas^)
    ) else (
        echo ✅ Migrações compartilhadas aplicadas!
    )
) else (
    echo ✅ Migrações compartilhadas verificadas/aplicadas!
)

REM Verificar e corrigir migrações do subscriptions se necessário
echo Verificando e corrigindo migrações do app subscriptions...
docker-compose exec web python manage.py fix_subscriptions_migrations
if errorlevel 1 (
    echo ⚠️  Aviso: Pode haver problemas com as migrações do subscriptions
)

REM Verificar e corrigir migrações do accounts se necessário
echo Verificando e corrigindo migrações do app accounts...
docker-compose exec web python manage.py fix_accounts_migrations
if errorlevel 1 (
    echo ⚠️  Aviso: Pode haver problemas com as migrações do accounts
)

REM Verificar e corrigir migrações da tabela tenants_tenant se necessário
echo Verificando e corrigindo migrações da tabela tenants_tenant...
docker-compose exec web python manage.py fix_tenants_tenant_migrations
if errorlevel 1 (
    echo ⚠️  Aviso: Pode haver problemas com as migrações da tabela tenants_tenant
)

REM Sincronizar tenants dos schemas para a tabela tenants_tenant
echo Sincronizando tenants dos schemas para a tabela tenants_tenant...
docker-compose exec web python manage.py sync_tenants_to_public
if errorlevel 1 (
    echo ⚠️  Aviso: Pode haver problemas ao sincronizar tenants
)

REM ========================================
REM Passo 5: Seed de dados compartilhados (Subscriptions)
REM ========================================
if not "!SEED_MODE!"=="" (
    echo.
    echo [5/10] Verificando dados compartilhados ^(Planos, Features, Subscriptions^)...
    docker-compose exec web python database/scripts/check_subscriptions_data.py >nul 2>&1
    if errorlevel 1 (
        echo Criando dados de exemplo compartilhados...
        docker-compose exec web python manage.py seed_subscriptions
        if errorlevel 1 (
            echo ⚠️  Aviso: Seed de subscriptions pode ter falhado
            echo     Isso pode acontecer se as migrações não foram aplicadas corretamente.
            echo     Tente executar manualmente: docker-compose exec web python manage.py migrate_schemas --shared
        ) else (
            echo ✅ Dados compartilhados criados!
        )
    ) else (
        echo ✅ Dados compartilhados já existem!
    )
) else (
    echo.
    echo [5/10] Pulando seed de dados compartilhados ^(use --seed-dev para executar^)
)

REM ========================================
REM Passo 6: Aplicar migrações nos tenants e corrigir colunas (ANTES de criar dados)
REM ========================================
echo.
echo [6/10] Aplicando migrações nos schemas dos tenants...

REM Primeiro, corrigir migrações do guardian em todos os schemas (incluindo tenants)
echo Corrigindo migrações do guardian em todos os schemas...
docker-compose exec web python manage.py fix_guardian_migrations
if errorlevel 1 (
    echo ⚠️  Aviso: Pode haver problemas com as migrações do guardian
)

REM Aplicar migrações apenas nos tenants existentes e válidos usando comando Django
echo Aplicando migrações nos tenants...
docker-compose exec web python manage.py apply_tenant_migrations
if errorlevel 1 (
    echo ⚠️  Aviso: Algumas migrações podem já estar aplicadas ou houve erro
) else (
    echo ✅ Migrações dos tenants verificadas/aplicadas!
)

REM Criar tabelas tenants_empresa e tenants_filial se não existirem
echo Criando tabelas tenants_empresa e tenants_filial nos schemas dos tenants...
docker-compose exec web python manage.py create_tenant_tables
if errorlevel 1 (
    echo ⚠️  Aviso: Pode haver problemas ao criar tabelas dos tenants
)

REM Verificar e corrigir colunas faltantes nos tenants (aplica migrações se necessário)
echo Verificando e corrigindo colunas faltantes nos tenants...
docker-compose exec web python manage.py fix_tenant_migrations
if errorlevel 1 (
    echo ⚠️  Aviso: Pode haver problemas com as migrações dos tenants
)

echo.
echo [8/10] Corrigindo foreign keys dos tenants...
docker-compose exec web python manage.py fix_tenant_foreign_keys
if errorlevel 1 (
    echo ⚠️  Aviso: Pode haver problemas com as foreign keys dos tenants
)

REM ========================================
REM Passo 6.5: Garantir que tenants_tenant está sincronizado ANTES do seed
REM ========================================
if not "!SEED_MODE!"=="" (
    echo.
    echo [6.5/10] Garantindo sincronização de tenants antes do seed...
    docker-compose exec web python manage.py sync_tenants_to_public
    if errorlevel 1 (
        echo ⚠️  Aviso: Pode haver problemas ao sincronizar tenants
    )
)

REM ========================================
REM Passo 7: Criar tenants com dados realistas
REM ========================================
if not "!SEED_MODE!"=="" (
    echo.
    echo [7/10] Criando tenants com dados realistas...
    echo.
    echo Este processo criará 3 tenants completos:
    echo   • Comércio Simples ^(1 empresa, 1 filial^)
    echo   • Grupo Expansão ^(1 empresa, 2 filiais^)
    echo   • Holding Diversificada ^(2 empresas, 2 filiais cada^)
    echo.
    echo Verificando se tenants já existem...
    docker-compose exec web python -c "import os, django; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings'); django.setup(); from django.db import connection; c = connection.cursor(); c.execute('SELECT COUNT(*) FROM tenants_tenant WHERE schema_name IN (%%s, %%s, %%s^)', ['comercio_simples', 'grupo_expansao', 'holding_diversificada']); n = c.fetchone()[0]; exit^(0 if n >= 3 else 1^)" >nul 2>&1
    if errorlevel 1 (
        echo Executando seed de múltiplos tenants...
        echo ^(Isso pode levar alguns minutos...^)
        docker-compose exec web python manage.py seed_multiple_tenants
        if errorlevel 1 (
            echo ⚠️  Aviso: Seed de múltiplos tenants pode ter falhado
        ) else (
            echo ✅ Tenants criados com sucesso!
        )
    ) else (
        echo ✅ Tenants já existem! Pulando criação...
        echo.
        echo Se quiser recriar os tenants, execute manualmente:
        echo   docker-compose exec web python manage.py seed_multiple_tenants
    )
    
    REM ========================================
    REM Passo 6.6: Criar locations de estoque
    REM ========================================
    echo.
    echo [8/10] Criando locations de estoque para os tenants...
    docker-compose exec web python manage.py seed_locations
    if errorlevel 1 (
        echo ⚠️  Aviso: Seed de locations pode ter falhado
    ) else (
        echo ✅ Locations criadas com sucesso!
    )
) else (
    echo.
    echo [7/10] Pulando seed de tenants ^(use --seed-dev para executar^)
    echo [8/10] Pulando seed de locations ^(use --seed-dev para executar^)
)

REM ========================================
REM Passo 7: Verificar Node.js e instalar dependencias do frontend
REM ========================================
echo.
echo [9/10] Verificando Node.js e dependencias do frontend...
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
echo [10/10] Iniciando servidor de desenvolvimento do frontend...
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
if "!SEED_MODE!"=="" (
    echo 💡 Dica: Use 'start_dev_windows.bat --seed-dev' para executar seed de dados
    echo.
)
echo 📋 Serviços disponíveis:
echo    • Backend ^(Django^): http://localhost:8000
echo    • Admin Django:     http://localhost:8000/admin/
echo    • Swagger/API Docs:    http://localhost:8000/api/docs/
echo    • Dashboard Observabilidade: http://localhost:8000/api/observability/
echo    • Frontend ^(React^): http://localhost:5173
echo.
if not "!SEED_MODE!"=="" (
    echo 🔐 Credenciais de teste ^(após seed^):
    echo    • Username: ^(varia por tenant, formato: nome.sobrenome.codigo^)
    echo    • Password: admin123
)
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

