@echo off
chcp 65001 >nul
echo ========================================
echo   Removendo Tenant de Teste
echo ========================================
echo.
echo Este script remove o tenant de teste do banco de dados.
echo.
pause

echo Removendo tenant de teste...
docker-compose exec web python manage.py shell -c "from tenants.models import Tenant; from django_tenants.utils import schema_context; tenant = Tenant.objects.filter(schema_name='teste_tenant').first(); tenant.delete() if tenant else None; print('Tenant removido!' if tenant else 'Tenant nao encontrado')"

echo.
echo ========================================
echo   Concluido!
echo ========================================
pause

