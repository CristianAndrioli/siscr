# 🧪 Testes - FASE 2: Reorganização Frontend

## ✅ Checklist de Testes

### 1. Servidor de Desenvolvimento
- [ ] Frontend iniciado em `http://localhost:5173`
- [ ] Backend Django rodando em `http://localhost:8000`
- [ ] PostgreSQL rodando no Docker

### 2. Componentes Reutilizáveis

#### Input
- [ ] Renderiza corretamente com label
- [ ] Campo obrigatório mostra asterisco (*)
- [ ] Campo readonly tem fundo cinza
- [ ] Exibe mensagem de erro quando há erro
- [ ] Formatação automática funcionando (CPF/CNPJ, CEP, telefone)

#### Select
- [ ] Renderiza opções corretamente
- [ ] Integra com ESTADOS, TIPO_CADASTRO, TIPO_PESSOA
- [ ] Exibe mensagem de erro quando há erro

#### Textarea
- [ ] Renderiza corretamente
- [ ] Respeita número de linhas (rows)

#### Button
- [ ] Renderiza variantes (primary, secondary, danger, success)
- [ ] Estado de loading funciona
- [ ] Botão desabilitado funciona

#### Alert
- [ ] Renderiza tipos (success, error, warning, info)
- [ ] Botão de fechar funciona (onClose)

### 3. Hooks Customizados

#### useForm
- [ ] Gerencia estado do formulário
- [ ] handleChange funciona corretamente
- [ ] setFieldValue funciona
- [ ] resetForm limpa formulário

#### useValidation
- [ ] Valida campos individualmente
- [ ] Valida formulário completo
- [ ] Limpa erros corretamente

#### useAuth
- [ ] Verifica autenticação
- [ ] Login funciona
- [ ] Logout funciona

### 4. Utilitários

#### Formatters
- [ ] `formatCPF` formata CPF corretamente
- [ ] `formatCNPJ` formata CNPJ corretamente
- [ ] `formatCPFCNPJ` detecta e formata automaticamente
- [ ] `formatCEP` formata CEP corretamente
- [ ] `formatPhone` formata telefone corretamente
- [ ] `formatCurrency` formata moeda corretamente
- [ ] `formatDate` formata data corretamente

#### Validators
- [ ] `validateCPF` valida CPF corretamente
- [ ] `validateCNPJ` valida CNPJ corretamente
- [ ] `validateEmail` valida email corretamente
- [ ] `validateCEP` valida CEP corretamente
- [ ] `validatePhone` valida telefone corretamente

### 5. Services

#### services/cadastros/pessoas.js
- [ ] Importa corretamente
- [ ] Endpoints corretos (`/api/cadastros/pessoas/`)
- [ ] Métodos (listar, buscar, criar, atualizar, excluir, proximoCodigo)

#### services/auth.js
- [ ] Importa corretamente
- [ ] Login funciona
- [ ] Logout funciona
- [ ] Verifica autenticação

### 6. Página CadastroGeral

#### Funcionalidades
- [ ] Carrega próximo código automaticamente (novo cadastro)
- [ ] Carrega dados existentes (edição)
- [ ] Formatação automática de CPF/CNPJ
- [ ] Formatação automática de CEP
- [ ] Formatação automática de telefone
- [ ] Campos condicionais aparecem/desaparecem corretamente:
  - [ ] Nome Completo (PF ou Funcionário)
  - [ ] Razão Social (PJ)
  - [ ] Contribuinte ICMS (PJ)
  - [ ] Inscrição Estadual (PJ contribuinte)

#### Componentes
- [ ] Input usado para campos de texto
- [ ] Select usado para dropdowns
- [ ] Textarea usado para observações
- [ ] Button usado para ações
- [ ] Alert usado para mensagens de erro

#### Validação
- [ ] Campos obrigatórios validados
- [ ] Erros exibidos corretamente
- [ ] Formatação não quebra validação

#### Integração com API
- [ ] Criar pessoa funciona
- [ ] Atualizar pessoa funciona
- [ ] Redireciona após salvar

### 7. Navegação

- [ ] Login redireciona para dashboard
- [ ] Rotas protegidas funcionam
- [ ] Layout renderiza corretamente
- [ ] Sidebar funciona

---

## 🐛 Problemas Conhecidos a Verificar

1. **Importações**: Verificar se todos os imports estão corretos
2. **Formatação**: Verificar se formatação não quebra valores
3. **API Endpoints**: Verificar se endpoints estão corretos
4. **Validação**: Verificar se validação funciona em tempo real

---

## 📝 Como Testar

### 1. Iniciar Servidores
```bash
# Terminal 1: Backend (já rodando)
docker-compose up

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 2. Acessar Aplicação
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

### 3. Testar Fluxo Completo
1. Fazer login
2. Navegar para Cadastro Geral
3. Preencher formulário
4. Verificar formatação automática
5. Salvar cadastro
6. Verificar se dados foram persistidos

---

## ✅ Resultado Esperado

Após todos os testes:
- ✅ Nenhum erro no console
- ✅ Componentes renderizam corretamente
- ✅ Formatação funciona
- ✅ Validação funciona
- ✅ Integração com API funciona
- ✅ Dados persistem no banco

