"""
Utilitários para sincronização de planos com Stripe
"""
from django.core.cache import cache
from django.conf import settings
import logging
from .models import Plan

logger = logging.getLogger(__name__)


def sync_all_plans_from_stripe(force=False):
    """
    Sincroniza preços de todos os planos ativos com o Stripe
    
    Args:
        force: Se True, sincroniza mesmo se já foi sincronizado recentemente
    
    Returns:
        dict: Estatísticas da sincronização
    """
    # Cache de 5 minutos para evitar muitas chamadas ao Stripe
    cache_key = 'plans_sync_last_run'
    
    if not force:
        last_sync = cache.get(cache_key)
        if last_sync:
            # Se sincronizou há menos de 5 minutos, não sincroniza novamente
            from django.utils import timezone
            from datetime import timedelta
            if timezone.now() - last_sync < timedelta(minutes=5):
                logger.debug('Sincronização de planos pulada (cache ainda válido)')
                return {
                    'synced': False,
                    'reason': 'cache_valid',
                    'plans_checked': 0,
                    'plans_updated': 0,
                }
    
    stripe_mode = getattr(settings, 'STRIPE_MODE', 'simulated')
    if stripe_mode == 'simulated':
        logger.debug('Modo simulado ativo, pulando sincronização com Stripe')
        return {
            'synced': False,
            'reason': 'simulated_mode',
            'plans_checked': 0,
            'plans_updated': 0,
        }
    
    plans = Plan.objects.filter(is_active=True)
    plans_checked = 0
    plans_updated = 0
    
    for plan in plans:
        plans_checked += 1
        result = plan.sync_prices_from_stripe(force=force)
        if result['updated']:
            plans_updated += 1
    
    # Atualizar cache
    from django.utils import timezone
    cache.set(cache_key, timezone.now(), 300)  # 5 minutos
    
    logger.info(f'Sincronização de planos concluída: {plans_updated}/{plans_checked} planos atualizados')
    
    return {
        'synced': True,
        'plans_checked': plans_checked,
        'plans_updated': plans_updated,
    }

