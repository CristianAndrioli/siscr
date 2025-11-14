"""
Serializers para API de pagamentos
"""
from rest_framework import serializers
from ..models import PaymentMethod, Payment, Invoice
from subscriptions.models import Subscription


class PaymentMethodSerializer(serializers.ModelSerializer):
    """Serializer para método de pagamento"""
    
    class Meta:
        model = PaymentMethod
        fields = [
            'id', 'type', 'last4', 'brand', 'exp_month', 'exp_year',
            'is_default', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer para pagamento"""
    payment_method = PaymentMethodSerializer(read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id', 'subscription', 'payment_method', 'amount', 'currency',
            'status', 'paid_at', 'failed_at', 'description', 'failure_reason',
            'created_at'
        ]
        read_only_fields = ['id', 'status', 'paid_at', 'failed_at', 'created_at']


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer para fatura"""
    payment = PaymentSerializer(read_only=True)
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'subscription', 'payment', 'amount', 'currency',
            'period_start', 'period_end', 'due_date', 'is_paid', 'paid_at',
            'pdf_url', 'created_at'
        ]
        read_only_fields = ['id', 'is_paid', 'paid_at', 'created_at']


class CreatePaymentMethodSerializer(serializers.Serializer):
    """Serializer para criar método de pagamento"""
    type = serializers.ChoiceField(choices=['card', 'pix', 'boleto'])
    payment_method_data = serializers.DictField(required=False)
    
    # Dados do cartão (se type='card')
    card_number = serializers.CharField(required=False, max_length=19)
    exp_month = serializers.IntegerField(required=False, min_value=1, max_value=12)
    exp_year = serializers.IntegerField(required=False, min_value=2024)
    cvc = serializers.CharField(required=False, max_length=4)


class CreateSubscriptionSerializer(serializers.Serializer):
    """Serializer para criar assinatura com pagamento"""
    plan_id = serializers.IntegerField()
    payment_method_id = serializers.IntegerField(required=False)
    billing_cycle = serializers.ChoiceField(choices=['monthly', 'yearly'], default='monthly')

