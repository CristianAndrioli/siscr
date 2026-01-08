"""
Engine de renderização de relatórios
"""
import logging
from io import BytesIO
from typing import Dict, Any, Optional
from django.template import Template, Context
from django.template.loader import get_template
from django.utils import timezone
from django.conf import settings

logger = logging.getLogger(__name__)

# Import lazy do WeasyPrint para evitar erro se dependências não estiverem instaladas
try:
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError) as e:
    logger.warning(f"WeasyPrint não disponível: {e}")
    WEASYPRINT_AVAILABLE = False
    HTML = None
    CSS = None
    FontConfiguration = None


class ReportEngine:
    """
    Engine para renderizar relatórios a partir de templates
    """
    
    def __init__(self, tenant=None, empresa=None, usuario=None):
        self.tenant = tenant
        self.empresa = empresa
        self.usuario = usuario
        self.config = self._get_config()
    
    def _get_config(self):
        """Busca configurações do tenant/empresa"""
        from .models import ReportConfig
        
        try:
            if self.empresa:
                config = ReportConfig.objects.filter(
                    tenant=self.tenant,
                    empresa=self.empresa
                ).first()
                if config:
                    return config
            
            # Buscar configuração do tenant (sem empresa específica)
            config = ReportConfig.objects.filter(
                tenant=self.tenant,
                empresa__isnull=True
            ).first()
            
            if config:
                return config
            
            # Criar configuração padrão se não existir
            if self.tenant:
                config = ReportConfig.objects.create(
                    tenant=self.tenant,
                    empresa=self.empresa
                )
                return config
        except Exception as e:
            logger.warning(f"Erro ao buscar configuração de relatório: {e}")
        
        return None
    
    def _get_template(self, tipo_relatorio: str, modulo: str = None, custom_template_id: int = None):
        """
        Busca template seguindo hierarquia de prioridade:
        1. Template customizado específico (custom_template_id)
        2. Template por empresa + tipo
        3. Template por tenant + tipo
        4. Template padrão do tipo
        """
        from .models import ReportTemplate
        
        # 1. Template customizado específico
        if custom_template_id:
            template = ReportTemplate.objects.filter(
                id=custom_template_id,
                is_active=True
            ).first()
            if template:
                return template
        
        # 2. Template por empresa + tipo
        if self.empresa:
            template = ReportTemplate.objects.filter(
                empresa=self.empresa,
                tipo_relatorio=tipo_relatorio,
                is_active=True
            ).first()
            if template:
                return template
        
        # 3. Template por tenant + tipo
        if self.tenant:
            template = ReportTemplate.objects.filter(
                tenant=self.tenant,
                empresa__isnull=True,
                tipo_relatorio=tipo_relatorio,
                is_active=True
            ).first()
            if template:
                return template
        
        # 4. Template padrão do tipo
        template = ReportTemplate.objects.filter(
            tipo_relatorio=tipo_relatorio,
            is_default=True,
            is_active=True,
            tenant__isnull=True,
            empresa__isnull=True
        ).first()
        
        if template:
            return template
        
        # 5. Buscar qualquer template do tipo (fallback)
        template = ReportTemplate.objects.filter(
            tipo_relatorio=tipo_relatorio,
            is_active=True,
            tenant__isnull=True,
            empresa__isnull=True
        ).first()
        
        return template
    
    def _load_template_from_file(self, template_path: str) -> str:
        """Carrega template HTML de arquivo"""
        try:
            template = get_template(template_path)
            # Retornar conteúdo do template (sem renderizar)
            # Isso é um workaround - idealmente deveríamos ler o arquivo diretamente
            from django.template.loader import get_template_from_string
            with open(template.origin.name, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            logger.error(f"Erro ao carregar template de arquivo {template_path}: {e}")
            return ""
    
    def render_html(
        self,
        tipo_relatorio: str,
        data: Dict[str, Any],
        modulo: str = None,
        custom_template_id: int = None
    ) -> str:
        """
        Renderiza HTML do relatório
        
        Args:
            tipo_relatorio: Tipo do relatório (ex: 'estoque-por-location')
            data: Dicionário com dados do relatório
            modulo: Módulo do sistema (ex: 'estoque')
            custom_template_id: ID de template customizado (opcional)
        """
        # Buscar template
        template = self._get_template(tipo_relatorio, modulo, custom_template_id)
        
        if not template:
            raise ValueError(f"Template não encontrado para tipo: {tipo_relatorio}")
        
        # Carregar conteúdo do template
        if template.template_customizado and template.template_html:
            # Usar template customizado do banco
            template_content = template.template_html
        elif template.template_arquivo:
            # Carregar template de arquivo
            template_content = self._load_template_from_file(template.template_arquivo)
        else:
            # Tentar carregar template padrão do módulo
            template_path = f'reports/modules/{modulo or "default"}/{tipo_relatorio}.html'
            template_content = self._load_template_from_file(template_path)
        
        if not template_content:
            raise ValueError(f"Conteúdo do template não encontrado para: {tipo_relatorio}")
        
        # Preparar contexto
        context = self._prepare_context(data, template)
        
        # Renderizar conteúdo do template específico
        django_template = Template(template_content)
        rendered_content = django_template.render(Context(context))
        
        # Adicionar conteúdo renderizado ao contexto para o template base
        context['content'] = rendered_content
        
        # Aplicar template base
        base_template = get_template('reports/base.html')
        final_html = base_template.render(context)
        
        return final_html
    
    def render_pdf(
        self,
        tipo_relatorio: str,
        data: Dict[str, Any],
        modulo: str = None,
        custom_template_id: int = None
    ) -> BytesIO:
        """
        Renderiza PDF do relatório
        
        Args:
            tipo_relatorio: Tipo do relatório
            data: Dados do relatório
            modulo: Módulo do sistema
            custom_template_id: ID de template customizado
        """
        # Verificar se WeasyPrint está disponível
        if not WEASYPRINT_AVAILABLE:
            raise RuntimeError(
                "WeasyPrint não está disponível. "
                "Instale as dependências do sistema: libcairo2-dev, libpango1.0-dev, libgdk-pixbuf-xlib-2.0-dev, libffi-dev"
            )
        
        # Importar WeasyPrint apenas quando necessário
        from weasyprint import HTML, CSS
        from weasyprint.text.fonts import FontConfiguration
        
        # Renderizar HTML primeiro
        html_content = self.render_html(tipo_relatorio, data, modulo, custom_template_id)
        
        # Buscar template para obter CSS e orientação
        template = self._get_template(tipo_relatorio, modulo, custom_template_id)
        
        # Preparar CSS
        css_content = self._get_css(template)
        
        # Gerar PDF com WeasyPrint
        pdf_file = BytesIO()
        
        try:
            font_config = FontConfiguration()
            html_doc = HTML(string=html_content)
            
            # Adicionar CSS
            stylesheets = [CSS(string=css_content)]
            
            # Adicionar CSS customizado do template se houver
            if template and template.template_css:
                stylesheets.append(CSS(string=template.template_css))
            
            # Gerar PDF
            html_doc.write_pdf(
                pdf_file,
                stylesheets=stylesheets,
                font_config=font_config
            )
            
            pdf_file.seek(0)
            return pdf_file
            
        except Exception as e:
            logger.error(f"Erro ao gerar PDF: {e}", exc_info=True)
            raise
    
    def _prepare_context(self, data: Dict[str, Any], template=None) -> Dict[str, Any]:
        """Prepara contexto com dados padrão + dados do relatório"""
        context = {
            'empresa': self.empresa,
            'tenant': self.tenant,
            'usuario': self.usuario,
            'config': self.config,
            'template': template,
            'data_geracao': timezone.now(),
            **data  # Dados específicos do relatório
        }
        
        # Adicionar dados da empresa se config disponível
        if self.config:
            context.update({
                'logo_url': self.config.logo_url,
                'logo_upload': self.config.logo_upload,
                'nome_empresa': self.config.nome_empresa or (self.empresa.nome if self.empresa else None),
                'endereco': self.config.endereco or (self.empresa.endereco if self.empresa else None),
                'telefone': self.config.telefone or (self.empresa.telefone if self.empresa else None),
                'email': self.config.email or (self.empresa.email if self.empresa else None),
                'cnpj': self.config.cnpj or (self.empresa.cnpj if self.empresa else None),
            })
        
        return context
    
    def _get_css(self, template=None) -> str:
        """Retorna CSS base para o relatório"""
        # Carregar CSS dos componentes
        try:
            styles_template = get_template('reports/components/styles.html')
            css_content = ""
            # Extrair CSS do template (workaround)
            # Idealmente, CSS deveria estar em arquivo separado
            return """
            @page {
                size: A4;
                margin: 2cm;
            }
            """
        except:
            return """
            @page {
                size: A4;
                margin: 2cm;
            }
            """

