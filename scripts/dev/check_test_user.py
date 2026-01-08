#!/usr/bin/env python
"""
Script wrapper para verificar o usuário teste_user

Este script é um wrapper que chama check_user.py com o usuário 'teste_user'
e senha 'senha123' como padrão.

Uso:
    python scripts/dev/check_test_user.py

Para verificar outros usuários, use:
    python scripts/dev/check_user.py [username] [password]
"""
import sys
import os
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'siscr.settings')
django.setup()

# Importar função check_user do mesmo diretório
from check_user import check_user

if __name__ == '__main__':
    print("=" * 60)
    print("Verificando usuário de teste: teste_user")
    print("=" * 60)
    
    # Verificar usuário teste_user com senha padrão
    check_user('teste_user', 'senha123')
    
    print("\n=== Resumo ===")
    print("Para fazer login, use:")
    print("  URL: http://teste-tenant.localhost:8000/api/auth/login/")
    print("  Username: teste_user")
    print("  Password: senha123")

