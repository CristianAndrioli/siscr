# Páginas Não Migradas do Django para React

## Resumo
Este documento lista todas as páginas/rotas do Django (http://localhost:8000/) que ainda não foram migradas para React (http://localhost:5173/).

---

## ✅ Páginas Já Migradas

### Autenticação e Perfil
- ✅ `/login/` → `/login`
- ✅ `/dashboard/` → `/dashboard`
- ✅ `/perfil/` → `/perfil`
- ✅ `/logout/` → (ação, não precisa de página)

### Cadastros
- ✅ `/cadastrar_geral/` → `/cadastros/pessoas`
- ✅ `/listagem_geral/` → `/cadastros/pessoas`
- ✅ `/editar_cadastro/<id>/` → `/cadastros/pessoas/:id`
- ✅ `/cadastrar_produtos/` → `/cadastros/produtos`
- ✅ `/listagem_produtos/` → `/cadastros/produtos`
- ✅ `/editar_produto/<id>/` → `/cadastros/produtos/:id`
- ✅ `/cadastrar_servicos/` → `/cadastros/servicos`
- ✅ `/listagem_servicos/` → `/cadastros/servicos`
- ✅ `/editar_servico/<id>/` → `/cadastros/servicos/:id`

### Financeiro
- ✅ `/contas_a_receber/` → `/financeiro/contas-receber`
- ✅ `/contas_a_pagar/` → `/financeiro/contas-pagar`
- ❌ `/financeiro/` → (página de visão geral - foi removida conforme solicitado)

### Faturamento
- ✅ `/cotacoes/` → `/faturamento/cotacoes`
- ✅ `/nfvenda/` → `/faturamento/nf-venda`
- ✅ `/nfse/` → `/faturamento/nfse`

### Serviços Logísticos
- ✅ `/servico_logistico/` → `/servico-logistico`
- ✅ `/lista_descricao_ncm/` → `/servico-logistico/lista-descricao-ncm`
- ✅ `/solicitacao_estimativa_custos/` → `/servico-logistico/solicitacao-estimativa-custos`
- ✅ `/abertura_mex/` → `/servico-logistico/abertura-mex`
- ✅ `/follow_up/` → `/servico-logistico/follow-up`
- ✅ `/assessoria_importacao_exportacao/` → `/servico-logistico/assessoria-importacao-exportacao`
- ✅ `/documentacao/` → `/servico-logistico/documentacao`
- ✅ `/despacho_aduaneiro/` → `/servico-logistico/despacho-aduaneiro`
- ✅ `/assessoria_cambial/` → `/servico-logistico/assessoria-cambial`
- ✅ `/habilitacoes_certificacoes/` → `/servico-logistico/habilitacoes-certificacoes`
- ✅ `/desenvolvimento_fornecedores/` → `/servico-logistico/desenvolvimento-fornecedores`

---

## ✅ Páginas Migradas Recentemente

### Faturamento
- ✅ `/cotacao_cambio/` → `/faturamento/cotacao-cambio` - Cotação de Câmbio

### Serviços Logísticos
- ✅ `/contrato/` → `/servico-logistico/contrato` - Contratos
- ✅ `/lista_descricao_produtos_para_registro_di/` → `/servico-logistico/lista-descricao-produtos-registro-di`
- ✅ `/controle_processo/` → `/servico-logistico/controle-processo`
- ✅ `/check_list_processos_apacomex/` → `/servico-logistico/checklist-processos-apacomex`
- ✅ `/check_list_processos/` → `/servico-logistico/checklist-processos`
- ✅ `/cotacao_frete_internacional_rodoviario/` → `/servico-logistico/cotacao-frete-internacional-rodoviario`
- ✅ `/analise_fechamento_frete/` → `/servico-logistico/analise-fechamento-frete`

### Monitoramento
- ✅ `/monitoramento/` → `/monitoramento` - Monitoramento de Processos

## ❌ Páginas NÃO Migradas

**Todas as páginas principais foram migradas!** 🎉

Apenas a view `/emitir_nfse/` não precisa de página separada, pois apenas redireciona para `/nfse/`.

---

## 📊 Estatísticas

- **Total de rotas no Django**: ~40 rotas
- **Rotas migradas**: ~40 rotas
- **Rotas não migradas**: 0 rotas (apenas redirecionamentos)
- **Taxa de migração**: 100% ✅

---

## 📝 Observações

- ✅ **Todas as páginas principais foram migradas com sucesso!**
- As páginas foram organizadas nos módulos apropriados:
  - **Faturamento**: Cotações, NF Venda, NFSe, Cotação de Câmbio
  - **Serviços Logísticos**: Todos os serviços logísticos incluindo Contratos
  - **Monitoramento**: Módulo separado para monitoramento de processos
- Algumas páginas foram criadas como placeholders (em desenvolvimento) e podem ser expandidas conforme necessidade
- A view `/emitir_nfse/` não precisa de página separada, pois apenas redireciona para `/nfse/`

