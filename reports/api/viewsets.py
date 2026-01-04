"""
ViewSets para o módulo de relatórios
"""
import logging
from io import BytesIO
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from reports.models import ReportTemplate, ReportConfig
from reports.api.serializers import (
    ReportTemplateSerializer,
    ReportConfigSerializer,
    GerarRelatorioSerializer
)
from reports.engine import ReportEngine
from cadastros.utils import get_current_empresa_filial
from django.db import connection
from django_tenants.utils import schema_context

logger = logging.getLogger(__name__)


class ReportTemplateViewSet(viewsets.ModelViewSet):
    """
    CRUD de templates de relatórios
    """
    serializer_class = ReportTemplateSerializer
    permission_classes = [IsAuthenticated]
    
    def _get_current_tenant(self, request):
        """Obtém o tenant atual do request"""
        # Tentar obter do request (configurado pelo middleware)
        if hasattr(request, 'tenant') and request.tenant:
            return request.tenant
        
        # Tentar obter da connection
        if hasattr(connection, 'tenant') and connection.tenant:
            return connection.tenant
        
        # Tentar obter do perfil do usuário
        if request.user and hasattr(request.user, 'profile'):
            try:
                return request.user.profile.current_tenant
            except:
                pass
        
        return None
    
    def get_queryset(self):
        queryset = ReportTemplate.objects.all()
        tenant = self._get_current_tenant(self.request)
        empresa, _ = get_current_empresa_filial(self.request.user)
        
        # Filtrar por tenant/empresa
        if empresa:
            queryset = queryset.filter(
                models.Q(empresa=empresa) |
                models.Q(empresa__isnull=True, tenant=tenant) |
                models.Q(empresa__isnull=True, tenant__isnull=True)
            )
        elif tenant:
            queryset = queryset.filter(
                Q(tenant=tenant) |
                Q(tenant__isnull=True)
            )
        else:
            queryset = queryset.filter(tenant__isnull=True, empresa__isnull=True)
        
        # Filtros opcionais
        modulo = self.request.query_params.get('modulo')
        if modulo:
            queryset = queryset.filter(modulo=modulo)
        
        tipo = self.request.query_params.get('tipo')
        if tipo:
            queryset = queryset.filter(tipo_relatorio=tipo)
        
        return queryset.order_by('modulo', 'tipo_relatorio', 'nome')


class ReportConfigViewSet(viewsets.ModelViewSet):
    """
    Configurações de relatórios
    """
    serializer_class = ReportConfigSerializer
    permission_classes = [IsAuthenticated]
    
    def _get_current_tenant(self, request):
        """Obtém o tenant atual do request"""
        # Tentar obter do request (configurado pelo middleware)
        if hasattr(request, 'tenant') and request.tenant:
            return request.tenant
        
        # Tentar obter da connection
        if hasattr(connection, 'tenant') and connection.tenant:
            return connection.tenant
        
        # Tentar obter do perfil do usuário
        if request.user and hasattr(request.user, 'profile'):
            try:
                return request.user.profile.current_tenant
            except:
                pass
        
        return None
    
    def get_queryset(self):
        queryset = ReportConfig.objects.all()
        tenant = self._get_current_tenant(self.request)
        empresa, _ = get_current_empresa_filial(self.request.user)
        
        if empresa:
            queryset = queryset.filter(tenant=tenant, empresa=empresa)
        elif tenant:
            queryset = queryset.filter(tenant=tenant, empresa__isnull=True)
        else:
            queryset = queryset.none()
        
        return queryset


class ReportGeneratorViewSet(viewsets.ViewSet):
    """
    Geração de relatórios
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def gerar(self, request):
        """
        Gera relatório em formato especificado
        
        Body:
        {
            "tipo": "estoque-por-location",
            "modulo": "estoque",
            "formato": "pdf",
            "template_id": null,
            "filtros": {...},
            "enviar_email": false,
            "email_destinatario": null
        }
        """
        serializer = GerarRelatorioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        tipo = data['tipo']
        modulo = data.get('modulo')
        formato = data.get('formato', 'pdf')
        template_id = data.get('template_id')
        filtros = data.get('filtros', {})
        
        def _get_current_tenant(request):
            """Obtém o tenant atual do request"""
            if hasattr(request, 'tenant') and request.tenant:
                return request.tenant
            if hasattr(connection, 'tenant') and connection.tenant:
                return connection.tenant
            if request.user and hasattr(request.user, 'profile'):
                try:
                    return request.user.profile.current_tenant
                except:
                    pass
            return None
        
        try:
            # Obter tenant e empresa
            tenant = _get_current_tenant(request)
            empresa, _ = get_current_empresa_filial(request.user)
            
            # Criar engine
            engine = ReportEngine(tenant=tenant, empresa=empresa, usuario=request.user)
            
            # Buscar dados do relatório (delegar para módulo específico)
            relatorio_data = self._get_relatorio_data(tipo, modulo, filtros, tenant, empresa)
            
            # Gerar relatório
            if formato == 'pdf':
                pdf_file = engine.render_pdf(tipo, relatorio_data, modulo, template_id)
                response = HttpResponse(pdf_file.read(), content_type='application/pdf')
                response['Content-Disposition'] = f'attachment; filename="relatorio_{tipo}.pdf"'
                return response
            elif formato == 'html':
                html_content = engine.render_html(tipo, relatorio_data, modulo, template_id)
                return Response({'html': html_content})
            else:
                return Response(
                    {'error': f'Formato {formato} não implementado ainda'},
                    status=status.HTTP_501_NOT_IMPLEMENTED
                )
                
        except Exception as e:
            logger.error(f"Erro ao gerar relatório: {e}", exc_info=True)
            return Response(
                {'error': f'Erro ao gerar relatório: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def preview(self, request):
        """
        Preview HTML do relatório (sem gerar PDF)
        """
        tipo = request.query_params.get('tipo')
        modulo = request.query_params.get('modulo')
        template_id = request.query_params.get('template_id', type=int)
        
        if not tipo:
            return Response(
                {'error': 'Parâmetro "tipo" é obrigatório'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        def _get_current_tenant(request):
            """Obtém o tenant atual do request"""
            if hasattr(request, 'tenant') and request.tenant:
                return request.tenant
            if hasattr(connection, 'tenant') and connection.tenant:
                return connection.tenant
            if request.user and hasattr(request.user, 'profile'):
                try:
                    return request.user.profile.current_tenant
                except:
                    pass
            return None
        
        try:
            tenant = _get_current_tenant(request)
            empresa, _ = get_current_empresa_filial(request.user)
            
            engine = ReportEngine(tenant=tenant, empresa=empresa, usuario=request.user)
            
            # Dados de exemplo para preview
            dados_exemplo = self._get_dados_exemplo(tipo, modulo)
            
            html_content = engine.render_html(tipo, dados_exemplo, modulo, template_id)
            return Response({'html': html_content})
            
        except Exception as e:
            logger.error(f"Erro ao gerar preview: {e}", exc_info=True)
            return Response(
                {'error': f'Erro ao gerar preview: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _get_relatorio_data(self, tipo, modulo, filtros, tenant, empresa):
        """
        Busca dados do relatório do módulo específico
        """
        # Delegar para módulo específico
        if modulo == 'estoque':
            return self._get_estoque_data(tipo, filtros, tenant, empresa)
        # Adicionar outros módulos aqui
        
        return {}
    
    def _get_estoque_data(self, tipo, filtros, tenant, empresa):
        """Busca dados de relatórios de estoque"""
        from django_tenants.utils import schema_context
        from estoque.models import Estoque, Location
        
        if tenant:
            with schema_context(tenant.schema_name):
                if tipo == 'estoque-por-location':
                    # Implementar lógica de busca de dados
                    # Por enquanto, retornar estrutura vazia
                    return {
                        'dados': [],
                        'total_geral': '0.00'
                    }
        else:
            if tipo == 'estoque-por-location':
                return {
                    'dados': [],
                    'total_geral': '0.00'
                }
        
        return {}
    
    def _get_dados_exemplo(self, tipo, modulo):
        """Retorna dados de exemplo para preview"""
        if modulo == 'estoque' and tipo == 'estoque-por-location':
            return {
                'dados': [
                    {
                        'location_nome': 'Location A',
                        'produto_nome': 'Produto Exemplo',
                        'produto_codigo': '001',
                        'quantidade': '100.000',
                        'valor_unitario': '10.50',
                        'valor_total': '1050.00'
                    }
                ],
                'total_geral': '1050.00'
            }
        return {}

