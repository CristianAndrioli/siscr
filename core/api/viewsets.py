from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Max
# Models movidos para cadastros app  
from cadastros.models import Pessoa, Produto, Servico
from .serializers import PessoaSerializer, ProdutoSerializer, ServicoSerializer


class PessoaViewSet(viewsets.ModelViewSet):
    queryset = Pessoa.objects.all()
    serializer_class = PessoaSerializer

    @action(detail=False, methods=['get'])
    def proximo_codigo(self, request):
        """Retorna o próximo código de cadastro disponível."""
        max_id = Pessoa.objects.all().aggregate(max_id=Max('codigo_cadastro'))['max_id']
        proximo_codigo = (max_id or 0) + 1
        return Response({'proximo_codigo': proximo_codigo})


class ProdutoViewSet(viewsets.ModelViewSet):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer

    @action(detail=False, methods=['get'])
    def proximo_codigo(self, request):
        """Retorna o próximo código de produto disponível."""
        max_id = Produto.objects.all().aggregate(max_id=Max('codigo_produto'))['max_id']
        proximo_codigo = (max_id or 0) + 1
        return Response({'proximo_codigo': proximo_codigo})


class ServicoViewSet(viewsets.ModelViewSet):
    queryset = Servico.objects.all()
    serializer_class = ServicoSerializer

    @action(detail=False, methods=['get'])
    def proximo_codigo(self, request):
        """Retorna o próximo código de serviço disponível."""
        max_id = Servico.objects.all().aggregate(max_id=Max('codigo_servico'))['max_id']
        proximo_codigo = (max_id or 0) + 1
        return Response({'proximo_codigo': proximo_codigo})

