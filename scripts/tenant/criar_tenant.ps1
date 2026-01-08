# Script para criar um novo tenant manualmente
# Uso: .\scripts\tenant\criar_tenant.ps1

$baseUrl = "http://localhost:8000"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Criar Novo Tenant - SISCR" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# PASSO 1: Listar planos disponíveis
Write-Host "1. Buscando planos disponíveis..." -ForegroundColor Yellow
try {
    $plansResponse = Invoke-RestMethod -Uri "$baseUrl/api/public/plans/" -Method Get
    Write-Host "   Planos encontrados:" -ForegroundColor Green
    foreach ($plan in $plansResponse) {
        Write-Host "   - ID: $($plan.id) | $($plan.name) | R$ $($plan.price_monthly)/mês" -ForegroundColor White
    }
    Write-Host ""
} catch {
    Write-Host "   ERRO: Não foi possível buscar os planos." -ForegroundColor Red
    Write-Host "   Verifique se o servidor está rodando em $baseUrl" -ForegroundColor Red
    exit 1
}

# Solicitar dados do usuário
Write-Host "2. Preencha os dados do novo tenant:" -ForegroundColor Yellow
Write-Host ""

$tenantName = Read-Host "   Nome do Tenant (ex: Minha Empresa LTDA)"
$domain = Read-Host "   Domínio/Subdomínio (ex: minhaempresa)"
$planId = Read-Host "   ID do Plano (use um dos IDs acima)"

# Verificar domínio
Write-Host ""
Write-Host "3. Verificando disponibilidade do domínio..." -ForegroundColor Yellow
try {
    $checkDomainBody = @{
        domain = $domain
    } | ConvertTo-Json
    
    $checkResponse = Invoke-RestMethod -Uri "$baseUrl/api/public/check-domain/" -Method Post -Body $checkDomainBody -ContentType "application/json"
    
    if ($checkResponse.available) {
        Write-Host "   ✓ Domínio disponível!" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Domínio já está em uso!" -ForegroundColor Red
        Write-Host "   Escolha outro domínio." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ⚠ Não foi possível verificar o domínio. Continuando..." -ForegroundColor Yellow
}

# Dados do admin
Write-Host ""
Write-Host "4. Dados do Administrador:" -ForegroundColor Yellow
$adminUsername = Read-Host "   Username do Admin"
$adminEmail = Read-Host "   Email do Admin"
$adminPassword = Read-Host "   Senha do Admin" -AsSecureString
$adminPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPassword))
$adminFirstName = Read-Host "   Primeiro Nome (opcional)"
$adminLastName = Read-Host "   Sobrenome (opcional)"

# Dados da empresa
Write-Host ""
Write-Host "5. Dados da Empresa:" -ForegroundColor Yellow
$empresaNome = Read-Host "   Nome da Empresa"
$empresaCnpj = Read-Host "   CNPJ (opcional)"
$empresaRazaoSocial = Read-Host "   Razão Social (opcional)"

# Criar JSON
$signupData = @{
    tenant_name = $tenantName
    domain = $domain
    plan_id = [int]$planId
    admin_username = $adminUsername
    admin_email = $adminEmail
    admin_password = $adminPasswordPlain
    admin_first_name = $adminFirstName
    admin_last_name = $adminLastName
    empresa_nome = $empresaNome
    empresa_cnpj = $empresaCnpj
    empresa_razao_social = $empresaRazaoSocial
} | ConvertTo-Json

# Criar tenant
Write-Host ""
Write-Host "6. Criando tenant..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/public/signup/" -Method Post -Body $signupData -ContentType "application/json"
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✓ TENANT CRIADO COM SUCESSO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Detalhes:" -ForegroundColor Cyan
    Write-Host "  Tenant ID: $($response.tenant.id)" -ForegroundColor White
    Write-Host "  Nome: $($response.tenant.name)" -ForegroundColor White
    Write-Host "  Domínio: $($response.tenant.domain)" -ForegroundColor White
    Write-Host "  Usuário: $($response.user.username)" -ForegroundColor White
    Write-Host "  Email: $($response.user.email)" -ForegroundColor White
    Write-Host "  Plano: $($response.subscription.plan)" -ForegroundColor White
    Write-Host "  Status: $($response.subscription.status)" -ForegroundColor White
    Write-Host ""
    Write-Host "URL de Login:" -ForegroundColor Cyan
    Write-Host "  $($response.login_url)" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ✗ ERRO AO CRIAR TENANT" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorResponse) {
        Write-Host "Erro: $($errorResponse.error)" -ForegroundColor Red
    } else {
        Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Verifique:" -ForegroundColor Yellow
    Write-Host "  - Se o servidor está rodando" -ForegroundColor White
    Write-Host "  - Se o domínio não está em uso" -ForegroundColor White
    Write-Host "  - Se o email/username não está em uso" -ForegroundColor White
    Write-Host "  - Se o plan_id é válido" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Pressione qualquer tecla para sair..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

