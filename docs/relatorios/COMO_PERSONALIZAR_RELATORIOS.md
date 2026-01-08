# Como Personalizar Relatórios com Dados Dinâmicos

## Propósito da Página `/relatorios`

A página `/relatorios` é onde você **gera relatórios** do sistema. Ela permite:

1. **Selecionar o tipo de relatório** (ex: Estoque por Location, Estoque Consolidado)
2. **Aplicar filtros** (ex: filtrar por location específica ou produto)
3. **Escolher template customizado** (se você criou um na página de configurações)
4. **Gerar PDF ou visualizar HTML** antes de baixar

## Fluxo Completo

### 1. Configurar Templates (em `/configuracoes/relatorios`)

Aqui você **cria e edita templates** que definem como o relatório será exibido:

- **Templates Padrão**: Arquivos HTML em `reports/templates/reports/modules/`
- **Templates Customizados**: HTML/CSS armazenados no banco de dados

### 2. Gerar Relatórios (em `/relatorios`)

Aqui você **usa os templates** para gerar relatórios com dados reais:

- Seleciona o tipo de relatório
- Aplica filtros
- Gera PDF ou visualiza HTML

## Como Personalizar Templates com Dados Dinâmicos

### Estrutura de Dados Disponíveis

Quando você gera um relatório, os dados são passados para o template através do contexto Django. Por exemplo, para o relatório "Estoque por Location", os dados têm esta estrutura:

```python
{
    'dados': [
        {
            'location_id': 1,
            'location_nome': 'Armazém Principal',
            'location_codigo': 'ARM-01',
            'produto_id': 100,
            'produto_codigo': 'PROD-001',
            'produto_nome': 'Produto Exemplo',
            'produto_unidade_medida': 'UN',
            'quantidade': '150.000',
            'quantidade_atual': '150.000',
            'quantidade_reservada': '10.000',
            'quantidade_disponivel': '140.000',
            'valor_unitario': '25.50',
            'valor_custo_medio': '25.50',
            'valor_total': '3825.00',
            'localizacao_interna': 'Prateleira A-3',
            'location_total': '3825.00',
        },
        # ... mais itens
    ],
    'total_geral': '15000.00',
    'total_itens': 5,
    'empresa_nome': 'Minha Empresa',
}
```

### Exemplo de Template Personalizado

Vamos criar um template customizado que mostra mais informações:

```html
<div class="report-title">
    <h2>Relatório Detalhado de Estoque</h2>
    <p>Empresa: {{ empresa_nome }}</p>
    <p>Data de Geração: {{ data_geracao|date:"d/m/Y H:i" }}</p>
</div>

{% if dados %}
{% regroup dados by location_nome as locations_grouped %}
{% for location_group in locations_grouped %}
<div class="location-section">
    <h3>{{ location_group.grouper }}</h3>
    
    <table class="report-table">
        <thead>
            <tr>
                <th>Código</th>
                <th>Produto</th>
                <th>Unidade</th>
                <th class="text-right">Qtd. Atual</th>
                <th class="text-right">Qtd. Reservada</th>
                <th class="text-right">Qtd. Disponível</th>
                <th class="text-right">Custo Médio</th>
                <th class="text-right">Valor Total</th>
                <th>Localização Interna</th>
            </tr>
        </thead>
        <tbody>
            {% for item in location_group.list %}
            <tr>
                <td>{{ item.produto_codigo }}</td>
                <td>{{ item.produto_nome }}</td>
                <td>{{ item.produto_unidade_medida }}</td>
                <td class="text-right">{{ item.quantidade_atual }}</td>
                <td class="text-right">{{ item.quantidade_reservada }}</td>
                <td class="text-right">{{ item.quantidade_disponivel }}</td>
                <td class="text-right">R$ {{ item.valor_custo_medio }}</td>
                <td class="text-right">R$ {{ item.valor_total }}</td>
                <td>{{ item.localizacao_interna|default:"-" }}</td>
            </tr>
            {% endfor %}
        </tbody>
        <tfoot>
            <tr>
                <td colspan="7" class="text-right text-bold">Total da Location:</td>
                <td class="text-right text-bold">R$ {{ location_group.list|first.location_total }}</td>
                <td></td>
            </tr>
        </tfoot>
    </table>
</div>
{% endfor %}

<div class="report-summary">
    <table class="report-table">
        <tfoot>
            <tr>
                <td colspan="7" class="text-right text-bold">TOTAL GERAL:</td>
                <td class="text-right text-bold">R$ {{ total_geral }}</td>
                <td></td>
            </tr>
            <tr>
                <td colspan="7" class="text-right">Total de Itens:</td>
                <td class="text-right">{{ total_itens }}</td>
                <td></td>
            </tr>
        </tfoot>
    </table>
</div>
{% else %}
<p class="text-center">Nenhum dado encontrado para os filtros selecionados.</p>
{% endif %}
```

### Variáveis Disponíveis no Contexto

Além dos dados específicos do relatório, você tem acesso a:

- `empresa`: Objeto Empresa
- `tenant`: Objeto Tenant
- `usuario`: Usuário que gerou o relatório
- `config`: Configurações de relatório (logo, dados empresa)
- `template`: Objeto do template usado
- `data_geracao`: Data/hora de geração
- `nome_empresa`: Nome da empresa
- `endereco`: Endereço da empresa
- `telefone`: Telefone da empresa
- `email`: Email da empresa
- `cnpj`: CNPJ da empresa
- `logo_url`: URL do logo
- `logo_upload`: Upload do logo

### Filtros Django Úteis

Você pode usar filtros Django no template:

- `|date:"d/m/Y"`: Formatar data
- `|default:"-"`: Valor padrão se vazio
- `|safe`: Renderizar HTML sem escapar
- `|floatformat:2`: Formatar número decimal

### Como Criar um Template Customizado

1. Acesse `/configuracoes/relatorios`
2. Clique em "Novo Template"
3. Preencha:
   - Nome: "Meu Relatório Personalizado"
   - Código: "meu-relatorio-personalizado"
   - Módulo: "estoque"
   - Tipo de Relatório: "estoque-por-location"
   - Marque "Template Customizado"
4. Cole seu HTML no campo "HTML do Template"
5. (Opcional) Adicione CSS no campo "CSS Customizado"
6. Clique em "Mostrar Preview" para ver como ficará
7. Salve

### Como Usar o Template Customizado

1. Acesse `/relatorios`
2. Selecione o módulo e tipo de relatório
3. No campo "Template", selecione seu template customizado
4. Aplique filtros se necessário
5. Clique em "Gerar e Baixar" ou "Preview HTML"

## Adicionar Novos Tipos de Relatórios

Para adicionar um novo tipo de relatório:

1. **Backend**: Adicione a lógica de busca de dados em `reports/api/viewsets.py` no método `_get_relatorio_data`
2. **Template**: Crie um arquivo HTML em `reports/templates/reports/modules/{modulo}/{tipo}.html`
3. **Frontend**: Adicione o tipo na lista `tiposRelatorios` em `RelatoriosList.tsx`

## Exemplo: Adicionar Relatório de Movimentações

```python
# Em reports/api/viewsets.py
def _get_estoque_data(self, tipo, filtros, tenant, empresa):
    # ... código existente ...
    
    elif tipo == 'movimentacoes':
        from estoque.models import MovimentacaoEstoque
        
        queryset = MovimentacaoEstoque.objects.filter(
            empresa=empresa
        ).select_related('produto', 'location_origem', 'location_destino')
        
        # Aplicar filtros de data se fornecidos
        data_inicio = filtros.get('data_inicio')
        data_fim = filtros.get('data_fim')
        if data_inicio:
            queryset = queryset.filter(data_movimentacao__gte=data_inicio)
        if data_fim:
            queryset = queryset.filter(data_movimentacao__lte=data_fim)
        
        dados = []
        for mov in queryset.order_by('-data_movimentacao'):
            dados.append({
                'data': mov.data_movimentacao.strftime('%d/%m/%Y %H:%M'),
                'produto_nome': mov.produto.nome,
                'produto_codigo': mov.produto.codigo_produto,
                'origem': mov.origem,
                'tipo': mov.tipo,
                'quantidade': str(mov.quantidade),
                'location_origem': mov.location_origem.nome if mov.location_origem else '-',
                'location_destino': mov.location_destino.nome if mov.location_destino else '-',
            })
        
        return {
            'dados': dados,
            'total_movimentacoes': len(dados),
            'empresa_nome': empresa.nome if empresa else '',
        }
```

## Dicas

1. **Use Preview**: Sempre use "Preview HTML" antes de gerar PDF para ver como ficará
2. **Teste com Dados Reais**: Gere relatórios com dados reais para verificar se tudo está correto
3. **CSS para PDF**: Use CSS compatível com impressão (evite posicionamento absoluto complexo)
4. **Performance**: Para relatórios grandes, considere adicionar paginação ou limites

