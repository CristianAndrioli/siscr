#!/bin/bash
# Script para aplicar migrations do app payments
# Uso: ./scripts/apply_payments_migrations.sh

echo "🔄 Aplicando migrations do app payments..."

# Verificar se o container está rodando
if ! docker-compose ps | grep -q "web.*Up"; then
    echo "❌ Container 'web' não está rodando. Inicie com: docker-compose up -d"
    exit 1
fi

echo "📦 Criando migrations..."
docker-compose exec web python manage.py makemigrations payments

if [ $? -ne 0 ]; then
    echo "❌ Erro ao criar migrations"
    exit 1
fi

echo "✅ Migrations criadas com sucesso!"

echo "🗄️ Aplicando migrations no schema público (shared)..."
docker-compose exec web python manage.py migrate_schemas --shared

if [ $? -ne 0 ]; then
    echo "❌ Erro ao aplicar migrations no schema público"
    exit 1
fi

echo "✅ Migrations aplicadas no schema público!"

echo "🎉 Concluído! O app payments está pronto para uso."
echo ""
echo "📝 Próximos passos:"
echo "   1. Verificar no admin: http://localhost:8000/admin/payments/"
echo "   2. Testar API: http://localhost:8000/api/payments/payment-methods/"
echo "   3. Verificar documentação: docs/WEBHOOKS_STRIPE.md"

