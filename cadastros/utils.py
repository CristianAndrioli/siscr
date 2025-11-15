"""
Utilitários para o app cadastros
"""
from django.db.models import Q
from django.db import models


def filter_by_empresa_filial(queryset, empresa=None, filial=None):
    """
    Filtra um queryset por empresa e/ou filial.
    
    Lógica:
    - Se filial fornecida: mostra dados da filial + dados compartilhados da empresa (filial=None, empresa=filial.empresa) + dados totalmente compartilhados (empresa=None, filial=None)
    - Se apenas empresa fornecida: mostra dados da empresa (todas as filiais) + dados compartilhados (empresa=None)
    - Se nenhum fornecido: mostra apenas dados compartilhados (empresa=None e filial=None)
    
    Args:
        queryset: QuerySet a ser filtrado
        empresa: Instância de Empresa ou None
        filial: Instância de Filial ou None
    
    Returns:
        QuerySet filtrado
    """
    if filial:
        # Se tem filial, mostrar:
        # 1. Dados específicos dessa filial
        # 2. Dados compartilhados da empresa (filial=None, empresa=filial.empresa)
        # 3. Dados totalmente compartilhados (empresa=None, filial=None)
        if hasattr(filial, 'empresa') and filial.empresa:
            queryset = queryset.filter(
                Q(filial=filial) | 
                Q(filial__isnull=True, empresa=filial.empresa) |
                Q(empresa__isnull=True, filial__isnull=True)
            )
        else:
            # Se filial não tem empresa, apenas filtrar por filial
            queryset = queryset.filter(
                Q(filial=filial) | Q(filial__isnull=True)
            )
    elif empresa:
        # Se tem empresa, mostrar dados da empresa (todas as filiais) + dados compartilhados
        queryset = queryset.filter(
            Q(empresa=empresa) | Q(empresa__isnull=True)
        )
    else:
        # Se não tem empresa nem filial, mostrar apenas dados compartilhados
        queryset = queryset.filter(empresa__isnull=True, filial__isnull=True)
    
    return queryset


def get_current_empresa_filial(user):
    """
    Obtém a empresa e filial atual do usuário a partir do UserProfile.
    
    Args:
        user: Instância de User
    
    Returns:
        tuple: (empresa, filial) ou (None, None)
    """
    if not user or not hasattr(user, 'profile'):
        return (None, None)
    
    profile = user.profile
    return (profile.current_empresa, profile.current_filial)

