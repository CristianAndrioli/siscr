@echo off
chcp 65001 >nul
echo ========================================
echo   Verificando Status do Frontend
echo ========================================
echo.

echo [1/3] Verificando se a porta 5173 está em uso...
netstat -ano | findstr :5173 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Porta 5173 está em uso - Frontend provavelmente está rodando!
    netstat -ano | findstr :5173
) else (
    echo ❌ Porta 5173 não está em uso - Frontend NÃO está rodando!
    echo.
    echo [2/3] Verificando Node.js...
    node --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Node.js não encontrado!
        echo    Instale Node.js: https://nodejs.org/
        pause
        exit /b 1
    )
    node --version
    echo ✅ Node.js encontrado!
    echo.
    echo [3/3] Iniciando frontend manualmente...
    if not exist "frontend" (
        echo ❌ Pasta frontend não encontrada!
        pause
        exit /b 1
    )
    cd frontend
    if not exist "node_modules" (
        echo 📦 Instalando dependências...
        call npm install
        if %errorlevel% neq 0 (
            echo ❌ Erro ao instalar dependências!
            pause
            exit /b 1
        )
    )
    echo 🚀 Iniciando servidor Vite...
    echo.
    echo ⚠️  IMPORTANTE: Esta janela será mantida aberta.
    echo    Para parar o servidor, pressione Ctrl+C
    echo.
    call npm run dev
)

