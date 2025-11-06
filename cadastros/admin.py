# cadastros/admin.py
# Admin para modelos do app cadastros

from django.contrib import admin
from .models import Pessoa, Produto, Servico


@admin.register(Pessoa)
class PessoaAdmin(admin.ModelAdmin):
    list_display = ('codigo_cadastro', 'nome_completo', 'razao_social', 'tipo', 'cpf_cnpj', 'cidade', 'estado')
    list_filter = ('tipo', 'estado', 'contribuinte')
    search_fields = ('codigo_cadastro', 'nome_completo', 'razao_social', 'cpf_cnpj', 'email')
    readonly_fields = ('codigo_cadastro',)


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = ('codigo_produto', 'nome', 'valor_custo', 'valor_venda', 'codigo_ncm', 'ativo')
    list_filter = ('ativo', 'origem_mercadoria', 'unidade_medida')
    search_fields = ('codigo_produto', 'nome', 'codigo_ncm', 'descricao')
    readonly_fields = ('codigo_produto',)


@admin.register(Servico)
class ServicoAdmin(admin.ModelAdmin):
    list_display = ('codigo_servico', 'nome', 'valor_base', 'tipo_contrato', 'ativo')
    list_filter = ('ativo', 'tipo_contrato', 'icms_tributado')
    search_fields = ('codigo_servico', 'nome', 'descricao')
    readonly_fields = ('codigo_servico',)
