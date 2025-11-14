"""
URLs do app payments (webhooks)
"""
from django.urls import path
from . import webhooks

app_name = 'payments'

urlpatterns = [
    path('', webhooks.stripe_webhook, name='stripe_webhook'),
]

