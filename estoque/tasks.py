"""
Tarefas periódicas do Celery para o módulo de Estoque
"""
import logging
from celery import shared_task
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from .models import ReservaEstoque

logger = logging.getLogger(__name__)


@shared_task
def expirar_soft_reservations():
    """
    Expira reservas SOFT que passaram da data de expiração.
    Executa a cada 5 minutos.
    """
    logger.info("[CELERY] Iniciando expiração de reservas SOFT...")
    
    try:
        # Buscar reservas SOFT ativas que expiraram
        agora = timezone.now()
        reservas_expiradas = ReservaEstoque.objects.filter(
            tipo='SOFT',
            status='ATIVA',
            data_expiracao__lte=agora
        )
        
        count = 0
        errors = 0
        
        for reserva in reservas_expiradas:
            try:
                with transaction.atomic():
                    reserva.expirar()
                count += 1
                logger.debug(f"[CELERY] Reserva {reserva.id} expirada com sucesso")
            except Exception as e:
                errors += 1
                logger.error(f"[CELERY] Erro ao expirar reserva {reserva.id}: {str(e)}")
        
        logger.info(f"[CELERY] Expiração concluída: {count} reserva(s) expirada(s), {errors} erro(s)")
        return {
            'expired': count,
            'errors': errors
        }
        
    except Exception as e:
        logger.error(f"[CELERY] Erro ao processar expiração de reservas: {str(e)}")
        raise

