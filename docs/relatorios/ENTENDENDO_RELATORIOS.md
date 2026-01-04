# Entendendo o Sistema de Relatórios

## 🎯 Propósito das Páginas

### `/configuracoes/relatorios` - **CRIAR/EDITAR Templates**
Aqui você **desenha** como o relatório vai aparecer:
- Cria templates HTML/CSS
- Define estrutura visual
- Configura logo e dados da empresa
- **É como criar um "molde" de relatório**

### `/relatorios` - **GERAR Relatórios**
Aqui você **usa** os templates para gerar relatórios com dados reais:
- Seleciona qual template usar
- Aplica filtros (ex: só estoque de uma location)
- Gera PDF ou visualiza HTML
- **É como "preencher o molde" com dados**

## 🔄 Fluxo Completo

```
1. Criar Template (em /configuracoes/relatorios)
   ↓
2. Template define ESTRUTURA (tabelas, campos, layout)
   ↓
3. Gerar Relatório (em /relatorios)
   ↓
4. Sistema busca DADOS REAIS do banco
   ↓
5. Dados são INJETADOS no template
   ↓
6. PDF/HTML é gerado com dados + estrutura
```

## 📊 Como os Dados Chegam ao Template

### Exemplo Prático

**1. Você gera um relatório de "Estoque por Location"**

**2. O backend busca dados reais:**
```python
# Em reports/api/viewsets.py
dados = [
    {
        'produto_nome': 'Produto A',
        'quantidade': '100.000',
        'valor_total': '1500.00',
        # ... mais campos
    },
    # ... mais produtos
]
```

**3. Os dados são passados para o template:**
```html
<!-- No template HTML -->
{% for item in dados %}
    <tr>
        <td>{{ item.produto_nome }}</td>  <!-- Mostra: "Produto A" -->
        <td>{{ item.quantidade }}</td>     <!-- Mostra: "100.000" -->
        <td>R$ {{ item.valor_total }}</td> <!-- Mostra: "R$ 1500.00" -->
    </tr>
{% endfor %}
```

**4. O template renderiza com os dados reais:**
```
| Produto A | 100.000 | R$ 1500.00 |
| Produto B | 50.000  | R$ 750.00  |
```

## 🎨 Personalizando Templates

### Exemplo 1: Adicionar Campo de Status

**No template HTML:**
```html
{% for item in dados %}
<tr>
    <td>{{ item.produto_nome }}</td>
    <td>{{ item.quantidade }}</td>
    <!-- Adicionar status baseado na quantidade -->
    {% if item.quantidade|add:"0" > 100 %}
        <td class="status-ok">Estoque OK</td>
    {% elif item.quantidade|add:"0" > 50 %}
        <td class="status-alerta">Atenção</td>
    {% else %}
        <td class="status-critico">Crítico</td>
    {% endif %}
</tr>
{% endfor %}
```

### Exemplo 2: Agrupar por Categoria

**No backend (reports/api/viewsets.py):**
```python
# Adicionar categoria ao item
dados.append({
    'produto_nome': estoque.produto.nome,
    'categoria': estoque.produto.categoria.nome,  # Novo campo
    'quantidade': str(estoque.quantidade_atual),
    # ...
})
```

**No template:**
```html
{% regroup dados by categoria as categorias %}
{% for categoria in categorias %}
    <h3>{{ categoria.grouper }}</h3>
    {% for item in categoria.list %}
        <!-- produtos desta categoria -->
    {% endfor %}
{% endfor %}
```

## 🔧 Por que o PDF Só Mostrou o Footer?

O problema era que o conteúdo renderizado não estava sendo passado para a variável `content` do template base. **Já foi corrigido!**

Agora o fluxo está assim:
1. Template específico renderiza com dados → `rendered_content`
2. `rendered_content` é adicionado ao contexto como `content`
3. Template base usa `{{ content|safe }}` para exibir o conteúdo
4. Footer é adicionado no final

## 📝 Próximos Passos

1. **Teste novamente**: Gere um relatório e veja se os dados aparecem
2. **Personalize**: Crie um template customizado com os campos que você precisa
3. **Adicione novos tipos**: Crie novos tipos de relatórios conforme necessário

Veja `COMO_PERSONALIZAR_RELATORIOS.md` para exemplos detalhados!

