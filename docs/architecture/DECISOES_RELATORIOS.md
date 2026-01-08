# 🎯 Decisões Arquiteturais: Sistema de Relatórios

## 📋 Análise e Recomendações

### 1. **Biblioteca de PDF** ⭐

#### ✅ **RECOMENDAÇÃO: WeasyPrint**

**Por quê?**
- ✅ **Qualidade superior**: Renderização precisa de CSS3, igual a um navegador moderno
- ✅ **Suporte completo a CSS**: Flexbox, Grid, transformações, etc.
- ✅ **Profissional**: PDFs com aparência profissional
- ✅ **Ativo**: Mantido regularmente
- ✅ **Multi-tenant friendly**: Funciona bem em ambientes isolados

**Desvantagens:**
- ⚠️ Requer dependências do sistema (libcairo, pango, etc.)
- ⚠️ Mais pesado que xhtml2pdf

**Solução para dependências:**
```dockerfile
# Dockerfile
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libgdk-pixbuf2.0-dev \
    libffi-dev \
    shared-mime-info
```

**Alternativa (se houver problemas):**
- xhtml2pdf como fallback
- Ou usar serviço externo (Puppeteer via API)

---

### 2. **Armazenamento de Templates** ⭐⭐

#### ✅ **RECOMENDAÇÃO: Híbrido (Banco de Dados + Arquivos Base)**

**Estratégia:**
1. **Templates padrão**: Arquivos estáticos (versionados no Git)
2. **Templates customizados**: Banco de dados (por tenant/empresa)

**Por quê?**
- ✅ **Flexibilidade**: Tenants podem customizar sem afetar outros
- ✅ **Versionamento**: Templates padrão no Git (controle de versão)
- ✅ **Performance**: Templates padrão carregados do cache
- ✅ **Backup**: Templates customizados incluídos no backup do tenant
- ✅ **Rollback**: Fácil reverter para template padrão

**Implementação:**
```python
class ReportTemplate(SiscrModelBase):
    # Se template_customizado = True, usa template_html do banco
    # Se False, busca arquivo em templates/reports/modules/...
    template_customizado = models.BooleanField(default=False)
    template_arquivo = models.CharField(max_length=200, blank=True)  # Caminho do arquivo padrão
    template_html = models.TextField(blank=True)  # HTML customizado
```

**Fluxo:**
1. Sistema inicia com templates padrão (arquivos)
2. Tenant customiza → salva no banco (`template_customizado=True`)
3. Engine busca: primeiro banco, depois arquivo

---

### 3. **Editor de Templates** ⭐

#### ✅ **RECOMENDAÇÃO: Editor de Código com Preview (Fase 1) → Editor Visual (Fase 2)**

**Fase 1 (MVP):**
- Editor de código HTML/CSS com syntax highlighting
- Preview em tempo real (iframe)
- Validação básica

**Por quê começar assim?**
- ✅ **Rápido de implementar**: Monaco Editor ou CodeMirror
- ✅ **Flexível**: Usuários técnicos podem customizar tudo
- ✅ **Menos bugs**: Menos complexidade inicial
- ✅ **Aprendizado**: Entender necessidades dos usuários

**Fase 2 (Futuro):**
- Editor visual drag-and-drop
- Componentes pré-construídos
- Mais amigável para usuários não-técnicos

**Bibliotecas sugeridas:**
- **Monaco Editor** (mesmo do VS Code) - melhor experiência
- **CodeMirror** - mais leve, suficiente para HTML/CSS

---

### 4. **Escopo de Customização** ⭐⭐⭐

#### ✅ **RECOMENDAÇÃO: Hierarquia de Customização**

**Hierarquia (prioridade):**
1. **Template específico** (mais específico)
2. **Por tipo de relatório** (ex: todos "estoque-por-location")
3. **Por módulo** (ex: todos relatórios de estoque)
4. **Por empresa** (ex: todos relatórios da empresa X)
5. **Por tenant** (ex: todos relatórios do tenant)
6. **Template padrão** (fallback)

**Por quê?**
- ✅ **Máxima flexibilidade**: Customização granular
- ✅ **Reutilização**: Templates compartilhados quando possível
- ✅ **Manutenção**: Fácil identificar qual template está sendo usado
- ✅ **Performance**: Cache por nível de customização

**Implementação:**
```python
def get_template(self, tipo_relatorio, tenant=None, empresa=None):
    """
    Busca template na ordem de prioridade:
    1. Template específico (tenant + empresa + tipo)
    2. Template por empresa + tipo
    3. Template por tenant + tipo
    4. Template padrão do tipo
    5. Template genérico
    """
    # Lógica de busca hierárquica
    pass
```

---

## 🎨 Decisões Adicionais Recomendadas

### 5. **Sistema de Variáveis**

#### ✅ **RECOMENDAÇÃO: Sistema de Variáveis Tipadas**

**Variáveis disponíveis:**
- `{{ empresa.nome }}` - Nome da empresa
- `{{ empresa.cnpj }}` - CNPJ
- `{{ data_geracao }}` - Data/hora de geração
- `{{ usuario.nome }}` - Usuário que gerou
- `{{ filtros }}` - Filtros aplicados
- `{{ dados }}` - Dados específicos do relatório

**Validação:**
- Validar variáveis usadas no template
- Alertar se variável não existe
- Preview com dados de exemplo

---

### 6. **Cache de Templates**

#### ✅ **RECOMENDAÇÃO: Cache em Memória (Redis)**

**Estratégia:**
- Cache de templates renderizados (com dados)
- Cache de templates HTML (sem dados)
- Invalidação quando template é atualizado

**Por quê?**
- ✅ **Performance**: Relatórios frequentes são rápidos
- ✅ **Escalabilidade**: Reduz carga no banco
- ✅ **Multi-tenant**: Cache isolado por tenant

---

### 7. **Geração Assíncrona**

#### ✅ **RECOMENDAÇÃO: Celery para Relatórios Grandes**

**Critérios:**
- Relatórios pequenos (< 100 registros): Síncrono
- Relatórios médios (100-1000): Síncrono com timeout
- Relatórios grandes (> 1000): Assíncrono via Celery

**Benefícios:**
- ✅ Não trava a requisição HTTP
- ✅ Usuário recebe notificação quando pronto
- ✅ Pode enviar por email automaticamente

---

## 📊 Resumo das Decisões

| Decisão | Recomendação | Prioridade | Complexidade |
|---------|-------------|------------|--------------|
| Biblioteca PDF | **WeasyPrint** | Alta | Média |
| Armazenamento | **Híbrido (DB + Arquivos)** | Alta | Média |
| Editor | **Código → Visual (futuro)** | Média | Baixa → Alta |
| Escopo | **Hierarquia completa** | Alta | Alta |
| Variáveis | **Sistema tipado** | Média | Média |
| Cache | **Redis** | Média | Baixa |
| Geração | **Híbrida (sync + async)** | Baixa | Média |

---

## 🚀 Plano de Implementação Sugerido

### Fase 1: MVP (2-3 semanas)
1. ✅ WeasyPrint configurado
2. ✅ Templates padrão em arquivos
3. ✅ Template base (header/footer)
4. ✅ Engine de renderização básica
5. ✅ API de geração de relatórios
6. ✅ Integração com módulo estoque

### Fase 2: Customização (2 semanas)
1. ✅ Modelo ReportTemplate no banco
2. ✅ Editor de código (Monaco)
3. ✅ Preview em tempo real
4. ✅ Sistema de variáveis
5. ✅ Customização por tenant

### Fase 3: Avançado (2-3 semanas)
1. ✅ Hierarquia completa de customização
2. ✅ Cache de templates
3. ✅ Geração assíncrona (Celery)
4. ✅ Envio por email
5. ✅ Exportação Excel

### Fase 4: UX (1-2 semanas)
1. ✅ Editor visual (opcional)
2. ✅ Templates pré-construídos
3. ✅ Biblioteca de componentes

---

## ✅ Decisão Final

**Stack Recomendado:**
- **PDF**: WeasyPrint
- **Templates**: Híbrido (arquivos padrão + DB customizados)
- **Editor**: Monaco Editor (código) → Editor visual (futuro)
- **Customização**: Hierarquia completa (específico → genérico)
- **Cache**: Redis
- **Geração**: Híbrida (sync para pequenos, async para grandes)

**Pronto para implementar?** 🚀

