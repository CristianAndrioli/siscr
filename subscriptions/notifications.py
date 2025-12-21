"""
Serviço de notificações por email para assinaturas
"""
import logging
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.template.loader import render_to_string
from django.db import connection
from django_tenants.utils import schema_context

from .models import Subscription
from tenants.models import Tenant
from accounts.models import UserProfile, TenantMembership

logger = logging.getLogger(__name__)


class SubscriptionNotificationService:
    """Serviço para enviar notificações relacionadas a assinaturas"""
    
    def __init__(self):
        self.from_email = settings.DEFAULT_FROM_EMAIL
        self.frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    
    def _get_tenant_admin_email(self, tenant):
        """Obtém o email do administrador do tenant"""
        try:
            with schema_context('public'):
                # Buscar primeiro membership ativo do tenant
                membership = TenantMembership.objects.filter(
                    tenant=tenant,
                    is_active=True,
                    role='admin'  # Se houver role admin
                ).select_related('user').first()
                
                if not membership:
                    # Se não houver admin, pegar primeiro membership ativo
                    membership = TenantMembership.objects.filter(
                        tenant=tenant,
                        is_active=True,
                    ).select_related('user').first()
                
                if membership and membership.user:
                    return membership.user.email
        except Exception as e:
            logger.error(f"Erro ao buscar email do admin do tenant {tenant.name}: {str(e)}")
        
        return None
    
    def _send_email(self, subject, message, recipient_email, html_message=None):
        """Envia email"""
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=self.from_email,
                recipient_list=[recipient_email],
                html_message=html_message,
                fail_silently=False,
            )
            logger.info(f"Email enviado para {recipient_email}: {subject}")
            return True
        except Exception as e:
            logger.error(f"Erro ao enviar email para {recipient_email}: {str(e)}", exc_info=True)
            return False
    
    def send_payment_succeeded_notification(self, subscription):
        """Envia email quando pagamento é bem-sucedido"""
        tenant = subscription.tenant
        email = self._get_tenant_admin_email(tenant)
        
        if not email:
            logger.warning(f"Não foi possível encontrar email do admin para tenant {tenant.name}")
            return False
        
        subject = f"Pagamento confirmado - {tenant.name}"
        message = f"""
Olá!

Seu pagamento foi confirmado com sucesso.

Detalhes da assinatura:
- Plano: {subscription.plan.name}
- Período: {subscription.current_period_start.strftime('%d/%m/%Y')} até {subscription.current_period_end.strftime('%d/%m/%Y')}
- Status: {subscription.get_status_display()}

Obrigado por usar o SISCR!

Equipe SISCR
        """.strip()
        
        return self._send_email(subject, message, email)
    
    def send_payment_failed_notification(self, subscription):
        """Envia email quando pagamento falha"""
        tenant = subscription.tenant
        email = self._get_tenant_admin_email(tenant)
        
        if not email:
            logger.warning(f"Não foi possível encontrar email do admin para tenant {tenant.name}")
            return False
        
        subject = f"⚠️ Falha no pagamento - {tenant.name}"
        message = f"""
Olá!

Infelizmente, não foi possível processar o pagamento da sua assinatura.

Detalhes:
- Plano: {subscription.plan.name}
- Status: {subscription.get_status_display()}

Por favor, atualize seu método de pagamento para evitar a suspensão do serviço.

Acesse: {self.frontend_url}/payment-pending

Equipe SISCR
        """.strip()
        
        return self._send_email(subject, message, email)
    
    def send_expiring_notification(self, subscription, days=7):
        """Envia email quando assinatura está expirando"""
        tenant = subscription.tenant
        email = self._get_tenant_admin_email(tenant)
        
        if not email:
            logger.warning(f"Não foi possível encontrar email do admin para tenant {tenant.name}")
            return False
        
        subject = f"⏰ Sua assinatura expira em {days} dia(s) - {tenant.name}"
        message = f"""
Olá!

Sua assinatura expirará em {days} dia(s).

Detalhes:
- Plano: {subscription.plan.name}
- Data de expiração: {subscription.current_period_end.strftime('%d/%m/%Y')}

Para continuar usando o serviço, certifique-se de que seu método de pagamento está atualizado.

Acesse: {self.frontend_url}/subscription-expired

Equipe SISCR
        """.strip()
        
        return self._send_email(subject, message, email)
    
    def send_suspension_notification(self, subscription):
        """Envia email quando tenant é suspenso"""
        tenant = subscription.tenant
        email = self._get_tenant_admin_email(tenant)
        
        if not email:
            logger.warning(f"Não foi possível encontrar email do admin para tenant {tenant.name}")
            return False
        
        subject = f"🚫 Serviço suspenso - {tenant.name}"
        message = f"""
Olá!

Seu serviço foi suspenso devido ao não pagamento da assinatura.

Detalhes:
- Plano: {subscription.plan.name}
- Data de expiração: {subscription.current_period_end.strftime('%d/%m/%Y')}

Para reativar seu serviço, atualize seu método de pagamento e complete o pagamento pendente.

Acesse: {self.frontend_url}/subscription-expired

Equipe SISCR
        """.strip()
        
        return self._send_email(subject, message, email)
    
    def send_reactivation_notification(self, subscription):
        """Envia email quando tenant é reativado"""
        tenant = subscription.tenant
        email = self._get_tenant_admin_email(tenant)
        
        if not email:
            logger.warning(f"Não foi possível encontrar email do admin para tenant {tenant.name}")
            return False
        
        subject = f"✅ Serviço reativado - {tenant.name}"
        message = f"""
Olá!

Seu serviço foi reativado com sucesso!

Detalhes:
- Plano: {subscription.plan.name}
- Período: {subscription.current_period_start.strftime('%d/%m/%Y')} até {subscription.current_period_end.strftime('%d/%m/%Y')}
- Status: {subscription.get_status_display()}

Obrigado por continuar usando o SISCR!

Equipe SISCR
        """.strip()
        
        return self._send_email(subject, message, email)

