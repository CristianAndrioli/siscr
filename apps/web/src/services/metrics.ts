/**
 * Service para métricas e quotas
 */
import api from './api';

export interface Quota {
  type: 'users' | 'empresas' | 'filiais' | 'storage';
  name: string;
  used: number;
  limit: number;
  percentage: number;
  warning: boolean;
  critical: boolean;
  unit?: string;
  used_raw?: number;
  limit_raw?: number;
}

export interface SubscriptionInfo {
  id: number;
  plan_name: string;
  plan_slug: string;
  status: string;
  is_active: boolean;
  is_trial: boolean;
  expires_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

export interface PlanInfo {
  id: number;
  name: string;
  description: string;
  price_monthly: string;
  max_users: number;
  max_empresas: number;
  max_filiais: number;
  max_storage_gb: number;
}

export interface MetricsResponse {
  subscription: SubscriptionInfo | null;
  plan: PlanInfo | null;
  quotas: Quota[];
  has_warnings: boolean;
  has_critical: boolean;
}

export const metricsService = {
  /**
   * Obtém métricas de uso e quotas do tenant atual
   */
  getMetrics: async (): Promise<MetricsResponse> => {
    const response = await api.get<MetricsResponse>('/api/metrics/');
    return response.data;
  },
};

