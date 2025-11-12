# cadastros/api/viewsets.py
# ViewSets movidos de core/api/viewsets.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Max
from cadastros.models import Pessoa, Produto, Servico
from .serializers import PessoaSerializer, ProdutoSerializer, ServicoSerializer


class PessoaViewSet(viewsets.ModelViewSet):
    queryset = Pessoa.objects.all().order_by('codigo_cadastro')
    serializer_class = PessoaSerializer
    # Campos que serão pesquisados pelo SearchFilter do DRF
    search_fields = ['cpf_cnpj', 'nome_completo', 'razao_social', 'nome_fantasia', 'cidade', 'email']

    @action(detail=False, methods=['get'])
    def proximo_codigo(self, request):
        """Retorna o próximo código de cadastro disponível."""
        try:
            max_id = Pessoa.objects.all().aggregate(max_id=Max('codigo_cadastro'))['max_id']
            proximo_codigo = (max_id or 0) + 1
        except Exception:
            # Se a tabela não existir ou houver erro, retorna 1
            proximo_codigo = 1
        return Response({'proximo_codigo': proximo_codigo})


class ProdutoViewSet(viewsets.ModelViewSet):
    queryset = Produto.objects.all().order_by('codigo_produto')
    serializer_class = ProdutoSerializer
    # Campos que serão pesquisados pelo SearchFilter do DRF
    search_fields = ['nome', 'descricao', 'codigo_ncm']

    @action(detail=False, methods=['get'])
    def proximo_codigo(self, request):
        """Retorna o próximo código de produto disponível."""
        try:
            max_id = Produto.objects.all().aggregate(max_id=Max('codigo_produto'))['max_id']
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

    @action(detail=False, methods=['get'])
    def proximo_codigo(self, request):
        """Retorna o próximo código de serviço disponível."""
        try:
            max_id = Servico.objects.all().aggregate(max_id=Max('codigo_servico'))['max_id']
            proximo_codigo = (max_id or 0) + 1
        except Exception:
            # Se a tabela não existir ou houver erro, retorna 1
            proximo_codigo = 1
        return Response({'proximo_codigo': proximo_codigo})

