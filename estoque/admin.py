"""
Admin para o módulo de Estoque
"""
from django.contrib import admin
from .models import Location, Estoque, MovimentacaoEstoque, ReservaEstoque, PrevisaoMovimentacao, GrupoFilial


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


@admin.register(ReservaEstoque)
class ReservaEstoqueAdmin(admin.ModelAdmin):
    list_display = ['tipo', 'origem', 'produto', 'location', 'quantidade', 'status', 
                   'data_expiracao', 'created_at']
    list_filter = ['tipo', 'origem', 'status', 'created_at']
    search_fields = ['estoque__produto__nome', 'documento_referencia', 'observacoes']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('estoque', 'tipo', 'origem', 'status')
        }),
        ('Quantidade', {
            'fields': ('quantidade',)
        }),
        ('Datas', {
            'fields': ('data_expiracao',)
        }),
        ('Referências', {
            'fields': ('documento_referencia',)
        }),
        ('Observações', {
            'fields': ('observacoes',)
        }),
        ('Auditoria', {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by', 'owner'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['confirmar_reservas', 'cancelar_reservas', 'expirar_reservas']
    
    def produto(self, obj):
        """Retorna nome do produto"""
        return obj.estoque.produto.nome if obj.estoque else '-'
    produto.short_description = 'Produto'
    
    def location(self, obj):
        """Retorna nome da location"""
        return obj.estoque.location.nome if obj.estoque else '-'
    location.short_description = 'Location'
    
    def confirmar_reservas(self, request, queryset):
        """Ação para confirmar reservas selecionadas"""
        count = 0
        for reserva in queryset.filter(status='ATIVA'):
            try:
                reserva.confirmar()
                count += 1
            except Exception as e:
                self.message_user(request, f'Erro ao confirmar reserva {reserva.id}: {str(e)}', level='ERROR')
        self.message_user(request, f'{count} reserva(s) confirmada(s) com sucesso.')
    confirmar_reservas.short_description = 'Confirmar reservas selecionadas'
    
    def cancelar_reservas(self, request, queryset):
        """Ação para cancelar reservas selecionadas"""
        count = 0
        for reserva in queryset.exclude(status__in=['CANCELADA', 'EXPIRADA']):
            try:
                reserva.cancelar()
                count += 1
            except Exception as e:
                self.message_user(request, f'Erro ao cancelar reserva {reserva.id}: {str(e)}', level='ERROR')
        self.message_user(request, f'{count} reserva(s) cancelada(s) com sucesso.')
    cancelar_reservas.short_description = 'Cancelar reservas selecionadas'
    
    def expirar_reservas(self, request, queryset):
        """Ação para expirar reservas SOFT selecionadas"""
        count = 0
        for reserva in queryset.filter(tipo='SOFT', status='ATIVA'):
            try:
                reserva.expirar()
                count += 1
            except Exception as e:
                self.message_user(request, f'Erro ao expirar reserva {reserva.id}: {str(e)}', level='ERROR')
        self.message_user(request, f'{count} reserva(s) expirada(s) com sucesso.')
    expirar_reservas.short_description = 'Expirar reservas SOFT selecionadas'


@admin.register(PrevisaoMovimentacao)
class PrevisaoMovimentacaoAdmin(admin.ModelAdmin):
    list_display = ['tipo', 'origem', 'produto', 'location', 'quantidade', 'status', 
                   'data_prevista', 'created_at']
    list_filter = ['tipo', 'origem', 'status', 'data_prevista']
    search_fields = ['estoque__produto__nome', 'documento_referencia', 'observacoes']
    readonly_fields = ['movimentacao_realizada', 'created_at', 'updated_at', 
                      'created_by', 'updated_by']
    date_hierarchy = 'data_prevista'
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('estoque', 'tipo', 'origem', 'status')
        }),
        ('Quantidade e Valor', {
            'fields': ('quantidade', 'valor_unitario_previsto')
        }),
        ('Data', {
            'fields': ('data_prevista',)
        }),
        ('Transferências', {
            'fields': ('location_origem', 'location_destino'),
            'classes': ('collapse',)
        }),
        ('Referências', {
            'fields': ('documento_referencia', 'movimentacao_realizada')
        }),
        ('Observações', {
            'fields': ('observacoes',)
        }),
        ('Auditoria', {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by', 'owner'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['confirmar_previsoes', 'cancelar_previsoes']
    
    def produto(self, obj):
        """Retorna nome do produto"""
        return obj.estoque.produto.nome if obj.estoque else '-'
    produto.short_description = 'Produto'
    
    def location(self, obj):
        """Retorna nome da location"""
        return obj.estoque.location.nome if obj.estoque else '-'
    location.short_description = 'Location'
    
    def confirmar_previsoes(self, request, queryset):
        """Ação para confirmar previsões selecionadas"""
        count = 0
        for previsao in queryset.filter(status='PENDENTE'):
            try:
                previsao.confirmar()
                count += 1
            except Exception as e:
                self.message_user(request, f'Erro ao confirmar previsão {previsao.id}: {str(e)}', level='ERROR')
        self.message_user(request, f'{count} previsão(ões) confirmada(s) com sucesso.')
    confirmar_previsoes.short_description = 'Confirmar previsões selecionadas'
    
    def cancelar_previsoes(self, request, queryset):
        """Ação para cancelar previsões selecionadas"""
        count = 0
        for previsao in queryset.exclude(status__in=['CANCELADA', 'REALIZADA']):
            try:
                previsao.cancelar()
                count += 1
            except Exception as e:
                self.message_user(request, f'Erro ao cancelar previsão {previsao.id}: {str(e)}', level='ERROR')
        self.message_user(request, f'{count} previsão(ões) cancelada(s) com sucesso.')
    cancelar_previsoes.short_description = 'Cancelar previsões selecionadas'


@admin.register(GrupoFilial)
class GrupoFilialAdmin(admin.ModelAdmin):
    list_display = ['nome', 'codigo', 'empresa', 'regra_alocacao', 'permite_fulfillment_cruzado', 
                   'is_active', 'created_at']
    list_filter = ['empresa', 'regra_alocacao', 'permite_fulfillment_cruzado', 'is_active']
    search_fields = ['nome', 'codigo', 'empresa__nome']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
    filter_horizontal = ['filiais']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('empresa', 'nome', 'codigo')
        }),
        ('Filiais', {
            'fields': ('filiais',)
        }),
        ('Configurações', {
            'fields': ('regra_alocacao', 'permite_fulfillment_cruzado', 'is_active')
        }),
        ('Auditoria', {
            'fields': ('created_at', 'updated_at', 'created_by', 'updated_by', 'owner'),
            'classes': ('collapse',)
        }),
    )
