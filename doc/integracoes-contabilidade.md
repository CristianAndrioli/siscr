# Integrações com a Contabilidade — Estratégia e Guia

**Contexto (issue):** empresas que usam ERP normalmente terceirizam a contabilidade para um
escritório contábil. O SISCR precisa entregar as informações fiscais e contábeis (NF-e de
entrada e saída, lançamentos, financeiro) para esse escritório com o mínimo de atrito.

Existem **três caminhos**, complementares entre si, do mais universal ao mais integrado:

| # | Caminho | Custo | Status no SISCR |
|---|---------|-------|-----------------|
| 1 | **Exportação para Contador** (ZIP com XMLs + SPED + CSVs) | R$ 0 | ✅ Implementado |
| 2 | **Distribuição DFe** (baixar automaticamente NF-e emitidas contra o CNPJ) | R$ 0 (webservice oficial SEFAZ) | ✅ Implementado (requer ponte mTLS — ver §2.3) |
| 3 | **API direta do sistema contábil** (Domínio/Onvio, Alterdata…) | R$ 0 (integração gratuita dos fornecedores) | 📋 Planejado — viabilizado pela infraestrutura de Conexões (§4) |

---

## 1. Exportação para Contador (ZIP)

**O caminho universal.** Todo sistema contábil brasileiro (Domínio, Alterdata, Questor,
Contmatic, Sage…) importa XML de NF-e e arquivos SPED. Não depende de parceria, homologação
ou chave de API — o contador baixa um ZIP e importa no sistema dele.

### Conteúdo do pacote

```
exportacao-contador_<periodo>.zip
├── LEIA-ME.txt                     — sumário do conteúdo e período
├── xml/
│   ├── saida/<chave>.xml           — NF-e emitidas (assinadas)
│   └── entrada/<chave>.xml         — NF-e de entrada importadas
├── contabil/
│   ├── lancamentos.csv             — partidas dobradas do período
│   └── balancete.csv               — saldos por conta
└── financeiro/
    ├── contas_receber.csv
    └── contas_pagar.csv
```

### Endpoint e UI

- **API:** `GET /api/tenant/contabilidade/exportar/contador?de=YYYY-MM-DD&ate=YYYY-MM-DD[&empresaId=…]`
- **UI:** Contabilidade → Exportações → card "Exportação para Contador (ZIP)"
- ZIP gerado em memória no Worker (método STORE, sem compressão — XMLs são pequenos e o
  formato é dependency-free; ver `apps/api/src/lib/zip.ts`).

---

## 2. Distribuição DFe (SEFAZ — Ambiente Nacional)

### 2.1 O que é

O webservice **NFeDistribuicaoDFe** do Ambiente Nacional permite que qualquer PJ (com
certificado digital) consulte e baixe os documentos fiscais **emitidos contra o seu CNPJ**:
resumos de NF-e (`resNFe`), XMLs completos (`procNFe`) e eventos. É o que alimenta o
"monitor de notas" dos ERPs comerciais.

- Modelo incremental por **NSU** (número sequencial único por CNPJ): a cada consulta
  informa-se o `ultNSU` já processado e o serviço devolve o próximo lote (até 50 docs,
  cada um em gzip+base64).
- Documentos ficam disponíveis por **90 dias** no Ambiente Nacional.
- **Gratuito** — é serviço público da SEFAZ. (Provedores como TecnoSpeed cobram apenas
  pela "casca" pronta; a chamada direta não tem custo.)

### 2.2 Implementação no SISCR

```
apps/api/src/lib/dfe/
  distribuicaoDfe.ts   — monta distDFeInt v1.01 + envelope SOAP 1.2, faz parse do
                         retDistDFeInt, descompacta docZip (DecompressionStream gzip)
apps/api/src/routes/…  — /api/tenant/entrada/dfe/*  (consultar, listar, xml)
packages/db/migrations/shared/0040_dfe_distribuicao.sql
  dfe_sync        — estado por empresa: ult_nsu, max_nsu, última consulta/status
  dfe_documentos  — nsu, chave, schema, tipo, emitente, valor, xml_path (R2), status
```

Fluxo: **Entrada → Distribuição DFe** na UI → "Consultar agora" → o Worker consulta o
Ambiente Nacional, grava resumos/XMLs em R2 + D1 → documentos `procNFe` podem ser
importados no ERP com um clique (reusa o fluxo de importação de NF-e de entrada).

### 2.3 Limitação importante: mTLS

Os webservices da SEFAZ exigem **TLS mútuo** (o certificado A1 do cliente na camada de
transporte). O `fetch` do Cloudflare Workers **não** aceita certificado de cliente
dinâmico por requisição (o binding `mtls_certificates` do Workers é estático por deploy —
inviável para A1 por tenant).

**Solução adotada:** o transporte é abstraído. Se existir uma **Conexão** (§4) com nome
`sefaz-dfe` configurada no tenant, a requisição SOAP é enviada através dela (ponte
HTTPS→mTLS em `apps/sefaz-bridge`: recebe o envelope + A1 nos headers `X-Pfx-*`, anexa o
certificado na camada TLS e repassa à SEFAZ indicada em `X-Sefaz-Url`). Sem a ponte, a
transmissão falha com mensagem clara.

> A mesma ponte serve DFe e `nfeAutorizacao`. Ver `apps/sefaz-bridge/README.md`.

---

## 3. Integração direta com sistemas contábeis (APIs dos fornecedores)

Para eliminar até o passo manual do contador. Situação por fornecedor (jul/2026):

| Sistema | Base instalada | Integração | Custo | Como iniciar |
|---|---|---|---|---|
| **Domínio** (Thomson Reuters) | Líder de mercado | API REST de importação de documentos fiscais e financeiro | **Gratuita** | E-mail para `api.dominio@tr.com` (chaves em ~1 dia útil) |
| **Onvio** (Thomson Reuters, cloud) | Crescente | Mesma família de API — [Developer Portal](https://developerportal.thomsonreuters.com/onvio-br-accounting-api) | **Gratuita** | Idem Domínio |
| **Alterdata** (eContador/ePlugin) | Grande | API com token; escritório autoriza via chave de acesso | **Gratuita** | Portal Alterdata |
| **Questor** (SYN) | Média | Focada no ecossistema Questor | Depende de licença do escritório | Contato comercial |
| **Contmatic** | Média | Importação por layouts (12 mil+); homologação de layout novo | Gratuita (processo de homologação) | Suporte Contmatic |
| **SERPRO Integra Contador** | — (é órgão público) | API para DAS/DCTFWeb/PGDAS-D direto na Receita | **Paga por consulta** (~R$ 0,96/guia) | Loja SERPRO |

**Modelo de implementação previsto:** cada tenant cadastra em **Configurações → Conexões**
a credencial que o contador dele forneceu (ex.: conexão `dominio` com token). Um job
pós-faturamento envia o XML/baixa via `getConexaoFetch(env, tenantId, 'dominio')`. O
código de integração fica genérico; a credencial é por tenant e gerenciada por tela.

Ordem sugerida: **Domínio/Onvio primeiro** (maior base + API gratuita e documentada),
depois Alterdata.

---

## 4. Conexões — "Named Credentials" do SISCR

Inspirado no modelo do Salesforce:

- **External Credential** (Salesforce) = *como autenticar* — protocolo + segredos.
- **Named Credential** (Salesforce) = *para onde chamar* — URL + referência à credencial.
  O código usa `callout:MinhaConexao/rota` e a plataforma injeta a autenticação.

No SISCR os dois conceitos são colapsados em um registro só (escala de PME não justifica
a separação), mantendo as propriedades importantes:

1. **Segredo nunca aparece** — criptografado com AES-256-GCM derivado de
   `CERT_BLOB_SECRET` + tenant + conexão (mesmo padrão do certificado A1 em
   `lib/certBlob.ts`). A API nunca devolve o segredo; a UI só permite sobrescrever.
2. **Configuração por tela, sem deploy** — Configurações → Conexões.
3. **Código genérico** — consumidores usam o helper e não conhecem o mecanismo de auth.

### Modelo de dados (`conexoes`, migration 0039)

| Campo | Descrição |
|---|---|
| `nome` | Slug único por tenant (ex.: `dominio`, `sefaz-dfe`) — é a referência usada no código |
| `tipo` | `dominio` \| `onvio` \| `alterdata` \| `sefaz_dfe` \| `http` (genérico) |
| `base_url` | Endpoint base — o "para onde chamar" |
| `auth_tipo` | `none` \| `basic` \| `bearer` \| `api_key_header` |
| `auth_config` | JSON **não-secreto** (ex.: nome do header da API key, username do basic) |
| `secret_enc` | Segredo criptografado (senha/token/key) — write-only |
| `ativo`, `ultimo_teste_em`, `ultimo_teste_status` | Operacional |

### Consumo em código

```ts
import { getConexaoFetch } from '../lib/conexoes'

const conn = await getConexaoFetch(env, tenantId, 'dominio')
if (conn) {
  // equivalente ao callout:dominio/api/v1/documentos do Salesforce
  const res = await conn.fetch('/api/v1/documentos', { method: 'POST', body })
}
```

O helper resolve a conexão, descriptografa o segredo em memória e injeta a autenticação
(`Authorization: Bearer …`, `Basic …` ou header de API key) — o chamador nunca toca no
segredo.

### Endpoints

```
GET    /api/tenant/conexoes            — listar (sem segredos)
POST   /api/tenant/conexoes            — criar
PUT    /api/tenant/conexoes/:id        — atualizar (segredo só se enviado)
DELETE /api/tenant/conexoes/:id        — remover
POST   /api/tenant/conexoes/:id/testar — GET na base_url com auth injetada; grava status
```

---

## 5. Resumo de custos

- **Caminhos 1 e 2:** custo zero de terceiros; apenas desenvolvimento interno (feito).
- **Caminho 3:** APIs Domínio/Onvio/Alterdata são gratuitas; o custo é o desenvolvimento
  de cada adaptador. Única API paga do ecossistema é o SERPRO Integra Contador
  (guias do Simples direto na Receita) — fora do escopo atual.
- **Ponte mTLS (para DFe/transmissão SEFAZ):** um serviço mínimo (VPS ~R$ 20/mês ou
  container serverless) atende todos os tenants.

## Referências

- [Webservice NFeDistribuicaoDFe — Portal NF-e](https://www.nfe.fazenda.gov.br/portal/webServices.aspx)
- [Integração ERP — Domínio/Thomson Reuters](https://www.dominiosistemas.com.br/solucoes/integracao-com-erp/)
- [Onvio BR Accounting API — Developer Portal](https://developerportal.thomsonreuters.com/onvio-br-accounting-api)
- [Alterdata ePlugin](https://www.alterdata.com.br/contabil/eplugin)
- [SERPRO Integra Contador](https://loja.serpro.gov.br/integra-contador/product/integracontador)
- [Salesforce Named Credentials (conceito)](https://help.salesforce.com/s/articleView?id=sf.named_credentials_about.htm)
