# cadastros/forms.py
# Forms movidos de core/forms.py

from django import forms
from django.forms import ModelForm
from .models import Pessoa, Produto, Servico


# ===============================================
# 1. FORMS PARA CADASTRO GERAL (PESSOA)
# ===============================================

class PessoaForm(ModelForm):
    class Meta:
        model = Pessoa
        fields = [
            'codigo_cadastro', 
            'tipo', 
            'cpf_cnpj', 
            'nome_completo', 
            'razao_social', 
            'nome_fantasia', 
            'inscricao_estadual', 
            'contribuinte', 
            'logradouro', 
            'numero', 
            'letra', 
            'complemento', 
            'bairro', 
            'cidade', 
            'estado', 
            'cep', 
            'nome_contato', 
            'telefone_fixo', 
            'telefone_celular', 
            'email', 
            'cargo', 
            'comissoes',
            'observacoes'
        ]
        
        widgets = {
            'codigo_cadastro': forms.TextInput(attrs={'readonly': 'readonly', 'class': 'bg-gray-100'}),
            'cpf_cnpj': forms.TextInput(attrs={'class': 'form-control'}),
            'nome_completo': forms.TextInput(attrs={'class': 'form-control'}),
            'razao_social': forms.TextInput(attrs={'class': 'form-control'}),
        }


# ===============================================
# 2. FORMS PARA CADASTRO DE SERVIÇOS
# ===============================================

class ServicoForm(forms.ModelForm):
    class Meta:
        model = Servico
        fields = [
            'codigo_servico', 'nome', 'descricao', 'ativo', 
            'valor_base', 'tipo_contrato', 'prazo_execucao', 'valor_impostos_estimado',
            'codigo_ncm', 'cfop', 'tributacao_pis', 'tributacao_cofins', 'icms_tributado'
        ]
        
        widgets = {
            'codigo_servico': forms.NumberInput(attrs={'class': 'form-control', 'readonly': 'readonly'}),
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'ativo': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'valor_base': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'tipo_contrato': forms.Select(attrs={'class': 'form-control'}),
            'prazo_execucao': forms.NumberInput(attrs={'class': 'form-control'}),
            'valor_impostos_estimado': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'codigo_ncm': forms.TextInput(attrs={'class': 'form-control'}),
            'cfop': forms.TextInput(attrs={'class': 'form-control'}),
            'tributacao_pis': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'tributacao_cofins': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'icms_tributado': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }


# ===============================================
# 3. FORMS PARA CADASTRO DE PRODUTOS
# ===============================================

class ProdutoForm(forms.ModelForm):
    class Meta:
        model = Produto
        fields = [
            'codigo_produto', 'nome', 'descricao', 'ativo', 
            'valor_custo', 'valor_venda', 'unidade_medida', 'peso_liquido', 'peso_bruto',
            'codigo_ncm', 'cfop_interno', 'origem_mercadoria', 'cst_icms', 'aliquota_icms', 'aliquota_ipi',
            'codigo_di', 'incoterm', 'moeda_negociacao', 'aliquota_ii'
        ]
        
        widgets = {
            'codigo_produto': forms.NumberInput(attrs={'class': 'form-control', 'readonly': 'readonly'}),
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'ativo': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'valor_custo': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'valor_venda': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'unidade_medida': forms.Select(attrs={'class': 'form-control'}),
            'peso_liquido': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.001'}),
            'peso_bruto': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.001'}),
            'codigo_ncm': forms.TextInput(attrs={'class': 'form-control'}),
            'cfop_interno': forms.TextInput(attrs={'class': 'form-control'}),
            'origem_mercadoria': forms.Select(attrs={'class': 'form-control'}),
            'cst_icms': forms.TextInput(attrs={'class': 'form-control'}),
            'aliquota_icms': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'aliquota_ipi': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'codigo_di': forms.TextInput(attrs={'class': 'form-control'}),
            'incoterm': forms.TextInput(attrs={'class': 'form-control'}),
            'moeda_negociacao': forms.Select(attrs={'class': 'form-control'}),
            'aliquota_ii': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
        }
