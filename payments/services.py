"""
Serviço para integração com Stripe
Suporta modo simulado para desenvolvimento
"""
import stripe
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from .models import PaymentMethod, Payment, Invoice
from subscriptions.models import Subscription


class StripeService:
    """
    Serviço para interagir com Stripe
    Em desenvolvimento, simula respostas do Stripe
    """
    
    def __init__(self):
        self.environment = getattr(settings, 'ENVIRONMENT', 'development')
        self.stripe_mode = getattr(settings, 'STRIPE_MODE', 'simulated')
        
        # Configurar Stripe apenas se não estiver em modo simulado
        if self.stripe_mode == 'live':
            stripe.api_key = settings.STRIPE_SECRET_KEY
        elif self.stripe_mode == 'test':
            stripe.api_key = settings.STRIPE_SECRET_KEY_TEST
        # Se simulado, não configura stripe.api_key
    
    def _is_simulated(self):
        """Verifica se está em modo simulado"""
        return self.stripe_mode == 'simulated'
    
    def create_customer(self, tenant, email, name):
        """
        Cria um customer no Stripe
        """
        if self._is_simulated():
            # Simular criação de customer
            return {
                'id': f'cus_simulated_{tenant.id}',
                'email': email,
                'name': name,
                'created': int(timezone.now().timestamp()),
            }
        
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={
                    'tenant_id': str(tenant.id),
                    'tenant_name': tenant.name,
                }
            )
            return customer
        except Exception as e:
            raise Exception(f"Erro ao criar customer no Stripe: {str(e)}")
    
    def create_payment_method(self, customer_id, payment_method_data):
        """
        Cria um método de pagamento no Stripe
        """
        if self._is_simulated():
            # Simular criação de payment method
            return {
                'id': f'pm_simulated_{timezone.now().timestamp()}',
                'type': payment_method_data.get('type', 'card'),
                'card': {
                    'last4': payment_method_data.get('card', {}).get('number', '4242')[-4:],
                    'brand': 'visa',
                    'exp_month': payment_method_data.get('card', {}).get('exp_month', 12),
                    'exp_year': payment_method_data.get('card', {}).get('exp_year', 2025),
                },
            }
        
        try:
            payment_method = stripe.PaymentMethod.create(
                type=payment_method_data.get('type', 'card'),
                card=payment_method_data.get('card', {}),
            )
            
            # Anexar ao customer
            stripe.PaymentMethod.attach(
                payment_method.id,
                customer=customer_id,
            )
            
            return payment_method
        except Exception as e:
            raise Exception(f"Erro ao criar payment method no Stripe: {str(e)}")
    
    def create_subscription(self, customer_id, price_id, payment_method_id=None):
        """
        Cria uma assinatura no Stripe
        """
        if self._is_simulated():
            # Simular criação de subscription
            return {
                'id': f'sub_simulated_{timezone.now().timestamp()}',
                'status': 'active',
                'current_period_start': int(timezone.now().timestamp()),
                'current_period_end': int((timezone.now() + timedelta(days=30)).timestamp()),
                'customer': customer_id,
                'items': {
                    'data': [{
                        'price': {
                            'id': price_id,
                        }
                    }]
                },
            }
        
        try:
            subscription_data = {
                'customer': customer_id,
                'items': [{'price': price_id}],
            }
            
            if payment_method_id:
                subscription_data['default_payment_method'] = payment_method_id
            
            subscription = stripe.Subscription.create(**subscription_data)
            return subscription
        except Exception as e:
            raise Exception(f"Erro ao criar subscription no Stripe: {str(e)}")
    
    def create_payment_intent(self, amount, currency, customer_id, payment_method_id=None):
        """
        Cria um payment intent no Stripe
        """
        if self._is_simulated():
            # Simular criação de payment intent
            return {
                'id': f'pi_simulated_{timezone.now().timestamp()}',
                'status': 'succeeded',
                'amount': int(amount * 100),  # Stripe usa centavos
                'currency': currency.lower(),
                'customer': customer_id,
                'payment_method': payment_method_id,
            }
        
        try:
            payment_intent_data = {
                'amount': int(amount * 100),  # Stripe usa centavos
                'currency': currency.lower(),
                'customer': customer_id,
            }
            
            if payment_method_id:
                payment_intent_data['payment_method'] = payment_method_id
                payment_intent_data['confirmation_method'] = 'automatic'
                payment_intent_data['confirm'] = True
            
            payment_intent = stripe.PaymentIntent.create(**payment_intent_data)
            return payment_intent
        except Exception as e:
            raise Exception(f"Erro ao criar payment intent no Stripe: {str(e)}")
    
    def cancel_subscription(self, subscription_id):
        """
        Cancela uma assinatura no Stripe
        """
        if self._is_simulated():
            # Simular cancelamento
            return {
                'id': subscription_id,
                'status': 'canceled',
                'canceled_at': int(timezone.now().timestamp()),
            }
        
        try:
            subscription = stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True,
            )
            return subscription
        except Exception as e:
            raise Exception(f"Erro ao cancelar subscription no Stripe: {str(e)}")
    
    def update_subscription(self, subscription_id, price_id=None, payment_method_id=None):
        """
        Atualiza uma assinatura no Stripe
        """
        if self._is_simulated():
            # Simular atualização
            return {
                'id': subscription_id,
                'status': 'active',
            }
        
        try:
            update_data = {}
            if price_id:
                subscription = stripe.Subscription.retrieve(subscription_id)
                stripe.Subscription.modify(
                    subscription_id,
                    items=[{
                        'id': subscription['items']['data'][0].id,
                        'price': price_id,
                    }],
                    proration_behavior='always_invoice',
                )
            if payment_method_id:
                stripe.Subscription.modify(
                    subscription_id,
                    default_payment_method=payment_method_id,
                )
            
            return stripe.Subscription.retrieve(subscription_id)
        except Exception as e:
            raise Exception(f"Erro ao atualizar subscription no Stripe: {str(e)}")


# Instância global do serviço
stripe_service = StripeService()

