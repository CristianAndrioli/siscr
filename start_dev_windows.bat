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
)

REM ========================================
REM Passo 5: Seed de dados compartilhados (Subscriptions)
REM ========================================
echo.
echo [5/9] Criando dados de exemplo compartilhados (Planos, Features, Subscriptions)...
docker-compose exec web python manage.py seed_subscriptions
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Seed de subscriptions pode ter falhado ou já estar criado
)

REM ========================================
REM Passo 6: Criar tenant de teste (se não existir)
REM ========================================
echo.
echo [6/9] Verificando tenant de teste...
docker-compose exec web python manage.py create_test_tenant
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Tenant pode já existir ou houve erro na criação
)

REM ========================================
REM Passo 7: Aplicar migrações no tenant e fazer seed
REM ========================================
echo.
echo [7/9] Aplicando migrações no tenant e criando dados de exemplo...
echo Aplicando migrações no schema do tenant...
docker-compose exec web python manage.py migrate_schemas --schema=teste_tenant --noinput
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Algumas migrações podem já estar aplicadas
)
echo Criando dados de exemplo no tenant (Pessoas, Produtos, Serviços)...
docker-compose exec web python seed_tenant_data.py teste_tenant
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Seed de dados do tenant pode ter falhado ou já estar criado
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

REM ========================================
REM Passo 9: Iniciar servidor de desenvolvimento do frontend
REM ========================================
echo.
echo [9/9] Iniciando servidor de desenvolvimento do frontend...
echo.
echo ⚠️  IMPORTANTE: O servidor do frontend será iniciado em uma nova janela.
echo    Esta janela pode ser fechada após o frontend iniciar.
echo.
pushd frontend
start "SISCR Frontend" cmd /k "npm run dev"
popd

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
timeout /t 1 /nobreak >nul
start http://localhost:5173/dashboard

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
echo    • Username: teste_user
echo    • Password: senha123
echo    • Tenant:   teste_tenant
echo.
echo 💡 Dica: O servidor do frontend está rodando em uma janela separada.
echo    Para parar os containers, execute: docker-compose down
echo.
pause

