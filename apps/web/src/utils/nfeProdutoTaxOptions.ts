/**
 * Rótulos para cadastro de produto / NF-e (valores gravados = códigos oficiais).
 * Origem da mercadoria: tabela de origem da NF-e (0–8).
 */

export const ORIGEM_MERCADORIA: { value: number; label: string }[] = [
  { value: 0, label: '0 — Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8' },
  { value: 1, label: '1 — Estrangeira — Importação direta, exceto a indicada no código 6' },
  { value: 2, label: '2 — Estrangeira — Adquirida no mercado interno, exceto a indicada no código 7' },
  { value: 3, label: '3 — Nacional, mercadoria ou bem com conteúdo de importação superior a 40%' },
  { value: 4, label: '4 — Nacional, produção em conformidade com processos produtivos básicos' },
  { value: 5, label: '5 — Nacional, mercadoria ou bem com conteúdo de importação inferior ou igual a 40%' },
  { value: 6, label: '6 — Estrangeira — Importação direta, sem similar nacional' },
  { value: 7, label: '7 — Estrangeira — Adquirida no mercado interno, sem similar nacional' },
  { value: 8, label: '8 — Nacional, mercadoria ou bem com conteúdo de importação superior a 70%' },
];

export function labelOrigemMercadoria(origem: number | null | undefined): string {
  const o = ORIGEM_MERCADORIA.find((x) => x.value === origem);
  return o?.label ?? String(origem ?? '—');
}

/** ICMS CST (situação tributária) — lista enxuta dos mais usados; o valor salvo continua sendo o código. */
export const ICMS_CST_SUGESTOES: { value: string; label: string }[] = [
  { value: '', label: '— Não definir / informar depois —' },
  { value: '00', label: '00 — Tributada integralmente' },
  { value: '10', label: '10 — Tributada e com cobrança do ICMS por ST' },
  { value: '20', label: '20 — Com redução de base de cálculo' },
  { value: '30', label: '30 — Isenta ou não tributada com ICMS por ST' },
  { value: '40', label: '40 — Isenta' },
  { value: '41', label: '41 — Não tributada' },
  { value: '50', label: '50 — Suspensão' },
  { value: '51', label: '51 — Diferimento' },
  { value: '60', label: '60 — ICMS cobrado anteriormente por ST' },
  { value: '70', label: '70 — Com redução e cobrança do ICMS por ST' },
  { value: '90', label: '90 — Outras' },
];

/** CSOSN (Simples Nacional) — códigos frequentes. */
export const ICMS_CSOSN_SUGESTOES: { value: string; label: string }[] = [
  { value: '', label: '— Não definir / regime não-Simples —' },
  { value: '101', label: '101 — Tributada pelo Simples com permissão de crédito' },
  { value: '102', label: '102 — Tributada sem permissão de crédito' },
  { value: '103', label: '103 — Isenção do ICMS no Simples para faixa de receita' },
  { value: '201', label: '201 — Simples com crédito e cobrança de ICMS por ST' },
  { value: '202', label: '202 — Simples sem crédito e com cobrança de ICMS por ST' },
  { value: '203', label: '203 — Isenção do ICMS no Simples para faixa e ST' },
  { value: '300', label: '300 — Imune' },
  { value: '400', label: '400 — Não tributada pelo Simples' },
  { value: '500', label: '500 — ICMS cobrado anteriormente por ST ou antecipação' },
  { value: '900', label: '900 — Outros' },
];

/** PIS / COFINS CST (entrada/saída) — operações comuns em cadastro de produto. */
export const PIS_COFINS_CST_SUGESTOES: { value: string; label: string }[] = [
  { value: '01', label: '01 — Operação tributável (alíquota normal)' },
  { value: '06', label: '06 — Operação sujeita à substituição tributária' },
  { value: '07', label: '07 — Operação isenta da contribuição (muito usado no Simples)' },
  { value: '08', label: '08 — Operação sem incidência da contribuição' },
  { value: '09', label: '09 — Operação com suspensão da contribuição' },
  { value: '49', label: '49 — Outras operações de saída' },
  { value: '99', label: '99 — Outras operações' },
];
