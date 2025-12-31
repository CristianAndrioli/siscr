"""
ViewSets da API do módulo de Estoque
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Sum
from decimal import Decimal

from estoque.models import (
    Location, Estoque, MovimentacaoEstoque,
    ReservaEstoque, PrevisaoMovimentacao, GrupoFilial
)
from estoque.services import (
    processar_entrada_estoque,
    processar_saida_estoque,
    processar_transferencia,
    criar_reserva,
    confirmar_reserva,
    cancelar_reserva,
    EstoqueServiceError
)
from cadastros.models import Produto
from cadastros.utils import filter_by_empresa_filial, get_current_empresa_filial
from accounts.permissions import is_tenant_admin
from .serializers import (
    LocationSerializer,
    EstoqueSerializer,
    MovimentacaoEstoqueSerializer,
    ReservaEstoqueSerializer,
    PrevisaoMovimentacaoSerializer,
    GrupoFilialSerializer,
    ProcessarEntradaSerializer,
    ProcessarSaidaSerializer,
    ProcessarTransferenciaSerializer,
    CriarReservaSerializer,
    EstoqueConsolidadoSerializer,
)


class LocationViewSet(viewsets.ModelViewSet):
    """ViewSet para Location"""
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['nome', 'codigo', 'cidade', 'estado']
    filterset_fields = ['tipo', 'is_active', 'empresa', 'filial']
    
    def get_queryset(self):
        """Filtra locations por empresa/filial atual do usuário"""
        queryset = super().get_queryset()
        empresa, filial = get_current_empresa_filial(self.request.user)
        
        # Admin do tenant vê todas as locations
        if is_tenant_admin(self.request.user):
            return queryset
        
        # Filtrar por empresa/filial
        if filial:
            queryset = queryset.filter(
                Q(empresa=empresa, filial=filial) |
                Q(empresa=empresa, filial__isnull=True)
            )
        elif empresa:
            queryset = queryset.filter(empresa=empresa)
        else:
            queryset = queryset.none()
        
        return queryset.order_by('empresa', 'nome')


class EstoqueViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para Estoque (somente leitura e atualização parcial)"""
    queryset = Estoque.objects.all()
    serializer_class = EstoqueSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['produto__nome', 'produto__codigo', 'location__nome']
    filterset_fields = ['empresa', 'location', 'produto']
    
    def get_queryset(self):
        """Filtra estoques por empresa/filial atual do usuário"""
        queryset = super().get_queryset()
        empresa, filial = get_current_empresa_filial(self.request.user)
        
        # Admin do tenant vê todos os estoques
        if is_tenant_admin(self.request.user):
            return queryset.select_related('produto', 'location', 'empresa')
        
        # Filtrar por empresa/filial
        if filial:
            queryset = queryset.filter(
                Q(empresa=empresa, location__filial=filial) |
                Q(empresa=empresa, location__filial__isnull=True)
            )
        elif empresa:
            queryset = queryset.filter(empresa=empresa)
        else:
            queryset = queryset.none()
        
        return queryset.select_related('produto', 'location', 'empresa').order_by('produto__nome')
    
    def partial_update(self, request, *args, **kwargs):
        """Permite atualização parcial (ex: estoque_minimo, estoque_maximo)"""
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def consolidado(self, request):
        """Retorna estoque consolidado por empresa ou grupo de filiais"""
        serializer = EstoqueConsolidadoSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        
        empresa, filial = get_current_empresa_filial(request.user)
        produto_id = serializer.validated_data.get('produto_id')
        empresa_id = serializer.validated_data.get('empresa_id')
        grupo_filial_id = serializer.validated_data.get('grupo_filial_id')
        
        # Se não for admin, usar empresa/filial do usuário
        if not is_tenant_admin(request.user):
            empresa_id = empresa.id if empresa else None
        
        if grupo_filial_id:
            # Estoque consolidado por grupo de filiais
            try:
                grupo = GrupoFilial.objects.get(id=grupo_filial_id, empresa=empresa)
                if produto_id:
                    produto = Produto.objects.get(id=produto_id)
                    consolidado = grupo.get_estoque_consolidado(produto)
                    return Response(consolidado)
                else:
                    return Response({'error': 'produto_id é obrigatório para grupo de filiais'}, 
                                  status=status.HTTP_400_BAD_REQUEST)
            except GrupoFilial.DoesNotExist:
                return Response({'error': 'Grupo de filiais não encontrado'}, 
                              status=status.HTTP_404_NOT_FOUND)
        
        elif empresa_id:
            # Estoque consolidado por empresa
            from tenants.models import Empresa
            try:
                empresa_consolidada = Empresa.objects.get(id=empresa_id)
                estoques = Estoque.objects.filter(empresa=empresa_consolidada)
                
                if produto_id:
                    estoques = estoques.filter(produto_id=produto_id)
                
                consolidado = estoques.aggregate(
                    total_atual=Sum('quantidade_atual'),
                    total_reservada=Sum('quantidade_reservada'),
                    total_disponivel=Sum('quantidade_disponivel'),
                    total_prevista_entrada=Sum('quantidade_prevista_entrada'),
                    total_prevista_saida=Sum('quantidade_prevista_saida'),
                )
                
                valor_total = sum(e.valor_total for e in estoques)
                
                return Response({
                    'quantidade_atual': consolidado['total_atual'] or Decimal('0.000'),
                    'quantidade_reservada': consolidado['total_reservada'] or Decimal('0.000'),
                    'quantidade_disponivel': consolidado['total_disponivel'] or Decimal('0.000'),
                    'quantidade_prevista_entrada': consolidado['total_prevista_entrada'] or Decimal('0.000'),
                    'quantidade_prevista_saida': consolidado['total_prevista_saida'] or Decimal('0.000'),
                    'valor_total': Decimal(str(valor_total)),
                    'locations': estoques.values('location').distinct().count(),
                })
            except Empresa.DoesNotExist:
                return Response({'error': 'Empresa não encontrada'}, 
                              status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'error': 'empresa_id ou grupo_filial_id é obrigatório'}, 
                          status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def entrada(self, request):
        """Processa entrada de estoque"""
        serializer = ProcessarEntradaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        empresa, filial = get_current_empresa_filial(request.user)
        if not empresa:
            return Response({'error': 'Empresa não configurada para o usuário'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            produto = Produto.objects.get(id=serializer.validated_data['produto_id'])
            location = Location.objects.get(id=serializer.validated_data['location_id'])
            
            resultado = processar_entrada_estoque(
                produto=produto,
                location=location,
                empresa=empresa,
                quantidade=serializer.validated_data['quantidade'],
                valor_unitario=serializer.validated_data['valor_unitario'],
                origem=serializer.validated_data.get('origem', 'COMPRA'),
                documento_referencia=serializer.validated_data.get('documento_referencia'),
                numero_nota_fiscal=serializer.validated_data.get('numero_nota_fiscal'),
                serie_nota_fiscal=serializer.validated_data.get('serie_nota_fiscal'),
                observacoes=serializer.validated_data.get('observacoes'),
            )
            
            return Response({
                'estoque': EstoqueSerializer(resultado['estoque']).data,
                'movimentacao': MovimentacaoEstoqueSerializer(resultado['movimentacao']).data,
                'custo_medio_anterior': str(resultado['custo_medio_anterior']),
                'custo_medio_novo': str(resultado['custo_medio_novo']),
            }, status=status.HTTP_201_CREATED)
            
        except Produto.DoesNotExist:
            return Response({'error': 'Produto não encontrado'}, 
                          status=status.HTTP_404_NOT_FOUND)
        except Location.DoesNotExist:
            return Response({'error': 'Location não encontrada'}, 
                          status=status.HTTP_404_NOT_FOUND)
        except EstoqueServiceError as e:
            return Response({'error': str(e)}, 
                          status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def saida(self, request):
        """Processa saída de estoque"""
        serializer = ProcessarSaidaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        empresa, filial = get_current_empresa_filial(request.user)
        if not empresa:
            return Response({'error': 'Empresa não configurada para o usuário'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            produto = Produto.objects.get(id=serializer.validated_data['produto_id'])
            location = Location.objects.get(id=serializer.validated_data['location_id'])
            
            valor_unitario = serializer.validated_data.get('valor_unitario')
            if not valor_unitario:
                # Buscar custo médio do estoque
                try:
                    estoque = Estoque.objects.get(produto=produto, location=location, empresa=empresa)
                    valor_unitario = estoque.valor_custo_medio
                except Estoque.DoesNotExist:
                    return Response({'error': 'Estoque não encontrado'}, 
                                  status=status.HTTP_404_NOT_FOUND)
            
            resultado = processar_saida_estoque(
                produto=produto,
                location=location,
                empresa=empresa,
                quantidade=serializer.validated_data['quantidade'],
                valor_unitario=valor_unitario,
                origem=serializer.validated_data.get('origem', 'VENDA'),
                documento_referencia=serializer.validated_data.get('documento_referencia'),
                numero_nota_fiscal=serializer.validated_data.get('numero_nota_fiscal'),
                serie_nota_fiscal=serializer.validated_data.get('serie_nota_fiscal'),
                observacoes=serializer.validated_data.get('observacoes'),
                verificar_estoque_minimo=serializer.validated_data.get('verificar_estoque_minimo', True),
            )
            
            response_data = {
                'estoque': EstoqueSerializer(resultado['estoque']).data,
                'movimentacao': MovimentacaoEstoqueSerializer(resultado['movimentacao']).data,
            }
            
            if resultado.get('alerta_estoque_minimo'):
                response_data['alerta_estoque_minimo'] = resultado['alerta_estoque_minimo']
            
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except Produto.DoesNotExist:
            return Response({'error': 'Produto não encontrado'}, 
                          status=status.HTTP_404_NOT_FOUND)
        except Location.DoesNotExist:
            return Response({'error': 'Location não encontrada'}, 
                          status=status.HTTP_404_NOT_FOUND)
        except EstoqueServiceError as e:
            return Response({'error': str(e)}, 
                          status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def transferencia(self, request):
        """Processa transferência de estoque"""
        serializer = ProcessarTransferenciaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        empresa, filial = get_current_empresa_filial(request.user)
        if not empresa:
            return Response({'error': 'Empresa não configurada para o usuário'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            produto = Produto.objects.get(id=serializer.validated_data['produto_id'])
            location_origem = Location.objects.get(id=serializer.validated_data['location_origem_id'])
            location_destino = Location.objects.get(id=serializer.validated_data['location_destino_id'])
            
            resultado = processar_transferencia(
                produto=produto,
                location_origem=location_origem,
                location_destino=location_destino,
                empresa=empresa,
                quantidade=serializer.validated_data['quantidade'],
                valor_unitario=serializer.validated_data.get('valor_unitario'),
                documento_referencia=serializer.validated_data.get('documento_referencia'),
                observacoes=serializer.validated_data.get('observacoes'),
            )
            
            return Response({
                'movimentacao_saida': MovimentacaoEstoqueSerializer(resultado['movimentacao_saida']).data,
                'movimentacao_entrada': MovimentacaoEstoqueSerializer(resultado['movimentacao_entrada']).data,
                'estoque_origem': EstoqueSerializer(resultado['estoque_origem']).data,
                'estoque_destino': EstoqueSerializer(resultado['estoque_destino']).data,
            }, status=status.HTTP_201_CREATED)
            
        except Produto.DoesNotExist:
            return Response({'error': 'Produto não encontrado'}, 
                          status=status.HTTP_404_NOT_FOUND)
        except Location.DoesNotExist:
            return Response({'error': 'Location não encontrada'}, 
                          status=status.HTTP_404_NOT_FOUND)
        except EstoqueServiceError as e:
            return Response({'error': str(e)}, 
                          status=status.HTTP_400_BAD_REQUEST)


class MovimentacaoEstoqueViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para MovimentacaoEstoque (somente leitura)"""
    queryset = MovimentacaoEstoque.objects.all()
    serializer_class = MovimentacaoEstoqueSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['estoque__produto__nome', 'documento_referencia', 'numero_nota_fiscal']
    filterset_fields = ['tipo', 'origem', 'status', 'estoque', 'estoque__location']
    
    def get_queryset(self):
        """Filtra movimentações por empresa/filial atual do usuário"""
        queryset = super().get_queryset()
        empresa, filial = get_current_empresa_filial(self.request.user)
        
        # Admin do tenant vê todas as movimentações
        if is_tenant_admin(self.request.user):
            return queryset.select_related('estoque', 'estoque__produto', 'estoque__location')
        
        # Filtrar por empresa
        if empresa:
            queryset = queryset.filter(estoque__empresa=empresa)
        else:
            queryset = queryset.none()
        
        return queryset.select_related('estoque', 'estoque__produto', 'estoque__location').order_by('-data_movimentacao')


class ReservaEstoqueViewSet(viewsets.ModelViewSet):
    """ViewSet para ReservaEstoque"""
    queryset = ReservaEstoque.objects.all()
    serializer_class = ReservaEstoqueSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['estoque__produto__nome', 'documento_referencia']
    filterset_fields = ['tipo', 'origem', 'status', 'estoque']
    
    def get_queryset(self):
        """Filtra reservas por empresa/filial atual do usuário"""
        queryset = super().get_queryset()
        empresa, filial = get_current_empresa_filial(self.request.user)
        
        # Admin do tenant vê todas as reservas
        if is_tenant_admin(self.request.user):
            return queryset.select_related('estoque', 'estoque__produto', 'estoque__location')
        
        # Filtrar por empresa
        if empresa:
            queryset = queryset.filter(estoque__empresa=empresa)
        else:
            queryset = queryset.none()
        
        return queryset.select_related('estoque', 'estoque__produto', 'estoque__location').order_by('-created_at')
    
    def create(self, request, *args, **kwargs):
        """Cria uma nova reserva"""
        serializer = CriarReservaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        empresa, filial = get_current_empresa_filial(request.user)
        if not empresa:
            return Response({'error': 'Empresa não configurada para o usuário'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        try:
            produto = Produto.objects.get(id=serializer.validated_data['produto_id'])
            location = Location.objects.get(id=serializer.validated_data['location_id'])
            
            resultado = criar_reserva(
                produto=produto,
                location=location,
                empresa=empresa,
                quantidade=serializer.validated_data['quantidade'],
                tipo=serializer.validated_data.get('tipo', 'SOFT'),
                origem=serializer.validated_data.get('origem', 'VENDA'),
                documento_referencia=serializer.validated_data.get('documento_referencia'),
                minutos_expiracao=serializer.validated_data.get('minutos_expiracao', 30),
                observacoes=serializer.validated_data.get('observacoes'),
            )
            
            return Response({
                'reserva': ReservaEstoqueSerializer(resultado['reserva']).data,
                'estoque': EstoqueSerializer(resultado['estoque']).data,
            }, status=status.HTTP_201_CREATED)
            
        except Produto.DoesNotExist:
            return Response({'error': 'Produto não encontrado'}, 
                          status=status.HTTP_404_NOT_FOUND)
        except Location.DoesNotExist:
            return Response({'error': 'Location não encontrada'}, 
                          status=status.HTTP_404_NOT_FOUND)
        except EstoqueServiceError as e:
            return Response({'error': str(e)}, 
                          status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def confirmar(self, request, pk=None):
        """Confirma uma reserva"""
        reserva = self.get_object()
        
        try:
            resultado = confirmar_reserva(reserva)
            return Response({
                'reserva': ReservaEstoqueSerializer(resultado['reserva']).data,
                'estoque': EstoqueSerializer(resultado['estoque']).data,
            })
        except EstoqueServiceError as e:
            return Response({'error': str(e)}, 
                          status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        """Cancela uma reserva"""
        reserva = self.get_object()
        motivo = request.data.get('motivo')
        
        try:
            resultado = cancelar_reserva(reserva, motivo=motivo)
            return Response({
                'reserva': ReservaEstoqueSerializer(resultado['reserva']).data,
                'estoque': EstoqueSerializer(resultado['estoque']).data,
            })
        except EstoqueServiceError as e:
            return Response({'error': str(e)}, 
                          status=status.HTTP_400_BAD_REQUEST)


class PrevisaoMovimentacaoViewSet(viewsets.ModelViewSet):
    """ViewSet para PrevisaoMovimentacao"""
    queryset = PrevisaoMovimentacao.objects.all()
    serializer_class = PrevisaoMovimentacaoSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['estoque__produto__nome', 'documento_referencia']
    filterset_fields = ['tipo', 'origem', 'status', 'estoque']
    
    def get_queryset(self):
        """Filtra previsões por empresa/filial atual do usuário"""
        queryset = super().get_queryset()
        empresa, filial = get_current_empresa_filial(self.request.user)
        
        # Admin do tenant vê todas as previsões
        if is_tenant_admin(self.request.user):
            return queryset.select_related('estoque', 'estoque__produto', 'estoque__location')
        
        # Filtrar por empresa
        if empresa:
            queryset = queryset.filter(estoque__empresa=empresa)
        else:
            queryset = queryset.none()
        
        return queryset.select_related('estoque', 'estoque__produto', 'estoque__location').order_by('data_prevista')


class GrupoFilialViewSet(viewsets.ModelViewSet):
    """ViewSet para GrupoFilial"""
    queryset = GrupoFilial.objects.all()
    serializer_class = GrupoFilialSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['nome', 'codigo']
    filterset_fields = ['empresa', 'regra_alocacao', 'is_active']
    
    def get_queryset(self):
        """Filtra grupos por empresa atual do usuário"""
        queryset = super().get_queryset()
        empresa, filial = get_current_empresa_filial(self.request.user)
        
        # Admin do tenant vê todos os grupos
        if is_tenant_admin(self.request.user):
            return queryset.select_related('empresa').prefetch_related('filiais')
        
        # Filtrar por empresa
        if empresa:
            queryset = queryset.filter(empresa=empresa)
        else:
            queryset = queryset.none()
        
        return queryset.select_related('empresa').prefetch_related('filiais').order_by('empresa', 'nome')

