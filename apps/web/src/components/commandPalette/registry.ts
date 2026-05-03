/**
 * Itens da busca universal (issue #18).
 * `module` + `action` opcionais alinham com usePermissions / sidebar.
 */

export type ModuleCode = 'cadastros' | 'financeiro' | 'faturamento' | 'estoque' | 'configuracoes'

export type CommandPaletteItem = {
  id: string
  title: string
  path: string
  /** Termos extras para busca (sinônimos, caminhos alternativos). */
  keywords: string[]
  /** Se omitido, qualquer usuário autenticado vê o item. */
  module?: ModuleCode
  /** Se definido, exige também esta ação no módulo (ex.: importar NF entrada). */
  action?: 'view' | 'change'
}

export const COMMAND_PALETTE_ITEMS: CommandPaletteItem[] = [
  { id: 'app-home', title: 'Início', path: '/app', keywords: ['home', 'dashboard', 'principal'] },
  { id: 'perfil', title: 'Perfil', path: '/perfil', keywords: ['conta', 'usuário', 'senha'] },
  {
    id: 'cad-pessoas',
    title: 'Pessoas — clientes e fornecedores',
    path: '/cadastros/pessoas',
    keywords: ['cadastrar cliente', 'cliente', 'fornecedor', 'pessoa', 'contato'],
    module: 'cadastros',
  },
  {
    id: 'cad-produtos',
    title: 'Produtos',
    path: '/cadastros/produtos',
    keywords: ['mercadoria', 'sku', 'item'],
    module: 'cadastros',
  },
  {
    id: 'cad-servicos',
    title: 'Serviços',
    path: '/cadastros/servicos',
    keywords: ['prestação'],
    module: 'cadastros',
  },
  {
    id: 'cad-geral',
    title: 'Cadastro geral (tabelas)',
    path: '/cadastros/geral',
    keywords: ['tabelas auxiliares'],
    module: 'cadastros',
  },
  {
    id: 'fin-cr',
    title: 'Contas a receber',
    path: '/financeiro/contas-receber',
    keywords: ['receber', 'título', 'cobrança cliente'],
    module: 'financeiro',
  },
  {
    id: 'fin-cp',
    title: 'Contas a pagar',
    path: '/financeiro/contas-pagar',
    keywords: ['pagar', 'fornecedor', 'título'],
    module: 'financeiro',
  },
  {
    id: 'fin-banco',
    title: 'Contas bancárias',
    path: '/financeiro/contas-bancarias',
    keywords: ['banco', 'extrato'],
    module: 'financeiro',
  },
  {
    id: 'fin-dash',
    title: 'Financeiro — dashboard',
    path: '/financeiro/dashboard',
    keywords: ['relatório financeiro', 'resumo'],
    module: 'financeiro',
  },
  {
    id: 'fat-cotacoes',
    title: 'Cotações',
    path: '/faturamento/cotacoes',
    keywords: ['orçamento', 'proposta'],
    module: 'faturamento',
  },
  {
    id: 'fat-nf-venda',
    title: 'NF-e — vendas e notas emitidas',
    path: '/faturamento/nf-venda',
    keywords: ['nota fiscal', 'nf-e venda', 'emitir', 'danfe', 'nfe'],
    module: 'faturamento',
  },
  {
    id: 'fat-nf-nova',
    title: 'Nova NF-e de venda',
    path: '/faturamento/nf-venda/nova',
    keywords: ['emitir nf-e', 'nova nota', 'lançar venda'],
    module: 'faturamento',
    action: 'change',
  },
  {
    id: 'fat-nfse',
    title: 'NFS-e',
    path: '/faturamento/nfse',
    keywords: ['serviço', 'nota serviço', 'iss'],
    module: 'faturamento',
  },
  {
    id: 'fat-ncm',
    title: 'Tabela NCM',
    path: '/faturamento/ncm',
    keywords: ['ncm', 'classificação fiscal'],
    module: 'faturamento',
  },
  {
    id: 'ent-import',
    title: 'Importar NF-e de entrada (XML)',
    path: '/entrada/nf-e/nova',
    keywords: ['compra', 'fornecedor xml', 'importar nota', 'entrada mercadoria'],
    module: 'faturamento',
    action: 'change',
  },
  {
    id: 'ent-notas',
    title: 'Notas de entrada importadas',
    path: '/entrada/notas',
    keywords: ['nf entrada', 'xml importado', 'compra'],
    module: 'faturamento',
  },
  {
    id: 'est-posicao',
    title: 'Estoque — posição atual',
    path: '/estoque/posicao',
    keywords: ['relatório de estoque', 'saldo', 'inventário', 'quantidade'],
    module: 'estoque',
  },
  {
    id: 'est-mov',
    title: 'Movimentações de estoque',
    path: '/estoque/movimentacoes',
    keywords: ['entrada saída', 'movimento'],
    module: 'estoque',
  },
  {
    id: 'est-transf',
    title: 'Transferências entre locais',
    path: '/estoque/transferencias',
    keywords: ['transferir'],
    module: 'estoque',
  },
  {
    id: 'est-locais',
    title: 'Locais de estoque',
    path: '/estoque/locais',
    keywords: ['armazém', 'depósito'],
    module: 'estoque',
  },
  {
    id: 'est-inst',
    title: 'Instruções de estoque',
    path: '/estoque/instrucoes',
    keywords: ['ajuda estoque'],
    module: 'estoque',
  },
  {
    id: 'cfg-visao',
    title: 'Configurações — visão geral',
    path: '/configuracoes',
    keywords: ['ajustes', 'sistema'],
    module: 'configuracoes',
  },
  {
    id: 'cfg-users',
    title: 'Usuários',
    path: '/configuracoes/usuarios',
    keywords: ['acesso', 'equipe'],
    module: 'configuracoes',
  },
  {
    id: 'cfg-perm',
    title: 'Permissões e perfis',
    path: '/configuracoes/permissoes',
    keywords: ['roles', 'módulos'],
    module: 'configuracoes',
  },
  {
    id: 'cfg-filiais',
    title: 'Empresas e filiais',
    path: '/configuracoes/filiais',
    keywords: ['matriz', 'cnpj empresa'],
    module: 'configuracoes',
  },
  {
    id: 'cfg-fat',
    title: 'Configuração NF-e (certificado, série)',
    path: '/configuracoes/faturamento',
    keywords: ['certificado digital', 'sefaz'],
    module: 'configuracoes',
  },
  {
    id: 'cfg-logs',
    title: 'Log de erros',
    path: '/configuracoes/logs',
    keywords: ['debug', 'diagnóstico'],
    module: 'configuracoes',
  },
  {
    id: 'sub',
    title: 'Assinatura do tenant',
    path: '/subscription-management',
    keywords: ['plano', 'pagamento', 'mensalidade'],
  },
]
