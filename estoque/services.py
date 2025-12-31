"""
Serviços de lógica de negócio para o módulo de Estoque
"""
from django.core.exceptions import ValidationError
from django.db import transaction
from decimal import Decimal
from typing import Optional, Dict, Any
from .models import Location, Estoque, MovimentacaoEstoque
from cadastros.models import Produto
from tenants.models import Empresa, Filial


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

