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
};

