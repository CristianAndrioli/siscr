"""
ViewSets da API de cadastros.

IMPORTANTE sobre permissões:
- O projeto usa permissões do Django (add/change/delete/view) configuradas via admin
- Para `ProdutoViewSet`, precisamos respeitar essas permissões de modelo
  para que, ao remover permissões de Produtos no admin, o usuário perca acesso à API também.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import DjangoModelPermissions
from django.db.models import Max
from cadastros.models import Pessoa, Produto, Servico, ContaReceber, ContaPagar
from cadastros.utils import filter_by_empresa_filial, get_current_empresa_filial
from accounts.permissions import HasProdutoPermission
from .serializers import (
    PessoaSerializer, ProdutoSerializer, ServicoSerializer,
    ContaReceberSerializer, ContaPagarSerializer
)


class PessoaViewSet(viewsets.ModelViewSet):
    queryset = Pessoa.objects.all().order_by('codigo_cadastro')
    serializer_class = PessoaSerializer
    # Campos que serão pesquisados pelo SearchFilter do DRF
    search_fields = ['cpf_cnpj', 'nome_completo', 'razao_social', 'nome_fantasia', 'cidade', 'email']

    def get_queryset(self):
        """Filtra pessoas por empresa/filial atual do usuário."""
        queryset = super().get_queryset()
        empresa, filial = get_current_empresa_filial(self.request.user)
        return filter_by_empresa_filial(queryset, empresa=empresa, filial=filial)

    @action(detail=False, methods=['get'])
    def proximo_codigo(self, request):
        """Retorna o próximo código de cadastro disponível."""
        try:
            queryset = self.get_queryset()
            max_id = queryset.aggregate(max_id=Max('codigo_cadastro'))['max_id']
            proximo_codigo = (max_id or 0) + 1
        except Exception:
            # Se a tabela não existir ou houver erro, retorna 1
            proximo_codigo = 1
        return Response({'proximo_codigo': proximo_codigo})


class ProdutoViewSet(viewsets.ModelViewSet):
    queryset = Produto.objects.all().order_by('codigo_produto')
    serializer_class = ProdutoSerializer
    # Respeitar permissões baseadas na role do usuário no tenant (TenantMembership.role),
    # usando o campo `role` presente no token JWT.
    permission_classes = (HasProdutoPermission,)
    # Campos que serão pesquisados pelo SearchFilter do DRF
    search_fields = ['nome', 'descricao', 'codigo_ncm']

    def get_queryset(self):
        """Filtra produtos por empresa/filial atual do usuário."""
        queryset = super().get_queryset()
        empresa, filial = get_current_empresa_filial(self.request.user)
        return filter_by_empresa_filial(queryset, empresa=empresa, filial=filial)

    @action(detail=False, methods=['get'])
    def proximo_codigo(self, request):
        """Retorna o próximo código de produto disponível."""
        try:
            queryset = self.get_queryset()
            max_id = queryset.aggregate(max_id=Max('codigo_produto'))['max_id']
            proximo_codigo = (max_id or 0) + 1
        except Exception:
            # Se a tabela não existir ou houver erro, retorna 1
            proximo_codigo = 1
        return Response({'proximo_codigo': proximo_codigo})


class ServicoViewSet(viewsets.ModelViewSet):
    queryset = Servico.objects.all().order_by('codigo_servico')
    serializer_class = ServicoSerializer
    # Campos que serão pesquisados pelo SearchFilter do DRF
    search_fields = ['nome', 'descricao', 'codigo_ncm']

    def get_queryset(self):
        """Filtra serviços por empresa/filial atual do usuário."""
        queryset = super().get_queryset()
        empresa, filial = get_current_empresa_filial(self.request.user)
        return filter_by_empresa_filial(queryset, empresa=empresa, filial=filial)

    @action(detail=False, methods=['get'])
    def proximo_codigo(self, request):
        """Retorna o próximo código de serviço disponível."""
        try:
            queryset = self.get_queryset()
            max_id = queryset.aggregate(max_id=Max('codigo_servico'))['max_id']
            proximo_codigo = (max_id or 0) + 1
        except Exception:
            # Se a tabela não existir ou houver erro, retorna 1
            proximo_codigo = 1
        return Response({'proximo_codigo': proximo_codigo})


class ContaReceberViewSet(viewsets.ModelViewSet):
    queryset = ContaReceber.objects.all().order_by('-data_vencimento', '-codigo_conta')
    serializer_class = ContaReceberSerializer
    search_fields = ['numero_documento', 'cliente__razao_social', 'cliente__nome_fantasia', 'descricao']
    
    def get_queryset(self):
        """Filtra contas a receber por empresa/filial atual do usuário."""
        queryset = super().get_queryset()
        empresa, filial = get_current_empresa_filial(self.request.user)
        return filter_by_empresa_filial(queryset, empresa=empresa, filial=filial)
    
    @action(detail=False, methods=['get'])
    def proximo_codigo(self, request):
        """Retorna o próximo código de conta disponível."""
        try:
            queryset = self.get_queryset()
            max_id = queryset.aggregate(max_id=Max('codigo_conta'))['max_id']
            proximo_codigo = (max_id or 0) + 1
        except Exception:
            proximo_codigo = 1
        return Response({'proximo_codigo': proximo_codigo})


class ContaPagarViewSet(viewsets.ModelViewSet):
    queryset = ContaPagar.objects.all().order_by('-data_vencimento', '-codigo_conta')
    serializer_class = ContaPagarSerializer
    search_fields = ['numero_documento', 'fornecedor__razao_social', 'fornecedor__nome_fantasia', 'descricao']
    
    def get_queryset(self):
        """Filtra contas a pagar por empresa/filial atual do usuário."""
        queryset = super().get_queryset()
        empresa, filial = get_current_empresa_filial(self.request.user)
        return filter_by_empresa_filial(queryset, empresa=empresa, filial=filial)
    
    @action(detail=False, methods=['get'])
    def proximo_codigo(self, request):
        """Retorna o próximo código de conta disponível."""
        try:
            queryset = self.get_queryset()
            max_id = queryset.aggregate(max_id=Max('codigo_conta'))['max_id']
            proximo_codigo = (max_id or 0) + 1
        except Exception:
            proximo_codigo = 1
        return Response({'proximo_codigo': proximo_codigo})

