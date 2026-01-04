# Template de Exemplo - Estoque por Location

## HTML do Template

Cole este HTML no campo "HTML do Template" quando criar/editar um template:

```html
<div class="report-header">
    <h1 class="report-title">Relatório de Estoque por Location</h1>
    <div class="report-meta">
        <p><strong>Empresa:</strong> {{ empresa_nome|default:"N/A" }}</p>
        <p><strong>Data de Geração:</strong> {{ data_geracao|date:"d/m/Y às H:i" }}</p>
        <p><strong>Total de Itens:</strong> {{ total_itens|default:0 }}</p>
    </div>
</div>

{% if dados %}
{% regroup dados by location_nome as locations_grouped %}
{% for location_group in locations_grouped %}
<div class="location-section">
    <div class="location-header">
        <h2 class="location-title">
            <span class="location-icon">📍</span>
            {{ location_group.grouper }}
            {% with first_item=location_group.list.0 %}
            {% if first_item.location_codigo %}
            <span class="location-code">({{ first_item.location_codigo }})</span>
            {% endif %}
            {% endwith %}
        </h2>
    </div>
    
    <table class="data-table">
        <thead>
            <tr>
                <th class="col-codigo">Código</th>
                <th class="col-produto">Produto</th>
                <th class="col-unidade">Unidade</th>
                <th class="col-qtd text-right">Qtd. Atual</th>
                <th class="col-qtd text-right">Qtd. Reservada</th>
                <th class="col-qtd text-right">Qtd. Disponível</th>
                <th class="col-valor text-right">Custo Médio</th>
                <th class="col-valor text-right">Valor Total</th>
                <th class="col-localizacao">Localização Interna</th>
            </tr>
        </thead>
        <tbody>
            {% for item in location_group.list %}
            <tr class="{% cycle 'row-even' 'row-odd' %}">
                <td class="col-codigo"><strong>{{ item.produto_codigo }}</strong></td>
                <td class="col-produto">{{ item.produto_nome }}</td>
                <td class="col-unidade">{{ item.produto_unidade_medida|default:"-" }}</td>
                <td class="col-qtd text-right">{{ item.quantidade_atual }}</td>
                <td class="col-qtd text-right text-warning">{{ item.quantidade_reservada }}</td>
                <td class="col-qtd text-right text-success">{{ item.quantidade_disponivel }}</td>
                <td class="col-valor text-right">R$ {{ item.valor_custo_medio }}</td>
                <td class="col-valor text-right"><strong>R$ {{ item.valor_total }}</strong></td>
                <td class="col-localizacao">{{ item.localizacao_interna|default:"-" }}</td>
            </tr>
            {% endfor %}
        </tbody>
        <tfoot>
            <tr class="location-total">
                <td colspan="7" class="text-right"><strong>Total da Location:</strong></td>
                <td class="text-right total-value"><strong>R$ {{ location_group.list.0.location_total|default:"0.00" }}</strong></td>
                <td></td>
            </tr>
        </tfoot>
    </table>
</div>
{% endfor %}

<div class="report-summary">
    <table class="summary-table">
        <tfoot>
            <tr class="summary-total">
                <td colspan="7" class="text-right"><strong>TOTAL GERAL:</strong></td>
                <td class="text-right total-value-large"><strong>R$ {{ total_geral|default:"0.00" }}</strong></td>
                <td></td>
            </tr>
            <tr>
                <td colspan="7" class="text-right">Total de Itens:</td>
                <td class="text-right">{{ total_itens|default:0 }}</td>
                <td></td>
            </tr>
        </tfoot>
    </table>
</div>
{% else %}
<div class="no-data">
    <p class="no-data-message">⚠️ Nenhum dado encontrado para os filtros selecionados.</p>
    <p class="no-data-hint">Tente ajustar os filtros ou verifique se há estoque cadastrado.</p>
</div>
{% endif %}
```

## CSS Customizado

Cole este CSS no campo "CSS Customizado":

```css
/* ============================================
   ESTILOS PARA RELATÓRIO DE ESTOQUE
   ============================================ */

/* Header do Relatório */
.report-header {
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 3px solid #2563eb;
}

.report-title {
    color: #1e40af;
    font-size: 28px;
    font-weight: bold;
    margin: 0 0 15px 0;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.report-meta {
    display: flex;
    gap: 30px;
    flex-wrap: wrap;
    color: #4b5563;
    font-size: 12px;
}

.report-meta p {
    margin: 5px 0;
}

.report-meta strong {
    color: #1f2937;
    font-weight: 600;
}

/* Seção de Location */
.location-section {
    margin-bottom: 40px;
    page-break-inside: avoid;
}

.location-header {
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
    color: white;
    padding: 15px 20px;
    border-radius: 8px 8px 0 0;
    margin-bottom: 0;
}

.location-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
}

.location-icon {
    font-size: 24px;
}

.location-code {
    font-size: 14px;
    opacity: 0.9;
    font-weight: normal;
    margin-left: 10px;
}

/* Tabela de Dados */
.data-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.data-table thead {
    background-color: #f3f4f6;
}

.data-table thead th {
    padding: 12px 10px;
    text-align: left;
    font-weight: 600;
    color: #1f2937;
    border-bottom: 2px solid #d1d5db;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.data-table thead th.text-right {
    text-align: right;
}

.data-table tbody td {
    padding: 10px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 11px;
    color: #374151;
}

.data-table tbody td.text-right {
    text-align: right;
}

.data-table tbody tr.row-even {
    background-color: #ffffff;
}

.data-table tbody tr.row-odd {
    background-color: #f9fafb;
}

.data-table tbody tr:hover {
    background-color: #eff6ff;
}

.data-table tfoot {
    background-color: #f3f4f6;
}

.data-table tfoot td {
    padding: 12px 10px;
    font-weight: 600;
    border-top: 2px solid #d1d5db;
    border-bottom: 2px solid #d1d5db;
}

/* Colunas */
.col-codigo {
    width: 10%;
    font-family: 'Courier New', monospace;
}

.col-produto {
    width: 25%;
}

.col-unidade {
    width: 8%;
    text-align: center;
}

.col-qtd {
    width: 10%;
}

.col-valor {
    width: 12%;
}

.col-localizacao {
    width: 13%;
    font-size: 10px;
}

/* Cores de Status */
.text-success {
    color: #059669;
    font-weight: 600;
}

.text-warning {
    color: #d97706;
    font-weight: 600;
}

.text-danger {
    color: #dc2626;
    font-weight: 600;
}

/* Total da Location */
.location-total {
    background-color: #dbeafe !important;
}

.location-total td {
    color: #1e40af;
    font-size: 12px;
}

.total-value {
    color: #1e40af;
    font-size: 13px;
}

/* Resumo Final */
.report-summary {
    margin-top: 40px;
    page-break-inside: avoid;
}

.summary-table {
    width: 100%;
    border-collapse: collapse;
    background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
    color: white;
    border-radius: 8px;
    overflow: hidden;
}

.summary-table tfoot td {
    padding: 15px 20px;
    font-size: 13px;
}

.summary-total {
    background-color: rgba(255, 255, 255, 0.1);
}

.summary-total td {
    font-size: 16px;
    font-weight: bold;
    border-top: 2px solid rgba(255, 255, 255, 0.3);
}

.total-value-large {
    font-size: 18px;
    color: #fbbf24;
}

/* Sem Dados */
.no-data {
    text-align: center;
    padding: 60px 20px;
    background-color: #fef3c7;
    border: 2px dashed #f59e0b;
    border-radius: 8px;
    margin: 40px 0;
}

.no-data-message {
    font-size: 18px;
    color: #92400e;
    font-weight: 600;
    margin: 0 0 10px 0;
}

.no-data-hint {
    font-size: 14px;
    color: #78350f;
    margin: 0;
}

/* Utilitários */
.text-right {
    text-align: right;
}

.text-center {
    text-align: center;
}

.text-bold {
    font-weight: bold;
}

/* Quebras de Página */
@media print {
    .location-section {
        page-break-inside: avoid;
    }
    
    .report-summary {
        page-break-inside: avoid;
    }
    
    .data-table thead {
        display: table-header-group;
    }
    
    .data-table tfoot {
        display: table-footer-group;
    }
}
```

## Como Usar

1. Acesse `/configuracoes/relatorios`
2. Clique em "Novo Template" ou edite um existente
3. Preencha:
   - Nome: "Estoque por Location - Detalhado"
   - Código: "estoque-por-location-detalhado"
   - Módulo: "estoque"
   - Tipo de Relatório: "estoque-por-location"
   - Marque "Template Customizado"
4. Cole o HTML acima no campo "HTML do Template"
5. Cole o CSS acima no campo "CSS Customizado"
6. Clique em "Mostrar Preview" para ver como ficará
7. Salve

## O que este template faz

- Mostra todos os campos disponíveis (quantidade atual, reservada, disponível)
- Agrupa por location com cabeçalho destacado
- Usa cores para destacar valores (verde para disponível, laranja para reservada)
- Mostra localização interna quando disponível
- Calcula totais por location e geral
- Formata valores monetários
- Responsivo para impressão/PDF

Teste e me diga se precisa de ajustes!

