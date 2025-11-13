# cadastros/views.py
# Views limpas - apenas APIs auxiliares necessárias
# Todas as views de templates foram migradas para React

from django.http import JsonResponse
from django.db.models import Q
from .models import Pessoa


# ===============================================
# APIs AUXILIARES (JSON)
# ===============================================

def buscar_cadastro(request):
    """
    API auxiliar para buscar cadastro por código.
    Retorna JSON com dados da pessoa.
    """
    codigo = request.GET.get('codigo')
    if not codigo:
        return JsonResponse({'encontrado': False, 'erro': 'Código não fornecido'}, status=400)
    
    try:
        pessoa = Pessoa.objects.get(codigo_cadastro=codigo)
        data = {
            'encontrado': True, 
            'cadastro': {
                'codigo_cadastro': pessoa.codigo_cadastro,
                'tipo': pessoa.tipo,
                'cpf_cnpj': pessoa.cpf_cnpj,
                'nome_completo': pessoa.nome_completo,
                'razao_social': pessoa.razao_social,
                'email': pessoa.email,
            }
        }
        return JsonResponse(data)
    except Pessoa.DoesNotExist:
        return JsonResponse({'encontrado': False})
    except Exception as e:
        return JsonResponse({'encontrado': False, 'erro': str(e)}, status=500)


def buscar_fornecedor(request):
    """
    API auxiliar para buscar fornecedor por código.
    Retorna JSON com nome do fornecedor.
    """
    codigo = request.GET.get('codigo')
    if not codigo:
        return JsonResponse({'encontrado': False, 'erro': 'Código não fornecido'}, status=400)
    
    try:
        pessoa = Pessoa.objects.get(codigo_cadastro=codigo, tipo='fornecedor')
        return JsonResponse({
            'encontrado': True, 
            'nome': pessoa.nome_completo or pessoa.razao_social
        })
    except Pessoa.DoesNotExist:
        return JsonResponse({'encontrado': False})
    except Exception as e:
        return JsonResponse({'encontrado': False, 'erro': str(e)}, status=500)
