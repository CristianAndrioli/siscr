import type { IconKey } from '../components/icons';

export interface HubItem {
  label: string;
  to: string;
  badge?: 'NOVO' | 'DEV';
}

export interface HubGroup {
  title: string;
  items: HubItem[];
}

export interface HubModule {
  key: string;
  label: string;
  description: string;
  icon: IconKey;
  /** Chave usada em `usePermissions().hasModuleAccess()`; omitido = sempre visível. */
  permissionKey?: string;
  groups: HubGroup[];
}

/**
 * Config declarativa dos hubs de módulo (navegação sidebar → hub → tela do
 * componente, ver handoff de redesign). Cada entrada vira uma rota
 * `/{key}` renderizada pelo componente genérico `ModuleHub`.
 */
export const HUB_MODULES: Record<string, HubModule> = {
  'vendas-crm': {
    key: 'vendas-crm',
    label: 'Vendas & CRM',
    description: 'Funil comercial, pedidos e relacionamento com clientes',
    icon: 'megaphone',
    permissionKey: 'faturamento',
    groups: [
      {
        title: 'Comercial',
        items: [
          { label: 'Funil de vendas', to: '/vendas-crm', badge: 'DEV' },
          { label: 'Pedidos de venda', to: '/vendas-crm/pedidos', badge: 'NOVO' },
          { label: 'Cotações', to: '/faturamento/cotacoes' },
          { label: 'Metas de vendas', to: '/vendas-crm', badge: 'DEV' },
        ],
      },
      {
        title: 'Relacionamento',
        items: [
          { label: 'Clientes', to: '/cadastros/clientes' },
          { label: 'Histórico de interações', to: '/vendas-crm', badge: 'DEV' },
        ],
      },
    ],
  },

  faturamento: {
    key: 'faturamento',
    label: 'Faturamento',
    description: 'Emissão de notas fiscais e cotações comerciais',
    icon: 'invoice',
    permissionKey: 'faturamento',
    groups: [
      {
        title: 'Emissão',
        items: [
          { label: 'Cotações', to: '/faturamento/cotacoes' },
          { label: 'NF-e Venda', to: '/faturamento/nf-venda' },
          { label: 'NFSe', to: '/faturamento/nfse' },
        ],
      },
      {
        title: 'Configuração',
        items: [
          { label: 'Tabela NCM', to: '/faturamento/ncm' },
          { label: 'Configuração NF-e', to: '/configuracoes/faturamento' },
        ],
      },
    ],
  },

  compras: {
    key: 'compras',
    label: 'Compras',
    description: 'Suprimentos, cotações de fornecedores e recebimento',
    icon: 'cart',
    permissionKey: 'faturamento',
    groups: [
      {
        title: 'Suprimentos',
        items: [
          { label: 'Pedidos de compra', to: '/compras', badge: 'DEV' },
          { label: 'Cotações de fornecedores', to: '/compras/cotacoes', badge: 'NOVO' },
          { label: 'Recebimento', to: '/compras', badge: 'DEV' },
        ],
      },
      {
        title: 'Base',
        items: [{ label: 'Fornecedores', to: '/cadastros/fornecedores' }],
      },
    ],
  },

  entrada: {
    key: 'entrada',
    label: 'Entrada',
    description: 'Documentos fiscais de entrada e distribuição DFe',
    icon: 'truck',
    permissionKey: 'faturamento',
    groups: [
      {
        title: 'Documentos fiscais',
        items: [
          { label: 'NF-e de entrada', to: '/entrada/nf-e/nova' },
          { label: 'Notas importadas', to: '/entrada/notas' },
          { label: 'Distribuição DFe', to: '/entrada/dfe' },
        ],
      },
    ],
  },

  estoque: {
    key: 'estoque',
    label: 'Estoque',
    description: 'Posição, movimentações e estrutura de locais',
    icon: 'box',
    permissionKey: 'estoque',
    groups: [
      {
        title: 'Movimento',
        items: [
          { label: 'Posição Atual', to: '/estoque/posicao' },
          { label: 'Movimentações', to: '/estoque/movimentacoes' },
          { label: 'Transferências', to: '/estoque/transferencias' },
        ],
      },
      {
        title: 'Estrutura',
        items: [
          { label: 'Locais de estoque', to: '/estoque/locais' },
          { label: 'Inventário', to: '/estoque', badge: 'DEV' },
        ],
      },
    ],
  },

  frota: {
    key: 'frota',
    label: 'Frota & OS',
    description: 'Ordens de serviço, máquinas e custos de operação',
    icon: 'wrench',
    permissionKey: 'frota',
    groups: [
      {
        title: 'Operação',
        items: [
          { label: 'Ordens de Serviço', to: '/frota/ordens-servico' },
          { label: 'Máquinas', to: '/frota/maquinas' },
          { label: 'Obras / Projetos', to: '/frota/obras' },
        ],
      },
      {
        title: 'Custos',
        items: [
          { label: 'Abastecimentos', to: '/frota', badge: 'DEV' },
          { label: 'Manutenções programadas', to: '/frota', badge: 'DEV' },
        ],
      },
    ],
  },

  financeiro: {
    key: 'financeiro',
    label: 'Financeiro',
    description: 'Contas a receber/pagar, bancos e estrutura financeira',
    icon: 'money',
    permissionKey: 'financeiro',
    groups: [
      {
        title: 'Movimentos',
        items: [
          { label: 'Contas a Receber', to: '/financeiro/contas-receber' },
          { label: 'Contas a Pagar', to: '/financeiro/contas-pagar' },
          { label: 'Fluxo de caixa', to: '/financeiro/fluxo-caixa', badge: 'NOVO' },
        ],
      },
      {
        title: 'Bancos',
        items: [
          { label: 'Contas Bancárias', to: '/financeiro/contas-bancarias' },
          { label: 'Conciliação bancária', to: '/financeiro/conciliacao/nova' },
          { label: 'Régua de cobrança', to: '/financeiro/regua-cobranca' },
        ],
      },
      {
        title: 'Estrutura',
        items: [
          { label: 'Categorias financeiras', to: '/cadastros/categorias-financeiras', badge: 'NOVO' },
          { label: 'Centros de custo', to: '/cadastros/centros-custo', badge: 'NOVO' },
        ],
      },
    ],
  },

  contabilidade: {
    key: 'contabilidade',
    label: 'Contabilidade',
    description: 'Escrituração, demonstrativos e integração com o contador',
    icon: 'book',
    permissionKey: 'financeiro',
    groups: [
      {
        title: 'Escrituração',
        items: [
          { label: 'Plano de Contas', to: '/contabilidade/plano-contas' },
          { label: 'Lançamentos', to: '/contabilidade/lancamentos' },
        ],
      },
      {
        title: 'Demonstrativos',
        items: [
          { label: 'Balancete', to: '/contabilidade/balancete' },
          { label: 'DRE', to: '/contabilidade/dre' },
        ],
      },
      {
        title: 'Integração',
        items: [{ label: 'Exportações', to: '/contabilidade/exportacoes' }],
      },
    ],
  },

  cadastros: {
    key: 'cadastros',
    label: 'Cadastros',
    description: 'Base comercial, produtos, financeiro e operação',
    icon: 'users',
    permissionKey: 'cadastros',
    groups: [
      {
        title: 'Comercial',
        items: [
          { label: 'Clientes', to: '/cadastros/clientes' },
          { label: 'Fornecedores', to: '/cadastros/fornecedores' },
          { label: 'Vendedores', to: '/cadastros/vendedores', badge: 'NOVO' },
          { label: 'Transportadoras', to: '/cadastros/transportadoras', badge: 'NOVO' },
        ],
      },
      {
        title: 'Produtos & serviços',
        items: [
          { label: 'Produtos', to: '/cadastros/produtos' },
          { label: 'Serviços', to: '/cadastros/servicos' },
          { label: 'Grupos de produtos', to: '/cadastros/grupos-produtos', badge: 'NOVO' },
          { label: 'Unidades de medida', to: '/cadastros/unidades-medida', badge: 'NOVO' },
          { label: 'Tabelas de preço', to: '/cadastros/tabelas-preco', badge: 'NOVO' },
        ],
      },
      {
        title: 'Financeiro',
        items: [
          { label: 'Categorias financeiras', to: '/cadastros/categorias-financeiras', badge: 'NOVO' },
          { label: 'Centros de custo', to: '/cadastros/centros-custo', badge: 'NOVO' },
          { label: 'Condições de pagamento', to: '/cadastros/condicoes-pagamento', badge: 'NOVO' },
        ],
      },
      {
        title: 'Operação',
        items: [
          { label: 'Máquinas', to: '/frota/maquinas' },
          { label: 'Obras / Projetos', to: '/frota/obras' },
          { label: 'Locais de estoque', to: '/estoque/locais' },
          { label: 'Funcionários / Operadores', to: '/cadastros/funcionarios', badge: 'NOVO' },
        ],
      },
    ],
  },

  configuracoes: {
    key: 'configuracoes',
    label: 'Configurações',
    description: 'Conta, empresa e ajustes do sistema',
    icon: 'gear',
    permissionKey: 'configuracoes',
    groups: [
      {
        title: 'Conta',
        items: [
          { label: 'Usuários', to: '/configuracoes/usuarios' },
          { label: 'Permissões', to: '/configuracoes/permissoes' },
          { label: 'Assinatura', to: '/subscription-management' },
        ],
      },
      {
        title: 'Empresa',
        items: [
          { label: 'Empresas e Filiais', to: '/configuracoes/filiais' },
          { label: 'Faturamento (NF-e)', to: '/configuracoes/faturamento' },
          { label: 'Personalização', to: '/configuracoes/personalizacao' },
        ],
      },
      {
        title: 'Sistema',
        items: [
          { label: 'Conexões', to: '/configuracoes/conexoes' },
          { label: 'Log de erros', to: '/configuracoes/logs' },
        ],
      },
    ],
  },
};

export interface SidebarNavItem {
  key: string;
  label: string;
  to: string;
  icon: IconKey;
  badge?: 'NOVO' | 'DEV';
  permissionKey?: string;
}

export interface SidebarSection {
  title: string;
  items: SidebarNavItem[];
}

/** Estrutura fixa da sidebar por seções (substitui os submenus expansíveis). */
export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: 'Principal',
    items: [
      { key: 'app', label: 'Início', to: '/app', icon: 'home' },
      { key: 'relatorios', label: 'Relatórios', to: '/relatorios', icon: 'chart', badge: 'NOVO' },
    ],
  },
  {
    title: 'Operação',
    items: [
      { key: 'vendas-crm', label: 'Vendas & CRM', to: '/vendas-crm', icon: 'megaphone', badge: 'DEV', permissionKey: 'faturamento' },
      { key: 'faturamento', label: 'Faturamento', to: '/faturamento', icon: 'invoice', permissionKey: 'faturamento' },
      { key: 'compras', label: 'Compras', to: '/compras', icon: 'cart', badge: 'DEV', permissionKey: 'faturamento' },
      { key: 'entrada', label: 'Entrada', to: '/entrada', icon: 'truck', permissionKey: 'faturamento' },
      { key: 'estoque', label: 'Estoque', to: '/estoque', icon: 'box', permissionKey: 'estoque' },
      { key: 'frota', label: 'Frota & OS', to: '/frota', icon: 'wrench', permissionKey: 'frota' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { key: 'financeiro', label: 'Financeiro', to: '/financeiro', icon: 'money', permissionKey: 'financeiro' },
      { key: 'contabilidade', label: 'Contabilidade', to: '/contabilidade', icon: 'book', permissionKey: 'financeiro' },
      { key: 'cadastros', label: 'Cadastros', to: '/cadastros', icon: 'users', permissionKey: 'cadastros' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { key: 'configuracoes', label: 'Configurações', to: '/configuracoes', icon: 'gear', permissionKey: 'configuracoes' },
    ],
  },
];
