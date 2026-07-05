# Plano de Preparação Fiscal-Contábil — SISCR ERP

**Data:** Junho 2026  
**Versão:** 1.0  
**Escopo:** O que o sistema precisa implementar para estar em conformidade com as obrigações fiscais e contábeis brasileiras.

---

## 1. Estado Atual (já implementado)

| Funcionalidade | Status | Localização |
|---|---|---|
| NF-e modelo 55 — emissão, transmissão, cancelamento | ✅ | `lib/nfe/`, `routes/faturamento.ts` |
| NF-e — assinatura digital A1, DANFE preview | ✅ | `lib/nfe/signNfeXml.ts`, `danfePreviewHtml.ts` |
| NF-e — importação de entrada (XML) | ✅ | `lib/fiscal-import/` |
| NFS-e básico (ISS, código serviço, alíquota) | ✅ | `routes/faturamento.ts` |
| NFC-e modelo 65 (estrutura de tipo) | ✅ parcial | `lib/fiscal-import/types.ts` |
| Certificado A1 por empresa/filial | ✅ | `lib/certBlob.ts`, `lib/pfxMetadata.ts` |
| NCM (catálogo + CFOP por item) | ✅ | `lib/ncm/`, `routes/faturamento.ts` |
| CR / CP — financeiro básico | ✅ | `routes/financeiro.ts` |
| Conciliação bancária (OFX) | ✅ | `routes/bancario.ts`, `pages/financeiro/ConciliacaoWizard` |
| Frota / Maquinário / Obras | ✅ | `routes/frota.ts` |
| Pedidos de venda, cotações | ✅ | `routes/vendas.ts` |
| Estoque com movimentações | ✅ | `routes/estoque.ts` |

---

## 2. O Que Falta — Visão Completa

### NÍVEL 1 — Documentos Fiscais (urgente / impacto imediato)

#### 2.1 ⚠️ URGENTE — NF-e com CBS e IBS (Reforma Tributária)
**Prazo legal: 3 de agosto de 2026** para empresas do Regime Normal (Lucro Presumido/Real).

A Nota Técnica 2025.002 da Receita Federal tornou obrigatórios novos campos no XML da NF-e e NFC-e:

| Campo | Descrição | Nível |
|---|---|---|
| `CST-IBS/CBS` | Código de Situação Tributária dos novos tributos | Por item |
| `cClassTrib` | Código de classificação tributária (CBS/IBS) | Por item |
| `Grupo UB` | Tributação monofásica CBS/IBS | Por item |
| `vCBS` / `vIBS` | Valores apurados CBS (0,9%) e IBS (0,1%) | Por item + totais |

**Arquivo a modificar:** `apps/api/src/lib/nfe/buildNfeXml.ts`  
**Arquivo a modificar:** `apps/api/src/lib/nfe/validateNfeBeforeXml.ts`  
**Banco:** Adicionar colunas `cst_ibs_cbs`, `c_class_trib`, `v_cbs`, `v_ibs` em `nota_fiscal_itens`

> **Atenção:** O mesmo vale para NFS-e (CBS/IBS também serão exigidos no padrão nacional).

---

#### 2.2 CC-e — Carta de Correção Eletrônica
Permite corrigir campos não essenciais de NF-e já autorizadas sem cancelá-la.

- **Endpoint necessário:** `POST /notas/:id/carta-correcao`
- **Arquivo a criar:** `apps/api/src/lib/nfe/buildCCeXml.ts`
- **Banco:** Tabela `notas_fiscais_eventos` (id, nota_fiscal_id, tipo, sequencia, xml, status, created_at)
- **Frontend:** Modal na página de detalhe da NF-e

---

#### 2.3 Inutilização de Numeração NF-e
Quando números de série forem pulados, a SEFAZ exige inutilização formal.

- **Endpoint necessário:** `POST /faturamento/inutilizacao`
- **Arquivo a criar:** `apps/api/src/lib/nfe/buildInutilizacaoXml.ts`
- **Banco:** Tabela `nfe_inutilizacoes` (ano, serie, numero_ini, numero_fim, justificativa, protocolo)

---

#### 2.4 Manifestação do Destinatário (MD-e)
A SEFAZ exige que destinatários de NF-e manifestem ciência ou desconhecimento das operações.

Tipos de manifestação:
- `210210` — Ciência da Operação
- `210240` — Confirmação da Operação
- `210220` — Desconhecimento da Operação
- `210230` — Operação não Realizada

- **Endpoint necessário:** `POST /notas/:id/manifestar`
- **Integração:** Serviço de consulta automática de NF-e de entrada (DFe)
- **Banco:** Coluna `manifestacao` em `notas_fiscais`

---

#### 2.5 NFC-e (Modo PDV completo)
O sistema possui a estrutura mas falta:

- Modo contingência offline (NFC-e em SVCan/SVCRS)
- QR Code no DACTE para leitura pelo consumidor
- Tela de PDV (front) dedicada
- Troco / forma de pagamento múltipla

---

#### 2.6 CT-e — Conhecimento de Transporte Eletrônico
O sistema já tem módulo de Frota. CT-e é o documento fiscal de transporte.

- **Modelo:** 57 (CT-e)
- **Arquivo a criar:** `apps/api/src/lib/cte/buildCTeXml.ts`
- **Banco:** Tabela `conhecimentos_transporte` (similar a `notas_fiscais`)
- **Transmissão:** SEFAZ via webservice separado (URL diferente da NF-e)

---

### NÍVEL 2 — Arquivos SPED (obrigações acessórias)

Todos os arquivos SPED são **texto plano (.txt)** com formato de registro `|BLOCO|CAMPO1|CAMPO2|...|\n`, validados e transmitidos via PVA (Programa Validador e Assinador) da Receita Federal.

#### 2.7 EFD ICMS/IPI — SPED Fiscal
**Obrigatoriedade:** Regime Normal (Lucro Presumido e Lucro Real). Mensal, até dia 20.

Cada arquivo mensal reúne todas as NF-e emitidas e recebidas, com apuração do ICMS e IPI.

| Bloco | Conteúdo |
|---|---|
| `0` | Abertura, dados da empresa, tabelas de participantes e produtos |
| `C` | Documentos fiscais de mercadorias (NF-e saídas, NF-e entradas) |
| `D` | Documentos de transporte (CT-e, conhecimentos) |
| `E` | Apuração do ICMS e IPI (cálculo por período) |
| `G` | Ativo imobilizado (CIAP) |
| `H` | Inventário físico (estoque) |
| `K` | Controle da produção |
| `1` | Outras informações (ICMS-ST devolvido, etc.) |
| `9` | Encerramento e totalizador |

**Arquivos a criar:**
```
apps/api/src/lib/sped/
  efd-icms-ipi/
    bloco0.ts    — identificação e tabelas
    blocoC.ts    — NF-e mercadorias (C100, C170, C190...)
    blocoE.ts    — apuração ICMS/IPI (E110, E111...)
    blocoH.ts    — inventário (H005, H010...)
    index.ts     — orquestrador, gera arquivo .txt completo
```
**Endpoint:** `GET /contabilidade/sped-fiscal?mes=2026-06` → retorna arquivo .txt para download

---

#### 2.8 EFD Contribuições — SPED PIS/COFINS
**Obrigatoriedade:** Regime Normal. Mensal, até dia 20 (mesmo prazo do SPED Fiscal).

Apuração do PIS e COFINS sobre faturamento (regime cumulativo ou não-cumulativo).

| Bloco | Conteúdo |
|---|---|
| `0` | Identificação e cadastros |
| `A` | Documentos de serviços (NFS-e) |
| `C` | Documentos de mercadorias (NF-e) |
| `D` | Documentos de transporte |
| `F` | Demais documentos e operações |
| `M` | **Apuração** da contribuição (créditos, débitos, saldo) |
| `P` | Apuração CPRB (contribuição previdenciária) |
| `1` | Complemento e informações de processos |
| `9` | Encerramento |

**Arquivos a criar:**
```
apps/api/src/lib/sped/
  efd-contribuicoes/
    bloco0.ts
    blocoA.ts    — NFS-e (serviços)
    blocoC.ts    — NF-e (mercadorias)
    blocoM.ts    — apuração PIS/COFINS
    index.ts
```

---

#### 2.9 EFD-Reinf — Retenções e Informações de Rendimentos
**Obrigatoriedade:** Todas as empresas que retêm IR, CSLL, PIS, COFINS de serviços tomados.

Substituiu parte da DIRF (extinta para 2026+). É uma série de **eventos XML** transmitidos mensalmente.

| Evento | Descrição |
|---|---|
| `R-1000` | Informações do contribuinte (cadastro) |
| `R-2010` | Retenções sobre serviços tomados (CSLL, PIS, COFINS) |
| `R-2020` | Retenções sobre serviços prestados |
| `R-2030` | Recursos recebidos por associação desportiva |
| `R-4010` | Pagamentos/créditos a beneficiários PF (IR retido) |
| `R-4020` | Pagamentos/créditos a beneficiários PJ (IR retido) |
| `R-9000` | Exclusão de evento |
| `R-9001` | Fechamento dos eventos periódicos |
| `R-9011` | Retorno da Receita Federal (protocolo) |

**Arquivo a criar:** `apps/api/src/lib/reinf/`  
**Endpoint:** `POST /contabilidade/reinf/transmitir?mes=2026-06`

---

#### 2.10 ECD — Escrituração Contábil Digital (SPED Contábil)
**Obrigatoriedade:** Empresas do Lucro Real/Presumido. Anual, prazo: **30 de junho** (ano seguinte).

Requer que o sistema tenha **módulo contábil completo** (ver Nível 3 abaixo). Sem plano de contas e lançamentos contábeis, é impossível gerar.

| Bloco | Conteúdo |
|---|---|
| `0` | Abertura e identificação |
| `I` | Lançamentos contábeis (razão auxiliar, diário) |
| `J` | Demonstrações (Balanço Patrimonial, DRE) |
| `K` | Contas em participações societárias |
| `9` | Encerramento |

---

#### 2.11 ECF — Escrituração Contábil Fiscal
**Obrigatoriedade:** Empresas do Lucro Real/Presumido. Anual, prazo: **31 de julho** (ano seguinte).  
**Layout 2026:** Versão 12 (leiaute 12.1.5).

Depende da ECD (usa os dados contábeis como base). Demonstra a apuração do IRPJ e CSLL.

---

#### 2.12 PGDAS-D / DASN — Simples Nacional
Para empresas do Simples:

- **PGDAS-D:** Declaração mensal de apuração do DAS (gerado via portal Gov.br)
- **DASN:** Declaração anual do Simples (simplificada)
- **Integração sugerida:** Exportar dados de faturamento mensal formatados para facilitar o preenchimento

---

### NÍVEL 3 — Módulo Contábil (foundation para ECD/ECF)

Este é o maior gap atual. Sem módulo contábil, não é possível gerar ECD ou ECF.

#### 2.13 Plano de Contas
Estrutura hierárquica de contas contábeis (4 a 6 níveis).

**Banco — tabela necessária:**
```sql
CREATE TABLE plano_contas (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  empresa_id   TEXT,
  codigo       TEXT NOT NULL,        -- ex: "1.1.01.001"
  descricao    TEXT NOT NULL,
  tipo         TEXT NOT NULL,        -- ativo | passivo | pl | receita | despesa | custo
  natureza     TEXT NOT NULL,        -- devedora | credora
  nivel        INTEGER NOT NULL,
  conta_pai_id TEXT,
  aceita_lancamento INTEGER DEFAULT 0,  -- só contas analíticas
  created_at   TEXT NOT NULL
);
```

Fornecer plano de contas padrão (NBC TG / CFC) para importação inicial.

---

#### 2.14 Lançamentos Contábeis (Journal Entries)
Cada operação do sistema gera lançamentos automaticamente.

**Banco — tabela necessária:**
```sql
CREATE TABLE lancamentos_contabeis (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  empresa_id        TEXT,
  data_lancamento   TEXT NOT NULL,
  historico         TEXT NOT NULL,
  origem_tipo       TEXT,   -- nfe | contas_receber | contas_pagar | conciliacao | manual
  origem_id         TEXT,
  created_at        TEXT NOT NULL
);

CREATE TABLE lancamentos_contabeis_itens (
  id                     TEXT PRIMARY KEY,
  lancamento_id          TEXT NOT NULL REFERENCES lancamentos_contabeis(id),
  conta_id               TEXT NOT NULL REFERENCES plano_contas(id),
  debito                 REAL DEFAULT 0,
  credito                REAL DEFAULT 0,
  centro_custo_id        TEXT,
  historico_complementar TEXT
);
```

**Integrações automáticas a implementar:**
- NF-e emitida → débito em Clientes (AR) / crédito em Receita de Vendas + ICMS a recolher
- NF-e entrada → débito em Estoque / crédito em Fornecedores (AP)
- Pagamento CR → débito em Caixa/Banco / crédito em Clientes
- Pagamento CP → débito em Fornecedores / crédito em Caixa/Banco
- Conciliação bancária → validação dos lançamentos automáticos

---

#### 2.15 Centro de Custo
```sql
CREATE TABLE centros_custo (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  empresa_id  TEXT,
  codigo      TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  ativo       INTEGER DEFAULT 1,
  created_at  TEXT NOT NULL
);
```

---

#### 2.16 Relatórios Contábeis
Gerados a partir dos lançamentos:

| Relatório | Descrição |
|---|---|
| Razão Contábil | Movimentações por conta no período |
| Balancete de Verificação | Saldos de todas as contas (débito/crédito/saldo) |
| DRE | Demonstração do Resultado do Exercício |
| Balanço Patrimonial | Ativo, Passivo e Patrimônio Líquido |
| Fluxo de Caixa (Direto) | Entradas/saídas reais de caixa |
| DLPA | Demonstração de Lucros e Prejuízos Acumulados |

---

### NÍVEL 4 — Relatórios e Exportações Auxiliares

#### 2.17 DIRF (substituída — verificar transição)
A DIRF foi extinta para fatos geradores a partir de 01/01/2025. Substituída por:
- **eSocial** (para rendimentos de PF)
- **EFD-Reinf** (para retenções sobre PJ)

Verificar se há clientes com obrigações residuais da DIRF 2025 (ano-calendário 2024).

---

#### 2.18 Exportações para Contador
Para empresas que terceirizam a contabilidade, o sistema deve exportar:

- **XML de todas as NF-e** do período (entrada + saída) em arquivo ZIP
- **CSV de CR/CP** do período com detalhamento
- **Relatório de Estoque** (posição inicial, movimentações, posição final)
- **Conciliação bancária** em PDF/Excel
- **Espelho do SPED** em TXT (mesmo que o contador valide no PVA)

---

## 3. Roadmap Priorizado

### Fase 1 — Urgente (Julho–Agosto 2026)

| # | Tarefa | Prazo | Estimativa |
|---|---|---|---|
| 1.1 | NF-e: campos CBS/IBS (NT 2025.002) em `buildNfeXml.ts` | **03/08/2026** | 3 dias |
| 1.2 | Migration: colunas `cst_ibs_cbs`, `c_class_trib`, `v_cbs`, `v_ibs` em `nota_fiscal_itens` | 03/08/2026 | 1 dia |
| 1.3 | UI: campos CBS/IBS no wizard de NF-e (exibição, não cálculo ainda) | 03/08/2026 | 2 dias |
| 1.4 | CC-e (Carta de Correção Eletrônica) | Ago 2026 | 3 dias |
| 1.5 | Inutilização de numeração | Ago 2026 | 1 dia |

### Fase 2 — SPED Mensal (Set–Out 2026)

| # | Tarefa | Estimativa |
|---|---|---|
| 2.1 | Gerador EFD ICMS/IPI (Blocos 0, C, E, H) | 10 dias |
| 2.2 | Gerador EFD Contribuições (Blocos 0, A, C, M) | 8 dias |
| 2.3 | Página "Obrigações Fiscais" na sidebar (download dos SPEDs) | 3 dias |
| 2.4 | EFD-Reinf: eventos R-1000, R-2010, R-4010, R-9001 | 7 dias |

### Fase 3 — Módulo Contábil (Nov 2026 – Fev 2027)

| # | Tarefa | Estimativa |
|---|---|---|
| 3.1 | Banco: tabelas `plano_contas`, `lancamentos_contabeis`, `lancamentos_contabeis_itens` | 2 dias |
| 3.2 | Plano de contas padrão (importação inicial NBC TG) | 2 dias |
| 3.3 | Lançamentos automáticos: NF-e emitida | 4 dias |
| 3.4 | Lançamentos automáticos: NF-e entrada | 3 dias |
| 3.5 | Lançamentos automáticos: CR/CP pagamentos | 3 dias |
| 3.6 | Centro de custos | 2 dias |
| 3.7 | Razão Contábil e Balancete | 4 dias |
| 3.8 | DRE e Balanço Patrimonial | 5 dias |
| 3.9 | Fluxo de Caixa (método direto) | 3 dias |

### Fase 4 — ECD/ECF e CT-e (Mar–Jun 2027)

| # | Tarefa | Estimativa |
|---|---|---|
| 4.1 | Gerador ECD (Blocos 0, I, J) | 10 dias |
| 4.2 | Gerador ECF (Layout 12) | 15 dias |
| 4.3 | CT-e modelo 57 | 12 dias |
| 4.4 | Manifestação do Destinatário (MD-e) | 4 dias |
| 4.5 | Exportação ZIP (XMLs + relatórios para contador) | 3 dias |

---

## 4. Arquivos e Tabelas a Criar (Resumo Técnico)

### Novas tabelas no banco

```
notas_fiscais_eventos       — CC-e, inutilização, manifestação
nfe_inutilizacoes           — controle de numeração inutilizada
plano_contas                — estrutura contábil hierárquica
lancamentos_contabeis       — cabeçalho do lançamento (partida dobrada)
lancamentos_contabeis_itens — débitos e créditos por conta
centros_custo               — rateio de despesas/receitas
conhecimentos_transporte    — CT-e emitidos
```

### Novas colunas em tabelas existentes

```
nota_fiscal_itens:
  cst_ibs_cbs      TEXT   — CST para CBS/IBS (NT 2025.002)
  c_class_trib     TEXT   — classificação tributária
  v_cbs            REAL   — valor CBS (0,9%)
  v_ibs            REAL   — valor IBS (0,1%)
  v_cbs_st         REAL   — CBS ST (tributação monofásica)
  v_ibs_st         REAL   — IBS ST

notas_fiscais:
  manifestacao     TEXT   — ciencia | confirmada | desconhecida | nao_realizada
  manifestacao_dt  TEXT   — data da manifestação
```

### Novos arquivos de código

```
apps/api/src/lib/
  nfe/
    buildCCeXml.ts
    buildInutilizacaoXml.ts
    buildManifestacaoXml.ts
  cte/
    buildCTeXml.ts
    validateCTeBeforeXml.ts
  reinf/
    eventos/R1000.ts
    eventos/R2010.ts
    eventos/R4010.ts
    eventos/R9001.ts
    index.ts
  sped/
    efd-icms-ipi/
      bloco0.ts
      blocoC.ts
      blocoE.ts
      blocoH.ts
      index.ts
    efd-contribuicoes/
      bloco0.ts
      blocoA.ts
      blocoC.ts
      blocoM.ts
      index.ts
    ecd/
      bloco0.ts
      blocoI.ts
      blocoJ.ts
      index.ts
    ecf/
      index.ts
    shared/
      registro.ts   — helper para montar linha |BL|C1|C2|...|
      hashRegistro.ts

apps/api/src/routes/
  contabilidade.ts  — endpoints para SPED, ECD, ECF, EFD-Reinf, relatórios

apps/web/src/pages/
  fiscal/
    ObrigacoesFiscaisPage.tsx   — calendário e download dos arquivos SPED
    SpedFiscalPage.tsx
    SpedContribuicoesPage.tsx
    ReinfPage.tsx
  contabilidade/
    PlanoContasPage.tsx
    LancamentosPage.tsx
    RazaoContabilPage.tsx
    BalancetePage.tsx
    DrePage.tsx
    BpPage.tsx
    FluxoCaixaPage.tsx
```

---

## 5. Dependências e Observações

**Regime tributário por empresa:** O sistema precisa saber o regime de cada empresa (Simples Nacional, Lucro Presumido, Lucro Real) para determinar quais obrigações gerar. Adicionar campo `regime_tributario` na tabela `empresas`.

**Cálculo automático de impostos:** O sistema atualmente não calcula ICMS, IPI, PIS e COFINS automaticamente nos itens da NF-e — esses valores são informados manualmente. Para os SPEDs ficarem corretos, é necessário ou calcular automaticamente ou pelo menos validar a consistência dos valores informados.

**NCM ↔ CST:** Cada NCM tem um CST de ICMS/IPI correspondente. A tabela NCM já existe, mas precisará ser enriquecida com CSTs padrão para auxiliar o usuário.

**Certificado digital:** Para CC-e, CT-e, manifestação e EFD-Reinf, o mesmo A1 já cadastrado é utilizado. Verificar se a lib de assinatura suporta os esquemas XML desses eventos (provavelmente sim, pois usam o mesmo padrão de assinatura da NF-e).

**PVA local x transmissão direta:** Os arquivos SPED (ICMS/IPI, Contribuições, ECD, ECF) não são transmitidos diretamente pela API — o usuário baixa o .txt e valida/transmite no PVA da Receita Federal. O sistema deve focar em gerar o arquivo correto. Já o EFD-Reinf e o eSocial são transmitidos via webservice com assinatura digital diretamente.

---

## 6. Referências Normativas

- Nota Técnica NF-e 2025.002 — Campos CBS/IBS: [blog.tecnospeed.com.br](https://blog.tecnospeed.com.br/nota-tecnica-reforma-tributaria-nfe-nfce/)
- EFD ICMS/IPI Guia Prático v3.1.8: [sped.rfb.gov.br](http://sped.rfb.gov.br/estatico/30/007F992E2E9F284F1DC7D9AC50A4CF3BE4513C/Guia%20Pr%C3%A1tico%20EFD%20-%20Vers%C3%A3o%203.1.8.pdf)
- ECD 2026 — Prazos e Layout 12: [judit.io](https://judit.io/blog/guias-e-materiais/ecd-e-ecf-2026-data-de-entrega-prazo-do-sped-contabil-download-e-como-evitar-multas/)
- Obrigações Acessórias 2026 — Calendário: [dattos.com.br](https://www.dattos.com.br/en/blog/obrigacoes-fiscais-2026)
- ECF 2026 — Layout 12 e prazos: [escola superioresn](https://escolasuperioresn.com.br/ecd-ecf-2026-prazos-novidades-como-preparar/)
- EFD-Reinf — Eventos: [spedbrasil.com.br](https://spedbrasil.com.br/regularizacao-obrigacoes-acessorias/)
- Reforma Tributária — IBS/CBS campos NF-e: [SEFAZ/AM](https://www.sefaz.am.gov.br/noticias/31893)
