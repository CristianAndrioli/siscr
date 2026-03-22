/**
 * Service para pagamentos e checkout
 */
import api from './api';

export interface CheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
}

export interface CheckoutSessionStatus {
  session_id: string;
  payment_status: string;
  subscription_id?: string;
  customer_id?: string;
}

export interface SubscriptionStatus {
  id: number;
  status: string;
  status_display: string;
  plan: {
    id: number;
    name: string;
    slug: string;
  };
  billing_cycle: string;
  current_period_start?: string;
  current_period_end?: string;
  is_active: boolean;
  requires_payment: boolean;
}

export const paymentsService = {
  /**
   * Cria uma sessão de checkout do Stripe
   */
  createCheckoutSession: async (
    planId: number,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<CheckoutSessionResponse> => {
    const response = await api.post<CheckoutSessionResponse>(
      '/payments/checkout/create/',
      {
        plan_id: planId,
        billing_cycle: billingCycle,
      }
    );
    return response.data;
  },

  /**
   * Recupera status de uma sessão de checkout
   */
  getCheckoutSession: async (sessionId: string): Promise<CheckoutSessionStatus> => {
    const response = await api.get<CheckoutSessionStatus>(
      `/payments/checkout/session/${sessionId}/`
    );
    return response.data;
  },

  /**
   * Obtém a subscription atual do tenant
   */
  getCurrentSubscription: async (): Promise<SubscriptionStatus> => {
    const response = await api.get<SubscriptionStatus>(
      '/payments/subscriptions/current/'
    );
    return response.data;
  },

  /**
   * Atualiza assinatura (upgrade/downgrade)
   */
  updateSubscription: async (
    planId: number,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<{ subscription: SubscriptionStatus }> => {
    const response = await api.post<{ subscription: SubscriptionStatus }>(
      '/payments/subscriptions/update/',
      {
        plan_id: planId,
        billing_cycle: billingCycle,
      }
    );
    return response.data;
  },

  /**
   * Cancela assinatura
   */
  cancelSubscription: async (): Promise<{ message: string; subscription: SubscriptionStatus }> => {
    const response = await api.post<{ message: string; subscription: SubscriptionStatus }>(
      '/payments/subscriptions/cancel/'
    );
    return response.data;
  },

  /**
   * Reativa assinatura cancelada
   */
  reactivateSubscription: async (): Promise<{ message: string; subscription: SubscriptionStatus }> => {
    const response = await api.post<{ message: string; subscription: SubscriptionStatus }>(
      '/payments/subscriptions/reactivate/'
    );
    return response.data;
  },
};

