# Script para iniciar o servidor de desenvolvimento do frontend
Write-Host "Iniciando servidor de desenvolvimento do frontend..." -ForegroundColor Green

# Verificar se estamos no diretório correto
if (-not (Test-Path "package.json")) {
    Write-Host "Erro: package.json não encontrado. Execute este script no diretório frontend." -ForegroundColor Red
    exit 1
}

# Verificar se node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependências..." -ForegroundColor Yellow
    npm install
}

# Iniciar o servidor
Write-Host "Iniciando Vite na porta 5173..." -ForegroundColor Green
npm run dev

