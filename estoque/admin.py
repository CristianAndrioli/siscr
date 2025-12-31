"""
Admin para o módulo de Estoque
"""
from django.contrib import admin
from .models import Location, Estoque, MovimentacaoEstoque


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ['nome', 'codigo', 'tipo', 'empresa', 'filial', 'cidade', 'estado', 'is_active']
    list_filter = ['tipo', 'is_active', 'empresa', 'estado']
    search_fields = ['nome', 'codigo', 'cidade', 'empresa__nome']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('empresa', 'filial', 'nome', 'codigo', 'tipo')
        }),
        ('Endereço', {
            'fields': ('logradouro', 'numero', 'letra', 'complemento', 'bairro', 'cidade', 'estado', 'cep')
        }),
        ('Coordenadas', {
            'fields': ('latitude', 'longitude'),
            'classes': ('collapse',)
        }),
        ('Contato', {
            'fields': ('responsavel', 'telefone', 'email')
        }),
        ('Configurações', {
            'fields': ('permite_entrada', 'permite_saida', 'permite_transferencia', 'is_active')
        }),
        ('Auditoria', {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by', 'owner'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Estoque)
class EstoqueAdmin(admin.ModelAdmin):
    list_display = ['produto', 'location', 'quantidade_atual', 'quantidade_reservada', 
                   'quantidade_disponivel', 'valor_custo_medio', 'estoque_minimo', 'is_deleted']
    list_filter = ['empresa', 'location__tipo', 'is_deleted']
    search_fields = ['produto__nome', 'location__nome', 'produto__codigo_produto']
    readonly_fields = ['quantidade_disponivel', 'valor_total', 'created_at', 'updated_at', 
                      'created_by', 'updated_by']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('produto', 'location', 'empresa', 'localizacao_interna')
        }),
        ('Quantidades', {
            'fields': ('quantidade_atual', 'quantidade_reservada', 'quantidade_disponivel',
                      'quantidade_prevista_entrada', 'quantidade_prevista_saida')
        }),
        ('Valores', {
            'fields': ('valor_custo_medio', 'valor_total')
        }),
        ('Controle', {
            'fields': ('estoque_minimo', 'estoque_maximo')
        }),
        ('Auditoria', {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by', 'owner', 'is_deleted'),
            'classes': ('collapse',)
        }),
    )


@admin.register(MovimentacaoEstoque)
class MovimentacaoEstoqueAdmin(admin.ModelAdmin):
    list_display = ['tipo', 'origem', 'produto', 'location', 'quantidade', 'valor_total', 
                   'status', 'data_movimentacao']
    list_filter = ['tipo', 'origem', 'status', 'data_movimentacao']
    search_fields = ['estoque__produto__nome', 'documento_referencia', 'numero_nota_fiscal']
    readonly_fields = ['quantidade_posterior', 'valor_total', 'data_movimentacao', 
                      'created_at', 'updated_at', 'created_by', 'updated_by']
    date_hierarchy = 'data_movimentacao'
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('estoque', 'tipo', 'origem', 'status')
        }),
        ('Quantidades e Valores', {
            'fields': ('quantidade', 'quantidade_anterior', 'quantidade_posterior',
                      'valor_unitario', 'valor_total')
        }),
        ('Transferências', {
            'fields': ('location_origem', 'location_destino'),
            'classes': ('collapse',)
        }),
        ('Referências', {
            'fields': ('documento_referencia', 'numero_nota_fiscal', 'serie_nota_fiscal',
                      'movimentacao_original', 'motivo_cancelamento')
        }),
        ('Datas', {
            'fields': ('data_movimentacao', 'data_prevista')
        }),
        ('Observações', {
            'fields': ('observacoes',)
        }),
        ('Auditoria', {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by', 'owner'),
            'classes': ('collapse',)
        }),
    )
    
    def produto(self, obj):
        """Retorna nome do produto"""
        return obj.estoque.produto.nome if obj.estoque else '-'
    produto.short_description = 'Produto'
    
    def location(self, obj):
        """Retorna nome da location"""
        return obj.estoque.location.nome if obj.estoque else '-'
    location.short_description = 'Location'
