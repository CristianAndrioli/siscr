#!/bin/bash
# Script genérico para aplicar migrations de um app específico
# Uso: ./scripts/database/apply_migrations.sh [app_name] [--seed]
# Exemplo: ./scripts/database/apply_migrations.sh payments
# Exemplo: ./scripts/database/apply_migrations.sh subscriptions --seed

if [ -z "$1" ]; then
    echo "❌ Erro: Nome do app não fornecido"
    echo ""
    echo "Uso: apply_migrations.sh [app_name] [--seed]"
    echo ""
    echo "Exemplos:"
    echo "  apply_migrations.sh payments"
    echo "  apply_migrations.sh subscriptions --seed"
    exit 1
fi

APP_NAME=$1
SEED_FLAG=$2

echo "🔄 Aplicando migrations do app: $APP_NAME..."

# Verificar se o container está rodando
if ! docker-compose ps | grep -q "web.*Up"; then
    echo "❌ Container 'web' não está rodando. Inicie com: docker-compose up -d"
    exit 1
fi

echo "📦 Criando migrations..."
docker-compose exec web python manage.py makemigrations "$APP_NAME"

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

# Executar seed se solicitado
if [ "$SEED_FLAG" == "--seed" ]; then
    echo ""
    echo "🌱 Executando seed de dados..."
    docker-compose exec web python manage.py seed_$APP_NAME
    if [ $? -eq 0 ]; then
        echo "✅ Seed executado com sucesso!"
    else
        echo "⚠️  Aviso: Seed pode ter falhado ou não existe para este app"
    fi
fi

echo ""
echo "🎉 Concluído! O app $APP_NAME está pronto para uso."
echo ""
echo "📝 Próximos passos:"
echo "   1. Verificar no admin: http://localhost:8000/admin/$APP_NAME/"
echo "   2. Testar API: http://localhost:8000/api/$APP_NAME/"

