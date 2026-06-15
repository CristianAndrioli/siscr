/**
 * Plano de contas padrão para Simples Nacional.
 * Baseado nas NBC TGs e adaptado para micro/pequenas empresas.
 *
 * Estrutura: código "N.N.NN.NNN"
 *   Nível 1: grupo (1 dígito)
 *   Nível 2: subgrupo (1 dígito)
 *   Nível 3: conta (2 dígitos)
 *   Nível 4: subconta analítica (3 dígitos)
 */

export type PlanoConta = {
  codigo: string
  descricao: string
  tipo: 'ativo' | 'passivo' | 'pl' | 'receita' | 'despesa' | 'custo'
  natureza: 'devedora' | 'credora'
  nivel: number
  aceitaLancamento: boolean
}

export const PLANO_PADRAO: PlanoConta[] = [
  // ─── ATIVO ────────────────────────────────────────────────────────
  { codigo: '1', descricao: 'ATIVO', tipo: 'ativo', natureza: 'devedora', nivel: 1, aceitaLancamento: false },
  { codigo: '1.1', descricao: 'ATIVO CIRCULANTE', tipo: 'ativo', natureza: 'devedora', nivel: 2, aceitaLancamento: false },
  { codigo: '1.1.01', descricao: 'Caixa e Equivalentes de Caixa', tipo: 'ativo', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '1.1.01.001', descricao: 'Caixa', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.1.01.002', descricao: 'Banco Conta Corrente', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.1.01.003', descricao: 'Aplicações Financeiras', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.1.02', descricao: 'Contas a Receber (Clientes)', tipo: 'ativo', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '1.1.02.001', descricao: 'Clientes - Vendas a Prazo', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.1.02.002', descricao: 'Clientes - Serviços a Faturar', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.1.03', descricao: 'Estoques', tipo: 'ativo', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '1.1.03.001', descricao: 'Mercadorias para Revenda', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.1.03.002', descricao: 'Matérias-Primas', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.1.04', descricao: 'Outros Créditos Circulantes', tipo: 'ativo', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '1.1.04.001', descricao: 'Adiantamentos a Fornecedores', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.1.04.002', descricao: 'Impostos a Recuperar', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.2', descricao: 'ATIVO NÃO CIRCULANTE', tipo: 'ativo', natureza: 'devedora', nivel: 2, aceitaLancamento: false },
  { codigo: '1.2.01', descricao: 'Realizável a Longo Prazo', tipo: 'ativo', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '1.2.01.001', descricao: 'Depósitos e Cauções', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.2.02', descricao: 'Imobilizado', tipo: 'ativo', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '1.2.02.001', descricao: 'Móveis e Utensílios', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.2.02.002', descricao: 'Equipamentos de Informática', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.2.02.003', descricao: 'Veículos', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.2.02.004', descricao: 'Máquinas e Equipamentos', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.2.02.099', descricao: '(-) Depreciação Acumulada', tipo: 'ativo', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '1.2.03', descricao: 'Intangível', tipo: 'ativo', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '1.2.03.001', descricao: 'Software / Licenças', tipo: 'ativo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },

  // ─── PASSIVO ──────────────────────────────────────────────────────
  { codigo: '2', descricao: 'PASSIVO', tipo: 'passivo', natureza: 'credora', nivel: 1, aceitaLancamento: false },
  { codigo: '2.1', descricao: 'PASSIVO CIRCULANTE', tipo: 'passivo', natureza: 'credora', nivel: 2, aceitaLancamento: false },
  { codigo: '2.1.01', descricao: 'Fornecedores', tipo: 'passivo', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '2.1.01.001', descricao: 'Fornecedores Nacionais', tipo: 'passivo', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '2.1.02', descricao: 'Obrigações Tributárias', tipo: 'passivo', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '2.1.02.001', descricao: 'DAS a Recolher (Simples Nacional)', tipo: 'passivo', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '2.1.02.002', descricao: 'ISSQN a Recolher', tipo: 'passivo', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '2.1.02.003', descricao: 'ICMS a Recolher', tipo: 'passivo', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '2.1.03', descricao: 'Obrigações Trabalhistas', tipo: 'passivo', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '2.1.03.001', descricao: 'Salários a Pagar', tipo: 'passivo', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '2.1.03.002', descricao: 'FGTS a Recolher', tipo: 'passivo', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '2.1.03.003', descricao: 'INSS a Recolher', tipo: 'passivo', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '2.1.04', descricao: 'Empréstimos e Financiamentos CP', tipo: 'passivo', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '2.1.04.001', descricao: 'Empréstimos Bancários', tipo: 'passivo', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '2.1.05', descricao: 'Outras Obrigações', tipo: 'passivo', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '2.1.05.001', descricao: 'Adiantamentos de Clientes', tipo: 'passivo', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '2.1.05.002', descricao: 'Contas a Pagar Diversas', tipo: 'passivo', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '2.2', descricao: 'PASSIVO NÃO CIRCULANTE', tipo: 'passivo', natureza: 'credora', nivel: 2, aceitaLancamento: false },
  { codigo: '2.2.01', descricao: 'Empréstimos e Financiamentos LP', tipo: 'passivo', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '2.2.01.001', descricao: 'Financiamentos LP', tipo: 'passivo', natureza: 'credora', nivel: 4, aceitaLancamento: true },

  // ─── PATRIMÔNIO LÍQUIDO ───────────────────────────────────────────
  { codigo: '3', descricao: 'PATRIMÔNIO LÍQUIDO', tipo: 'pl', natureza: 'credora', nivel: 1, aceitaLancamento: false },
  { codigo: '3.1', descricao: 'Capital Social', tipo: 'pl', natureza: 'credora', nivel: 2, aceitaLancamento: false },
  { codigo: '3.1.01', descricao: 'Capital Subscrito', tipo: 'pl', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '3.1.01.001', descricao: 'Capital Social Integralizado', tipo: 'pl', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '3.2', descricao: 'Reservas e Resultados', tipo: 'pl', natureza: 'credora', nivel: 2, aceitaLancamento: false },
  { codigo: '3.2.01', descricao: 'Reserva Legal', tipo: 'pl', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '3.2.01.001', descricao: 'Reserva Legal', tipo: 'pl', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '3.2.02', descricao: 'Lucros / Prejuízos Acumulados', tipo: 'pl', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '3.2.02.001', descricao: 'Lucros Acumulados', tipo: 'pl', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '3.2.02.002', descricao: 'Prejuízos Acumulados', tipo: 'pl', natureza: 'devedora', nivel: 4, aceitaLancamento: true },

  // ─── RECEITAS ─────────────────────────────────────────────────────
  { codigo: '4', descricao: 'RECEITAS', tipo: 'receita', natureza: 'credora', nivel: 1, aceitaLancamento: false },
  { codigo: '4.1', descricao: 'RECEITA BRUTA', tipo: 'receita', natureza: 'credora', nivel: 2, aceitaLancamento: false },
  { codigo: '4.1.01', descricao: 'Vendas de Mercadorias', tipo: 'receita', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '4.1.01.001', descricao: 'Receita de Vendas - Mercadorias', tipo: 'receita', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '4.1.02', descricao: 'Prestação de Serviços', tipo: 'receita', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '4.1.02.001', descricao: 'Receita de Serviços', tipo: 'receita', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '4.1.03', descricao: 'Deduções da Receita Bruta', tipo: 'receita', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '4.1.03.001', descricao: 'Devoluções de Vendas', tipo: 'receita', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '4.1.03.002', descricao: 'Descontos Concedidos', tipo: 'receita', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '4.2', descricao: 'RECEITAS FINANCEIRAS', tipo: 'receita', natureza: 'credora', nivel: 2, aceitaLancamento: false },
  { codigo: '4.2.01', descricao: 'Rendimentos Financeiros', tipo: 'receita', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '4.2.01.001', descricao: 'Juros Recebidos', tipo: 'receita', natureza: 'credora', nivel: 4, aceitaLancamento: true },
  { codigo: '4.3', descricao: 'OUTRAS RECEITAS', tipo: 'receita', natureza: 'credora', nivel: 2, aceitaLancamento: false },
  { codigo: '4.3.01', descricao: 'Outras Receitas Operacionais', tipo: 'receita', natureza: 'credora', nivel: 3, aceitaLancamento: false },
  { codigo: '4.3.01.001', descricao: 'Outras Receitas', tipo: 'receita', natureza: 'credora', nivel: 4, aceitaLancamento: true },

  // ─── CUSTOS ───────────────────────────────────────────────────────
  { codigo: '5', descricao: 'CUSTOS', tipo: 'custo', natureza: 'devedora', nivel: 1, aceitaLancamento: false },
  { codigo: '5.1', descricao: 'CUSTO DOS PRODUTOS/SERVIÇOS VENDIDOS', tipo: 'custo', natureza: 'devedora', nivel: 2, aceitaLancamento: false },
  { codigo: '5.1.01', descricao: 'CMV - Custo das Mercadorias Vendidas', tipo: 'custo', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '5.1.01.001', descricao: 'Custo das Mercadorias Vendidas', tipo: 'custo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '5.1.02', descricao: 'CSV - Custo dos Serviços Vendidos', tipo: 'custo', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '5.1.02.001', descricao: 'Custo dos Serviços Prestados', tipo: 'custo', natureza: 'devedora', nivel: 4, aceitaLancamento: true },

  // ─── DESPESAS ─────────────────────────────────────────────────────
  { codigo: '6', descricao: 'DESPESAS', tipo: 'despesa', natureza: 'devedora', nivel: 1, aceitaLancamento: false },
  { codigo: '6.1', descricao: 'DESPESAS OPERACIONAIS', tipo: 'despesa', natureza: 'devedora', nivel: 2, aceitaLancamento: false },
  { codigo: '6.1.01', descricao: 'Pessoal e Encargos', tipo: 'despesa', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '6.1.01.001', descricao: 'Salários e Ordenados', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.01.002', descricao: 'Pró-Labore', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.01.003', descricao: 'INSS - Encargos Empresa', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.01.004', descricao: 'FGTS', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.01.005', descricao: 'Férias e 13º Salário', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.02', descricao: 'Despesas Tributárias', tipo: 'despesa', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '6.1.02.001', descricao: 'DAS - Simples Nacional', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.02.002', descricao: 'Taxas e Licenças', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.03', descricao: 'Ocupação e Infraestrutura', tipo: 'despesa', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '6.1.03.001', descricao: 'Aluguel', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.03.002', descricao: 'Energia Elétrica', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.03.003', descricao: 'Água e Esgoto', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.03.004', descricao: 'Internet e Telefone', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.04', descricao: 'Serviços de Terceiros', tipo: 'despesa', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '6.1.04.001', descricao: 'Honorários Contábeis', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.04.002', descricao: 'Serviços de TI', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.04.003', descricao: 'Outros Serviços Contratados', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.05', descricao: 'Depreciação e Amortização', tipo: 'despesa', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '6.1.05.001', descricao: 'Depreciação de Imobilizado', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.06', descricao: 'Despesas Financeiras', tipo: 'despesa', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '6.1.06.001', descricao: 'Juros e Encargos Bancários', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.06.002', descricao: 'Tarifas Bancárias', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
  { codigo: '6.1.07', descricao: 'Outras Despesas', tipo: 'despesa', natureza: 'devedora', nivel: 3, aceitaLancamento: false },
  { codigo: '6.1.07.001', descricao: 'Despesas Diversas', tipo: 'despesa', natureza: 'devedora', nivel: 4, aceitaLancamento: true },
]

/** Retorna o prefixo (código pai) de um código. Ex: "1.1.01.001" → "1.1.01" */
export function codigoPai(codigo: string): string | null {
  const parts = codigo.split('.')
  if (parts.length <= 1) return null
  return parts.slice(0, -1).join('.')
}
