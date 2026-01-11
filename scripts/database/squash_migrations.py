"""
Script para consolidar todas as migrações em uma única migração inicial por app
Uso: python scripts/database/squash_migrations.py
"""
import os
import sys
import shutil
from pathlib import Path

# Configurar encoding para Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Adicionar o diretório raiz ao path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))

# Apps que têm migrações
APPS_WITH_MIGRATIONS = [
    'accounts',
    'cadastros',
    'estoque',
    'faturamento',
    'financeiro',
    'payments',
    'public',
    'reports',
    'subscriptions',
    'tenants',
    'vendas',
]

def backup_migrations():
    """Faz backup das migrações atuais"""
    backup_dir = BASE_DIR / 'database' / 'migrations_backup'
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    print("📦 Fazendo backup das migrações atuais...")
    for app in APPS_WITH_MIGRATIONS:
        migrations_dir = BASE_DIR / app / 'migrations'
        if migrations_dir.exists():
            backup_app_dir = backup_dir / app
            if backup_app_dir.exists():
                shutil.rmtree(backup_app_dir)
            shutil.copytree(migrations_dir, backup_app_dir)
            print(f"  ✅ Backup de {app}/migrations criado")
    
    print(f"✅ Backup completo em: {backup_dir}")
    return backup_dir

def delete_migrations():
    """Remove todas as migrações exceto __init__.py"""
    print("\n🗑️  Removendo migrações antigas...")
    for app in APPS_WITH_MIGRATIONS:
        migrations_dir = BASE_DIR / app / 'migrations'
        if migrations_dir.exists():
            # Manter __init__.py
            init_file = migrations_dir / '__init__.py'
            init_content = None
            if init_file.exists():
                init_content = init_file.read_text()
            
            # Remover todos os arquivos
            for file in migrations_dir.iterdir():
                if file.is_file() and file.name != '__init__.py':
                    file.unlink()
                    print(f"  🗑️  Removido: {app}/migrations/{file.name}")
            
            # Restaurar __init__.py se existia
            if init_content is not None:
                init_file.write_text(init_content)
            elif not init_file.exists():
                init_file.write_text('')
    
    print("✅ Migrações antigas removidas")

def generate_new_migrations():
    """Gera novas migrações iniciais usando makemigrations"""
    print("\n📝 Gerando novas migrações iniciais...")
    print("⚠️  ATENÇÃO: Execute os seguintes comandos manualmente:")
    print()
    print("1. Certifique-se de que o Docker está rodando:")
    print("   docker-compose up -d")
    print()
    print("2. Gere as migrações iniciais:")
    for app in APPS_WITH_MIGRATIONS:
        print(f"   docker-compose exec web python manage.py makemigrations {app}")
    print()
    print("3. Ou gere todas de uma vez:")
    print("   docker-compose exec web python manage.py makemigrations")
    print()
    print("4. Verifique se as migrações foram criadas:")
    for app in APPS_WITH_MIGRATIONS:
        print(f"   ls {app}/migrations/")
    print()

def main():
    print("=" * 60)
    print("🔄 SQUASH DE MIGRAÇÕES - Consolidar em migração única")
    print("=" * 60)
    print()
    print("⚠️  ATENÇÃO: Este script irá:")
    print("   1. Fazer backup de todas as migrações atuais")
    print("   2. Remover todas as migrações (exceto __init__.py)")
    print("   3. Você precisará gerar novas migrações iniciais manualmente")
    print()
    
    response = input("Deseja continuar? (digite 'SIM' para confirmar): ")
    if response.upper() != 'SIM':
        print("❌ Operação cancelada.")
        return
    
    # Fazer backup
    backup_dir = backup_migrations()
    
    # Remover migrações
    delete_migrations()
    
    # Instruções para gerar novas migrações
    generate_new_migrations()
    
    print("=" * 60)
    print("✅ Processo concluído!")
    print("=" * 60)
    print()
    print(f"📦 Backup salvo em: {backup_dir}")
    print()
    print("📋 Próximos passos:")
    print("   1. Execute os comandos acima para gerar novas migrações")
    print("   2. Teste as novas migrações em um banco limpo")
    print("   3. Se tudo estiver OK, você pode remover o backup")
    print()

if __name__ == '__main__':
    main()

