@echo off
REM Script para aplicar migrations do app payments
REM Uso: scripts\apply_payments_migrations.bat

echo 🔄 Aplicando migrations do app payments...

REM Verificar se o container está rodando
docker-compose ps | findstr /C:"web" | findstr /C:"Up" >nul
if %errorlevel% neq 0 (
    echo ❌ Container 'web' não está rodando. Inicie com: docker-compose up -d
    exit /b 1
)

echo 📦 Criando migrations...
docker-compose exec web python manage.py makemigrations payments

if %errorlevel% neq 0 (
    echo ❌ Erro ao criar migrations
    exit /b 1
)

echo ✅ Migrations criadas com sucesso!

echo 🗄️ Aplicando migrations no schema público (shared)...
docker-compose exec web python manage.py migrate_schemas --shared

if %errorlevel% neq 0 (
    echo ❌ Erro ao aplicar migrations no schema público
    exit /b 1
)

echo ✅ Migrations aplicadas no schema público!

echo 🎉 Concluído! O app payments está pronto para uso.
echo.
echo 📝 Próximos passos:
echo    1. Verificar no admin: http://localhost:8000/admin/payments/
echo    2. Testar API: http://localhost:8000/api/payments/payment-methods/
echo    3. Verificar documentação: docs/WEBHOOKS_STRIPE.md

pause

