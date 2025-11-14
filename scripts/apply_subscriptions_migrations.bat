@echo off
REM Script para aplicar migrations e criar dados de exemplo de assinaturas (Windows)

echo Aplicando migrations no schema publico...
docker-compose exec web python manage.py migrate_schemas --shared

echo.
echo Criando dados de exemplo de assinaturas...
docker-compose exec web python manage.py seed_subscriptions

echo.
echo Concluido! Acesse http://localhost:8000/admin/subscriptions/
pause

