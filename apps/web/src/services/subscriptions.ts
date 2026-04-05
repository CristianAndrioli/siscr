/**
 * Planos públicos e checkout Stripe alinhados à API Hono (/api/subscriptions, /api/tenant/info/subscription).
 */
import axios from 'axios';
import api from './api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export type PaidPlanId = 'basico' | 'pro' | 'enterprise';

export interface PlanRow {
  id: string;
  nome: string;
  preco_mensal: number;
  preco_anual: number;
  max_empresas: number;
  max_filiais: number;
  max_usuarios: number;
  features: string | null;
}

/** Planos ativos (sem autenticação). */
export async function fetchPublicPlans(): Promise<PlanRow[]> {
  const { data } = await axios.get<{ plans: PlanRow[] }>(`${API_BASE}/api/subscriptions/plans`);
  return data.plans ?? [];
}

/** Sessão Stripe para upgrade (usuário logado + tenant ativo). */
export async function createTenantCheckout(plan: PaidPlanId): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>('/tenant/info/subscription/checkout', { plan });
  return data;
}
