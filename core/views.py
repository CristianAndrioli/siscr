# C:\siscr\core\views.py - Certifique-se de ter todas essas importações
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.http import JsonResponse
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.db.models import Max
from django.contrib import messages
from django.db import models
# Models e Forms movidos para cadastros app
from cadastros.models import Pessoa, Servico, Produto
from cadastros.forms import PessoaForm, ServicoForm, ProdutoForm


# ----------------------------
# Views Principais
# ----------------------------

# Se a URL raiz (/) cair aqui, redireciona para o dashboard
def index(request):
    return redirect(reverse('core:dashboard')) 

# Se você deseja proteger o dashboard, use o decorador:
@login_required 
def dashboard(request):
    return render(request, 'dashboard.html')

@login_required
def financeiro(request):
    return render(request, 'financeiro.html')

@login_required
def servico_logistico(request):
    return render(request, 'servico_logistico.html')

# ----------------------------------------------------
# 2. FUNÇÕES DE CRUD PARA SERVIÇOS
# ----------------------------------------------------

def _calcular_proximo_codigo_servico():
    """Função auxiliar para calcular o próximo código de serviço."""
    # Assumindo que Servico.codigo_servico é a PK/código de controle
    max_id = Servico.objects.all().aggregate(max_id=Max('codigo_servico'))['max_id']
    return (max_id or 0) + 1

def cadastrar_servicos(request):
    """View para criar um novo serviço (CREATE)."""
    
    if request.method == 'POST':
        form = ServicoForm(request.POST)
        
        if form.is_valid():
            try:
                form.save()
                messages.success(request, f'Serviço "{form.instance.nome}" cadastrado com sucesso!')
                return redirect('core:cadastrar_servicos')
            except Exception as e:
                messages.error(request, f'Erro ao salvar o serviço: {e}')
        else:
            messages.error(request, 'Erro de validação no formulário. Verifique os campos.')
            
    else: # GET
        proximo_codigo = _calcular_proximo_codigo_servico()
        # Aqui, você precisa garantir que seu ServicoForm aceite um campo chamado 'codigo_servico'
        # e que o modelo Servico tenha um campo chamado 'codigo_servico' (integer/PK).
        form = ServicoForm(initial={'codigo_servico': proximo_codigo}) 

    contexto = {
        'form': form,
        'proximo_codigo': form.initial.get('codigo_servico', 0)
    }

    # Você precisa ter um template chamado 'cadastro_servicos.html'
    return render(request, 'cadastro_servicos.html', contexto)


def editar_servico(request, codigo_servico):
    """View para editar um serviço existente (UPDATE)."""
    produto = get_object_or_404(Servico, codigo_servico=codigo_servico)

    if request.method == 'POST':
        form = ServicoForm(request.POST, instance=produto)
        
        if form.is_valid():
            form.save()
            messages.success(request, f'Serviço "{produto.nome}" atualizado com sucesso!')
            return redirect('core:listagem_servicos') # Redireciona para a listagem
        else:
            messages.error(request, 'Erro de validação ao editar. Verifique os campos.')
            
    else: # GET
        form = ServicoForm(instance=produto)

    contexto = {
        'form': form,
        'servico': produto,
        'editando': True 
    }
    # Reutiliza o mesmo template de cadastro
    return render(request, 'cadastro_servicos.html', contexto)


def excluir_servico(request, codigo_servico):
    """View para excluir um serviço (DELETE)."""
    servico = get_object_or_404(Servico, codigo_servico=codigo_servico)
    
    if request.method == 'POST':
        servico_nome = servico.nome
        servico.delete()
        messages.success(request, f'Serviço "{servico_nome}" excluído com sucesso.')
        return redirect('core:listagem_servicos') # Redireciona para a listagem
        
    messages.error(request, 'A exclusão deve ser feita via POST.')
    return redirect('core:listagem_servicos')


def listagem_servicos(request):
    """View para listar e buscar serviços (READ)."""
    
    termo_busca = request.GET.get('q')
    
    if termo_busca:
        # Filtra por nome ou tipo de contrato
        servicos = Servico.objects.filter(
            models.Q(nome__icontains=termo_busca) |
            models.Q(tipo_contrato__icontains=termo_busca)
        ).order_by('nome')
    else:
        # Lista todos
        servicos = Servico.objects.all().order_by('nome')

    contexto = {
        'servicos': servicos,
        'termo_busca': termo_busca
    }
    
    return render(request, 'listagem_servicos.html', contexto) # Novo template

# ----------------------------
# Login e Logout (Implementação Django Standard)
# ----------------------------
def login(request): # <-- FUNÇÃO QUE ESTAVA FALTANDO
    if request.method == 'POST':
        usuario = request.POST.get('username') # 'usuario' no seu DB, Django usa 'username'
        senha = request.POST.get('password') # 'senha'
        
        # 1. Tenta autenticar o usuário
        user = authenticate(request, username=usuario, password=senha)
        
        if user is not None:
            # 2. Se autenticado, faz login e redireciona
            auth_login(request, user)
            return redirect(reverse('core:dashboard')) 
        else:
            # 3. Se falhar, exibe uma mensagem de erro
            messages.error(request, 'Usuário ou senha inválidos.')
            
    # Renderiza o template de login para requisições GET ou falhas POST
    return render(request, 'login.html')

def logout(request): # <-- FUNÇÃO NECESSÁRIA PARA A ROTA
    auth_logout(request)
    # Redireciona para a página de login após o logout
    return redirect(reverse('core:login'))

# ... (Mantenha o resto das suas views, como cadastrar_geral, buscar_cadastro, etc.)

def perfil(request):
    return render(request, 'perfil.html')

def logout(request):
    # Lógica de logout do Django
    messages.info(request, "Logout realizado com sucesso!")
    return redirect(reverse('core:login'))


# ----------------------------------------------------
# 3. FUNÇÕES DE CRUD PARA CADASTRO GERAL (PESSOA)
# ----------------------------------------------------

def _calcular_proximo_codigo_cadastro():
    """Função auxiliar para calcular o próximo código de pessoa."""
    max_id = Pessoa.objects.all().aggregate(max_id=Max('codigo_cadastro'))['max_id']
    return (max_id or 0) + 1

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
        # 1. Tenta preencher o formulário com os dados do POST
        form = PessoaForm(request.POST, instance=pessoa)

        if form.is_valid():
            try:
                # 2. Salva o objeto
                form.save()
                acao = "atualizado" if editando else "cadastrado"
                messages.success(request, f'Cadastro {form.instance.nome_completo or form.instance.razao_social} {acao} com sucesso!')

                if editando:
                    # Redireciona para a lista após editar
                    return redirect('core:listagem_geral')
                # Redireciona para um novo formulário limpo após criar
                return redirect('core:cadastrar_geral') 
            except Exception as e:
                messages.error(request, f'Erro ao salvar o cadastro: {e}')
        else:
            messages.error(request, 'Erro de validação no formulário. Verifique os campos.')

    else: # GET
        if not editando:
            proximo_codigo = _calcular_proximo_codigo_cadastro()
            form = PessoaForm(initial={'codigo_cadastro': proximo_codigo})
        else:
            form = PessoaForm(instance=pessoa) # Carrega os dados da pessoa para edição

    contexto = {
        'form': form,
        'editando': editando,
        'pessoa': pessoa,
        'page_title': page_title
    }
    # Renderiza o template de cadastro/edição
    return render(request, 'cadastro_geral.html', contexto)


def excluir_cadastro(request, codigo_cadastro):
    """View para excluir um cadastro (DELETE)."""
    pessoa = get_object_or_404(Pessoa, codigo_cadastro=codigo_cadastro)

    if request.method == 'POST':
        nome = pessoa.nome_completo or pessoa.razao_social
        pessoa.delete()
        messages.success(request, f'Cadastro de {nome} excluído com sucesso.')
        return redirect('core:listagem_geral')

    messages.error(request, 'A exclusão deve ser feita via POST.')
    return redirect('core:listagem_geral')


def listagem_geral(request):
    """View para listar e buscar cadastros gerais (Pessoas) (READ)."""

    termo_busca = request.GET.get('q')

    if termo_busca:
        # Filtra por CPF/CNPJ, Nome Completo ou Razão Social
        pessoas = Pessoa.objects.filter(
            models.Q(cpf_cnpj__icontains=termo_busca) |
            models.Q(nome_completo__icontains=termo_busca) |
            models.Q(razao_social__icontains=termo_busca)
        ).order_by('codigo_cadastro')
    else:
        # Lista todos
        pessoas = Pessoa.objects.all().order_by('codigo_cadastro')

    contexto = {
        'pessoas': pessoas,
        'termo_busca': termo_busca
    }

    return render(request, 'listagem_geral.html', contexto)


# ----------------------------
# Outras Views (Placeholders para as demais rotas)
# ----------------------------
# *Para as demais funções, criamos placeholders que apenas renderizam o template.
# *A lógica de CRUD será migrada na sequência!

def contas_a_receber(request): return render(request, 'contas_a_receber.html')
def contas_a_pagar(request): return render(request, 'contas_a_pagar.html')
def faturamento(request): return render(request, 'faturamento.html')
def cotacoes(request): return render(request, 'cotacoesfaturamento.html')
def nfvenda(request): return render(request, 'nfvenda.html')
def nfse(request): return render(request, 'nfse.html')
def emitir_nfse(request): return redirect(reverse('core:nfse')) 
def lista_descricao_produtos_para_registro_di(request): return render(request, 'lista_descricao_produtos_para_registro_di.html')
def controle_processo(request): return render(request, 'ControleProcesso.html')
def check_list_processos_apacomex(request): return render(request, 'check_list_processos_apacomex.html')
def check_list_processos(request): return render(request, 'check_list_processos.html')
def cotacao_frete_internacional_rodoviario(request): return render(request, 'cotacao_frete_internacional_rodoviario.html')
def analise_fechamento_frete(request): return render(request, 'analise_fechamento_frete.html')
def solicitacao_estimativa_custos(request): return render(request, 'solicitacao_estimativa_custos.html')
def abertura_mex(request): return render(request, 'abertura_mex.html')
def lista_descricao_ncm(request): return render(request, 'lista_descricao_ncm.html')
def follow_up(request): return render(request, 'follow_up.html')
def assessoria_importacao_exportacao(request): return render(request, 'assessoria_importacao_exportacao.html')
def documentacao(request): return render(request, 'documentacaofluxo.html')
def despacho_aduaneiro(request): return render(request, 'despacho_aduaneiro.html')
def assessoria_cambial(request): return render(request, 'assessoria_cambial.html')
def habilitacoes_certificacoes(request): return render(request, 'habilitacoes_certificacoes.html')
def desenvolvimento_fornecedores(request): return render(request, 'desenvolvimento_fornecedores.html')
def cotacao_cambio(request): return render(request, 'cotacao_cambio.html')
def contrato(request): return render(request, 'contrato.html')
def monitoramento(request): return render(request, 'monitoramento.html')


# ----------------------------
# APIs Auxiliares (Substituem os Flask jsonify)
# ----------------------------

def buscar_cadastro(request):
    codigo = request.GET.get('codigo')
    if not codigo:
        return JsonResponse({'encontrado': False, 'erro': 'Código não fornecido'}, status=400)
    
    try:
        pessoa = Pessoa.objects.get(codigo_cadastro=codigo)
        # O Django não retorna o objeto completo em JSON por padrão, precisamos converter
        data = {
            'encontrado': True, 
            'cadastro': {
                'codigo_cadastro': pessoa.codigo_cadastro,
                'tipo': pessoa.tipo,
                'cpf_cnpj': pessoa.cpf_cnpj,
                'nome_completo': pessoa.nome_completo,
                'razao_social': pessoa.razao_social,
                'email': pessoa.email,
                # ... adicione todos os outros campos que seu JS espera ...
            }
        }
        return JsonResponse(data)
    except Pessoa.DoesNotExist:
        return JsonResponse({'encontrado': False})
    except Exception as e:
        return JsonResponse({'encontrado': False, 'erro': str(e)}, status=500)

def buscar_fornecedor(request):
    # A lógica aqui no Flask era: WHERE codigo_cadastro = %s AND tipo = 'fornecedor'
    codigo = request.GET.get('codigo')
    if not codigo: return JsonResponse({'encontrado': False, 'erro': 'Código não fornecido'}, status=400)
    try:
        pessoa = Pessoa.objects.get(codigo_cadastro=codigo, tipo='fornecedor')
        return JsonResponse({'encontrado': True, 'nome': pessoa.nome_completo or pessoa.razao_social})
    except Pessoa.DoesNotExist:
        return JsonResponse({'encontrado': False})


def buscar_conta_a_pagar(request): return JsonResponse({'encontrado': False, 'erro': 'Requer o modelo ContasPagar'})
def buscar_conta_a_receber(request): return JsonResponse({'encontrado': False, 'erro': 'Requer o modelo ContasReceber'})



# Models e Forms movidos para cadastros app
# Imports já estão no topo do arquivo

# ... (Outras views)

def _calcular_proximo_codigo_produto():
    """Função auxiliar para calcular o próximo código de produto."""
    max_id = Produto.objects.all().aggregate(max_id=Max('codigo_produto'))['max_id']
    return (max_id or 0) + 1

def cadastrar_produtos(request):
    """View para criar um novo produto (CREATE)."""
    
    if request.method == 'POST':
        # 1. Tenta preencher o formulário com os dados do POST
        form = ProdutoForm(request.POST)
        
        if form.is_valid():
            try:
                # 2. Salva o novo objeto no banco de dados
                form.save()
                messages.success(request, f'Produto "{form.instance.nome}" cadastrado com sucesso!')
                # 3. Redireciona para um novo formulário limpo
                return redirect('core:cadastrar_produtos')
            except Exception as e:
                # 4. Trata erros de banco de dados (ex: código duplicado)
                messages.error(request, f'Erro ao salvar o produto: {e}')
        else:
            # 5. Se o formulário for inválido, exibe erros
            messages.error(request, 'Erro de validação no formulário. Verifique os campos.')
            # O formulário com erros será passado para o template no contexto
            
    else: # GET
        # 6. Prepara o formulário para um novo cadastro
        proximo_codigo = _calcular_proximo_codigo_produto()
        form = ProdutoForm(initial={'codigo_produto': proximo_codigo})

    contexto = {
        'form': form,
        'proximo_codigo': form.initial.get('codigo_produto', 0)
    }

    return render(request, 'cadastro_produtos.html', contexto)


def editar_produto(request, codigo_produto):
    """View para editar um produto existente (UPDATE)."""
    # 1. Busca o produto ou retorna 404
    produto = get_object_or_404(Produto, codigo_produto=codigo_produto)

    if request.method == 'POST':
        # 2. Preenche o formulário com os dados do POST e o produto existente
        form = ProdutoForm(request.POST, instance=produto)
        
        if form.is_valid():
            form.save()
            messages.success(request, f'Produto "{produto.nome}" atualizado com sucesso!')
            # 3. Redireciona de volta para a listagem
            return redirect('core:listagem_produtos')
        else:
            messages.error(request, 'Erro de validação ao editar. Verifique os campos.')
            
    else: # GET
        # 4. Exibe o formulário preenchido com os dados do produto
        form = ProdutoForm(instance=produto)

    contexto = {
        'form': form,
        'produto': produto,
        'editando': True # Variável para indicar que é uma edição (opcional para o template)
    }
    # Reutiliza o mesmo template de cadastro
    return render(request, 'cadastro_produtos.html', contexto)


def excluir_produto(request, codigo_produto):
    """View para excluir um produto (DELETE)."""
    # 1. Busca o produto ou retorna 404
    produto = get_object_or_404(Produto, codigo_produto=codigo_produto)
    
    if request.method == 'POST':
        produto_nome = produto.nome
        # 2. Deleta o objeto
        produto.delete()
        messages.success(request, f'Produto "{produto_nome}" excluído com sucesso.')
        # 3. Redireciona para a listagem
        return redirect('core:listagem_produtos')
        
    # Se for GET (apenas para confirmar ou se usarmos um template de confirmação)
    # Por segurança, o ideal é que esta view só aceite POST.
    messages.error(request, 'A exclusão deve ser feita via POST.')
    return redirect('core:listagem_produtos')


def listagem_produtos(request):
    """View para listar e buscar produtos (READ)."""
    
    # 1. Busca o termo de pesquisa (opcional)
    termo_busca = request.GET.get('q')
    
    if termo_busca:
        # 2. Se houver termo, filtra os produtos (busca por nome ou código NCM)
        produtos = Produto.objects.filter(
            models.Q(nome__icontains=termo_busca) |
            models.Q(codigo_ncm__icontains=termo_busca)
        ).order_by('nome')
    else:
        # 3. Se não houver termo, lista todos
        produtos = Produto.objects.all().order_by('nome')

    contexto = {
        'produtos': produtos,
        'termo_busca': termo_busca
    }
    
    return render(request, 'listagem_produtos.html', contexto)

# ... (Outras views)