# C:\siscr\core\views.py
# Views limpas - apenas APIs auxiliares necessárias
# Todas as views de templates foram migradas para React

from django.http import JsonResponse
from django.db.models import Q
from cadastros.models import Pessoa
from financeiro.models import ContaReceber, ContaPagar


# ----------------------------
# APIs Auxiliares (JSON)
# ----------------------------

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


def buscar_conta_a_pagar(request):
    """
    API auxiliar para buscar conta a pagar por código.
    """
    codigo = request.GET.get('codigo')
    if not codigo:
        return JsonResponse({'encontrado': False, 'erro': 'Código não fornecido'}, status=400)
    
    try:
        conta = ContaPagar.objects.get(codigo_conta=codigo)
        return JsonResponse({
            'encontrado': True,
            'conta': {
                'codigo_conta': conta.codigo_conta,
                'numero_documento': conta.numero_documento,
                'valor_total': str(conta.valor_total),
                'valor_pendente': str(conta.valor_pendente),
                'status': conta.status,
            }
        })
    except ContaPagar.DoesNotExist:
        return JsonResponse({'encontrado': False})
    except Exception as e:
        return JsonResponse({'encontrado': False, 'erro': str(e)}, status=500)


def buscar_conta_a_receber(request):
    """
    API auxiliar para buscar conta a receber por código.
    """
    codigo = request.GET.get('codigo')
    if not codigo:
        return JsonResponse({'encontrado': False, 'erro': 'Código não fornecido'}, status=400)
    
    try:
        conta = ContaReceber.objects.get(codigo_conta=codigo)
        return JsonResponse({
            'encontrado': True,
            'conta': {
                'codigo_conta': conta.codigo_conta,
                'numero_documento': conta.numero_documento,
                'valor_total': str(conta.valor_total),
                'valor_pendente': str(conta.valor_pendente),
                'status': conta.status,
            }
        })
    except ContaReceber.DoesNotExist:
        return JsonResponse({'encontrado': False})
    except Exception as e:
        return JsonResponse({'encontrado': False, 'erro': str(e)}, status=500)
