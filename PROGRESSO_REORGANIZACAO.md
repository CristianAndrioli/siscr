# 📊 Progresso da Reorganização Backend

## ✅ Concluído

1. ✅ **Apps criados**
   - `accounts/` - App de autenticação/permissões
   - `cadastros/` - App de cadastros

2. ✅ **Models movidos**
   - `Pessoa`, `Produto`, `Servico` → `cadastros/models.py`
   - Constante `ESTADOS_CHOICES` movida também

## 🔄 Em Progresso

3. 🔄 **Forms** - Próximo passo
   - Mover `PessoaForm`, `ProdutoForm`, `ServicoForm` → `cadastros/forms.py`
   - Atualizar imports

4. ⏳ **Views** - Pendente
   - Mover views de cadastro → `cadastros/views.py`
   - Manter views gerais (dashboard, etc.) em `core/views.py` temporariamente

5. ⏳ **Templates** - Pendente
   - Mover templates de cadastro → `cadastros/templates/`
   - Manter templates gerais em `core/templates/` temporariamente

6. ⏳ **API** - Pendente
   - Criar `cadastros/api/`
   - Mover serializers, viewsets, urls

## 📋 Próximos Passos

1. Mover forms e atualizar imports
2. Mover views relacionadas a cadastros
3. Mover templates
4. Mover API
5. Atualizar INSTALLED_APPS
6. Atualizar URLs
7. Criar migrations
8. Testar

