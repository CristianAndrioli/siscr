"""
Serviços de lógica de negócio para o módulo de Estoque
"""
from django.core.exceptions import ValidationError
from django.db import transaction
from decimal import Decimal
from typing import Optional, Dict, Any
from .models import Location, Estoque, MovimentacaoEstoque, ReservaEstoque, PrevisaoMovimentacao
from cadastros.models import Produto
from tenants.models import Empresa, Filial
from django.utils import timezone
from datetime import timedelta


class EstoqueServiceError(Exception):
    """Exceção base para erros nos serviços de estoque"""
    pass


def validar_location_permite_entrada(location: Location) -> None:
    """
    Valida se a location permite entrada de estoque
    
    Args:
        location: Location a ser validada
        
    Raises:
        EstoqueServiceError: Se a location não permite entrada
    """
    if not location.permite_entrada:
        raise EstoqueServiceError(
            f"A location '{location.nome}' não permite entrada de estoque."
        )
    
    if not location.is_active:
        raise EstoqueServiceError(
            f"A location '{location.nome}' está inativa."
        )


def validar_location_permite_saida(location: Location) -> None:
    """
    Valida se a location permite saída de estoque
    
    Args:
        location: Location a ser validada
        
    Raises:
        EstoqueServiceError: Se a location não permite saída
    """
    if not location.permite_saida:
        raise EstoqueServiceError(
            f"A location '{location.nome}' não permite saída de estoque."
        )
    
    if not location.is_active:
        raise EstoqueServiceError(
            f"A location '{location.nome}' está inativa."
        )


def validar_estoque_disponivel(estoque: Estoque, quantidade: Decimal) -> None:
    """
    Valida se há estoque disponível suficiente
    
    Args:
        estoque: Estoque a ser validado
        quantidade: Quantidade necessária
        
    Raises:
        EstoqueServiceError: Se não houver estoque disponível suficiente
    """
    if estoque.quantidade_disponivel < quantidade:
        raise EstoqueServiceError(
            f"Estoque insuficiente. Disponível: {estoque.quantidade_disponivel}, "
            f"Necessário: {quantidade}"
        )


def validar_filial_pertence_empresa(filial: Optional[Filial], empresa: Empresa) -> None:
    """
    Valida se a filial pertence à empresa
    
    Args:
        filial: Filial a ser validada (pode ser None)
        empresa: Empresa esperada
        
    Raises:
        EstoqueServiceError: Se a filial não pertence à empresa
    """
    if filial and filial.empresa != empresa:
        raise EstoqueServiceError(
            f"A filial '{filial.nome}' não pertence à empresa '{empresa.nome}'."
        )


def calcular_custo_medio_ponderado(
    estoque: Estoque,
    quantidade_entrada: Decimal,
    valor_unitario_entrada: Decimal
) -> Decimal:
    """
    Calcula o custo médio ponderado após uma entrada
    
    Fórmula: CMP = (Qtd_Atual * Custo_Atual + Qtd_Entrada * Custo_Entrada) / (Qtd_Atual + Qtd_Entrada)
    
    Args:
        estoque: Estoque atual
        quantidade_entrada: Quantidade que está entrando
        valor_unitario_entrada: Valor unitário da entrada
        
    Returns:
        Decimal: Novo custo médio ponderado
    """
    quantidade_atual = estoque.quantidade_atual
    custo_atual = estoque.valor_custo_medio
    
    # Se estoque está zerado, o custo médio é o custo da entrada
    if quantidade_atual == 0:
        return valor_unitario_entrada
    
    # Calcular custo médio ponderado
    valor_total_atual = quantidade_atual * custo_atual
    valor_total_entrada = quantidade_entrada * valor_unitario_entrada
    quantidade_total = quantidade_atual + quantidade_entrada
    
    if quantidade_total == 0:
        return Decimal('0.00')
    
    custo_medio_ponderado = (valor_total_atual + valor_total_entrada) / quantidade_total
    
    return custo_medio_ponderado.quantize(Decimal('0.01'))


@transaction.atomic
def processar_entrada_estoque(
    produto: Produto,
    location: Location,
    empresa: Empresa,
    quantidade: Decimal,
    valor_unitario: Decimal,
    origem: str = 'COMPRA',
    documento_referencia: Optional[str] = None,
    numero_nota_fiscal: Optional[str] = None,
    serie_nota_fiscal: Optional[str] = None,
    observacoes: Optional[str] = None,
    atualizar_previsao: bool = True
) -> Dict[str, Any]:
    """
    Processa entrada de estoque
    
    Processo:
    1. Valida location permite entrada
    2. Busca ou cria estoque
    3. Calcula custo médio ponderado
    4. Atualiza quantidade_atual
    5. Cria movimentação (tipo=ENTRADA)
    6. Atualiza quantidade_prevista_entrada (se havia previsão)
    
    Args:
        produto: Produto que está entrando
        location: Location onde o estoque entrará
        empresa: Empresa proprietária
        quantidade: Quantidade a entrar (sempre positiva)
        valor_unitario: Valor unitário da entrada
        origem: Origem da entrada (COMPRA, DEVOLUCAO, etc.)
        documento_referencia: Documento de referência (ex: OC-001)
        numero_nota_fiscal: Número da nota fiscal
        serie_nota_fiscal: Série da nota fiscal
        observacoes: Observações adicionais
        atualizar_previsao: Se deve atualizar quantidade_prevista_entrada
        
    Returns:
        Dict com estoque e movimentação criados
        
    Raises:
        EstoqueServiceError: Se houver erro de validação
    """
    # Validações
    if quantidade <= 0:
        raise EstoqueServiceError("Quantidade deve ser maior que zero.")
    
    if valor_unitario < 0:
        raise EstoqueServiceError("Valor unitário não pode ser negativo.")
    
    validar_location_permite_entrada(location)
    
    # Validar que location pertence à empresa
    if location.empresa != empresa:
        raise EstoqueServiceError(
            f"A location '{location.nome}' não pertence à empresa '{empresa.nome}'."
        )
    
    # Buscar ou criar estoque
    estoque, created = Estoque.objects.get_or_create(
        produto=produto,
        location=location,
        defaults={
            'empresa': empresa,
            'quantidade_atual': Decimal('0.000'),
            'quantidade_reservada': Decimal('0.000'),
            'valor_custo_medio': Decimal('0.00'),
        }
    )
    
    # Se estoque já existia mas empresa estava diferente, atualizar
    if not created and estoque.empresa != empresa:
        estoque.empresa = empresa
        estoque.save()
    
    # Salvar quantidade anterior e custo médio anterior para auditoria
    quantidade_anterior = estoque.quantidade_atual
    custo_medio_anterior = estoque.valor_custo_medio
    
    # Calcular novo custo médio ponderado
    novo_custo_medio = calcular_custo_medio_ponderado(
        estoque,
        quantidade,
        valor_unitario
    )
    
    # Atualizar estoque
    estoque.quantidade_atual += quantidade
    estoque.valor_custo_medio = novo_custo_medio
    estoque.save()  # Isso já calcula quantidade_disponivel e valor_total
    
    # Atualizar quantidade_prevista_entrada se havia previsão
    if atualizar_previsao and estoque.quantidade_prevista_entrada > 0:
        estoque.quantidade_prevista_entrada = max(
            Decimal('0.000'),
            estoque.quantidade_prevista_entrada - quantidade
        )
        estoque.save()
    
    # Criar movimentação
    movimentacao = MovimentacaoEstoque.objects.create(
        estoque=estoque,
        tipo='ENTRADA',
        origem=origem,
        status='CONFIRMADA',
        quantidade=quantidade,
        quantidade_anterior=quantidade_anterior,
        quantidade_posterior=estoque.quantidade_atual,
        valor_unitario=valor_unitario,
        location_destino=location,
        documento_referencia=documento_referencia,
        numero_nota_fiscal=numero_nota_fiscal,
        serie_nota_fiscal=serie_nota_fiscal,
        observacoes=observacoes
    )
    
    return {
        'estoque': estoque,
        'movimentacao': movimentacao,
        'custo_medio_anterior': custo_medio_anterior if not created else Decimal('0.00'),
        'custo_medio_novo': novo_custo_medio,
    }


@transaction.atomic
def processar_saida_estoque(
    produto: Produto,
    location: Location,
    empresa: Empresa,
    quantidade: Decimal,
    valor_unitario: Decimal,
    origem: str = 'VENDA',
    documento_referencia: Optional[str] = None,
    numero_nota_fiscal: Optional[str] = None,
    serie_nota_fiscal: Optional[str] = None,
    observacoes: Optional[str] = None,
    atualizar_previsao: bool = True,
    verificar_estoque_minimo: bool = True
) -> Dict[str, Any]:
    """
    Processa saída de estoque
    
    Processo:
    1. Valida location permite saída
    2. Busca estoque
    3. Valida estoque disponível
    4. Atualiza quantidade_atual
    5. Cria movimentação (tipo=SAIDA)
    6. Atualiza quantidade_prevista_saida (se havia previsão)
    7. Verifica estoque mínimo (se solicitado)
    
    Args:
        produto: Produto que está saindo
        location: Location de onde o estoque sairá
        empresa: Empresa proprietária
        quantidade: Quantidade a sair (sempre positiva)
        valor_unitario: Valor unitário da saída (geralmente custo médio)
        origem: Origem da saída (VENDA, CONSUMO_INTERNO, etc.)
        documento_referencia: Documento de referência (ex: PV-001)
        numero_nota_fiscal: Número da nota fiscal
        serie_nota_fiscal: Série da nota fiscal
        observacoes: Observações adicionais
        atualizar_previsao: Se deve atualizar quantidade_prevista_saida
        verificar_estoque_minimo: Se deve verificar e alertar sobre estoque mínimo
        
    Returns:
        Dict com estoque e movimentação criados, e alerta de estoque mínimo (se aplicável)
        
    Raises:
        EstoqueServiceError: Se houver erro de validação ou estoque insuficiente
    """
    # Validações
    if quantidade <= 0:
        raise EstoqueServiceError("Quantidade deve ser maior que zero.")
    
    if valor_unitario < 0:
        raise EstoqueServiceError("Valor unitário não pode ser negativo.")
    
    validar_location_permite_saida(location)
    
    # Validar que location pertence à empresa
    if location.empresa != empresa:
        raise EstoqueServiceError(
            f"A location '{location.nome}' não pertence à empresa '{empresa.nome}'."
        )
    
    # Buscar estoque
    try:
        estoque = Estoque.objects.get(
            produto=produto,
            location=location,
            empresa=empresa
        )
    except Estoque.DoesNotExist:
        raise EstoqueServiceError(
            f"Estoque não encontrado para produto '{produto.nome}' na location '{location.nome}'."
        )
    
    # Validar estoque disponível
    validar_estoque_disponivel(estoque, quantidade)
    
    # Salvar quantidade anterior para auditoria
    quantidade_anterior = estoque.quantidade_atual
    
    # Atualizar estoque
    estoque.quantidade_atual -= quantidade
    estoque.save()  # Isso já calcula quantidade_disponivel e valor_total
    
    # Atualizar quantidade_prevista_saida se havia previsão
    if atualizar_previsao and estoque.quantidade_prevista_saida > 0:
        estoque.quantidade_prevista_saida = max(
            Decimal('0.000'),
            estoque.quantidade_prevista_saida - quantidade
        )
        estoque.save()
    
    # Criar movimentação
    movimentacao = MovimentacaoEstoque.objects.create(
        estoque=estoque,
        tipo='SAIDA',
        origem=origem,
        status='CONFIRMADA',
        quantidade=quantidade,
        quantidade_anterior=quantidade_anterior,
        quantidade_posterior=estoque.quantidade_atual,
        valor_unitario=valor_unitario,
        location_origem=location,
        documento_referencia=documento_referencia,
        numero_nota_fiscal=numero_nota_fiscal,
        serie_nota_fiscal=serie_nota_fiscal,
        observacoes=observacoes
    )
    
    # Verificar estoque mínimo
    alerta_estoque_minimo = None
    if verificar_estoque_minimo and estoque.abaixo_estoque_minimo:
        alerta_estoque_minimo = {
            'produto': produto.nome,
            'location': location.nome,
            'quantidade_atual': estoque.quantidade_atual,
            'estoque_minimo': estoque.estoque_minimo,
            'diferenca': estoque.quantidade_atual - estoque.estoque_minimo
        }
    
    return {
        'estoque': estoque,
        'movimentacao': movimentacao,
        'alerta_estoque_minimo': alerta_estoque_minimo,
    }


@transaction.atomic
def criar_reserva(
    produto: Produto,
    location: Location,
    empresa: Empresa,
    quantidade: Decimal,
    tipo: str = 'SOFT',
    origem: str = 'VENDA',
    documento_referencia: Optional[str] = None,
    minutos_expiracao: Optional[int] = 30,
    observacoes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Cria uma reserva de estoque (SOFT ou HARD)
    
    SOFT: Reserva temporária que não bloqueia estoque físico
    HARD: Reserva confirmada que bloqueia estoque físico
    
    Args:
        produto: Produto a ser reservado
        location: Location onde o estoque será reservado
        empresa: Empresa proprietária
        quantidade: Quantidade a reservar
        tipo: Tipo de reserva ('SOFT' ou 'HARD')
        origem: Origem da reserva (VENDA, ECOMMERCE, etc.)
        documento_referencia: Documento de referência
        minutos_expiracao: Minutos até expiração (apenas para SOFT)
        observacoes: Observações adicionais
        
    Returns:
        Dict com reserva criada
        
    Raises:
        EstoqueServiceError: Se houver erro de validação ou estoque insuficiente
    """
    # Validações
    if quantidade <= 0:
        raise EstoqueServiceError("Quantidade deve ser maior que zero.")
    
    if tipo not in ['SOFT', 'HARD']:
        raise EstoqueServiceError("Tipo de reserva deve ser 'SOFT' ou 'HARD'.")
    
    # Validar que location pertence à empresa
    if location.empresa != empresa:
        raise EstoqueServiceError(
            f"A location '{location.nome}' não pertence à empresa '{empresa.nome}'."
        )
    
    # Buscar estoque
    try:
        estoque = Estoque.objects.get(
            produto=produto,
            location=location,
            empresa=empresa
        )
    except Estoque.DoesNotExist:
        raise EstoqueServiceError(
            f"Estoque não encontrado para produto '{produto.nome}' na location '{location.nome}'."
        )
    
    # Para HARD, validar estoque disponível
    if tipo == 'HARD':
        validar_estoque_disponivel(estoque, quantidade)
    
    # Calcular data de expiração para SOFT
    data_expiracao = None
    if tipo == 'SOFT':
        if not minutos_expiracao:
            minutos_expiracao = 30  # Default: 30 minutos
        data_expiracao = timezone.now() + timedelta(minutes=minutos_expiracao)
    
    # Criar reserva
    reserva = ReservaEstoque.objects.create(
        estoque=estoque,
        tipo=tipo,
        origem=origem,
        status='ATIVA',
        quantidade=quantidade,
        data_expiracao=data_expiracao,
        documento_referencia=documento_referencia,
        observacoes=observacoes
    )
    
    # Se é HARD, atualizar quantidade_reservada
    if tipo == 'HARD':
        estoque.quantidade_reservada += quantidade
        estoque.save()
    
    return {
        'reserva': reserva,
        'estoque': estoque,
    }


@transaction.atomic
def confirmar_reserva(reserva: ReservaEstoque) -> Dict[str, Any]:
    """
    Confirma uma reserva SOFT, convertendo para HARD e bloqueando estoque
    
    Args:
        reserva: Reserva a ser confirmada
        
    Returns:
        Dict com reserva confirmada e estoque atualizado
        
    Raises:
        EstoqueServiceError: Se houver erro de validação ou estoque insuficiente
    """
    if reserva.status != 'ATIVA':
        raise EstoqueServiceError(
            f"Reserva não está ativa. Status atual: {reserva.status}"
        )
    
    estoque = reserva.estoque
    
    # Se é SOFT, validar estoque disponível antes de converter
    if reserva.tipo == 'SOFT':
        validar_estoque_disponivel(estoque, reserva.quantidade)
    
    # Confirmar reserva (converte SOFT para HARD se necessário)
    reserva.confirmar()
    
    return {
        'reserva': reserva,
        'estoque': estoque,
    }


@transaction.atomic
def cancelar_reserva(reserva: ReservaEstoque, motivo: Optional[str] = None) -> Dict[str, Any]:
    """
    Cancela uma reserva e libera estoque se necessário
    
    Args:
        reserva: Reserva a ser cancelada
        motivo: Motivo do cancelamento
        
    Returns:
        Dict com reserva cancelada e estoque atualizado
        
    Raises:
        EstoqueServiceError: Se houver erro de validação
    """
    if reserva.status in ['CANCELADA', 'EXPIRADA']:
        raise EstoqueServiceError(
            f"Reserva já está {reserva.status.lower()}"
        )
    
    estoque = reserva.estoque
    
    # Cancelar reserva (libera estoque se HARD)
    reserva.cancelar(motivo=motivo)
    
    return {
        'reserva': reserva,
        'estoque': estoque,
    }


@transaction.atomic
def processar_transferencia(
    produto: Produto,
    location_origem: Location,
    location_destino: Location,
    empresa: Empresa,
    quantidade: Decimal,
    valor_unitario: Optional[Decimal] = None,
    documento_referencia: Optional[str] = None,
    observacoes: Optional[str] = None
) -> Dict[str, Any]:
    """
    Processa transferência de estoque entre locations
    
    Processo:
    1. Valida locations origem e destino
    2. Valida estoque disponível na origem
    3. Cria 2 movimentações:
       - Saída na origem (tipo=SAIDA, origem=TRANSFERENCIA)
       - Entrada no destino (tipo=ENTRADA, origem=TRANSFERENCIA)
    4. Atualiza estoques
    5. Rastreia transferência
    
    Args:
        produto: Produto a ser transferido
        location_origem: Location de origem
        location_destino: Location de destino
        empresa: Empresa proprietária
        quantidade: Quantidade a transferir
        valor_unitario: Valor unitário (se None, usa custo médio do estoque origem)
        documento_referencia: Documento de referência (ex: TRF-001)
        observacoes: Observações adicionais
        
    Returns:
        Dict com movimentações criadas e estoques atualizados
        
    Raises:
        EstoqueServiceError: Se houver erro de validação ou estoque insuficiente
    """
    # Validações básicas
    if quantidade <= 0:
        raise EstoqueServiceError("Quantidade deve ser maior que zero.")
    
    if location_origem == location_destino:
        raise EstoqueServiceError("Location de origem e destino não podem ser a mesma.")
    
    # Validar que ambas locations pertencem à mesma empresa
    if location_origem.empresa != empresa:
        raise EstoqueServiceError(
            f"A location de origem '{location_origem.nome}' não pertence à empresa '{empresa.nome}'."
        )
    
    if location_destino.empresa != empresa:
        raise EstoqueServiceError(
            f"A location de destino '{location_destino.nome}' não pertence à empresa '{empresa.nome}'."
        )
    
    # Validar permissões
    if not location_origem.permite_saida:
        raise EstoqueServiceError(
            f"A location de origem '{location_origem.nome}' não permite saída de estoque."
        )
    
    if not location_destino.permite_entrada:
        raise EstoqueServiceError(
            f"A location de destino '{location_destino.nome}' não permite entrada de estoque."
        )
    
    # Buscar estoque na origem
    try:
        estoque_origem = Estoque.objects.get(
            produto=produto,
            location=location_origem,
            empresa=empresa
        )
    except Estoque.DoesNotExist:
        raise EstoqueServiceError(
            f"Estoque não encontrado para produto '{produto.nome}' na location de origem '{location_origem.nome}'."
        )
    
    # Validar estoque disponível na origem
    validar_estoque_disponivel(estoque_origem, quantidade)
    
    # Buscar ou criar estoque no destino
    estoque_destino, created = Estoque.objects.get_or_create(
        produto=produto,
        location=location_destino,
        defaults={
            'empresa': empresa,
            'quantidade_atual': Decimal('0.000'),
            'quantidade_reservada': Decimal('0.000'),
            'valor_custo_medio': estoque_origem.valor_custo_medio,  # Usa mesmo custo médio
        }
    )
    
    # Se estoque já existia mas empresa estava diferente, atualizar
    if not created and estoque_destino.empresa != empresa:
        estoque_destino.empresa = empresa
        estoque_destino.save()
    
    # Determinar valor unitário (usa custo médio da origem se não fornecido)
    if valor_unitario is None:
        valor_unitario = estoque_origem.valor_custo_medio
    
    # Salvar quantidades anteriores para auditoria
    quantidade_anterior_origem = estoque_origem.quantidade_atual
    quantidade_anterior_destino = estoque_destino.quantidade_atual
    
    # Atualizar estoques
    estoque_origem.quantidade_atual -= quantidade
    estoque_origem.save()
    
    # Calcular novo custo médio no destino (se já tinha estoque)
    if estoque_destino.quantidade_atual > 0:
        novo_custo_medio_destino = calcular_custo_medio_ponderado(
            estoque_destino,
            quantidade,
            valor_unitario
        )
        estoque_destino.valor_custo_medio = novo_custo_medio_destino
    
    estoque_destino.quantidade_atual += quantidade
    estoque_destino.save()
    
    # Criar movimentação de saída na origem
    movimentacao_saida = MovimentacaoEstoque.objects.create(
        estoque=estoque_origem,
        tipo='SAIDA',
        origem='TRANSFERENCIA_ENTRE_LOCATIONS',
        status='CONFIRMADA',
        quantidade=quantidade,
        quantidade_anterior=quantidade_anterior_origem,
        quantidade_posterior=estoque_origem.quantidade_atual,
        valor_unitario=valor_unitario,
        location_origem=location_origem,
        location_destino=location_destino,
        documento_referencia=documento_referencia,
        observacoes=observacoes
    )
    
    # Criar movimentação de entrada no destino
    movimentacao_entrada = MovimentacaoEstoque.objects.create(
        estoque=estoque_destino,
        tipo='ENTRADA',
        origem='TRANSFERENCIA_ENTRE_LOCATIONS',
        status='CONFIRMADA',
        quantidade=quantidade,
        quantidade_anterior=quantidade_anterior_destino,
        quantidade_posterior=estoque_destino.quantidade_atual,
        valor_unitario=valor_unitario,
        location_origem=location_origem,
        location_destino=location_destino,
        documento_referencia=documento_referencia,
        observacoes=observacoes
    )
    
    return {
        'movimentacao_saida': movimentacao_saida,
        'movimentacao_entrada': movimentacao_entrada,
        'estoque_origem': estoque_origem,
        'estoque_destino': estoque_destino,
    }

