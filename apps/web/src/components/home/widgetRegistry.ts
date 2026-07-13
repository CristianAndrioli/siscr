import type { HomeVariant } from '../../hooks/useUserPreferences';

export type WidgetKey =
  | 'saldo' | 'receber' | 'pagar' | 'vendas' | 'grafico'
  | 'vencimentos' | 'atalhos' | 'estoque' | 'os' | 'recentes';

export interface WidgetMeta {
  key: WidgetKey;
  title: string;
  /** Colunas ocupadas (grid de 12) por variação da home. */
  span: Record<HomeVariant, number>;
}

export const WIDGET_REGISTRY: Record<WidgetKey, WidgetMeta> = {
  saldo:       { key: 'saldo', title: 'Saldo em caixa', span: { A: 3, B: 4, C: 3 } },
  receber:     { key: 'receber', title: 'A receber', span: { A: 3, B: 4, C: 3 } },
  pagar:       { key: 'pagar', title: 'A pagar', span: { A: 3, B: 4, C: 3 } },
  vendas:      { key: 'vendas', title: 'Faturado no mês', span: { A: 3, B: 4, C: 3 } },
  grafico:     { key: 'grafico', title: 'Faturamento', span: { A: 8, B: 12, C: 12 } },
  vencimentos: { key: 'vencimentos', title: 'Vencimentos 7 dias', span: { A: 4, B: 6, C: 6 } },
  atalhos:     { key: 'atalhos', title: 'Ações rápidas', span: { A: 4, B: 12, C: 6 } },
  estoque:     { key: 'estoque', title: 'Estoque crítico', span: { A: 4, B: 6, C: 6 } },
  os:          { key: 'os', title: 'Ordens de serviço', span: { A: 4, B: 6, C: 6 } },
  recentes:    { key: 'recentes', title: 'Itens recentes', span: { A: 12, B: 12, C: 12 } },
};

export const ALL_WIDGET_KEYS = Object.keys(WIDGET_REGISTRY) as WidgetKey[];
