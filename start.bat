@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   SISCR - Iniciando Aplicacao
echo ========================================
echo.

:: Verificar Docker
echo Verificando Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Docker nao esta instalado ou nao esta no PATH!
    echo.
    echo Por favor, instale o Docker Desktop:
    echo https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Docker Desktop nao esta rodando!
    echo.
    echo Por favor, inicie o Docker Desktop e tente novamente.
    pause
    exit /b 1
)

echo [OK] Docker esta instalado e rodando
echo.

:: Verificar Node.js
echo Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao esta instalado!
    echo.
    echo Por favor, instale o Node.js (versao 16 ou superior):
    echo https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js instalado: %NODE_VERSION%
echo.

:: Verificar se npm está instalado
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] npm nao esta instalado!
    pause
    exit /b 1
)

echo [OK] npm esta instalado
echo.

:: Iniciar Backend (Docker)
echo ========================================
echo   Iniciando Backend (Docker)
echo ========================================
echo.

docker-compose ps | findstr "siscr_web" >nul 2>&1
if %errorlevel% equ 0 (
    echo Containers ja estao rodando. Reiniciando...
    docker-compose restart
) else (
    echo Subindo containers Docker...
    docker-compose up -d --build
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao iniciar containers Docker!
        pause
        exit /b 1
    )
)

echo Aguardando containers iniciarem...
timeout /t 5 /nobreak >nul

:: Verificar se o backend está respondendo
echo Verificando se o backend está respondendo...
set BACKEND_READY=0
set CHECK_COUNT=0

:check_backend
set /a CHECK_COUNT+=1
if !CHECK_COUNT! gtr 30 (
    echo [AVISO] Backend demorou para iniciar. Continuando...
    set BACKEND_READY=1
    goto backend_ready
)

:: Tentar verificar com PowerShell (mais confiável no Windows)
powershell -Command "try { $response = Invoke-WebRequest -Uri http://localhost:8000 -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    set BACKEND_READY=1
    goto backend_ready
)

echo Aguardando backend iniciar... (!CHECK_COUNT!/30)
timeout /t 2 /nobreak >nul
goto check_backend

:backend_ready
if !BACKEND_READY! equ 1 (
    echo [OK] Backend esta rodando em http://localhost:8000
) else (
    echo [AVISO] Backend pode nao estar totalmente pronto. Verifique manualmente.
)
echo.

:: Verificar e instalar dependências do frontend
echo ========================================
echo   Configurando Frontend
echo ========================================
echo.

cd frontend
set FRONTEND_PATH=%CD%

if not exist "node_modules" (
    echo Instalando dependencias do frontend...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar dependencias do frontend!
        cd ..
        pause
        exit /b 1
    )
    echo [OK] Dependencias instaladas
) else (
    echo [OK] Dependencias ja instaladas
)

echo.

:: Iniciar Frontend em janela separada
echo ========================================
echo   Iniciando Frontend React
echo ========================================
echo.

echo Iniciando servidor de desenvolvimento do frontend...
echo Abrindo janela separada do PowerShell para o frontend...
powershell -Command "Start-Process powershell -ArgumentList '-NoExit', '-Command', \"cd '%FRONTEND_PATH%'; Write-Host '========================================' -ForegroundColor Cyan; Write-Host 'SISCR Frontend - Servidor de Desenvolvimento' -ForegroundColor Green; Write-Host '========================================' -ForegroundColor Cyan; Write-Host ''; Write-Host 'Aguardando inicializacao...' -ForegroundColor Yellow; npm run dev\""

:: Aguardar frontend iniciar
echo Aguardando frontend iniciar...
timeout /t 8 /nobreak >nul

:: Verificar se o frontend está respondendo
echo Verificando se o frontend está respondendo...
set FRONTEND_READY=0
set FRONTEND_CHECK_COUNT=0

:check_frontend
set /a FRONTEND_CHECK_COUNT+=1
if !FRONTEND_CHECK_COUNT! gtr 20 (
    echo [AVISO] Frontend demorou para iniciar. Continuando...
    set FRONTEND_READY=1
    goto frontend_ready
)

:: Tentar verificar com PowerShell
powershell -Command "try { $response = Invoke-WebRequest -Uri http://localhost:5173 -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    set FRONTEND_READY=1
    goto frontend_ready
)

echo Aguardando frontend iniciar... (!FRONTEND_CHECK_COUNT!/20)
timeout /t 2 /nobreak >nul
goto check_frontend

:frontend_ready
if !FRONTEND_READY! equ 1 (
    echo [OK] Frontend esta rodando em http://localhost:5173
) else (
    echo [AVISO] Frontend pode nao estar totalmente pronto. Verifique manualmente.
)
echo.

cd ..

:: Abrir navegadores
echo ========================================
echo   Abrindo Navegadores
echo ========================================
echo.

echo Abrindo Frontend React...
start http://localhost:5173

timeout /t 2 /nobreak >nul

echo Abrindo Backend Django (API)...
start http://127.0.0.1:8000/api/

timeout /t 2 /nobreak >nul

echo Abrindo Django Admin...
start http://127.0.0.1:8000/admin/

echo.
echo ========================================
echo   Aplicação Iniciada com Sucesso!
echo ========================================
echo.
echo Frontend React:     http://localhost:5173
echo Backend Django API: http://127.0.0.1:8000/api/
echo Django Admin:       http://127.0.0.1:8000/admin/
echo.
echo Credenciais:
echo   Usuário: admin
echo   Senha:   admin123
echo.
echo Pressione qualquer tecla para fechar esta janela...
echo (Os servidores continuarão rodando)
pause >nul

