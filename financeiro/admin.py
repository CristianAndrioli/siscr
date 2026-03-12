"""
Admin para modelos do app financeiro
"""
from django.contrib import admin
from .models import ContaReceber, ContaPagar, Boleto, TransacaoPagamento


@admin.register(ContaReceber)
class ContaReceberAdmin(admin.ModelAdmin):
    list_display = (
        'codigo_conta', 'numero_documento', 'cliente', 'empresa', 'filial',
        'valor_total', 'valor_recebido', 'valor_pendente', 'data_vencimento', 'status'
    )
    list_filter = ('status', 'forma_pagamento', 'data_vencimento', 'empresa', 'filial')
    search_fields = (
        'codigo_conta', 'numero_documento', 'cliente__razao_social',
        'cliente__nome_fantasia', 'descricao'
    )
    readonly_fields = ('codigo_conta', 'valor_pendente', 'created_at', 'updated_at')
    date_hierarchy = 'data_vencimento'
    raw_id_fields = ('cliente', 'nota_fiscal', 'pedido_venda')


@admin.register(ContaPagar)
class ContaPagarAdmin(admin.ModelAdmin):
    list_display = (
        'codigo_conta', 'numero_documento', 'fornecedor', 'empresa', 'filial',
        'valor_total', 'valor_pago', 'valor_pendente', 'data_vencimento', 'status'
    )
    list_filter = ('status', 'forma_pagamento', 'data_vencimento', 'empresa', 'filial')
    search_fields = (
        'codigo_conta', 'numero_documento', 'fornecedor__razao_social',
        'fornecedor__nome_fantasia', 'descricao'
    )
    readonly_fields = ('codigo_conta', 'valor_pendente', 'created_at', 'updated_at')
    date_hierarchy = 'data_vencimento'
    raw_id_fields = ('fornecedor', 'nota_fiscal_entrada')


@admin.register(Boleto)
class BoletoAdmin(admin.ModelAdmin):
    list_display = (
        'nosso_numero', 'conta_receber', 'gateway', 'status',
        'data_vencimento', 'data_pagamento', 'valor'
    )
    list_filter = ('status', 'gateway', 'data_vencimento')
    search_fields = ('nosso_numero', 'codigo_barras', 'linha_digitavel', 'gateway_id')
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields = ('conta_receber',)
    
    def valor(self, obj):
        return obj.conta_receber.valor_total
    valor.short_description = 'Valor'


@admin.register(TransacaoPagamento)
class TransacaoPagamentoAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'conta_receber', 'gateway', 'metodo_pagamento',
        'valor', 'valor_liquido', 'taxa_gateway', 'status', 'data_pagamento'
    )
    list_filter = ('status', 'gateway', 'metodo_pagamento', 'data_pagamento')
    search_fields = ('gateway_transaction_id', 'conta_receber__numero_documento')
    readonly_fields = ('created_at', 'updated_at')
    raw_id_fields = ('conta_receber',)
