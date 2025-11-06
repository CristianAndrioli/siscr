# cadastros/views.py
# Views movidas de core/views.py

from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.db.models import Max
from django.contrib import messages
from django.db import models
from .models import Pessoa, Produto, Servico
from .forms import PessoaForm, ProdutoForm, ServicoForm


# ===============================================
# FUNÇÕES AUXILIARES
# ===============================================

def _calcular_proximo_codigo_cadastro():
    """Função auxiliar para calcular o próximo código de pessoa."""
    max_id = Pessoa.objects.all().aggregate(max_id=Max('codigo_cadastro'))['max_id']
    return (max_id or 0) + 1


def _calcular_proximo_codigo_produto():
    """Função auxiliar para calcular o próximo código de produto."""
    max_id = Produto.objects.all().aggregate(max_id=Max('codigo_produto'))['max_id']
    return (max_id or 0) + 1


def _calcular_proximo_codigo_servico():
    """Função auxiliar para calcular o próximo código de serviço."""
    max_id = Servico.objects.all().aggregate(max_id=Max('codigo_servico'))['max_id']
    return (max_id or 0) + 1


# ===============================================
# CRUD PARA CADASTRO GERAL (PESSOA)
# ===============================================

@login_required
def cadastrar_geral(request, codigo_cadastro=None):
    """View para criar ou editar um cadastro geral (C/U)."""

    if codigo_cadastro:
        pessoa = get_object_or_404(Pessoa, codigo_cadastro=codigo_cadastro)
        editando = True
        page_title = f"Editar Cadastro: {pessoa.nome_completo or pessoa.razao_social}"
    else:
        pessoa = None
        editando = False
        page_title = "Cadastrar Nova Pessoa"

    if request.method == 'POST':
        form = PessoaForm(request.POST, instance=pessoa)

        if form.is_valid():
            try:
                form.save()
                acao = "atualizado" if editando else "cadastrado"
                messages.success(request, f'Cadastro {form.instance.nome_completo or form.instance.razao_social} {acao} com sucesso!')

                if editando:
                    return redirect('cadastros:listagem_geral')
                return redirect('cadastros:cadastrar_geral') 
            except Exception as e:
                messages.error(request, f'Erro ao salvar o cadastro: {e}')
        else:
            messages.error(request, 'Erro de validação no formulário. Verifique os campos.')

    else: # GET
        if not editando:
            proximo_codigo = _calcular_proximo_codigo_cadastro()
            form = PessoaForm(initial={'codigo_cadastro': proximo_codigo})
        else:
            form = PessoaForm(instance=pessoa)

    contexto = {
        'form': form,
        'editando': editando,
        'pessoa': pessoa,
        'page_title': page_title
    }
    # Usa template do core temporariamente (até mover completamente)
    return render(request, 'cadastro_geral.html', contexto)


@login_required
def excluir_cadastro(request, codigo_cadastro):
    """View para excluir um cadastro (DELETE)."""
    pessoa = get_object_or_404(Pessoa, codigo_cadastro=codigo_cadastro)

    if request.method == 'POST':
        nome = pessoa.nome_completo or pessoa.razao_social
        pessoa.delete()
        messages.success(request, f'Cadastro de {nome} excluído com sucesso.')
        return redirect('cadastros:listagem_geral')

    messages.error(request, 'A exclusão deve ser feita via POST.')
    return redirect('cadastros:listagem_geral')


@login_required
def listagem_geral(request):
    """View para listar e buscar cadastros gerais (Pessoas) (READ)."""
    termo_busca = request.GET.get('q')

    if termo_busca:
        pessoas = Pessoa.objects.filter(
            models.Q(cpf_cnpj__icontains=termo_busca) |
            models.Q(nome_completo__icontains=termo_busca) |
            models.Q(razao_social__icontains=termo_busca)
        ).order_by('codigo_cadastro')
    else:
        pessoas = Pessoa.objects.all().order_by('codigo_cadastro')

    contexto = {
        'pessoas': pessoas,
        'termo_busca': termo_busca
    }
    # Usa template do core temporariamente
    return render(request, 'listagem_geral.html', contexto)


# ===============================================
# CRUD PARA PRODUTOS
# ===============================================

@login_required
def cadastrar_produtos(request):
    """View para criar um novo produto (CREATE)."""
    
    if request.method == 'POST':
        form = ProdutoForm(request.POST)
        
        if form.is_valid():
            try:
                form.save()
                messages.success(request, f'Produto "{form.instance.nome}" cadastrado com sucesso!')
                return redirect('cadastros:cadastrar_produtos')
            except Exception as e:
                messages.error(request, f'Erro ao salvar o produto: {e}')
        else:
            messages.error(request, 'Erro de validação no formulário. Verifique os campos.')
            
    else: # GET
        proximo_codigo = _calcular_proximo_codigo_produto()
        form = ProdutoForm(initial={'codigo_produto': proximo_codigo})

    contexto = {
        'form': form,
        'proximo_codigo': form.initial.get('codigo_produto', 0)
    }
    # Usa template do core temporariamente
    return render(request, 'cadastro_produtos.html', contexto)


@login_required
def editar_produto(request, codigo_produto):
    """View para editar um produto existente (UPDATE)."""
    produto = get_object_or_404(Produto, codigo_produto=codigo_produto)

    if request.method == 'POST':
        form = ProdutoForm(request.POST, instance=produto)
        
        if form.is_valid():
            form.save()
            messages.success(request, f'Produto "{produto.nome}" atualizado com sucesso!')
            return redirect('cadastros:listagem_produtos')
        else:
            messages.error(request, 'Erro de validação ao editar. Verifique os campos.')
            
    else: # GET
        form = ProdutoForm(instance=produto)

    contexto = {
        'form': form,
        'produto': produto,
        'editando': True
    }
    # Usa template do core temporariamente
    return render(request, 'cadastro_produtos.html', contexto)


@login_required
def excluir_produto(request, codigo_produto):
    """View para excluir um produto (DELETE)."""
    produto = get_object_or_404(Produto, codigo_produto=codigo_produto)
    
    if request.method == 'POST':
        produto_nome = produto.nome
        produto.delete()
        messages.success(request, f'Produto "{produto_nome}" excluído com sucesso.')
        return redirect('cadastros:listagem_produtos')
        
    messages.error(request, 'A exclusão deve ser feita via POST.')
    return redirect('cadastros:listagem_produtos')


@login_required
def listagem_produtos(request):
    """View para listar e buscar produtos (READ)."""
    termo_busca = request.GET.get('q')
    
    if termo_busca:
        produtos = Produto.objects.filter(
            models.Q(nome__icontains=termo_busca) |
            models.Q(codigo_ncm__icontains=termo_busca)
        ).order_by('nome')
    else:
        produtos = Produto.objects.all().order_by('nome')

    contexto = {
        'produtos': produtos,
        'termo_busca': termo_busca
    }
    # Usa template do core temporariamente
    return render(request, 'listagem_produtos.html', contexto)


# ===============================================
# CRUD PARA SERVIÇOS
# ===============================================

@login_required
def cadastrar_servicos(request):
    """View para criar um novo serviço (CREATE)."""
    
    if request.method == 'POST':
        form = ServicoForm(request.POST)
        
        if form.is_valid():
            try:
                form.save()
                messages.success(request, f'Serviço "{form.instance.nome}" cadastrado com sucesso!')
                return redirect('cadastros:cadastrar_servicos')
            except Exception as e:
                messages.error(request, f'Erro ao salvar o serviço: {e}')
        else:
            messages.error(request, 'Erro de validação no formulário. Verifique os campos.')
            
    else: # GET
        proximo_codigo = _calcular_proximo_codigo_servico()
        form = ServicoForm(initial={'codigo_servico': proximo_codigo}) 

    contexto = {
        'form': form,
        'proximo_codigo': form.initial.get('codigo_servico', 0)
    }
    # Usa template do core temporariamente
    return render(request, 'cadastro_servicos.html', contexto)


@login_required
def editar_servico(request, codigo_servico):
    """View para editar um serviço existente (UPDATE)."""
    servico = get_object_or_404(Servico, codigo_servico=codigo_servico)

    if request.method == 'POST':
        form = ServicoForm(request.POST, instance=servico)
        
        if form.is_valid():
            form.save()
            messages.success(request, f'Serviço "{servico.nome}" atualizado com sucesso!')
            return redirect('cadastros:listagem_servicos')
        else:
            messages.error(request, 'Erro de validação ao editar. Verifique os campos.')
            
    else: # GET
        form = ServicoForm(instance=servico)

    contexto = {
        'form': form,
        'servico': servico,
        'editando': True 
    }
    # Usa template do core temporariamente
    return render(request, 'cadastro_servicos.html', contexto)


@login_required
def excluir_servico(request, codigo_servico):
    """View para excluir um serviço (DELETE)."""
    servico = get_object_or_404(Servico, codigo_servico=codigo_servico)
    
    if request.method == 'POST':
        servico_nome = servico.nome
        servico.delete()
        messages.success(request, f'Serviço "{servico_nome}" excluído com sucesso.')
        return redirect('cadastros:listagem_servicos')
        
    messages.error(request, 'A exclusão deve ser feita via POST.')
    return redirect('cadastros:listagem_servicos')


@login_required
def listagem_servicos(request):
    """View para listar e buscar serviços (READ)."""
    termo_busca = request.GET.get('q')
    
    if termo_busca:
        servicos = Servico.objects.filter(
            models.Q(nome__icontains=termo_busca) |
            models.Q(tipo_contrato__icontains=termo_busca)
        ).order_by('nome')
    else:
        servicos = Servico.objects.all().order_by('nome')

    contexto = {
        'servicos': servicos,
        'termo_busca': termo_busca
    }
    # Usa template do core temporariamente
    return render(request, 'listagem_servicos.html', contexto)


# ===============================================
# APIs AUXILIARES (AJAX/FETCH)
# ===============================================

@login_required
def buscar_cadastro(request):
    """API auxiliar para buscar cadastro por código."""
    codigo = request.GET.get('codigo')
    if not codigo:
        return JsonResponse({'encontrado': False, 'erro': 'Código não fornecido'}, status=400)
    
    try:
        pessoa = Pessoa.objects.get(codigo_cadastro=codigo)
        data = {
            'encontrado': True, 
            'cadastro': {
                'codigo_cadastro': pessoa.codigo_cadastro,
                'tipo': pessoa.tipo,
                'cpf_cnpj': pessoa.cpf_cnpj,
                'nome_completo': pessoa.nome_completo,
                'razao_social': pessoa.razao_social,
                'email': pessoa.email,
            }
        }
        return JsonResponse(data)
    except Pessoa.DoesNotExist:
        return JsonResponse({'encontrado': False})
    except Exception as e:
        return JsonResponse({'encontrado': False, 'erro': str(e)}, status=500)


@login_required
def buscar_fornecedor(request):
    """API auxiliar para buscar fornecedor por código."""
    codigo = request.GET.get('codigo')
    if not codigo:
        return JsonResponse({'encontrado': False, 'erro': 'Código não fornecido'}, status=400)
    try:
        pessoa = Pessoa.objects.get(codigo_cadastro=codigo, tipo='fornecedor')
        return JsonResponse({'encontrado': True, 'nome': pessoa.nome_completo or pessoa.razao_social})
    except Pessoa.DoesNotExist:
        return JsonResponse({'encontrado': False})
