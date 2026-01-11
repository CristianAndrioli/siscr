"""
Serviço principal do módulo Financeiro
Gerencia criação de contas e processamento de pagamentos
"""
from django.db import transaction, models
from decimal import Decimal
from typing import Optional, Dict, Any
from ..models import ContaReceber, ContaPagar, Boleto, TransacaoPagamento


class FinanceiroServiceError(Exception):
    """Exceção base para erros nos serviços financeiros"""
    pass


class FinanceiroService:
    """
    Serviço principal para operações financeiras
    """
    
    @transaction.atomic
    def criar_conta_receber(
        self,
        cliente,
        valor_total: Decimal,
        data_emissao,
        data_vencimento,
        empresa=None,
        filial=None,
        nota_fiscal=None,
        pedido_venda=None,
        forma_pagamento: Optional[str] = None,
        descricao: Optional[str] = None,
        observacoes: Optional[str] = None
    ) -> ContaReceber:
        """
        Cria uma Conta a Receber
        
        Args:
            cliente: Pessoa (cliente)
            valor_total: Valor total da conta
            data_emissao: Data de emissão
            data_vencimento: Data de vencimento
            empresa: Empresa (opcional)
            filial: Filial (opcional)
            nota_fiscal: NotaFiscalEletronica que originou (opcional)
            pedido_venda: PedidoVenda que originou (opcional)
            forma_pagamento: Forma de pagamento (opcional)
            descricao: Descrição (opcional)
            observacoes: Observações (opcional)
        
        Returns:
            ContaReceber criada
        """
        # Gerar código da conta (sequencial)
        ultimo_codigo = ContaReceber.all_objects.aggregate(
            max_codigo=models.Max('codigo_conta')
        )['max_codigo'] or 0
        
        codigo_conta = ultimo_codigo + 1
        
        # Gerar número do documento
        if nota_fiscal:
            numero_documento = f"NF-{nota_fiscal.numero}/{nota_fiscal.serie}"
        elif pedido_venda:
            numero_documento = f"PED-{pedido_venda.numero_pedido}"
        else:
            numero_documento = f"CR-{codigo_conta:06d}"
        
        conta_receber = ContaReceber.objects.create(
            codigo_conta=codigo_conta,
            numero_documento=numero_documento,
            cliente=cliente,
            valor_total=valor_total,
            data_emissao=data_emissao,
            data_vencimento=data_vencimento,
            empresa=empresa,
            filial=filial,
            nota_fiscal=nota_fiscal,
            pedido_venda=pedido_venda,
            forma_pagamento=forma_pagamento,
            descricao=descricao,
            observacoes=observacoes,
            status='Pendente'
        )
        
        return conta_receber
    
    @transaction.atomic
    def criar_conta_pagar(
        self,
        fornecedor,
        valor_total: Decimal,
        data_emissao,
        data_vencimento,
        empresa=None,
        filial=None,
        nota_fiscal_entrada=None,
        forma_pagamento: Optional[str] = None,
        descricao: Optional[str] = None,
        observacoes: Optional[str] = None
    ) -> ContaPagar:
        """
        Cria uma Conta a Pagar
        
        Args:
            fornecedor: Pessoa (fornecedor)
            valor_total: Valor total da conta
            data_emissao: Data de emissão
            data_vencimento: Data de vencimento
            empresa: Empresa (opcional)
            filial: Filial (opcional)
            nota_fiscal_entrada: NotaFiscalEletronica de entrada (opcional)
            forma_pagamento: Forma de pagamento (opcional)
            descricao: Descrição (opcional)
            observacoes: Observações (opcional)
        
        Returns:
            ContaPagar criada
        """
        # Gerar código da conta (sequencial)
        ultimo_codigo = ContaPagar.all_objects.aggregate(
            max_codigo=models.Max('codigo_conta')
        )['max_codigo'] or 0
        
        codigo_conta = ultimo_codigo + 1
        
        # Gerar número do documento
        if nota_fiscal_entrada:
            numero_documento = f"NF-ENT-{nota_fiscal_entrada.numero}/{nota_fiscal_entrada.serie}"
        else:
            numero_documento = f"CP-{codigo_conta:06d}"
        
        conta_pagar = ContaPagar.objects.create(
            codigo_conta=codigo_conta,
            numero_documento=numero_documento,
            fornecedor=fornecedor,
            valor_total=valor_total,
            data_emissao=data_emissao,
            data_vencimento=data_vencimento,
            empresa=empresa,
            filial=filial,
            nota_fiscal_entrada=nota_fiscal_entrada,
            forma_pagamento=forma_pagamento,
            descricao=descricao,
            observacoes=observacoes,
            status='Pendente'
        )
        
        return conta_pagar
    
    @transaction.atomic
    def baixar_conta_receber(
        self,
        conta_receber: ContaReceber,
        valor_recebido: Decimal,
        data_recebimento,
        forma_pagamento: Optional[str] = None,
        observacoes: Optional[str] = None
    ) -> ContaReceber:
        """
        Baixa uma Conta a Receber (registra pagamento)
        
        Args:
            conta_receber: Conta a Receber a ser baixada
            valor_recebido: Valor recebido
            data_recebimento: Data do recebimento
            forma_pagamento: Forma de pagamento (opcional)
            observacoes: Observações (opcional)
        
        Returns:
            ContaReceber atualizada
        """
        if conta_receber.status == 'Pago':
            raise FinanceiroServiceError("Conta já está paga")
        
        if conta_receber.status == 'Cancelado':
            raise FinanceiroServiceError("Não é possível baixar conta cancelada")
        
        # Atualizar valores
        conta_receber.valor_recebido += valor_recebido
        conta_receber.data_recebimento = data_recebimento
        
        if forma_pagamento:
            conta_receber.forma_pagamento = forma_pagamento
        
        if observacoes:
            conta_receber.observacoes = f"{conta_receber.observacoes or ''}\n{observacoes}".strip()
        
        # O save() já atualiza status automaticamente
        conta_receber.save()
        
        return conta_receber
    
    @transaction.atomic
    def baixar_conta_pagar(
        self,
        conta_pagar: ContaPagar,
        valor_pago: Decimal,
        data_pagamento,
        forma_pagamento: Optional[str] = None,
        observacoes: Optional[str] = None
    ) -> ContaPagar:
        """
        Baixa uma Conta a Pagar (registra pagamento)
        
        Args:
            conta_pagar: Conta a Pagar a ser baixada
            valor_pago: Valor pago
            data_pagamento: Data do pagamento
            forma_pagamento: Forma de pagamento (opcional)
            observacoes: Observações (opcional)
        
        Returns:
            ContaPagar atualizada
        """
        if conta_pagar.status == 'Pago':
            raise FinanceiroServiceError("Conta já está paga")
        
        if conta_pagar.status == 'Cancelado':
            raise FinanceiroServiceError("Não é possível baixar conta cancelada")
        
        # Atualizar valores
        conta_pagar.valor_pago += valor_pago
        conta_pagar.data_pagamento = data_pagamento
        
        if forma_pagamento:
            conta_pagar.forma_pagamento = forma_pagamento
        
        if observacoes:
            conta_pagar.observacoes = f"{conta_pagar.observacoes or ''}\n{observacoes}".strip()
        
        # O save() já atualiza status automaticamente
        conta_pagar.save()
        
        return conta_pagar

