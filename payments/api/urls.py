"""
URLs da API de pagamentos
"""
from django.urls import path
from . import views

app_name = 'payments_api'

urlpatterns = [
    # Payment Methods
    path('payment-methods/', views.list_payment_methods, name='list_payment_methods'),
    path('payment-methods/create/', views.create_payment_method, name='create_payment_method'),
    
    # Payments
    path('payments/', views.list_payments, name='list_payments'),
    
    # Invoices
    path('invoices/', views.list_invoices, name='list_invoices'),
    
    # Subscriptions
    path('subscriptions/create/', views.create_subscription, name='create_subscription'),
    
    # Checkout
    path('checkout/create/', views.create_checkout_session, name='create_checkout_session'),
    path('checkout/session/<str:session_id>/', views.get_checkout_session, name='get_checkout_session'),
    
    # Subscription
    path('subscriptions/current/', views.get_current_subscription, name='get_current_subscription'),
]

