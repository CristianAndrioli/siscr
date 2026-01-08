"""
Tarefas periódicas do Celery para gerenciamento de assinaturas
"""
import logging
from celery import shared_task
from django.utils import timezone
from django.db import transaction
from django.db import connection
from django_tenants.utils import schema_context
from datetime import timedelta
import stripe
from django.conf import settings

from .models import Subscription
from .notifications import SubscriptionNotificationService
from tenants.models import Tenant

logger = logging.getLogger(__name__)


@shared_task
def sync_subscriptions_with_stripe():
    """
    Sincroniza assinaturas locais com o Stripe.
    Executa a cada 1 hora como backup caso webhooks falhem.
    """
    logger.info("[CELERY] Iniciando sincronização de assinaturas com Stripe...")
    
    if settings.STRIPE_MODE == 'simulated':
        logger.info("[CELERY] Modo simulado - pulando sincronização")
        return
    
    try:
        stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY_TEST', '') or getattr(settings, 'STRIPE_SECRET_KEY', '')
        stripe.api_version = getattr(settings, 'STRIPE_API_VERSION', '2024-11-20.acacia')
    except Exception as e:
        logger.error(f"[CELERY] Erro ao configurar Stripe: {str(e)}")
        return
    
    synced_count = 0
    error_count = 0
    
    # Buscar todas as assinaturas ativas ou pending que têm payment_gateway_id
    with schema_context('public'):
        subscriptions = Subscription.objects.filter(
            payment_gateway_id__isnull=False
        ).exclude(payment_gateway_id='').select_related('tenant', 'plan')
        
        for subscription in subscriptions:
            try:
                # Buscar subscription no Stripe
                stripe_sub = stripe.Subscription.retrieve(subscription.payment_gateway_id)
                
                # Atualizar status e períodos
                old_status = subscription.status
                subscription.status = stripe_sub['status']
                from datetime import datetime
                subscription.current_period_start = datetime.fromtimestamp(
                    stripe_sub['current_period_start'], tz=timezone.utc
                )
                subscription.current_period_end = datetime.fromtimestamp(
                    stripe_sub['current_period_end'], tz=timezone.utc
                )
                subscription.cancel_at_period_end = stripe_sub.get('cancel_at_period_end', False)
                
                subscription.save()
                
                if old_status != subscription.status:
                    logger.info(
                        f"[CELERY] Subscription {subscription.id} (tenant: {subscription.tenant.name}) "
                        f"status atualizado: {old_status} -> {subscription.status}"
                    )
                
                synced_count += 1
                
            except stripe.error.StripeError as e:
                logger.error(
                    f"[CELERY] Erro ao sincronizar subscription {subscription.id} "
                    f"(tenant: {subscription.tenant.name}): {str(e)}"
                )
                error_count += 1
            except Exception as e:
                logger.error(
                    f"[CELERY] Erro inesperado ao sincronizar subscription {subscription.id}: {str(e)}",
                    exc_info=True
                )
                error_count += 1
    
    logger.info(
        f"[CELERY] Sincronização concluída: {synced_count} assinaturas sincronizadas, "
        f"{error_count} erros"
    )


@shared_task
def check_expiring_subscriptions():
    """
    Verifica assinaturas que estão expirando em breve e envia notificações.
    Executa uma vez por dia.
    """
    logger.info("[CELERY] Verificando assinaturas expirando...")
    
    notification_service = SubscriptionNotificationService()
    
    # Verificar assinaturas que expiram em 7 dias
    seven_days_from_now = timezone.now() + timedelta(days=7)
    three_days_from_now = timezone.now() + timedelta(days=3)
    one_day_from_now = timezone.now() + timedelta(days=1)
    
    with schema_context('public'):
        # Assinaturas expirando em 7 dias
        expiring_7d = Subscription.objects.filter(
            status__in=['active', 'trial'],
            current_period_end__lte=seven_days_from_now,
            current_period_end__gt=three_days_from_now,
        ).select_related('tenant', 'plan')
        
        for subscription in expiring_7d:
            try:
                notification_service.send_expiring_notification(subscription, days=7)
                logger.info(
                    f"[CELERY] Notificação de expiração (7 dias) enviada para "
                    f"tenant: {subscription.tenant.name}"
                )
            except Exception as e:
                logger.error(
                    f"[CELERY] Erro ao enviar notificação de expiração (7 dias) "
                    f"para tenant {subscription.tenant.name}: {str(e)}",
                    exc_info=True
                )
        
        # Assinaturas expirando em 3 dias
        expiring_3d = Subscription.objects.filter(
            status__in=['active', 'trial'],
            current_period_end__lte=three_days_from_now,
            current_period_end__gt=one_day_from_now,
        ).select_related('tenant', 'plan')
        
        for subscription in expiring_3d:
            try:
                notification_service.send_expiring_notification(subscription, days=3)
                logger.info(
                    f"[CELERY] Notificação de expiração (3 dias) enviada para "
                    f"tenant: {subscription.tenant.name}"
                )
            except Exception as e:
                logger.error(
                    f"[CELERY] Erro ao enviar notificação de expiração (3 dias) "
                    f"para tenant {subscription.tenant.name}: {str(e)}",
                    exc_info=True
                )
        
        # Assinaturas expirando em 1 dia
        expiring_1d = Subscription.objects.filter(
            status__in=['active', 'trial'],
            current_period_end__lte=one_day_from_now,
            current_period_end__gt=timezone.now(),
        ).select_related('tenant', 'plan')
        
        for subscription in expiring_1d:
            try:
                notification_service.send_expiring_notification(subscription, days=1)
                logger.info(
                    f"[CELERY] Notificação de expiração (1 dia) enviada para "
                    f"tenant: {subscription.tenant.name}"
                )
            except Exception as e:
                logger.error(
                    f"[CELERY] Erro ao enviar notificação de expiração (1 dia) "
                    f"para tenant {subscription.tenant.name}: {str(e)}",
                    exc_info=True
                )
    
    logger.info("[CELERY] Verificação de assinaturas expirando concluída")


@shared_task
def suspend_expired_tenants():
    """
    Suspende tenants com assinaturas expiradas.
    Executa a cada 1 hora.
    """
    logger.info("[CELERY] Verificando tenants expirados para suspensão...")
    
    suspended_count = 0
    
    with schema_context('public'):
        # Buscar assinaturas expiradas que ainda não foram suspensas
        expired_subscriptions = Subscription.objects.filter(
            current_period_end__lt=timezone.now(),
            status__in=['active', 'trial', 'past_due'],
        ).select_related('tenant', 'plan')
        
        for subscription in expired_subscriptions:
            try:
                tenant = subscription.tenant
                
                # Verificar se tenant já está inativo
                if not tenant.is_active:
                    continue
                
                # Suspender tenant
                tenant.is_active = False
                tenant.save()
                
                # Atualizar status da assinatura
                subscription.status = 'expired'
                subscription.save()
                
                # Enviar notificação
                notification_service = SubscriptionNotificationService()
                notification_service.send_suspension_notification(subscription)
                
                logger.info(
                    f"[CELERY] Tenant {tenant.name} suspenso por assinatura expirada"
                )
                suspended_count += 1
                
            except Exception as e:
                logger.error(
                    f"[CELERY] Erro ao suspender tenant {subscription.tenant.name}: {str(e)}",
                    exc_info=True
                )
    
    logger.info(f"[CELERY] Suspensão concluída: {suspended_count} tenants suspensos")


@shared_task
def reactivate_tenant(tenant_id):
    """
    Reativa um tenant após pagamento bem-sucedido.
    Chamado quando webhook de pagamento bem-sucedido é recebido.
    """
    logger.info(f"[CELERY] Reativando tenant {tenant_id}...")
    
    try:
        with schema_context('public'):
            tenant = Tenant.objects.get(id=tenant_id)
            
            if tenant.is_active:
                logger.info(f"[CELERY] Tenant {tenant.name} já está ativo")
                return
            
            # Reativar tenant
            tenant.is_active = True
            tenant.save()
            
            # Buscar subscription e atualizar status
            subscription = Subscription.objects.filter(tenant=tenant).first()
            if subscription:
                if subscription.status == 'expired':
                    subscription.status = 'active'
                    subscription.save()
                
                # Enviar notificação de reativação
                notification_service = SubscriptionNotificationService()
                notification_service.send_reactivation_notification(subscription)
            
            logger.info(f"[CELERY] Tenant {tenant.name} reativado com sucesso")
            
    except Tenant.DoesNotExist:
        logger.error(f"[CELERY] Tenant {tenant_id} não encontrado")
    except Exception as e:
        logger.error(
            f"[CELERY] Erro ao reativar tenant {tenant_id}: {str(e)}",
            exc_info=True
        )

