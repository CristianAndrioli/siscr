"""
Tarefas periódicas e assíncronas do Celery para o módulo de Estoque
"""
import logging
from celery import shared_task
from django.utils import timezone
from django.db import transaction
from django.db.models import Q, Sum, F
from django_tenants.utils import schema_context
from decimal import Decimal
from .models import ReservaEstoque, Estoque, MovimentacaoEstoque, GrupoFilial

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


@shared_task
def reconciliar_estoque_disponivel():
    """
    Reconcilia quantidade_disponivel de todos os estoques.
    Executa a cada 30 minutos para garantir consistência.
    """
    logger.info("[CELERY] Iniciando reconciliação de estoque disponível...")
    
    try:
        count = 0
        errors = 0
        
        # Buscar todos os estoques ativos
        estoques = Estoque.objects.filter(is_deleted=False)
        
        for estoque in estoques:
            try:
                with transaction.atomic():
                    # Recalcular quantidade_disponivel
                    quantidade_disponivel_calculada = (
                        estoque.quantidade_atual - estoque.quantidade_reservada
                    )
                    
                    # Se houver diferença, atualizar
                    if estoque.quantidade_disponivel != quantidade_disponivel_calculada:
                        estoque.quantidade_disponivel = quantidade_disponivel_calculada
                        estoque.save(update_fields=['quantidade_disponivel'])
                        count += 1
                        logger.debug(
                            f"[CELERY] Estoque {estoque.id} reconciliado: "
                            f"{estoque.quantidade_disponivel} -> {quantidade_disponivel_calculada}"
                        )
            except Exception as e:
                errors += 1
                logger.error(f"[CELERY] Erro ao reconciliar estoque {estoque.id}: {str(e)}")
        
        logger.info(f"[CELERY] Reconciliação concluída: {count} estoque(s) atualizado(s), {errors} erro(s)")
        return {
            'reconciled': count,
            'errors': errors
        }
        
    except Exception as e:
        logger.error(f"[CELERY] Erro ao processar reconciliação: {str(e)}")
        raise


@shared_task
def atualizar_custo_medio_produtos():
    """
    Atualiza custo médio de produtos baseado nas últimas entradas.
    Executa a cada 1 hora.
    """
    logger.info("[CELERY] Iniciando atualização de custo médio...")
    
    try:
        count = 0
        errors = 0
        
        # Buscar todos os estoques com movimentações recentes
        # Atualizar apenas estoques que tiveram entradas nas últimas 24 horas
        desde = timezone.now() - timezone.timedelta(hours=24)
        
        estoques_com_entradas = Estoque.objects.filter(
            movimentacoes__tipo='ENTRADA',
            movimentacoes__data_movimentacao__gte=desde,
            movimentacoes__status='CONFIRMADA'
        ).distinct()
        
        for estoque in estoques_com_entradas:
            try:
                with transaction.atomic():
                    # Buscar últimas entradas confirmadas
                    entradas = MovimentacaoEstoque.objects.filter(
                        estoque=estoque,
                        tipo='ENTRADA',
                        status='CONFIRMADA'
                    ).order_by('-data_movimentacao')[:10]  # Últimas 10 entradas
                    
                    if not entradas.exists():
                        continue
                    
                    # Calcular custo médio ponderado das últimas entradas
                    total_quantidade = sum(e.quantidade for e in entradas)
                    total_valor = sum(e.valor_total for e in entradas)
                    
                    if total_quantidade > 0:
                        novo_custo_medio = total_valor / total_quantidade
                        
                        # Atualizar apenas se houver diferença significativa (> 0.01)
                        if abs(estoque.valor_custo_medio - novo_custo_medio) > Decimal('0.01'):
                            estoque.valor_custo_medio = novo_custo_medio.quantize(Decimal('0.01'))
                            estoque.save(update_fields=['valor_custo_medio'])
                            count += 1
                            logger.debug(
                                f"[CELERY] Custo médio atualizado para estoque {estoque.id}: "
                                f"{estoque.valor_custo_medio}"
                            )
            except Exception as e:
                errors += 1
                logger.error(f"[CELERY] Erro ao atualizar custo médio do estoque {estoque.id}: {str(e)}")
        
        logger.info(f"[CELERY] Atualização de custo médio concluída: {count} estoque(s) atualizado(s), {errors} erro(s)")
        return {
            'updated': count,
            'errors': errors
        }
        
    except Exception as e:
        logger.error(f"[CELERY] Erro ao processar atualização de custo médio: {str(e)}")
        raise


@shared_task
def atualizar_estoque_consolidado_grupos():
    """
    Atualiza estoque consolidado de grupos de filiais.
    Executa a cada 15 minutos.
    """
    logger.info("[CELERY] Iniciando atualização de estoque consolidado de grupos...")
    
    try:
        # Esta tarefa é mais para garantir consistência
        # O método get_estoque_consolidado() já calcula em tempo real
        # Aqui podemos fazer cache ou validações se necessário
        
        grupos = GrupoFilial.objects.filter(is_active=True)
        count = 0
        
        for grupo in grupos:
            try:
                # Validar que todas as filiais do grupo pertencem à empresa
                filiais_invalidas = grupo.filiais.exclude(empresa=grupo.empresa)
                if filiais_invalidas.exists():
                    logger.warning(
                        f"[CELERY] Grupo {grupo.id} tem filiais de empresas diferentes. "
                        f"Filiais inválidas: {[f.id for f in filiais_invalidas]}"
                    )
                else:
                    count += 1
            except Exception as e:
                logger.error(f"[CELERY] Erro ao validar grupo {grupo.id}: {str(e)}")
        
        logger.info(f"[CELERY] Validação de grupos concluída: {count} grupo(s) válido(s)")
        return {
            'validated': count
        }
        
    except Exception as e:
        logger.error(f"[CELERY] Erro ao processar atualização de grupos: {str(e)}")
        raise


@shared_task
def verificar_estoque_minimo():
    """
    Verifica estoques abaixo do mínimo e gera alertas.
    Executa diariamente.
    """
    logger.info("[CELERY] Iniciando verificação de estoque mínimo...")
    
    try:
        estoques_abaixo_minimo = Estoque.objects.filter(
            is_deleted=False,
            estoque_minimo__gt=0
        ).annotate(
            diferenca=F('quantidade_atual') - F('estoque_minimo')
        ).filter(
            quantidade_atual__lt=F('estoque_minimo')
        )
        
        count = estoques_abaixo_minimo.count()
        
        if count > 0:
            logger.warning(
                f"[CELERY] {count} produto(s) com estoque abaixo do mínimo encontrado(s)"
            )
            
            # Log detalhado dos produtos
            for estoque in estoques_abaixo_minimo.select_related('produto', 'location', 'empresa')[:50]:  # Limitar a 50 para não sobrecarregar
                logger.warning(
                    f"[CELERY] ALERTA: {estoque.produto.nome} na {estoque.location.nome} "
                    f"({estoque.empresa.nome}): {estoque.quantidade_atual} < {estoque.estoque_minimo}"
                )
        
        logger.info(f"[CELERY] Verificação concluída: {count} alerta(s) gerado(s)")
        return {
            'alerts': count
        }
        
    except Exception as e:
        logger.error(f"[CELERY] Erro ao processar verificação de estoque mínimo: {str(e)}")
        raise


@shared_task
def calcular_indicadores_estoque():
    """
    Calcula indicadores de estoque (giro, rotatividade, etc.).
    Executa semanalmente.
    """
    logger.info("[CELERY] Iniciando cálculo de indicadores de estoque...")
    
    try:
        # Esta tarefa pode calcular métricas como:
        # - Giro de estoque
        # - Produtos parados
        # - Rotatividade
        # - Tempo médio de permanência
        
        # Por enquanto, apenas logamos que a tarefa foi executada
        # Implementação completa pode ser feita conforme necessidade
        
        logger.info("[CELERY] Cálculo de indicadores concluído")
        return {
            'status': 'completed'
        }
        
    except Exception as e:
        logger.error(f"[CELERY] Erro ao processar cálculo de indicadores: {str(e)}")
        raise


@shared_task
def processar_entrada_estoque_async(produto_id, location_id, empresa_id, quantidade, valor_unitario, origem='COMPRA', **kwargs):
    """
    Processa entrada de estoque de forma assíncrona.
    Útil para processar grandes volumes ou quando não precisa ser síncrono.
    """
    logger.info(f"[CELERY] Processando entrada de estoque assíncrona: produto={produto_id}, location={location_id}")
    
    try:
        from cadastros.models import Produto
        from tenants.models import Empresa
        from .models import Location
        from .services import processar_entrada_estoque
        
        produto = Produto.objects.get(id=produto_id)
        location = Location.objects.get(id=location_id)
        empresa = Empresa.objects.get(id=empresa_id)
        
        resultado = processar_entrada_estoque(
            produto=produto,
            location=location,
            empresa=empresa,
            quantidade=Decimal(str(quantidade)),
            valor_unitario=Decimal(str(valor_unitario)),
            origem=origem,
            **kwargs
        )
        
        logger.info(f"[CELERY] Entrada processada com sucesso: estoque={resultado['estoque'].id}")
        return {
            'estoque_id': resultado['estoque'].id,
            'movimentacao_id': resultado['movimentacao'].id,
            'status': 'success'
        }
        
    except Exception as e:
        logger.error(f"[CELERY] Erro ao processar entrada assíncrona: {str(e)}")
        raise


@shared_task
def processar_saida_estoque_async(produto_id, location_id, empresa_id, quantidade, valor_unitario=None, origem='VENDA', **kwargs):
    """
    Processa saída de estoque de forma assíncrona.
    Útil para processar grandes volumes ou quando não precisa ser síncrono.
    """
    logger.info(f"[CELERY] Processando saída de estoque assíncrona: produto={produto_id}, location={location_id}")
    
    try:
        from cadastros.models import Produto
        from tenants.models import Empresa
        from .models import Location
        from .services import processar_saida_estoque
        
        produto = Produto.objects.get(id=produto_id)
        location = Location.objects.get(id=location_id)
        empresa = Empresa.objects.get(id=empresa_id)
        
        resultado = processar_saida_estoque(
            produto=produto,
            location=location,
            empresa=empresa,
            quantidade=Decimal(str(quantidade)),
            valor_unitario=Decimal(str(valor_unitario)) if valor_unitario else None,
            origem=origem,
            **kwargs
        )
        
        logger.info(f"[CELERY] Saída processada com sucesso: estoque={resultado['estoque'].id}")
        return {
            'estoque_id': resultado['estoque'].id,
            'movimentacao_id': resultado['movimentacao'].id,
            'status': 'success',
            'alerta_estoque_minimo': resultado.get('alerta_estoque_minimo')
        }
        
    except Exception as e:
        logger.error(f"[CELERY] Erro ao processar saída assíncrona: {str(e)}")
        raise

