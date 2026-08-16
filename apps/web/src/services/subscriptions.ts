/**
 * Planos públicos e checkout Stripe alinhados à API Hono (/api/subscriptions, /api/tenant/info/subscription).
 */
import axios from 'axios';
import api from './api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export type PaidPlanId = 'basico' | 'pro' | 'enterprise';

export type PlanCaracteristica = { rotulo: string; ordem: number };

export interface PlanRow {
  id: string;
  nome: string;
  preco_mensal: number;
  preco_anual: number;
  max_empresas: number;
  max_filiais: number;
  max_usuarios: number;
  max_docs_fiscais_mes?: number;
  max_emails_mes?: number;
  features: string | null;
  caracteristicas?: PlanCaracteristica[];
  preco_fonte?: 'stripe' | 'd1';
}

export function formatPlanReais(amount: number): string {
  if (amount <= 0) return 'R$ 0';
  return `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function planFeatureLabels(p: PlanRow): string[] {
  if (p.caracteristicas?.length) {
    return [...p.caracteristicas].sort((a, b) => a.ordem - b.ordem).map((c) => c.rotulo);
  }
  const rows = [
    `${p.max_empresas} empresa(s)`,
    `${p.max_filiais} filial(is)`,
    `${p.max_usuarios} usuário(s)`,
  ];
  if (p.max_docs_fiscais_mes) {
    rows.push(`${p.max_docs_fiscais_mes} documentos fiscais/mês`);
  } else {
    rows.push('Sem emissão de NF-e / NFS-e');
  }
  return rows;
}

/** Planos ativos (sem autenticação). Preços vêm do Stripe via a API. */
export async function fetchPublicPlans(): Promise<PlanRow[]> {
  const { data } = await axios.get<{ plans: PlanRow[] }>(`${API_BASE}/api/subscriptions/plans`);
  return data.plans ?? [];
}

/** Sessão Stripe para upgrade (usuário logado + tenant ativo). */
export async function createTenantCheckout(
  plan: PaidPlanId,
): Promise<{ url?: string; updated?: boolean; via?: string }> {
  const { data } = await api.post<{ url?: string; updated?: boolean; via?: string }>(
    '/tenant/info/subscription/checkout',
    { plan },
  )
  return data
}
