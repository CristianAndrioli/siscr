# 📊 Proposta de Arquitetura: Sistema de Templates de Relatórios

## 🎯 Objetivo

Criar um sistema flexível e extensível de templates de relatórios que permita:
- Templates HTML reutilizáveis com cabeçalho, rodapé, logo e dados da empresa
- Geração de PDFs a partir de templates HTML
- Customização por tenant/empresa
- Suporte a múltiplos tipos de relatórios (estoque, faturamento, etc.)
- Envio por email e download direto

## 🏗️ Arquitetura Proposta

### 1. **Estrutura de Templates (Hierárquica)**

```
templates/
├── reports/
│   ├── base.html                    # Template base com header/footer
│   ├── components/
│   │   ├── header.html              # Cabeçalho padrão (logo, dados empresa)
│   │   ├── footer.html              # Rodapé padrão (data, página, etc.)
│   │   └── styles.html              # Estilos CSS para impressão/PDF
│   └── modules/
│       ├── estoque/
│       │   ├── estoque_por_location.html
│       │   ├── estoque_consolidado.html
│       │   ├── movimentacoes.html
│       │   └── indicadores.html
│       ├── faturamento/
│       │   ├── vendas_periodo.html
│       │   └── faturamento_consolidado.html
│       └── cadastros/
│           └── produtos_listagem.html
```

### 2. **Modelo de Dados (Django)**

```python
# core/models.py ou novo app 'reports'

class ReportTemplate(SiscrModelBase):
    """
    Template de relatório configurável
    """
    nome = models.CharField(max_length=200)
    codigo = models.SlugField(unique=True)  # Ex: 'estoque-por-location'
    descricao = models.TextField(blank=True)
    
    # Categoria/Agrupamento
    modulo = models.CharField(max_length=50)  # 'estoque', 'faturamento', etc.
    tipo_relatorio = models.CharField(max_length=100)  # 'estoque-por-location'
    
    # Template HTML
    template_html = models.TextField()  # HTML do template
    template_css = models.TextField(blank=True)  # CSS customizado
    
    # Configurações
    incluir_logo = models.BooleanField(default=True)
    incluir_dados_empresa = models.BooleanField(default=True)
    orientacao = models.CharField(
        max_length=10,
        choices=[('portrait', 'Retrato'), ('landscape', 'Paisagem')],
        default='portrait'
    )
    
    # Variáveis disponíveis (JSON)
    variaveis_disponiveis = models.JSONField(
        default=dict,
        help_text="Variáveis que podem ser usadas no template"
    )
    
    # Escopo
    tenant = models.ForeignKey('tenants.Tenant', null=True, blank=True, on_delete=models.CASCADE)
    empresa = models.ForeignKey('tenants.Empresa', null=True, blank=True, on_delete=models.CASCADE)
    
    # Ativo/Inativo
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)  # Template padrão do tipo
    
    class Meta:
        verbose_name = 'Template de Relatório'
        verbose_name_plural = 'Templates de Relatórios'
        ordering = ['modulo', 'tipo_relatorio', 'nome']
        indexes = [
            models.Index(fields=['modulo', 'tipo_relatorio']),
            models.Index(fields=['codigo']),
        ]

class ReportConfig(SiscrModelBase):
    """
    Configurações de relatório por tenant/empresa
    """
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE)
    empresa = models.ForeignKey('tenants.Empresa', null=True, blank=True, on_delete=models.CASCADE)
    
    # Logo e branding
    logo_url = models.URLField(blank=True)
    logo_upload = models.ImageField(upload_to='reports/logos/', blank=True, null=True)
    
    # Dados da empresa (para header)
    nome_empresa = models.CharField(max_length=200, blank=True)
    endereco = models.TextField(blank=True)
    telefone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    cnpj = models.CharField(max_length=20, blank=True)
    
    # Configurações padrão
    formato_padrao = models.CharField(
        max_length=10,
        choices=[('pdf', 'PDF'), ('html', 'HTML'), ('xlsx', 'Excel')],
        default='pdf'
    )
    
    # Email
    email_destinatario_padrao = models.EmailField(blank=True)
    assunto_padrao = models.CharField(max_length=200, blank=True)
    
    class Meta:
        verbose_name = 'Configuração de Relatório'
        verbose_name_plural = 'Configurações de Relatórios'
        unique_together = [['tenant', 'empresa']]
```

### 3. **Sistema de Renderização**

#### 3.1. Engine de Templates

```python
# reports/engine.py

from django.template import Template, Context
from django.template.loader import get_template
from weasyprint import HTML, CSS
from io import BytesIO

class ReportEngine:
    """
    Engine para renderizar relatórios a partir de templates
    """
    
    def __init__(self, tenant=None, empresa=None):
        self.tenant = tenant
        self.empresa = empresa
        self.config = self._get_config()
    
    def _get_config(self):
        """Busca configurações do tenant/empresa"""
        # Lógica para buscar ReportConfig
        pass
    
    def render_html(self, template_code, data, custom_template=None):
        """
        Renderiza HTML do relatório
        
        Args:
            template_code: Código do template (ex: 'estoque-por-location')
            data: Dicionário com dados do relatório
            custom_template: Template customizado (opcional)
        """
        # 1. Buscar template
        template = self._get_template(template_code, custom_template)
        
        # 2. Preparar contexto
        context = self._prepare_context(data)
        
        # 3. Renderizar
        html_template = Template(template.template_html)
        html_content = html_template.render(Context(context))
        
        # 4. Aplicar template base
        base_template = get_template('reports/base.html')
        final_html = base_template.render({
            'content': html_content,
            'config': self.config,
            'template': template,
            **context
        })
        
        return final_html
    
    def render_pdf(self, template_code, data, custom_template=None):
        """
        Renderiza PDF do relatório
        """
        html_content = self.render_html(template_code, data, custom_template)
        
        # Gerar PDF com WeasyPrint
        pdf_file = BytesIO()
        HTML(string=html_content).write_pdf(
            pdf_file,
            stylesheets=[CSS(string=self._get_css())]
        )
        pdf_file.seek(0)
        
        return pdf_file
    
    def _prepare_context(self, data):
        """Prepara contexto com dados padrão + dados do relatório"""
        return {
            'empresa': self.empresa,
            'tenant': self.tenant,
            'config': self.config,
            'data_geracao': timezone.now(),
            **data  # Dados específicos do relatório
        }
```

### 4. **API Endpoints**

```python
# reports/api/viewsets.py

class ReportTemplateViewSet(viewsets.ModelViewSet):
    """
    CRUD de templates de relatórios
    """
    queryset = ReportTemplate.objects.all()
    serializer_class = ReportTemplateSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Filtrar por tenant/empresa
        pass

class ReportConfigViewSet(viewsets.ModelViewSet):
    """
    Configurações de relatórios
    """
    queryset = ReportConfig.objects.all()
    serializer_class = ReportConfigSerializer

class ReportGeneratorViewSet(viewsets.ViewSet):
    """
    Geração de relatórios
    """
    
    @action(detail=False, methods=['post'])
    def gerar(self, request):
        """
        Gera relatório em formato especificado
        
        Body:
        {
            "tipo": "estoque-por-location",
            "formato": "pdf",  # pdf, html, xlsx
            "template_id": null,  # opcional, usar template customizado
            "filtros": {...},
            "enviar_email": false,
            "email_destinatario": null
        }
        """
        pass
    
    @action(detail=False, methods=['get'])
    def preview(self, request):
        """
        Preview HTML do relatório (sem gerar PDF)
        """
        pass
```

### 5. **Template Base (Exemplo)**

```html
<!-- templates/reports/base.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{{ template.nome }} - {{ empresa.nome }}</title>
    {% include 'reports/components/styles.html' %}
    {% if template.template_css %}
    <style>
        {{ template.template_css|safe }}
    </style>
    {% endif %}
</head>
<body>
    {% include 'reports/components/header.html' %}
    
    <div class="report-content">
        {{ content|safe }}
    </div>
    
    {% include 'reports/components/footer.html' %}
</body>
</html>
```

```html
<!-- templates/reports/components/header.html -->
<header class="report-header">
    {% if config.logo_url or config.logo_upload %}
    <div class="logo">
        <img src="{{ config.logo_url|default:config.logo_upload.url }}" alt="Logo">
    </div>
    {% endif %}
    
    <div class="empresa-info">
        <h1>{{ config.nome_empresa|default:empresa.nome }}</h1>
        {% if config.endereco %}
        <p>{{ config.endereco }}</p>
        {% endif %}
        {% if config.telefone %}
        <p>Tel: {{ config.telefone }}</p>
        {% endif %}
        {% if config.email %}
        <p>Email: {{ config.email }}</p>
        {% endif %}
        {% if config.cnpj %}
        <p>CNPJ: {{ config.cnpj }}</p>
        {% endif %}
    </div>
</header>
```

### 6. **Template Específico (Exemplo)**

```html
<!-- templates/reports/modules/estoque/estoque_por_location.html -->
<div class="report-title">
    <h2>Relatório de Estoque por Location</h2>
    <p>Período: {{ data_inicio }} a {{ data_fim }}</p>
</div>

<table class="report-table">
    <thead>
        <tr>
            <th>Location</th>
            <th>Produto</th>
            <th>Quantidade</th>
            <th>Valor Unitário</th>
            <th>Valor Total</th>
        </tr>
    </thead>
    <tbody>
        {% for item in dados %}
        <tr>
            <td>{{ item.location_nome }}</td>
            <td>{{ item.produto_nome }}</td>
            <td>{{ item.quantidade }}</td>
            <td>R$ {{ item.valor_unitario }}</td>
            <td>R$ {{ item.valor_total }}</td>
        </tr>
        {% endfor %}
    </tbody>
    <tfoot>
        <tr>
            <td colspan="4"><strong>Total</strong></td>
            <td><strong>R$ {{ total_geral }}</strong></td>
        </tr>
    </tfoot>
</table>
```

## 🎨 Interface de Configuração (Frontend)

### Página: `/configuracoes/relatorios`

**Seções:**
1. **Templates Disponíveis**
   - Lista de templates por módulo
   - Visualizar/Editar template
   - Criar novo template
   - Duplicar template existente

2. **Configurações Gerais**
   - Upload de logo
   - Dados da empresa (para header)
   - Formato padrão
   - Configurações de email

3. **Preview**
   - Visualizar template com dados de exemplo
   - Testar geração de PDF

## 📦 Bibliotecas Recomendadas

### Backend (Django)
- **WeasyPrint** (recomendado): Gera PDFs de alta qualidade a partir de HTML/CSS
  - Suporte completo a CSS3
  - Renderização precisa
  - Requer dependências do sistema (libcairo, etc.)

- **xhtml2pdf** (alternativa): Mais leve, mas menos recursos CSS
  - Mais fácil de instalar
  - Menos recursos de CSS

### Frontend (React)
- **react-pdf** ou **@react-pdf/renderer**: Para preview de PDFs
- **monaco-editor** ou **CodeMirror**: Editor de código HTML/CSS

## 🔄 Fluxo de Uso

1. **Configuração Inicial** (Admin/Tenant):
   - Acessar `/configuracoes/relatorios`
   - Configurar logo e dados da empresa
   - Personalizar templates padrão (opcional)

2. **Geração de Relatório** (Usuário):
   - Acessar página de relatórios (ex: `/estoque/relatorios`)
   - Selecionar tipo de relatório
   - Aplicar filtros
   - Clicar em "Gerar Relatório"
   - Escolher formato (PDF, HTML, Excel)
   - Opcional: Enviar por email

3. **Customização** (Admin):
   - Editar template HTML/CSS
   - Preview em tempo real
   - Salvar template customizado

## 🎯 Vantagens desta Arquitetura

1. **Modular**: Templates separados por módulo/tipo
2. **Reutilizável**: Template base compartilhado
3. **Customizável**: Por tenant, empresa ou template específico
4. **Extensível**: Fácil adicionar novos tipos de relatórios
5. **Flexível**: Suporta HTML, PDF, Excel
6. **Manutenível**: Templates em banco de dados ou arquivos

## 📝 Próximos Passos

1. Criar app `reports` no Django
2. Implementar modelos `ReportTemplate` e `ReportConfig`
3. Criar engine de renderização
4. Implementar templates base e componentes
5. Criar API endpoints
6. Desenvolver interface de configuração no frontend
7. Integrar com módulos existentes (estoque, etc.)

## ❓ Decisões Pendentes

1. **Armazenamento de Templates**:
   - ✅ **Recomendado**: Banco de dados (flexível, permite customização por tenant)
   - ⚠️ Alternativa: Arquivos estáticos (mais simples, menos flexível)

2. **Biblioteca de PDF**:
   - ✅ **Recomendado**: WeasyPrint (melhor qualidade)
   - ⚠️ Alternativa: xhtml2pdf (mais fácil instalação)

3. **Editor de Templates**:
   - Opção 1: Editor de código (HTML/CSS) com preview
   - Opção 2: Editor visual (mais complexo, mais amigável)

4. **Escopo de Customização**:
   - Por tenant (todos os relatórios do tenant)
   - Por empresa (relatórios específicos da empresa)
   - Por tipo de relatório (template específico)

---

**Aguardando aprovação para implementação!** 🚀

