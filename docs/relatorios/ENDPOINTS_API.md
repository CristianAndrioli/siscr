# Endpoints da API de Relatórios

## Base URL
Todos os endpoints estão disponíveis em: `/api/reports/`

## 1. Templates de Relatórios

### Listar Templates
```
GET /api/reports/templates/
```

**Query Parameters:**
- `modulo` (opcional): Filtrar por módulo (ex: `estoque`)
- `tipo` (opcional): Filtrar por tipo de relatório (ex: `estoque-por-location`)

**Resposta:**
```json
[
  {
    "id": 1,
    "nome": "Estoque por Location",
    "codigo": "estoque-por-location",
    "descricao": "Relatório detalhado de estoque",
    "modulo": "estoque",
    "tipo_relatorio": "estoque-por-location",
    "template_customizado": false,
    "template_arquivo": "reports/modules/estoque/estoque_por_location.html",
    "template_html": "",
    "template_css": "",
    "incluir_logo": true,
    "incluir_dados_empresa": true,
    "orientacao": "portrait",
    "is_active": true,
    "is_default": true
  }
]
```

### Obter Template por ID
```
GET /api/reports/templates/{id}/
```

### Criar Template
```
POST /api/reports/templates/
```

**Body:**
```json
{
  "nome": "Meu Template",
  "codigo": "meu-template",
  "modulo": "estoque",
  "tipo_relatorio": "estoque-por-location",
  "descricao": "Descrição do template",
  "template_customizado": true,
  "template_html": "<div>...</div>",
  "template_css": "body { ... }",
  "orientacao": "portrait",
  "incluir_logo": true,
  "incluir_dados_empresa": true
}
```

### Atualizar Template
```
PUT /api/reports/templates/{id}/
PATCH /api/reports/templates/{id}/
```

### Deletar Template
```
DELETE /api/reports/templates/{id}/
```

---

## 2. Configurações de Relatórios

### Listar Configurações
```
GET /api/reports/config/
```

**Resposta:**
```json
[
  {
    "id": 1,
    "tenant": 1,
    "empresa": 1,
    "logo_url": "https://example.com/logo.png",
    "logo_upload": null,
    "nome_empresa": "Minha Empresa",
    "endereco": "Rua Exemplo, 123",
    "telefone": "(11) 99999-9999",
    "email": "contato@empresa.com",
    "cnpj": "12.345.678/0001-90",
    "formato_padrao": "pdf",
    "email_destinatario_padrao": "relatorios@empresa.com",
    "assunto_padrao": "Relatório Gerado"
  }
]
```

### Obter Configuração por ID
```
GET /api/reports/config/{id}/
```

### Criar Configuração
```
POST /api/reports/config/
```

**Body:**
```json
{
  "logo_url": "https://example.com/logo.png",
  "nome_empresa": "Minha Empresa",
  "endereco": "Rua Exemplo, 123",
  "telefone": "(11) 99999-9999",
  "email": "contato@empresa.com",
  "cnpj": "12.345.678/0001-90",
  "formato_padrao": "pdf"
}
```

### Atualizar Configuração
```
PUT /api/reports/config/{id}/
PATCH /api/reports/config/{id}/
```

### Deletar Configuração
```
DELETE /api/reports/config/{id}/
```

---

## 3. Geração de Relatórios

### Gerar Relatório (PDF/HTML)
```
POST /api/reports/gerar/gerar/
```

**Body:**
```json
{
  "tipo": "estoque-por-location",
  "modulo": "estoque",
  "formato": "pdf",
  "template_id": null,
  "filtros": {
    "location_id": 1,
    "produto_id": "PROD001"
  },
  "enviar_email": false,
  "email_destinatario": null
}
```

**Resposta (PDF):**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="relatorio_estoque-por-location.pdf"`
- Body: Arquivo PDF binário

**Resposta (HTML):**
```json
{
  "html": "<!DOCTYPE html>..."
}
```

### Preview do Relatório (HTML)
```
GET /api/reports/gerar/preview/
```

**Query Parameters:**
- `tipo` (obrigatório): Tipo do relatório (ex: `estoque-por-location`)
- `modulo` (opcional): Módulo do sistema (ex: `estoque`)
- `template_id` (opcional): ID do template customizado

**Resposta:**
```json
{
  "html": "<!DOCTYPE html>..."
}
```

---

## Autenticação

Todos os endpoints requerem autenticação JWT:
```
Authorization: Bearer {token}
```

## Headers Especiais

Para multi-tenancy, inclua o header:
```
X-Tenant-Domain: {schema_name}.localhost
```

---

## Tipos de Relatórios Disponíveis

### Módulo: Estoque

1. **estoque-por-location**
   - Descrição: Relatório detalhado de estoque agrupado por location
   - Filtros disponíveis:
     - `location_id` (opcional): ID da location
     - `produto_id` (opcional): Código do produto

2. **estoque-consolidado**
   - Descrição: Relatório consolidado de estoque por produto
   - Filtros disponíveis:
     - `produto_id` (opcional): Código do produto

---

## Exemplos de Uso

### Exemplo 1: Listar templates de estoque
```bash
curl -X GET "http://localhost:8000/api/reports/templates/?modulo=estoque" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Domain: meu_tenant.localhost"
```

### Exemplo 2: Gerar PDF de estoque por location
```bash
curl -X POST "http://localhost:8000/api/reports/gerar/gerar/" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Domain: meu_tenant.localhost" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "estoque-por-location",
    "modulo": "estoque",
    "formato": "pdf",
    "filtros": {
      "location_id": 1
    }
  }' \
  --output relatorio.pdf
```

### Exemplo 3: Preview HTML
```bash
curl -X GET "http://localhost:8000/api/reports/gerar/preview/?tipo=estoque-por-location&modulo=estoque" \
  -H "Authorization: Bearer {token}" \
  -H "X-Tenant-Domain: meu_tenant.localhost"
```

---

## Notas Importantes

1. **Escopo de Dados**: Todos os relatórios respeitam o escopo do tenant e empresa do usuário autenticado
2. **Templates**: Templates podem ser específicos por tenant/empresa ou globais
3. **Formato PDF**: Requer WeasyPrint instalado com dependências do sistema
4. **Filtros**: Cada tipo de relatório pode ter filtros específicos

